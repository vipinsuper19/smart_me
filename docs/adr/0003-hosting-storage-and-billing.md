# ADR 0003 — Hosting, Media Storage and Billing

- **Status:** Proposed
- **Date:** 2026-10-21

## Context

The PRD leaves the hosting provider, object storage vendor and monetization rollout timing open, while requiring HTTPS, backups, error monitoring, object storage for media, and server-verified Google Play purchases.

## Hosting

**Recommendation:** a managed PaaS that supports Docker and managed PostgreSQL, chosen on cost, India-region latency and operational simplicity. Candidates:

| Option | Note |
|---|---|
| Railway / Render | Fastest to start; managed Postgres add-on |
| Fly.io | Good latency control; more ops effort |
| AWS (ECS/RDS/S3) | Most control; highest ops overhead for MVP |

**Decision deferred** until deployment task; local development uses Docker Compose only. Environment-specific config must come from env vars — no provider-specific code in the app.

## Media storage

- Use an **S3-compatible object store**: Cloudflare R2 (no egress fees) or AWS S3.
- API returns signed/public URLs; the database stores keys and metadata only.
- Uploads go through the backend (admin-authenticated) for MVP; direct-to-storage presigned uploads can come later.
- Media limits: images optimized; audio compressed; never bundle large media in the APK.

## Billing

- **Google Play Billing** for Play-distributed subscriptions, as required by Play policy.
- **Server-side verification** of purchase tokens via the Google Play Developer API. A client callback alone never grants entitlement.
- **Real-time developer notifications (RTDN)** via Pub/Sub endpoint to process renewals, cancellations, refunds and expirations.
- All entitlement updates are **idempotent**, keyed by purchase token + event ID.
- Purchase UI is gated by `BILLING_ENABLED`; the entitlement model ships before monetization is switched on so the pilot can run free if needed.

## Consequences

- Play Console account, service-account credentials and a public HTTPS endpoint are prerequisites for end-to-end billing tests.
- Local testing will use a mock billing provider behind the same interface.
- Storage vendor choice must be finalized before Task 5 (audio/media) content seeding.
