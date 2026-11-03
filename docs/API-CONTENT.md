# Content Read & Lesson Progress API

Learner-facing content APIs for the published `LearningPath → Course → Module →
Lesson` hierarchy, lesson blocks, premium checks, recommendations and progress.
All routes are under `/api/v1` and follow [ADR 0004](adr/0004-api-and-error-conventions.md).

---

## 1. Authentication and visibility

Every content route requires a learner access token:

```http
Authorization: Bearer <accessToken>
```

The API returns only `PUBLISHED` learning paths, courses and lessons. A course
is visible only when its parent path is published, and a lesson is visible only
when its module's course and the path are published. Unpublished or archived
content is reported as `404` rather than `403` so its existence is not leaked.

Ordering is admin-defined at every level:

1. Learning paths: `order`, then `createdAt`.
2. Courses: parent path `order`, then course `order`.
3. Modules: `order`.
4. Lessons: module `order`, then lesson `order`.

Modules with no published lessons are omitted from course detail responses.
Draft lessons do not affect course or path lesson counts.

---

## 2. Premium access

`locked` is a per-learner read of the `Entitlement` table, not a client-side
check. A learner has premium access when their entitlement has all of:

- `tier = PREMIUM`
- `isActive = true`
- `validUntil` is `null` or in the future

Effective premium status is the course's `accessTier` **or** the lesson's
`accessTier`. A premium course gates all of its lessons; a free course can still
contain individual premium lessons.

Catalog metadata (titles, summaries, durations, premium badges) remains visible
with `locked: true`. Lesson **blocks** are not returned and progress actions are
rejected for locked content:

```json
{
  "error": {
    "code": "PREMIUM_REQUIRED",
    "message": "This lesson requires an active premium subscription."
  }
}
```

This means a learner can see what they would unlock without being able to read
the paid lesson body or manufacture progress. No demo learner has an active
entitlement by default.

---

## 3. Pagination

Flat list endpoints use `page` and `pageSize`:

- `page` defaults to `1`.
- `pageSize` defaults to `20` and is capped at `100`.

Responses have the shape:

```json
{
  "items": [],
  "page": 1,
  "pageSize": 20,
  "total": 0
}
```

Nested modules and lessons inside detail responses are returned in full and in
admin order; they are not paginated separately.

---

## 4. Learning paths

### `GET /api/v1/learning-paths`

Returns paginated published path cards. `hasPremiumContent` is true when any
visible course or lesson in the path is premium. `progress` counts published
lessons only.

```json
{
  "items": [
    {
      "id": "clx_path_1",
      "slug": "english-communication",
      "title": "English Communication",
      "description": "Everyday and workplace English.",
      "coverImageUrl": "https://cdn.example.com/english.jpg",
      "iconUrl": "https://cdn.example.com/english-icon.png",
      "order": 0,
      "availableLanguages": ["ENGLISH", "HINGLISH"],
      "courseCount": 2,
      "lessonCount": 5,
      "hasPremiumContent": true,
      "progress": {
        "totalLessons": 5,
        "startedLessons": 1,
        "completedLessons": 1,
        "percent": 20
      }
    }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 3
}
```

### `GET /api/v1/learning-paths/:id`

Returns one published path plus its visible course cards, ordered by admin
`order`. The summary fields are the same as a path card.

```json
{
  "id": "clx_path_1",
  "slug": "english-communication",
  "title": "English Communication",
  "description": "Everyday and workplace English.",
  "coverImageUrl": "https://cdn.example.com/english.jpg",
  "iconUrl": "https://cdn.example.com/english-icon.png",
  "order": 0,
  "availableLanguages": ["ENGLISH", "HINGLISH"],
  "courseCount": 2,
  "lessonCount": 5,
  "hasPremiumContent": true,
  "progress": {
    "totalLessons": 5,
    "startedLessons": 1,
    "completedLessons": 1,
    "percent": 20
  },
  "courses": [
    {
      "id": "clx_course_1",
      "slug": "everyday-english-foundations",
      "title": "Everyday English Foundations",
      "shortDescription": "Start speaking with confidence.",
      "description": "A full description for the course.",
      "objectives": ["Introduce yourself", "Ask simple questions"],
      "coverImageUrl": "https://cdn.example.com/course.jpg",
      "difficulty": "BEGINNER",
      "estimatedMinutes": 45,
      "accessTier": "FREE",
      "locked": false,
      "order": 0,
      "availableLanguages": ["ENGLISH", "HINGLISH"],
      "moduleCount": 2,
      "lessonCount": 5,
      "hasPremiumLessons": false,
      "progress": {
        "totalLessons": 5,
        "startedLessons": 1,
        "completedLessons": 1,
        "percent": 20
      },
      "learningPath": {
        "id": "clx_path_1",
        "slug": "english-communication",
        "title": "English Communication"
      }
    }
  ]
}
```

