# MUGA — Music Product Management System


> **Stack**: Node.js + Express + Firebase Admin · Next.js App Router SSR + React + Tailwind · Firestore · Firebase Auth · Cloud Run · Firebase Hosting · GitHub Actions.

MUGA is a small product management system for a music catalog. A customer signs in with Google, creates a release, selects or requests an artist, uploads cover art, and submits the product for review. An admin then approves or rejects the product before it appears in the catalog.

The repo is meant to be reviewed as a working full-stack slice: API contracts, SSR auth, signed uploads, Firestore data, Firebase hosting, CI/CD, monitoring, i18n, theming, and tests are all wired together rather than described as future work.

---

## How to review this project

If you only have a few minutes, start here:

1. Read this README for the product story, architecture, and local commands.
2. Open [Requirement coverage](./docs/FEATURE_REQUIREMENTS.md) to see how the assignment maps to the implementation.
3. Open [Architecture](./docs/ARCHITECTURE.md) for the browser → Firebase Hosting → Cloud Run → Firebase services flow.
4. Open [Auth and RBAC](./docs/AUTH_AND_RBAC.md) and the [RBAC matrix](./docs/product/rbac-matrix.md) to understand the customer/admin split.
5. Open [API contracts](./docs/api/api-spec.md) and [Database schema](./docs/api/database-schema.md) for the backend shape.
6. Open [Test scenarios](./docs/TEST_SCENARIOS.md) and [QA coverage matrix](./docs/qa/coverage-matrix.md) for the coverage story.

The complete docs index is at [docs/README.md](./docs/README.md).

---

## Product story

MUGA has two human actors:

- **Customer** — signs in, creates products, uploads cover art, requests missing artists, and sees published catalog items plus their own submissions.
- **Admin** — reviews products and artist requests, sees all statuses, and approves or rejects records before they become public.

The platform services are also part of the story:

- **Firebase Auth** identifies users through Google login.
- **Express on Cloud Run** verifies tokens, enforces role rules, validates requests, writes Firestore records, and signs upload URLs.
- **Next.js on Cloud Run** renders the dashboard and protects SSR routes with a Firebase session cookie.
- **Firebase Storage + Hosting CDN** handle cover-art delivery.
- **Sentry and Cloud Monitoring** provide error, performance, and alerting signals.

The core workflow is:

```text
Customer signs in
  → selects or requests an artist
  → uploads cover art through a signed Storage URL
  → submits a product as pending
  → admin reviews it
  → approved products appear in the catalog
```

Role details are documented in [Auth and RBAC](./docs/AUTH_AND_RBAC.md) and [RBAC matrix](./docs/product/rbac-matrix.md).

---

## Live environments

| Environment | App                             | Swagger UI                               | OpenAPI JSON                                     |
| ----------- | ------------------------------- | ---------------------------------------- | ------------------------------------------------ |
| Staging     | https://muga-staging.web.app    | https://muga-staging.web.app/api/docs    | https://muga-staging.web.app/api/openapi.json    |
| Production  | https://muga-production.web.app | https://muga-production.web.app/api/docs | https://muga-production.web.app/api/openapi.json |

Staging follows `main`; production is released from SemVer tags.

---

## Functional scope

- **Create a Product** — name, artist, cover art, and approval status.
- **Read products** — list view with cover-art thumbnail, name, artist, and status where relevant.
- **Update / Delete** — full CRUD.
- **Admin approval** — admin role confirms creation before a product becomes visible.
- **Artist requests** — customers can request missing artists; admins moderate them.

## Non-functional scope

| Requirement          | Specification                                                                                |
| -------------------- | -------------------------------------------------------------------------------------------- |
| Backend              | Node.js 20, Express 4, TypeScript strict ESM, Zod, Pino, OpenAPI 3.1                         |
| Frontend             | Next.js App Router SSR, React 18, TypeScript strict, Tailwind 3                              |
| Auth                 | Firebase Auth (Google provider), Firebase Admin token verification, `__session` SSR cookie   |
| Roles                | Admin, Customer (admin approves product creation via custom claims)                          |
| Image storage        | Signed-URL direct-to-Storage upload + Firebase Hosting CDN                                   |
| Hosting              | Firebase Hosting CDN + Cloud Run (`muga-frontend`, `muga-backend`), **staging + production** |
| Internationalization | EN (baseline) + NL (architecture supports more)                                              |
| Theming              | Light / dark / system with persisted user choice                                             |
| CI/CD                | GitHub Actions — staging on `main` push, production on SemVer tag                            |
| Monitoring           | Sentry (browser + Node), Firebase Performance, web-vitals                                    |
| Profiling            | web-vitals reporting                                                                         |
| Alerting             | Sentry + Cloud Monitoring policies-as-code → Slack + PagerDuty                               |
| Tests                | Vitest (100% line + branch + function + statement coverage enforced)                         |

