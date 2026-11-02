# Admin API

Server-side administration API for the SmartMe web panel. All routes are
namespaced under `/api/v1/admin` and require an **admin** access token — learner
tokens are rejected even though both realms share the JWT signing secret.

- **Base path:** `/api/v1/admin`
- **Content type:** `application/json`
- **Auth header:** `Authorization: Bearer <admin access token>`
- **Error envelope:** [ADR 0004](adr/0004-api-and-error-conventions.md)

---

## 1. Authentication and RBAC

Admins authenticate against `AdminUser` / `AdminSession`, not `User` /
`Session`. Admin access tokens carry `typ: "admin_access"`; the learner guard
only accepts `typ: "access"`, and the admin guard only accepts `admin_access`.

### Auth endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/admin/auth/login` | Email/password sign-in; returns admin profile and token pair |
| `POST` | `/admin/auth/refresh` | Rotates the opaque refresh token and issues a new token pair |
| `POST` | `/admin/auth/logout` | Revokes the supplied refresh session (`204`) |
| `GET` | `/admin/auth/me` | Returns the current administrator |

`POST /admin/auth/login`

```json
{ "email": "admin@smartme.local", "password": "Admin@12345" }
```

Response:

```json
{
  "admin": {
    "id": "cuid",
    "email": "admin@smartme.local",
    "name": "SmartMe Admin",
    "role": "SUPER_ADMIN",
    "lastLoginAt": "2026-10-21T12:00:00.000Z"
  },
  "tokens": {
    "accessToken": "jwt",
    "refreshToken": "rt_...",
    "accessTokenExpiresAt": "2026-10-21T12:15:00.000Z",
    "refreshTokenExpiresAt": "2026-11-20T12:00:00.000Z",
    "tokenType": "Bearer"
  }
}
```

Refresh tokens are opaque, stored hashed, rotated on every refresh, and grouped
into a session family. Reuse of an old token revokes the family. Admin login is
audited as `ADMIN_LOGIN`.

### Roles

| Role | Access |
|---|---|
| `SUPER_ADMIN` | Full access, including unpublish, archive, hard delete and all read-only business screens |
| `CONTENT_EDITOR` | Read content/media/audit/dashboard; create/update catalog content, blocks, translations, quizzes, questions, options and media metadata; submit review; publish content and quizzes; create quiz versions. Cannot unpublish, archive or hard-delete catalog content/quizzes. |
| `ANALYST` | Read-only: dashboard, content, media, audit, users, subscriptions, plans and analytics. No writes. |

`SUPER_ADMIN` implicitly satisfies every role requirement. RBAC is enforced by
`AdminAuthGuard` + `AdminRolesGuard` on the server; hiding a button in the panel
is not an authorisation control. Every mutating operation writes an audit row.

Seeded development credentials are listed in the root `README.md`.

---

## 2. Content management

### Hierarchy

```
LearningPath → Course → CourseModule → Lesson → LessonContentBlock[]
                                      └→ Quiz → Question → QuestionOption[]
```

List endpoints accept `page` (default `1`) and `pageSize` (default `20`, max
`100`). Content lists additionally accept `status`, `search`, and a parent id
where relevant.

| Entity | List | Create | Read | Update | Delete |
|---|---|---|---|---|---|
| Learning path | `GET /learning-paths` | `POST /learning-paths` | `GET /learning-paths/:id` | `PATCH /learning-paths/:id` | `DELETE /learning-paths/:id` |
| Course | `GET /courses` | `POST /courses` | `GET /courses/:id` | `PATCH /courses/:id` | `DELETE /courses/:id` |
| Module | `GET /modules` | `POST /modules` | `GET /modules/:id` | `PATCH /modules/:id` | `DELETE /modules/:id` |
| Lesson | `GET /lessons` | `POST /lessons` | `GET /lessons/:id` | `PATCH /lessons/:id` | `DELETE /lessons/:id` |
| Content block | `GET /lessons/:id/blocks` | `POST /lessons/:id/blocks` | via lesson | `PATCH /blocks/:id` | `DELETE /blocks/:id` |
| Translation | via lesson | `POST /lessons/:id/translations/:language` | via lesson | same upsert | `DELETE /lessons/:id/translations/:language` |
| Quiz | `GET /quizzes` | `POST /quizzes` | `GET /quizzes/:id` | `PATCH /quizzes/:id` | `DELETE /quizzes/:id` |
| Question | via quiz | `POST /quizzes/:id/questions` | via quiz | `PATCH /questions/:id` | `DELETE /questions/:id` |
| Option | via question | `POST /questions/:id/options` | via question | `PATCH /options/:id` | `DELETE /options/:id` |

