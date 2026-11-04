# SmartMe Release Runbook

**Scope:** Backend API, admin panel, PostgreSQL and the Android release  
**Audience:** Release owner and on-call engineer  
**Last updated:** 2026-11-04

This runbook is provider-neutral. The commands work on any Linux host or
container platform with Node.js 22, PostgreSQL 17 and the Android SDK. Record
the actual host, image digest and run URL in the release ticket.

---

## 1. Release inputs

Collect these before starting:

| Input | Source | Notes |
|---|---|---|
| Commit SHA | `git rev-parse HEAD` | Must match the CI run that passed |
| Release workflow run | GitHub Actions → Release | `.github/workflows/release.yml` |
| Backend bundle | Release artifact `smartme-backend-<version>` | Contains `dist`, `prisma`, `package.json` |
| Admin bundle | Release artifact `smartme-admin-<version>` | Contains `.next`, `package.json`, config |
| Android APK/AAB | Release artifacts | AAB uploads to Play; APK for smoke tests |
| Version name/code | Release workflow inputs | Version code must increase for every Play upload |
| API base URL | Release workflow input | Must include `/api/v1/` and use HTTPS |
| Content verification | `content:verify` step output | Attach to the ticket |
| Test plan result | [QA-TEST-PLAN.md](QA-TEST-PLAN.md) §10 | Go/no-go evidence |

Do not deploy an artifact that was not produced by a green release workflow run
for the recorded SHA.

---

## 2. Environment contract

The API validates every variable at boot with Zod. A missing or malformed value
stops the process instead of failing later.

### 2.1 Runtime and database

| Variable | Production value | Notes |
|---|---|---|
| `NODE_ENV` | `production` | Enables production safeguards |
| `PORT` | `3001` (or platform value) | Must match the proxy/health check |
| `CORS_ORIGIN` | `https://admin.smartme.app` | Comma-separated exact origins; no `*` with credentials |
| `TRUST_PROXY` | `true` behind a managed proxy | Only when the proxy overwrites `X-Forwarded-*` |
| `DATABASE_URL` | Managed PostgreSQL URL | Use TLS (`sslmode=require`) where supported |
| `DATABASE_POOL_MAX` | `10` (tune to DB limit) | Keep total connections below the database cap |
| `APP_TIME_ZONE` | `Asia/Kolkata` | Daily boundaries, streaks and challenges |
| `LOG_HTTP_REQUESTS` | `true` | One access line per request |
| `LOG_SLOW_REQUEST_MS` | `1000` | Slow successful requests become warnings |

### 2.2 Authentication and consent

| Variable | Production value | Notes |
|---|---|---|
| `JWT_ACCESS_SECRET` | Random, ≥ 32 characters | Rotate only with a planned session reset |
| `JWT_REFRESH_SECRET` | Random, ≥ 32 characters | Different from the access secret |
| `JWT_ACCESS_TTL` | `15m` | Short-lived access tokens |
| `JWT_REFRESH_TTL` | `30d` | Aligns with the retention policy |
| `JWT_ISSUER` / `JWT_AUDIENCE` | `smartme-api` | Keep stable |
| `AUTH_GOOGLE_ENABLED` | `true` | Enable after the OAuth client exists |
| `GOOGLE_CLIENT_ID` | Web OAuth client ID | Must match the Android build value |
| `TERMS_VERSION` | Published policy version | Change when the terms change |
| `ACCOUNT_DELETION_GRACE_DAYS` | `30` | Cancellation window before deletion |

### 2.3 Billing and notifications

