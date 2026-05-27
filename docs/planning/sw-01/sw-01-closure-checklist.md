# SW-01 Closure Checklist (Nova)

Status: Draft
Date: 2026-05-26
Repo: laughing-octo-journey

## 1. UI Completion

1. Mission Board renders three lanes:
- Available
- Active
- Completed

2. Lane counts are accurate against rendered missions.
3. Lane filter interactions are stable and deterministic.
4. Empty, loading, and error states are clearly differentiated.

## 2. Contract and Violation Behavior

1. UI maps only canonical statuses:
- AVAILABLE
- ACTIVE
- COMPLETED

2. Unknown statuses trigger visible contract violation state.
3. Telemetry emits violation event with required metadata.
4. No legacy fallback mapping remains.

## 3. Verification Completion

1. Unit tests for status mapping pass.
2. Component tests for lanes, counts, and filters pass.
3. Negative unknown-status tests pass.
4. Route smoke tests pass.
5. Contract preflight checks pass against Forge artifacts.

## 4. Accessibility and Responsive Readiness

1. Keyboard navigation works for lane controls and mission list interactions.
2. Screen reader labeling for lane controls and counts is validated.
3. Contrast and selection states are accessible.
4. Desktop and mobile layouts are verified.

## 5. Cross-Repo Alignment

1. Nova assumptions match Forge producer contract.
2. Shared milestones are updated in cross-repo index.
3. No open contract drift findings remain.

## 6. Canary Readiness and Evidence

1. Canary enabled for SW-01 path.
2. No unresolved P1 or P2 defects during soak window.
3. Violation telemetry is monitored and within threshold.
4. Rollback path validated.

## 7. Sign-Off

| Role | Name | Date | Decision | Notes |
| --- | --- | --- | --- | --- |
| Nova lead | TBD | YYYY-MM-DD | Pending | |
| Forge lead | TBD | YYYY-MM-DD | Pending | |
| QA lead | TBD | YYYY-MM-DD | Pending | |
| Orion | TBD | YYYY-MM-DD | Pending | |

## 8. Final Exit Criteria

1. All checklist sections complete with evidence.
2. SW-01 marked complete in planning index and sprint board.
3. Deferred follow-ups are logged with owners and dates.
