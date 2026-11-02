import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'node:crypto';
import { ApiException } from '../common/errors/api-error';
import { hasPremiumAccess } from '../content/premium-access';
import {
  BillingPeriod,
  BillingProvider,
  PurchaseStatus,
  SubscriptionStatus,
} from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { BillingService } from './billing.service';
import { MockPurchaseVerifier } from './services/mock-purchase.verifier';

const DATABASE_URL = process.env.DATABASE_URL;
const describeIfDatabase = DATABASE_URL ? describe : describe.skip;

const baseConfig = {
  DATABASE_URL: DATABASE_URL ?? '',
  DATABASE_POOL_MAX: 5,
  BILLING_ENABLED: true,
  BILLING_PROVIDER: 'mock',
  BILLING_GRACE_PERIOD_DAYS: 3,
  GOOGLE_PLAY_RTDN_SECRET: 'integration-test-secret',
};

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function pushEnvelope(messageId: string, payload: unknown) {
  return {
    message: {
      messageId,
      data: Buffer.from(JSON.stringify(payload)).toString('base64'),
      publishTime: new Date().toISOString(),
    },
    subscription: 'projects/smartme-test/subscriptions/rtdn',
  };
}

async function expectApiError(action: Promise<unknown>): Promise<{ code: string; status: number }> {
  try {
    await action;
  } catch (error) {
    if (error instanceof ApiException) {
      const body = error.getResponse() as { code: string };
      return { code: body.code, status: error.getStatus() };
    }
    throw error;
  }
  throw new Error('Expected the call to fail, but it succeeded.');
}