| Variable | Production value | Notes |
|---|---|---|
| `BILLING_ENABLED` | `true` for store builds | `false` hides Premium honestly |
| `BILLING_PROVIDER` | `google_play` | `mock` is rejected in production |
| `BILLING_GRACE_PERIOD_DAYS` | `3` | Matches the store retry window |
| `GOOGLE_PLAY_PACKAGE_NAME` | `com.smartme.app` | Must match the uploaded app |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | Service-account JSON | Android Publisher access; store as a secret |
| `GOOGLE_PLAY_RTDN_SECRET` | Random, ≥ 16 characters | Shared with the Pub/Sub push subscription |
| `NOTIFICATIONS_ENABLED` | `true` when FCM is ready | Preferences work regardless |
| `NOTIFICATIONS_PROVIDER` | `fcm` | `mock` is rejected in production |
| `NOTIFICATIONS_SCHEDULER_ENABLED` | `true` only on one scheduler instance | Avoid duplicate schedulers |
| `NOTIFICATIONS_INTERVAL_SECONDS` | `300` | Scheduler tick |
| `NOTIFICATIONS_MAX_PER_DAY` | `2` | Per learner, per local day |
| `FCM_PROJECT_ID` | Firebase project ID | Required for FCM |
| `FCM_SERVICE_ACCOUNT_JSON` | Service-account JSON | Store as a secret |

Never commit real secrets. Use the platform's secret manager and inject them at
runtime. `backend/.env.example` is the local template only.

Generate secrets with:

```bash
openssl rand -hex 32   # JWT secrets, RTDN secret
openssl rand -base64 48
```

### 2.4 Admin panel

| Variable | Production value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://api.smartme.app/api/v1` |

`NEXT_PUBLIC_*` values are baked into the admin build. Rebuild the admin bundle
when the API URL changes.

---

## 3. Pre-release checklist

- [ ] CI is green for the commit.
- [ ] Release workflow is green and artifacts are attached.
- [ ] `content:verify` has no errors. Warnings are recorded.
- [ ] QA test plan is complete for this candidate.
- [ ] P0 defects: none. P1 defects have an approved workaround.
- [ ] Backend env values are present in the secret manager.
- [ ] Database backup is recent and a restore has been tested this quarter.
- [ ] Android version code is greater than the last Play upload.
- [ ] Release notes and Play "What's new" copy are ready.
- [ ] Privacy policy and terms URLs are live and match `TERMS_VERSION`.
- [ ] Support inbox (`support@smartme.app`) is monitored.
- [ ] On-call owner is named for the next 48 hours.

---

## 4. Database migration and backup

### 4.1 Before deploying

```bash
# Take a labelled backup (the script validates the archive and prunes old dumps)
DATABASE_URL="$DATABASE_URL" BACKUP_DIR=/var/backups/smartme \
  ./infra/scripts/backup-postgres.sh

# Or run pg_dump directly
pg_dump --format=custom --no-owner \
  --file="smartme-$(date -u +%Y%m%dT%H%M%SZ).dump" \
  "$DATABASE_URL"
```

Store the dump outside the database host and record its location in the release
ticket. For managed PostgreSQL, also confirm the automated snapshot/PITR window.

### 4.2 Apply migrations

Run migrations once, before starting new application instances. Use a checkout of
the release commit so the lockfile and Prisma CLI are available:

```bash
git fetch --all && git checkout <release-sha>
pnpm install --frozen-lockfile
pnpm prisma:generate
pnpm --filter @smartme/backend exec prisma migrate deploy
```

The compiled `dist` already contains the generated Prisma client, so the runtime
bundle does not need the Prisma CLI. The CLI is a dev dependency and is only used
here and in CI.

Rules:

- Never edit an applied migration. Add a new one.
- Migrations must be backward-compatible with the currently running version
  during a rolling deploy (add columns/tables first, backfill, remove later).
- Do not run `prisma migrate reset` or `db:seed` in production.
- Record the migration names applied in the release ticket.

### 4.3 Content

Publish content through the admin panel, not by editing the database. The seed
is for local/CI only. Production content must be reviewed and published by an
admin; this is what lets the team ship lessons without an app release.

---

## 5. Deploy the backend

The release artifact contains `dist`, `prisma` and `package.json`. Install
production dependencies in the runtime image or host, generate the Prisma client
once for the target platform, then start the process.

