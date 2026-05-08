# ADR-003: Auth and RBAC

## Context

The app needs Google login and two roles: customer and admin. Admins approve products and artists before they become visible. Authorization needs to be fast, testable, and enforced by the backend rather than by hidden buttons in the UI.

## Options considered

1. **Firebase Auth custom claims** — role travels on the ID token and is verified by Firebase Admin.
2. **Firestore user document lookup** — flexible, but every protected request needs a database read.
3. **Third-party auth provider** — unnecessary for a Firebase-based take-home.

## Decision

Use Firebase Auth with Google provider. Store `role` as a Firebase custom claim.

First sign-in calls `POST /me/bootstrap`. The backend verifies the token and assigns:

- `admin` when the email is in `INITIAL_ADMIN_EMAILS`;
- otherwise `customer`.

Protected API requests send `Authorization: Bearer <Firebase ID token>`. Admin-only routes use a role guard. Next.js SSR pages use the `__session` cookie described in ADR-008.

## Consequences

- Backend authorization is stateless on the hot path.
- A newly assigned role requires a forced token refresh.
- Future admin promotion can be handled by changing the allow-list or adding an admin management endpoint.

## Rollback

Replace custom claims with a `users/{uid}` Firestore document and update auth middleware plus Firestore rules.
