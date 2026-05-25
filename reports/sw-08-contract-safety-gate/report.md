# SW-08 Contract Safety Gate Report

- Mode: hard-fail
- Decision: hard-fail
- Frontend inventory: docs/planning/sw-08/frontend-consumer-contract-inventory.intentional-mismatch.json
- Backend artifact: docs/planning/sw-08/backend-contract-artifact.intentional-mismatch.json
- Contracts checked: 3
- Findings: 3
- Critical surface coverage: incomplete

- Missing critical surfaces: auth/session, character/ship, mission flows

| Category | Severity | Owner | Producer surface | Consumer location | Field | Expected | Actual | Remediation hint | Next action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| type mismatch | breaking | backend remediation | market/ledger | src/app/model/market-list.ts | response.markets[].driftPercentPerHour | number | string | Update the backend contract artifact and migration notes, then re-run the gate. | Align producer and consumer type at response.markets[].driftPercentPerHour and re-run npm run contract:check:stage3. |
| missing required field | breaking | frontend remediation | item catalog/fabrication | src/app/model/printable-item.ts | response.requiredMaterials[].acceptedDisplayNames | required | false | Update frontend consumer mappings and fallback handling, then re-run the gate. | Restore required field response.requiredMaterials[].acceptedDisplayNames in producer contract or update frontend expectation, then run npm run contract:check:stage3. |
| enum/value mismatch | breaking | coordinated fix | ship-external-view | src/app/model/launch-item.ts, src/app/model/ship-item.ts | response.resolution.outcome | ["no-effect","target-destroyed"] | ["no-effect","target-eliminated"] | Coordinate producer and consumer changes together and keep the exception short-lived. | Align enum values at response.resolution.outcome or document safe extension policy, then re-run npm run contract:check:stage3. |

## Notes
- Report-only mode keeps CI green while drift is collected and triaged.
- Soft-fail mode returns a non-zero exit code unless the drift is covered by an approved exception manifest.
- Hard-fail mode blocks PRs for breaking drift and blocks invalid exception manifests even if drift is absent.
- Suggested owner tags are advisory and come from the frontend inventory entry for each contract.