```bash
# In the unpacked backend bundle
pnpm install --prod
node dist/main.js
```

Operational requirements:

- Run at least two instances behind a load balancer for availability.
- Send `SIGTERM` and allow the Nest shutdown hooks to finish in-flight requests.
- Point the platform health check at `GET /api/v1/health` (liveness).
- Point readiness/rollout checks at `GET /api/v1/health/ready` (database).
- Keep the process read-only except for the database and media upload path.
- Set a request timeout at the proxy (for example 30 seconds) and a body limit.

### 5.1 Smoke checks

```bash
BASE=https://api.smartme.app/api/v1

curl -sS -D - "$BASE/health" -o /tmp/health.json
cat /tmp/health.json

curl -sS "$BASE/health/ready"

# Request IDs are generated when absent and echoed back.
curl -sS -D - "$BASE/health" -H 'x-request-id: smoke-test-0001' -o /dev/null

# A 404 must return the standard envelope and the request ID.
curl -sS "$BASE/does-not-exist" -H 'x-request-id: smoke-test-0002'
```

Expected:

- `/health` returns `status: ok`, service name, version and uptime.
- `/health/ready` returns `status: ready` and `database: up`.
- The `x-request-id` response header matches the sent value.
- Errors use `{ "error": { "code", "message", "requestId" } }` and never leak a
  stack trace or SQL detail.

Then run the learner smoke journey: sign in with a staging account, load Home,
open a lesson, submit a quiz, open Progress and sign out. Do not use a real
customer account for smoke tests.

---

## 6. Deploy the admin panel

```bash
# In the unpacked admin bundle
pnpm install --prod
pnpm start
```

The admin build must have been produced with the production
`NEXT_PUBLIC_API_URL`. After deploy:

1. Open the admin URL over HTTPS.
2. Sign in with an admin account.
3. Confirm the dashboard loads and the content list is visible.
4. Open a lesson preview and confirm the API URL is production, not localhost.
5. Do not publish test content to production.

Restrict admin access at the network layer where possible (VPN or IP allowlist)
in addition to application authentication.

---

## 7. Android release

### 7.1 Versioning

Every Play upload needs a unique, increasing `versionCode`.

```bash
./gradlew :app:bundleRelease \
  -PSMARTME_VERSION_CODE=42 \
  -PSMARTME_VERSION_NAME=1.0.0 \
  -PSMARTME_RELEASE_API_BASE_URL=https://api.smartme.app/api/v1/
```

### 7.2 Signing

Create an upload keystore once and store it in the secret manager. Never commit
it or email it.

```bash
keytool -genkeypair -v \
  -keystore smartme-upload.jks \
  -alias smartme-upload \
  -keyalg RSA -keysize 4096 -validity 10000
```

Configure these GitHub Actions secrets for `.github/workflows/release.yml`:

| Secret | Value |
|---|---|
| `SMARTME_KEYSTORE_BASE64` | `base64 -w0 smartme-upload.jks` |
| `SMARTME_RELEASE_STORE_PASSWORD` | Keystore password |
| `SMARTME_RELEASE_KEY_ALIAS` | `smartme-upload` |
| `SMARTME_RELEASE_KEY_PASSWORD` | Key password |

When the keystore secret is absent, the workflow still builds an unsigned
release APK/AAB. That is useful for dry runs but cannot be uploaded to Play.
Use Play App Signing; the upload key only signs the upload bundle.

Verify the built artifact before upload:

```bash
# Show the signing certificate and version
apksigner verify --print-certs app-release.apk
aapt dump badging app-release.apk | head
```

### 7.3 Play Console submission

1. Upload the AAB to **Internal testing** first.
2. Complete **App content**:
   - Privacy policy URL.
   - Data safety form (account, email, learning activity, purchases, device
     identifiers if FCM is enabled).
   - Content rating questionnaire.
   - Target audience: 18+ (the MVP is not child-directed).
   - Ads: no.
   - Account deletion URL and in-app path.
