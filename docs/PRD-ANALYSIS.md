# PRD Analysis — SmartMe

**Source document:** `docs/PRD.md` (v1.0, Proposed — MVP definition)
**Analysis date:** 21 October 2026
**Purpose:** Turn the PRD into an implementation-ready scope map, decision log and task roadmap.

---

## 1. Product Summary

SmartMe is an Android-first microlearning and personal-development app for Indian students, job seekers and early-career professionals. Lessons take 5–15 minutes and cover English communication, career/workplace skills and financial literacy. English content is supported by Hindi/Hinglish explanations.

The MVP is **not** a course marketplace or a video platform. It is one complete, polished loop:

> **Discover a lesson → learn a concept → practice → receive feedback → earn progress → return for the next lesson.**

A web-based admin panel is a **P0 MVP component**, because content must be publishable without an Android release.

### Explicitly out of MVP

iOS app, learner-facing web app, live AI voice/chat, video calling, 3D simulations, multiplayer/social feeds, user-generated courses, live tutoring, accredited certification, complex ML recommendations, full offline library.

---

## 2. MVP Scope Map

| # | Module | Priority | Primary dependency | Notes |
|---|---|---|---|---|
| 1 | Authentication & account | P0 | Database, token strategy | Google and/or email; OTP only if justified |
| 2 | Onboarding & preferences | P0 | Auth | 7-step flow; preferences editable later |
| 3 | Home dashboard | P0 | Content, progress, recommendations | Must show real empty/error states |
| 4 | Learning paths & courses | P0 | Content model | Path → Course → Module → Lesson |
| 5 | Lesson player | P0 | Content API, audio | 12 structured block types |
| 6 | Quiz & practice engine | P0 | Content, XP ledger | Server-scored, attempt-owned |
| 7 | Audio learning | P0 | Object storage | Pre-recorded assets only |
| 8 | Progress tracking | P0 | Activity records | Lessons, minutes, weekly activity |
| 9 | Gamification | P0 | Progress | XP, streaks, levels, 6 achievements |
| 10 | Recommendations | P0 | Preferences, completion data | Rules-based only |
| 11 | Search & filtering | **P1** | Content | May launch with category browsing only |
| 12 | Notifications | P0 | Auth, preferences | FCM; 4 notification types |
| 13 | Premium subscription | P0 *for monetized launch* | Entitlement service | Google Play Billing + backend verification |
| 14 | Admin panel & analytics | P0 | Content model, RBAC | 13 admin sub-modules, 13 screens |

### Content target (soft launch goal, not a code blocker)

- 3 learning paths
- 6–10 courses
- 50–100 reviewed lessons
- 10–20 interactive communication scenarios
- Quizzes on appropriate lessons
- Audio for selected high-value lessons

---

## 3. Core User Journey

1. Install app → register or sign in.
2. Select learning goal, proficiency, explanation language, daily goal and interests.
3. Home recommends a relevant lesson.
4. Open course → start lesson.
5. Render structured blocks in order; save progress at checkpoints.
6. Complete lesson → take quiz → see score and explanations.
7. Server awards XP, updates streak, daily goal and achievements.
8. Home and Progress reflect the updates.
9. User can revisit the lesson; admin can publish new content without an app release.
10. Premium access is enforced by the backend, not the UI.

---

## 4. Architecture

### Android (MVP)

- Kotlin, Jetpack Compose, Material 3
- Presentation → domain (where useful) → data, with repositories and ViewModels
- Coroutines + Flow, Retrofit, Room, DataStore
- Secure token storage; Media3 for audio/video
- Explicit avoidance of unnecessary abstraction layers

### Backend

- NestJS + TypeScript, versioned REST under `/api/v1`
- Authentication & authorization, content APIs, quiz evaluation, progress, gamification, entitlements, notification preferences, admin APIs, analytics events
- Server-side validation and consistent error handling

### Database

- PostgreSQL + Prisma
- Five logical entity groups:
  1. **Identity** — User, UserProfile, UserPreference, Session
  2. **Learning Content** — LearningPath, Course, CourseModule, Lesson, LessonContentBlock, LessonTranslation, Quiz, Question, QuestionOption
  3. **Learning Activity** — LessonProgress, QuizAttempt, QuizAnswer, DailyActivity, XPTransaction, UserAchievement, UserAchievementProgress
  4. **Monetization** — Plan/Product, SubscriptionEntitlement, Purchase/Transaction, BillingEvent
  5. **Administration** — AdminRole/Permission, MediaAsset, PublicationMetadata, AuditLog

### Admin

- Web-based; the PRD does not fix a framework. **Recommendation: Next.js + TypeScript** (same language as backend, easy shared API types).

### Media & Infrastructure

- Object storage for covers, illustrations, audio, rendered video, achievement art
- DB stores metadata/references only
- HTTPS, env-based config, backups, error monitoring, analytics, CI/CD

---

## 5. Business Invariants (must be designed in from day one)

1. **Server authority** — XP, quiz scores, streaks, levels and premium access are computed/verified by the backend. Clients may never submit arbitrary values.
2. **Idempotency** — lesson completion, quiz submission, XP awards and billing events must be safe to retry.
3. **XP ledger** — XP is an append-only auditable transaction table; corrections are adjustment entries, never silent rewrites.
4. **Attempt ownership** — every quiz attempt belongs to exactly one user and one quiz; answers belong to the attempt.
5. **Publication visibility** — draft/review/archived content is invisible to ordinary users.
6. **Entitlement enforcement** — premium checks happen in the API, not only in client UI.
7. **Streak rules** — configurable day boundary + time zone (default `Asia/Kolkata`); app opens do not count.
8. **Separate admin identity** — admin authentication and roles are distinct from learner accounts; publish/archive is audited.
9. **Started ≠ completed** — completion follows configured criteria (end of content and any required assessment).
10. **Content quality metadata** — every published lesson has objective, difficulty, duration, language, access tier and version.

