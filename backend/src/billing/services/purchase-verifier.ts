import type {
  BillingProvider,
  PurchaseStatus,
  SubscriptionStatus,
} from '../../generated/prisma/enums';

export const PURCHASE_VERIFIER = Symbol('PURCHASE_VERIFIER');

export interface PurchaseVerificationInput {
  productId: string;
  purchaseToken: string;
}

/**
 * Normalised, server-verified purchase state.
 *
 * The client never supplies any of these fields. They come from the billing
 * provider (Google Play) or, in development, from the deterministic mock.
 */
export interface VerifiedPurchase {
  provider: BillingProvider;
  productId: string;
  providerSubscriptionId: string;
  orderId: string | null;
  purchaseTime: Date;
  purchaseStatus: PurchaseStatus;
  status: SubscriptionStatus;
  autoRenewing: boolean;
  startedAt: Date | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  priceInPaise: number | null;
  /** Null when the store does not return a price; the plan currency is used. */
  currency: string | null;
  /**
   * Google Play `obfuscatedExternalAccountId`, set by the Android client to the
   * SmartMe user id. It lets an RTDN webhook arriving before the first
   * verification still be attributed to the right learner.
   */
  obfuscatedAccountId: string | null;
  rawPayload: unknown;
}

export interface PurchaseVerifier {
  verifyPurchase(input: PurchaseVerificationInput): Promise<VerifiedPurchase>;
  /** Best-effort acknowledgement; only Google Play implements it. */
  acknowledge?(input: PurchaseVerificationInput): Promise<void>;
}
