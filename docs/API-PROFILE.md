# Profile, Preferences & Onboarding API

- **Status:** Implemented in Task 4
- **Base path:** `/api/v1`
- **Related:** [PRD §7.2 and §12.2](PRD.md), [ADR 0004](adr/0004-api-and-error-conventions.md), [API-AUTH.md](API-AUTH.md)

All routes require an access token:

```http
Authorization: Bearer <accessToken>
```

The learner's email is read-only. Changing it requires a separate verified
email-change flow, which is not part of Task 4.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/profile` | Return account details and editable profile fields |
| `PATCH` | `/profile` | Update name, avatar and profile details |
| `GET` | `/preferences` | Return learning preferences and defaults |
| `PATCH` | `/preferences` | Update one or more learning preferences |
| `GET` | `/onboarding` | Return onboarding status, current preferences and options |
| `POST` | `/onboarding/complete` | Save preferences and mark onboarding complete |

Rows for `UserProfile` and `UserPreference` are created for new email and Google
accounts. Reads also upsert the rows defensively for accounts created before
Task 4 or outside normal registration.

## Profile

`GET /profile` returns `200`:

```json
{
  "id": "cm...",
  "email": "learner@example.com",
  "name": "Asha",
  "avatarUrl": "https://cdn.example.com/avatars/asha.png",
  "emailVerifiedAt": null,
  "timeZone": "Asia/Kolkata",
  "locale": "en-IN",
  "onboardingCompletedAt": "2026-10-21T09:30:00.000Z",
  "createdAt": "2026-10-20T09:30:00.000Z",
  "profile": {
    "headline": "Learning every day",
    "occupation": "Designer",
    "city": "Delhi",
    "bio": "Working on my English for interviews.",
    "dateOfBirth": "1995-08-15",
    "createdAt": "2026-10-20T09:30:00.000Z",
    "updatedAt": "2026-10-21T09:30:00.000Z"
  }
}
```

- `name` and `avatarUrl` are stored on `User`; the remaining editable fields are
  stored on `UserProfile`.
- `timeZone` and `locale` are returned for client display but are read-only in
  Task 4.
- `dateOfBirth` is returned as a date-only string to avoid timezone shifts.

`PATCH /profile` accepts any subset of:

```json
{
  "name": "Asha Sharma",
  "avatarUrl": "https://cdn.example.com/avatars/asha.png",
  "headline": "Learning every day",
  "occupation": "Designer",
  "city": "Delhi",
  "bio": "Working on my English for interviews.",
  "dateOfBirth": "1995-08-15"
}
```

| Field | Rules |
|---|---|
| `name` | String, up to 80 characters; null or an empty string clears it |
| `avatarUrl` | Absolute `http`/`https` URL, up to 500 characters; null clears it |
| `headline` | Up to 120 characters; null clears it |
| `occupation` | Up to 100 characters; null clears it |
| `city` | Up to 100 characters; null clears it |
| `bio` | Up to 500 characters; null clears it |
| `dateOfBirth` | Valid `YYYY-MM-DD` calendar date, not in the future; null clears it |

Strings are trimmed. Sending an empty object returns the current profile without
changing anything. The response is the same shape as `GET /profile`.

## Preferences

`GET /preferences` returns `200`:

```json
{
  "learningGoal": "INTERVIEW_PREPARATION",
  "proficiency": "INTERMEDIATE",
  "explanationLanguage": "HINGLISH",
  "dailyGoalMinutes": 10,
  "interests": ["interviews", "english-speaking"],
  "updatedAt": "2026-10-21T09:30:00.000Z"
}
```

`PATCH /preferences` accepts any subset of:

```json
{
  "learningGoal": "INTERVIEW_PREPARATION",
  "proficiency": "INTERMEDIATE",
  "explanationLanguage": "HINGLISH",
  "dailyGoalMinutes": 15,
  "interests": ["interviews", "english-speaking"]
}
```

- `learningGoal`: `IMPROVE_ENGLISH`, `INTERVIEW_PREPARATION`, `CAREER_SKILLS` or
  `CONFIDENCE_COMMUNICATION`. `null` clears the selection.
- `proficiency`: `BEGINNER`, `ELEMENTARY`, `INTERMEDIATE` or `ADVANCED`. `null`
  clears the selection.
- `explanationLanguage`: `ENGLISH`, `HINDI` or `HINGLISH`. It is required by the
  schema, so `null` is rejected; omit it to keep the current value.
- `dailyGoalMinutes`: `5`, `10` or `15` only.
- `interests`: zero or more unique values from the curated list below. Values
  are trimmed and lower-cased. An empty array clears all interests.
- Omitted fields are preserved, so preferences remain editable after onboarding.

### Interest values

| Value | Label |
|---|---|
| `english-speaking` | Everyday English |
| `interviews` | Interview preparation |
| `workplace-communication` | Workplace communication |
| `money-basics` | Money basics |
| `confidence` | Confidence and communication |

Interests are stored as a string array so content can add categories later. For
MVP, the API rejects values outside this list so recommendations and analytics
stay consistent.

## Onboarding

`GET /onboarding` returns the status, current values and all selectable options:

```json
{
  "required": true,
  "completedAt": null,
  "preferences": {
    "learningGoal": null,
    "proficiency": null,
    "explanationLanguage": "HINGLISH",
    "dailyGoalMinutes": 10,
    "interests": [],
    "updatedAt": "2026-10-21T09:30:00.000Z"
  },
  "options": {
    "learningGoals": [
      { "value": "IMPROVE_ENGLISH", "label": "Improve English" },
      { "value": "INTERVIEW_PREPARATION", "label": "Prepare for interviews" },
      { "value": "CAREER_SKILLS", "label": "Develop career skills" },
      {
        "value": "CONFIDENCE_COMMUNICATION",
        "label": "Improve confidence and communication"
      }
    ],
    "proficiencyLevels": [
      { "value": "BEGINNER", "label": "Beginner" },
      { "value": "ELEMENTARY", "label": "Elementary" },
      { "value": "INTERMEDIATE", "label": "Intermediate" },
      { "value": "ADVANCED", "label": "Advanced" }
    ],
    "explanationLanguages": [
      { "value": "ENGLISH", "label": "English" },
      { "value": "HINDI", "label": "Hindi" },
      { "value": "HINGLISH", "label": "Hinglish" }
    ],
    "dailyGoalMinutes": [5, 10, 15],
    "interests": [
      { "value": "english-speaking", "label": "Everyday English" },
      { "value": "interviews", "label": "Interview preparation" },
      { "value": "workplace-communication", "label": "Workplace communication" },
      { "value": "money-basics", "label": "Money basics" },
      { "value": "confidence", "label": "Confidence and communication" }
    ]
  }
}
```

`POST /onboarding/complete` accepts the same optional fields as
`PATCH /preferences`:

```json
{
  "learningGoal": "CAREER_SKILLS",
  "proficiency": "BEGINNER",
  "explanationLanguage": "HINGLISH",
  "dailyGoalMinutes": 15,
  "interests": ["workplace-communication"]
}
```

- Every field is optional. `{}` or no body is valid and completes onboarding
  with the existing/default preferences, which implements **skip**.
- The preference update and `User.onboardingCompletedAt` write happen in one
  transaction.
- The operation is idempotent: completing again updates preferences if supplied
  and keeps the original completion time.
- `PATCH /preferences` after completion does not reset onboarding status.
- The first-lesson recommendation is provided by
  [`GET /lessons/recommended`](API-CONTENT.md#get-apiv1lessonsrecommended) using
  these saved preferences and the published content hierarchy.

Response `200`:

```json
{
  "completedAt": "2026-10-21T09:30:00.000Z",
  "preferences": {
    "learningGoal": "CAREER_SKILLS",
    "proficiency": "BEGINNER",
    "explanationLanguage": "HINGLISH",
    "dailyGoalMinutes": 15,
    "interests": ["workplace-communication"],
    "updatedAt": "2026-10-21T09:30:00.000Z"
  }
}
```

## Errors and limits

| HTTP | Code | Meaning |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Invalid/unknown field; `details` contains field paths |
| 401 | `UNAUTHENTICATED` | Missing bearer token |
| 401 | `INVALID_ACCESS_TOKEN` | Expired or revoked access token |
| 403 | `ACCOUNT_UNAVAILABLE` | Account is suspended or deleted |
| 404 | `USER_NOT_FOUND` | Authenticated account row no longer exists |
| 429 | `RATE_LIMITED` | Throttle exceeded |

Global reads are limited to 100 requests/minute per IP. Writes override the
default:

| Route | Limit |
|---|---|
| `PATCH /profile` | 30/minute |
| `PATCH /preferences` | 30/minute |
| `POST /onboarding/complete` | 10/minute |

Throttle storage is in-memory for the single-instance MVP; move it to Redis
before running multiple API instances.

## Deferred

- Notification preferences are part of the notifications task (Task 11).
- Avatar file upload/storage: Task 4 accepts an externally hosted `avatarUrl`.
- Email change and enforced email verification.
- Updating `timeZone`/`locale` through the API.
- Personalized Home dashboard data beyond the first-lesson recommendation; see
  [API-CONTENT.md](API-CONTENT.md).
