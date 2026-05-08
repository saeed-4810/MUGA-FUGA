# API Specification

The OpenAPI source lives in `apps/backend/src/config/openapi.ts`. Deployed environments expose the JSON spec at `/api/openapi.json` and Swagger UI at `/api/docs`.

The Swagger server URLs use the Firebase Hosting API base path:

- Local: `http://localhost:3001/api`
- Staging: `https://muga-staging.web.app/api`
- Production: `https://muga-production.web.app/api`

The path table below uses the same public `/api/...` shape that reviewers call from the browser.

## Conventions

- Protected routes require `Authorization: Bearer <Firebase ID token>`.
- Errors use `{ code, message, requestId, details? }`.
- Requests and responses are JSON unless the route is a health/docs endpoint.
- Role-sensitive reads are enforced by the backend and tested with scenario IDs.

## Frontend session route handlers

These are served by the Next.js frontend service, not by the Express API.

| ID       | Method | Path       | Purpose                                                            |
| -------- | ------ | ---------- | ------------------------------------------------------------------ |
| FE-SES-1 | POST   | `/session` | Exchanges a Firebase ID token for the `__session` HttpOnly cookie. |
| FE-SES-2 | DELETE | `/session` | Clears the SSR session cookie on logout.                           |

## Backend contract rows

| ID       | Method | Path                             | Auth        | Purpose                                                  |
| -------- | ------ | -------------------------------- | ----------- | -------------------------------------------------------- |
| CTR-000  | GET    | `/api/health`                    | Public      | Liveness check.                                          |
| CTR-000b | GET    | `/api/healthz/ready`             | Public      | Readiness check; verifies Firestore responds.            |
| CTR-001  | GET    | `/api/me`                        | User        | Return current authenticated user.                       |
| CTR-001b | POST   | `/api/me/bootstrap`              | User        | Assign or confirm `customer`/`admin` role claim.         |
| CTR-002  | POST   | `/api/products/signed-upload`    | User        | Validate cover-art metadata and issue signed upload URL. |
| CTR-003  | POST   | `/api/products`                  | User        | Create product; customer defaults to `pending`.          |
| CTR-004  | GET    | `/api/products?status=`          | User        | List visible products; admin may filter by status.       |
| CTR-005  | GET    | `/api/products/{id}`             | User        | Read visible product by id.                              |
| CTR-006  | PATCH  | `/api/products/{id}`             | Owner/admin | Update editable product fields.                          |
| CTR-007  | DELETE | `/api/products/{id}`             | Owner/admin | Delete product and best-effort image object.             |
| CTR-008  | POST   | `/api/products/{id}/approve`     | Admin       | Publish pending product.                                 |
| CTR-009  | POST   | `/api/products/{id}/reject`      | Admin       | Reject product with optional reason.                     |
| CTR-DOCS | GET    | `/api/docs`, `/api/openapi.json` | Public      | API documentation.                                       |

## Artist contracts

| ID      | Method | Path                         | Auth        | Purpose                                                              |
| ------- | ------ | ---------------------------- | ----------- | -------------------------------------------------------------------- |
| CTR-100 | POST   | `/api/artists/signed-upload` | User        | Validate artist image metadata and issue signed upload URL.          |
| CTR-101 | POST   | `/api/artists`               | User        | Create artist; customer defaults to `pending`, admin to `published`. |
| CTR-102 | GET    | `/api/artists`               | User        | List visible artists; admin may filter by status.                    |
| CTR-103 | GET    | `/api/artists/{id}`          | User        | Read visible artist by id.                                           |
| CTR-104 | PATCH  | `/api/artists/{id}`          | Owner/admin | Update artist fields.                                                |
| CTR-105 | DELETE | `/api/artists/{id}`          | Owner/admin | Delete artist unless products reference it.                          |
| CTR-106 | POST   | `/api/artists/{id}/approve`  | Admin       | Publish artist.                                                      |
| CTR-107 | POST   | `/api/artists/{id}/reject`   | Admin       | Reject artist with optional reason.                                  |

## Error codes

| Status | Code                   | Meaning                                                       |
| ------ | ---------------------- | ------------------------------------------------------------- |
| 400    | `VALIDATION_ERROR`     | Zod request validation failed.                                |
| 401    | `UNAUTHENTICATED`      | Missing, expired, or invalid token.                           |
| 403    | `FORBIDDEN`            | Authenticated user lacks the required role or ownership.      |
| 404    | `NOT_FOUND`            | Record missing or intentionally hidden from this user.        |
| 409    | `CONFLICT`             | State, uniqueness, or FK conflict.                            |
| 422    | `ARTIST_NOT_FOUND`     | Product references a missing artist.                          |
| 422    | `ARTIST_NOT_PUBLISHED` | Customer tried to attach a product to a non-published artist. |
| 500    | `INTERNAL`             | Unexpected server error; details are not exposed to users.    |

## Observability

Every response carries `x-request-id`. Backend logs include `requestId`, user identity where available, route, status, and alert fields for moderation/audit events.

## Swagger freshness checks

The backend test suite checks that the OpenAPI document includes every shipped product, artist, auth, health, and readiness path. It also checks that the reviewer-facing server URLs use the current Firebase Hosting `/api` base path.
