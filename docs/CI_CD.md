# CI/CD

MUGA uses GitHub Flow. `main` is the integration branch and staging source of truth. Production deploys are SemVer tags cut from `main`.

## Branch model

| Branch/tag               | Purpose                                             |
| ------------------------ | --------------------------------------------------- |
| `main`                   | Integration branch. Every merge deploys to staging. |
| `<type>/MUGA-xxx-<slug>` | Short-lived feature branch.                         |
| `vX.Y.Z`                 | Production release tag on `main`.                   |

Branch examples:

```bash
feat/MUGA-30-product-create-flow
fix/MUGA-41-session-cookie-refresh
docs/MUGA-42-application-docs
```

## Pull request checks

The normal PR path runs:

1. Install dependencies with pnpm.
2. Lint with zero warnings.
3. Typecheck with TypeScript strict settings.
4. Run Vitest with coverage.
5. Build backend and frontend.
6. Build Docker images.
7. Optional preview deploy when the PR carries the `preview` label.
8. Optional preview E2E when the PR also carries the `e2e` label.

Before pushing, I run the same core checks that CI will run:

```bash
pnpm lint
pnpm typecheck
pnpm test:ci
```

## Staging deploy

Every merge to `main` runs the staging workflow:

```
main push
  → wait for CI checks
  → build backend container
  → deploy muga-backend to Cloud Run in muga-staging
  → build frontend standalone output/container
  → deploy muga-frontend to Cloud Run in muga-staging
  → deploy Firebase Hosting config and rewrites
  → run staging smoke/E2E checks
```

Staging URL:

```text
https://muga-staging.web.app
```

## Production deploy

Production is tag-driven:

```bash
git tag -a v0.2.0 -m "Auth and products release"
git push origin v0.2.0
```

The production workflow deploys the tagged SHA to `muga-production`. This avoids accidentally releasing unreviewed work from an arbitrary branch.

Production URL:

```text
https://muga-production.web.app
```

## Preview channels

Preview channels are opt-in. Add the `preview` label to a PR to deploy the frontend to a temporary Firebase Hosting channel. Add `e2e` as well when the PR needs Playwright coverage against that preview.

Preview properties:

- URL shape: `https://muga-staging--pr-<number>-<hash>.web.app`
- Expires after 7 days while the PR is open.
- Deleted on PR close or label removal.
- Uses the shared staging backend through the `/api/**` rewrite.

Preview channels are useful for UI review. They are not a replacement for staging because backend changes only become live after merge and staging deploy.

## Deployment authentication

GitHub Actions uses Workload Identity Federation to access GCP. There are no long-lived service-account keys in the repository. Deploy-time secrets are read from Secret Manager and injected into Cloud Run or build steps as needed.

## Before merging

- Conventional commit messages.
- No secrets in commits, logs, PR bodies, or screenshots.
- No force push to `main`.
- No hook bypass during normal development.
- PR description includes tests run and docs changed.
- Branch is up to date before merge.
- Squash merge into `main`.

## References

- Contributor guide: [`../CONTRIBUTING.md`](../CONTRIBUTING.md)
- Git workflow: [`../GIT_WORKFLOW.md`](../GIT_WORKFLOW.md)
- Infrastructure setup: [`INFRA_SETUP.md`](./INFRA_SETUP.md)
- Secrets: [`SECRETS.md`](./SECRETS.md)
