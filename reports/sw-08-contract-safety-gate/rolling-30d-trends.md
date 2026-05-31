# SW-08 Weekly Metrics

- Window (days): 30
- Generated at: 2026-05-31T00:02:54.902Z
- Events in window: 27
- Drift count: 36
- Drift by class: {"type mismatch":5,"missing required field":5,"enum/value mismatch":5}
- Impacted surfaces: {"market/ledger":5,"item catalog/fabrication":5,"ship-external-view":5}
- Owner tags: {"backend remediation":5,"frontend remediation":5,"coordinated fix":5}
- MTTR (hours): 12.93
- Bypass count: 2
- Expired bypasses: 3
- Near-expiry bypasses: 0
- Repeat offenders: [{"surfaceId":"market/ledger","category":"type mismatch","count":5},{"surfaceId":"item catalog/fabrication","category":"missing required field","count":5},{"surfaceId":"ship-external-view","category":"enum/value mismatch","count":5}]
- False-positive baseline (approved_exception_findings / total_findings): 0.167

## Baseline Action Plan
- Prioritize top repeat offender surfaces for contract alignment with producer owners.
- Require migration notes when frontend assumptions or consumer inventory fields change.
- Review allowAdditionalValues usage quarterly to ensure it remains narrowly scoped.

