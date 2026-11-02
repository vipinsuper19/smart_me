# Content Model

How structured learning content is stored and rendered. This contract is shared by the admin editor (Task 8–9), the backend API (Task 5–6) and the Android lesson player (Task 14).

---

## 1. Hierarchy

```
LearningPath → Course → CourseModule → Lesson → LessonContentBlock[]
                                      └→ Quiz → Question → QuestionOption[]
```

- A **LearningPath** groups related courses (English Communication, Career Skills, Financial Literacy).
- A **Course** belongs to exactly one path and has admin-defined `order`.
- A **CourseModule** orders lessons inside a course.
- A **Lesson** is the unit a learner completes in 5–15 minutes.
- A **Quiz** is optional and belongs to at most one lesson. Daily-challenge and practice quizzes may exist without a lesson.

Every level has a `slug`; slugs are unique within their parent (`lesson` within `module`, `course` within `path`, `module` within `course`). This makes seeding and admin URLs deterministic.

---

## 2. Publication workflow

`DRAFT → IN_REVIEW → PUBLISHED → ARCHIVED`

Rules enforced by the backend:

- Ordinary learners only see `PUBLISHED` paths, courses, lessons and quizzes.
- A published lesson requires at least one content block.
- Archiving hides content from learners but preserves progress and history.
- Only `SUPER_ADMIN` and `CONTENT_EDITOR` roles may publish; publishing writes an `AuditLog` row.
- Only `SUPER_ADMIN` may unpublish, archive or hard-delete content/quizzes.
- Publishing a lesson requires at least one block; when `requiresQuiz` is true, a published quiz must already exist.
- Content version is tracked with `Lesson.version`; it increments when a previously published lesson is published again. Archived content keeps its progress and attempt history.
- Hard delete is allowed only for unpublished/archived content with no learner progress or quiz attempts.

Lessons inherit visibility from their own status, not just the course status, so a course can be published with some lessons still in draft. The student API must filter both.

---

## 3. Lesson block payloads

`LessonContentBlock.type` selects the renderer. `payload` is JSON with this shape:

| Type | Payload |
|---|---|
| `HEADING` | `{ "text": string }` |
| `PARAGRAPH` | `{ "text": string }` |
| `BULLET_LIST` | `{ "items": string[] }` |
| `CALLOUT` | `{ "title": string, "text": string, "language"?: "ENGLISH" \| "HINDI" \| "HINGLISH" }` |
| `IMAGE` | `{ "url"?: string, "alt"?: string }` + optional `mediaAssetId` |
| `AUDIO` | `{ "url"?: string, "transcript"?: string }` + optional `mediaAssetId` |
| `VIDEO` | `{ "url"?: string, "caption"?: string }` + optional `mediaAssetId` |
| `EXAMPLE_CONVERSATION` | `{ "lines": [{ "speaker": string, "text": string }] }` |
| `MULTIPLE_CHOICE` / `TRUE_FALSE` | Inline knowledge check; full quizzes use the Quiz model |
| `RECAP` | `{ "items": string[] }` |
| `COMPLETION` | `{ "message"?: string }` — optional explicit completion marker |

Renderer rules:

- Blocks render in ascending `order`.
- Unknown block types are skipped with a logged warning; the lesson must not crash.
- `mediaAssetId` is the preferred media reference. Raw `url` is allowed for externally hosted assets.
- Text blocks carry the primary language. Hinglish explanations are `CALLOUT` blocks with `language: "HINGLISH"`.

---

## 4. Language strategy

- `Lesson.primaryLanguage` is the language of the blocks (English for MVP seed content).
- `LessonTranslation` stores translated title, summary, objective and optional translated block payloads.
- User preference `explanationLanguage` decides whether Hinglish callouts are shown/highlighted.
- UI strings are localised separately in Android resources — they are **not** content translations.

---

## 5. Quizzes

