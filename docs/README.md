# MUGA Application Documentation

This folder explains the application from the point of view of someone reviewing, running, or extending the submitted repo. Everything linked here lives inside `code/`, so the GitHub submission stands on its own.

## Reading order

| Start here                                             | Use it for                                                                         |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md)                 | How the frontend, backend, Firebase, Cloud Run, and storage pieces fit together.   |
| [`FEATURE_REQUIREMENTS.md`](./FEATURE_REQUIREMENTS.md) | What the assignment asks for and where each requirement is implemented.            |
| [`AUTH_AND_RBAC.md`](./AUTH_AND_RBAC.md)               | Google sign-in, custom claims, session cookies, and admin/customer access rules.   |
| [`USER_FLOWS.md`](./USER_FLOWS.md)                     | Customer, admin, locale, theme, product, and artist journeys.                      |
| [`STORAGE_AND_BUCKETS.md`](./STORAGE_AND_BUCKETS.md)   | Cover-art storage, signed uploads, CORS, and bucket responsibilities.              |
| [`FIREBASE_INFRA.md`](./FIREBASE_INFRA.md)             | Firebase projects, Hosting, Auth, Firestore, Cloud Run, and monitoring shape.      |
| [`api/alerting-runbook.md`](./api/alerting-runbook.md) | What is monitored, which alerts exist, and where Slack/PagerDuty notifications go. |
| [`CI_CD.md`](./CI_CD.md)                               | GitHub Actions, local checks, previews, staging, and production releases.          |
| [`TEST_SCENARIOS.md`](./TEST_SCENARIOS.md)             | Scenario taxonomy, E2E naming, and how features map to tests.                      |
| [`ADRS.md`](./ADRS.md)                                 | Short engineering summary of the architecture decisions.                           |
| [`adr/`](./adr/README.md)                              | The main architecture decisions, written as short engineering notes.               |
| [`api/api-spec.md`](./api/api-spec.md)                 | API contract rows and error conventions.                                           |
| [`api/database-schema.md`](./api/database-schema.md)   | Firestore collections, indexes, and rules summary.                                 |
| [`qa/coverage-matrix.md`](./qa/coverage-matrix.md)     | Scenario-to-test traceability summary.                                             |
| [`INFRA_SETUP.md`](./INFRA_SETUP.md)                   | Reproducible infrastructure setup commands.                                        |
| [`SECRETS.md`](./SECRETS.md)                           | Secret and configuration handling.                                                 |

## References

- Assignment and stack: [`../README.md`](../README.md)
- Contribution rules: [`../CONTRIBUTING.md`](../CONTRIBUTING.md)
- Git workflow: [`../GIT_WORKFLOW.md`](../GIT_WORKFLOW.md)
- API contracts: [`./api/api-spec.md`](./api/api-spec.md)
- Database schema: [`./api/database-schema.md`](./api/database-schema.md)
- UX flows: [`./ux/flows.md`](./ux/flows.md)
- QA coverage matrix: [`./qa/coverage-matrix.md`](./qa/coverage-matrix.md)
- ADR index: [`./adr/README.md`](./adr/README.md)
- Product scenarios: [`./product/scenario-catalog-product.md`](./product/scenario-catalog-product.md)
- RBAC matrix: [`./product/rbac-matrix.md`](./product/rbac-matrix.md)

## Keeping this useful

When the app changes, update the matching page here. These docs should describe the product as it is now, not an outdated plan.
