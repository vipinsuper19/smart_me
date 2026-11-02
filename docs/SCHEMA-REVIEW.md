# Schema Review — Task 2

- **Date:** 2026-10-21
- **Schema:** `backend/prisma/schema.prisma`
- **Prisma:** 7.10.1 (latest stable; npm's `latest` dist-tag currently points at an 8.0 release candidate)
- **Migrations:** `20261021082933_init`, `20261021101500_schema_review_hardening`, `20261021120000_admin_quiz_versioning`

The review covered identity, content, activity, monetization, administration, idempotency, indexes and deletion behaviour. Findings that could cause data loss, security exposure or billing errors were fixed in the hardening migration.

---

## 1. Fixed in this review

| Area | Finding | Resolution |
|---|---|---|
| Identity | PostgreSQL unique indexes are case-sensitive, so `User@x.com` and `user@x.com` could both register | Emails are normalised to lowercase at the API boundary; DB check constraints on `users` and `admin_users` enforce `email = lower(email)` |
| Identity | No record of terms/privacy acceptance | Added `termsAcceptedAt`, `privacyAcceptedAt`, `termsVersion` |
| Identity | Password changes could not invalidate older tokens | Added `User.passwordChangedAt` |
| Sessions | Revocation was recorded but not why | Added `SessionRevocationReason` and `revokedReason` on learner and admin sessions |
| Admin sessions | No rotation-family or replacement tracking | Added `familyId`, `replacedBySessionId`, `revokedReason` |
| Content history | Deleting a lesson or quiz cascaded progress and attempts | Lesson/quiz/question FKs used by history are now `RESTRICT`; archive instead of hard-delete |
| Quiz history | A lesson could only ever have one quiz, so fixing a quiz after attempts would rewrite history | Added `Quiz.version`, removed the unique `lessonId`, added `(lessonId, version)` uniqueness; the admin API clones to a new draft and publishes only one version per lesson |
| Seed | Quiz questions were deleted/recreated, which would invalidate answer history | Questions/options are upserted by order; IDs survive reseeding |
| Gamification | Achievements had an `xpReward` but no XP ledger reason | Added `XPReason.ACHIEVEMENT_UNLOCKED` |
| Monetization | Google Play `PAUSED` / `ON_HOLD` states were missing | Added to `SubscriptionStatus` |
| Monetization | Purchase tokens were stored in plaintext | Replaced with `purchaseTokenHash` (lookup/dedupe) and `purchaseTokenEncrypted` (AES-GCM ciphertext) |
| Monetization | No guarantee of one live subscription per learner | Partial unique index on `subscriptions(userId)` for `ACTIVE`, `GRACE_PERIOD`, `PAUSED`, `ON_HOLD` |
| Monetization | Entitlement source was a free string | Added `EntitlementSource` enum |
| Billing | Event uniqueness was global, not per provider | Unique `(provider, eventId)`; added raw `providerEventType` for Google RTDN |
| Billing | No retry bookkeeping for failed webhooks | Added `attempts` and `nextRetryAt` |
| Account lifecycle | Multiple pending deletion requests could be opened | Partial unique index for one `PENDING` request per user |
| Data quality | Progress/score/price ranges were only validated in application code | DB check constraints for progress, quiz score and plan price |
| Seed | Path/course `availableLanguages` were only set on create | Updates now refresh language availability too |

## 2. Deliberate decisions

- **Email handling:** lower-case normalisation plus a check constraint was chosen over `citext` so migrations do not depend on a PostgreSQL extension.
- **History vs. deletion:** content with progress/attempts cannot be hard-deleted. The admin workflow must use `ARCHIVED` status.
- **Partial indexes:** the one-active-subscription and one-pending-deletion indexes are raw SQL because Prisma's schema language cannot express partial indexes. Prisma ignores them during diffs; future migrations must preserve them.
- **Token storage:** raw Google Play tokens are never stored. Encryption key management is implemented with billing in Task 10.
- **Admin permissions:** `AdminRole` is a small fixed enum for MVP; role-to-permission checks live in backend guards. A permission table can be added when custom admin roles are needed.

## 3. Deferred, with an owner

| Item | Why deferred | Task |
|---|---|---|
| Account deletion anonymisation and retention window | Needs legal/product copy | Task 3 |
| Google OAuth client IDs and linking rules | Awaiting Google Cloud configuration | Task 3 |
| LearningPath/Course translations | Lesson-level translations cover MVP; add when non-English titles are needed | Post-MVP |
| Full-text search indexes (`pg_trgm`/GIN) | Search endpoint not built yet | Task 5 |
| Analytics event retention/partitioning | Low initial volume | Task 11 |
| Purchase-token encryption key management | Billing is flag-gated | Task 10 |
| Configurable admin permissions | Static roles are sufficient for the pilot | Post-MVP |

## 4. Prisma 7 upgrade notes

- Pinned `prisma`, `@prisma/client` and `@prisma/adapter-pg` to **7.10.1**. `npm view prisma dist-tags` shows `latest = 8.0.0-rc.24`; that is a release candidate, not a stable release.
- Generator changed to `prisma-client` with an explicit output at `backend/src/generated/prisma`, `moduleFormat = "cjs"` and extensionless imports so NestJS stays CommonJS.
- `PrismaClient` now requires `@prisma/adapter-pg`; `PrismaService` configures a 10-connection pool and a 5-second connection timeout (matching the old engine's fail-fast behaviour).
- CLI configuration moved to `backend/prisma.config.ts`; `.env` is loaded explicitly with `dotenv`.
- `prisma migrate dev` no longer generates the client or runs the seed. Scripts and CI call both explicitly.
- The generated client is a build artifact and is gitignored.
- Seed runs with `tsx`; question/option upserts are idempotent and preserve IDs.

## 5. Verification

- `prisma validate` — valid.
- `prisma migrate deploy` — both migrations applied; `migrate status` reports up to date.
- `prisma migrate diff --from-config-datasource --to-schema` — no difference.
- Seed run twice — same counts, no duplicate questions/options.
- API liveness and DB readiness — `200` / `database: up` through the new driver adapter.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` — pass.
