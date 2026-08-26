# SW-01 Mission Board Status Lanes Runbook (Nova UI-Led)

Status: Draft (Operational)
Date: 2026-05-26
Repo: laughing-octo-journey

## 1. Trigger

Use this runbook when SW-01 UI verification fails, lane behavior is inconsistent, contract checks fail, or canary reports mission status violations.

## 2. Triage Sequence

1. Capture failing test or runtime signal.
2. Classify failure type: UI rendering, interaction behavior, contract drift, unknown status handling, or responsive/accessibility defect.
3. Reproduce locally with mission board route and strict checks.
4. Confirm producer-consumer contract alignment.
5. Apply fix, rerun strict suite, and attach evidence.

## 3. Local Reproduction Steps

1. Pull latest main branch in laughing-octo-journey.
2. Run mission board unit/component test suites.
3. Run route-level smoke tests.
4. Run contract preflight checks against current Forge artifact.
5. Execute negative fixture path with unknown status.
6. Verify violation UI visibility and telemetry emission.
7. Validate responsive behavior across desktop and mobile widths.

## 4. Resolution Paths

UI lane placement defect:

1. Fix status-to-lane mapping.
2. Add regression test for incorrect placement.
3. Re-run component and smoke suites.

Filter/count inconsistency:

1. Fix lane filter state synchronization.
2. Add tests for count and rendered-item parity.
3. Re-run interaction tests.

Unknown status handling defect:

1. Ensure strict violation UI path is invoked.
2. Remove any fallback mapping path.
3. Re-run negative tests.

Contract drift defect:

1. Refresh consumer inventory from latest Forge artifact.
2. Align consumer assumptions and fix mismatched fields/enums.
3. Re-run strict contract checks.

Canary runtime defect:

1. Disable SW-01 canary path if violation count exceeds threshold.
2. Patch issue and repeat validation cycle.
3. Re-enable canary after clean soak.

## 5. Severity and Escalation

P1:

- Unknown statuses shown without violation warning or incorrect lane behavior affecting progression clarity.

P2:

- Contract gate failures or persistent lane/filter mismatch.

P3:

- Non-blocking visual/accessibility inconsistencies with safe workaround.

Escalation chain:

1. Nova lead
2. Forge lead
3. Engineering manager

## 6. Communication Template

- Incident ID:
- Failure category:
- Affected route/component:
- Contract surface impacted:
- Owner:
- ETA:
- Canary rollback needed: yes/no
- Evidence links:

## 7. Canary Go or No-Go Checklist

1. Lane placement is correct for all canonical statuses.
2. Filter controls are stable and counts are consistent.
3. Unknown status path shows visible violation state.
4. Contract checks are green with latest Forge artifact.
5. No unresolved P1 or P2 defects during soak.

## 8. Post-Incident Checklist

1. Root cause captured.
2. Missing test coverage added.
3. Documentation updates completed.
4. Preventive owner and follow-up date assigned.
