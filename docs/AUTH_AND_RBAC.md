# Auth and RBAC

MUGA uses Firebase Auth for identity and Firebase custom claims for role-based access. The important rule is simple: the UI can hide actions, but the backend decides what is allowed.

## Roles

| Role       | Purpose                                                                                                                      |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `customer` | Creates products, uploads cover art, requests artists, and sees published catalog items plus their own relevant submissions. |
| `admin`    | Moderates products and artists, can see all statuses, and can approve or reject pending records.                             |

Roles are stored as Firebase Auth custom claims. The backend reads the claim after verifying the Firebase ID token; it does not trust role values sent in request bodies or query strings.

## Browser sign-in flow

```
User clicks "Sign in with Google"
  → Firebase Web SDK opens Google provider popup
  → Browser receives Firebase ID token
  → Frontend calls POST /me/bootstrap on the Express API
  → Backend verifies token and sets/normalizes role claim
  → Frontend forces ID token refresh
  → Frontend calls POST /session on the Next.js app
  → Next.js sets __session HttpOnly cookie for SSR route guards
```

`/me/bootstrap` is where first-time role assignment happens. Emails listed in `INITIAL_ADMIN_EMAILS` become admins; everyone else becomes a customer.

## API authentication

Every protected Express route expects:

```http
Authorization: Bearer <Firebase ID token>
```

The backend middleware:

1. Verifies the token with Firebase Admin.
2. Extracts `uid`, `email`, `emailVerified`, and `role`.
3. Attaches the user to the request.
4. Rejects missing, expired, or invalid tokens with the shared API error shape.

Admin-only routes add a second guard:

```ts
requireRole("admin");
```

Examples:

- `POST /products/:id/approve`
- `POST /products/:id/reject`
- `POST /api/artists/:id/approve`
- `POST /api/artists/:id/reject`

## SSR authentication

Next.js App Router routes cannot rely only on in-browser Firebase state. Protected server-rendered routes use the `__session` cookie instead.

The cookie is:

- named `__session` so Firebase Hosting forwards it to Cloud Run,
- `HttpOnly` so scripts cannot read it,
- `Secure` outside local development,
- `SameSite=Lax`,
- bounded by a max age,
- verified server-side with Firebase Admin, including revocation checks where required.

The frontend owns two route handlers:

| Route             | Purpose                                           |
| ----------------- | ------------------------------------------------- |
| `POST /session`   | Accepts a Firebase ID token and sets `__session`. |
| `DELETE /session` | Clears `__session` on logout.                     |

## Access rules by feature

| Feature                | Customer                       | Admin                   | Enforced by                                       |
| ---------------------- | ------------------------------ | ----------------------- | ------------------------------------------------- |
| Read own profile       | Yes                            | Yes                     | API token verification.                           |
| Create product         | Yes                            | Yes                     | Product API, Zod schemas, auth middleware.        |
| List products          | Published + own scoped records | All statuses            | Backend query rules and role checks.              |
| Approve/reject product | No                             | Yes                     | `requireRole('admin')`.                           |
| Create/request artist  | Yes                            | Yes                     | Artist API and status defaults.                   |
| Approve/reject artist  | No                             | Yes                     | `requireRole('admin')`.                           |
| SSR protected pages    | Yes after valid session        | Yes after valid session | Next.js server helpers.                           |
| SSR admin pages        | No                             | Yes                     | Next.js server role guard plus backend API guard. |

## Common failure modes

| Symptom                                         | Likely cause                                    | Fix                                                                           |
| ----------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------- |
| User signs in but remains customer              | Token was not refreshed after `/me/bootstrap`.  | Force `getIdToken(true)` before setting session.                              |
| SSR route treats a signed-in user as logged out | `__session` missing, expired, or not forwarded. | Check `/session` route, cookie flags, Hosting rewrite, and cookie name.       |
| Admin API returns 403                           | ID token lacks `role: admin`.                   | Check `INITIAL_ADMIN_EMAILS`, bootstrap response, and refreshed token claims. |
| Preview sign-in fails                           | Preview domain not allowed in Firebase Auth.    | Add staging `web.app` wildcard as documented in `INFRA_SETUP.md`.             |

## References

- ADR: [`./adr/003-auth-and-rbac.md`](./adr/003-auth-and-rbac.md)
- SSR ADR: [`./adr/008-nextjs-ssr-frontend.md`](./adr/008-nextjs-ssr-frontend.md)
- API contracts: [`./api/api-spec.md`](./api/api-spec.md)
- Secrets/config: [`SECRETS.md`](./SECRETS.md)
