#!/usr/bin/env sh
# MUGA secret scanner — runs as part of Husky pre-commit.
# Blocks commits that look like they contain credentials.
#
# Bypass (requires Decision Log entry per OPERATING_DOR_DOD.md §10.6):
#   SKIP_SECRET_SCAN=1 git commit -m "..."
#
# Patterns checked:
#   - AWS access key IDs (AKIA...)
#   - AWS secret access keys (40-char base64)
#   - GCP service account JSON marker ("private_key":)
#   - Slack incoming webhooks (hooks.slack.com/services/T.../B.../...)
#   - PagerDuty integration keys (32 hex chars after a plausible variable name)
#   - Sentry DSNs (https://<hex>@<org>.ingest.sentry.io/<n>)
#   - GitHub personal-access tokens (ghp_..., gho_..., ghs_...)
#   - Generic private keys (-----BEGIN ... PRIVATE KEY-----)

set -e

if [ "${SKIP_SECRET_SCAN}" = "1" ]; then
  echo "⚠️  SKIP_SECRET_SCAN=1 — secret scanner bypassed. Log this in docs/governance/decision-log.md."
  exit 0
fi

# Only scan files staged for commit (not the whole tree).
STAGED=$(git diff --cached --name-only --diff-filter=ACM)

if [ -z "$STAGED" ]; then
  exit 0
fi

FOUND=0

# Dump staged additions once; reuse for every pattern.
STAGED_ADDS=$(git diff --cached -U0 --diff-filter=ACM | grep -E '^\+' || true)

check() {
  pattern="$1"
  label="$2"
  if [ -z "$STAGED_ADDS" ]; then
    return
  fi
  # -- ensures patterns starting with `-` are treated as patterns, not flags.
  matches=$(printf '%s\n' "$STAGED_ADDS" | grep -E -- "$pattern" || true)
  if [ -n "$matches" ]; then
    echo "🚨 $label"
    printf '%s\n' "$matches" | head -3
    FOUND=1
  fi
}

check 'AKIA[0-9A-Z]{16}' "AWS access key id"
check '"private_key":[[:space:]]*"-----BEGIN' "GCP service account JSON (private_key)"
check 'hooks\.slack\.com/services/T[A-Z0-9]+/B[A-Z0-9]+/[A-Za-z0-9]+' "Slack incoming webhook URL"
check 'https://[a-f0-9]{32}@[a-z0-9.-]+\.ingest\.sentry\.io/[0-9]+' "Sentry DSN"
check '(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}' "GitHub personal access token"
check '-----BEGIN ((RSA|EC|OPENSSH|DSA) )?PRIVATE KEY-----' "Private key block"
check '(pagerduty_integration_key|routing_key)[[:space:]]*[=:][[:space:]]*[a-f0-9]{32}' "PagerDuty-like integration key"

# `.env*` files must never be staged (with a few template exceptions).
ENV_STAGED=$(echo "$STAGED" | grep -E '(^|/)\.env($|\..+)' | grep -vE '\.(example|template|sample)$' || true)
if [ -n "$ENV_STAGED" ]; then
  echo "🚨 .env file staged — these are gitignored for a reason:"
  echo "$ENV_STAGED"
  FOUND=1
fi

if [ "$FOUND" -eq 1 ]; then
  echo ""
  echo "❌ Commit blocked: secret-like content detected above."
  echo "   • If it is a real secret, remove it and put it in Secret Manager instead."
  echo "     See docs/SECRETS.md for how and where."
  echo "   • If it is a false positive (e.g. a test fixture), rename the file or"
  echo "     rework the line, or rerun with SKIP_SECRET_SCAN=1 AND log a Decision."
  exit 1
fi

exit 0
