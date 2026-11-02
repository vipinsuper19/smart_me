# Development Rules

**Applies to:** Android, backend API, admin web panel and infrastructure  
**Purpose:** Keep the MVP maintainable, secure and deliverable within a constrained budget.

## 1. General rules

1. Read the current PRD and relevant architecture/API docs before implementing a task.
2. Implement only the agreed task scope. Do not silently add features.
3. Prefer the smallest maintainable solution that satisfies the acceptance criteria.
4. Do not introduce a new library or service without a clear need.
5. Do not commit secrets, production credentials, private keys or real user data.
6. Keep configuration environment-specific.
7. Use clear names and small, cohesive functions.
8. Avoid speculative abstractions and premature microservices.
9. Update documentation when architecture, API behavior or setup instructions change.
10. Report changed files, commands run, test results, known limitations and next steps at task completion.

## 2. Git and task workflow

For each task:
1. Confirm scope and acceptance criteria.
2. Inspect relevant existing files before editing.
3. Check the current Git status; do not overwrite unrelated user changes.
4. Make the smallest coherent change.
5. Run relevant formatter, lint, type-check and tests.
6. Review the diff for secrets, accidental generated files and unrelated edits.
7. Update documentation and examples.
8. Summarize completion and any remaining risks.

Use short, descriptive branches/commits when Git workflow is in use. Do not claim a task is complete if tests were not run; state what was and was not verified.

## 3. API/backend rules

- Use TypeScript strict mode where supported by the chosen toolchain.
- Keep controllers thin; put business logic in services/use cases.
- Validate all request inputs using DTOs and the project's selected validation library.
- Use a consistent global validation policy.
- Apply authentication and authorization guards explicitly.
- Never trust a client-supplied user ID for ownership decisions.
- Use centralized exception handling and a consistent error response.
- Use database transactions when multiple writes must succeed or fail together.
- Make completion/reward and provider webhook processing idempotent.
- Use pagination for potentially large collections.
- Avoid N+1 query patterns.
- Add indexes based on actual query patterns.
- Do not return password hashes, private tokens, internal billing secrets or unnecessary personal data.
- Do not expose stack traces or internal exception messages in production responses.
- Add unit tests for business rules and integration tests for important database/API flows.

## 4. Database and Prisma rules

- PostgreSQL is the authoritative database.
- Prisma schema and migrations must be version-controlled.
- Use migrations for schema changes; do not make untracked production schema edits.
- Never use destructive reset commands against a shared or production database.
- Do not use destructive migration strategies to hide data-model problems.
- Review generated migration SQL before applying it to a shared environment.
- Use explicit relations, deletion behavior, uniqueness constraints and indexes.
- Use database transactions for multi-step consistency requirements.
- Use decimal or integer minor units for monetary amounts; never use floating-point arithmetic for money.
- Store timestamps consistently and apply the user's configured time zone for local-day calculations.
- Use JSON fields only for intentionally flexible, versioned payloads; validate their shape at application boundaries.
- Use enums for genuinely closed sets of states; avoid enums for user-editable categories.
- Keep XP as integer values and record changes in an auditable ledger.
- Store provider identifiers and purchase state carefully; do not treat client assertions as authoritative.
- Confirm exact syntax and generated-client patterns against the installed Prisma version before implementation.

## 5. Android rules

- Use Kotlin and Jetpack Compose with Material 3.
- Follow unidirectional data flow: UI events go to a ViewModel; UI renders state.
- Use immutable UI state models where practical.
- Keep network and database work off the main thread.
- Use repositories to isolate data sources; avoid direct DAO writes from composables.
- Keep composables focused on rendering and UI events.
- Use lifecycle-aware collection for Flow in UI.
- Model loading, success, empty and error states explicitly.
- Avoid hardcoding course/lesson content in composables.
- Keep API DTOs separate from UI models when transformation or long-term maintenance warrants it.
- Use Room only for useful local persistence; do not mirror the entire server database without a requirement.
- Store secrets/tokens only with an appropriate secure approach; do not store them in plain preferences.
- Ensure screen-reader labels, scalable text and adequate contrast.
- Do not run long operations or blocking work on the main thread.
- Add unit tests for ViewModels/use cases and tests for important repository behavior.
- Test on representative low- and mid-range Android devices.

## 6. Admin web rules

- Enforce permissions in the backend; hiding a button is not authorization.
- Use typed API models and validated forms.
- Show loading, success, empty and error states.
- Require confirmation for destructive actions and publication changes where appropriate.
- Provide preview before publishing lessons.
- Prevent accidental loss of unsaved editor content where practical.
- Record important administrative actions in audit logs.
- Never render untrusted HTML without safe sanitization.

## 7. Content and media rules

- Published lessons must pass editorial review.
- Use only assets the business has rights to use.
- Store media in object storage; store metadata and references in the database.
- Optimize image and video size for mobile networks.
- Do not automatically download large media without appropriate user intent/settings.
- Validate content-block payloads against a versioned schema.
- Preserve content ordering and translation consistency.
- Never let AI-generated content publish automatically without the agreed review workflow.

## 8. Gamification rules

- The server calculates XP and streaks.
- Every reward must have a reason/source and a duplicate-prevention strategy.
- Repeated requests must not award duplicate completion XP.
- Streaks are based on meaningful eligible learning activity, not app opens.
- Users cannot set their own XP, score, achievement or premium status.
- Corrections should be auditable.

## 9. Subscription and billing rules

- Verify digital purchases server-side using the current provider process.
- Do not rely only on a client success callback.
- Handle duplicate and out-of-order provider notifications safely.
- Keep entitlement state separate from UI display state.
- Do not log raw purchase tokens or secrets.
- Test pending, successful, canceled, refunded, expired and restored purchase cases that apply to the integration.
- Clearly disclose price, renewal interval and cancellation information.

## 10. Privacy and security rules

- Collect only data needed for product functionality.
- Use HTTPS outside local development.
- Keep secrets out of Git and client bundles.
- Apply least-privilege access.
- Redact sensitive fields in logs.
- Rate-limit sensitive endpoints.
- Implement account deletion and documented retention behavior.
- Review third-party SDK data collection before release.
- Never use real production personal data in test fixtures.
- Keep dependencies updated and review high-severity advisories.

## 11. Testing rules

A task is not considered verified until relevant checks are run or the limitation is explicitly documented.

Backend checks, as applicable:
- Format/lint
- Type-check/build
- Unit tests
- Integration tests
- API contract checks

Android checks, as applicable:
- Gradle build
- Unit tests
- Compose/UI tests for critical flows
- Manual verification on representative devices

Admin checks, as applicable:
- Lint/type-check/build
- Form validation tests
- Authorization checks
- Critical workflow tests

## 12. Definition of Done

A task is done when:
- Acceptance criteria are met.
- Changes are limited to task scope.
- Relevant tests/builds have passed, or failures are clearly documented.
- No known secrets were added.
- Errors and empty states are handled for affected flows.
- Documentation is updated when necessary.
- The final report lists changed files, validation performed and known limitations.
