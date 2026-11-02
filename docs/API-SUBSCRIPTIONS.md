# Subscriptions & billing API

Premium subscriptions, Google Play purchase verification, RTDN webhooks and
server-authoritative entitlements. All learner routes live under `/api/v1`,
require a learner access token and follow [ADR 0004](adr/0004-api-and-error-conventions.md).

```http
Authorization: Bearer <accessToken>
```

The server is the only authority for premium access. A client-side purchase
callback, a cached entitlement or a client-supplied price never grants access.

---

## 1. Feature flag

Billing is disabled by default (`BILLING_ENABLED=false`).

| Behaviour | Billing disabled | Billing enabled |
| --- | --- | --- |
| `GET /subscriptions/plans` | Works | Works |
| `GET /subscriptions/me` | Works, returns the current entitlement | Works |
| `POST /subscriptions/verify-purchase` | `503 BILLING_DISABLED` | Works |
| `POST /subscriptions/restore` | `503 BILLING_DISABLED` | Works |
| `POST /subscriptions/webhooks/google-play` | `503 BILLING_DISABLED` | Works |

The flag is deliberately independent of content access: existing entitlements
keep working and `hasPremiumAccess` is evaluated on every read, so turning
billing off never grants or revokes content by itself.

### Configuration

| Variable | Purpose |
| --- | --- |
| `BILLING_ENABLED` | Master flag for purchase/restore/webhook routes. |
| `BILLING_PROVIDER` | `mock` (development) or `google_play` (store builds). |
| `BILLING_GRACE_PERIOD_DAYS` | Extra access after a paid period ends. Default `3`. |
| `GOOGLE_PLAY_PACKAGE_NAME` | Android application id, e.g. `com.smartme.app`. |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | Stringified service account with Android Publisher access. |
| `GOOGLE_PLAY_RTDN_SECRET` | Shared secret expected on every Pub/Sub push (>= 16 chars). |

With `BILLING_ENABLED=true`, boot validation requires the RTDN secret, and for
`BILLING_PROVIDER=google_play` also the package name and valid service-account
JSON. `BILLING_PROVIDER=mock` is rejected in production.

---

