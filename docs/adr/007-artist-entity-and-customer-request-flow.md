# ADR-007: Artist entity and customer request flow

## Context

The first product model used a free-text `artistName`. That satisfies the literal brief, but it creates duplicate artist names, makes artist profiles impossible, and gives admins no clear moderation point for artist branding.

## Options considered

1. **Keep free-text artist names** — simplest, but weak data quality.
2. **Admin-only artist creation** — clean curation, but customers get blocked when an artist is missing.
3. **Artist entity with customer request flow** — customers stay self-service while admins keep brand control.
4. **External catalog lookup** — useful later, too large for MVP.

## Decision

Make `Artist` a first-class Firestore entity with `pending`, `published`, and `rejected` states. Products store `artistId`, not `artistName`. Customers can request artists; admins approve or reject them. Products can be attached by customers only to published artists. Admins have an audited override path for pending artists.

## Consequences

- Artist names are deduplicated and editable in one place.
- Product listing dereferences artists at read time.
- Admins now have two moderation queues: products and artists.
- Deleting an artist is blocked when products reference it.

## Rollback

Recreate `artistName` on products from the referenced artist, revert product schemas/routes, and leave or archive the artists collection.
