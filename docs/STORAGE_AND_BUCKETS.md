# Storage and Buckets

MUGA stores user-uploaded images in Firebase Storage backed by Google Cloud Storage. The backend never receives image bytes; it validates upload intent and gives the browser a short-lived signed URL.

## Buckets

| Environment | Bucket                      |
| ----------- | --------------------------- |
| Staging     | `muga-staging-cover-art`    |
| Production  | `muga-production-cover-art` |

The bucket name says `cover-art`, but it also stores artist images. The current prefixes separate the use cases.

## Object prefixes

| Prefix                                        | Use                |
| --------------------------------------------- | ------------------ |
| `cover-art/{ownerUid}/{timestamp}-{uuid}`     | Product cover art. |
| `artist-images/{ownerUid}/{timestamp}-{uuid}` | Artist images.     |

The owner UID in the path is part of the security model. It makes it easy to reason about who requested the upload and who may later overwrite or remove an object.

## Upload flow

```
Browser
  → POST /products/signed-upload { contentType, fileSize }
Backend
  → verifies Firebase token
  → validates content type and max size
  → chooses object path under owner UID
  → signs a v4 PUT URL valid for a few minutes
Browser
  → PUT image bytes directly to Storage using signed URL
Browser
  → POST /products with product metadata and coverArtPath
```

Artist image uploads follow the same pattern through the artist signed-upload route.

## Validation rules

Allowed image types:

- `image/jpeg`
- `image/png`
- `image/webp`
- `image/avif`

Maximum file size:

- 5 MB

Validation happens before the signed URL is issued. Storage rules and IAM provide a second layer of protection.

## Why signed URLs

Signed URLs were chosen because they keep the Express API out of the file-transfer path.

Benefits:

- Lower backend memory and CPU pressure.
- No multipart parser needed for the main product API.
- Upload failure can be handled before metadata is written.
- IAM controls which service can mint URLs.
- Expiry limits the blast radius if a URL is copied.

Trade-off:

- Product creation needs two HTTP steps before metadata submission: request URL, then upload file. The UI handles this with progress and retry/error states.

## CORS

Signed browser uploads go directly to Cloud Storage, not through Express. That means Express CORS settings do not apply to the `PUT` request. Bucket CORS must allow the deployed frontend origins to upload with the expected headers.

CORS files:

- `storage-cors.staging.json`
- `storage-cors.production.json`

After updating CORS, apply it with `gcloud storage buckets update` as shown in [`INFRA_SETUP.md`](./INFRA_SETUP.md).

## Reads and CDN

Firebase Hosting is the public CDN entrypoint. Product and artist records store object paths or derived image URLs; the UI renders thumbnails through the configured delivery path.

For public catalog use, published cover art can be cached aggressively. Pending/rejected assets should still be treated carefully at the application level so customers cannot browse someone else's unpublished work through normal UI paths.

## Cleanup expectations

When a product or artist is deleted, the app should make a best-effort attempt to remove the associated image object. Metadata deletion is the source of truth; failed object cleanup should be logged for follow-up rather than blocking the API forever.

## Operational checks

Use these after infrastructure setup or CORS changes:

```bash
gcloud storage buckets describe gs://muga-staging-cover-art \
  --format="default(cors_config)"

gcloud storage buckets describe gs://muga-production-cover-art \
  --format="default(cors_config)"
```

Expected result: the relevant frontend origin can `PUT`, and `Content-Type` is allowed.

## References

- Image ADR: [`./adr/004-image-cdn-and-signed-urls.md`](./adr/004-image-cdn-and-signed-urls.md)
- API contracts: [`./api/api-spec.md`](./api/api-spec.md)
- Infrastructure commands: [`INFRA_SETUP.md`](./INFRA_SETUP.md)
- Firebase/storage rules: [`../storage.rules`](../storage.rules)