Filter examples:

- `GET /admin/learning-paths?status=PUBLISHED&search=english`
- `GET /admin/courses?learningPathId=...&status=DRAFT`
- `GET /admin/modules?courseId=...`
- `GET /admin/lessons?moduleId=...&status=IN_REVIEW`

`GET /admin/lessons/:id` returns the editor payload (blocks with media,
translations and quiz summaries). `GET /admin/lessons/:id/preview` returns the
same content plus every quiz version, question and option, including correct
answers — it is admin-only.

### Reordering

Reorder endpoints require **every child in the parent exactly once**. A partial
or cross-parent list returns `422 REORDER_SET_MISMATCH`.

| Scope | Endpoint | Body |
|---|---|---|
| Paths | `POST /admin/learning-paths/reorder` | `{ "ids": [...] }` |
| Courses in a path | `POST /admin/courses/reorder` | `{ "learningPathId": "...", "ids": [...] }` |
| Modules in a course | `POST /admin/modules/reorder` | `{ "courseId": "...", "ids": [...] }` |
| Lessons in a module | `POST /admin/lessons/reorder` | `{ "moduleId": "...", "ids": [...] }` |
| Blocks in a lesson | `POST /admin/lessons/:id/blocks/reorder` | `{ "ids": [...] }` |
| Questions in a quiz | `POST /admin/quizzes/:id/questions/reorder` | `{ "ids": [...] }` |
| Options in a question | `POST /admin/questions/:id/options/reorder` | `{ "ids": [...] }` |

Order is zero-based. Question and option reorders use a two-phase update so the
`(quizId, order)` / `(questionId, order)` unique constraints are never violated
mid-transaction.

### Publication workflow

`DRAFT → IN_REVIEW → PUBLISHED → ARCHIVED`

Status actions:

| Action | Path suffix | Allowed roles |
|---|---|---|
| Submit review | `POST /learning-paths/:id/submit-review` (also courses, lessons, quizzes) | `SUPER_ADMIN`, `CONTENT_EDITOR` |
| Publish | `POST /learning-paths/:id/publish` (also courses, lessons, quizzes) | `SUPER_ADMIN`, `CONTENT_EDITOR` |
| Unpublish | `POST /learning-paths/:id/unpublish` (also courses, lessons, quizzes) | `SUPER_ADMIN` |
| Archive | `POST /learning-paths/:id/archive` (also courses, lessons, quizzes) | `SUPER_ADMIN` |

Modules have no independent status; visibility follows their course.

Publishing rules:

- A lesson needs at least one content block.
- If `Lesson.requiresQuiz` is `true`, a published quiz must exist for the lesson.
- A quiz needs at least one question; every question needs at least two options,
  exactly one correct option, and at least one point.
- `TRUE_FALSE` questions must have exactly two options.
- Only one quiz version per lesson may be `PUBLISHED`.
- Archiving hides content from learners while preserving progress, attempts and
  audit history.
- A lesson that has been published before increments `Lesson.version` on
  re-publish.

Deleting content is a `SUPER_ADMIN` action. Published content must be archived
first, and content with learner progress or quiz attempts cannot be hard-deleted
(`409 CONTENT_IN_USE`).

### Block payloads

