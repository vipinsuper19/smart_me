# Admin web panel

The admin panel is a separate Next.js application in `admin/`. It talks only to
the admin API namespace (`/api/v1/admin`) and uses a different authentication
realm from the learner apps.

## Stack

| Concern | Choice |
|---|---|
| Framework | Next.js 16 App Router + React 19 |
| Styling | Tailwind CSS 4 |
| Data fetching | Typed `fetch` wrapper in `src/lib/api.ts` |
| Session storage | `localStorage` with automatic refresh and retry |
| Components | Tailwind primitives in `src/components/ui.tsx` |

No component library is used in the MVP. The panel is intentionally lean and
shares the same visual language as the learner product.

## Running locally

```powershell
# from the repository root
pnpm dev:backend
pnpm dev:admin
```

Open <http://localhost:3000>. The API URL is configured through
`NEXT_PUBLIC_API_URL` in `admin/.env.local` and defaults to
`http://localhost:3001/api/v1`.

Seeded development credentials:

| Role | Email | Password |
|---|---|---|
| Super admin | `admin@smartme.local` | `Admin@12345` |

## Authentication and sessions

- Login calls `POST /admin/auth/login`; the response contains the admin profile
  and an access/refresh token pair.
- A valid session is stored under `smartme.admin.session` in `localStorage`.
- Requests send `Authorization: Bearer <accessToken>`. On `401`, the client
  rotates the refresh token once and retries. A failed refresh clears the local
  session and redirects to `/login`.
- Access tokens use their own `admin_access` payload type. Learner tokens are
  rejected by every admin route.
- The protected `(panel)` route group renders the shell and redirects
  unauthenticated visitors to `/login?next=…`.

## Roles in the UI

The UI reflects the server-enforced RBAC matrix:

| Capability | `SUPER_ADMIN` | `CONTENT_EDITOR` | `ANALYST` |
|---|---|---|---|
| Dashboard, content, media, review, audit | Yes | Yes | Read-only |
| Create/update content, media, quizzes | Yes | Yes | No |
| Submit review, publish | Yes | Yes | No |
| Unpublish, archive, delete catalog content/quizzes | Yes | No | No |
| Users, subscriptions, plans, analytics | Yes | No | Read-only |

Server authorization remains authoritative; hiding a control in the UI is only
a usability measure. Business screens additionally render an access-denied
state for content-only editors.

## Screens

| Route | Purpose |
|---|---|
| `/login` | Admin sign-in |
| `/dashboard` | KPIs, content pipeline, review queue, recent audit and users |
| `/content/learning-paths` | Path list, filters, create/edit, reorder, status actions |
| `/content/learning-paths/[id]` | Path detail with its courses |
| `/content/courses` | Global course list and creation |
| `/content/courses/[id]` | Course detail with modules |
| `/content/modules` | Global module list and creation |
| `/content/modules/[id]` | Module detail with lessons |
| `/content/lessons` | Global lesson list, filters and status actions |
| `/content/lessons/[id]` | Lesson metadata, blocks, translations, quizzes and preview |
| `/content/quizzes/[id]` | Quiz settings, questions, options and versioning |
| `/media` | Media metadata library and referencing lessons |
| `/review` | Combined in-review queue for paths, courses and lessons |
| `/users` | Learner directory with search and status filters |
| `/users/[id]` | Learner profile, progress, attempts, subscriptions and entitlement |
| `/subscriptions` | Subscription list with plan/status filters and plan catalogue |
| `/subscriptions/[id]` | Subscription lifecycle, purchases, billing events and entitlement |
| `/analytics` | Range-based learner activity, completion and quiz metrics |
| `/audit` | Filterable append-only audit log with before/after snapshots |

## Content workflow

1. Create or edit content in `DRAFT`.
2. Submit it for review (`IN_REVIEW`). The review queue shows all waiting items.
3. Publish (`PUBLISHED`). Lesson publish validates that required content exists.
4. Unpublish or archive when retiring content. Content with learner progress or
   quiz attempts must be archived rather than hard-deleted.

Quiz structural edits (questions, options, reorder) require the quiz to be
unpublished and to have no learner attempts. Use **Clone new version** to create
an editable copy; only one version can be published at a time.

Media entries store metadata and URLs only. Binary upload and object storage are
deliberately deferred.

## Verification

The panel is covered by the backend integration suite (`pnpm test`) and the
repository quality gates (`pnpm lint`, `pnpm typecheck`, `pnpm build`). Live
checks use the seeded admin against a running API and database.