---

## Quick start

```bash
pnpm install
cp apps/backend/env.example apps/backend/.env
cp apps/frontend/env.example apps/frontend/.env.local
# fill env files (Firebase projects + Sentry DSNs)

pnpm dev               # frontend (5173) + backend (3001)
pnpm test:ci           # all workspaces, with 100% coverage threshold
pnpm --filter @muga/frontend e2e
pnpm build
```

Run Firebase emulators to develop end-to-end without touching cloud:

```bash
pnpm emulators
```

Build containers locally:

```bash
docker build -f apps/backend/Dockerfile -t muga-backend .
docker build -f apps/frontend/Dockerfile -t muga-frontend .
```

---

## Documentation

The docs are written to be read from inside this repo; they do not depend on a separate project-management folder.

- [Application docs](./docs/README.md) — reading order for the docs in this repo
- [Requirement coverage](./docs/FEATURE_REQUIREMENTS.md) — assignment requirements mapped to implementation areas
- [Architecture](./docs/ARCHITECTURE.md) — how the frontend, backend, Firebase, and Cloud Run pieces fit
- [Auth and RBAC](./docs/AUTH_AND_RBAC.md) — Google sign-in, custom claims, and admin/customer rules
- [RBAC matrix](./docs/product/rbac-matrix.md) — what each actor can do
- [User flows](./docs/USER_FLOWS.md) — customer and admin journeys
- [API contracts](./docs/api/api-spec.md) — REST endpoints and error conventions
- [Database schema](./docs/api/database-schema.md) — Firestore collections, indexes, and rules summary
- [Deployment and infrastructure](./docs/FIREBASE_INFRA.md) — Firebase, Cloud Run, Hosting, monitoring, and environments
- [Storage and buckets](./docs/STORAGE_AND_BUCKETS.md) — cover-art buckets, signed uploads, and CORS
- [CI/CD](./docs/CI_CD.md) — checks, previews, staging deploys, and production tags
- [Test scenarios](./docs/TEST_SCENARIOS.md) and [QA coverage matrix](./docs/qa/coverage-matrix.md)
- [ADR index](./docs/adr/README.md) — short notes on the main technical decisions

---

## Structure

```
code/
├── apps/
│   ├── backend/           Express + Firebase Admin (Cloud Run target)
│   │   ├── src/
│   │   │   ├── config/    env, openapi, sentry
│   │   │   ├── domain/    auth, errors, product (Zod schemas)
│   │   │   ├── lib/       alerting, firebase (Admin SDK init)
│   │   │   ├── middleware/auth, error, requestId
│   │   │   ├── routes/    health, me, products, docs
│   │   │   ├── types/     express.d.ts (Request augmentation)
│   │   │   ├── app.ts     buildApp()
│   │   │   └── index.ts   server bind
│   │   ├── tests/         vitest + supertest
│   │   └── Dockerfile
│   └── frontend/          Next.js App Router SSR + React + Tailwind (Cloud Run target)
│       ├── app/           route groups, layouts, session route handler
│       ├── src/           components, contexts, lib, i18n, styles
│       ├── e2e/           Playwright specs
│       └── public/locales/{en,nl}/ i18n catalogs
├── .github/
│   ├── workflows/         ci.yml, deploy-staging.yml, deploy-production.yml
│   ├── monitoring/        alert-*.yaml, log-based-metrics.yaml
│   ├── CODEOWNERS
│   └── PULL_REQUEST_TEMPLATE.md
├── .husky/                pre-commit, commit-msg, pre-push hooks
├── firebase.json          Hosting (multi-target) + Firestore + Storage config
├── firestore.rules
├── firestore.indexes.json
├── storage.rules
├── CONTRIBUTING.md        branching, commit conventions, review gates
├── GIT_WORKFLOW.md        full workflow reference
└── README.md              (this file)
```

---

## Stack