Block `type` selects the renderer; `payload` is JSON validated by the API:

| Type | Required payload |
|---|---|
| `HEADING`, `PARAGRAPH` | `{ "text": string }` |
| `BULLET_LIST`, `RECAP` | `{ "items": string[] }` |
| `CALLOUT` | `{ "title": string, "text": string, "language"?: "ENGLISH" \| "HINDI" \| "HINGLISH" }` |
| `IMAGE`, `AUDIO`, `VIDEO` | `mediaAssetId` or `{ "url": string }` |
| `EXAMPLE_CONVERSATION` | `{ "lines": [{ "speaker": string, "text": string }] }` |
| `MULTIPLE_CHOICE`, `TRUE_FALSE` | Inline knowledge-check object |
| `COMPLETION` | `{ "message"?: string }` |

When `mediaAssetId` is supplied, the media asset must exist and its type must
match the block type. `mediaAssetId` is preferred over an external `url`.

---

## 3. Quiz versioning

A lesson can own multiple quiz versions. `Quiz.version` starts at `1`; creating
another quiz for the same lesson assigns the next version automatically. The
learner API always selects the highest **published** version.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/admin/quizzes` | Create the next draft version for a lesson |
| `POST` | `/admin/quizzes/:id/versions` | Clone a quiz and its questions/options into the next draft version |
| `POST` | `/admin/quizzes/:id/publish` | Publish this version (only one per lesson) |
| `POST` | `/admin/quizzes/:id/archive` | Archive this version |

`POST /admin/quizzes` body:

```json
{
  "lessonId": "cuid",
  "title": "Everyday English quiz",
  "passingScore": 60,
  "xpReward": 5,
  "timeLimitSeconds": null
}
```

`slug` is optional and generated from the lesson slug and version when omitted.

Structural edits (questions, options, their order or correctness) are blocked
when:

- the quiz is `PUBLISHED` → `409 INVALID_STATUS_TRANSITION`, or
- any learner attempt exists → `409 QUIZ_HAS_ATTEMPTS`.

Create a new version instead. Metadata (`title`, `description`, `passingScore`,
`xpReward`, `timeLimitSeconds`) remains editable.

---

## 4. Media

Media endpoints manage **metadata only**. Binary upload is deferred until the
object-storage decision; `url` can point at a CDN or other external storage.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/admin/media?type=&search=` | Paginated media list |
| `POST` | `/admin/media` | Register media metadata |
| `GET` | `/admin/media/:id` | Media detail with referencing blocks |
| `PATCH` | `/admin/media/:id` | Update metadata |
| `DELETE` | `/admin/media/:id` | Delete unused media (`409 MEDIA_IN_USE` if referenced) |

`key` is unique. `type` is `IMAGE`, `AUDIO` or `VIDEO`; `mimeType`, `sizeBytes`,
dimensions, duration, alt text and checksum are stored for the panel and future
delivery pipeline.

---

## 5. Audit logs

Every admin write records an append-only `AuditLog` row in the same transaction
as the change, including the actor, action, entity, before/after snapshot,
IP address and user agent. Admin login is also audited.

`GET /admin/audit-logs`

| Query | Meaning |
|---|---|
| `page`, `pageSize` | Pagination |
| `entityType` | e.g. `LESSON`, `QUIZ`, `MEDIA_ASSET` |
| `entityId` | Exact entity id |
| `action` | e.g. `LESSON_PUBLISHED`, `QUIZ_VERSION_CREATED` |
| `adminUserId` | Filter by administrator |
| `from`, `to` | ISO-8601 timestamps |

There is no update or delete endpoint for audit logs. All authenticated admin
roles can read the log; only server-side code writes it.

---

## 6. Dashboard and read-only business screens