---

## 5. Courses

### `GET /api/v1/courses`

Returns paginated published course cards across published paths, ordered by path
order and then course order. Use `learningPathId` to filter one path.

```http
GET /api/v1/courses?page=1&pageSize=20&learningPathId=clx_path_1
```

A course card includes `description`, `objectives`, `moduleCount`,
`lessonCount`, `hasPremiumLessons`, `locked` and the learner's `progress`
summary. `locked` reflects the course's own `accessTier`; individual free
courses may still contain locked premium lessons.

### `GET /api/v1/courses/:id`

Returns the course card plus ordered modules and lesson cards:

```json
{
  "id": "clx_course_1",
  "slug": "everyday-english-foundations",
  "title": "Everyday English Foundations",
  "shortDescription": "Start speaking with confidence.",
  "description": "A full description for the course.",
  "objectives": ["Introduce yourself", "Ask simple questions"],
  "coverImageUrl": "https://cdn.example.com/course.jpg",
  "difficulty": "BEGINNER",
  "estimatedMinutes": 45,
  "accessTier": "FREE",
  "locked": false,
  "order": 0,
  "availableLanguages": ["ENGLISH", "HINGLISH"],
  "moduleCount": 2,
  "lessonCount": 5,
  "hasPremiumLessons": true,
  "progress": {
    "totalLessons": 5,
    "startedLessons": 1,
    "completedLessons": 1,
    "percent": 20
  },
  "learningPath": {
    "id": "clx_path_1",
    "slug": "english-communication",
    "title": "English Communication"
  },
  "modules": [
    {
      "id": "clx_module_1",
      "slug": "starting-out",
      "title": "Starting Out",
      "description": "First conversations.",
      "order": 0,
      "estimatedMinutes": 15,
      "lessons": [
        {
          "id": "clx_lesson_1",
          "slug": "tell-me-about-yourself",
          "title": "Tell Me About Yourself",
          "summary": "Introduce yourself in a few sentences.",
          "objective": "Use a simple introduction pattern.",
          "difficulty": "BEGINNER",
          "estimatedMinutes": 5,
          "accessTier": "FREE",
          "effectiveAccessTier": "FREE",
          "locked": false,
          "order": 0,
          "requiresQuiz": false,
          "module": {
            "id": "clx_module_1",
            "slug": "starting-out",
            "title": "Starting Out",
            "order": 0
          },
          "course": {
            "id": "clx_course_1",
            "slug": "everyday-english-foundations",
            "title": "Everyday English Foundations",
            "accessTier": "FREE",
            "locked": false
          },
          "progress": null
        }
      ]
    }
  ],
  "prerequisites": []
}
```

`prerequisites` contains visible, published course references with their own
`locked` flags.

### `GET /api/v1/courses/:id/lessons`

Returns a flattened, paginated list of the course's published lessons in module
and lesson order, together with the course card.

```json
{
  "course": { "...": "course card" },
  "items": [
    { "...": "lesson card" }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 5
}
```

---

## 6. Lessons and recommendations

### `GET /api/v1/lessons/recommended`

Returns the first accessible published lesson that matches the learner's saved
learning goal and interests. The MVP mapping is intentionally small and
deterministic: preference values map to seeded path/course slugs, then the first
matching lesson in admin order is chosen. If no preference matches, the first
accessible lesson in admin order is returned. If every published lesson is
premium and the learner has no entitlement, the first premium lesson is returned
with `locked: true` and reason `PREMIUM_CONTENT`.

```json
{
  "lesson": { "...": "lesson card" },
  "learningPath": {
    "id": "clx_path_3",
    "slug": "financial-literacy",
    "title": "Financial Literacy"
  },
  "reason": "PREFERENCE_MATCH"
}
```

`reason` is one of `PREFERENCE_MATCH`, `FIRST_AVAILABLE` or `PREMIUM_CONTENT`.
When no published lesson exists, the endpoint returns `404 NO_CONTENT_AVAILABLE`.

### `GET /api/v1/lessons/continue`

Returns the learner's most recently accessed unfinished lesson so Home can offer a
"Continue learning" card. An `IN_PROGRESS` lesson is eligible only while its path,
course and module are published; completed lessons are never returned. Premium
content that is currently locked is skipped rather than surfaced as a dead end.

```json
{
  "item": {
    "lesson": { "...": "lesson card" },
    "learningPath": {
      "id": "clx_path_1",
      "slug": "english-communication",
      "title": "English Communication"
    },
    "progress": {
      "lessonId": "clx_lesson_1",
      "status": "IN_PROGRESS",
      "progressPercent": 40,
      "lastBlockOrder": 2,
      "startedAt": "2026-10-21T10:10:00.000Z",
      "lastAccessedAt": "2026-10-21T10:12:00.000Z",
      "completedAt": null,
      "timeSpentSeconds": 120
    }
  }
}
```

