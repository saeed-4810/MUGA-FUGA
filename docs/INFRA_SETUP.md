# Infrastructure Setup

Reproducible runbook for provisioning MUGA from scratch. Every command is
idempotent (safe to re-run). If you are the reviewer, this is already done
for `muga-staging` and `muga-production` — use this doc to understand **how**
and to reproduce in a fresh GCP org.

> **Scope**: GCP projects, Firebase apps, IAM, Workload Identity Federation,
> Secret Manager, Artifact Registry, Firestore, Storage, Cloud Run runtime
> identities. Does **not** cover Sentry / Slack / PagerDuty (those are manual
> console setups; see §Appendix B).

---

## Prerequisites

On your workstation:

- `gcloud` CLI ≥ 560 (`brew install google-cloud-sdk`)
- `firebase` CLI ≥ 15 (`npm i -g firebase-tools`)
- `docker` (for local backend container builds)
- A Google account with org-level project-creator permission
- An active GCP billing account (ACCOUNT_ID like `018601-XXXXXX-XXXXXX`)

Authenticate once:

```bash
gcloud auth login
gcloud auth application-default login   # for ADC used by Firebase Admin SDK locally
firebase login
```

---

## Provisioned state (fresh-from-click, reviewer can skip)

| Resource                              | `muga-staging`                                                                                                                                               | `muga-production`                                                          |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| Project number                        | `438419642765`                                                                                                                                               | `524228723694`                                                             |
| Region                                | `europe-west1`                                                                                                                                               | `europe-west1`                                                             |
| Firestore location                    | `eur3` (multi-region)                                                                                                                                        | `eur3`                                                                     |
| Storage bucket                        | `muga-staging-cover-art`                                                                                                                                     | `muga-production-cover-art`                                                |
| Artifact Registry repo                | `europe-west1-docker.pkg.dev/muga-staging/muga`                                                                                                              | `europe-west1-docker.pkg.dev/muga-production/muga`                         |
| Cloud Run service                     | `muga-backend` (will exist after first deploy)                                                                                                               | `muga-backend`                                                             |
| Runtime SA                            | `muga-backend@muga-staging.iam.gserviceaccount.com`                                                                                                          | `muga-backend@muga-production.iam.gserviceaccount.com`                     |
| Deploy SA (GH Actions)                | `github-deploy@muga-staging.iam.gserviceaccount.com`                                                                                                         | `github-deploy@muga-production.iam.gserviceaccount.com`                    |
| Workload Identity Pool                | `projects/438419642765/locations/global/workloadIdentityPools/github-pool`                                                                                   | `projects/524228723694/locations/global/workloadIdentityPools/github-pool` |
| OIDC Provider                         | `.../providers/github-provider` (scoped to repo `saeed-4810/MUGA`)                                                                                           | same                                                                       |
| Firebase Web App ID                   | `1:438419642765:web:64ee9c4956469a129945c4`                                                                                                                  | `1:524228723694:web:f73b069f91784933d684ff`                                |
| Firebase Web API key                  | `AIzaSyDXT-A5PCyAW39kK8LLNWeUKEaGeEWlrio`                                                                                                                    | `AIzaSyA83pvqqaro-AbDGx-8eK0IVihJov9u1kI`                                  |
| Auth domain                           | `muga-staging.firebaseapp.com`                                                                                                                               | `muga-production.firebaseapp.com`                                          |
| Hosting URL                           | `https://muga-staging.web.app`                                                                                                                               | `https://muga-production.web.app`                                          |
| Secret Manager secrets (placeholders) | `sentry-dsn-backend`, `sentry-dsn-frontend`, `slack-webhook-url`, `pagerduty-integration-key`, `initial-admin-emails`, `firebase-api-key`, `firebase-app-id` | same                                                                       |

---

## Reproducible setup script

