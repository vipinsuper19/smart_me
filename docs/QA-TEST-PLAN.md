# SmartMe QA Test Plan

**Status:** Release-candidate test plan  
**Scope:** Android app, backend API, admin panel and launch content  
**Owner:** QA/release owner (named per release)  
**Last updated:** 2026-11-04

This plan turns PRD §18 (Testing and Quality Assurance) and §20 (MVP Acceptance
Checklist) into executable checks. It is deliberately practical: every item has
a pre-condition, steps and an observable expected result.

A release candidate is not approved by ticking boxes in this document. The
release owner records the run date, build SHA, device list and evidence links in
the [release runbook](RELEASE-RUNBOOK.md).

---

## 1. Test environments

| Environment | Purpose | Data | Who can access |
|---|---|---|---|
| Local | Fast feedback while developing | Docker PostgreSQL + seed | Engineers |
| CI (`ubuntu-24.04`) | Automated gate on every push/PR | Ephemeral PostgreSQL 17 + seed | Automated |
| Android emulator (API 36, x86_64, Pixel 7) | Instrumented UI flow | Mock/local backend | Automated |
| Staging | Full-stack manual QA and Play internal track | Staging PostgreSQL, non-production accounts | QA, release owner |
| Production | Smoke checks after deploy only | Real accounts | Release owner |

Staging must run the same migrations, seed content and feature flags as
production, except billing and notifications may use test/provider sandbox
values.

### 1.1 Build under test

Record for every run:

- Git commit SHA and workflow run URL.
- Backend version/image digest and admin build.
- Android `versionName` (`SMARTME_VERSION_NAME`) and `versionCode`
  (`SMARTME_VERSION_CODE`).
- API base URL baked into the release build.
- Content verification output (`pnpm --filter @smartme/backend content:verify`).
- Feature flags: `BILLING_ENABLED`, `BILLING_PROVIDER`, `NOTIFICATIONS_ENABLED`,
  `AUTH_GOOGLE_ENABLED`.

### 1.2 Test accounts

Seed accounts are for local/CI only. Staging must use separate accounts.

| Role | Local seed | Use |
|---|---|---|
| Learner | `learner@smartme.local` / `Learner@12345` | Main journey |
| Admin | `admin@smartme.local` / `Admin@12345` | Publishing |
| New learner | Register during the run | Onboarding, deletion |
| Premium learner | Purchase or mock entitlement | Premium gating |

Never run the production seed. `NODE_ENV=production` blocks it unless
`ALLOW_PRODUCTION_SEED=true` is explicitly set.

---

## 2. Automated coverage

Automated checks are the first line of defence. Manual checks focus on what the
automation cannot see: real devices, real store flows and content quality.

| Layer | Command / workflow | Covers |
|---|---|---|
| Backend lint/typecheck | `pnpm lint`, `pnpm typecheck` | Contract and type drift |
| Backend unit tests | `pnpm --filter @smartme/backend test` | Auth, billing, quiz scoring, gamification, time zones, notifications, error envelope, request IDs |
| Backend integration tests | Same command with `DATABASE_URL` | Auth, content, quiz, gamification, admin, profile, billing, analytics, notifications against PostgreSQL |
| Content integrity | `pnpm --filter @smartme/backend content:verify` | Published hierarchy, blocks, quizzes, one correct option, media URLs, launch-library target |
| Admin build | `pnpm --filter @smartme/admin build` | Next.js production build |
| Android unit tests | `./gradlew :app:testDebugUnitTest` | Token storage, error mapping, view-model logic, validation, price formatting |
| Android lint | `./gradlew :app:lintDebug` | Compose/resource/API misuse |
| Android build | `./gradlew :app:assembleDebug` | Packaging |
| Instrumented UI | `.github/workflows/android-instrumented.yml` | Auth and onboarding shell on an API 36 emulator |
| Release build | `.github/workflows/release.yml` | Release APK/AAB, optional signing, artifacts |

Known automated gaps:

- Play Billing cannot complete a real purchase outside the Play Console.
- Google Sign-In needs a real OAuth client and Google account.
- Push delivery needs FCM credentials and a physical device.
- Emulator tests do not replace low/mid/high device testing.

---

## 3. Functional test matrix (PRD §18.1)

Each case is run on at least one physical device and the API 36 emulator.
Priority: **P0** blocks release, **P1** should be fixed before launch, **P2** may
ship with a documented workaround.

