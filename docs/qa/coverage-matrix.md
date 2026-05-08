# Coverage Matrix

This table is a compact map from features to the scenarios and tests that protect them.

| Feature             | P-\*                   | U-\*                    | T-\*                           | E-\*                             | Current state                   |
| ------------------- | ---------------------- | ----------------------- | ------------------------------ | -------------------------------- | ------------------------------- |
| Shell/theme         | P-OPS-001, P-THEME-001 | U-SHELL-001, U-THEME-\* | T-HEALTH-001, T-DOCS-\*        | E-SHELL-001                      | Done                            |
| Auth                | P-AUTH-001..003        | U-AUTH-001..003         | T-AUTH-001..006, T-SSR-AUTH-\* | E-AUTH-001                       | Done                            |
| Products backend    | P-PROD-001..009        | —                       | T-PROD-001..015, T-UP-001..003 | —                                | Done                            |
| Products frontend   | P-PROD-001..005        | U-PROD-\*               | API client/unit coverage       | E-PROD-001                       | Done                            |
| Admin approval      | P-ADMIN-001..003       | U-ADMIN-\*              | T-ADMIN-001..003               | E-ADMIN-001                      | Done                            |
| Artists             | P-ARTIST-001..009      | U-ARTIST-\*             | T-ARTIST-001..036              | E-ARTIST-ADMIN-001               | Done                            |
| i18n                | P-I18N-001             | U-I18N-001              | Locale parity checks           | E-AUTH/E-PROD/E-ADMIN assertions | Done                            |
| Next.js SSR         | P-ARCH-NEXTJS-001      | U-NEXTJS-\*             | T-NEXTJS-_, T-SSR-_            | E-SSR-\*                         | In progress / migration cleanup |
| Monitoring/alerting | P-OPS-002..005         | U-ALERT-\*              | T-ALERT-\*, T-OBS-\*           | Staging drill + production smoke | Done                            |

## Rules

- Scenario IDs appear in test names where the test closes feature coverage.
- Source changes are expected to keep changed-file coverage at 100%.
- E2E files use `E-<FLOW>-NNN.spec.ts` naming.
- A feature is not considered complete if a declared scenario has no matching test or check.