```bash
# ---- edit these two ----
BILLING_ACCOUNT=018601-XXXXXX-XXXXXX
GITHUB_REPO=saeed-4810/MUGA
# -------------------------

REGION=europe-west1
FIRESTORE_LOC=eur3

for SUFFIX in staging production; do
  PROJECT="muga-$SUFFIX"

  # 1. Project + billing
  gcloud projects create "$PROJECT" --name="MUGA ${SUFFIX^}"
  gcloud billing projects link "$PROJECT" --billing-account="$BILLING_ACCOUNT"

  # 2. APIs
  gcloud services enable --project="$PROJECT" \
    firebase.googleapis.com firestore.googleapis.com \
    firebasestorage.googleapis.com firebasehosting.googleapis.com \
    identitytoolkit.googleapis.com \
    run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com \
    secretmanager.googleapis.com iamcredentials.googleapis.com iam.googleapis.com \
    logging.googleapis.com monitoring.googleapis.com

  # 3. Firebase
  firebase projects:addfirebase "$PROJECT"
  firebase apps:create WEB "$PROJECT web" --project="$PROJECT"

  # 4. Firestore (Native mode, multi-region)
  gcloud firestore databases create --location="$FIRESTORE_LOC" \
    --project="$PROJECT" --type=firestore-native

  # 5. Storage bucket for cover art (custom name to bypass .appspot.com
  #    domain-verification gate)
  gcloud storage buckets create "gs://${PROJECT}-cover-art" \
    --project="$PROJECT" --location=EUROPE-WEST1 --uniform-bucket-level-access

  # 6. Artifact Registry for backend images
  gcloud artifacts repositories create muga \
    --repository-format=docker --location="$REGION" --project="$PROJECT"

  # 7. Cloud Run runtime SA + roles
  gcloud iam service-accounts create muga-backend \
    --display-name="MUGA Backend Runtime ($SUFFIX)" --project="$PROJECT"
  RUNTIME_SA="muga-backend@${PROJECT}.iam.gserviceaccount.com"
  for role in roles/datastore.user roles/storage.objectAdmin \
              roles/secretmanager.secretAccessor roles/logging.logWriter \
              roles/monitoring.metricWriter roles/cloudtrace.agent \
              roles/firebaseauth.admin; do
    gcloud projects add-iam-policy-binding "$PROJECT" \
      --member="serviceAccount:$RUNTIME_SA" --role="$role" --condition=None --quiet
  done

  # Cloud Storage v4 signed URLs require the runtime service account to call
  # iam.serviceAccounts.signBlob. Scope Token Creator to the runtime service
  # account itself (least privilege) rather than granting it project-wide.
  gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SA" \
    --project="$PROJECT" \
    --member="serviceAccount:$RUNTIME_SA" \
    --role="roles/iam.serviceAccountTokenCreator" \
    --quiet

  # 8. GitHub Actions deploy SA + roles
  gcloud iam service-accounts create github-deploy \
    --display-name="GitHub Actions Deployer ($SUFFIX)" --project="$PROJECT"
  DEPLOY_SA="github-deploy@${PROJECT}.iam.gserviceaccount.com"
  for role in roles/run.admin roles/artifactregistry.writer roles/storage.admin \
              roles/iam.serviceAccountUser roles/firebasehosting.admin \
              roles/datastore.owner roles/firebase.admin roles/secretmanager.admin; do
    gcloud projects add-iam-policy-binding "$PROJECT" \
      --member="serviceAccount:$DEPLOY_SA" --role="$role" --condition=None --quiet
  done

  # 9. Workload Identity Federation — GitHub → GCP without long-lived keys
  gcloud iam workload-identity-pools create github-pool \
    --location=global --display-name="GitHub Actions Pool" --project="$PROJECT"

  PROJECT_NUMBER=$(gcloud projects describe "$PROJECT" --format="value(projectNumber)")
  REPO_OWNER="${GITHUB_REPO%/*}"

  gcloud iam workload-identity-pools providers create-oidc github-provider \
    --location=global \
    --workload-identity-pool=github-pool \
    --display-name="GitHub Provider" \
    --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner,attribute.ref=assertion.ref" \
    --attribute-condition="assertion.repository_owner == '$REPO_OWNER'" \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --project="$PROJECT"

  # Bind deploy SA to the pool, scoped to the specific repo
  gcloud iam service-accounts add-iam-policy-binding "$DEPLOY_SA" \
    --role="roles/iam.workloadIdentityUser" \
    --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/attribute.repository/${GITHUB_REPO}" \
    --project="$PROJECT"

  # 10. Secret Manager placeholders (you'll fill real values later)
  for SECRET in sentry-dsn-backend sentry-dsn-frontend \
                slack-webhook-url pagerduty-integration-key \
                initial-admin-emails firebase-api-key firebase-app-id; do
    echo "PLACEHOLDER_REPLACE_ME" | \
      gcloud secrets create "$SECRET" --data-file=- \
        --replication-policy=automatic --project="$PROJECT"
  done
done
```

