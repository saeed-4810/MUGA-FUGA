# Database Schema

Firestore stores product and artist metadata. Image bytes live in Storage; product/artist documents store object paths or derived URLs.

## `products/{productId}`

| Field                       | Type       | Notes                                     |
| --------------------------- | ---------- | ----------------------------------------- |
| `id`                        | string     | Mirrors Firestore document id.            |
| `name`                      | string     | Product name, max 120 characters.         |
| `artistId`                  | string     | Foreign key to `artists/{artistId}`.      |
| `coverArtPath`              | string     | Storage path under `cover-art/{uid}/...`. |
| `coverArtUrl`               | string     | Optional resolved delivery URL.           |
| `status`                    | enum       | `pending`, `published`, or `rejected`.    |
| `ownerUid`                  | string     | Firebase UID of submitter.                |
| `ownerEmail`                | string     | Submitter email for audit display.        |
| `createdAt` / `updatedAt`   | ISO string | Lifecycle timestamps.                     |
| `approvedAt` / `approvedBy` | optional   | Set by admin moderation.                  |
| `rejectionReason`           | optional   | Set when rejected.                        |

Product reads include a response-only `artist` object so artist renames show up without rewriting every product.

## `artists/{artistId}`

| Field                       | Type       | Notes                                         |
| --------------------------- | ---------- | --------------------------------------------- |
| `id`                        | string     | Mirrors Firestore document id.                |
| `name`                      | string     | Display name, max 120 characters.             |
| `name_lc`                   | string     | Lowercase uniqueness key.                     |
| `slug`                      | string     | Server-generated kebab slug.                  |
| `bio`                       | string     | Optional biography, max 2000 characters.      |
| `imageObjectPath`           | string     | Storage path under `artist-images/{uid}/...`. |
| `imageUrl`                  | string     | Optional resolved image URL.                  |
| `country`                   | string     | Optional ISO-2 country code.                  |
| `status`                    | enum       | `pending`, `published`, or `rejected`.        |
| `ownerUid` / `ownerEmail`   | string     | Creator identity.                             |
| `createdAt` / `updatedAt`   | ISO string | Lifecycle timestamps.                         |
| `approvedAt` / `approvedBy` | optional   | Set by admin moderation.                      |
| `rejectionReason`           | optional   | Set when rejected.                            |

## Auth claims

Roles live in Firebase Auth custom claims, not in a Firestore users collection.

| Claim  | Value                 |
| ------ | --------------------- |
| `role` | `admin` or `customer` |

## Indexes

Declared in `firestore.indexes.json`:

- `products(status, createdAt)` for admin status lists.
- `products(ownerUid, createdAt)` for owner-scoped lists.
- `artists(status, createdAt)` for public/admin lists.
- `artists(ownerUid, createdAt)` for customer artist requests.
- `artists(ownerUid, status, createdAt)` for owner/status dashboard views.

## Rules

Direct browser writes to `products` and `artists` are blocked. The backend writes through Firebase Admin. Firestore and Storage rules remain a defense-in-depth layer for direct client access and image constraints.