`item` is `null` when nothing is in progress. The route returns `200` in that
case; an empty resume state is normal for a new learner.

### `GET /api/v1/lessons/:id`

Returns the playable lesson. Premium lessons return `403 PREMIUM_REQUIRED` for
learners without an active entitlement. The lesson body is the ordered `blocks`
array; block `payload` follows the per-type contract in
[docs/CONTENT-MODEL.md](CONTENT-MODEL.md). Unknown block types are skipped.

```json
{
  "id": "clx_lesson_1",
  "slug": "tell-me-about-yourself",
  "title": "Tell Me About Yourself",
  "summary": "Introduce yourself in a few sentences.",
  "objective": "Use a simple introduction pattern.",
  "difficulty": "BEGINNER",
  "estimatedMinutes": 5,
  "accessTier": "FREE",
  "effectiveAccessTier": "FREE",
  "order": 0,
  "version": 1,
  "primaryLanguage": "ENGLISH",
  "requiresQuiz": false,
  "completionCriteria": null,
  "publishedAt": "2026-10-21T10:00:00.000Z",
  "availableLanguages": ["ENGLISH", "HINGLISH"],
  "course": {
    "id": "clx_course_1",
    "slug": "everyday-english-foundations",
    "title": "Everyday English Foundations",
    "accessTier": "FREE",
    "locked": false
  },
  "module": {
    "id": "clx_module_1",
    "slug": "starting-out",
    "title": "Starting Out",
    "order": 0
  },
  "blocks": [
    {
      "id": "clx_block_1",
      "type": "HEADING",
      "order": 0,
      "payload": { "text": "Tell me about yourself" },
      "caption": null,
      "media": null
    }
  ],
  "translations": [
    {
      "language": "HINGLISH",
      "title": "Tell Me About Yourself",
      "summary": "Introduce yourself in a few sentences.",
      "objective": "Use a simple introduction pattern."
    }
  ],
  "quiz": {
    "id": "clx_quiz_1",
    "slug": "tell-me-about-yourself-quiz",
    "title": "Check your understanding",
    "description": null,
    "passingScore": 60,
    "xpReward": 5,
    "timeLimitSeconds": null,
    "questionCount": 3,
    "required": true,
    "attemptCount": 1,
    "bestScore": 67,
    "passed": true,
    "activeAttemptId": null
  },
  "progress": {
    "lessonId": "clx_lesson_1",
    "status": "IN_PROGRESS",
    "progressPercent": 40,
    "lastBlockOrder": 2,
    "startedAt": "2026-10-21T10:10:00.000Z",
    "lastAccessedAt": "2026-10-21T10:12:00.000Z",
    "completedAt": null,
    "timeSpentSeconds": 120
  },
  "nextLesson": {
    "id": "clx_lesson_2",
    "slug": "first-impressions",
    "title": "First Impressions",
    "summary": "Make a strong first impression.",
    "estimatedMinutes": 5,
    "accessTier": "FREE",
    "effectiveAccessTier": "FREE",
    "locked": false,
    "module": {
      "id": "clx_module_1",
      "slug": "starting-out",
      "title": "Starting Out",
      "order": 0
    }
  }
}
```

`nextLesson` is the next published lesson in the same course, in module and
lesson order. Media assets used by blocks are resolved into a `media` object with
`id`, `url`, `type`, `mimeType`, dimensions, duration and alt text.

`quiz` is `null` when the lesson has no published lesson quiz. Otherwise
`required` mirrors `requiresQuiz`, `attemptCount` includes active and submitted
attempts, `bestScore`/`passed` reflect submitted attempts only, and
`activeAttemptId` lets the client resume without creating a duplicate. Question
text and correctness are available from [API-QUIZ.md](API-QUIZ.md).

---

## 7. Lesson progress

All three progress routes require a published, accessible lesson. Locked
premium lessons return `403 PREMIUM_REQUIRED`; hidden content returns `404`.

### `POST /api/v1/lessons/:id/start`

Creates an `IN_PROGRESS` row if none exists and updates `lastAccessedAt`. Calling
it again does not reset `startedAt`. Starting a completed lesson keeps its
`COMPLETED` status and original `completedAt` (reopening for revision), and
returns:

```json
{
  "lessonId": "clx_lesson_1",
  "status": "IN_PROGRESS",
  "progressPercent": 0,
  "lastBlockOrder": null,
  "startedAt": "2026-10-21T10:10:00.000Z",
  "lastAccessedAt": "2026-10-21T10:10:00.000Z",
  "completedAt": null,
  "timeSpentSeconds": 0
}
```

### `POST /api/v1/lessons/:id/progress`

Partial update. At least one field is required:

