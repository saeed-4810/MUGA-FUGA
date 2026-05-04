# Secrets & Configuration

Canonical reference for every secret / config value MUGA uses, where it lives,
how to obtain it, and how to rotate it.

> **Golden rule**: secrets live in **GCP Secret Manager**. The only place they
> leave Secret Manager is Cloud Run (`--set-secrets`) at deploy time, and the
> GitHub Actions deploy workflow (which authenticates via Workload Identity
> Federation — no long-lived keys). Never put a secret in `.env` committed to
> git, never paste it into a GitHub workflow file, never echo it in a log.

---

## Where secrets live

```
┌─────────────────────────────────────────────────────────────────┐
│  GCP Secret Manager (muga-staging + muga-production)            │
│    ┌────────────────────────────────────────────┐               │
│    │ sentry-dsn-backend       [Secret]          │               │
│    │ sentry-dsn-frontend      [Secret]          │               │
│    │ slack-webhook-url        [Secret]          │               │
│    │ pagerduty-integration-key [Secret, prod]   │               │
│    │ initial-admin-emails     [Config]          │               │
│    │ firebase-api-key         [Public config]   │               │
│    │ firebase-app-id          [Public config]   │               │
│    └────────────────────────────────────────────┘               │
│                    │                                            │
│   ┌────────────────┼────────────────────┐                       │
│   │                │                    │                       │
│   ▼                ▼                    ▼                       │
│ Cloud Run     GitHub Actions       Local dev (gcloud           │
│ (via          (fetch at deploy     secrets versions access)    │
│ --set-secrets) time via WIF)                                    │
└─────────────────────────────────────────────────────────────────┘
```

**Local dev** reads from `.env` (gitignored). You copy `env.example` → `.env`
and paste the values. Use `gcloud secrets versions access latest
--secret=SECRET_NAME --project=muga-staging` to pull a secret from GCP.

**CI (GitHub Actions)** authenticates to GCP via Workload Identity Federation
(no stored credentials). The workflow fetches secrets just-in-time for the
build step.

**Cloud Run** mounts secrets as environment variables at deploy time via
`gcloud run deploy --set-secrets`. The running container sees them as normal
env vars; they are never written to the image.

---

## Secrets catalog

### `sentry-dsn-backend`

| Field          | Value                                                                                                    |
| -------------- | -------------------------------------------------------------------------------------------------------- |
| Scope          | staging + production                                                                                     |
| Where used     | Cloud Run (backend container) as `SENTRY_DSN`                                                            |
| How to obtain  | https://sentry.io → Settings → Projects → `muga-backend` → Client Keys (DSN)                             |
| How to set     | `echo -n "<dsn>" \| gcloud secrets versions add sentry-dsn-backend --data-file=- --project=muga-staging` |
| Rotation       | Generate new DSN in Sentry UI, add new version, redeploy                                                 |
| Classification | Low-sensitivity (DSN grants event-write only; revokable)                                                 |

### `sentry-dsn-frontend`

| Field          | Value                                                                                                     |
| -------------- | --------------------------------------------------------------------------------------------------------- |
| Scope          | staging + production                                                                                      |
| Where used     | Frontend build (`VITE_SENTRY_DSN`, baked into bundle)                                                     |
| How to obtain  | https://sentry.io → Settings → Projects → `muga-frontend` → Client Keys (DSN)                             |
| How to set     | `echo -n "<dsn>" \| gcloud secrets versions add sentry-dsn-frontend --data-file=- --project=muga-staging` |
| Rotation       | Generate new DSN in Sentry UI, add new version, redeploy                                                  |
| Classification | Public (DSN is shipped in browser bundle; Sentry rate-limits)                                             |

### `slack-webhook-url`

| Field          | Value                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------- |
| Scope          | staging + production (separate values)                                                                  |
| Where used     | Cloud Run as `SLACK_WEBHOOK_URL` (runtime alerts); GitHub Actions deploy notifier                       |
| How to obtain  | https://api.slack.com/apps → Create app → Incoming Webhooks → add to `#muga-alerts`                     |
| How to set     | `echo -n "<url>" \| gcloud secrets versions add slack-webhook-url --data-file=- --project=muga-staging` |
| Rotation       | Regenerate webhook URL in Slack app config, add new version, redeploy                                   |
| Classification | Medium (URL lets anyone with it post to `#muga-alerts`)                                                 |

### `pagerduty-integration-key`

