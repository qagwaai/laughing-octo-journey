# SW-08 Contract Safety Gate Report

- Mode: report-only
- Frontend inventory: docs/planning/sw-08/frontend-consumer-contract-inventory.intentional-mismatch.json
- Backend artifact: docs/planning/sw-08/backend-contract-artifact.intentional-mismatch.json
- Contracts checked: 3
- Findings: 3

| Category | Owner | Surface | Contract | Field | Expected | Actual | Consumer files |
| --- | --- | --- | --- | --- | --- | --- | --- |
| type mismatch | backend remediation | market/ledger | market.list | response.markets[].driftPercentPerHour | number | string | src/app/model/market-list.ts |
| missing required field | frontend remediation | item catalog/fabrication | fabrication.printableItem | response.requiredMaterials[].acceptedDisplayNames | required | false | src/app/model/printable-item.ts |
| enum/value mismatch | coordinated fix | ship-external-view | shipExterior.launchItem | response.resolution.outcome | ["no-effect","target-destroyed"] | ["no-effect","target-eliminated"] | src/app/model/launch-item.ts, src/app/model/ship-item.ts |

## Notes
- Report-only mode keeps CI green while drift is collected and triaged.
- Suggested owner tags are advisory and come from the frontend inventory entry for each contract.
