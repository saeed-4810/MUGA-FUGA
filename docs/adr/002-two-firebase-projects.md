# ADR-002: Two Firebase projects

## Context

The brief asks for staging and production. A single Firebase project with prefixes would mix users, data, buckets, IAM, quotas, and secrets. That is easy to set up but hard to reason about when testing admin/customer flows.

## Options considered

1. **Two Firebase projects** — clean isolation and safer testing.
2. **One project with collection prefixes** — less setup, but shared Auth and IAM.
3. **One project with two Cloud Run services** — still shares the data and identity boundary.

## Decision

Use two projects:

- `muga-staging`
- `muga-production`

Each project has its own Firebase Auth users, Firestore database, Storage bucket, Hosting site, Cloud Run services, Secret Manager entries, monitoring policies, and deploy identity.

## Consequences

- Staging can be tested and reset without production risk.
- Production secrets and users never share state with preview/staging work.
- There is more setup, so infrastructure commands are captured in [`../INFRA_SETUP.md`](../INFRA_SETUP.md).

## Rollback

Decommission a project in Firebase/GCP and remove its alias from `.firebaserc`. This is not expected during the take-home.
