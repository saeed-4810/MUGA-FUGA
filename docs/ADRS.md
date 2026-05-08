# ADR Summary

This is the short version of the architecture decisions. The longer notes live in [`./adr`](./adr/README.md), but this page is enough to understand why the app is shaped the way it is.

## Current decisions

| ADR                                                             | Decision                                                                        | Why it matters in code                                                                                  |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| [ADR-001](./adr/001-tech-stack.md)                              | Node, Express, React, Firebase baseline.                                        | Defines the stack and notes that ADR-008 now owns frontend routing/deploy.                              |
| [ADR-002](./adr/002-two-firebase-projects.md)                   | Separate `muga-staging` and `muga-production` Firebase projects.                | Keeps data, Auth users, Storage objects, secrets, and deploy targets isolated.                          |
| [ADR-003](./adr/003-auth-and-rbac.md)                           | Firebase Auth Google sign-in, Admin SDK token verification, custom role claims. | Drives `/me/bootstrap`, `requireAuth`, `requireRole('admin')`, Firestore rules, and SSR session checks. |
| [ADR-004](./adr/004-image-cdn-and-signed-urls.md)               | Firebase Storage signed uploads plus CDN delivery.                              | Drives signed-upload routes, bucket CORS, and storage prefixes.                                         |
| [ADR-005](./adr/005-backend-deploy-cloud-run.md)                | Backend runs on Cloud Run using Docker.                                         | Explains backend containerization, health checks, IAM, and deploy workflow shape.                       |
| [ADR-006](./adr/006-alerting-strategy.md)                       | Sentry plus Cloud Logging/Monitoring alerts to Slack and PagerDuty.             | Drives structured logs, uptime checks, web-vitals reporting, Sentry rules, and monitoring policy files. |
| [ADR-007](./adr/007-artist-entity-and-customer-request-flow.md) | Artist entity and customer request flow.                                        | Replaces free-text product artist names with `artistId` and adds artist moderation.                     |
| [ADR-008](./adr/008-nextjs-ssr-frontend.md)                     | Next.js App Router SSR on Cloud Run.                                            | Current frontend architecture: route groups, `__session`, SSR guards, and `muga-frontend` deploy.       |

## Decisions that affect daily development

### Auth is token-first, not database-first

Roles are Firebase custom claims. The backend does not read `users/{uid}` on every request to decide if someone is an admin. That keeps hot-path authorization simple and testable, with one important behaviour: after bootstrap changes a claim, the client must refresh the ID token.

### Images upload directly to Storage

The backend validates file metadata and mints a short-lived signed URL. The browser sends bytes to Storage with `PUT`. This avoids memory pressure in Cloud Run and keeps the API focused on contracts and metadata.

### SSR uses the Firebase-reserved `__session` cookie name

Firebase Hosting forwards the `__session` cookie to Cloud Run. Other cookie names are easy to lose through the Hosting rewrite boundary. Protected and admin pages should therefore use the existing session helpers instead of inventing a second session store.

### Environments are physically separate

Staging and production are separate Firebase/GCP projects. Do not add runtime branches like `if (env === 'prod')` where project isolation already solves the problem.

## Adding a new ADR

Add a short note under [`./adr`](./adr/README.md), then update this summary if the decision changes how the app is built, deployed, secured, or tested.
