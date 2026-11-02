import type {
  AccessTier,
  BillingPeriod,
  BillingProvider,
  EntitlementSource,
  PurchaseStatus,
  SubscriptionStatus,
} from '../generated/prisma/enums';

export interface SubscriptionPlanView {
  id: string;
  code: string;
  name: string;
  billingPeriod: BillingPeriod;
  priceInPaise: number;
  currency: string;
  googlePlayProductId: string | null;
  benefits: string[];
  order: number;
}

export interface EntitlementView {
  tier: AccessTier;
  isActive: boolean;
  source: EntitlementSource | null;
  validUntil: Date | null;
  /** Convenience flag that mirrors the server-side premium access check. */
  premiumActive: boolean;
}

export interface SubscriptionPlanSummaryView {
  id: string;
  code: string;
  name: string;
  billingPeriod: BillingPeriod;
  priceInPaise: number;
  currency: string;
}

export interface SubscriptionView {
  id: string;
  status: SubscriptionStatus;
  provider: BillingProvider;
  plan: SubscriptionPlanSummaryView;
  autoRenewing: boolean;
  cancelAtPeriodEnd: boolean;
  startedAt: Date | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  canceledAt: Date | null;
  endedAt: Date | null;
  lastVerifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PurchaseSummaryView {
  id: string;
  productId: string;
  orderId: string | null;
  status: PurchaseStatus;
  purchaseTime: Date;
  priceInPaise: number | null;
  currency: string;
  verifiedAt: Date | null;
}

export interface SubscriptionMeView {
  entitlement: EntitlementView;
  subscription: SubscriptionView | null;
  purchases: PurchaseSummaryView[];
  /** Whether the environment has billing enabled. Plans remain readable either way. */
  billingEnabled: boolean;
}

export interface VerifyPurchaseView {
  subscription: SubscriptionView;
  entitlement: EntitlementView;
  /** Present on restore responses; a fresh verification always reports 0. */
  restored: boolean;
}

export interface RestoreFailureView {
  productId: string;
  code: string;
}

export interface RestorePurchasesView {
  entitlement: EntitlementView;
  subscription: SubscriptionView | null;
  restoredCount: number;
  failures: RestoreFailureView[];
  billingEnabled: boolean;
}

export interface BillingWebhookResultView {
  received: true;
  duplicate: boolean;
  processed: boolean;
}
