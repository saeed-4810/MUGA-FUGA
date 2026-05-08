# ADR-004: Image CDN and signed upload URLs

## Context

Product cover art and artist images need to be uploaded safely and delivered quickly. The backend should not spend CPU or memory receiving image bytes.

## Options considered

1. **Browser uploads directly to Storage with a signed URL** — backend validates metadata and signs a short-lived upload URL.
2. **Multipart upload through Express** — simpler shape, but doubles bandwidth through the API and risks Cloud Run memory pressure.
3. **Firebase Web SDK direct upload** — works, but couples browser code too tightly to bucket structure.

## Decision

Use a two-step signed upload flow:

1. Browser asks the backend for a signed URL with `contentType` and `fileSize`.
2. Backend validates image type and 5 MB limit, then signs a v4 `PUT` URL.
3. Browser uploads directly to Storage.
4. Browser creates or updates metadata through the API using the returned object path.

## Consequences

- Express stays focused on API contracts and metadata.
- Bucket CORS must be configured because the browser uploads directly to Storage.
- The UI needs upload progress and a clean error state for failed PUT requests.

## Rollback

Add multipart handling to the product/artist routes and save bytes through the Admin SDK. That is mechanically simple but less efficient.
