# SW-08 Weekly Metrics

- Window (days): 30
- Generated at: 2026-06-12T23:49:03.011Z
- Events in window: 35
- Drift count: 79
- Drift by class: {"type mismatch":6,"missing required field":6,"enum/value mismatch":11,"endpoint/event missing":35}
- Impacted surfaces: {"market/ledger":6,"item catalog/fabrication":6,"ship-external-view":6,"character/ship":5,"ownership operations":35}
- Owner tags: {"backend remediation":6,"frontend remediation":11,"coordinated fix":41}
- MTTR (hours): 8.52
- Bypass count: 2
- Expired bypasses: 3
- Near-expiry bypasses: 0
- Repeat offenders: [{"surfaceId":"ownership operations","category":"endpoint/event missing","count":35},{"surfaceId":"market/ledger","category":"type mismatch","count":6},{"surfaceId":"item catalog/fabrication","category":"missing required field","count":6},{"surfaceId":"ship-external-view","category":"enum/value mismatch","count":6},{"surfaceId":"character/ship","category":"enum/value mismatch","count":5}]
- False-positive baseline (approved_exception_findings / total_findings): 0.076

## Baseline Action Plan
- Prioritize top repeat offender surfaces for contract alignment with producer owners.
- Require migration notes when frontend assumptions or consumer inventory fields change.
- Review allowAdditionalValues usage quarterly to ensure it remains narrowly scoped.

