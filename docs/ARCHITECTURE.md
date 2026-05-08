# Application Architecture

MUGA is a small product-management system for music releases. The architecture is deliberately split into three concerns: a typed REST backend, a server-rendered dashboard frontend, and Firebase-managed identity, data, hosting, and storage services.

## System at a glance

```
Browser
  │
  │  Firebase Auth Google sign-in
  ▼
Firebase Hosting CDN
  ├── /api/**          → Cloud Run: muga-backend  (Express REST API)
  ├── /_next/static/** → CDN/static assets
  └── app routes       → Cloud Run: muga-frontend (Next.js App Router SSR)

muga-backend
  ├── verifies Firebase ID tokens
  ├── enforces admin/customer RBAC
  ├── validates request bodies with Zod
  ├── writes Firestore through Firebase Admin SDK
  ├── issues signed upload URLs for Storage
  └── emits structured logs, Sentry events, and alert fields

muga-frontend
  ├── renders App Router pages
  ├── manages browser Firebase Auth state
  ├── exchanges ID tokens for __session cookies
  ├── guards SSR routes by verified session
  └── owns i18n, theme, dashboard UI, and E2E flows

Firebase / GCP
  ├── Firebase Auth: Google provider + custom role claims
  ├── Firestore: products, artists, approval status, audit fields
  ├── Storage: cover-art and artist-image objects
  ├── Cloud Run: backend and frontend containers
  ├── Secret Manager: runtime secrets and config
  └── Cloud Monitoring: uptime, log-based metrics, and alert policies
```

## Why this split

The assignment asks for a full-stack system with Firebase hosting, Google auth, admin approval, CDN-backed images, i18n, theming, CI/CD, monitoring, and tests. Keeping the Express API and Next.js SSR frontend as separate Cloud Run services gives each side a clear boundary:

- Backend owns contracts, authorization, validation, Firestore writes, upload URL minting, and operational logs.
- Frontend owns route rendering, dashboard interaction, locale/theme behavior, user flows, and Playwright coverage.
- Firebase owns the managed platform pieces: identity, hosting entrypoint, Firestore, Storage, and CDN delivery.

This also keeps rollback simple. If the SSR frontend has a deployment issue, the REST API and Firestore data model remain untouched.

## Backend layout

Backend code lives in [`../apps/backend`](../apps/backend).

Key areas:

| Area              | Responsibility                                  |
| ----------------- | ----------------------------------------------- |
| `src/app.ts`      | Express app construction.                       |
| `src/index.ts`    | Runtime server bind for Cloud Run/local dev.    |
| `src/config/`     | Environment, OpenAPI, Sentry setup.             |
| `src/domain/`     | Zod schemas, domain objects, typed errors.      |
| `src/middleware/` | Auth, role checks, request IDs, error handling. |
| `src/routes/`     | Health, auth, products, artists, OpenAPI docs.  |
| `src/lib/`        | Firebase Admin, alerting, integration helpers.  |
| `tests/`          | Vitest + Supertest coverage for API contracts.  |

The backend never trusts the browser for role decisions. It verifies the Firebase ID token on every protected request and reads the `role` custom claim from the decoded token.

## Frontend layout

Frontend code lives in [`../apps/frontend`](../apps/frontend).

Key areas:

| Area                      | Responsibility                                                              |
| ------------------------- | --------------------------------------------------------------------------- |
| `app/`                    | Next.js App Router layouts, route groups, and route handlers.               |
| `app/session/route.ts`    | Exchanges Firebase ID tokens for `__session` cookies and clears sessions.   |
| `src/components/`         | Shared UI primitives and layout components.                                 |
| `src/features/`           | Feature-specific components and hooks.                                      |
| `src/lib/`                | API client, Firebase browser helpers, server helpers, analytics/monitoring. |
| `public/locales/{en,nl}/` | Translation catalogs.                                                       |
| `e2e/`                    | Playwright flows.                                                           |

The frontend uses Client Components where browser-only APIs are required: Firebase popup sign-in, local storage for theme/locale, upload progress, dialogs, crop controls, and user menu actions. Server-rendered routes use the `__session` cookie and server helpers.

## Data model in plain language

The domain has two main publishable resources:

- **Artist** — created by admins or requested by customers. Customer-created artists start as `pending`; admins publish or reject them.
- **Product** — album, single, or EP metadata with cover art. Products reference an artist by `artistId`; customer-created products start as `pending`; admins publish or reject them.

Both resources carry ownership and status fields so the list endpoints can enforce the visibility rule: customers see published records plus their own pending/rejected work where the flow requires it; admins see all records.

## Request boundaries

| Boundary                        | Auth material                               | Notes                                                                |
| ------------------------------- | ------------------------------------------- | -------------------------------------------------------------------- |
| Browser → Express API           | `Authorization: Bearer <Firebase ID token>` | Used for product, artist, upload, and `/me` calls.                   |
| Browser → Next.js session route | Firebase ID token in request body           | Route handler sets or clears the `__session` cookie.                 |
| Next.js SSR → route guard       | `__session` HttpOnly cookie                 | Verified with Firebase Admin before rendering protected/admin pages. |
| Browser → Storage               | Short-lived signed `PUT` URL                | Used only after backend validates content type and file size.        |

## Operational choices

- **Two Firebase projects**: `muga-staging` and `muga-production`, not one project with environment flags.
- **Cloud Run for both app services**: Docker gives a reproducible runtime and keeps Next.js SSR deployable behind Firebase Hosting.
- **Signed uploads**: image bytes never pass through Express.
- **Secret Manager**: no long-lived GCP keys in GitHub; workflows use Workload Identity Federation.
- **100% changed-file coverage**: unit/integration tests stay close to code; Playwright handles browser-only and SSR behaviours.
- **Observable by default**: the backend writes structured request logs, Sentry captures backend and browser errors by release, web-vitals are recorded from the client runtime, and Cloud Monitoring watches health, readiness, latency, error ratio, and selected business-risk signals.

## Observability flow

The observability path mirrors the runtime architecture:

1. A browser request enters through Firebase Hosting and reaches either the Next.js frontend service or the Express backend service.
2. The backend attaches or echoes an `x-request-id`, writes a Pino JSON request log, and includes safe user context when the request is authenticated.
3. Errors and explicit operational signals are sent to Sentry with `environment`, `release`, `alert_kind`, and `alert_severity` tags.
4. Cloud Logging stores the JSON logs. Cloud Monitoring turns selected log fields into metrics and combines them with Cloud Run metrics and uptime checks.
5. Slack receives staging and production notifications. PagerDuty receives production page-level incidents.

This gives a reviewer three ways to investigate a problem: the API response id, the structured backend log, and the matching Sentry issue or Cloud Monitoring incident.

## More detail

- Architecture decisions: [`ADRS.md`](./ADRS.md)
- API contracts: [`./api/api-spec.md`](./api/api-spec.md)
- Firestore schema: [`./api/database-schema.md`](./api/database-schema.md)
- Infrastructure commands: [`INFRA_SETUP.md`](./INFRA_SETUP.md)
- Secrets: [`SECRETS.md`](./SECRETS.md)
