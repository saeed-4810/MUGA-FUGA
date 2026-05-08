# RBAC Matrix

| Capability                       | Customer    | Admin      | Notes                                                              |
| -------------------------------- | ----------- | ---------- | ------------------------------------------------------------------ |
| Sign in with Google              | Yes         | Yes        | All users authenticate through Firebase Auth.                      |
| Read own profile                 | Yes         | Yes        | `GET /me`.                                                         |
| Bootstrap role                   | Yes         | Yes        | Admin only when email is in the allow-list.                        |
| Request signed upload URL        | Yes         | Yes        | Content type and size are validated.                               |
| Create product                   | Yes         | Yes        | Customer product starts pending; admin may publish directly.       |
| Read published products          | Yes         | Yes        | Normal catalog view.                                               |
| Read own product any status      | Yes         | Yes        | Customer can see their pending/rejected submissions.               |
| Read any product                 | No          | Yes        | Admin queue and status filters.                                    |
| Update/delete product            | Own records | Any record | Subject to backend ownership checks.                               |
| Approve/reject product           | No          | Yes        | Admin-only moderation.                                             |
| Create/request artist            | Yes         | Yes        | Customer artist starts pending; admin artist may publish directly. |
| Read published artists           | Yes         | Yes        | Used by product artist combobox.                                   |
| Read own artist any status       | Yes         | Yes        | Customer dashboard/request history.                                |
| Read any artist                  | No          | Yes        | Admin moderation.                                                  |
| Update/delete artist             | Own records | Any record | Delete blocked when products reference the artist.                 |
| Approve/reject artist            | No          | Yes        | Admin-only moderation.                                             |
| Attach product to pending artist | No          | Yes        | Admin override, audit-logged.                                      |

## Enforcement points

- Frontend hides unavailable navigation/actions.
- Next.js SSR guards protected/admin pages.
- Express verifies tokens and roles on API requests.
- Firestore and Storage rules provide defense in depth.
- Backend validation enforces artist existence and status rules.
