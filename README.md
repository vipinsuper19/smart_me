# SmartMe

Indian microlearning and personal-development platform — Android app + web admin panel + NestJS backend.

**Working name:** SmartMe (the PRD leaves the final product name open).
**Source of truth:** [`docs/PRD.md`](docs/PRD.md) · [analysis & roadmap](docs/PRD-ANALYSIS.md) · [ADRs](docs/adr/)

---

## Repository layout

```
smartme/
├─ android/      Kotlin + Jetpack Compose app (scaffolded in Task 12)
├─ backend/      NestJS + TypeScript REST API (/api/v1) + Prisma
├─ admin/        Next.js + TypeScript admin panel
├─ packages/     Shared TypeScript contracts, added when duplication appears
├─ infra/        Docker Compose (PostgreSQL) and deployment config
├─ docs/         PRD, analysis, ADRs, content model, QA plan, release runbook, legal drafts
└─ .github/      CI and release workflows
```

## Prerequisites

| Tool | Version |
|---|---|
| Node.js | 22 LTS or newer |
| pnpm | 11.x (`corepack enable`) |
| Docker Desktop | Running (for PostgreSQL) |
| JDK | 21 (needed from Task 12 onward) |
| Android SDK | API 37 (needed from Task 12 onward) |

## Quick start

```powershell
pnpm install
Copy-Item backend/.env.example backend/.env
Copy-Item admin/.env.example admin/.env.local

# Prisma 7 generates the client into backend/src/generated/prisma.
# `pnpm install` runs this automatically; run it explicitly after schema changes.
pnpm prisma:generate

# Start Docker Desktop first
pnpm db:up
pnpm db:migrate
pnpm db:seed

pnpm dev
```

| Service | URL |
|---|---|
| Backend API | http://localhost:3001/api/v1 |
| Liveness | http://localhost:3001/api/v1/health |
| Readiness (checks DB) | http://localhost:3001/api/v1/health/ready |
| Admin panel | http://localhost:3000 |
| PostgreSQL | `localhost:5433` (`smartme` / `smartme`) |

The database uses host port **5433** so it can run alongside another local PostgreSQL on 5432. Override with `POSTGRES_PORT` if needed, and update `DATABASE_URL` to match.

### Seeded development accounts

| Role | Email | Password |
|---|---|---|
| Admin | `admin@smartme.local` | `Admin@12345` |
| Learner | `learner@smartme.local` | `Learner@12345` |

These are development-only credentials. Change them through `SEED_ADMIN_PASSWORD` / `SEED_LEARNER_PASSWORD` before any shared environment.

## Scripts

