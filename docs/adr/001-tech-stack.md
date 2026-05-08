# ADR-001: Tech stack

## Context

The assignment requires a Node.js backend, a React frontend, Firebase hosting, Google login, admin approval, i18n, theming, monitoring, and CI/CD. The stack needed to be simple enough for a take-home project but strong enough to show production judgment.

## Options considered

1. **Node + Express + React** — small, familiar, easy to test, and fits Firebase well.
2. **Fastify + Next.js from day one** — strong SSR story, but more deployment complexity up front.
3. **NestJS + React** — structured, but too heavy for the size of the API.

## Decision

- Backend: Node 20, Express 4, TypeScript strict ESM, Zod, Firebase Admin, Pino, Sentry, Helmet, CORS.
- Frontend: now Next.js App Router SSR, React 18, TypeScript strict, Tailwind CSS, react-i18next, Firebase Web SDK, Sentry, web-vitals.
- Tests: Vitest, Supertest, Playwright, v8 coverage.
- Workspace: pnpm 9 workspaces.

ADR-008 replaces the original static frontend deployment choice with a Next.js SSR service on Cloud Run.

## Consequences

- Express keeps API contracts explicit and easy to test.
- Zod gives runtime validation and type-aligned domain schemas.
- Next.js adds an SSR boundary that must be tested carefully, especially around Firebase Auth and browser-only code.
- The app has two Cloud Run services rather than one static frontend and one backend.

## Rollback

Backend rollback is a normal code revert. Frontend rollback is documented in ADR-008: restore static Hosting routing and remove the `muga-frontend` Cloud Run rewrite.