| Field          | Value                                                                                                                                                                                             |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scope          | **production only**                                                                                                                                                                               |
| Where used     | Cloud Run as `PAGERDUTY_INTEGRATION_KEY`; deploy-production.yml (paging on failure)                                                                                                               |
| PD region      | **EU** — events URL `https://events.eu.pagerduty.com/v2/enqueue`. US orgs use `events.pagerduty.com`. Endpoint is configured via `PAGERDUTY_EVENTS_URL` in the `deploy-production.yml` env block. |
| How to obtain  | EU: https://app.eu.pagerduty.com → Services → `MUGA Production` → Integrations → Events API v2. US: same path on `app.pagerduty.com`.                                                             |
| How to set     | `echo -n "<key>" \| gcloud secrets versions add pagerduty-integration-key --data-file=- --project=muga-production`                                                                                |
| Rotation       | Rotate integration key in PD UI, add new version, redeploy                                                                                                                                        |
| Classification | High (triggers pages; secure, rotate quarterly)                                                                                                                                                   |
| Staging        | Placeholder only — not used.                                                                                                                                                                      |

### `initial-admin-emails`

| Field          | Value                                                                                                                |
| -------------- | -------------------------------------------------------------------------------------------------------------------- |
| Scope          | staging + production                                                                                                 |
| Where used     | Cloud Run as `INITIAL_ADMIN_EMAILS` — `/me/bootstrap` promotes these users to `admin` custom claim on first sign-in  |
| Format         | Comma-separated: `alice@example.com,bob@example.com`                                                                 |
| How to set     | `echo -n "you@example.com" \| gcloud secrets versions add initial-admin-emails --data-file=- --project=muga-staging` |
| Rotation       | Safe to update freely; existing admins keep their claim                                                              |
| Classification | Medium (leaking it shows who has admin; does not grant access)                                                       |

### `firebase-api-key`

| Field            | Value                                                                                                                                                                                                                        |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scope            | staging + production                                                                                                                                                                                                         |
| Where used       | Frontend bundle as `VITE_FIREBASE_API_KEY`                                                                                                                                                                                   |
| How to obtain    | Already provisioned: `firebase apps:sdkconfig WEB <appId> --project=muga-staging`                                                                                                                                            |
| Staging value    | `AIzaSyDXT-A5PCyAW39kK8LLNWeUKEaGeEWlrio` (also baked into `deploy-staging.yml`)                                                                                                                                             |
| Production value | `AIzaSyA83pvqqaro-AbDGx-8eK0IVihJov9u1kI` (also baked into `deploy-production.yml`)                                                                                                                                          |
| Rotation         | `firebase apps:sdkconfig` after regenerating in console                                                                                                                                                                      |
| Classification   | **Public** — this is a Firebase _client_ API key. Firebase Auth domain-restricts it (only `muga-staging.firebaseapp.com` / `muga-production.firebaseapp.com` can use it for Auth). It is safe to ship in the browser bundle. |

### `firebase-app-id`

| Field            | Value                                       |
| ---------------- | ------------------------------------------- |
| Scope            | staging + production                        |
| Where used       | Frontend bundle as `VITE_FIREBASE_APP_ID`   |
| Staging value    | `1:438419642765:web:64ee9c4956469a129945c4` |
| Production value | `1:524228723694:web:f73b069f91784933d684ff` |
| Classification   | Public (app identifier)                     |

---

## What is **NOT** a secret (ship these in the codebase)

These are safe to commit / bake into workflow env blocks:

| Value                                                                                            | Where                            | Why public                                                                                  |
| ------------------------------------------------------------------------------------------------ | -------------------------------- | ------------------------------------------------------------------------------------------- |
| Firebase project IDs (`muga-staging`, `muga-production`)                                         | Everywhere                       | They appear in URLs                                                                         |
| Project numbers (`438419642765`, `524228723694`)                                                 | Workflows                        | Needed for WIF provider path; not sensitive                                                 |
| Firebase `apiKey` / `appId` / `authDomain` / `projectId` / `storageBucket` / `messagingSenderId` | `deploy-*.yml` env block, `.env` | Firebase Web config is public; protected by Auth domain allowlist + Firestore/Storage rules |
| Storage bucket name (`muga-staging-cover-art`)                                                   | Everywhere                       | Just a name                                                                                 |
| GCP region (`europe-west1`)                                                                      | Everywhere                       | —                                                                                           |
| Cloud Run service name (`muga-backend`)                                                          | Everywhere                       | —                                                                                           |
| Workload Identity pool / provider paths                                                          | `deploy-*.yml`                   | Not a credential — just addresses                                                           |

---

## Public vs private Firebase config — why?

Firebase Web `apiKey` is **designed to ship in the browser**. The real security
boundary is the combined set of:

1. **Authorized Auth domains** — Firebase Auth will only issue ID tokens to
   requests originating from the domains you list (we set: the `.web.app`
   domain + `localhost` for dev).
