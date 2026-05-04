# Contributing to MUGA

Thanks for picking up a MUGA ticket! This document explains how the team
ships code: branch policy, commit conventions, review gates, and quality
gates.

See [`GIT_WORKFLOW.md`](./GIT_WORKFLOW.md) for the full workflow diagram and
release process.

## TL;DR

```
git checkout main && git pull
git switch -c feat/MUGA-7-product-list-ui
# code...
git add -A
git commit -m "feat(frontend): product list UI (MUGA-7)"
git push -u origin feat/MUGA-7-product-list-ui
# Husky pre-push runs lint + typecheck + test:ci locally.
# Open PR feat/MUGA-7-... → main, get CI green, CODEOWNERS review, squash merge.
# Merge to main auto-deploys staging.
```

Open a PR, wait for CI green, request CODEOWNERS reviewer, run the role
TestRunner + Verifier subagents, then squash-merge to `main`.

## Branching (GitHub Flow)

| Branch                         | Purpose                                                                                                                 |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `main`                         | Integration + staging. Every merge auto-deploys to **staging**. Production deploys on SemVer tag (`vX.Y.Z`). Protected. |
| `<type>/MUGA-xxx-<kebab-slug>` | Short-lived feature / fix / chore branches. Cut from `main`, squash-merged back to `main`.                              |

**No `develop` branch.** Staging always reflects `main`.

Allowed types: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `ci`, `hotfix`, `perf`, `build`, `revert`.

## Commit messages

Conventional Commits, validated by `commitlint`.

```
<type>(<scope>): <subject>
```

Allowed scopes: `backend`, `frontend`, `root`, `ci`, `docs`, `deps`, `firebase`.

## Husky hooks

- `pre-commit` — `lint-staged` (Prettier + ESLint --fix on staged files)
- `commit-msg` — `commitlint` (Conventional Commits)
- `pre-push` — `pnpm lint` + `pnpm typecheck` + `pnpm test:ci` (100% coverage threshold)

Bypassing with `--no-verify` requires Decision Log approval (OPERATING_DOR_DOD.md §10.6).

## Quality gates (CI)

On PR to `main` and on push to `main`:

- install → lint → typecheck → test (with 100% coverage threshold) → build → e2e → docker → lighthouse (PR only)

## Per-role review gate

CODEOWNERS auto-assigns the right reviewer:

| Path                              | Reviewer      |
| --------------------------------- | ------------- |
| `apps/backend/**`                 | Backend       |
| `apps/frontend/**`                | Frontend      |
| `apps/frontend/e2e/**`            | QA + Frontend |
| `*.test.*` / `*.spec.*`           | QA            |
| `firestore.*`, `storage.*`        | Backend       |
| `.github/**`                      | Backend       |
| `docs/ux/**`                      | UX            |
| `docs/product/**`                 | Product       |
| `docs/qa/**`                      | QA            |
| `.tasks/**`, `docs/governance/**` | Scrum Master  |

## DoR before pulling a ticket

A ticket is **Ready** only if:

- Owner + supporters assigned
- Acceptance criteria are binary and testable
- Scenario IDs declared across P/U/T/E tracks
- Canonical doc linked (PRD section, ADR, UX flow)
- Contract row (CTR-xxx) exists for any backend route changes
- i18n keys + theme coverage declared (or "Analytics: N/A" / "Product decisions: None")

## DoD before closing a ticket

- All ACs pass with evidence on the ticket
- TestRunner agent verdict: PASS
- Verifier agent verdict: PASS
- 100% scenario + 100% line coverage on changed files
- PR squash-merged to `main`; feature branch auto-deleted
- Ticket moved from `In Progress` → `Done` → archive
- Decision log updated for material decisions

## Release

- Verify staging is healthy after the merge that cuts the release.
- Tag `vX.Y.Z` on `main` → triggers production deploy via `deploy-production.yml`.
- Record the release in `docs/governance/decision-log.md`.