| ID | Priority | Scenario | Steps | Expected result | Automation |
|---|---|---|---|---|---|
| F-01 | P0 | Registration | Install fresh, open app, choose Register, enter valid name/email/password, accept terms | Account created, session stored, onboarding shown | Unit + manual |
| F-02 | P0 | Email sign-in | Sign out, sign in with the same credentials | Home loads with the learner's data | Unit + manual |
| F-03 | P0 | Google sign-in | Tap Google, choose an account, grant consent | Account linked or created, onboarding/home shown | Manual |
| F-04 | P0 | Onboarding persistence | Choose goal, level, language, daily target, interests; complete; restart app | Choices persist; Home recommendation reflects the goal | Integration + manual |
| F-05 | P0 | Browse catalogue | Explore → path → course → lesson | Published hierarchy appears in admin order; drafts never appear | Integration + manual |
| F-06 | P0 | Render a lesson | Open a lesson with heading, paragraph, bullets, callout, conversation, recap | All blocks render in order; no clipped or blank content | Manual |
| F-07 | P0 | Audio/video playback | Open a lesson with audio or video; play, pause, seek, background/foreground | Media plays with accessible controls; state survives reasonable rotation/backgrounding | Manual |
| F-08 | P0 | Quiz scoring | Start quiz, answer known correct/incorrect options, submit | Server score matches answers; pass/fail follows the configured threshold | Integration + manual |
| F-09 | P0 | Result and explanation | Submit a quiz | Result shows score, correct/incorrect review, explanations and XP earned | Integration + manual |
| F-10 | P0 | Lesson completion | Complete a quiz-gated lesson | Lesson marked complete once; next lesson unlocks | Integration + manual |
| F-11 | P0 | XP, streak and goal | Complete a lesson on a fresh day | XP increments once; streak and daily goal update on Home and Progress | Integration + manual |
| F-12 | P0 | Return and review | Reopen a completed lesson | Content is readable; completion state is preserved | Integration + manual |
| F-13 | P0 | Subscription purchase | Open Premium, select a plan, complete a Play test purchase | Backend verifies the token; entitlement appears only after verification | Manual |
| F-14 | P0 | Subscription restore | Clear app data, sign in, tap Restore | Active entitlement restored from the store/backend | Manual |
| F-15 | P0 | Account deletion | Privacy → delete account, give optional reason, confirm | Request created, sessions revoked, app signs out; status/cancel flow works before the grace period ends | Integration + manual |
| F-16 | P0 | Admin publishing | As admin, edit a lesson, preview, publish; refresh learner app | Learner sees the change without an Android release | Integration + manual |
| F-17 | P0 | Access control | Call an admin route as a learner; call a learner route with an admin token | 401/403 with the standard error envelope; no data leak | Integration |
| F-18 | P1 | Notification preferences | Change reminder toggles and time; reopen settings | Values persist; quiet hours validate | Integration + manual |
| F-19 | P1 | Search and filters | Search Explore by title/keyword; clear the query | Matching results appear; clearing restores the list | Manual |
| F-20 | P1 | Offline/retry | Enable airplane mode, open Home/lesson, restore network, retry | Clear offline/error state; retry succeeds without duplicate rewards | Manual |

---

## 4. Negative test matrix (PRD §18.2)

These cases must fail safely. A crash, a leaked secret, a duplicate reward or a
false premium entitlement is a release blocker.

