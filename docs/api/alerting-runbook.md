# Alerting Runbook

This page explains what is monitored in the deployed MUGA environments and what to check first when an alert fires. The setup is intentionally small, but it follows the same split used in production systems: Sentry for application context, Cloud Monitoring for platform signals, Slack for team visibility, and PagerDuty for production pages.

## Severity ladder

| Severity | Route                        | Expected response                                                              |
| -------- | ---------------------------- | ------------------------------------------------------------------------------ |
| `page`   | PagerDuty + Slack            | Production user impact. Check immediately and roll back or mitigate if needed. |
| `notify` | Slack                        | Something needs attention, but it should not wake anyone up.                   |
| `info`   | Sentry/Cloud Monitoring only | Review when investigating related work.                                        |

Staging sends alerts to Slack only. Production sends notify-level alerts to Slack and page-level alerts to both Slack and PagerDuty.

## Alert catalog

| ID  | Alert                                     | Severity     | First response                                                                |
| --- | ----------------------------------------- | ------------ | ----------------------------------------------------------------------------- |
| A1  | Production `/health` down                 | page         | Check latest Cloud Run revision, logs, Firebase status, and Hosting rewrites. |
| A2  | Cloud Run 5xx ratio above 5% for 5 min    | page         | Open Sentry by release, rollback if tied to latest deploy.                    |
| A3  | Cloud Run p95 latency above 1s for 10 min | notify       | Check traffic spike, slow route, and Firestore latency.                       |
| A4  | Auth failure spike                        | notify       | Separate brute force from broken client deploy.                               |
| A5  | Upload failure spike                      | notify       | Check Storage CORS/rules and signed URL TTL.                                  |
| A6  | Sentry issue regression                   | page         | Roll back or hotfix the release that reintroduced the issue.                  |
| A7  | Browser crash-free rate below target      | notify       | Filter Sentry by release, browser, route, and environment.                    |
| A8  | Frontend public app uptime down           | page         | Check Firebase Hosting, `muga-frontend`, and current browser Sentry issues.   |
| A9  | Deploy failure                            | notify/page  | Inspect GitHub Actions; production failure pages, staging notifies.           |
| A10 | Readiness degraded                        | page in prod | Check Firestore availability and index/rules drift.                           |
| A11 | Admin moderation action                   | info         | Audit signal only; no paging.                                                 |
| A12 | Admin product artist override             | info         | Audit signal for products attached to pending artists.                        |

## What each tool owns

| Tool             | Owns                                                                                                                       |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Cloud Logging    | Backend Pino request logs and structured alert fields.                                                                     |
| Cloud Monitoring | Uptime checks, Cloud Run latency, 5xx ratio, log-based metrics, and alert policies.                                        |
| Sentry           | Backend exceptions, browser exceptions, issue regressions, frontend watchdog alerts, releases, and web-vitals breadcrumbs. |
| Slack            | Staging notifications and all production notifications.                                                                    |
| PagerDuty        | Production page-level incidents only.                                                                                      |

## Structured log fields

Cloud Monitoring metrics are based on the backend JSON logs. These fields are stable and safe to use for filtering:

| Field                  | Example            | Why it matters                                                        |
| ---------------------- | ------------------ | --------------------------------------------------------------------- |
| `alert.kind`           | `auth_failure`     | Identifies the operational signal.                                    |
| `alert.severity`       | `notify`           | Separates dashboard-only events from actionable alerts.               |
| `requestId`            | `req_...`          | Connects logs to API responses and Sentry events.                     |
| `userUid` / `userRole` | `usr_...`, `admin` | Helps investigate authenticated activity without logging credentials. |

Tokens, cookies, signed upload URLs, and private keys are not logged.

## Adding or changing an alert

1. Add or update the policy YAML in `.github/monitoring/`.
2. Add a row here with source, severity, and first response.
3. Add an SLO reference when severity is `page`.
4. Deploy the policy through the infrastructure runbook.
5. Trigger a safe drill in staging before relying on it.
