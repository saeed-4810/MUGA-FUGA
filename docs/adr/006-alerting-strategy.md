# ADR-006: Alerting and monitoring strategy

## Context

Monitoring tells us what happened; alerting tells someone when to act. MUGA runs on Firebase Hosting and Cloud Run, so the useful signals come from two places: the application itself and the Google Cloud platform around it. The app needs visibility into deploy failures, API failures, auth failures, upload failures, frontend errors, and browser performance.

## Options considered

1. **Sentry plus Cloud Monitoring** — Sentry for application errors; Cloud Monitoring for infrastructure and log-based metrics.
2. **Sentry only** — good app grouping, weaker Cloud Run and log-based signals.
3. **Cloud Monitoring only** — good platform signals, weaker application debugging and source maps.

## Decision

Use Sentry for browser/backend exceptions, release tracking, frontend watchdog alerts, and web-vitals breadcrumbs. Use Cloud Logging and Cloud Monitoring for request logs, uptime checks, readiness, latency, 5xx ratio, and log-based metrics. Slack receives staging and production notifications. PagerDuty receives production page-level incidents.

The deployed setup is active in both staging and production. Staging is used for safe alert drills. Production is watched with uptime checks, Cloud Run metrics, Sentry rules, and PagerDuty routing for incidents that need immediate attention.

## Consequences

- Operational behaviour is visible in the repository through monitoring policy files and the runbook.
- The application code stays simple: it emits structured logs and Sentry events; Cloud Monitoring and Sentry decide how to route alerts.
- Staging and production behave differently on purpose. Staging proves the pipeline through Slack. Production uses Slack plus PagerDuty for page-level incidents.

## Rollback

Remove monitoring policy YAML, Sentry alert rules, and Slack/PagerDuty notification steps. The product features continue to work; only alerting is removed.
