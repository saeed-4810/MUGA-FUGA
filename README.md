# MUGA — Music Product Management System

> Take-home submission — Senior Full-Stack Engineer (frontend-leaning).
> **Stack**: Node.js + Express + Firebase Admin · React + Vite + Tailwind · Firestore · Firebase Auth · Cloud Run · Firebase Hosting · GitHub Actions.

A simple product management system for a music-centric environment. Artists and labels can create albums / singles / EPs with cover art; an admin approves them before they go live.

---

## Functional scope

- **Create a Product** — name, artist name, cover art (image upload).
- **Read products** — list view with cover-art thumbnail, name, artist name.
- **Update / Delete** — full CRUD.
- **Admin approval** — admin role confirms creation before a product becomes visible.

## Non-functional scope

| Requirement          | Specification                                                               |
| -------------------- | --------------------------------------------------------------------------- |
| Backend              | Node.js 20, Express 4, TypeScript strict ESM, Zod, Pino, OpenAPI 3.1        |
| Frontend             | React 18, Vite 5, TypeScript strict, Tailwind 3, react-router 6             |
| Auth                 | Firebase Auth (Google provider) + Firebase Admin token verification         |
| Roles                | Admin, Customer (admin approves product creation via custom claims)         |
| Image storage        | Signed-URL direct-to-Storage upload + Firebase Hosting CDN                  |
| Hosting              | Firebase Hosting (frontend) + Cloud Run (backend), **staging + production** |
| Internationalization | EN (baseline) + NL (architecture supports more)                             |
| Theming              | Light / dark / system with persisted user choice                            |
| CI/CD                | GitHub Actions — staging on `main` push, production on SemVer tag           |
| Monitoring           | Sentry (browser + Node), Firebase Performance, web-vitals                   |
| Profiling            | Lighthouse CI on PR                                                         |
| Alerting             | Sentry + Cloud Monitoring policies-as-code → Slack + PagerDuty              |
| Tests                | Vitest (100% line + branch + function + statement coverage enforced)        |

---

## Quick start

```bash
pnpm install
cp apps/backend/env.example apps/backend/.env
cp apps/frontend/env.example apps/frontend/.env
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

Build the backend container locally:

```bash
docker build -f apps/backend/Dockerfile -t muga-backend .
```

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
│   └── frontend/          React + Vite + Tailwind (Firebase Hosting target)
│       ├── src/
│       ├── e2e/           Playwright specs
│       └── public/locales/{en,nl}/ i18n catalogs
├── .github/
│   ├── workflows/         ci.yml, deploy-staging.yml, deploy-production.yml
│   ├── lighthouse/        lighthouserc.json
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
- **Frontend**: React 18, Vite 5, Tailwind 3, react-router 6, react-i18next 15, Firebase 10
- **Tests**: Vitest 1.6 (unit + integration), Supertest, Playwright 1.x (E2E), Testing Library
- **Tooling**: Husky + lint-staged + commitlint + ESLint 9 + Prettier 3 + TypeScript 5

---

## Architecture

### Auth

Firebase Auth Google provider. Backend verifies the bearer ID token via Firebase Admin and attaches `req.user = { uid, email, role, emailVerified }`. Role is a Firebase Auth custom claim (`admin` or `customer`), set on first sign-in by `POST /me/bootstrap` based on an allow-list env var.

### Product lifecycle

Products default to `pending` for customers, `published` for admins. Admin sees all products with a `?status` filter; customers see only `published`. Admin approves via `POST /products/:id/approve` → `published`; rejects via `POST /products/:id/reject` with optional reason → `rejected`. Every admin action emits a structured `alert.kind=admin_action` log (dashboard-only, no paging).

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

Every backend alert is a Pino log line with `alert.kind` + `alert.severity` fields. Cloud Monitoring log-based metrics match on `alert.kind`; alert policies defined as YAML in `.github/monitoring/`. `page`-severity alerts also hit Slack + PagerDuty synchronously. See the OpenAPI spec at `/api/docs` after deploy, and the alerting runbook in-repo.

### Deployment

- **Staging** — every merge to `main` deploys to `muga-staging` (Cloud Run + Firebase Hosting) via `.github/workflows/deploy-staging.yml`.
- **Production** — SemVer tag `vX.Y.Z` pushed on `main` triggers `.github/workflows/deploy-production.yml`.
- Deploy failure pages the on-call via Slack + PagerDuty (alert A9).

| Target     | Frontend                             | Backend                                |
| ---------- | ------------------------------------ | -------------------------------------- |
| Local      | Vite dev :5173                       | Express dev :3001 + Firebase emulators |
| Staging    | Firebase Hosting (`muga-staging`)    | Cloud Run `muga-backend` (staging)     |
| Production | Firebase Hosting (`muga-production`) | Cloud Run `muga-backend` (production)  |

---

## Contributing

- Branching, commit conventions, review gates → [`CONTRIBUTING.md`](./CONTRIBUTING.md)
- Full git workflow reference → [`GIT_WORKFLOW.md`](./GIT_WORKFLOW.md)

**Branch model**: GitHub Flow. `main` is the integration + staging branch; every merge auto-deploys to staging. Production deploys are SemVer tags on `main`. Feature branches are `<type>/MUGA-xxx-<slug>`.

**Local quality gate** (Husky `pre-push`, mirrors CI):

```bash
pnpm lint         # ESLint, max-warnings=0
pnpm typecheck    # tsc --noEmit, strict
pnpm test:ci      # vitest, 100% coverage threshold
```

---

## Quality gates

| Gate                 | Enforcement                                                            |
| -------------------- | ---------------------------------------------------------------------- |
| Conventional Commits | Husky `commit-msg` + commitlint                                        |
| Lint / format        | Husky `pre-commit` (lint-staged), CI `lint` job                        |
| TypeScript strict    | Husky `pre-push`, CI `typecheck` job                                   |
| 100% coverage        | Vitest thresholds enforced in `apps/*/vitest.config.ts`; CI `test` job |
| E2E                  | Playwright on `chromium` + `Pixel 7`; CI `e2e` job                     |
| Docker build         | CI `docker` job                                                        |
| Lighthouse           | CI `lighthouse` job on PR (a11y ≥ 95 required)                         |
| Code review          | CODEOWNERS-enforced; ≥1 approval required                              |
| Linear history       | Squash merges only; force-push blocked on `main`                       |

Current status (on `main`): **119 tests pass** across both workspaces with 100% line / branch / function / statement coverage.

---

## License

Take-home submission — all rights reserved. See `package.json`.