After running the script, deploy the Firestore + Storage rules from the repo:

```bash
gcloud storage buckets update gs://muga-staging-cover-art \
  --cors-file=storage-cors.staging.json
firebase deploy --only firestore:rules,firestore:indexes,storage \
  --project=muga-staging

gcloud storage buckets update gs://muga-production-cover-art \
  --cors-file=storage-cors.production.json
firebase deploy --only firestore:rules,firestore:indexes,storage \
  --project=muga-production
```

The CORS step is required because browser uploads use signed `PUT` URLs
directly against Cloud Storage; Express API CORS does not apply to that second
request.

---

## Filling real secrets

### Sentry

1. Create a free Sentry account at https://sentry.io (or log in to yours).
2. Create **two projects**:
   - `muga-backend` (Platform: Node.js)
   - `muga-frontend` (Platform: React)
3. From each project's Settings → Client Keys, copy the **DSN**.
4. Push into Secret Manager:

   ```bash
   echo -n "https://<public-key>@<org>.ingest.sentry.io/<project>" | \
     gcloud secrets versions add sentry-dsn-backend \
     --data-file=- --project=muga-staging

   echo -n "https://<public-key>@<org>.ingest.sentry.io/<project>" | \
     gcloud secrets versions add sentry-dsn-frontend \
     --data-file=- --project=muga-staging
   ```

5. Repeat for `muga-production` (use separate Sentry projects so the issue
   lists are clean across envs).

### Slack

1. https://api.slack.com/apps → **Create New App** → From scratch.
2. Name: `MUGA Alerts (staging)`. Pick your workspace.
3. **Incoming Webhooks** → Activate → Add New Webhook to Workspace → choose
   `#muga-alerts` channel.
4. Copy the webhook URL (looks like `https://hooks.slack.com/services/T.../B.../...`).
5. Push to Secret Manager:
   ```bash
   echo -n "https://hooks.slack.com/services/..." | \
     gcloud secrets versions add slack-webhook-url \
     --data-file=- --project=muga-staging
   ```
6. Repeat for production (a separate Slack app is cleaner; or use the same
   webhook URL if you want one channel).

### PagerDuty (production only)

> **Region matters.** PagerDuty runs two regions. If your web UI is at
> `app.pagerduty.com` you're US; if it's at `app.eu.pagerduty.com` you're EU.
> Events URL differs accordingly:
>
> - US: `https://events.pagerduty.com/v2/enqueue`
> - EU: `https://events.eu.pagerduty.com/v2/enqueue`
>
> `deploy-production.yml` has `PAGERDUTY_EVENTS_URL` in its env block —
> default is EU. Flip it if your org is US.

1. EU: https://app.eu.pagerduty.com / US: https://app.pagerduty.com → **Services** → New Service.
2. Name: `MUGA Production`. Escalation policy: your on-call rota.
3. **Integrations** → Add Integration → **Events API v2**.
4. Copy the **Integration Key** (32-char hex).
5. Push to Secret Manager:
   ```bash
   echo -n "<32-char-key>" | \
     gcloud secrets versions add pagerduty-integration-key \
     --data-file=- --project=muga-production
   ```
6. Test (EU example):
   ```bash
   curl -X POST "https://events.eu.pagerduty.com/v2/enqueue" \
     -H "Content-Type: application/json" \
     -d '{"routing_key":"<key>","event_action":"trigger","payload":{"summary":"test","severity":"info","source":"manual"}}'
   ```
   Expect `{"status":"success",...}`. Resolve the test incident in the PD UI.

### Initial admin emails

Comma-separated list of emails that get the `admin` custom claim when they
first sign in.

```bash
echo -n "you@example.com,reviewer@example.com" | \
  gcloud secrets versions add initial-admin-emails \
  --data-file=- --project=muga-staging

echo -n "you@example.com" | \
  gcloud secrets versions add initial-admin-emails \
  --data-file=- --project=muga-production
```

