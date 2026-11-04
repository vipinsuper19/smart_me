import { HttpException, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { Prisma } from '../generated/prisma/client';
import {
  AccessTier,
  BillingEventType,
  BillingProvider,
  EntitlementSource,
  PurchaseStatus,
  SubscriptionStatus,
} from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import {
  billingDisabled,
  billingNotConfigured,
  billingProcessingFailed,
  invalidWebhookPayload,
  invalidWebhookSecret,
  purchaseAlreadyClaimed,
  purchaseOwnershipMismatch,
  subscriptionNotFound,
  unknownProduct,
} from './billing.errors';
import { googleNotificationSchema, pubSubPushSchema } from './billing.schemas';
import type { GoogleNotification } from './billing.schemas';
import type {
  BillingWebhookResultView,
  EntitlementView,
  PurchaseSummaryView,
  RestorePurchasesView,
  SubscriptionMeView,
  SubscriptionPlanView,
  SubscriptionView,
  VerifyPurchaseView,
} from './billing.types';
import type { VerifyPurchaseDto, RestorePurchasesDto } from './dto/purchase.dto';
import { PURCHASE_VERIFIER } from './services/purchase-verifier';
import type { PurchaseVerifier, VerifiedPurchase } from './services/purchase-verifier';

const DAY_MS = 24 * 60 * 60 * 1000;

const TERMINAL_STATUSES = new Set<SubscriptionStatus>([
  SubscriptionStatus.EXPIRED,
  SubscriptionStatus.REFUNDED,
  SubscriptionStatus.REVOKED,
]);

const REPLACEABLE_STATUSES: SubscriptionStatus[] = [
  SubscriptionStatus.PENDING,
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.GRACE_PERIOD,
  SubscriptionStatus.PAUSED,
  SubscriptionStatus.ON_HOLD,
  SubscriptionStatus.CANCELED,
];

/**
 * Statuses covered by the database's partial unique index
 * `subscriptions_one_current_per_user`.
 */
const LIVE_DB_STATUSES: SubscriptionStatus[] = [
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.GRACE_PERIOD,
  SubscriptionStatus.PAUSED,
  SubscriptionStatus.ON_HOLD,
];

const ENTITLED_STATUSES = new Set<SubscriptionStatus>([
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.GRACE_PERIOD,
  SubscriptionStatus.CANCELED,
]);

type SubscriptionWithPlan = Prisma.SubscriptionGetPayload<{ include: { plan: true } }>;

interface EventProcessResult {
  processed: boolean;
  subscriptionId?: string | null;
  error?: string;
}

/**
 * Maps a Google Play RTDN subscription notification type to a local event type.
 * The original numeric type is always stored in `providerEventType`.
 */
export function mapNotificationType(notification: GoogleNotification): BillingEventType {
  if (notification.voidedPurchaseNotification) {
    return BillingEventType.REFUND;
  }
  if (notification.testNotification) {
    return BillingEventType.TEST;
  }

  switch (notification.subscriptionNotification?.notificationType) {
    case 3:
      return BillingEventType.CANCEL;
    case 4:
      return BillingEventType.PURCHASE;
    case 5:
    case 9:
    case 10:
    case 13:
      return BillingEventType.EXPIRY;
    case 6:
      return BillingEventType.GRACE_PERIOD;
    case 12:
      return BillingEventType.REVOKE;
    default:
      return BillingEventType.RENEWAL;
  }
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(PURCHASE_VERIFIER) private readonly verifier: PurchaseVerifier,
  ) {}

  get billingEnabled(): boolean {
    return this.config.get<boolean>('BILLING_ENABLED') === true;
  }

  private get graceDays(): number {
    const value = Number(this.config.get<string | number>('BILLING_GRACE_PERIOD_DAYS') ?? 3);
    return Number.isFinite(value) && value >= 0 ? value : 3;
  }

  async listPlans(): Promise<{ items: SubscriptionPlanView[] }> {
    const plans = await this.prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });

    return {
      items: plans.map((plan) => ({
        id: plan.id,
        code: plan.code,
        name: plan.name,
        billingPeriod: plan.billingPeriod,
        priceInPaise: plan.priceInPaise,
        currency: plan.currency,
        googlePlayProductId: plan.googlePlayProductId,
        benefits: plan.benefits,
        order: plan.order,
      })),
    };
  }

  async getMySubscription(userId: string): Promise<SubscriptionMeView> {
    await this.reconcileExpired(userId);

    const [state, purchases] = await Promise.all([
      this.readState(userId),
      this.prisma.purchase.findMany({
        where: { userId },
        orderBy: { purchaseTime: 'desc' },
        take: 10,
      }),
    ]);

    return {
      ...state,
      purchases: purchases.map((purchase) => this.toPurchaseView(purchase)),
      billingEnabled: this.billingEnabled,
    };
  }

  async verifyPurchase(userId: string, dto: VerifyPurchaseDto): Promise<VerifyPurchaseView> {
    this.assertBillingEnabled();
    const plan = await this.findPlan(dto.productId);
    const tokenHash = this.hashToken(dto.purchaseToken);

    const existing = await this.prisma.purchase.findFirst({
      where: { purchaseTokenHash: tokenHash },
    });
    if (existing && existing.userId !== userId) {
      throw purchaseAlreadyClaimed();
    }

    // Repeated verification of a token we already granted is a no-op rather
    // than a second entitlement or XP-like side effect.
    if (
      existing?.status === PurchaseStatus.VERIFIED &&
      existing.subscriptionId &&
      existing.verifiedAt
    ) {
      return this.verificationResult(userId, false);
    }

    const verified = await this.verifier.verifyPurchase({
      productId: dto.productId,
      purchaseToken: dto.purchaseToken,
    });
    this.assertPurchaseBelongsToUser(verified, userId);

    await this.applyState(userId, plan, verified, tokenHash);
    await this.recordEvent(verified.provider, `verify:${tokenHash}`, BillingEventType.PURCHASE, {
      productId: verified.productId,
      status: verified.status,
      provider: verified.provider,
    });

    if (verified.provider === BillingProvider.GOOGLE_PLAY) {
      await this.verifier.acknowledge?.({
        productId: verified.productId,
        purchaseToken: dto.purchaseToken,
      });
    }

    return this.verificationResult(userId, false);
  }

  async restorePurchases(userId: string, dto: RestorePurchasesDto): Promise<RestorePurchasesView> {
    this.assertBillingEnabled();

    let restoredCount = 0;
    const failures: RestorePurchasesView['failures'] = [];

    for (const item of dto.purchases) {
      try {
        const plan = await this.findPlan(item.productId);
        const tokenHash = this.hashToken(item.purchaseToken);
        const existing = await this.prisma.purchase.findFirst({
          where: { purchaseTokenHash: tokenHash },
        });

        // Never reveal or transfer another learner's purchase.
        if (existing && existing.userId !== userId) {
          failures.push({ productId: item.productId, code: 'PURCHASE_ALREADY_CLAIMED' });
          continue;
        }

        const verified = await this.verifier.verifyPurchase({
          productId: item.productId,
          purchaseToken: item.purchaseToken,
        });
        if (verified.obfuscatedAccountId && verified.obfuscatedAccountId !== userId) {
          failures.push({ productId: item.productId, code: 'PURCHASE_OWNERSHIP_MISMATCH' });
          continue;
        }

        await this.applyState(userId, plan, verified, tokenHash);
        await this.recordEvent(
          verified.provider,
          `restore:${tokenHash}`,
          BillingEventType.RENEWAL,
          {
            productId: verified.productId,
            status: verified.status,
            provider: verified.provider,
            restored: true,
          },
        );
        restoredCount += 1;
      } catch (error) {
        failures.push({
          productId: item.productId,
          code: this.errorCode(error),
        });
      }
    }

    await this.reconcileExpired(userId);
    const state = await this.readState(userId);

    return {
      ...state,
      restoredCount,
      failures,
      billingEnabled: this.billingEnabled,
    };
  }

  async handleGooglePlayNotification(
    body: unknown,
    providedSecret: string | undefined,
  ): Promise<BillingWebhookResultView> {
    this.assertBillingEnabled();
    this.assertWebhookSecret(providedSecret);

    const envelope = pubSubPushSchema.safeParse(body);
    if (!envelope.success) {
      throw invalidWebhookPayload(envelope.error.issues[0]?.message ?? 'Invalid Pub/Sub envelope.');
    }

    const eventId = envelope.data.message.messageId;
    const notification = this.decodeNotification(envelope.data.message.data);

    const eventType = mapNotificationType(notification);
    const purchaseToken =
      notification.subscriptionNotification?.purchaseToken ??
      notification.voidedPurchaseNotification?.purchaseToken ??
      null;
    const tokenHash = purchaseToken ? this.hashToken(purchaseToken) : null;

    // `(provider, eventId)` is unique, so duplicate Pub/Sub deliveries collapse
    // into a single record and a single state transition.
    const event = await this.prisma.billingEvent.upsert({
      where: { provider_eventId: { provider: BillingProvider.GOOGLE_PLAY, eventId } },
      create: {
        provider: BillingProvider.GOOGLE_PLAY,
        eventId,
        providerEventType: String(
          notification.subscriptionNotification?.notificationType ??
            (notification.voidedPurchaseNotification ? 'VOIDED_PURCHASE' : 'TEST'),
        ),
        type: eventType,
        purchaseTokenHash: tokenHash,
        payload: this.jsonValue(notification),
        attempts: 1,
      },
      update: {
        attempts: { increment: 1 },
        type: eventType,
        purchaseTokenHash: tokenHash,
      },
    });

    if (event.processedAt) {
      return { received: true, duplicate: true, processed: true };
    }

    try {
      const result = await this.processNotification(notification);
      await this.prisma.billingEvent.update({
        where: { id: event.id },
        data: result.processed
          ? {
              processedAt: new Date(),
              processingError: null,
              subscriptionId: result.subscriptionId ?? event.subscriptionId,
              nextRetryAt: null,
            }
          : {
              // Leaving `processedAt` null keeps the event eligible when Pub/Sub
              // redelivers it or a retry job runs. Marking it processed here
              // would permanently drop an event we could not attribute yet.
              processingError: result.error ?? 'NOT_PROCESSED',
              subscriptionId: result.subscriptionId ?? event.subscriptionId,
              nextRetryAt: new Date(Date.now() + 5 * 60_000),
            },
      });
      return { received: true, duplicate: false, processed: result.processed };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Billing notification ${eventId} failed: ${message}`);
      await this.prisma.billingEvent.update({
        where: { id: event.id },
        data: {
          processingError: message,
          nextRetryAt: new Date(Date.now() + 5 * 60_000),
        },
      });
      throw billingProcessingFailed();
    }
  }

  private async processNotification(notification: GoogleNotification): Promise<EventProcessResult> {
    if (notification.testNotification) {
      return { processed: true };
    }
    if (notification.voidedPurchaseNotification) {
      return this.processVoidedPurchase(notification);
    }
    if (notification.subscriptionNotification) {
      return this.processSubscriptionNotification(notification);
    }
    // Unknown notification families are stored for inspection without failing
    // the push subscription.
    return { processed: true };
  }

  private async processSubscriptionNotification(
    notification: GoogleNotification,
  ): Promise<EventProcessResult> {
    const subscriptionNotification = notification.subscriptionNotification;
    if (!subscriptionNotification) {
      return { processed: true };
    }

    const { purchaseToken, subscriptionId: productId } = subscriptionNotification;
    const tokenHash = this.hashToken(purchaseToken);
    const existingPurchase = await this.prisma.purchase.findFirst({
      where: { purchaseTokenHash: tokenHash },
      select: { userId: true },
    });

    const verified = await this.verifier.verifyPurchase({ productId, purchaseToken });

    let userId = existingPurchase?.userId ?? null;
    if (!userId && verified.obfuscatedAccountId) {
      const user = await this.prisma.user.findUnique({
        where: { id: verified.obfuscatedAccountId },
        select: { id: true },
      });
      userId = user?.id ?? null;
    }

    if (!userId) {
      // The app sets obfuscatedAccountId on the purchase; without it a webhook
      // that arrives before the first client verification cannot be attributed.
      return { processed: false, error: 'PURCHASE_NOT_LINKED' };
    }

    const plan = await this.prisma.subscriptionPlan.findFirst({
      where: { googlePlayProductId: verified.productId, isActive: true },
    });
    if (!plan) {
      return { processed: false, error: 'UNKNOWN_PRODUCT' };
    }

    const subscriptionId = await this.applyState(userId, plan, verified, tokenHash);
    return { processed: true, subscriptionId };
  }

  private async processVoidedPurchase(
    notification: GoogleNotification,
  ): Promise<EventProcessResult> {
    const voided = notification.voidedPurchaseNotification;
    if (!voided) {
      return { processed: true };
    }

    const tokenHash = this.hashToken(voided.purchaseToken);
    const purchase = await this.prisma.purchase.findFirst({
      where: { purchaseTokenHash: tokenHash },
      select: { id: true, userId: true, subscriptionId: true },
    });

    if (!purchase) {
      return { processed: false, error: 'PURCHASE_NOT_LINKED' };
    }

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.purchase.update({
        where: { id: purchase.id },
        data: { status: PurchaseStatus.REFUNDED },
      });

      if (purchase.subscriptionId) {
        await tx.subscription.updateMany({
          where: { id: purchase.subscriptionId },
          data: { status: SubscriptionStatus.REFUNDED, endedAt: now, autoRenewing: false },
        });
        await tx.entitlement.updateMany({
          where: { userId: purchase.userId, subscriptionId: purchase.subscriptionId },
          data: {
            tier: AccessTier.FREE,
            isActive: false,
            source: EntitlementSource.SUBSCRIPTION,
            validUntil: now,
          },
        });
      }
    });

    return { processed: true, subscriptionId: purchase.subscriptionId };
  }

  private async applyState(
    userId: string,
    plan: { id: string; priceInPaise: number; currency: string },
    verified: VerifiedPurchase,
    tokenHash: string,
  ): Promise<string> {
    const now = new Date();
    const graceMs = this.graceDays * DAY_MS;

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.subscription.findUnique({
        where: { purchaseTokenHash: tokenHash },
      });
      if (existing && existing.userId !== userId) {
        throw purchaseAlreadyClaimed();
      }

      const data = {
        userId,
        planId: plan.id,
        provider: verified.provider,
        status: verified.status,
        providerSubscriptionId: verified.providerSubscriptionId,
        purchaseTokenHash: tokenHash,
        autoRenewing: verified.autoRenewing,
        startedAt: verified.startedAt ?? existing?.startedAt ?? now,
        currentPeriodStart: verified.currentPeriodStart ?? existing?.currentPeriodStart ?? null,
        currentPeriodEnd: verified.currentPeriodEnd ?? existing?.currentPeriodEnd ?? null,
        cancelAtPeriodEnd: verified.cancelAtPeriodEnd,
        canceledAt:
          verified.status === SubscriptionStatus.CANCELED || verified.cancelAtPeriodEnd
            ? (existing?.canceledAt ?? now)
            : null,
        endedAt: TERMINAL_STATUSES.has(verified.status) ? (verified.currentPeriodEnd ?? now) : null,
        lastVerifiedAt: now,
      };

      // The database allows one live subscription per learner. Retire any
      // previous live row before inserting or reactivating this one.
      if (LIVE_DB_STATUSES.includes(verified.status)) {
        await tx.subscription.updateMany({
          where: {
            userId,
            status: { in: LIVE_DB_STATUSES },
            OR: [{ purchaseTokenHash: null }, { purchaseTokenHash: { not: tokenHash } }],
          },
          data: { status: SubscriptionStatus.EXPIRED, endedAt: now, autoRenewing: false },
        });
      }

      const subscription = existing
        ? await tx.subscription.update({ where: { id: existing.id }, data })
        : await tx.subscription.create({ data });

      // One premium subscription per learner. Retire non-live predecessors
      // (pending or canceled rows are outside the partial unique index).
      if (ENTITLED_STATUSES.has(verified.status)) {
        await tx.subscription.updateMany({
          where: {
            userId,
            id: { not: subscription.id },
            status: { in: [SubscriptionStatus.PENDING, SubscriptionStatus.CANCELED] },
          },
          data: { status: SubscriptionStatus.EXPIRED, endedAt: now, autoRenewing: false },
        });
      }

      const purchaseExisting = verified.orderId
        ? await tx.purchase.findFirst({
            where: {
              OR: [{ purchaseTokenHash: tokenHash }, { orderId: verified.orderId }],
            },
          })
        : await tx.purchase.findFirst({ where: { purchaseTokenHash: tokenHash } });

      if (purchaseExisting && purchaseExisting.userId !== userId) {
        throw purchaseAlreadyClaimed();
      }

      const purchaseData = {
        userId,
        subscriptionId: subscription.id,
        provider: verified.provider,
        productId: verified.productId,
        orderId: verified.orderId,
        purchaseTokenHash: tokenHash,
        purchaseTime: verified.purchaseTime,
        priceInPaise: verified.priceInPaise ?? plan.priceInPaise,
        currency: verified.currency ?? plan.currency,
        status: verified.purchaseStatus,
        rawPayload: this.jsonValue(verified.rawPayload),
        verifiedAt: verified.purchaseStatus === PurchaseStatus.VERIFIED ? now : null,
      };

      if (purchaseExisting) {
        await tx.purchase.update({ where: { id: purchaseExisting.id }, data: purchaseData });
      } else {
        await tx.purchase.create({ data: purchaseData });
      }

      const access = this.accessFor(verified.status, verified.currentPeriodEnd, now, graceMs);
      await tx.entitlement.upsert({
        where: { userId },
        create: {
          userId,
          tier: access.tier,
          isActive: access.isActive,
          source: EntitlementSource.SUBSCRIPTION,
          validUntil: access.validUntil,
          subscriptionId: subscription.id,
        },
        update: {
          tier: access.tier,
          isActive: access.isActive,
          source: EntitlementSource.SUBSCRIPTION,
          validUntil: access.validUntil,
          subscriptionId: subscription.id,
        },
      });

      return subscription.id;
    });
  }

  private accessFor(
    status: SubscriptionStatus,
    currentPeriodEnd: Date | null,
    now: Date,
    graceMs: number,
  ): { tier: AccessTier; isActive: boolean; validUntil: Date | null } {
    const validUntil = currentPeriodEnd ? new Date(currentPeriodEnd.getTime() + graceMs) : null;
    const withinAccess = validUntil === null || validUntil > now;
    const premium = ENTITLED_STATUSES.has(status) && withinAccess;

    return {
      tier: premium ? AccessTier.PREMIUM : AccessTier.FREE,
      isActive: premium,
      validUntil,
    };
  }

  /**
   * Expiry is enforced immediately by the entitlement's `validUntil`; this
   * reconciliation keeps the subscription rows and entitlement in sync when a
   * delayed webhook never arrives.
   */
  private async reconcileExpired(userId: string): Promise<void> {
    const now = new Date();
    const cutoff = new Date(now.getTime() - this.graceDays * DAY_MS);

    const stale = await this.prisma.subscription.findMany({
      where: {
        userId,
        status: { in: REPLACEABLE_STATUSES },
        currentPeriodEnd: { lt: cutoff },
      },
      select: { id: true },
    });

    if (stale.length === 0) {
      return;
    }

    const ids = stale.map((subscription) => subscription.id);
    await this.prisma.$transaction(async (tx) => {
      await tx.subscription.updateMany({
        where: { id: { in: ids }, status: { in: REPLACEABLE_STATUSES } },
        data: { status: SubscriptionStatus.EXPIRED, endedAt: now, autoRenewing: false },
      });
      await tx.entitlement.updateMany({
        where: { userId, subscriptionId: { in: ids } },
        data: {
          tier: AccessTier.FREE,
          isActive: false,
          source: EntitlementSource.SUBSCRIPTION,
          validUntil: now,
        },
      });
    });
  }

  private async verificationResult(userId: string, restored: boolean): Promise<VerifyPurchaseView> {
    const state = await this.readState(userId);
    if (!state.subscription) {
      throw subscriptionNotFound();
    }
    return { entitlement: state.entitlement, subscription: state.subscription, restored };
  }

  private async readState(
    userId: string,
  ): Promise<{ entitlement: EntitlementView; subscription: SubscriptionView | null }> {
    const [entitlement, subscription] = await Promise.all([
      this.prisma.entitlement.findUnique({ where: { userId } }),
      this.prisma.subscription.findFirst({
        where: { userId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: { plan: true },
      }),
    ]);

    return {
      entitlement: this.toEntitlementView(entitlement),
      subscription: subscription ? this.toSubscriptionView(subscription) : null,
    };
  }

  private toEntitlementView(
    entitlement: {
      tier: AccessTier;
      isActive: boolean;
      source: EntitlementSource | null;
      validUntil: Date | null;
    } | null,
  ): EntitlementView {
    if (!entitlement) {
      return {
        tier: AccessTier.FREE,
        isActive: false,
        source: null,
        validUntil: null,
        premiumActive: false,
      };
    }

    const premiumActive =
      entitlement.tier === AccessTier.PREMIUM &&
      entitlement.isActive &&
      (entitlement.validUntil === null || entitlement.validUntil > new Date());

    return {
      tier: entitlement.tier,
      isActive: entitlement.isActive,
      source: entitlement.source,
      validUntil: entitlement.validUntil,
      premiumActive,
    };
  }

  private toSubscriptionView(subscription: SubscriptionWithPlan): SubscriptionView {
    return {
      id: subscription.id,
      status: subscription.status,
      provider: subscription.provider,
      plan: {
        id: subscription.plan.id,
        code: subscription.plan.code,
        name: subscription.plan.name,
        billingPeriod: subscription.plan.billingPeriod,
        priceInPaise: subscription.plan.priceInPaise,
        currency: subscription.plan.currency,
      },
      autoRenewing: subscription.autoRenewing,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      startedAt: subscription.startedAt,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      canceledAt: subscription.canceledAt,
      endedAt: subscription.endedAt,
      lastVerifiedAt: subscription.lastVerifiedAt,
      createdAt: subscription.createdAt,
      updatedAt: subscription.updatedAt,
    };
  }

  private toPurchaseView(purchase: {
    id: string;
    productId: string;
    orderId: string | null;
    status: PurchaseStatus;
    purchaseTime: Date;
    priceInPaise: number | null;
    currency: string;
    verifiedAt: Date | null;
  }): PurchaseSummaryView {
    return {
      id: purchase.id,
      productId: purchase.productId,
      orderId: purchase.orderId,
      status: purchase.status,
      purchaseTime: purchase.purchaseTime,
      priceInPaise: purchase.priceInPaise,
      currency: purchase.currency,
      verifiedAt: purchase.verifiedAt,
    };
  }

  private async findPlan(productId: string) {
    const plan = await this.prisma.subscriptionPlan.findFirst({
      where: { googlePlayProductId: productId, isActive: true },
      select: { id: true, priceInPaise: true, currency: true },
    });
    if (!plan) {
      throw unknownProduct(productId);
    }
    return plan;
  }

  private assertBillingEnabled(): void {
    if (!this.billingEnabled) {
      throw billingDisabled();
    }
  }

  private assertPurchaseBelongsToUser(verified: VerifiedPurchase, userId: string): void {
    if (verified.obfuscatedAccountId && verified.obfuscatedAccountId !== userId) {
      throw purchaseOwnershipMismatch();
    }
  }

  private assertWebhookSecret(providedSecret: string | undefined): void {
    const expected = this.config.get<string>('GOOGLE_PLAY_RTDN_SECRET');
    if (!expected) {
      throw billingNotConfigured();
    }
    if (!providedSecret) {
      throw invalidWebhookSecret();
    }

    const provided = Buffer.from(providedSecret);
    const expectedBuffer = Buffer.from(expected);
    if (provided.length !== expectedBuffer.length || !timingSafeEqual(provided, expectedBuffer)) {
      throw invalidWebhookSecret();
    }
  }

  private decodeNotification(data: string): GoogleNotification {
    let parsed: unknown;
    try {
      parsed = JSON.parse(Buffer.from(data, 'base64').toString('utf8'));
    } catch {
      throw invalidWebhookPayload('The notification data is not valid base64 JSON.');
    }

    const result = googleNotificationSchema.safeParse(parsed);
    if (!result.success) {
      throw invalidWebhookPayload(
        result.error.issues[0]?.message ?? 'The notification payload has an unexpected shape.',
      );
    }
    return result.data;
  }

  private async recordEvent(
    provider: BillingProvider,
    eventId: string,
    type: BillingEventType,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.billingEvent.upsert({
      where: { provider_eventId: { provider, eventId } },
      create: {
        provider,
        eventId,
        providerEventType: type,
        type,
        payload: this.jsonValue(payload),
        processedAt: new Date(),
      },
      update: {
        processedAt: new Date(),
        processingError: null,
      },
    });
  }

  private hashToken(purchaseToken: string): string {
    return createHash('sha256').update(purchaseToken).digest('hex');
  }

  private errorCode(error: unknown): string {
    if (error instanceof HttpException) {
      const response = error.getResponse();
      if (response && typeof response === 'object' && 'code' in response) {
        return String((response as { code: unknown }).code);
      }
    }
    return 'INVALID_PURCHASE';
  }

  private jsonValue(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
  }
}
