# Notifications & analytics API

Reminder preferences, FCM device registration, the scheduled reminder loop and
client product-event ingestion. All learner routes live under `/api/v1`, require
a learner access token and follow [ADR 0004](adr/0004-api-and-error-conventions.md).

```http
Authorization: Bearer <accessToken>
```

---

## 1. Feature flags

Notifications are split into two independent concerns:

- **Preferences and devices** (the learner-facing routes) always work. A learner
  can save reminder settings and register a device before push delivery ships.
- **Scheduled delivery** is gated by `NOTIFICATIONS_ENABLED`. When it is `false`
  the scheduler does not start and `ReminderService.run()` returns immediately.

| Variable | Default | Purpose |
| --- | --- | --- |
| `NOTIFICATIONS_ENABLED` | `false` | Master flag for scheduled reminder delivery. |
| `NOTIFICATIONS_PROVIDER` | `mock` | `mock` logs deliveries; `fcm` sends through Firebase Cloud Messaging HTTP v1. |
| `NOTIFICATIONS_SCHEDULER_ENABLED` | `false` | Starts the in-process reminder loop (requires `NOTIFICATIONS_ENABLED=true`). |
| `NOTIFICATIONS_INTERVAL_SECONDS` | `300` | Scheduler tick, minimum `5`. |
| `NOTIFICATIONS_MAX_PER_DAY` | `2` | Maximum reminders per learner per local day, across all types. |
| `FCM_PROJECT_ID` | — | Firebase project id. Required when the provider is `fcm`. |
| `FCM_SERVICE_ACCOUNT_JSON` | — | Stringified service-account JSON with FCM send permission. Required when the provider is `fcm`. |

Boot validation rejects:

- `NOTIFICATIONS_SCHEDULER_ENABLED=true` without `NOTIFICATIONS_ENABLED=true`.
- `NOTIFICATIONS_PROVIDER=mock` in production.
- `NOTIFICATIONS_PROVIDER=fcm` without a project id or a service-account value
  that parses to a JSON object.

The `mock` provider is a development adapter: it logs `Mock push to ...<last8>`
instead of contacting FCM, so the planner, dedupe and preference rules can be
exercised offline.

### FCM setup

1. Create a Firebase project and enable the **Firebase Cloud Messaging API**.
2. Create a service account with permission to send FCM messages and download
   its JSON key.
3. Set `FCM_PROJECT_ID` and put the JSON on one line in
   `FCM_SERVICE_ACCOUNT_JSON`.
4. Set `NOTIFICATIONS_PROVIDER=fcm`, `NOTIFICATIONS_ENABLED=true`, and the
   scheduler flag if this process should own delivery.

The Android client obtains a registration token from the Firebase SDK and posts
it to `POST /notifications/devices`. The API only ever returns the last eight
characters of a token.

---

