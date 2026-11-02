import { BillingEventType, SubscriptionStatus } from '../generated/prisma/enums';
import { mapNotificationType } from './billing.service';
import { MockPurchaseVerifier } from './services/mock-purchase.verifier';
import { mapGoogleSubscriptionV2 } from './services/google-play-purchase.verifier';

const verifier = new MockPurchaseVerifier();

describe('MockPurchaseVerifier', () => {
  it('maps active mock tokens to an active subscription', async () => {
    const verified = await verifier.verifyPurchase({
      productId: 'smartme_premium_monthly',
      purchaseToken: 'mock-active-user-123',
    });

    expect(verified.productId).toBe('smartme_premium_monthly');
    expect(verified.status).toBe(SubscriptionStatus.ACTIVE);
    expect(verified.autoRenewing).toBe(true);
    expect(verified.obfuscatedAccountId).toBe('user');
    expect(verified.currentPeriodEnd?.getTime()).toBeGreaterThan(Date.now());
    expect(JSON.stringify(verified.rawPayload)).not.toContain('mock-active-user-123');
  });

  it('maps canceled, expired and refunded tokens to the right state', async () => {
    const canceled = await verifier.verifyPurchase({
      productId: 'p',
      purchaseToken: 'mock-canceled-user',
    });
    expect(canceled.status).toBe(SubscriptionStatus.CANCELED);
    expect(canceled.cancelAtPeriodEnd).toBe(true);
    expect(canceled.autoRenewing).toBe(false);

    const expired = await verifier.verifyPurchase({
      productId: 'p',
      purchaseToken: 'mock-expired-user',
    });
    expect(expired.status).toBe(SubscriptionStatus.EXPIRED);
    expect(expired.currentPeriodEnd?.getTime()).toBeLessThan(Date.now());

    const refunded = await verifier.verifyPurchase({
      productId: 'p',
      purchaseToken: 'mock-refunded-user',
    });
    expect(refunded.status).toBe(SubscriptionStatus.REFUNDED);
  });

  it('rejects tokens that do not follow the mock format', async () => {
    await expect(
      verifier.verifyPurchase({ productId: 'p', purchaseToken: 'not-a-mock-token' }),
    ).rejects.toMatchObject({ status: 422 });
  });
});

describe('mapGoogleSubscriptionV2', () => {
  it('normalises an active Google Play subscription', () => {
    const expiry = new Date(Date.now() + 86_400_000).toISOString();
    const verified = mapGoogleSubscriptionV2(
      {
        subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE',
        startTime: '2026-10-01T00:00:00.000Z',
        latestOrderId: 'GPA.1234',
        acknowledgementState: 'ACKNOWLEDGED',
        externalAccountIdentifiers: { obfuscatedExternalAccountId: 'user-123' },
        lineItems: [
          {
            productId: 'smartme_premium_annual',
            expiryTime: expiry,
            autoRenewingPlan: { autoRenewEnabled: true },
          },
        ],
      },
      'smartme_premium_monthly',
    );

    expect(verified.productId).toBe('smartme_premium_annual');
    expect(verified.status).toBe(SubscriptionStatus.ACTIVE);
    expect(verified.orderId).toBe('GPA.1234');
    expect(verified.currentPeriodEnd?.toISOString()).toBe(expiry);
    expect(verified.obfuscatedAccountId).toBe('user-123');
    expect(verified.autoRenewing).toBe(true);
  });

  it('maps canceled and unknown states safely', () => {
    const canceled = mapGoogleSubscriptionV2(
      {
        subscriptionState: 'SUBSCRIPTION_STATE_CANCELED',
        canceledStateContext: { userInitiatedCancellation: {} },
        lineItems: [{ productId: 'p', expiryTime: '2026-11-10T00:00:00.000Z' }],
      },
      'p',
    );
    expect(canceled.status).toBe(SubscriptionStatus.CANCELED);
    expect(canceled.cancelAtPeriodEnd).toBe(true);

    const pending = mapGoogleSubscriptionV2({ lineItems: [{ productId: 'p' }] }, 'p');
    expect(pending.status).toBe(SubscriptionStatus.PENDING);
  });

  it('rejects a store response without any line item product', () => {
    expect(() => mapGoogleSubscriptionV2({}, 'p')).toThrow(
      'The store response did not include a subscription product.',
    );
  });
});

describe('mapNotificationType', () => {
  it('maps RTDN notification types to local billing events', () => {
    expect(
      mapNotificationType({ subscriptionNotification: { notificationType: 4 } } as never),
    ).toBe(BillingEventType.PURCHASE);
    expect(
      mapNotificationType({ subscriptionNotification: { notificationType: 3 } } as never),
    ).toBe(BillingEventType.CANCEL);
    expect(
      mapNotificationType({ subscriptionNotification: { notificationType: 6 } } as never),
    ).toBe(BillingEventType.GRACE_PERIOD);
    expect(
      mapNotificationType({ subscriptionNotification: { notificationType: 13 } } as never),
    ).toBe(BillingEventType.EXPIRY);
    expect(
      mapNotificationType({ voidedPurchaseNotification: { purchaseToken: 't' } } as never),
    ).toBe(BillingEventType.REFUND);
    expect(mapNotificationType({ testNotification: {} } as never)).toBe(BillingEventType.TEST);
  });
});
