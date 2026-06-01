# SW-08 Contract Safety Gate Report

- Mode: hard-fail
- Decision: hard-fail
- Frontend inventory: docs/planning/sw-08/frontend-consumer-contract-inventory.json
- Backend artifact: reports/sw-08-contract-safety-gate/m4-fixtures/backend-contract-artifact.m4-drift-shape-mismatch.json
- Contracts checked: 14
- Findings: 2
- Critical surface coverage: complete

| Category | Severity | Owner | Producer surface | Consumer location | Field | Expected | Actual | Remediation hint | Next action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| type mismatch | breaking | coordinated fix | mission flows | src/app/model/mission-list.ts | response.missions[].status | enum | string | Coordinate producer and consumer changes together and keep the exception short-lived. | Align producer and consumer type at response.missions[].status and re-run npm run contract:check:stage3. |
| enum/value mismatch | breaking | coordinated fix | mission flows | src/app/model/mission-list.ts | response.missions[].status | ["active","available","completed"] | [] | Coordinate producer and consumer changes together and keep the exception short-lived. | Align enum values at response.missions[].status or document safe extension policy, then re-run npm run contract:check:stage3. |

## Notes
- Report-only mode keeps CI green while drift is collected and triaged.
- Soft-fail mode returns a non-zero exit code unless the drift is covered by an approved exception manifest.
- Hard-fail mode blocks PRs for breaking drift and blocks invalid exception manifests even if drift is absent.
- Suggested owner tags are advisory and come from the frontend inventory entry for each contract.
