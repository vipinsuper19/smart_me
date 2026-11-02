# Gamification & Progress API

Learner XP, levels, streaks, daily goals, achievements and progress dashboards.
All routes live under `/api/v1`, require a learner access token and follow
[ADR 0004](adr/0004-api-and-error-conventions.md).

```http
Authorization: Bearer <accessToken>
```

Rewards are always calculated by the backend. No endpoint accepts an XP value,
streak value or score from the client.

---

## 1. XP rules

| Activity | XP |
|---|---:|
| Complete an eligible lesson | 10 |
| Complete a quiz | 5 |
| Reach the daily learning goal | 5 |

- Lesson XP is granted once per `(user, lesson)` and backed by the append-only
  `XPTransaction` ledger.
- Repeated lesson-completion requests return the existing completion with
  `xpEarned: 0`; they never create a second award.
- Quiz XP is backed by `quiz-completed:{userId}:{attemptId}`. The first submitted
  attempt for a quiz awards the quiz's configured `xpReward`; later retakes still
  score and count as completed quizzes but create a zero-XP ledger entry. See
  [API-QUIZ.md](API-QUIZ.md).
- Daily-goal XP is granted once per local day and backed by
  `daily-goal:{userId}:{YYYY-MM-DD}`.
- Achievement XP is supported when an achievement definition has `xpReward > 0`.
  The seeded achievements currently reward `0` XP.

Ledger rows contain the reason, source type, source id, timestamp, idempotency
key and balance after the award. Corrections must be new adjustment rows; rows
are never edited.

---

## 2. Levels

Levels use cumulative XP thresholds and never reset accumulated XP:

| Level | Total XP |
|---:|---:|
| 1 | 0 |
| 2 | 100 |
| 3 | 250 |
| 4 | 500 |
| 5 | 900 |
| 6 | 1,400 |
| 7 | 2,000 |
| 8 | 2,700 |
| 9 | 3,500 |
| 10 | 4,500 |

Above level 10, each level costs 2,500 XP. Level progress is returned as:

```json
{
  "level": 2,
  "totalXp": 125,
  "xpIntoLevel": 25,
  "xpForNextLevel": 150,
  "xpToNextLevel": 125,
  "nextLevelAt": 250,
  "progressPercent": 16
}
```

---

## 3. Time zone and local days

Every learner has an IANA `timeZone` (default `Asia/Kolkata`). The server derives
the learner's local calendar date with `Intl.DateTimeFormat`, so daylight-saving
transitions and non-24-hour offsets are handled without adding fixed millisecond
durations.

- `DailyActivity` stores one row per learner per local date.
- Streaks compare date-only values, not UTC timestamps.
- `progress/weekly` returns exactly seven local dates, oldest first, ending today.
- Changing the device clock or travelling does not change the stored zone until
  the learner profile does; a zone change that puts the last learning date in
  the future safely restarts the streak at one.

Daily learning minutes come from tracked lesson time, capped by the lesson's
estimated duration, with a minimum of one minute per completion. A learner
cannot manufacture unlimited minutes by submitting large `timeSpentSeconds`
values.

---

## 4. Streaks and daily goals

A local day qualifies for the streak when at least one eligible lesson or quiz is
completed. Opening the app, starting a lesson without completing it, or receiving
XP from another source does not qualify.

- Another activity on the same local day does not increment the streak again.
- A missed day restarts the current streak at one.
- `longestStreak` is retained independently.
- Reaching `dailyGoalMinutes` grants the once-per-day goal XP and updates
  `goalMet`.

The daily goal comes from the learner's saved preference (`5`, `10` or `15`
minutes; default `10`). A `DailyActivity` row snapshots the goal used that day.

---

## 5. Achievements

Seeded definitions:

| Code | Criterion |
|---|---|
| `FIRST_LESSON` | 1 lesson completed |
| `FIRST_QUIZ` | 1 quiz completed |
| `STREAK_3` | 3-day streak |
| `STREAK_7` | 7-day streak |
| `LESSONS_10` | 10 lessons completed |
| `DAILY_GOAL_ACHIEVED` | 1 daily goal reached |