- `Quiz.status` must be `PUBLISHED` for learners to see it.
- A lesson may have several quiz versions. `Quiz.version` starts at `1`, the admin API assigns the next version, and only one version per lesson may be `PUBLISHED`.
- The learner API selects the highest published version. Archived versions remain attached to their historical attempts.
- Structural edits (questions, options, correctness, order) are blocked once a quiz is published or has any learner attempts. The admin API clones the quiz to a new draft version instead.
- Question types: `SINGLE_CHOICE`, `TRUE_FALSE`, `SCENARIO`.
- Every question has a server-side `explanation`; options may add per-option `feedback`.
- `QuestionOption.isCorrect` is **never** returned before submission.
- Score: `round(sum(points of correct answers) / sum(points of all questions) * 100)`; an empty quiz returns a safe validation error instead of dividing by zero. All seeded questions have `points = 1`, but the weighted form leaves room for future scoring.
- Passing score defaults to 60 but is configurable per quiz.
- Publishing requires at least one question, at least two options per question, exactly one correct option per question and positive points.
- Questions referenced by submitted answers cannot be hard-deleted (`ON DELETE RESTRICT`); publish a new quiz version instead.
- A quiz attempt belongs to one user and one quiz. One answer per question per attempt (`@@unique([attemptId, questionId])`).
- Submission sets `submissionKey` uniquely once, and XP is awarded through an `XPTransaction` with a deterministic idempotency key.
- Answers may be changed while the attempt is `IN_PROGRESS`; correctness and explanations are only returned after submission.
- `POST /quizzes/:id/attempts` resumes an existing `IN_PROGRESS` attempt, so an interrupted client does not create duplicate attempts. Saved selections are returned with the resume payload.
- Unanswered questions score zero. A quiz with no questions, or with a total point value of zero, returns `422 QUIZ_EMPTY` instead of dividing by zero.
- The first submitted attempt per quiz awards the configured `xpReward`; later retakes are scored and counted but award `0` quiz XP.

---

## 6. Completion and rewards

- Starting a lesson creates/updates `LessonProgress` (`IN_PROGRESS`).
- Completing sets `completedAt` once; repeated completion requests return the same result and never award XP twice.
- When `Lesson.requiresQuiz` is true, the first completion requires a submitted quiz attempt at or above the quiz's `passingScore`. Missing quizzes fail closed with `QUIZ_UNAVAILABLE`.
- `completionCriteria` JSON allows lessons without a quiz:
  ```json
  { "type": "READ_TO_END", "requiresQuiz": false }
  ```
- XP values are configuration, enforced by the backend (not trusted from the client).
- Lesson completion credits 1–`estimatedMinutes` learning minutes based on tracked
  `timeSpentSeconds`; the cap prevents clients from inflating daily goals.
- `DailyActivity` is one row per learner per local date; `goalMet` is recalculated
  when activity is recorded.

---

## 7. Idempotency keys

| Operation | Unique key |
|---|---|
| Lesson progress | `(userId, lessonId)` |
| Quiz attempt | `(userId, quizId, attemptNumber)` |
| Quiz submission | `QuizAttempt.submissionKey` |
| XP award | `XPTransaction.idempotencyKey` |
| Lesson reward | `lesson-completed:{userId}:{lessonId}` |
| Quiz reward | `quiz-completed:{userId}:{attemptId}` |
| Daily-goal reward | `daily-goal:{userId}:{localDate}` |
| Achievement reward | `achievement:{userId}:{code}` |
| Daily challenge | `(userId, challengeId)` |
| Billing event | `BillingEvent.eventId` |
| Purchase order | `Purchase.orderId` |

---

## 8. Seeded demo content

`pnpm db:seed` creates:

- **English Communication** — *Everyday English Foundations* (free, 3 lessons), *Workplace English* (premium, 1 lesson)
- **Career and Workplace Skills** — *Interview Ready* (premium, 2 lessons)
- **Financial Literacy** — *Money Basics* (free, 2 lessons)
- 4 lesson quizzes with explanations plus a daily-challenge quiz
- 6 achievements, 2 subscription plans, 1 admin and 1 demo learner

Seeded credentials are documented in the root `README.md`.
