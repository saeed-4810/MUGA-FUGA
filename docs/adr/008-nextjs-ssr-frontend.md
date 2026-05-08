# ADR-008: Next.js App Router SSR on Cloud Run

This replaces the original frontend routing/deployment choice in ADR-001.

## Context

The frontend moved from the original static React direction to Next.js App Router SSR. The hard part is authentication: Firebase Auth starts in the browser, but server-rendered protected routes need auth state the server can verify.

## Options considered

1. **Next.js App Router SSR on Cloud Run** — chosen; supports SSR while keeping Firebase Hosting as the public entrypoint.
2. **Static export or SPA bridge** — simpler, but does not provide the desired server-rendered route model.
3. **Keep Vite + React Router** — lowest migration risk, but no longer matches the chosen target.
4. **Merge UI server into backend API** — fewer services, but mixes API and UI ownership.

## Decision

Deploy the frontend as `muga-frontend` on Cloud Run. Firebase Hosting rewrites app routes to it and keeps `/api/**` pointed at `muga-backend`.

SSR auth uses a Firebase Admin-verified cookie named `__session`. That name matters because Firebase Hosting forwards it to Cloud Run. Browser-only Firebase Auth, local storage, upload controls, dialogs, and theme/locale controls stay in Client Components.

## Consequences

- Authenticated route shells can render server-side.
- Hosting rewrite order becomes release-critical.
- The app now has two Cloud Run services.
- Tests must cover missing/expired sessions, admin denial, logout, `/api/**` rewrite behaviour, and browser-only guards.

## Rollback

Restore the static frontend Hosting path and remove the `muga-frontend` Cloud Run rewrite. Keep the Express backend and Firestore data unchanged.
