# SW-17 Computer Progression Closure Checklist

Status: Draft
Date: 2026-05-30
Repo: laughing-octo-journey
Related repo: solid-train

## 1. Contract Completion

1. Computer progression contract is published and versioned.
2. Tier capability payload includes deterministic unlock metadata.
3. Skill and level gate fields are required and validated.
4. Intentional contract drift fixture fails hard.

## 2. Per-Ship Installation Completion

1. Computer tier is persisted per ship.
2. Ship swap preserves each ship's installed tier state.
3. Upgrade action changes only selected ship state.
4. Invalid tier transitions are rejected.

## 3. Skill and Level Gate Completion

1. Computer Systems Installation skill progression is enabled.
2. Tier gate checks require both skill and level thresholds.
3. Blocked installs return explicit unlock reason.
4. Gate boundary tests cover threshold minus, equal, and plus cases.

## 4. Tier Capability Completion

1. Tier 2 asteroid prescan available and validated.
2. Tier 3 pirate identification available and validated.
3. Tier 4 market opportunity highlight available and validated.
4. Tier 5 route risk estimation available and validated.
5. Tier 6 auto-target suggestion available and validated.
6. Tier 7 mission suitability scoring available and validated.
7. Tier 8 solar weather prediction available and validated.
8. Tier 9 humor setting available and validated.
9. Tier 10 coordinated advisory mode available and validated.

## 5. Light Automation Safety Completion

1. Assist actions are light automation only.
2. Explicit confirmation is required for execution.
3. No silent auto-execution path exists.
4. Canceled confirmation keeps system state unchanged.

## 6. Verification Completion

1. Unit tests pass for tier mapping, gates, and recommendation generation.
2. Integration tests pass for install/upgrade lifecycle.
3. Component tests pass for unlock visibility and reason surfaces.
4. Route-level smoke tests pass for computer panel and assist actions.
5. Contract preflight checks pass against Forge artifacts.

## 7. Canary Readiness and Evidence

1. Canary-only enablement is configured.
2. Recommendation error rates are within agreed threshold.
3. No unresolved P1/P2 incidents in soak window.
4. Rollback path validated.

## 8. Cross-Repo Alignment

1. Nova and Forge capability contracts are aligned.
2. Shared milestone states are updated in cross-repo index.
3. No unresolved drift findings remain open.

## 9. Sign-Off

| Role | Name | Date | Decision | Notes |
| --- | --- | --- | --- | --- |
| Nova lead | TBD | YYYY-MM-DD | Pending | |
| Forge lead | TBD | YYYY-MM-DD | Pending | |
| QA lead | TBD | YYYY-MM-DD | Pending | |
| Orion | TBD | YYYY-MM-DD | Pending | |

## 10. Final Exit Criteria

1. All sections complete and evidenced.
2. SW-17 marked complete in planning index and sprint board.
3. Deferred follow-ups logged with owners and due dates.