Unlocking is idempotent (`UserAchievement` is unique per learner and
achievement). `UserAchievementProgress` stores the latest value and target for
partially completed achievements. Unknown or malformed criteria are ignored
rather than failing the reward transaction.

---

## 6. Lesson completion rewards

`POST /api/v1/lessons/:id/complete` now also applies the reward in the same
database transaction as completion. The existing progress fields are unchanged;
two additive fields are present:

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
    "xpEarned": 15,
    "xpBreakdown": {
      "lessonXp": 10,
      "quizXp": 0,
      "dailyGoalXp": 5,
      "achievementXp": 0
    },
    "totalXp": 25,
    "level": 1,
    "levelProgress": {
      "level": 1,
      "totalXp": 25,
      "xpIntoLevel": 25,
      "xpForNextLevel": 100,
      "xpToNextLevel": 75,
      "nextLevelAt": 100,
      "progressPercent": 25
    },
    "leveledUp": false,
    "currentStreak": 1,
    "longestStreak": 1,
    "dailyGoal": {
      "date": "2026-10-23",
      "targetMinutes": 10,
      "minutesLearned": 10,
      "percent": 100,
      "met": true
    },
    "achievementsUnlocked": [
      {
        "code": "DAILY_GOAL_ACHIEVED",
        "title": "Goal Getter",
        "description": "Reach your daily learning goal.",
        "iconUrl": null,
        "xpReward": 0,
        "earnedAt": "2026-10-23T05:02:00.000Z"
      }
    ],
    "alreadyAwarded": false
  }
}
```

A retry returns `alreadyCompleted: true`, `rewards.xpEarned: 0` and
`rewards.alreadyAwarded: true`, while preserving the original `completedAt`.

---

## 7. `GET /api/v1/gamification/summary`

```json
{
  "timeZone": "Asia/Kolkata",
  "totalXp": 25,
  "level": 1,
  "levelProgress": {
    "level": 1,
    "totalXp": 25,
    "xpIntoLevel": 25,
    "xpForNextLevel": 100,
    "xpToNextLevel": 75,
    "nextLevelAt": 100,
    "progressPercent": 25
  },
  "currentStreak": 1,
  "longestStreak": 1,
  "lastLearningDate": "2026-10-23",
  "lessonsCompleted": 2,
  "quizzesCompleted": 0,
  "minutesLearned": 10,
  "dailyGoal": {
    "date": "2026-10-23",
    "targetMinutes": 10,
    "minutesLearned": 10,
    "percent": 100,
    "met": true
  }
}
```

`lastLearningDate` and all activity dates are `YYYY-MM-DD` local dates.
`levelProgress` is always computed from the ledger-derived total XP.

---

## 8. `GET /api/v1/gamification/achievements`

Returns every active achievement in admin order, including locked ones, with the
learner's progress:

```json
{
  "items": [
    {
      "code": "FIRST_LESSON",
      "title": "First Lesson",
      "description": "Complete your first lesson.",
      "iconUrl": null,
      "xpReward": 0,
      "order": 1,
      "earned": true,
      "earnedAt": "2026-10-23T05:00:00.000Z",
      "progress": {
        "currentValue": 2,
        "targetValue": 1,
        "percent": 100,
        "completedAt": "2026-10-23T05:00:00.000Z"
      }
    }
  ],
  "earnedCount": 1,
  "totalCount": 6
}
```

Achievement data is private to the authenticated learner.

---

## 9. `GET /api/v1/gamification/transactions`

Paginated XP ledger, newest first. `reason` is optional and must be one of
`LESSON_COMPLETED`, `QUIZ_COMPLETED`, `DAILY_CHALLENGE_COMPLETED`,
`DAILY_GOAL_REACHED`, `STREAK_BONUS`, `ACHIEVEMENT_UNLOCKED` or
`ADMIN_ADJUSTMENT`.

| Query | Default | Rules |
|---|---|---|
| `page` | `1` | integer ≥ 1 |
| `pageSize` | `20` | integer 1–100 |
| `reason` | none | exact `XPReason` |

```json
{
  "items": [
    {
      "id": "clx_xp_2",
      "amount": 5,
      "reason": "DAILY_GOAL_REACHED",
      "sourceType": "DAILY_ACTIVITY",
      "sourceId": "2026-10-23",
      "description": "Daily learning goal reached.",
      "balanceAfter": 15,
      "createdAt": "2026-10-23T05:02:00.000Z"
    }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 2
}
```

---

## 10. `GET /api/v1/progress/overview`

```json
{
  "lessonsStarted": 2,
  "lessonsCompleted": 2,
  "quizAttempts": 0,
  "quizzesCompleted": 0,
  "minutesLearned": 10,
  "totalXp": 25,
  "level": 1,
  "levelProgress": {
    "level": 1,
    "totalXp": 25,
    "xpIntoLevel": 25,
    "xpForNextLevel": 100,
    "xpToNextLevel": 75,
    "nextLevelAt": 100,
    "progressPercent": 25
  },
  "currentStreak": 1,
  "longestStreak": 1,
  "dailyGoal": {
    "date": "2026-10-23",
    "targetMinutes": 10,
    "minutesLearned": 10,
    "percent": 100,
    "met": true
  },
  "topics": [
    {
      "id": "clx_path_1",
      "slug": "english-communication",
      "title": "English Communication",
      "totalLessons": 5,
      "startedLessons": 2,
      "completedLessons": 2,
      "percent": 40
    }
  ]
}
```

Topics are published learning paths with at least one published lesson.
`lessonsStarted` counts every lesson progress row; `lessonsCompleted` counts
`COMPLETED` progress rows. Every successful completion also updates the reward
statistics and ledger transactionally.

---

## 11. `GET /api/v1/progress/weekly`

Always returns seven local days: `from` is six days before `to` (today).

```json
{
  "timeZone": "Asia/Kolkata",
  "from": "2026-10-17",
  "to": "2026-10-23",
  "days": [
    {
      "date": "2026-10-17",
      "lessonsCompleted": 0,
      "quizzesCompleted": 0,
      "minutesLearned": 0,
      "xpEarned": 0,
      "dailyGoalMinutes": 10,
      "goalMet": false
    }
  ],
  "totals": {
    "lessonsCompleted": 4,
    "quizzesCompleted": 0,
    "minutesLearned": 20,
    "xpEarned": 40,
    "goalDays": 1,
    "activeDays": 3
  }
}
```

`activeDays` counts days with at least one completed lesson or quiz. Missing
`DailyActivity` rows are returned as zeroes using the learner's current goal.

---

## 12. Errors

| Status | Code | Meaning |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Invalid pagination or `reason` filter. |
| 401 | `UNAUTHENTICATED` | Missing bearer token. |
| 401 | `INVALID_ACCESS_TOKEN` | Expired, revoked or invalid access token. |
| 403 | `ACCOUNT_UNAVAILABLE` | Account is suspended or deleted. |
| 404 | `USER_NOT_FOUND` | Authenticated account no longer exists. |
| 429 | `RATE_LIMITED` | Global rate limit exceeded. |

Errors use the standard envelope:

```json
{
  "error": {
    "code": "USER_NOT_FOUND",
    "message": "User account was not found."
  }
}
```

---

## 13. Progress scope and deferred work

- Quiz scoring, submission and review are live in
  [API-QUIZ.md](API-QUIZ.md). Submission records `quizzesCompleted`, `FIRST_QUIZ`
  and streak activity; quiz XP is awarded on the first submitted attempt per
  quiz.
- Daily-challenge XP and the `DailyChallenge` completion flow are not exposed.
- Admin XP adjustments are schema-supported (`XPReason.ADMIN_ADJUSTMENT`) but
  are not exposed by the Task 8 admin API; they remain deferred. Admin
  dashboard/user/analytics reads are documented in [API-ADMIN.md](API-ADMIN.md).
- Topic progress is path-level; per-course and per-module progress already comes
  from the content endpoints.
- `streakReminder` / notification delivery is Task 11.
