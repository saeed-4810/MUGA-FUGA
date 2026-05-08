# Git Workflow — MUGA

> Authoritative reference for branch lifecycle, commit conventions, and per-role gates.
> **Model: GitHub Flow.** One long-lived branch (`main`). No `develop` branch.

## Branch lifecycle

```
                    ┌──────────────────────────────┐
                    │            main              │  ← integration + staging
                    │  (auto-deploys to staging    │
                    │   on every merge)            │
                    └───┬────────────────┬─────────┘
                        │                │
                        │                └── tag vX.Y.Z ─→ deploy-production
                        │
       feat/cool-thing  ▼      fix/login-bug
   (branch cut from main)    (branch cut from main)
                        │                │
                    (PR squash-merge → main)
```

- **`main`** — the single long-lived branch. Merge to `main` = deploy to staging.
- **`<type>/<slug>`** — short-lived feature branches cut from `main`.
- **`vX.Y.Z` tags on `main`** — trigger production deploy.

## Naming

```
<type>/<kebab-slug>
```

Allowed types (must match commit type):

`feat | fix | chore | docs | test | refactor | ci | hotfix | perf | build | revert`

Examples:

- `feat/products-crud`
- `fix/signed-url-ttl`
- `docs/adr-alerting`
- `hotfix/auth-bypass`

## Lifecycle

1. **Cut a branch off `main`**:
   ```
   git checkout main && git pull
   git checkout -b feat/your-slug
   ```
2. **Implement** in small atomic commits. On every commit Husky runs:
   - `pre-commit` → `lint-staged` (ESLint + Prettier on changed files)
   - `commit-msg` → `commitlint` (Conventional Commits)
3. **Push** to the feature branch:

   ```
   git push -u origin feat/your-slug
   ```

   Husky `pre-push` runs the **full quality gate locally** (same as CI):
   - `pnpm lint` (max-warnings=0)
   - `pnpm typecheck` (tsc --noEmit across all workspaces)
   - `pnpm test:ci` (vitest with **100% coverage threshold enforced**)

   Push is rejected if any gate fails. Bypass with `--no-verify` is discouraged.

4. **Open a PR** against `main` and fill the PR template.
5. **CI re-runs all gates** in a clean environment (lint, typecheck, test, build, docker).
6. **(Optional) Add labels**: `preview` deploys a Firebase Hosting preview
   channel; adding `e2e` as well runs Playwright against the preview URL.
7. **Request reviewer** per CODEOWNERS (4h SLA).
8. **Address review** — push fixup commits; pre-commit / pre-push enforced again.
9. **Squash-merge to `main`** when approved. Feature branch is auto-deleted.
10. **Staging deploys automatically** via `deploy-staging.yml` on push to `main`.

## Releases (production)

```bash
# Verify staging is healthy. Run regression checklist.
git checkout main && git pull
git tag -a v0.2.0 -m "Sprint 2 — Auth + Products CRUD"
git push origin v0.2.0
```

The tag push triggers `deploy-production.yml`, which builds and deploys to
Cloud Run + Firebase Hosting production targets. Deploy failure pages the
on-call via Slack + PagerDuty.

## Hotfix

Same flow as a feature — hotfixes still go through `main` via PR:

```bash
git checkout main && git pull
git checkout -b hotfix/auth-bypass
# ... fix ...
git commit -m "hotfix(backend): close auth bypass"
git push -u origin hotfix/auth-bypass
# Open PR → review → squash-merge.
# Cut a new SemVer tag immediately after merge.
git checkout main && git pull
git tag -a v0.2.1 -m "Hotfix release"
git push origin v0.2.1
```

## Forbidden

- `--no-verify` on any Husky hook (discouraged; document why in the PR if unavoidable).
- `git push --force` to `main`.
- Direct commits to `main` (must go through PR).
- Merge commits (squash only; linear history enforced).
- Self-approval on PRs.
- Deleting `main`.

## Branch protection on `main`

Configured on GitHub:

- Required CI checks: `install`, `lint`, `typecheck`, `test`, `build`, `docker`.
- Required reviews: ≥ 1 CODEOWNERS approval.
- Linear history (squash merges only).
- Force push blocked.
- Branch deletion blocked.
- Conversation resolution required before merge.
