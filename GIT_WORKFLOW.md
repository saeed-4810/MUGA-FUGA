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
       feat/MUGA-3-...  ▼      fix/MUGA-12-...
   (branch cut from main)    (branch cut from main)
                        │                │
                    (PR squash-merge → main)
```

- **`main`** — the single long-lived branch. Merge to `main` = deploy to staging.
- **`<type>/MUGA-xxx-<slug>`** — short-lived feature branches cut from `main`.
- **`vX.Y.Z` tags on `main`** — trigger production deploy.

## Naming

```
<type>/MUGA-xxx-<kebab-slug>
```

Allowed types (must match commit type):

`feat | fix | chore | docs | test | refactor | ci | hotfix | perf | build | revert`

Examples:

- `feat/MUGA-3-backend-products-crud`
- `fix/MUGA-42-signed-url-ttl`
- `docs/MUGA-18-adr-alerting`
- `hotfix/MUGA-99-auth-bypass`

## Lifecycle

1. **Pull ticket from `📝 To Do`** — confirm DoR (OPERATING_DOR_DOD.md §3).
2. **Move ticket to `🚀 In Progress`** on the kanban.
3. **Create branch off `main`**:
   ```
   git checkout main && git pull
   git checkout -b feat/MUGA-xxx-<slug>
   ```
4. **Implement** in small atomic commits. On every commit Husky runs:
   - `pre-commit` → `lint-staged` (ESLint + Prettier on changed files)
   - `commit-msg` → `commitlint` (Conventional Commits)
5. **Push** to the feature branch:

   ```
   git push -u origin feat/MUGA-xxx-<slug>
   ```

   Husky `pre-push` runs the **full quality gate locally** (same as CI):
   - `pnpm lint` (max-warnings=0)
   - `pnpm typecheck` (tsc --noEmit across all workspaces)
   - `pnpm test:ci` (vitest with **100% coverage threshold enforced**)

   Push is rejected if any gate fails. Bypass with `--no-verify` is **not permitted** without a Decision Log entry (OPERATING_DOR_DOD.md §10.6).

6. **Open PR** `feat/…` → `main` with the PR template filled.
7. **CI re-runs all gates** in a clean environment + Playwright E2E + Docker build + Lighthouse (on PR).
8. **Request reviewer** per CODEOWNERS (4h SLA per WAY_OF_WORKING.md §3).
9. **Run the role's TestRunner agent** — must return PASS.
10. **Run the role's Verifier agent** — must return PASS.
11. **Address review** — push fixup commits; pre-commit / pre-push enforced again.
12. **Squash-merge to `main`** when approved. Feature branch is auto-deleted.
13. **Staging deploys automatically** via `deploy-staging.yml` on push to `main`.
14. **Move ticket** `🚀 In Progress` → `✅ Done` → archive in `.tasks/archive.md`.
15. **Decision log** entry if the change involved a material decision.

## Releases (production)

```bash
# Verify staging is healthy. Run regression checklist.
git checkout main && git pull
git tag -a v0.2.0 -m "Sprint 2 — Auth + Products CRUD"
git push origin v0.2.0
```

The tag push triggers `deploy-production.yml`, which builds and deploys to Cloud Run + Firebase Hosting production targets. Deploy failure pages the on-call via Slack + PagerDuty (alert A9).

Record the release in `docs/governance/decision-log.md`.

## Hotfix

Same flow as a feature — hotfixes still go through `main` via PR:

```bash
git checkout main && git pull
git checkout -b hotfix/MUGA-99-auth-bypass
# ... fix ...
git commit -m "hotfix(backend): close auth bypass (MUGA-99)"
git push -u origin hotfix/MUGA-99-auth-bypass
# Open PR hotfix/... → main, get review, squash-merge.
# Cut a new SemVer tag immediately after merge.
git checkout main && git pull
git tag -a v0.2.1 -m "Hotfix: MUGA-99 auth bypass"
git push origin v0.2.1
```

## Forbidden

- `--no-verify` on any Husky hook without a Decision Log entry + approval from Backend or Scrum Master.
- `git push --force` to `main`.
- Direct commits to `main` (must go through PR).
- Merge commits (squash only; linear history enforced).
- Self-approval on PRs.
- Deleting `main`.

## Branch protection on `main`

Configured on GitHub:

- Required CI checks: `install`, `lint`, `typecheck`, `test`, `build`, `e2e`, `docker`, `lighthouse` (on PR).
- Required reviews: ≥ 1 CODEOWNERS approval.
- Linear history (squash merges only).
- Force push blocked.
- Branch deletion blocked.
- Conversation resolution required before merge.