| ID | Priority | Negative case | How to trigger | Expected result |
|---|---|---|---|---|
| N-01 | P0 | Expired access token | Wait for access TTL or set an expired token, call a protected route | 401 `UNAUTHENTICATED`; app refreshes once; if refresh fails, signs out cleanly |
| N-02 | P0 | Expired/revoked refresh token | Reuse an old refresh token after rotation | 401; session cleared; no retry loop |
| N-03 | P0 | Invalid registration input | Submit blank name, malformed email, short password, unexpected field | 400 `VALIDATION_ERROR` with field details; no account created |
| N-04 | P0 | Invalid profile/preferences input | Overlong text, future date of birth, bad URL, unknown enum, out-of-range daily goal | 400 with field details; existing values unchanged |
| N-05 | P0 | Duplicate registration | Register the same email twice | 409 `CONFLICT`; no duplicate account or session |
| N-06 | P0 | Duplicate lesson completion | Send `POST /lessons/:id/complete` repeatedly and concurrently | One completion and one XP award; stable success/conflict response |
| N-07 | P0 | Repeated quiz submission | Submit the same attempt repeatedly and concurrently | One final score and one XP award; later calls return the stable result or documented conflict |
| N-08 | P0 | Duplicate purchase verification | Verify the same purchase token twice | One entitlement and one transaction record; no duplicate subscription periods |
| N-09 | P0 | Failed purchase verification | Use an invalid/expired purchase token or a token for another package | 4xx verification error; no entitlement granted; UI shows failure |
| N-10 | P0 | Expired subscription | Move the entitlement end date into the past (staging) | Premium content becomes unavailable after grace; free content still works |
| N-11 | P0 | Premium content without entitlement | Request a premium lesson/quiz as a free learner | 403/premium-required response; no premium body or quiz answers returned |
| N-12 | P0 | Unauthorized admin request | Call admin CRUD with no token, learner token or lower-privilege admin token | 401/403; RBAC enforced server-side; audit entry where applicable |
| N-13 | P0 | Interrupted network | Drop the connection during lesson load, quiz submit and purchase verification | Retry state shown; no duplicate side effects; app recovers |
| N-14 | P1 | Missing lesson media | Point a media block at a 404 URL or remove the asset | Lesson still renders; placeholder/alt text shown; no crash |
| N-15 | P1 | Empty course/module/quiz | Create an empty draft and try to publish; request a quiz with zero questions | Admin validation blocks publication or learner sees a safe empty state |
| N-16 | P1 | Time-zone changes | Change device time zone across a day boundary; complete a lesson | Streak/day boundary follows the documented `APP_TIME_ZONE` rules; no double or lost day |
| N-17 | P1 | Deleted/archived content | Archive a lesson while a learner has it open; refresh | 404/empty-safe response; app returns to the course without a crash |
| N-18 | P1 | Rate limits | Exceed login, preference update or analytics limits | 429 `RATE_LIMITED` with a safe message; no lockout beyond the window |
| N-19 | P1 | Oversized/invalid JSON | Send a large body or malformed JSON | 400/413 with the standard envelope; no stack trace |
| N-20 | P1 | Invalid Google token | Send a malformed/expired Google ID token | 401; no account created |
| N-21 | P2 | Missing request ID | Call an endpoint without `x-request-id` | Server generates one, echoes it in the header and includes it in error bodies/logs |

### 4.1 Idempotency evidence

For N-06, N-07 and N-08, capture before/after evidence:

- XP ledger rows and `UserStats` totals.
- Lesson progress status and completion timestamp.
- Quiz attempt status and awarded XP.
- Subscription/entitlement rows and Play transaction IDs.

Re-run the same request three times and once concurrently. The totals must not
change after the first successful side effect.

---

## 5. Device, display and network matrix (PRD §18.3)

At minimum, cover one device per tier on a physical device. Emulators supplement
but do not replace physical testing.

| Tier | Reference device | Android | Screen | Why |
|---|---|---|---|---|
| Low | 2 GB RAM, 720×1280, 5.5" | 10 (API 29) | 320–360 dp width | Minimum supported OS, memory pressure |
| Mid | 4–6 GB RAM, 1080×2400, 6.1" | 13–14 (API 33–34) | 393–411 dp width | Most of the target audience |
| High | 8 GB+ RAM, 1440×3120, 6.7" | 16+ (API 36) | 411–480 dp width | Newest APIs, large display |
| Emulator | Pixel 7, x86_64 | 36 | 411×891 dp | CI instrumented tests |

For each tier, check:

- **Text scaling:** 0.85, 1.0, 1.3 and 2.0. No clipped buttons or overlapping
  text; long strings wrap instead of truncating key actions.
- **Display size:** small and largest. Bottom navigation remains reachable.
- **Dark mode:** every screen in both themes. Contrast is readable; no hard-coded
  white/black surfaces.
- **Orientation:** portrait is primary. Rotation must not lose entered form data
  or crash media playback.
- **Network:** Wi-Fi, 4G, throttled 3G (400 kbps, high latency), airplane mode
  and flaky reconnect. Loading states appear within 300 ms; retries are explicit.
- **Battery/background:** background the app during audio, a quiz and a purchase;
  return and verify state.
- **Accessibility:** TalkBack reads every control; touch targets are at least
  48 dp; colour is not the only signal for correct/incorrect; captions/alt text
  exist for media.

Record the device model, OS build, screen size, font scale and theme in the run
log.

---

## 6. Content QA checklist

Content is part of the product. Run this before publishing a course.

- [ ] Title, summary and objective are specific and honest.
- [ ] The lesson teaches one useful outcome in 4–8 minutes.
- [ ] Every block renders on a small screen.
- [ ] Indian examples are realistic and non-stereotyped.
- [ ] Hinglish callouts are accurate and optional, not required to understand.
- [ ] Quiz questions have exactly one correct option and a useful explanation.
- [ ] No question relies on a trick or ambiguous wording.
- [ ] Financial lessons include the educational-only disclaimer and no
      personalised investment claims.