## 2. Routes

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/notifications/preferences` | Read reminder preferences (creates defaults on first read) |
| `PATCH` | `/api/v1/notifications/preferences` | Update one or more preference fields |
| `GET` | `/api/v1/notifications/devices` | List registered devices (masked tokens) |
| `POST` | `/api/v1/notifications/devices` | Register or refresh an FCM token |
| `DELETE` | `/api/v1/notifications/devices/:id` | Remove a device |
| `POST` | `/api/v1/analytics/events` | Ingest a batch of product events |

`PATCH /notifications/preferences` is throttled to 30 requests/minute and device
registration to 20/minute per client. Analytics ingestion is throttled to 60
batches/minute.

---

## 3. `GET /api/v1/notifications/preferences`

Returns the learner's reminder settings plus the IANA time zone used to
interpret the local time. Reading preferences before they have been edited
creates the default row.

```json
{
  "dailyReminder": true,
  "incompleteLessonReminder": true,
  "streakReminder": true,
  "newLessonAnnouncements": true,
  "reminderTimeLocal": "19:00",
  "timeZone": "Asia/Kolkata",
  "updatedAt": "2026-11-01T09:30:00.000Z"
}
```

## 4. `PATCH /api/v1/notifications/preferences`

All fields are optional; only supplied fields change.

```json
{
  "dailyReminder": true,
  "streakReminder": false,
  "reminderTimeLocal": "07:30"
}
```

| Field | Type | Rules |
| --- | --- | --- |
| `dailyReminder` | boolean | Generic daily learning nudge. |
| `incompleteLessonReminder` | boolean | Nudge to finish a lesson left open for at least 24 hours. |
| `streakReminder` | boolean | Higher-priority nudge when a streak is at risk. |
| `newLessonAnnouncements` | boolean | Announce a recently published lesson once. |
| `reminderTimeLocal` | string | 24-hour `HH:MM`, e.g. `19:00`. Interpreted in the learner's `timeZone`. |

The response has the same shape as `GET` and reflects the saved values.

---

## 5. Devices

### `POST /api/v1/notifications/devices`

```json
{
  "token": "fcm-registration-token-from-the-android-sdk",
  "platform": "ANDROID"
}
```

- `token` is trimmed, 20–4096 characters, and limited to the characters FCM uses.
- `platform` is `ANDROID` (default) or `WEB`.
- FCM tokens are globally unique. Registering a token that currently belongs to
  another account **moves** it to the caller; it is never shared.
- Re-registering the same token refreshes `lastSeenAt` and reactivates it.
- A learner may hold at most **10 active devices**. The next registration returns
  `422 DEVICE_LIMIT_REACHED`; the learner must remove a device first.

Returns `201`:

```json
{
  "id": "clx_device_1",
  "platform": "ANDROID",
  "tokenSuffix": "a1b2c3d4",
  "isActive": true,
  "lastSeenAt": "2026-11-01T09:30:00.000Z",
  "createdAt": "2026-10-20T09:30:00.000Z"
}
```

### `GET /api/v1/notifications/devices`

```json
{
  "items": [
    {
      "id": "clx_device_1",
      "platform": "ANDROID",
      "tokenSuffix": "a1b2c3d4",
      "isActive": true,
      "lastSeenAt": "2026-11-01T09:30:00.000Z",
      "createdAt": "2026-10-20T09:30:00.000Z"
    }
  ]
}
```

The full token is never returned, logged in responses or included in reminder
copy. Inactive devices are listed so a learner can see stale registrations.

### `DELETE /api/v1/notifications/devices/:id`

Returns `204` with no body. A device that does not belong to the caller is
reported as `404 DEVICE_NOT_FOUND` rather than revealing ownership.

---

## 6. Scheduled reminders

The scheduler is an in-process interval loop. It starts only when
`NOTIFICATIONS_ENABLED=true`, `NOTIFICATIONS_SCHEDULER_ENABLED=true` and the
process is not running under Jest. Run the scheduler in one process; the
delivery ledger makes overlapping ticks harmless if a second instance is running
by accident.

Each tick scans active, non-deleted learners with at least one active device.
For every learner the pure planner (`reminder-planner.ts`) applies these rules:

| Rule | Behaviour |
| --- | --- |
| Local time | Nothing is planned before `reminderTimeLocal` in the learner's zone. |
| Already active today | If `UserStats.lastLearningDate` or `DailyActivity` shows learning today, no daily or streak reminder is sent. |
| Streak first | With a non-zero streak and `streakReminder` on, a streak nudge replaces the generic daily nudge. |
| One per family per day | Daily/streak reminders are keyed by the learner's local date; an incomplete lesson is keyed by lesson + date; a new lesson is keyed by lesson id. |
| Incomplete lesson | Latest `IN_PROGRESS` published lesson last accessed at least 24 hours ago; `incompleteLessonReminder` must be on. |
| New lesson | Newest published lesson from the last 24 hours that has never been announced to this learner; `newLessonAnnouncements` must be on. |
| Daily cap | At most `NOTIFICATIONS_MAX_PER_DAY` reminders per learner per local day, applied after ordering streak → incomplete → announcement. |

Delivery order is streak, incomplete lesson, then new lesson. Reminder copy is
deliberately generic — no name, email, score or account detail — so a lock-screen
preview never reveals personal information. Lesson titles are truncated to 80
characters in the body.

### Delivery ledger

Every successful reminder writes a `notification_deliveries` row containing the
learner, type, dedupe key, local date, copy and device count. The unique key
`(userId, type, dedupeKey)` makes repeat ticks and restarts idempotent. A
reminder that reaches no device is not recorded and will be retried on the next
tick. Tokens that FCM reports as unregistered/invalid are deactivated
immediately.

---

## 7. `POST /api/v1/analytics/events`

The learner id always comes from the access token, never from the payload, so an
account cannot write events for another learner. Returns `202`:

```json
{ "accepted": 2 }
```

### Request

```json
{
  "events": [
    {
      "name": "lesson_opened",
      "properties": { "lessonId": "clx_lesson_1", "source": "home" },
      "platform": "ANDROID",
      "appVersion": "1.0.0",
      "sessionId": "session-abc"
    },
    {
      "name": "quiz_submitted",
      "properties": { "quizId": "clx_quiz_1", "scorePercent": 80 }
    }
  ]
}
```

| Field | Rules |
| --- | --- |
| `events` | Array of 1–50 events. |
| `name` | Lowercase `snake_case`, 3–64 characters, starts with a letter (`^[a-z][a-z0-9_]{2,63}$`). |
| `properties` | Optional JSON object. Personal and credential fields are removed; see below. |
| `platform` | Optional `ANDROID` (default) or `WEB`. |
| `appVersion` | Optional string, up to 32 characters. |
| `sessionId` | Optional string, up to 64 characters. |

### Privacy and size guards

Analytics must never carry personal data. As a safety net the server:

- drops keys whose normalised name contains `email`, `password`, `token`,
  `authorization`, `phone`, `mobile`, `address`, `birth`, `aadhaar`, `aadhar`
  or `secret`, at any depth;
- drops whole-word identifiers `pan`, `dob`, `otp`, `pin` and `ssn` (so
  `panNumber` is removed but `companyName` and `expanded` survive);
- truncates strings to 500 characters;
- keeps at most 20 array items;
- keeps at most three levels of nesting;
- rejects properties larger than **4 KB** after sanitisation with
  `400 VALIDATION_ERROR`.

Clients should still send only product identifiers and enum-like values. The
sanitiser is a backstop, not permission to send PII.

### Admin visibility

`GET /api/v1/admin/analytics/overview?days=30` (roles `SUPER_ADMIN` and
`ANALYST`) now includes:

```json
{
  "productEvents": {
    "total": 1240,
    "top": [
      { "name": "lesson_opened", "count": 620 },
      { "name": "quiz_submitted", "count": 310 }
    ]
  }
}
```

`total` counts every ingested event in the selected window and `top` contains
the five most frequent names, sorted in descending order.

---

## 8. Errors

| Status | Code | When |
| --- | --- | --- |
| `400` | `VALIDATION_ERROR` | Bad reminder time, malformed token, invalid/oversized event, malformed batch. |
| `401` | `UNAUTHENTICATED` | Missing or expired learner access token. |
| `404` | `USER_NOT_FOUND` | The learner account no longer exists. |
| `404` | `DEVICE_NOT_FOUND` | Device id is unknown or belongs to another learner. |
| `422` | `DEVICE_LIMIT_REACHED` | More than 10 active devices. |
| `429` | `RATE_LIMITED` | Per-route throttle exceeded. |
| `503` | `NOTIFICATIONS_NOT_CONFIGURED` | FCM delivery was attempted without usable credentials. Boot validation normally prevents this. |

---

## 9. Limitations

- Reminder delivery is **at-least-once** under concurrent scheduler instances:
  messages are sent before the ledger row is inserted, and the unique key only
  suppresses the duplicate ledger write. Run a single scheduler process.
- Analytics ingestion does not deduplicate events. A client retry after a
  timeout may store the same event twice; clients should use `sessionId` and
  `properties` to tolerate this.
- There is no learner-facing notification history and no per-type quiet hours
  beyond the single local reminder time.
- The scheduler scans in batches of 100 users and sends one request per token;
  FCM multicast is a future optimisation.
- Removing a device deletes the row, so a later re-registration starts fresh.
