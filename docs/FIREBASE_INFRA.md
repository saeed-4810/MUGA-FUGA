# Firebase and Infrastructure

This document explains the deployed shape. For exact provisioning commands, use [`INFRA_SETUP.md`](./INFRA_SETUP.md).

## Projects

MUGA uses two Firebase/GCP projects:

| Environment | Project           | Purpose                                                                           |
| ----------- | ----------------- | --------------------------------------------------------------------------------- |
| Staging     | `muga-staging`    | Main integration environment, PR preview backend target, post-merge verification. |
| Production  | `muga-production` | Reviewer/user-facing release environment.                                         |

The separation is intentional. Auth users, Firestore data, Storage objects, secrets, hosting channels, and Cloud Run revisions do not share state between staging and production.

## Firebase services

| Service                          | Use                                              |
| -------------------------------- | ------------------------------------------------ |
| Firebase Auth                    | Google sign-in and custom role claims.           |
| Firebase Hosting                 | Public CDN entrypoint and rewrites to Cloud Run. |
| Cloud Firestore                  | Product, artist, status, and audit metadata.     |
| Firebase Storage / Cloud Storage | Cover-art and artist-image objects.              |
| Firebase Performance             | Browser performance telemetry.                   |

## GCP services

| Service           | Use                                                                               |
| ----------------- | --------------------------------------------------------------------------------- |
| Cloud Run         | Runs `muga-backend` and `muga-frontend`.                                          |
| Artifact Registry | Stores Docker images.                                                             |
| Secret Manager    | Stores Sentry DSNs, Slack/PagerDuty values, admin allow-list, and runtime config. |
| IAM               | Runtime service accounts, deploy service accounts, WIF bindings.                  |
| Cloud Monitoring  | Log-based metrics and alert policies.                                             |
| Cloud Logging     | Pino JSON logs and alert fields.                                                  |

## Hosting rewrites

Firebase Hosting is the public edge. It routes traffic by path:

| Path          | Destination                                |
| ------------- | ------------------------------------------ |
| `/api/**`     | Express backend Cloud Run service.         |
| App routes    | Next.js frontend Cloud Run service.        |
| Static assets | Firebase Hosting CDN / Next static output. |

The order matters. `/api/**` must stay ahead of catch-all app rewrites, or API calls will reach the frontend service by mistake.

## Runtime identities

Each environment has separate service accounts:

| Service account                                   | Purpose                                                                                                                        |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `muga-backend@<project>.iam.gserviceaccount.com`  | Runtime identity for backend Cloud Run. Reads/writes Firestore, signs Storage upload URLs, reads secrets, writes logs/metrics. |
| frontend runtime identity                         | Runs the Next.js Cloud Run service and verifies session cookies through Firebase Admin helpers where configured.               |
| `github-deploy@<project>.iam.gserviceaccount.com` | GitHub Actions deployment identity reached through Workload Identity Federation.                                               |

Signed Storage URLs require the backend runtime identity to have permission to sign blobs. The setup scopes that permission to the runtime service account itself instead of granting broad project-wide token creation.

## Firestore

Firestore is the source of truth for product and artist metadata. Writes go through the backend Admin SDK; browser clients do not write business records directly.

Main ideas:

- Product and artist records include status fields.
- Admins can query all statuses.
- Customers are scoped to published records and their own pending/rejected records where needed.
- API responses use deterministic error envelopes.
- Indexes are declared in `firestore.indexes.json`.
- Rules live in `firestore.rules` and act as defense in depth.

## Auth setup

Google sign-in must be enabled in both Firebase projects. Authorized domains include local development and the environment-specific Hosting domains. Staging also allows the `web.app` wildcard for preview channels; production should stay limited to production domains.

## Monitoring, logging, and alerting

The deployed environments have an active observability stack. It is split this way:

- **Cloud Logging** stores JSON request logs from the backend. Each request carries a request id, and authenticated requests also include the user id and role when that is safe to record.
- **Cloud Monitoring** watches uptime, Cloud Run latency, Cloud Run 5xx ratio, and log-based metrics for auth, upload, moderation, and admin override signals.
- **Sentry** receives backend exceptions, browser exceptions, frontend watchdog alerts, release information, and web-vitals breadcrumbs.
- **Firebase Performance and web-vitals** give browser-side performance visibility for LCP, INP, CLS, FCP, and TTFB.
- **Slack and PagerDuty** receive alerts according to severity.

The backend log shape is intentionally simple. Operational alerts use:

| Field                                          | Purpose                                                                                                                |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `jsonPayload.alert.kind`                       | Stable name for the signal, such as `auth_failure`, `upload_validation_fail`, `admin_action`, or `ready_check_failed`. |
| `jsonPayload.alert.severity`                   | `info`, `notify`, or `page`.                                                                                           |
| `jsonPayload.requestId`                        | Correlates API responses, backend logs, and Sentry events.                                                             |
| `jsonPayload.userUid` / `jsonPayload.userRole` | Helps investigate authenticated actions without logging tokens or cookies.                                             |

Staging alerts go to Slack so deploys and drills can be tested safely. Production `notify` alerts go to Slack, while production `page` alerts go to both Slack and PagerDuty. The application does not call PagerDuty directly; Cloud Monitoring and Sentry own the routing. That keeps request handlers focused on logging facts, while the operations tools decide who should be notified.

The policy definitions live in [`../.github/monitoring`](../.github/monitoring). They cover backend health, frontend uptime, readiness, 5xx ratio, latency, auth failure spikes, upload validation spikes, and the log-based audit metrics used for admin moderation.

## Local development

Use `.env` files copied from `env.example` files and keep them out of git. For cloud-backed local development, authenticate with `gcloud` application-default credentials. For offline-friendly work, run Firebase emulators from the `code/` directory.

```bash
pnpm emulators
pnpm dev
```

## References

- Provisioning runbook: [`INFRA_SETUP.md`](./INFRA_SETUP.md)
- Secrets/config: [`SECRETS.md`](./SECRETS.md)
- Storage: [`STORAGE_AND_BUCKETS.md`](./STORAGE_AND_BUCKETS.md)
- Deployment workflow: [`CI_CD.md`](./CI_CD.md)
- Firebase project ADR: [`./adr/002-two-firebase-projects.md`](./adr/002-two-firebase-projects.md)
