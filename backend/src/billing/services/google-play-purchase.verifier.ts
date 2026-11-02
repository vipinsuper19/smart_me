import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { GoogleAuth } from 'google-auth-library';
import { BillingProvider, PurchaseStatus, SubscriptionStatus } from '../../generated/prisma/enums';
import { billingNotConfigured, invalidPurchase } from '../billing.errors';
import type {
  PurchaseVerificationInput,
  PurchaseVerifier,
  VerifiedPurchase,
} from './purchase-verifier';

const ANDROID_PUBLISHER_BASE = 'https://androidpublisher.googleapis.com/androidpublisher/v3';
const ANDROID_PUBLISHER_SCOPE = 'https://www.googleapis.com/auth/androidpublisher';

/** Subset of the Google Play `subscriptionsv2` resource used by SmartMe. */
export interface GoogleSubscriptionV2 {
  subscriptionState?: string;
  startTime?: string;
  latestOrderId?: string;
  acknowledgementState?: string;
  externalAccountIdentifiers?: {
    obfuscatedExternalAccountId?: string;
    obfuscatedExternalProfileId?: string;
  };
  canceledStateContext?: {
    userInitiatedCancellation?: unknown;
    systemInitiatedCancellation?: unknown;
    developerInitiatedCancellation?: unknown;
    replacementCancellation?: unknown;
  };
  lineItems?: {
    productId?: string;
    expiryTime?: string;
    autoRenewingPlan?: {
      autoRenewEnabled?: boolean;
    };
  }[];
  testPurchase?: unknown;
}

const GOOGLE_STATUS: Record<string, SubscriptionStatus> = {
  SUBSCRIPTION_STATE_PENDING: SubscriptionStatus.PENDING,
  SUBSCRIPTION_STATE_ACTIVE: SubscriptionStatus.ACTIVE,
  SUBSCRIPTION_STATE_PAUSED: SubscriptionStatus.PAUSED,
  SUBSCRIPTION_STATE_IN_GRACE_PERIOD: SubscriptionStatus.GRACE_PERIOD,
  SUBSCRIPTION_STATE_ON_HOLD: SubscriptionStatus.ON_HOLD,
  SUBSCRIPTION_STATE_CANCELED: SubscriptionStatus.CANCELED,
  SUBSCRIPTION_STATE_EXPIRED: SubscriptionStatus.EXPIRED,
};

function parseDate(value: string | undefined): Date | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Converts a Google Play `subscriptionsv2` payload into the normalised shape
 * the rest of the billing module understands. Exported so the mapping can be
 * unit-tested without network access.
 */
export function mapGoogleSubscriptionV2(
  payload: GoogleSubscriptionV2,
  requestedProductId: string,
): VerifiedPurchase {
  const lineItem =
    payload.lineItems?.find((item) => item.productId === requestedProductId) ??
    payload.lineItems?.[0];
  const productId = lineItem?.productId;

  if (!productId) {
    throw invalidPurchase('The store response did not include a subscription product.');
  }

  const status = GOOGLE_STATUS[payload.subscriptionState ?? ''] ?? SubscriptionStatus.PENDING;
  const startedAt = parseDate(payload.startTime);
  const currentPeriodEnd = parseDate(lineItem?.expiryTime);
  const cancelContext = payload.canceledStateContext ?? {};
  const cancelAtPeriodEnd = Boolean(
    cancelContext.userInitiatedCancellation ??
    cancelContext.systemInitiatedCancellation ??
    cancelContext.developerInitiatedCancellation ??
    cancelContext.replacementCancellation,
  );

  return {
    provider: BillingProvider.GOOGLE_PLAY,
    productId,
    providerSubscriptionId: payload.latestOrderId ?? productId,
    orderId: payload.latestOrderId ?? null,
    purchaseTime: startedAt ?? new Date(),
    purchaseStatus: PurchaseStatus.VERIFIED,
    status,
    autoRenewing: lineItem?.autoRenewingPlan?.autoRenewEnabled ?? false,
    startedAt,
    currentPeriodStart: null,
    currentPeriodEnd,
    cancelAtPeriodEnd,
    priceInPaise: null,
    currency: null,
    obfuscatedAccountId: payload.externalAccountIdentifiers?.obfuscatedExternalAccountId ?? null,
    rawPayload: payload,
  };
}

/**
 * Verifies Google Play purchases with the Android Publisher API.
 *
 * Credentials are read lazily so an environment with billing disabled can boot
 * without a service account.
 */
export class GooglePlayPurchaseVerifier implements PurchaseVerifier {
  private readonly logger = new Logger(GooglePlayPurchaseVerifier.name);
  private auth: GoogleAuth | null = null;

  constructor(private readonly config: ConfigService) {}

  async verifyPurchase(input: PurchaseVerificationInput): Promise<VerifiedPurchase> {
    const payload = await this.fetchSubscription(input.purchaseToken);
    const verified = mapGoogleSubscriptionV2(payload, input.productId);

    if (payload.acknowledgementState === 'PENDING') {
      await this.acknowledge(input);
    }

    return verified;
  }

  async acknowledge(input: PurchaseVerificationInput): Promise<void> {
    const packageName = this.packageName();
    const token = await this.accessToken();
    const url = `${ANDROID_PUBLISHER_BASE}/applications/${encodeURIComponent(
      packageName,
    )}/purchases/subscriptions/${encodeURIComponent(
      input.productId,
    )}/tokens/${encodeURIComponent(input.purchaseToken)}:acknowledge`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (!response.ok) {
        this.logger.warn(
          `Google Play acknowledgement failed with HTTP ${response.status}; the entitlement is still granted server-side.`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Google Play acknowledgement request failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async fetchSubscription(purchaseToken: string): Promise<GoogleSubscriptionV2> {
    const packageName = this.packageName();
    const token = await this.accessToken();
    const url = `${ANDROID_PUBLISHER_BASE}/applications/${encodeURIComponent(
      packageName,
    )}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`;

    let response: Response;
    try {
      response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (error) {
      this.logger.warn(
        `Google Play verification request failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw invalidPurchase('The store could not be reached to verify this purchase.');
    }

    if (response.status === 400 || response.status === 404 || response.status === 410) {
      throw invalidPurchase('The store rejected this purchase token.');
    }
    if (!response.ok) {
      this.logger.warn(`Google Play verification returned HTTP ${response.status}.`);
      throw invalidPurchase('The store could not verify this purchase right now.');
    }

    return (await response.json()) as GoogleSubscriptionV2;
  }

  private packageName(): string {
    const packageName = this.config.get<string>('GOOGLE_PLAY_PACKAGE_NAME');
    if (!packageName) {
      throw billingNotConfigured();
    }
    return packageName;
  }

  private async accessToken(): Promise<string> {
    const credentialsJson = this.config.get<string>('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON');
    if (!credentialsJson) {
      throw billingNotConfigured();
    }

    if (!this.auth) {
      let credentials: Record<string, unknown>;
      try {
        credentials = JSON.parse(credentialsJson) as Record<string, unknown>;
      } catch {
        throw billingNotConfigured();
      }
      this.auth = new GoogleAuth({ credentials, scopes: [ANDROID_PUBLISHER_SCOPE] });
    }

    const client = await this.auth.getClient();
    const token = await client.getAccessToken();
    if (!token.token) {
      throw billingNotConfigured();
    }
    return token.token;
  }
}
