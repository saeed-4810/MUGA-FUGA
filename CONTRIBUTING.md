# Contributing to MUGA

This document explains how to ship code: branch policy, commit conventions,
review gates, and quality gates.

See [`GIT_WORKFLOW.md`](./GIT_WORKFLOW.md) for the full workflow diagram and
release process.

## TL;DR

```
git checkout main && git pull
git switch -c feat/your-change-slug
# code...
git add -A
git commit -m "feat(frontend): short subject in lowercase"
git push -u origin feat/your-change-slug
# Husky pre-push runs lint + typecheck + test:ci locally.
# Open PR → CI green → CODEOWNERS review → squash merge.
# Merge to main auto-deploys staging.
```

## Branching (GitHub Flow)

| Branch                | Purpose                                                                                                                 |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `main`                | Integration + staging. Every merge auto-deploys to **staging**. Production deploys on SemVer tag (`vX.Y.Z`). Protected. |
| `<type>/<kebab-slug>` | Short-lived feature / fix / chore branches. Cut from `main`, squash-merged back to `main`.                              |

**No `develop` branch.** Staging always reflects `main`.

Allowed types: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `ci`, `hotfix`, `perf`, `build`, `revert`.

## Commit messages

Conventional Commits, validated by `commitlint`.

```
<type>(<scope>): <subject>
```

Allowed scopes: `backend`, `frontend`, `root`, `ci`, `docs`, `deps`, `firebase`.

Subject must be lowercase. Body lines must not exceed 100 characters.

## Husky hooks

- `pre-commit` — `lint-staged` (Prettier + ESLint --fix on staged files)
- `commit-msg` — `commitlint` (Conventional Commits)
- `pre-push` — `pnpm lint` + `pnpm typecheck` + `pnpm test:ci` (100% coverage threshold)

Bypassing with `--no-verify` is discouraged. If unavoidable, document why in
the PR description.

## Quality gates (CI)

On PR to `main` and on push to `main`:

- install → lint → typecheck → test (with 100% coverage threshold) → build → docker → lighthouse (PR only)

End-to-end tests (Playwright) run **after deploy** — against the preview
channel for labelled PRs (see `Preview channels` below) and against live
staging on every merge to `main`.

## Per-role review gate

CODEOWNERS auto-assigns reviewers based on the changed paths:

| Path                       | Reviewer      |
| -------------------------- | ------------- |
| `apps/backend/**`          | Backend       |
| `apps/frontend/**`         | Frontend      |
| `apps/frontend/e2e/**`     | QA + Frontend |
| `*.test.*` / `*.spec.*`    | QA            |
| `firestore.*`, `storage.*` | Backend       |
| `.github/**`               | Backend       |
| `docs/**`                  | Doc owner     |

## Preview channels (opt-in, label-gated)

Add the `preview` label to a PR to deploy a Firebase Hosting preview channel
and run Playwright E2E against the preview URL. Without the label, no preview
is created and CI runs in its standard fast-path mode.

The preview shares the staging backend via the `/api/**` rewrite. The
channel is auto-deleted on PR close or label removal.

## DoR before pulling work

Work is **Ready** only if:

- Owner + supporters identified
- Acceptance criteria are binary and testable
- Test scenarios declared across product, UX, technical, and E2E tracks
- Canonical doc linked (PRD section, ADR, UX flow) for non-trivial changes
- Contract row exists for any backend route change
- i18n keys + theme coverage declared (or `N/A` with a one-line reason)

## DoD before closing

- All ACs pass with evidence on the PR
- 100% scenario + 100% line coverage on changed files
- PR squash-merged to `main`; feature branch auto-deleted
- Decision log updated for material decisions

## Release

- Verify staging is healthy after the merge that cuts the release
- Tag `vX.Y.Z` on `main` → triggers production deploy via `deploy-production.yml`
