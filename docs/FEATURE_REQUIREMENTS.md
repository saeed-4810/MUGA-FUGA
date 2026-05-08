# Feature Requirements

This file maps the assignment requirements to the application implementation. It is a practical checklist for reviewers and contributors working inside `code/`.

## Functional requirements

| Requirement            | Implementation expectation                                                                                                                                 | Main areas                                                           |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Create a product       | Authenticated users can create products with name, artist, and cover art. Customer products start as `pending`; admin-created products can be `published`. | Backend product routes, frontend create flow, Storage signed upload. |
| Read products          | List view shows cover thumbnail, product name, artist, and status where relevant. Customers see published products; admins can see all statuses.           | `/products`, product API, Firestore status queries.                  |
| Update/delete products | Owner/admin update and delete rules are enforced by the backend. Admin can moderate state.                                                                 | PATCH/DELETE product contracts, role middleware, UI actions.         |
| Admin approval         | Admin approves or rejects pending products before they are visible in the public/customer catalog.                                                         | `/products/:id/approve`, `/products/:id/reject`, admin queue.        |
| Artist selection       | Products reference a published artist. Customers can request missing artists; admins moderate them.                                                        | Artist API, artist combobox, artist admin queue.                     |
| Cover art upload       | Browser uploads image bytes directly to Storage using a short-lived signed URL minted by the backend.                                                      | Signed upload endpoint, bucket CORS, Storage rules.                  |

## Non-functional requirements

| Requirement          | Project answer                                                                                                                                |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend              | Node.js 20, Express 4, TypeScript strict ESM, Zod validation, Pino logs, OpenAPI output.                                                      |
| Frontend             | Next.js App Router SSR, React 18, TypeScript strict, Tailwind CSS.                                                                            |
| Hosting              | Firebase Hosting CDN in front of Cloud Run services for staging and production.                                                               |
| Auth                 | Firebase Auth Google provider, backend Admin SDK verification, SSR `__session` cookie.                                                        |
| Roles                | `admin` and `customer` via Firebase custom claims.                                                                                            |
| Image storage        | Firebase Storage bucket with signed upload flow and CDN-backed delivery.                                                                      |
| Internationalization | EN and NL translation catalogs; locale switcher persists user choice.                                                                         |
| Theming              | Light, dark, and system-aware theme with persisted user choice.                                                                               |
| Dashboard            | Sidebar/topbar layout, product grid, admin queues, status badges, dialogs, and responsive states.                                             |
| CI/CD                | GitHub Actions for install, lint, typecheck, tests, build, Docker, previews, staging deploys, production tags.                                |
| Monitoring           | Live Sentry browser/Node projects, Firebase Performance/web-vitals, structured Cloud Logging, uptime checks, and Cloud Monitoring dashboards. |
| Alerting             | Cloud Monitoring and Sentry alerts route to Slack for notify-level signals and to Slack + PagerDuty for production pages.                     |
| Documentation        | README, OpenAPI, ADRs, runbooks, UX flows, QA matrix, and these app-level docs.                                                               |

## Product states

| State       | Meaning                                          | Who sees it           |
| ----------- | ------------------------------------------------ | --------------------- |
| `pending`   | Submitted and waiting for admin review.          | Owner and admins.     |
| `published` | Approved and visible in normal catalog views.    | Customers and admins. |
| `rejected`  | Reviewed and rejected, optionally with a reason. | Owner and admins.     |

## Role expectations

| Capability             | Customer                                      | Admin                     |
| ---------------------- | --------------------------------------------- | ------------------------- |
| Sign in with Google    | Yes                                           | Yes                       |
| Create product         | Yes, starts pending                           | Yes                       |
| Browse catalog         | Published products                            | All products with filters |
| Update/delete product  | Own allowed records, subject to backend rules | All records               |
| Approve/reject product | No                                            | Yes                       |
| Request artist         | Yes                                           | Yes                       |
| Approve/reject artist  | No                                            | Yes                       |

## Related implementation docs

- API contract rows: [`./api/api-spec.md`](./api/api-spec.md)
- Product scenarios: [`./product/scenario-catalog-product.md`](./product/scenario-catalog-product.md)
- RBAC matrix: [`./product/rbac-matrix.md`](./product/rbac-matrix.md)
- UX flows: [`./ux/flows.md`](./ux/flows.md)
- Coverage matrix: [`./qa/coverage-matrix.md`](./qa/coverage-matrix.md)

## Operations coverage

The deployed app is monitored from both the platform side and the application side.

- Backend requests are logged as structured JSON with request id, route, status, and safe user context.
- `/api/health` checks whether the backend process is alive; `/api/healthz/ready` also checks Firestore readiness.
- Cloud Monitoring watches frontend uptime, backend uptime, readiness, Cloud Run latency, and 5xx ratio.
- Log-based metrics track auth failures, upload validation failures, admin moderation actions, and admin overrides.
- Sentry groups browser and backend exceptions by environment and release. The frontend also reports web-vitals as Sentry breadcrumbs.
- Slack receives operational notifications. PagerDuty is reserved for production incidents that need immediate action.