```json
{
  "progressPercent": 40,
  "lastBlockOrder": 2,
  "timeSpentSeconds": 30
}
```

- `progressPercent`: integer `0..100`; progress is monotonic and never lowers an
  existing value.
- `lastBlockOrder`: integer `0..10000`; the latest resume position, which may
  move backwards when the learner scrolls back.
- `timeSpentSeconds`: elapsed seconds since the previous update, integer
  `0..3600`; the server adds it to the existing total. It is not an absolute
  total.

If there is no row, the update implicitly starts the lesson. Completed lessons
stay `COMPLETED` with `progressPercent: 100`; time and last position can still be
updated during revision.

### `POST /api/v1/lessons/:id/complete`

Marks the lesson `COMPLETED`, sets `progressPercent` to `100`, and sets
`completedAt` once. The endpoint is idempotent: a repeated request returns the
existing completion and preserves the original `completedAt`. Reopening and
completing again never changes the completion timestamp or awards XP twice.

Completion now applies the Task 7 reward transaction: 10 lesson XP, streak and
daily-activity updates, daily-goal XP when the goal is reached, and achievement
unlocks. The response keeps the progress fields and adds `alreadyCompleted` and
`rewards`:

```json
{
  "lessonId": "clx_lesson_1",
  "status": "COMPLETED",
  "progressPercent": 100,
  "lastBlockOrder": null,
  "startedAt": "2026-10-23T05:00:00.000Z",
  "lastAccessedAt": "2026-10-23T05:02:00.000Z",
  "completedAt": "2026-10-23T05:02:00.000Z",
  "timeSpentSeconds": 300,
  "alreadyCompleted": false,
  "rewards": {
    "xpEarned": 10,
    "totalXp": 10,
    "alreadyAwarded": false
  }
}
```

The full reward shape is documented in
[API-PROGRESS.md](API-PROGRESS.md#6-lesson-completion-rewards). A repeated call
returns `alreadyCompleted: true` and `rewards.xpEarned: 0`.

When `requiresQuiz` is `true`, completion requires a submitted attempt whose
score is at least the lesson quiz's `passingScore`. Otherwise the route returns:

| Status | Code | Meaning |
| --- | --- | --- |
| 422 | `QUIZ_REQUIRED` | No passing submitted attempt exists yet. |
| 422 | `QUIZ_UNAVAILABLE` | The lesson requires a quiz, but no published lesson quiz exists. |

A lesson that is already `COMPLETED` remains idempotent; the check applies to
the first completion only. The quiz flow is documented in
[API-QUIZ.md](API-QUIZ.md).

---

## 8. Errors

| Status | Code | Meaning |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Invalid pagination, progress field or request body. |
| 401 | `UNAUTHENTICATED` | Missing bearer token. |
| 401 | `INVALID_ACCESS_TOKEN` | Expired, revoked or invalid access token. |
| 403 | `ACCOUNT_UNAVAILABLE` | Account is suspended or deleted. |
| 403 | `PREMIUM_REQUIRED` | Lesson is premium and the learner has no active entitlement. |
| 404 | `LEARNING_PATH_NOT_FOUND` | Path missing, draft or archived. |
| 404 | `COURSE_NOT_FOUND` | Course missing, unpublished or under an unpublished path. |
| 404 | `LESSON_NOT_FOUND` | Lesson missing, unpublished or under an unpublished parent. |
| 404 | `NO_CONTENT_AVAILABLE` | No published lesson exists for the recommendation endpoint. |
| 422 | `QUIZ_REQUIRED` | A quiz-gated lesson needs a passing submitted quiz attempt. |
| 422 | `QUIZ_UNAVAILABLE` | A quiz-gated lesson has no published quiz. |
| 429 | `RATE_LIMITED` | Route or global rate limit exceeded. |

Errors use the standard envelope:

```json
{
  "error": {
    "code": "LESSON_NOT_FOUND",
    "message": "Lesson not found."
  }
}
```

---

## 9. Content scope and known limits

- All content routes are authenticated; anonymous browsing is not enabled.
- Course search, difficulty/access filters and full-text search are deferred.
- Top-level path/course lists and flattened course lessons are paginated;
  nested course modules/lessons are returned in full for the player.
- Recommendation ranking is a deterministic preference-to-slug mapping, not a
  machine-learning or tag-based recommender.
- Translation metadata is returned, but translated block payloads are not
  selected; clients render the primary lesson with its Hinglish callouts.
- Quiz attempt lifecycle, server scoring and review are documented in
  [API-QUIZ.md](API-QUIZ.md); lesson completion now enforces `requiresQuiz`.
- Lesson completion awards XP, updates streaks/daily activity and unlocks
  achievements; quiz XP uses the same ledger and is awarded on the first
  submitted attempt per quiz.
- Subscription state is read from `Entitlement`; billing creation is Task 10.