---

## 6. Open Decisions

| # | Decision | Recommendation | Blocks |
|---|---|---|---|
| 1 | Product name / package ID / domain | Use **SmartMe** as working name; choose final before store listing | Branding, Play Console |
| 2 | Auth methods | Email + password for MVP; Google Sign-In as a flag-gated addition | Auth schema, onboarding |
| 3 | Admin panel framework | Next.js + TypeScript | Admin tasks |
| 4 | Media storage | S3-compatible object storage (Cloudflare R2 or AWS S3) | Audio, images |
| 5 | API/DB hosting | Managed PaaS with managed Postgres; final vendor by cost/latency | Deployment |
| 6 | Billing at pilot? | Build entitlement model now, gate purchase UI behind `BILLING_ENABLED` | Monetization |
| 7 | Analytics tool | Privacy-conscious product analytics + backend event table | Analytics |
| 8 | Hindi/Hinglish scope | UI localization separate from content translations | Content schema |
| 9 | Account deletion retention | Define retention window and legal copy (DPDP review) | Account module |
| 10 | Notification scheduler | Backend cron + FCM; avoid per-user device scheduling | Notifications |
| 11 | Audio production | Recorded narration for selected lessons; TTS only if quality/licensing pass | Content ops |

---

## 7. Implementation Roadmap

Ordered for a lean solo/small-team build. Steps 5–8 can overlap with 12–13 once API contracts are stable. Step 16 runs continuously from Step 5 onward.

| # | Task | Size | Depends on | Done when |
|---|---|---|---|---|
| 1 | Foundation: repo folders (`android/`, `backend/`, `admin/`), tooling, Postgres, CI, ADRs | S | — | `pnpm dev` starts backend + admin; health endpoint returns OK; CI green |
| 2 | Prisma schema, migration, seed | M | 1 | Migration applies; seed creates admin + sample content; schema covers all 5 entity groups |
| 3 | Auth & account backend | M | 2 | Register/login/refresh/logout/me work; hashed credentials; rate limits; session expiry handled |
| 4 | Profile, preferences & onboarding API | S | 3 | Preferences persist, validate and are editable; onboarding can be skipped |
| 5 | Content read APIs | M | 2, 3 | Published-only hierarchy served in admin order; premium gated; start/progress/complete endpoints |
| 6 | Quiz engine | M | 5 | Attempt lifecycle, server scoring, review, duplicate-safe rewards; empty quiz handled |
| 7 | Gamification & progress | M | 6 | XP ledger, levels, streaks, daily goals, achievements, overview/weekly APIs; timezone tests |
| 8 | Admin backend | L | 2, 5 | RBAC enforced; content CRUD + reorder + publish/archive + media + audit logs |
| 9 | Admin web panel | L | 8 | All 13 admin screens functional against the API |
| 10 | Subscriptions & billing | M | 3 | Plans, Play verification, RTDN webhook, entitlements, restore, expiry; flag-gated |
| 11 | Notifications & analytics | M | 3, 7 | FCM tokens, preferences, scheduled reminders, analytics event collection |
| 12 | Android foundation | M | 1, 5 | Compose theme, 5-tab navigation, network layer, token storage, loading/empty/error states |
| 13 | Android auth + onboarding | M | 12 | Screens 1–8 complete; preferences saved; first lesson recommended |
| 14 | Android core learning | L | 12, 5, 6 | Home, Explore, course/lesson lists, lesson player, audio, quiz, results |
| 15 | Android progress, profile & monetization | L | 13, 7, 10 | Screens 19–27; achievements, preferences, notifications, subscription, deletion, support |
| 16 | QA, content, release | L | all | Negative test matrix, seeded content, CI/CD, monitoring, Play review, PRD §20 checklist |

---

## 8. Risks & Watch Items

| Risk | Impact | Mitigation |
|---|---|---|
| 40 screens in 10–12 weeks | Schedule slip | Freeze scope; deliver admin editing before admin polish; reuse layouts |
| Content production (50–100 lessons) | Launch blocker | Structured lesson template; content pipeline built early; seed with 1 complete path first |
| Play Billing verification complexity | Monetization slip | Build entitlement model early; flag purchases off until Play Console + service account ready |
| "Basic analytics" undefined | Scope creep | Fix event list during Task 1/2; dashboard only shows those metrics |
| Offline/weak network | Poor retention | Cache content responses, optimistic progress with server reconciliation, clear retry states |
| XP/streak manipulation | Trust & integrity | Server-authoritative rules, idempotency keys, ledger, tests |
| DPDP compliance & deletion | Legal blocker | Retention policy + deletion workflow designed in Task 3/4, reviewed before launch |
| Hindi support treated as UI i18n | Content gap | Separate content translation model from app string localization |

---

## 9. Definition of Done (MVP)

The PRD §20 checklist is the release gate. In short:

- End-to-end journey works on a real Android device.
- Admin can publish content without an app release.
- Duplicate completion requests never duplicate rewards.
- Premium access is enforced server-side.
- Account deletion and privacy disclosures work.
- Monitoring, backups and support procedures exist.
- Google Play review requirements are met.