- **Runtime**: Node 20, pnpm 9 workspaces, TypeScript 5 strict ESM
- **Backend**: Express 4, Firebase Admin 12, Zod, Pino, Sentry, Helmet, CORS, swagger-ui-express
- **Frontend**: Next.js App Router SSR, React 18, Tailwind 3, react-i18next 15, Firebase Web SDK 10, Firebase Admin SSR helpers
- **Tests**: Vitest 1.6 (unit + integration), Supertest, Playwright 1.x (E2E), Testing Library
- **Tooling**: Husky + lint-staged + commitlint + ESLint 9 + Prettier 3 + TypeScript 5

---

## Architecture

### Auth

Firebase Auth Google provider. Backend verifies the bearer ID token via Firebase Admin and attaches `req.user = { uid, email, role, emailVerified }`. Role is a Firebase Auth custom claim (`admin` or `customer`), set on first sign-in by `POST /me/bootstrap` based on an allow-list env var. The Next.js frontend also exposes `/session` Route Handlers that exchange a Firebase ID token for the `__session` HttpOnly cookie used by server-rendered route guards.

### Product lifecycle

Products default to `pending` for customers and can be created as `published` by admins. Admins see all products with a `?status` filter; customers see published products and their own relevant submissions. Admins approve via `POST /products/:id/approve` or reject via `POST /products/:id/reject` with an optional reason. Every admin action emits a structured `alert.kind=admin_action` log for audit visibility.

### Image upload (signed URL, two-step)

```
Browser                     Backend                       Storage
   │── POST /signed-upload ──▶│                              │
   │                          │── mint signed URL (5 min) ──▶│
   │◀── { uploadUrl, path } ──│                              │
   │───────── PUT coverArt ─────────────────────────────────▶│
   │── POST /products ──▶│                                   │
```

Image bytes never touch the Express server → no payload/memory pressure, validation happens at IAM level on Storage.

### Alerting

Every backend alert is a Pino log line with `alert.kind` + `alert.severity` fields. Cloud Monitoring log-based metrics match on `alert.kind`; alert policies are defined as YAML in `.github/monitoring/`. See the OpenAPI spec at `/api/docs` after deploy and the [alerting runbook](./docs/api/alerting-runbook.md) for the operational notes.

### Deployment

- **Staging** — every merge to `main` deploys to `muga-staging` (Cloud Run + Firebase Hosting) via `.github/workflows/deploy-staging.yml`.
- **Production** — SemVer tag `vX.Y.Z` pushed on `main` triggers `.github/workflows/deploy-production.yml`.
- Staging failures notify Slack; production page-level incidents route to Slack + PagerDuty.

| Target     | Frontend                                     | Backend                                |
| ---------- | -------------------------------------------- | -------------------------------------- |
| Local      | Next.js dev :5173                            | Express dev :3001 + Firebase emulators |
| Staging    | Firebase Hosting → Cloud Run `muga-frontend` | Cloud Run `muga-backend` (staging)     |
| Production | Firebase Hosting → Cloud Run `muga-frontend` | Cloud Run `muga-backend` (production)  |

---

## Contributing

- Branching, commit conventions, review gates → [`CONTRIBUTING.md`](./CONTRIBUTING.md)
- Full git workflow reference → [`GIT_WORKFLOW.md`](./GIT_WORKFLOW.md)

**Branch model**: GitHub Flow. `main` is the integration + staging branch; every merge auto-deploys to staging. Production deploys are SemVer tags on `main`. Feature branches are `<type>/MUGA-xxx-<slug>`.

**Local checks** (Husky `pre-push`, mirrors CI):

```bash
pnpm lint         # ESLint, max-warnings=0
pnpm typecheck    # tsc --noEmit, strict
pnpm test:ci      # vitest, 100% coverage threshold
```

---

## Quality checks

| Gate                 | Enforcement                                                            |
| -------------------- | ---------------------------------------------------------------------- |
| Conventional Commits | Husky `commit-msg` + commitlint                                        |
| Lint / format        | Husky `pre-commit` (lint-staged), CI `lint` job                        |
| TypeScript strict    | Husky `pre-push`, CI `typecheck` job                                   |
| 100% coverage        | Vitest thresholds enforced in `apps/*/vitest.config.ts`; CI `test` job |
| E2E                  | Playwright on `chromium` + `Pixel 7`; post-deploy E2E jobs             |
| Docker build         | CI `docker` job                                                        |
| Code review          | CODEOWNERS-enforced; ≥1 approval required                              |
| Linear history       | Squash merges only; force-push blocked on `main`                       |

Current status: **427 tests pass** across both workspaces with 100% line / branch / function / statement coverage in the pre-push check.

---

## License

Take-home submission — all rights reserved. See `package.json`.
