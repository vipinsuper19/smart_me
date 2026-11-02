import { createHash } from 'node:crypto';
import { BillingProvider, PurchaseStatus, SubscriptionStatus } from '../../generated/prisma/enums';
import { invalidPurchase } from '../billing.errors';
import type {
  PurchaseVerificationInput,
  PurchaseVerifier,
  VerifiedPurchase,
} from './purchase-verifier';

const DAY_MS = 24 * 60 * 60 * 1000;

const MOCK_TOKEN =
  /^mock-(active|canceled|expired|grace|hold|refunded)-([A-Za-z0-9]+)(?:-([A-Za-z0-9]+))?$/;

/**
 * Deterministic verifier for local development and tests.
 *
 * A token of the form `mock-<state>-<userId>` produces a stable purchase so the
 * whole entitlement flow can be exercised without Google Play credentials.
 * It is rejected at boot when billing runs in production (see `env.ts`).
 */
export class MockPurchaseVerifier implements PurchaseVerifier {
  async verifyPurchase(input: PurchaseVerificationInput): Promise<VerifiedPurchase> {
    const match = MOCK_TOKEN.exec(input.purchaseToken);
    if (!match) {
      throw invalidPurchase('Mock purchases must use a token such as mock-active-<userId>.');
    }

    const [, state, userId] = match;
    const now = new Date();
    const startedAt = new Date(now.getTime() - 5 * DAY_MS);
    const orderId = `MOCK-${createHash('sha256')
      .update(input.purchaseToken)
      .digest('hex')
      .slice(0, 24)
      .toUpperCase()}`;

    let status: SubscriptionStatus;
    let periodEnd: Date;
    let autoRenewing = true;
    let cancelAtPeriodEnd = false;
    let purchaseStatus: PurchaseStatus = PurchaseStatus.VERIFIED;

    switch (state) {
      case 'canceled':
        status = SubscriptionStatus.CANCELED;
        periodEnd = new Date(now.getTime() + 10 * DAY_MS);
        autoRenewing = false;
        cancelAtPeriodEnd = true;
        break;
      case 'expired':
        status = SubscriptionStatus.EXPIRED;
        periodEnd = new Date(now.getTime() - 10 * DAY_MS);
        autoRenewing = false;
        break;
      case 'grace':
        status = SubscriptionStatus.GRACE_PERIOD;
        periodEnd = new Date(now.getTime() - DAY_MS);
        break;
      case 'hold':
        status = SubscriptionStatus.ON_HOLD;
        periodEnd = new Date(now.getTime() + 5 * DAY_MS);
        autoRenewing = false;
        break;
      case 'refunded':
        status = SubscriptionStatus.REFUNDED;
        periodEnd = new Date(now.getTime() - DAY_MS);
        autoRenewing = false;
        purchaseStatus = PurchaseStatus.REFUNDED;
        break;
      default:
        status = SubscriptionStatus.ACTIVE;
        periodEnd = new Date(now.getTime() + 30 * DAY_MS);
        break;
    }

    return {
      provider: BillingProvider.MOCK,
      productId: input.productId,
      providerSubscriptionId: `mock-${createHash('sha256')
        .update(input.purchaseToken)
        .digest('hex')
        .slice(0, 20)}`,
      orderId,
      purchaseTime: startedAt,
      purchaseStatus,
      status,
      autoRenewing,
      startedAt,
      currentPeriodStart: startedAt,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd,
      priceInPaise: null,
      currency: 'INR',
      obfuscatedAccountId: userId,
      rawPayload: {
        provider: 'MOCK',
        purchaseTokenSuffix: input.purchaseToken.slice(-6),
        state,
      },
    };
  }
}