3. Complete **Payments and subscriptions**:
   - Confirm the subscription products match the backend plan IDs.
   - Add the subscription terms and cancellation/refund copy.
   - Confirm Play Billing is the only purchase path.
4. Add release notes and screenshots that match the current UI.
5. Run the internal-track smoke journey on a physical device.
6. Promote to **Closed testing**, collect feedback, then **Production** with a
   staged rollout (for example 10% → 50% → 100%).
7. Keep the previous AAB available for rollback.

Play review requirements to re-check on every release:

- Target API level accepted by Play.
- Data safety answers match the app and backend.
- Subscription disclosures are visible before purchase.
- Account deletion is available in-app and via a public URL.
- No misleading financial or earnings claims.
- All media and lesson content has usage rights.

### 7.4 Release build sanity

- [ ] App opens in light and dark mode.
- [ ] API base URL is HTTPS production.
- [ ] Google Sign-In works with the production OAuth client.
- [ ] Premium shows the Play price and opens the Play flow.
- [ ] A test purchase is verified by the backend before entitlement appears.
- [ ] Restore works after clearing app data.
- [ ] Account deletion signs the user out.
- [ ] No debug logging of tokens or personal data.

---

## 8. Monitoring and logging

### 8.1 What the API emits

- **Request ID:** every request gets `x-request-id`. A safe inbound value is
  reused; otherwise the server generates a UUID. The ID is echoed in the response
  header, included in error bodies and written to the access log.
- **Access log:** `METHOD path status=… durationMs=… requestId=…`. Query strings
  are dropped so search terms and tokens are not stored.
- **Error log:** 5xx errors include the method, path, status, error code, request
  ID and stack trace. Client-facing responses never include the stack.
- **Health:** `/health` for liveness, `/health/ready` for database readiness.

Ship stdout/stderr to the platform log store. Do not log request bodies, tokens,
passwords, purchase tokens or full email addresses.

### 8.2 Alerts

Configure these before launch. Thresholds are starting points; tune after the
first two weeks.

| Alert | Condition | Action |
|---|---|---|
| API down | `/health` fails 3 checks in a row | Page on-call; check process and proxy |
| Database down | `/health/ready` fails 2 checks | Page on-call; check DB status and connections |
| 5xx rate | > 2% of requests for 5 minutes | Investigate latest deploy and logs by request ID |
| p95 latency | > 500 ms for 10 minutes (excluding media) | Check slow-request warnings and DB queries |
| Auth failures | Sudden spike in 401/429 | Check credential stuffing, rate limits, clock skew |
| Billing verification | Any sustained 4xx/5xx on verify/RTDN | Check Play credentials and webhook secret |
| Notification failures | Delivery failure rate > 10% | Check FCM credentials and invalid tokens |
| Backup failure | No successful backup in 24 hours | Escalate to operations |

### 8.3 Dashboards

Track at minimum: request rate, 5xx rate, p95 latency, DB connections, auth
success/failure, lesson completions, quiz submissions, purchase verifications,
notification deliveries and active users. Product events already flow through
`POST /api/v1/analytics/events` and appear in the admin analytics overview.

### 8.4 Log retention

Keep application logs for at least 30 days and security/audit logs for the period
required by the privacy policy. Restrict access to the release owner and on-call
engineers. Delete logs containing personal data when the retention period ends.

---

## 9. Backups and restore

| Item | Target |
|---|---|
| Database backup | Daily automated snapshot + PITR if the provider supports it |
| Retention | At least 30 days; align with the privacy policy |
| RPO | ≤ 24 hours (≤ 15 minutes with PITR) |
| RTO | ≤ 4 hours |
| Restore drill | At least once per quarter, into a separate database |
| Media/assets | Versioned object storage with lifecycle rules |
| Secrets | Secret manager with access audit and recovery procedure |

Restore procedure:

