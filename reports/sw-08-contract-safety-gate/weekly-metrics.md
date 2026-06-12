# SW-08 Weekly Metrics

- Window (days): 7
- Generated at: 2026-06-12T23:49:03.010Z
- Events in window: 8
- Drift count: 43
- Drift by class: {"enum/value mismatch":6,"endpoint/event missing":35,"type mismatch":1,"missing required field":1}
- Impacted surfaces: {"character/ship":5,"ownership operations":35,"market/ledger":1,"item catalog/fabrication":1,"ship-external-view":1}
- Owner tags: {"frontend remediation":6,"coordinated fix":36,"backend remediation":1}
- MTTR (hours): 0.45
- Bypass count: 0
- Expired bypasses: 0
- Near-expiry bypasses: 0
- Repeat offenders: [{"surfaceId":"ownership operations","category":"endpoint/event missing","count":35},{"surfaceId":"character/ship","category":"enum/value mismatch","count":5}]
- False-positive baseline (approved_exception_findings / total_findings): 0

## Baseline Action Plan
- Prioritize top repeat offender surfaces for contract alignment with producer owners.
- Require migration notes when frontend assumptions or consumer inventory fields change.
- Review allowAdditionalValues usage quarterly to ensure it remains narrowly scoped.

