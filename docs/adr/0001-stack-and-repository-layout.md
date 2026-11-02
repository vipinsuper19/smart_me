# ADR 0001 — Stack and Repository Layout

- **Status:** Accepted (working baseline)
- **Date:** 2026-10-21
- **Deciders:** Product/engineering

## Context

The PRD specifies an Android app, a NestJS backend and a web admin panel, with PostgreSQL + Prisma and a 10–12 week MVP timeline. We need a layout that keeps shared contracts close, supports independent deploys and does not over-engineer for a small team.

## Decision

Use a single repository with pnpm workspaces for TypeScript apps and a top-level Gradle project for Android:

```
smartme/
├─ backend/         NestJS + TypeScript (REST /api/v1)
├─ admin/           Next.js + TypeScript (web admin)
├─ android/         Kotlin + Jetpack Compose (scaffolded in Task 12)
├─ packages/        Shared TS types/contracts when duplication appears
├─ infra/           Docker Compose, deployment config
├─ docs/            PRD, analysis, ADRs
└─ .github/         CI workflows
```

### Toolchain

| Area | Choice |
|---|---|
| Node | >= 22 LTS |
| Package manager | pnpm 11 workspaces |
| API framework | NestJS 11 |
| Admin framework | Next.js (App Router) + Tailwind CSS |
| Database | PostgreSQL 17 (Docker locally) |
| ORM | Prisma |
| Validation | Zod for env; class-validator/class-transformer for request DTOs |
| Testing | Jest for API unit/integration tests |
| Formatting | Prettier |
| Linting | ESLint 9 flat config + typescript-eslint |
| CI | GitHub Actions |

## Consequences

- One `pnpm install` covers API and admin.
- Android builds remain independent of Node tooling.
- A shared `packages/` folder is reserved but intentionally empty until a real duplication need appears (PRD warns against unnecessary abstractions).
- API and admin can be deployed separately later.

## Alternatives considered

- **Separate repositories** — rejected: too much overhead for MVP, contract drift.
- **Nx/Turborepo** — rejected for now: extra concepts without enough packages to justify them.
- **Single Next.js full-stack app** — rejected: PRD explicitly requires NestJS.
