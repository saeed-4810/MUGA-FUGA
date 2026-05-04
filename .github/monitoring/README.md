# Cloud Monitoring policies as code

> Owner: Backend · See `docs/api/alerting-runbook.md` for the catalog and
> `docs/adr/006-alerting-strategy.md` for the strategy.

These YAML files describe the Cloud Monitoring uptime checks and alert
policies for both `muga-staging` and `muga-production`. Apply per env
with the `gcloud` CLI (one-time setup; updates happen via PR + re-apply):

```bash
# Bind notification channels first (one per env)
gcloud alpha monitoring channels create \
  --project=muga-staging \
  --channel-content-from-file=channels/slack-staging.yaml

gcloud alpha monitoring channels create \
  --project=muga-production \
  --channel-content-from-file=channels/slack-production.yaml

gcloud alpha monitoring channels create \
  --project=muga-production \
  --channel-content-from-file=channels/pagerduty-production.yaml

# Then apply each policy
gcloud alpha monitoring policies create \
  --project=muga-production \
  --policy-from-file=alert-cloud-run-error-rate.yaml
```

> Replace `${NOTIFICATION_CHANNEL_*}` placeholders with the channel IDs
> returned by `gcloud alpha monitoring channels list` after they're
> created.

## Files

| File                                 | Source for runbook    |
| ------------------------------------ | --------------------- |
| `uptime-frontend.yaml`               | A1 (frontend variant) |
| `uptime-backend.yaml`                | A1                    |
| `uptime-backend-ready.yaml`          | A10                   |
| `alert-cloud-run-error-rate.yaml`    | A2                    |
| `alert-cloud-run-latency.yaml`       | A3                    |
| `alert-auth-failure-spike.yaml`      | A4                    |
| `alert-upload-failure-spike.yaml`    | A5                    |
| `channels/slack-staging.yaml`        | (template)            |
| `channels/slack-production.yaml`     | (template)            |
| `channels/pagerduty-production.yaml` | (template)            |
