# Quiz API

Lesson quiz retrieval, resumable attempts, answer saving, server-side scoring,
review and quiz-gated lesson completion. All routes live under `/api/v1`, require
a learner access token and follow [ADR 0004](adr/0004-api-and-error-conventions.md).

```http
Authorization: Bearer <accessToken>
```

Correctness, explanations, scores and XP are always calculated by the backend.
The client never sends a score, correctness flag or XP value.

---

## 1. Routes

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/lessons/:id/quiz` | Fetch the published lesson quiz without answer keys. |
| `POST` | `/api/v1/quizzes/:id/attempts` | Start a new attempt or resume the active one. |
| `POST` | `/api/v1/quiz-attempts/:id/answers` | Save or change one answer. |
| `POST` | `/api/v1/quiz-attempts/:id/submit` | Score the attempt once and return the review. |
| `GET` | `/api/v1/quiz-attempts/:id/results` | Review a submitted attempt. |

All content and attempt routes are scoped to the authenticated learner. An
attempt that belongs to another learner returns `404 QUIZ_ATTEMPT_NOT_FOUND`
rather than leaking its existence.

---

## 2. `GET /api/v1/lessons/:id/quiz`

Returns the published `LESSON` quiz attached to a published, accessible lesson.
The response includes question text and options, but **no** `isCorrect`,
`feedback` or explanation fields. Premium lessons return `403 PREMIUM_REQUIRED`.

```json
{
  "id": "clx_quiz_1",
  "slug": "quiz-tell-me-about-yourself",
  "title": "Check your introduction",
  "description": "Three quick questions on structure and relevance.",
  "lessonId": "clx_lesson_1",
  "passingScore": 60,
  "xpReward": 5,
  "timeLimitSeconds": null,
  "questionCount": 2,
  "totalPoints": 3,
  "questions": [
    {
      "id": "clx_question_1",
      "type": "SCENARIO",
      "prompt": "How should you open your answer?",
      "scenario": "An interviewer says: tell me about yourself.",
      "order": 0,
      "points": 1,
      "options": [
        { "id": "clx_option_1", "text": "Start with the present", "order": 0 },
        { "id": "clx_option_2", "text": "Start with childhood", "order": 1 }
      ]
    }
  ],
  "latestAttempt": {
    "id": "clx_attempt_1",
    "quizId": "clx_quiz_1",
    "attemptNumber": 1,
    "status": "IN_PROGRESS",
    "startedAt": "2026-10-21T10:00:00.000Z",
    "submittedAt": null,
    "score": null,
    "passingScore": 60,
    "passed": false,
    "correctCount": 0,
    "totalQuestions": 0,
    "answeredCount": 1,
    "xpAwarded": 0,
    "quizTitle": "Check your introduction",
    "answers": [
      {
        "questionId": "clx_question_1",
        "selectedOptionId": "clx_option_1",
        "answeredAt": "2026-10-21T10:01:00.000Z"
      }
    ]
  }
}
```

`latestAttempt` is `null` when the learner has never started the quiz. Its
`answers` contain only saved selections so an interrupted attempt can be
restored without revealing correctness. `activeAttemptId` is also exposed on the
lesson detail's `quiz` summary.

---

## 3. `POST /api/v1/quizzes/:id/attempts`

Starts an attempt for a published `LESSON` quiz whose lesson is published and
accessible. If the learner already has an `IN_PROGRESS` attempt, the route
resumes it instead of creating a duplicate; `resumed` is then `true`.

An empty quiz returns `422 QUIZ_EMPTY`. `DAILY_CHALLENGE` and `PRACTICE` quizzes
are not exposed through this route yet.

```json
{
  "quizId": "clx_quiz_1",
  "quizTitle": "Check your introduction",
  "passingScore": 60,
  "xpReward": 5,
  "timeLimitSeconds": null,
  "totalQuestions": 2,
  "resumed": false,
  "attempt": {
    "id": "clx_attempt_1",
    "quizId": "clx_quiz_1",
    "attemptNumber": 1,
    "status": "IN_PROGRESS",
    "startedAt": "2026-10-21T10:00:00.000Z",
    "submittedAt": null,
    "score": null,
    "passingScore": 60,
    "passed": false,
    "correctCount": 0,
    "totalQuestions": 0,
    "answeredCount": 0,
    "xpAwarded": 0
  },
  "answers": []
}
```

Attempt numbers increase per `(user, quiz)`. After an attempt is submitted,
calling this route again creates the next retake; in-progress attempts never
expire automatically.

---

## 4. `POST /api/v1/quiz-attempts/:id/answers`

Saves one selection. Saving the same `questionId` again before submission changes
the answer (last write wins). The response does not reveal whether the answer is
correct.

```json
{
  "questionId": "clx_question_1",
  "selectedOptionId": "clx_option_1"
}
```

The question must belong to the attempt's quiz and the option must belong to that
question. Otherwise the route returns `404 QUIZ_QUESTION_NOT_FOUND` or
`404 QUIZ_OPTION_NOT_FOUND`. Submitting an answer for a submitted attempt returns
`409 QUIZ_ATTEMPT_SUBMITTED`; an abandoned attempt returns
`409 QUIZ_ATTEMPT_CLOSED`.

Response:

```json
{
  "id": "clx_attempt_1",
  "quizId": "clx_quiz_1",
  "attemptNumber": 1,
  "status": "IN_PROGRESS",
  "startedAt": "2026-10-21T10:00:00.000Z",
  "submittedAt": null,
  "score": null,
  "passingScore": 60,
  "passed": false,
  "correctCount": 0,
  "totalQuestions": 0,
  "answeredCount": 1,
  "xpAwarded": 0
}
```

A learner may submit a partially answered attempt. Unanswered questions score
zero; there is no client-side requirement to answer every question first.

---

## 5. `POST /api/v1/quiz-attempts/:id/submit`

Scores the attempt from trusted server content and marks it `SUBMITTED`. The
request has no body. The same attempt can be submitted again safely: the stored
result is returned and no second reward is granted.

### Scoring

- `totalPoints` is the sum of each question's positive `points`.
- `correctPoints` is the sum of points for answers whose selected option is
  correct.
- `score = round(correctPoints / totalPoints * 100)`.
- `passed = score >= quiz.passingScore`.
- Each question is counted at most once because answers are unique per
  `(attempt, question)`.
- A quiz with no questions or no positive points returns `422 QUIZ_EMPTY`.

### Response

The response contains the stored result plus `firstAttempt` and `rewards`.
`rewards` is the full [progress reward](API-PROGRESS.md#6-lesson-completion-rewards)
returned by the XP engine. A duplicate submit returns `rewards: null` and
`firstAttempt: false`.

```json
{
  "quiz": {
    "id": "clx_quiz_1",
    "title": "Check your introduction",
    "passingScore": 60,
    "xpReward": 5
  },
  "attempt": {
    "id": "clx_attempt_1",
    "quizId": "clx_quiz_1",
    "attemptNumber": 1,
    "status": "SUBMITTED",
    "startedAt": "2026-10-21T10:00:00.000Z",
    "submittedAt": "2026-10-21T10:05:00.000Z",
    "score": 100,
    "passingScore": 60,
    "passed": true,
    "correctCount": 2,
    "totalQuestions": 2,
    "answeredCount": 2,
    "xpAwarded": 5
  },
  "questions": [
    {
      "id": "clx_question_1",
      "type": "SCENARIO",
      "prompt": "How should you open your answer?",
      "scenario": "An interviewer says: tell me about yourself.",
      "explanation": "Start with the present, then add a proof point.",
      "order": 0,
      "points": 1,
      "selectedOptionId": "clx_option_1",
      "isCorrect": true,
      "earnedPoints": 1,
      "options": [
        {
          "id": "clx_option_1",
          "text": "Start with the present",
          "order": 0,
          "feedback": "Correct. Keep it relevant.",
          "isCorrect": true,
          "selected": true
        },
        {
          "id": "clx_option_2",
          "text": "Start with childhood",
          "order": 1,
          "feedback": "Too much backstory.",
          "isCorrect": false,
          "selected": false
        }
      ]
    }
  ],
  "firstAttempt": true,
  "rewards": {
    "xpEarned": 5,
    "xpBreakdown": {
      "lessonXp": 0,
      "quizXp": 5,
      "dailyGoalXp": 0,
      "achievementXp": 0
    },
    "totalXp": 15,
    "level": 1,
    "leveledUp": false,
    "currentStreak": 1,
    "longestStreak": 1,
    "alreadyAwarded": false,
    "achievementsUnlocked": []
  }
}
```

### Reward rules

- The first submitted attempt for a quiz awards the quiz's configured `xpReward`.
- Later retakes are scored, update `quizzesCompleted`/streaks/activity and create
  a zero-XP ledger entry through `quiz-completed:{userId}:{attemptId}`.
- Duplicate submission requests reuse the same idempotency key, so quiz XP is
  never granted twice.
- Achievement XP and daily-goal XP may appear in `rewards.xpEarned` alongside the
  quiz reward. `attempt.xpAwarded` records only the quiz's own reward.

---

## 6. `GET /api/v1/quiz-attempts/:id/results`

Returns the same `quiz`, `attempt` and review `questions` as submission, without
`firstAttempt` or `rewards`. Review fields (`explanation`, option `isCorrect`,
`feedback`, `selected`, `earnedPoints`) are only exposed for submitted attempts.

An `IN_PROGRESS` attempt returns `409 QUIZ_ATTEMPT_NOT_SUBMITTED`; an abandoned
attempt returns `409 QUIZ_ATTEMPT_CLOSED`.

---

## 7. Lesson completion integration

When `Lesson.requiresQuiz` is `true`, `POST /api/v1/lessons/:id/complete`
requires at least one submitted attempt with `score >= passingScore`. It returns:

| Status | Code | Meaning |
| --- | --- | --- |
| 422 | `QUIZ_REQUIRED` | No passing submitted attempt exists yet. |
| 422 | `QUIZ_UNAVAILABLE` | The lesson requires a quiz, but no published lesson quiz exists. |

An already-completed lesson remains idempotent. The `quiz` summary on
`GET /api/v1/lessons/:id` exposes `required`, `attemptCount`, `bestScore`,
`passed` and `activeAttemptId` for the client.

---

## 8. Errors

| Status | Code | Meaning |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Missing/invalid body fields. |
| 401 | `UNAUTHENTICATED` | Missing bearer token. |
| 401 | `INVALID_ACCESS_TOKEN` | Expired, revoked or invalid access token. |
| 403 | `ACCOUNT_UNAVAILABLE` | Account is suspended or deleted. |
| 403 | `PREMIUM_REQUIRED` | The quiz's lesson is premium and the learner has no active entitlement. |
| 404 | `LESSON_NOT_FOUND` | Lesson missing, unpublished or under an unpublished parent. |
| 404 | `QUIZ_NOT_FOUND` | Quiz missing, unpublished, not a lesson quiz or inaccessible. |
| 404 | `QUIZ_ATTEMPT_NOT_FOUND` | Attempt missing or owned by another learner. |
| 404 | `QUIZ_QUESTION_NOT_FOUND` | Question does not belong to the attempt's quiz. |
| 404 | `QUIZ_OPTION_NOT_FOUND` | Option does not belong to the question. |
| 409 | `QUIZ_ATTEMPT_SUBMITTED` | The attempt was already submitted; answers can no longer change. |
| 409 | `QUIZ_ATTEMPT_CLOSED` | The attempt is abandoned or no longer active. |
| 409 | `QUIZ_ATTEMPT_NOT_SUBMITTED` | Results requested before submission. |
| 422 | `QUIZ_EMPTY` | No questions or no positive question points. |
| 422 | `QUIZ_REQUIRED` | Lesson completion blocked by an unpassed quiz. |
| 422 | `QUIZ_UNAVAILABLE` | A quiz-gated lesson has no published quiz. |
| 429 | `RATE_LIMITED` | Route or global rate limit exceeded. |

Rate limits: attempt starts and submissions `30/min`, answer saves `120/min`.
Errors use the standard envelope:

```json
{
  "error": {
    "code": "QUIZ_REQUIRED",
    "message": "Pass this lesson's quiz before completing the lesson."
  }
}
```

---

## 9. Scope and known limits

- Only published `LESSON` quizzes attached to a published, accessible lesson are
  exposed. Daily-challenge and practice quizzes keep their own deferred flows.
- `timeLimitSeconds` is returned but not enforced yet; seeded quizzes use `null`.
- There is no abandon endpoint. An in-progress attempt is resumed until it is
  submitted.
- Answer correctness, explanations and option feedback remain hidden until
  submission.
- Retakes are unlimited. Only the first submitted attempt earns quiz XP.
- Image/audio question payloads are not part of the MVP question schema.
