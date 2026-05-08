# Test Scenarios and E2E Coverage

MUGA keeps tests tied to named scenarios. That makes it easier to see why a test exists and which part of the assignment it protects.

## Test layers

| Layer           | Tooling                  | Used for                                                            |
| --------------- | ------------------------ | ------------------------------------------------------------------- |
| Unit            | Vitest                   | Pure functions, schemas, helpers, reducers, utilities.              |
| Component       | Vitest + Testing Library | React UI states, accessibility contracts, theme/locale behaviour.   |
| API integration | Vitest + Supertest       | Express routes, auth middleware, validation, error envelopes.       |
| E2E             | Playwright               | Browser flows, route guards, SSR behaviour, product/admin journeys. |

## Scenario naming

| Prefix | Meaning                   | Example                                                     |
| ------ | ------------------------- | ----------------------------------------------------------- |
| `P-*`  | Product/business scenario | `P-PROD-001` product creation starts pending for customers. |
| `U-*`  | UX/state scenario         | `U-PROD-001` product list loading state.                    |
| `T-*`  | Technical/API scenario    | `T-PROD-001` product create happy path.                     |
| `E-*`  | End-to-end scenario       | `E-PROD-001` product create browser flow.                   |

Tests should include the scenario ID in the test name. That keeps the code searchable and makes it clear why each test exists.

## Current E2E flow set

| File pattern                     | Covers                                                         |
| -------------------------------- | -------------------------------------------------------------- |
| `e2e/E-SHELL-001.spec.ts`        | App shell, brand, theme/locale controls.                       |
| `e2e/E-AUTH-001.spec.ts`         | Login and auth route guards.                                   |
| `e2e/E-PROD-001.spec.ts`         | Product create journey and signed upload path.                 |
| `e2e/E-ADMIN-001.spec.ts`        | Admin product approval queue.                                  |
| `e2e/E-ARTIST-ADMIN-001.spec.ts` | Admin artist moderation.                                       |
| `e2e/E-SSR-*.spec.ts`            | SSR session, role guards, and server-rendered route behaviour. |

The exact status of each scenario is maintained in [`./qa/coverage-matrix.md`](./qa/coverage-matrix.md).

## Commands

Run from `code/`:

```bash
pnpm lint
pnpm typecheck
pnpm test:ci
pnpm --filter @muga/frontend e2e
pnpm build
```

Workspace-specific checks:

```bash
pnpm --filter @muga/backend test -- --coverage
pnpm --filter @muga/frontend test -- --coverage
pnpm --filter @muga/backend build
pnpm --filter @muga/frontend build
```

## Coverage expectations

- 100% statements, branches, functions, and lines on changed source files.
- No scenario without a test.
- No test without a scenario ID where it is part of feature coverage.
- New Playwright specs follow `E-<FLOW>-NNN.spec.ts` naming.
- Manual checks are kept for cases where automation is not practical, and they should include the steps and result.

## What to test for common features

### Auth and RBAC

- Missing token returns 401.
- Invalid or expired token returns 401.
- Customer calling admin route returns 403.
- Admin route succeeds for `role: admin`.
- SSR protected page redirects when `__session` is missing.
- Logout clears the session cookie.

### Products

- Customer-created product starts pending.
- Admin-created or admin-approved product becomes published.
- Invalid body returns `VALIDATION_ERROR`.
- Missing artist returns `ARTIST_NOT_FOUND`.
- Customer using non-published artist returns `ARTIST_NOT_PUBLISHED`.
- List visibility differs by role.

### Uploads

- Supported image content types are accepted.
- Unsupported content types are rejected.
- Files over the max size are rejected.
- Signed URL response includes object path and expiry.
- Browser upload failure does not create the product row.

### UI states

- Loading, empty, success, error, and blocked states.
- EN/NL copy parity.
- Light/dark theme parity.
- Focus visibility and dialog accessibility.
- Reduced-motion handling where motion is used.

## What I include when reviewing a change

For feature work, I note the commands run, the coverage result, and the scenario IDs touched. That is enough to connect the code change back to the assignment requirement it supports.