2. **Firestore Security Rules** — `firestore.rules` decides what a given
   authenticated UID can read/write.
3. **Storage Security Rules** — `storage.rules` decides upload ACLs.
4. **Custom claim (`role`)** — `admin` vs `customer` — set server-side via
   Admin SDK after the `/me/bootstrap` request.

Without Auth domain allowlist + rules, an attacker with a leaked `apiKey`
cannot read anything interesting. This is the same model that all Firebase web
apps ship under. See Firebase's docs:
https://firebase.google.com/docs/projects/api-keys

---

## Local development — how to get working in 5 minutes

1. Install gcloud + firebase CLIs (already done on this machine):

   ```bash
   gcloud auth login
   gcloud auth application-default login
   gcloud config set project muga-staging
   ```

2. Copy env templates:

   ```bash
   cp apps/backend/env.example apps/backend/.env
   cp apps/frontend/env.example apps/frontend/.env.local
   ```

3. Fill `apps/backend/.env`:

   ```bash
   # ADC picks up step-1 credentials, so leave FIREBASE_SERVICE_ACCOUNT_JSON empty
   FIREBASE_PROJECT_ID=muga-staging
   FIREBASE_STORAGE_BUCKET=muga-staging-cover-art
   INITIAL_ADMIN_EMAILS=$(gcloud secrets versions access latest --secret=initial-admin-emails --project=muga-staging)
   SENTRY_DSN=$(gcloud secrets versions access latest --secret=sentry-dsn-backend --project=muga-staging)
   SLACK_WEBHOOK_URL=$(gcloud secrets versions access latest --secret=slack-webhook-url --project=muga-staging)
   ```

4. Fill `apps/frontend/.env.local`:

   ```bash
   VITE_API_URL=http://localhost:3001
   VITE_FIREBASE_API_KEY=AIzaSyDXT-A5PCyAW39kK8LLNWeUKEaGeEWlrio
   VITE_FIREBASE_AUTH_DOMAIN=muga-staging.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=muga-staging
   VITE_FIREBASE_APP_ID=1:438419642765:web:64ee9c4956469a129945c4
   VITE_FIREBASE_STORAGE_BUCKET=muga-staging-cover-art
   VITE_SENTRY_DSN=$(gcloud secrets versions access latest --secret=sentry-dsn-frontend --project=muga-staging)
   VITE_SENTRY_ENVIRONMENT=development
   ```

5. Run:
   ```bash
   pnpm install
   pnpm dev        # backend :3001, frontend :5173
   ```

For offline-friendly dev (no cloud calls), use Firebase emulators — see the
root `README.md`.

---

## Rotation procedure

### Normal rotation (quarterly)

1. Create the new secret at the source (Sentry / Slack / PagerDuty UI).
2. Add a new version: `gcloud secrets versions add <name> --data-file=- --project=<project>`.
3. Redeploy the service so it picks up `:latest`:
   - Backend (staging): push to `main` or run `gh workflow run deploy-staging.yml`
   - Backend (production): tag a SemVer `vX.Y.Z`
4. (Optional) disable the old version: `gcloud secrets versions disable <version> --secret=<name> --project=<project>`
5. Verify the new version is active: `curl https://muga-staging.web.app/api/health` and check a test alert fires.
6. Log the rotation in the production runbook.

### Emergency rotation (a secret leaked)

1. **Disable the leaked version immediately** in Secret Manager (`gcloud secrets versions destroy <v>`).
2. Generate a new value at the source.
3. Add as new version.
4. Force-redeploy so the running revision picks it up (running revisions may
   have cached the old value — Cloud Run's Secret Manager mounts re-read
   on container start only).
5. Invalidate related state (rotate Sentry DSN → clear relay caches; rotate
   Slack webhook → delete the old one; PagerDuty → invalidate integration).
6. File an incident postmortem at `docs/governance/postmortem-YYYY-MM-DD-leak.md`.

---

## How we prevent secrets from being committed

- `.gitignore` excludes `.env`, `.env.local`, `.env.*.local`, `*.pem`, `*.key`,
  `.firebase/`, `firebase-adminsdk-*.json`.
- Husky **`pre-commit`** runs `.husky/scan-secrets.sh` — a regex scanner that
  looks for AWS keys, GCP service-account JSON markers, Slack webhooks,
  bearer tokens, and common DSN shapes. If any match, the commit is blocked.
- Review: any PR touching workflows, `env.example`, or `firebase.json` is
  routed to CODEOWNERS (Backend reviewer).

Override the scanner (requires Decision Log entry):

```bash
SKIP_SECRET_SCAN=1 git commit -m "..."
```