```bash
# Preferred: use the guarded script. It requires an explicit confirmation and
# refuses to run without a dump file and target URL.
DATABASE_URL=postgresql://…/smartme_restore \
  RESTORE_CONFIRM=yes \
  DUMP_FILE=./backups/smartme-YYYYMMDDTHHMMSSZ.dump \
  ./infra/scripts/restore-postgres.sh

# Manual equivalent
createdb smartme_restore
pg_restore --no-owner --dbname=smartme_restore smartme-YYYYMMDDTHHMMSSZ.dump

# Point a staging API at the restored database and run readiness + smoke checks
DATABASE_URL=postgresql://…/smartme_restore pnpm --filter @smartme/backend exec prisma migrate status
```

`restore-postgres.sh` uses `--clean --if-exists`, so it overwrites objects in the
target database. Always verify the target URL before confirming. Never restore
over production without an approved incident decision. Record the restore time,
row counts for key tables and smoke-check result.

---

## 10. Rollback and incident response

### 10.1 Backend rollback

1. Stop the rollout and keep the previous instances running if possible.
2. Re-deploy the previous image/artifact (same commit as the last good release).
3. Do **not** reverse a migration that has already written data unless the
   migration is explicitly reversible and the incident owner approves it.
   Prefer a forward fix.
4. Re-run `/health`, `/health/ready` and the smoke journey.
5. If the incident involves data corruption, restore into a separate database
   first and compare before switching traffic.

### 10.2 Admin rollback

Re-deploy the previous admin bundle. The admin panel is stateless; API rollback
is independent. Confirm the production API URL is still correct.

### 10.3 Android rollback

Play does not allow removing a published release. Options:

- **Halt the staged rollout** in Play Console.
- **Ship a hotfix** with a higher version code.
- Use a server-side feature flag to disable the broken flow where possible.
- Keep the previous AAB and release notes ready.

### 10.4 Incident severities

| Severity | Definition | Response |
|---|---|---|
| SEV-1 | Data breach, payment fraud, full outage, wrong-user data | Page immediately; incident channel; notify owner |
| SEV-2 | Core journey broken for many users | Respond within 30 minutes; rollback or hotfix |
| SEV-3 | Degraded feature with workaround | Respond same business day |
| SEV-4 | Cosmetic/minor | Backlog |

For every SEV-1/SEV-2, write a short post-incident note: timeline, impact,
root cause, detection, fix, and the follow-up tasks with owners.

---

## 11. Account deletion operations

- The learner requests deletion in the app or via the public deletion URL.
- The backend records a `PENDING` request, revokes sessions immediately and
  schedules deletion after `ACCOUNT_DELETION_GRACE_DAYS`.
- The learner can cancel before the scheduled date.
- A scheduled job/operator processes due requests. Confirm the deletion job is
  running and alert if the oldest pending request is past its scheduled date.
- Keep only the minimum records required for legal, tax and fraud obligations;
  document them in the privacy policy.
- Support requests must verify identity before disclosing account information.

---

## 12. Post-release checks

Run these after the deploy and again after the staged rollout reaches 100%:

- [ ] `/health` and `/health/ready` are green.
- [ ] Error rate and latency are within the normal range for 30 minutes.
- [ ] Sign-in, lesson, quiz, progress and Premium smoke journeys pass.
- [ ] Admin can load the dashboard and preview content.
- [ ] Request IDs appear in error responses and logs.
- [ ] No unexpected 4xx/5xx spike in billing or notifications.
- [ ] Play vitals show no new crash cluster (check after 24 hours).
- [ ] Backups completed after the release.
- [ ] Release ticket updated with the deployed SHA, image digest and smoke result.

---

## 13. Sign-off

| Role | Name | Date | Decision |
|---|---|---|---|
| Engineering | | | |
| QA | | | |
| Product | | | |
| Operations | | | |
| Release owner | | | |

Store this record with the release ticket. The release is not complete until the
post-release checks and the Play rollout monitoring window are finished.
