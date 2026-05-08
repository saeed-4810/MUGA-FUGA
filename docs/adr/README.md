# Architecture Decision Records

These notes explain the major technical calls behind MUGA. They are short on purpose: a reviewer should be able to understand the trade-offs without reading an internal process log.

| ID                                                      | Title                                   | Why it matters                                            |
| ------------------------------------------------------- | --------------------------------------- | --------------------------------------------------------- |
| [001](./001-tech-stack.md)                              | Tech stack                              | Sets the backend, frontend, testing, and workspace shape. |
| [002](./002-two-firebase-projects.md)                   | Two Firebase projects                   | Keeps staging and production separate.                    |
| [003](./003-auth-and-rbac.md)                           | Auth and RBAC                           | Defines Google login, custom claims, and role checks.     |
| [004](./004-image-cdn-and-signed-urls.md)               | Image CDN and signed uploads            | Keeps image bytes out of the Express API.                 |
| [005](./005-backend-deploy-cloud-run.md)                | Backend on Cloud Run                    | Explains why the API is Dockerized.                       |
| [006](./006-alerting-strategy.md)                       | Alerting strategy                       | Shows the monitoring/alerting split.                      |
| [007](./007-artist-entity-and-customer-request-flow.md) | Artist entity and customer request flow | Explains why artists became first-class records.          |
| [008](./008-nextjs-ssr-frontend.md)                     | Next.js App Router SSR                  | Explains the current frontend runtime.                    |
