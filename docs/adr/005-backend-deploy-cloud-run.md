# ADR-005: Backend deploy target

## Context

The backend needs a production-grade host that works with Firebase Hosting, supports Docker, scales to zero, and can run locally in a similar shape.

## Options considered

1. **Cloud Run** — Docker-first, good local parity, integrates with Firebase Hosting rewrites.
2. **Cloud Functions v2** — fast for Firebase projects, but less portable and less predictable for this API.
3. **App Engine** — no clear benefit for this app.

## Decision

Deploy the Express backend as `muga-backend` on Cloud Run in `europe-west1`. Firebase Hosting rewrites `/api/**` to that service. The Dockerfile is multi-stage and the service uses environment-specific secrets from Secret Manager.

## Consequences

- The same container can run locally, in CI, and in production.
- First-time GCP setup is heavier than Functions, so it is documented in [`../INFRA_SETUP.md`](../INFRA_SETUP.md).
- Production can keep a warm minimum instance; staging can scale down more aggressively.

## Rollback

Wrap `buildApp()` with a Firebase Functions v2 `onRequest` handler and change the Hosting rewrite from Cloud Run to Functions.