---

## Manual steps (cannot automate)

These require browser clicks in specific consoles:

### ☐ Enable Google sign-in provider in Firebase Auth (both projects)

1. https://console.firebase.google.com/project/muga-staging/authentication/providers
2. **Sign-in method** → Google → Enable → pick a project-support email → Save
3. **Settings tab** → **Authorized domains** → add these (some are auto-added):
   - `localhost` (already there)
   - `muga-staging.web.app`
   - `muga-staging.firebaseapp.com`
4. **Staging only — for PR preview channels** — also add the wildcard:
   - `web.app`
     This allows every Firebase Hosting preview channel (URLs like
     `muga-staging--pr-<n>-<hash>.web.app`) to sign users in with Google
     without manually whitelisting each one.
     **Do NOT add this on production.** Production stays locked down to
     `muga-production.web.app` + `muga-production.firebaseapp.com`.
5. Repeat step 1-3 for `muga-production` (skip step 4).

### ☐ Set up GitHub repository secrets (environment variables, not values)

Even with WIF, GitHub Actions still reads a handful of non-secret identifiers
from repo settings. Add these in **Settings → Secrets and variables → Actions
→ Variables** (not Secrets — these are not sensitive):

_none needed right now_ — all config is baked into the workflow `env:` blocks,
and secrets are pulled from Secret Manager at job time via WIF.

### ☐ Enable branch protection on `main`

https://github.com/saeed-4810/MUGA/settings/branches → Add rule for `main`:

- ☑ Require a pull request before merging
- ☑ Require approvals: 1
- ☑ Dismiss stale approvals on new commits
- ☑ Require status checks to pass before merging:
  - `install`, `lint`, `typecheck`, `test`, `build`, `e2e`, `docker`
- ☑ Require branches to be up to date before merging
- ☑ Require conversation resolution before merging
- ☑ Require linear history
- ☑ Do not allow bypassing the above settings
- ☒ Allow force pushes (leave unchecked)
- ☒ Allow deletions (leave unchecked)

### ☐ Optional: configure `.web.app` hosting targets

Firebase Hosting auto-creates `<project>.web.app`. No action needed unless
you want a custom domain (see §Appendix C).

## Preview channels (per-PR deploys, label-gated)

Previews are **opt-in**. A PR only gets a Firebase Hosting preview channel +
Playwright E2E when it carries the `preview` label. This keeps channel
usage and CI minutes predictable — most PRs don't need a preview, and
CI already catches what matters for them.

### Creating the `preview` label (one-time)

```bash
gh label create preview \
  --repo saeed-4810/MUGA \
  --description "Deploy a Firebase Hosting preview channel + E2E for this PR" \
  --color "1d76db"
```

Or via UI: https://github.com/saeed-4810/MUGA/labels → **New label** →
name `preview`, any color.

### How the flow works

1. PR opens → **CI runs** (lint, typecheck, test, build, docker, lighthouse).
   **No preview** unless the label is present.
2. Reviewer (or author) clicks **Labels → preview** on the PR.
   `pull_request.labeled` event fires.
3. `.github/workflows/preview.yml` runs:
   - `wait-for-ci` — blocks until the `build` check on the same SHA is green
   - `preview-deploy` — builds the frontend, deploys to hosting channel `pr-<number>`
   - `preview-e2e` — Playwright against the actual preview URL (real network, real staging backend)
   - `preview-comment` — posts / updates the PR comment with URL + E2E result
4. New push to the PR → re-runs steps 3.1–3.4 (concurrency group cancels previous run).
5. Label removed, or PR closed → `.github/workflows/preview-cleanup.yml` deletes the channel.

### URLs

- URL shape: `https://muga-staging--pr-<pr-number>-<hash>.web.app`
- Auto-expires: 7 days if the PR is still open; immediate on PR close or label removal.
- Shares the `muga-staging` backend via the `firebase.json` `/api/**` rewrite.

### Limitations (by design)

- **Frontend-only** — previews hit the _shared_ staging backend. Preview
  Firestore/Storage is the same as staging. Changes to backend code take
  effect only after merge to `main` + full staging redeploy.
- **Google sign-in requires the `web.app` wildcard** on staging's
  authorized-domain allowlist (see manual step above). If that's not
  set, previews still render but show a "sign-in unavailable" banner.
