# Product Scenario Catalog

## Auth and product scenarios

| ID          | Scenario                                                                                   |
| ----------- | ------------------------------------------------------------------------------------------ |
| P-AUTH-001  | First-time customer signs in with Google and receives `customer`.                          |
| P-AUTH-002  | Allow-listed admin signs in and receives `admin`.                                          |
| P-AUTH-003  | Returning user keeps a valid session after token refresh.                                  |
| P-PROD-001  | Customer submits a product and it starts as `pending`.                                     |
| P-PROD-002  | Admin submits a product and may publish immediately.                                       |
| P-PROD-003  | Customer sees published products plus own scoped records.                                  |
| P-PROD-004  | Admin sees all products with status filtering.                                             |
| P-PROD-005  | Owner can edit/delete own product.                                                         |
| P-PROD-006  | Admin can edit/delete any product.                                                         |
| P-ADMIN-001 | Admin approves pending product and it becomes visible.                                     |
| P-ADMIN-002 | Admin rejects pending product with optional reason.                                        |
| P-ADMIN-003 | Re-approving an already published product returns conflict.                                |
| P-IMG-001   | Valid cover art uploads succeed.                                                           |
| P-IMG-002   | Oversize or unsupported images are rejected.                                               |
| P-IMG-003   | Deleting product best-effort deletes image object.                                         |
| P-I18N-001  | Locale switch updates visible strings.                                                     |
| P-THEME-001 | Theme switch updates surfaces and persists.                                                |
| P-OPS-001   | OpenAPI docs are reachable.                                                                |
| P-OPS-002   | Sentry receives backend and browser events with environment and release tags.              |
| P-OPS-003   | Web-vitals are reported.                                                                   |
| P-OPS-004   | A safe staging alert reaches Slack, and production page routing is connected to PagerDuty. |
| P-OPS-005   | Readiness checks Firestore.                                                                |

## Artist scenarios

| ID           | Scenario                                                        |
| ------------ | --------------------------------------------------------------- |
| P-ARTIST-001 | Admin creates a published artist.                               |
| P-ARTIST-002 | Customer requests an artist and it starts pending.              |
| P-ARTIST-003 | Admin approval makes artist selectable.                         |
| P-ARTIST-004 | Admin rejection records a reason visible to owner.              |
| P-ARTIST-005 | Customer cannot see another customer's pending/rejected artist. |
| P-ARTIST-006 | Owner/admin update and delete rules apply.                      |
| P-ARTIST-007 | Artist delete is blocked when products reference it.            |
| P-ARTIST-008 | Duplicate artist names conflict case-insensitively.             |
| P-ARTIST-009 | Artist image upload follows the signed URL rules.               |
| P-PROD-007   | Customer product requires a published artist.                   |
| P-PROD-008   | Admin can override and attach product to pending artist.        |
| P-PROD-009   | Artist rename updates product display on next read.             |