- [ ] Media has clear usage rights, alt text and a caption where needed.
- [ ] Premium gating is intentional and visible in the UI.
- [ ] The admin preview matches the learner view.
- [ ] `pnpm --filter @smartme/backend content:verify` passes.

The PRD launch-library target is 3 paths, 6–10 courses, 50–100 lessons,
10–20 interactive scenarios, short quizzes and audio for selected lessons. This
is a content target, not a software release blocker. Measure it with
`content:verify --strict` and record the remaining gap in the release notes.

---

## 7. Release criteria (PRD §18.4)

A release candidate is approved only when all of the following are true:

| Criterion | Evidence | Status owner |
|---|---|---|
| Critical functional tests pass | F-01 to F-17 executed on staging and one physical device | QA |
| No known critical security issue | Security checklist in the release runbook; dependency audit reviewed | Engineering |
| Premium entitlements enforced server-side | N-11, N-09 and F-13 evidence | Backend |
| Duplicate rewards prevented | N-06, N-07, N-08 evidence | Backend |
| Account deletion handled appropriately | F-15 evidence, retention copy reviewed | Backend/legal |
| Privacy and subscription disclosures shown | Screenshots of consent, privacy and Premium screens | Product |
| Monitoring and backups in place | Health checks, alerts and restore drill recorded | Operations |
| Google Play review requirements met | Data safety, content rating, target API, billing declaration | Release owner |
| Accessibility and device matrix checked | Completed device matrix | QA |
| Content verification passes | `content:verify` output attached | Content |

Any P0 defect blocks the release. A P1 defect may ship only with a written
workaround, owner and fix date approved by the release owner.

---

## 8. PRD §20 acceptance checklist

The core journey must work end-to-end on a real Android device before launch.
This table is the go/no-go record.

| # | PRD acceptance item | Verification | Automated signal | Status |
|---|---|---|---|---|
| 1 | New user installs the app | Fresh install from the Play internal track | Release artifact builds | Pending Play internal test |
| 2 | User registers or signs in | F-01, F-02, F-03 | Auth integration tests | Automated partial |
| 3 | User chooses goal and language | F-04 | Profile integration tests | Automated partial |
| 4 | Home recommends a relevant lesson | F-04, F-05 | Content recommendation tests | Automated partial |
| 5 | User opens a course and starts a lesson | F-05 | Content integration tests | Automated partial |
| 6 | Lesson renders structured content | F-06, F-07 | — | Manual |
| 7 | User completes the lesson and takes a quiz | F-08, F-10 | Quiz/gamification integration tests | Automated partial |
| 8 | App displays result and explanation | F-09 | Quiz integration tests | Automated partial |
| 9 | Eligible activity updates progress and XP | F-11 | Gamification integration tests | Automated partial |
| 10 | Home and Progress reflect updated data | F-11 | Gamification integration tests | Automated partial |
| 11 | User can reopen and review the lesson | F-12 | Content integration tests | Automated partial |
| 12 | Admin can publish without an app release | F-16 | Admin integration tests | Automated partial |
| 13 | Premium access is enforced if enabled | F-13, F-14, N-09, N-11 | Billing integration tests | Automated partial |
| 14 | User can manage preferences and request deletion | F-15, F-18 | Profile/account integration tests | Automated partial |
| 15 | Monitoring, backup and support are in place | Release runbook checks | Health endpoints, request IDs | Pending operations sign-off |

Automated partial means the server contract is tested but the device/store
journey still needs a manual pass. Do not mark the MVP accepted until every row
is checked with a date and evidence link.

---

## 9. Defect handling

| Severity | Definition | Example | Release impact |
|---|---|---|---|
| S0 | Data loss, security breach, payment fraud, app unusable | Entitlement bypass, wrong user data | Stop the release immediately |
| S1 | Core journey blocked, no workaround | Cannot sign in, quiz submit fails | Block release |
| S2 | Important feature broken but a workaround exists | Audio control missing, retry loop | Fix or document; release owner decides |
| S3 | Cosmetic or minor | Spacing, copy typo | Can ship; add to backlog |

Every defect record includes: build SHA, device/environment, steps, expected vs
actual, severity, screenshot/video, request ID from the error message and owner.

---

## 10. Test run record

Copy this table into the release ticket for each candidate.

| Field | Value |
|---|---|
| Date | |
| Release owner | |
| Commit SHA | |
| Backend/admin version | |
| Android versionName / versionCode | |
| API base URL | |
| Devices used | |
| Automated workflows | |
| Content verification | |
| P0 defects open | |
| P1 defects open / approved | |
| Decision (go/no-go) | |
| Sign-off | |