| Command | Purpose |
|---|---|
| `pnpm dev` | Run backend and admin together |
| `pnpm dev:backend` | Run NestJS with watch mode |
| `pnpm dev:admin` | Run Next.js on port 3000 |
| `pnpm build` | Build all TypeScript apps |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` | Quality gates |
| `pnpm format` | Prettier write |
| `pnpm db:up` / `db:down` / `db:logs` / `db:reset` | PostgreSQL lifecycle |
| `pnpm db:migrate` | Create/apply a Prisma migration (then regenerate the client) |
| `pnpm db:seed` | Re-run the idempotent development seed |
| `pnpm content:verify` | Check the published content graph and launch-library target |
| `pnpm db:studio` | Open Prisma Studio |
| `pnpm prisma:generate` | Regenerate the Prisma client into `backend/src/generated/prisma` |

Prisma **7.10.1** uses a driver adapter (`@prisma/adapter-pg`), a generated client
outside `node_modules`, and `backend/prisma.config.ts` for the CLI. In v7
`migrate dev` no longer runs `generate` or the seed automatically; the scripts
above handle both explicitly.

## Backend conventions

- All routes are prefixed with `/api/v1`.
- Environment variables are validated by Zod at boot (`backend/src/config/env.ts`) — the API refuses to start with a bad config.
- Request validation uses `class-validator` DTOs with `whitelist` + `forbidNonWhitelisted`.
- API errors follow the envelope in [ADR 0004](docs/adr/0004-api-and-error-conventions.md).
- Every request gets an `x-request-id` (a safe inbound value is reused, otherwise a UUID is generated). The ID is echoed in the response header, included in error bodies and written to the access log. Access logs drop query strings and include method, path, status, duration and request ID.
- Liveness (`/health`) never touches external systems; readiness (`/health/ready`) checks PostgreSQL.
- Learner authentication, sessions, Google Sign-In and account deletion are documented in [docs/API-AUTH.md](docs/API-AUTH.md).
- Learner profile, learning preferences, onboarding options and skip-friendly onboarding completion are documented in [docs/API-PROFILE.md](docs/API-PROFILE.md).
- Published learning paths, courses, lessons, recommendations, premium gating and lesson progress are documented in [docs/API-CONTENT.md](docs/API-CONTENT.md).
- Quiz retrieval, attempt lifecycle, server scoring, review and quiz-gated completion are documented in [docs/API-QUIZ.md](docs/API-QUIZ.md).
- XP, levels, streaks, daily goals, achievements and progress dashboards are documented in [docs/API-PROGRESS.md](docs/API-PROGRESS.md).
- Admin authentication, RBAC, content/quiz/media management, audit logs and overview APIs are documented in [docs/API-ADMIN.md](docs/API-ADMIN.md).
- Admin panel routes, sessions, role-aware UI and workflows are documented in [docs/ADMIN-PANEL.md](docs/ADMIN-PANEL.md).
- Subscription plans, Google Play purchase verification, RTDN webhooks, entitlement rules and the `BILLING_ENABLED`/`BILLING_PROVIDER` flags are documented in [docs/API-SUBSCRIPTIONS.md](docs/API-SUBSCRIPTIONS.md).
- Reminder preferences, FCM device registration, scheduled reminder rules, delivery dedupe, product-event ingestion and the notification flags are documented in [docs/API-NOTIFICATIONS.md](docs/API-NOTIFICATIONS.md).
- PostgreSQL access uses a single global `PrismaService`; schema and migrations live in `backend/prisma/`.
- Prisma 7 runs through the `@prisma/adapter-pg` driver adapter with a bounded connection pool (`DATABASE_POOL_MAX`).
- Structured content, quiz and idempotency rules are documented in [docs/CONTENT-MODEL.md](docs/CONTENT-MODEL.md).
- Schema review decisions and deferred data-model work are recorded in [docs/SCHEMA-REVIEW.md](docs/SCHEMA-REVIEW.md).

## Release and QA

- [QA test plan](docs/QA-TEST-PLAN.md) — automated coverage, functional and
  negative matrices, device/network matrix, content QA, release criteria and the
  PRD §20 acceptance checklist.
- [Release runbook](docs/RELEASE-RUNBOOK.md) — production environment contract,
  migrations and backups, deploy and smoke checks, Play submission, monitoring
  and alerts, rollback and incident response.
- Legal drafts for review: [privacy policy](docs/legal/PRIVACY-POLICY.md),
  [terms of service](docs/legal/TERMS-OF-SERVICE.md) and
  [subscription terms](docs/legal/SUBSCRIPTION-TERMS.md). They contain
  placeholders and are not legal advice.
- `.github/workflows/release.yml` is a manual release build. It runs the quality
  gates, verifies content, packages backend/admin artifacts and builds the
  Android release APK/AAB. Signing is enabled when the
  `SMARTME_KEYSTORE_BASE64`, `SMARTME_RELEASE_STORE_PASSWORD`,
  `SMARTME_RELEASE_KEY_ALIAS` and `SMARTME_RELEASE_KEY_PASSWORD` secrets exist;
  otherwise the artifacts are unsigned.
- Android release builds accept `-PSMARTME_VERSION_CODE`,
  `-PSMARTME_VERSION_NAME` and `-PSMARTME_RELEASE_API_BASE_URL`.
- `pnpm content:verify` fails on broken published content (empty lessons, quizzes
  without questions or a single correct option, hidden published courses). Use
  `pnpm content:verify -- --strict` to also fail when the library is below the
  PRD launch target.

## Status

- [x] **Task 1 — Foundation:** repo layout, pnpm workspace, NestJS API shell, Next.js admin shell, PostgreSQL Compose, CI, ADRs
- [x] **Task 2 — Prisma schema, migration & seed:** all five entity groups, migrations, demo curriculum, readiness endpoint, schema review hardening, Prisma 7.10.1
- [x] **Task 3 - Auth & account backend:** email/password + Google sign-in, rotating refresh sessions, error envelope, throttling, `me`, account-deletion requests, [API contract](docs/API-AUTH.md)
- [x] **Task 4 — Profile, preferences & onboarding API:** editable profile and learning preferences, curated onboarding options, skip-friendly/idempotent onboarding completion, [API contract](docs/API-PROFILE.md)
- [x] **Task 5 - Content read APIs:** published-only path/course/lesson hierarchy in admin order, paginated lists, premium entitlement gating, first-lesson recommendation, start/progress/complete endpoints with idempotent completion, [API contract](docs/API-CONTENT.md)
- [x] **Task 6 — Quiz engine:** published lesson quizzes, resumable attempts, answer changes before submission, server-side weighted scoring, review with explanations, duplicate-safe submission, first-attempt quiz XP, empty-quiz handling and quiz-gated lesson completion, [API contract](docs/API-QUIZ.md)
- [x] **Task 7 — Gamification & progress:** XP ledger, levels, timezone-aware streaks and daily goals, achievements, overview/weekly APIs, idempotent lesson rewards and quiz rewards, [API contract](docs/API-PROGRESS.md)
- [x] **Task 8 — Admin backend:** separate admin sessions and `admin_access` JWTs, server-enforced `SUPER_ADMIN`/`CONTENT_EDITOR`/`ANALYST` RBAC, content CRUD + full-set reorder + review/publish/archive, quiz versioning with attempt-safe editing, media metadata, append-only audit logs, dashboard/users/subscriptions/analytics overview APIs, [API contract](docs/API-ADMIN.md)
- [x] **Task 9 — Admin web panel:** protected Next.js app with admin login/session refresh, role-aware navigation, dashboard, full content and quiz editors with reorder/publish/archive, media library, review queue, learners, subscriptions, analytics and audit log screens, [panel guide](docs/ADMIN-PANEL.md)
- [x] **Task 10 — Subscriptions & billing:** plan catalogue, Google Play `subscriptionsv2` verification with acknowledgement, RTDN webhook with shared-secret auth and `(provider, messageId)` dedupe, server-authoritative entitlements with grace period and lazy expiry reconciliation, restore and refund/void handling, all gated by `BILLING_ENABLED` with a deterministic `mock` provider for development, [API contract](docs/API-SUBSCRIPTIONS.md)
- [x] **Task 11 — Notifications & analytics:** reminder preferences, FCM device registration with masked tokens and a 10-device cap, interval scheduler gated by `NOTIFICATIONS_ENABLED`/`NOTIFICATIONS_SCHEDULER_ENABLED`, daily/streak/incomplete/new-lesson reminders with a per-learner daily cap, idempotent delivery ledger with invalid-token deactivation, JWT-scoped batched product-event ingestion with PII stripping and a 4 KB budget, and product-event totals in the admin analytics overview, [API contract](docs/API-NOTIFICATIONS.md)
- [x] Task 12 — Android foundation: Compose design system, five-tab navigation shell, OkHttp/Retrofit + kotlinx.serialization network layer with typed error mapping, Keystore-encrypted token storage, connectivity banner, shared loading/empty/error states, [app guide](android/README.md)
- [x] Task 13 - Android auth + onboarding: session gate, welcome/sign-in/register screens, Google Sign-In via Credential Manager with consent retry, five-step pre- and post-auth onboarding wizard, single-flight refresh rotation with proactive and 401-token recovery, sign-out, [app guide](android/README.md#what-task-13-delivers)
- [x] Task 14 — Android core learning: Home dashboard (goal, streak, XP, continue, recommendation), Explore catalogue with local search, path/course detail, structured lesson player with block/media renderers, resumable scroll progress, quiz attempts with server scoring and review, quiz-gated auto-completion, [app guide](android/README.md#what-task-14-delivers)
- [x] Task 15 — Android progress, profile & monetization: progress dashboard and achievements, editable profile and learning preferences, notification settings, Google Play subscription purchase/restore with server-verified entitlement, purchase results, static help/support, and privacy/account deletion, [app guide](android/README.md#what-task-15-delivers)
- [x] Task 16 — QA, content & release: functional/negative/device test plan, PRD §20 acceptance record, release runbook and legal drafts, request IDs and structured HTTP logging, content verification with a CI gate, three new seeded courses (7 courses / 32 lessons), configurable/signable Android release builds and a manual release workflow, [QA plan](docs/QA-TEST-PLAN.md) · [runbook](docs/RELEASE-RUNBOOK.md)

## Pending product decisions

See [PRD-ANALYSIS.md §6](docs/PRD-ANALYSIS.md#6-open-decisions) and [ADR 0002](docs/adr/0002-authentication-strategy.md). The most important: final product name, Google OAuth client IDs, hosting/who owns the Play Console, account-deletion retention, and whether billing is enabled for the pilot.