| Method | Path | Roles | Purpose |
|---|---|---|---|
| `GET` | `/admin/dashboard` | all admins | Counts, review queue, recent users/audit |
| `GET` | `/admin/users?search=&status=` | `SUPER_ADMIN`, `ANALYST` | Paginated learner list |
| `GET` | `/admin/users/:id` | `SUPER_ADMIN`, `ANALYST` | Profile, preferences, stats, entitlement, subscriptions, recent learning |
| `GET` | `/admin/subscriptions?status=&planId=&search=` | `SUPER_ADMIN`, `ANALYST` | Subscription overview |
| `GET` | `/admin/subscriptions/:id` | `SUPER_ADMIN`, `ANALYST` | Subscription, plan, entitlement, purchases and billing events |
| `GET` | `/admin/subscription-plans` | `SUPER_ADMIN`, `ANALYST` | Read-only plan list |
| `GET` | `/admin/analytics/overview?days=30` | `SUPER_ADMIN`, `ANALYST` | Daily activity series, totals, top lessons |

User responses never include password hashes or session tokens.

Dashboard response includes:

- user totals, new users and active users in the last 7 days;
- content counts by publication status and lessons awaiting review;
- completed lessons, submitted quiz attempts, average quiz score and total XP;
- active subscriptions and premium entitlements;
- recent audit rows, recent users and the review queue.

Analytics accepts `days` from `1` to `365` (default `30`) and returns one row per
day, including zero-activity days, plus totals and the top five lessons by
completions.

---

## 7. Error codes

All errors use the standard envelope:

```json
{
  "error": {
    "code": "QUIZ_HAS_ATTEMPTS",
    "message": "This quiz has learner attempts. Create a new quiz version before changing questions or options."
  }
}
```

| Status | Code | Meaning |
|---|---|---|
| `400` | `VALIDATION_ERROR` | Invalid DTO or empty update body |
| `401` | `UNAUTHENTICATED` | Missing admin bearer token |
| `401` | `INVALID_ACCESS_TOKEN` | Expired, revoked or non-admin token |
| `401` | `INVALID_CREDENTIALS` | Wrong admin email/password |
| `401` | `INVALID_REFRESH_TOKEN` | Expired, revoked or reused refresh token |
| `403` | `ADMIN_ACCOUNT_UNAVAILABLE` | Admin account disabled or deleted |
| `403` | `FORBIDDEN` | Role does not permit the action |
| `404` | `LEARNING_PATH_NOT_FOUND`, `COURSE_NOT_FOUND`, `MODULE_NOT_FOUND`, `LESSON_NOT_FOUND`, `CONTENT_BLOCK_NOT_FOUND`, `QUIZ_NOT_FOUND`, `QUESTION_NOT_FOUND`, `QUESTION_OPTION_NOT_FOUND`, `MEDIA_NOT_FOUND`, `USER_NOT_FOUND`, `SUBSCRIPTION_NOT_FOUND` | Entity missing |
| `409` | `SLUG_ALREADY_EXISTS`, `MEDIA_KEY_ALREADY_EXISTS` | Duplicate unique key |
| `409` | `INVALID_STATUS_TRANSITION` | Action is not valid for the current status |
| `409` | `CONTENT_IN_USE` | Content has learner history; archive instead |
| `409` | `MEDIA_IN_USE` | Media asset is referenced by a block |
| `409` | `QUIZ_HAS_ATTEMPTS` | Quiz has attempts; create a new version |
| `409` | `QUIZ_ALREADY_PUBLISHED` | Another version of the lesson quiz is published |
| `422` | `PUBLICATION_BLOCKED` | Content is not ready to publish |
| `422` | `REORDER_SET_MISMATCH` | Reorder list is not the full child set |

---

## 8. Deferred admin work

- **Binary media upload** — metadata and URL association only until object
  storage is selected.
- **Admin XP adjustments** — `XPReason.ADMIN_ADJUSTMENT` exists in the schema,
  but no admin route is exposed in Task 8.
- **Configurable permissions** — the fixed `AdminRole` enum is sufficient for
  the pilot; a permission table can be added later.
- **Learning-path/course translations** — lesson translations cover the MVP.