- **Channels are listed in the Firebase console** at
  https://console.firebase.google.com/project/muga-staging/hosting/sites/muga-staging/channels
  — you can delete stale ones manually if needed.

### Post-merge behaviour

Once a PR merges to `main`:

1. `deploy-staging.yml` fires → `wait-for-ci` → frontend + backend deploy to live staging
2. `e2e-staging` job runs Playwright against `https://muga-staging.web.app`
3. If everything's green, `main` = staging truth
4. Tag `vX.Y.Z` → `deploy-production.yml` fires → `wait-for-ci` (build + docker green) → deploy
5. `smoke-production` job verifies `/health`, `/api/openapi.json`, homepage brand

---

## Appendix A — Verification checklist

Run these after setup to confirm everything is wired:

```bash
# 1. Projects exist and are billed
for P in muga-staging muga-production; do
  gcloud billing projects describe $P | grep billingEnabled
done
# expect: billingEnabled: true × 2

# 2. Firestore exists
gcloud firestore databases list --project=muga-staging
# expect: 1 database, type=FIRESTORE_NATIVE, location=eur3

# 3. Storage bucket
gcloud storage buckets list --project=muga-staging
# expect: gs://muga-staging-cover-art

# 3b. Storage bucket CORS allows signed browser uploads
gcloud storage buckets describe gs://muga-staging-cover-art \
  --format="default(cors_config)"
# expect: origin=https://muga-staging.web.app, method includes PUT,
# responseHeader includes Content-Type

# 4. Artifact Registry
gcloud artifacts repositories list --location=europe-west1 --project=muga-staging
# expect: muga (docker)

# 5. Service accounts
gcloud iam service-accounts list --project=muga-staging
# expect: muga-backend@..., github-deploy@...

# 5b. Runtime SA can sign Storage v4 upload URLs
gcloud iam service-accounts get-iam-policy \
  muga-backend@muga-staging.iam.gserviceaccount.com \
  --project=muga-staging \
  --flatten="bindings[].members" \
  --filter="bindings.role:roles/iam.serviceAccountTokenCreator AND bindings.members:serviceAccount:muga-backend@muga-staging.iam.gserviceaccount.com"
# expect: one binding granting roles/iam.serviceAccountTokenCreator to itself

# 6. Workload Identity pool
gcloud iam workload-identity-pools list --location=global --project=muga-staging
# expect: github-pool

# 7. Secrets
gcloud secrets list --project=muga-staging
# expect: 7 entries (sentry-*, slack-*, pagerduty-*, initial-*, firebase-*)

# 8. Firebase Web app
firebase apps:list --project=muga-staging
# expect: 1 WEB app

# 9. Firestore rules deployed
curl "https://firestore.googleapis.com/v1/projects/muga-staging/databases/(default)" \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" | jq .
```

---

## Appendix B — Cost monitoring

```bash
# Set a budget alert at $10/month (adjust as needed)
gcloud billing budgets create \
  --billing-account=018601-741ACB-D884DF \
  --display-name="MUGA staging safety" \
  --budget-amount=10USD \
  --threshold-rule=percent=0.5 \
  --threshold-rule=percent=0.9 \
  --threshold-rule=percent=1.0 \
  --filter-projects=projects/438419642765
```

Expected monthly cost for the take-home:

- Firestore: ~$0 (free tier covers the load)
- Cloud Run: ~$0 (scales to zero when idle; min-instances=1 in prod costs ~$7/mo)
- Storage: ~$0 (free tier covers cover art up to 5GB)
- Artifact Registry: ~$0.10 per GB-month
- Total: **< $10/month** for both staging + production combined.

---

## Appendix C — Custom domain (optional, post-MVP)

If you register `muga.app`:

```bash
# 1. In Firebase console → Hosting → Add custom domain → follow DNS steps.
# 2. Update VITE_API_URL in deploy-*.yml:
#      VITE_API_URL: https://api.muga.app    (production)
#      VITE_API_URL: https://api.staging.muga.app  (staging)
# 3. Update CORS_ALLOWED_ORIGINS in deploy-*.yml.
# 4. Update authorized Auth domains in Firebase Console.
```

Not required for the take-home submission — `*.web.app` is the production URL.