## 2. Routes

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/subscriptions/plans` | Active plan catalogue |
| `GET` | `/api/v1/subscriptions/me` | Entitlement, latest subscription and recent purchases |
| `POST` | `/api/v1/subscriptions/verify-purchase` | Verify one store purchase and grant the entitlement |
| `POST` | `/api/v1/subscriptions/restore` | Re-verify store purchases after a reinstall or device change |
| `POST` | `/api/v1/subscriptions/webhooks/google-play` | Google Play RTDN push endpoint (no learner token) |

All learner routes are scoped to the authenticated user. A purchase token that
belongs to another learner returns `409 PURCHASE_ALREADY_CLAIMED`; it is never
transferred.

---

## 3. `GET /api/v1/subscriptions/plans`

Returns active plans in display order. Plans are managed by the seed and exposed
read-only to learners and to the admin panel.

```json
{
  "items": [
    {
      "id": "clx_plan_monthly",
      "code": "premium-monthly",
      "name": "Premium Monthly",
      "billingPeriod": "MONTHLY",
      "priceInPaise": 24900,
      "currency": "INR",
      "googlePlayProductId": "smartme_premium_monthly",
      "benefits": ["Full course library", "Premium practice sets", "Expanded audio access"],
      "order": 1
    }
  ]
}
```

---

## 4. `GET /api/v1/subscriptions/me`

Returns the server entitlement, the latest subscription (any status) and the
ten most recent purchases. Expiry is reconciled before the response is built.

```json
{
  "entitlement": {
    "tier": "PREMIUM",
    "isActive": true,
    "source": "SUBSCRIPTION",
    "validUntil": "2026-11-28T10:00:00.000Z",
    "premiumActive": true
  },
  "subscription": {
    "id": "clx_sub_1",
    "status": "ACTIVE",
    "provider": "GOOGLE_PLAY",
    "plan": {
      "id": "clx_plan_monthly",
      "code": "premium-monthly",
      "name": "Premium Monthly",
      "billingPeriod": "MONTHLY",
      "priceInPaise": 24900,
      "currency": "INR"
    },
    "autoRenewing": true,
    "cancelAtPeriodEnd": false,
    "startedAt": "2026-10-29T10:00:00.000Z",
    "currentPeriodStart": null,
    "currentPeriodEnd": "2026-11-28T10:00:00.000Z",
    "canceledAt": null,
    "endedAt": null,
    "lastVerifiedAt": "2026-11-01T10:00:00.000Z",
    "createdAt": "2026-11-01T10:00:00.000Z",
    "updatedAt": "2026-11-01T10:00:00.000Z"
  },
  "purchases": [
    {
      "id": "clx_purchase_1",
      "productId": "smartme_premium_monthly",
      "orderId": "GPA.3311-1234-5678-90123",
      "status": "VERIFIED",
      "purchaseTime": "2026-11-01T10:00:00.000Z",
      "priceInPaise": 24900,
      "currency": "INR",
      "verifiedAt": "2026-11-01T10:00:02.000Z"
    }
  ],
  "billingEnabled": true
}
```

When no entitlement exists, `entitlement` is a `FREE`/inactive object and
`subscription` is `null`.

---

## 5. `POST /api/v1/subscriptions/verify-purchase`

```json
{
  "productId": "smartme_premium_monthly",
  "purchaseToken": "google-play-purchase-token"
}
```

Verification flow:

1. Billing must be enabled and the product must map to an active plan's
   `googlePlayProductId`.
2. The token is hashed with SHA-256. Raw purchase tokens are never stored.
3. An already-verified token returns the existing state, so retries and double
   taps never create a second subscription, purchase or entitlement.
4. Google Play `subscriptionsv2` is queried with the service account. The
   store response, not the client, decides the subscription status and period.
5. A pending acknowledgement is sent back to Google Play after the entitlement
   is granted.
6. Subscription, purchase, entitlement and billing event are written in one
   transaction. A previous live subscription for the learner is retired first,
   because the database allows one live subscription per user.

Response (`200 OK`):

```json
{
  "subscription": { "id": "clx_sub_1", "status": "ACTIVE", "...": "..." },
  "entitlement": { "tier": "PREMIUM", "isActive": true, "premiumActive": true, "...": "..." },
  "restored": false
}
```

### Android client responsibilities

- Set `BillingFlowParams.setObfuscatedAccountId(user.id)` so an RTDN webhook
  arriving before the first verification can still be attributed.
- Send the purchase token and product id exactly as returned by Play Billing.
- Never cache entitlement locally as the access decision; call `/subscriptions/me`
  or rely on content responses after a purchase.
- Do not acknowledge the purchase on the client; the API acknowledges it after
  granting access. Repeated acknowledgements are harmless but unnecessary.

---

## 6. `POST /api/v1/subscriptions/restore`

```json
{
  "purchases": [
    { "productId": "smartme_premium_monthly", "purchaseToken": "token-1" }
  ]
}
```

- Accepts 1–10 purchase entries.
- Each entry is re-verified; a successful entry counts towards `restoredCount`.
- A token owned by another learner is reported as a failure and never applied.
- Failures use stable codes such as `PURCHASE_ALREADY_CLAIMED`,
  `PURCHASE_OWNERSHIP_MISMATCH`, `UNKNOWN_PRODUCT` or `INVALID_PURCHASE`.

```json
{
  "entitlement": { "tier": "PREMIUM", "isActive": true, "premiumActive": true, "...": "..." },
  "subscription": { "id": "clx_sub_1", "status": "ACTIVE", "...": "..." },
  "restoredCount": 1,
  "failures": [],
  "billingEnabled": true
}
```

---

## 7. `POST /api/v1/subscriptions/webhooks/google-play`

Google Play Real-time Developer Notifications are delivered through Pub/Sub
push. The push subscription must add the shared secret:

```text
X-SmartMe-RTDN-Secret: <GOOGLE_PLAY_RTDN_SECRET>
```

`?token=<secret>` is also accepted for push subscriptions that cannot set
headers. The comparison is timing-safe. A missing or wrong secret returns
`401 INVALID_WEBHOOK_SECRET`; the body is never processed first.

Envelope (Pub/Sub push):

```json
{
  "message": {
    "messageId": "1234567890",
    "data": "<base64 of the RTDN JSON>",
    "publishTime": "2026-11-01T10:00:00.000Z"
  },
  "subscription": "projects/smartme/subscriptions/rtdn"
}
```

Decoded RTDN payload:

```json
{
  "version": "1.0",
  "packageName": "com.smartme.app",
  "eventTimeMillis": "1761981600000",
  "subscriptionNotification": {
    "version": "1.0",
    "notificationType": 2,
    "purchaseToken": "google-play-purchase-token",
    "subscriptionId": "smartme_premium_monthly"
  }
}
```

Processing rules:

- `(provider, messageId)` is unique, so duplicate deliveries return
  `{ "duplicate": true }` without a second state transition.
- Subscription notifications re-query Google Play and apply the authoritative
  state. The notification type is recorded, not trusted as the source of truth.
- A purchase that is already known is matched by token hash. An unknown purchase
  is attributed through `obfuscatedAccountId`; if that is absent the event is
  stored with `PURCHASE_NOT_LINKED` and returns `200 processed: false`.
- Voided purchases mark the purchase and subscription `REFUNDED` and revoke the
  entitlement when it still points at that subscription.
- Test notifications are acknowledged and stored without state changes.
- Transient processing errors return `503 BILLING_PROCESSING_FAILED` so Pub/Sub
  retries; the failure is recorded on the billing event with `nextRetryAt`.

Response:

```json
{ "received": true, "duplicate": false, "processed": true }
```

---

## 8. Entitlement rules

| Subscription status | Premium access |
| --- | --- |
| `ACTIVE` | Yes, until period end + grace |
| `GRACE_PERIOD` | Yes, until period end + grace |
| `CANCELED` | Yes while inside period end + grace (access continues after cancel) |
| `PAUSED` | No |
| `ON_HOLD` | No |
| `PENDING` | No |
| `EXPIRED` | No |
| `REFUNDED` | No |
| `REVOKED` | No |

`validUntil` is `currentPeriodEnd + BILLING_GRACE_PERIOD_DAYS`. Content and quiz
reads use the same `hasPremiumAccess` check, so a learner cannot bypass the
paywall by calling an endpoint directly.

Because access is derived from `validUntil`, an expired subscription stops
working even if a webhook is delayed. `GET /subscriptions/me` and restore also
reconcile stale subscription rows to `EXPIRED`.

---

## 9. Error codes

| Code | Status | Meaning |
| --- | --- | --- |
| `BILLING_DISABLED` | 503 | The environment has billing switched off |
| `BILLING_NOT_CONFIGURED` | 503 | Enabled without the required store credentials/secret |
| `UNKNOWN_PRODUCT` | 422 | No active plan maps to the product id |
| `INVALID_PURCHASE` | 422 | The store rejected or could not verify the token |
| `PURCHASE_ALREADY_CLAIMED` | 409 | The purchase belongs to another learner |
| `PURCHASE_OWNERSHIP_MISMATCH` | 409 | The purchase was made for a different account |
| `INVALID_WEBHOOK_SECRET` | 401 | Missing or wrong RTDN shared secret |
| `INVALID_WEBHOOK_PAYLOAD` | 400 | Malformed Pub/Sub envelope or RTDN JSON |
| `BILLING_PROCESSING_FAILED` | 503 | Transient webhook failure; the provider should retry |

---

## 10. Local development and tests

`BILLING_PROVIDER=mock` enables a deterministic verifier with no network calls.
A token has the form `mock-<state>-<userId>[-<suffix>]`:

| Token | Result |
| --- | --- |
| `mock-active-<userId>` | Active, renews in 30 days |
| `mock-canceled-<userId>` | Canceled, access for 10 more days |
| `mock-grace-<userId>` | In grace period, ends yesterday |
| `mock-expired-<userId>` | Expired 10 days ago |
| `mock-hold-<userId>` | On hold |
| `mock-refunded-<userId>` | Refunded |

The suffix lets a single learner own more than one token (replacement flows).
The mock is for development and tests only; production boot rejects it.

Backend coverage lives in `backend/src/billing/billing.unit.spec.ts` (state
mapping) and `backend/src/billing/billing.integration.spec.ts` (entitlements,
idempotency, restore, RTDN, refunds, expiry and the disabled flag).

---

## 11. Current limitations

- Plan prices and Play product ids come from the seed; there is no admin plan
  editor yet. The admin panel reads plans and subscription history.
- Expiry is reconciled lazily on learner reads, not by a scheduled worker.
  Access itself is already time-bound by `validUntil`.
- Raw purchase tokens are not stored, so proactive re-verification relies on
  RTDN or a client restore call. Only the SHA-256 hash is persisted.
- Billing events that fail permanently remain queryable for support and manual
  replay. There is no automatic dead-letter queue yet.
