# Task 1 — Product and Technical Foundation

**Parent PRD:** Indian Microlearning & Personal Development Platform  
**Priority:** P0  
**Status:** Documentation foundation prepared; repository-specific implementation remains pending  
**Estimated duration:** 1–2 weeks, depending on design and environment setup

## Objective

Establish the product's engineering baseline before feature development: architecture, repository organization, coding rules, API conventions, development setup and an agreed Definition of Done.

## Deliverables

- [x] `architecture.md`
- [x] `development-rules.md`
- [x] `api-conventions.md`
- [ ] Root `README.md` with actual setup commands
- [ ] `.gitignore` and `.editorconfig`
- [ ] Architecture Decision Records for material choices
- [ ] Confirmed package names and application identifiers
- [ ] Repository initialized and buildable
- [ ] Local development environment documented
- [ ] CI checks selected and configured

## Decisions already established

- Android: Kotlin + Jetpack Compose + Material 3.
- Backend: NestJS + TypeScript.
- Database: PostgreSQL + Prisma ORM.
- Admin: web-based React/Next.js panel.
- API: versioned REST under `/api/v1`.
- Media: object storage, referenced by backend metadata.
- MVP: English communication, career skills and financial literacy.
- Language strategy: English with Hindi/Hinglish explanations.
- Excluded from MVP: iOS, learner web app, live AI voice, advanced 3D games and social feed.

## Decisions to confirm during repository initialization

- Product/package name and Android application ID.
- Exact Kotlin, Android Gradle Plugin, Gradle, JDK and SDK versions.
- Exact NestJS, Node.js and package manager versions.
- Exact Prisma version and generated-client configuration.
- Admin framework and UI component library.
- Hosting, storage and environment strategy.
- Authentication provider.
- Minimum supported Android version.
- Analytics and crash reporting providers.

Use stable, mutually compatible versions based on current official documentation when the project is initialized. Do not guess versions or copy deprecated setup commands.

## Acceptance criteria

1. The team agrees on the architecture and scope.
2. The repository structure is established without mixing app-specific build tooling.
3. Local setup instructions work on a clean development machine.
4. Android, API and admin can each be built independently.
5. Environment variables and secrets are documented without committing credentials.
6. Formatting, lint/type-check and test commands are documented.
7. API error conventions and versioning are agreed.
8. Database migration and backup safety rules are documented.
9. The first implementation task has explicit acceptance criteria.
10. Any unresolved decision is recorded rather than silently assumed.

## Next implementation task

Initialize the repository and application skeletons, then verify that:
- Android compiles and opens a minimal Compose screen.
- NestJS starts and exposes a health endpoint.
- PostgreSQL connection configuration is available through environment variables.
- Prisma schema/client generation works with the selected installed version.
- Admin web application builds and can reach a placeholder page.
- README instructions reproduce the setup.

Do not implement the full database schema, authentication, courses or quizzes in Task 1. Those belong to subsequent tasks.