describeIfDatabase('Subscriptions and billing integration', () => {
  jest.setTimeout(60_000);

  let prisma: PrismaService;
  let billing: BillingService;
  let disabledBilling: BillingService;
  let plan: { id: string; googlePlayProductId: string };
  const suffix = randomUUID().slice(0, 8);
  const createdUserIds: string[] = [];
  const createdPlanIds: string[] = [];
  const trackedTokenHashes = new Set<string>();
  const trackedEventIds = new Set<string>();

  async function createUser(label: string) {
    const user = await prisma.user.create({
      data: { email: `billing-${label}-${suffix}@example.com`, name: `Billing ${label}` },
      select: { id: true, email: true },
    });
    createdUserIds.push(user.id);
    return user;
  }

  beforeAll(async () => {
    prisma = new PrismaService(new ConfigService(baseConfig));
    await prisma.$connect();

    billing = new BillingService(prisma, new ConfigService(baseConfig), new MockPurchaseVerifier());
    disabledBilling = new BillingService(
      prisma,
      new ConfigService({ ...baseConfig, BILLING_ENABLED: false }),
      new MockPurchaseVerifier(),
    );

    const createdPlan = await prisma.subscriptionPlan.create({
      data: {
        code: `billing-plan-${suffix}`,
        name: 'Billing Test Plan',
        billingPeriod: BillingPeriod.MONTHLY,
        priceInPaise: 24_900,
        googlePlayProductId: `billing_product_${suffix}`,
        benefits: ['Billing test benefit'],
        order: 9_800,
      },
      select: { id: true, googlePlayProductId: true },
    });
    createdPlanIds.push(createdPlan.id);
    plan = { id: createdPlan.id, googlePlayProductId: createdPlan.googlePlayProductId! };
  });

  afterAll(async () => {
    if (!prisma) {
      return;
    }
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    const derivedEventIds = [...trackedTokenHashes].flatMap((hash) => [
      `verify:${hash}`,
      `restore:${hash}`,
    ]);
    await prisma.billingEvent.deleteMany({
      where: {
        OR: [
          { purchaseTokenHash: { in: [...trackedTokenHashes] } },
          { eventId: { in: [...trackedEventIds, ...derivedEventIds] } },
        ],
      },
    });
    await prisma.subscriptionPlan.deleteMany({ where: { id: { in: createdPlanIds } } });
    await prisma.$disconnect();
  });

  it('lists active plans including Google Play product ids', async () => {
    const plans = await billing.listPlans();
    const match = plans.items.find((item) => item.id === plan.id);
    expect(match).toBeDefined();
    expect(match?.googlePlayProductId).toBe(plan.googlePlayProductId);
    expect(match?.priceInPaise).toBe(24_900);
  });

  it('verifies a purchase, grants premium access and is idempotent', async () => {
    const user = await createUser('active');
    const token = `mock-active-${user.id}`;
    trackedTokenHashes.add(tokenHash(token));

    const result = await billing.verifyPurchase(user.id, {
      productId: plan.googlePlayProductId,
      purchaseToken: token,
    });

    expect(result.restored).toBe(false);
    expect(result.subscription.status).toBe(SubscriptionStatus.ACTIVE);
    expect(result.subscription.plan.id).toBe(plan.id);
    expect(result.entitlement.tier).toBe('PREMIUM');
    expect(result.entitlement.premiumActive).toBe(true);
    expect(await hasPremiumAccess(prisma, user.id)).toBe(true);

    const repeated = await billing.verifyPurchase(user.id, {
      productId: plan.googlePlayProductId,
      purchaseToken: token,
    });
    expect(repeated.subscription.id).toBe(result.subscription.id);

    expect(await prisma.subscription.count({ where: { userId: user.id } })).toBe(1);
    expect(await prisma.purchase.count({ where: { userId: user.id } })).toBe(1);
    expect(await prisma.entitlement.count({ where: { userId: user.id } })).toBe(1);
  });

  it('rejects a token claimed by another learner and a mismatched owner', async () => {
    const owner = await createUser('owner');
    const other = await createUser('other');
    const token = `mock-active-${owner.id}-claim`;
    trackedTokenHashes.add(tokenHash(token));

    await billing.verifyPurchase(owner.id, {
      productId: plan.googlePlayProductId,
      purchaseToken: token,
    });

    const claimed = await expectApiError(
      billing.verifyPurchase(other.id, {
        productId: plan.googlePlayProductId,
        purchaseToken: token,
      }),
    );
    expect(claimed).toMatchObject({ code: 'PURCHASE_ALREADY_CLAIMED', status: 409 });

    const mismatchedToken = `mock-active-${other.id}-mismatch`;
    const mismatch = await expectApiError(
      billing.verifyPurchase(owner.id, {
        productId: plan.googlePlayProductId,
        purchaseToken: mismatchedToken,
      }),
    );
    expect(mismatch).toMatchObject({ code: 'PURCHASE_OWNERSHIP_MISMATCH', status: 409 });
  });

  it('restores purchases and reports another learner’s token as a failure', async () => {
    const user = await createUser('restore');
    const claimedBy = await createUser('restore-claimed');
    const token = `mock-active-${user.id}-restore`;
    const claimedToken = `mock-active-${claimedBy.id}-restore`;
    trackedTokenHashes.add(tokenHash(token));
    trackedTokenHashes.add(tokenHash(claimedToken));

    await billing.verifyPurchase(claimedBy.id, {
      productId: plan.googlePlayProductId,
      purchaseToken: claimedToken,
    });

    const restored = await billing.restorePurchases(user.id, {
      purchases: [
        { productId: plan.googlePlayProductId, purchaseToken: token },
        { productId: plan.googlePlayProductId, purchaseToken: claimedToken },
      ],
    });

    expect(restored.restoredCount).toBe(1);
    expect(restored.failures).toEqual([
      { productId: plan.googlePlayProductId, code: 'PURCHASE_ALREADY_CLAIMED' },
    ]);
    expect(restored.entitlement.premiumActive).toBe(true);
    expect(restored.billingEnabled).toBe(true);

    const state = await billing.getMySubscription(user.id);
    expect(state.subscription?.status).toBe(SubscriptionStatus.ACTIVE);
    expect(state.purchases).toHaveLength(1);
  });

  it('keeps access for a canceled subscription until the paid period ends, then expires it', async () => {
    const user = await createUser('canceled');
    const token = `mock-canceled-${user.id}`;
    trackedTokenHashes.add(tokenHash(token));

    const result = await billing.verifyPurchase(user.id, {
      productId: plan.googlePlayProductId,
      purchaseToken: token,
    });
    expect(result.subscription.status).toBe(SubscriptionStatus.CANCELED);
    expect(result.entitlement.premiumActive).toBe(true);

    await prisma.subscription.updateMany({
      where: { userId: user.id },
      data: {
        currentPeriodEnd: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      },
    });

    const state = await billing.getMySubscription(user.id);
    expect(state.subscription?.status).toBe(SubscriptionStatus.EXPIRED);
    expect(state.entitlement.premiumActive).toBe(false);
    expect(state.entitlement.tier).toBe('FREE');
    expect(await hasPremiumAccess(prisma, user.id)).toBe(false);
  });

  it('does not grant premium access for an expired purchase', async () => {
    const user = await createUser('expired');
    const token = `mock-expired-${user.id}`;
    trackedTokenHashes.add(tokenHash(token));

    const result = await billing.verifyPurchase(user.id, {
      productId: plan.googlePlayProductId,
      purchaseToken: token,
    });

    expect(result.subscription.status).toBe(SubscriptionStatus.EXPIRED);
    expect(result.entitlement.premiumActive).toBe(false);
    expect(await hasPremiumAccess(prisma, user.id)).toBe(false);
  });

  it('replaces an earlier subscription so a learner keeps one entitlement', async () => {
    const user = await createUser('replace');
    const firstToken = `mock-active-${user.id}-first`;
    const secondToken = `mock-active-${user.id}-second`;
    trackedTokenHashes.add(tokenHash(firstToken));
    trackedTokenHashes.add(tokenHash(secondToken));

    const first = await billing.verifyPurchase(user.id, {
      productId: plan.googlePlayProductId,
      purchaseToken: firstToken,
    });
    const second = await billing.verifyPurchase(user.id, {
      productId: plan.googlePlayProductId,
      purchaseToken: secondToken,
    });

    const previous = await prisma.subscription.findUnique({
      where: { id: first.subscription.id },
      select: { status: true },
    });
    expect(previous?.status).toBe(SubscriptionStatus.EXPIRED);
    expect(second.subscription.status).toBe(SubscriptionStatus.ACTIVE);

    const entitlement = await prisma.entitlement.findUnique({
      where: { userId: user.id },
      select: { subscriptionId: true },
    });
    expect(entitlement?.subscriptionId).toBe(second.subscription.id);
  });

  it('attributes an RTDN webhook before first verification and deduplicates deliveries', async () => {
    const user = await createUser('rtdn');
    const token = `mock-active-${user.id}-rtdn`;
    const messageId = `msg-${suffix}-rtdn`;
    trackedTokenHashes.add(tokenHash(token));
    trackedEventIds.add(messageId);

    const envelope = pushEnvelope(messageId, {
      version: '1.0',
      packageName: 'com.smartme.app',
      eventTimeMillis: String(Date.now()),
      subscriptionNotification: {
        version: '1.0',
        notificationType: 4,
        purchaseToken: token,
        subscriptionId: plan.googlePlayProductId,
      },
    });

    const first = await billing.handleGooglePlayNotification(envelope, 'integration-test-secret');
    expect(first).toEqual({ received: true, duplicate: false, processed: true });

    const entitlement = await prisma.entitlement.findUnique({
      where: { userId: user.id },
      select: { tier: true, isActive: true },
    });
    expect(entitlement).toMatchObject({ tier: 'PREMIUM', isActive: true });

    const duplicate = await billing.handleGooglePlayNotification(
      envelope,
      'integration-test-secret',
    );
    expect(duplicate).toEqual({ received: true, duplicate: true, processed: true });

    expect(await prisma.subscription.count({ where: { userId: user.id } })).toBe(1);
    expect(
      await prisma.billingEvent.count({
        where: { provider: BillingProvider.GOOGLE_PLAY, eventId: messageId },
      }),
    ).toBe(1);
  });

  it('revokes entitlement when a voided purchase notification arrives', async () => {
    const user = await createUser('refund');
    const token = `mock-active-${user.id}-refund`;
    const verificationEvent = `verify:${tokenHash(token)}`;
    const messageId = `msg-${suffix}-refund`;
    trackedTokenHashes.add(tokenHash(token));
    trackedEventIds.add(verificationEvent);
    trackedEventIds.add(messageId);

    await billing.verifyPurchase(user.id, {
      productId: plan.googlePlayProductId,
      purchaseToken: token,
    });

    const result = await billing.handleGooglePlayNotification(
      pushEnvelope(messageId, {
        version: '1.0',
        voidedPurchaseNotification: {
          purchaseToken: token,
          orderId: 'GPA.TEST',
          productType: 1,
          refundType: 1,
        },
      }),
      'integration-test-secret',
    );
    expect(result).toEqual({ received: true, duplicate: false, processed: true });

    const purchase = await prisma.purchase.findFirst({
      where: { userId: user.id },
      select: { status: true },
    });
    expect(purchase?.status).toBe(PurchaseStatus.REFUNDED);

    const state = await billing.getMySubscription(user.id);
    expect(state.subscription?.status).toBe(SubscriptionStatus.REFUNDED);
    expect(state.entitlement.premiumActive).toBe(false);
    expect(await hasPremiumAccess(prisma, user.id)).toBe(false);
  });

  it('rejects unauthenticated and malformed notifications', async () => {
    const envelope = pushEnvelope(`msg-${suffix}-auth`, { testNotification: {} });
    trackedEventIds.add(`msg-${suffix}-auth`);

    const unauthorized = await expectApiError(
      billing.handleGooglePlayNotification(envelope, 'wrong-secret'),
    );
    expect(unauthorized).toMatchObject({ code: 'INVALID_WEBHOOK_SECRET', status: 401 });

    const unauthenticated = await expectApiError(
      billing.handleGooglePlayNotification(envelope, undefined),
    );
    expect(unauthenticated).toMatchObject({ code: 'INVALID_WEBHOOK_SECRET', status: 401 });

    const malformedId = `msg-${suffix}-malformed`;
    trackedEventIds.add(malformedId);
    const malformed = await expectApiError(
      billing.handleGooglePlayNotification(
        {
          message: {
            messageId: malformedId,
            data: Buffer.from('not-json').toString('base64'),
          },
        },
        'integration-test-secret',
      ),
    );
    expect(malformed).toMatchObject({ code: 'INVALID_WEBHOOK_PAYLOAD', status: 400 });
  });

  it('accepts test notifications without touching entitlements', async () => {
    const messageId = `msg-${suffix}-test`;
    trackedEventIds.add(messageId);

    const result = await billing.handleGooglePlayNotification(
      pushEnvelope(messageId, { testNotification: { version: '1.0' } }),
      'integration-test-secret',
    );

    expect(result).toEqual({ received: true, duplicate: false, processed: true });
  });

  it('blocks purchase operations while billing is flagged off', async () => {
    const user = await createUser('disabled');

    const disabled = await expectApiError(
      disabledBilling.verifyPurchase(user.id, {
        productId: plan.googlePlayProductId,
        purchaseToken: `mock-active-${user.id}-disabled`,
      }),
    );
    expect(disabled).toMatchObject({ code: 'BILLING_DISABLED', status: 503 });

    const state = await disabledBilling.getMySubscription(user.id);
    expect(state.billingEnabled).toBe(false);
    expect(state.subscription).toBeNull();
    expect(state.entitlement.premiumActive).toBe(false);
  });

  it('rejects unknown products', async () => {
    const user = await createUser('unknown-product');
    const error = await expectApiError(
      billing.verifyPurchase(user.id, {
        productId: 'missing-product',
        purchaseToken: `mock-active-${user.id}-unknown`,
      }),
    );
    expect(error).toMatchObject({ code: 'UNKNOWN_PRODUCT', status: 422 });
  });
});
