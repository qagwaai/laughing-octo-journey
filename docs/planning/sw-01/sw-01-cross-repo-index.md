# SW-01 Cross-Repo Coordination Index

Status: Draft (Execution Ready)
Date: 2026-05-26
Scope: SW-01 Mission Board Status Lanes across laughing-octo-journey and solid-train

## Purpose

Provide one coordination view for SW-01 so Nova, Forge, and QA can track UI milestones, contract alignment, and canary readiness.

## Canonical Document Set

Nova documents (laughing-octo-journey):

1. [Requirements](sw-01-mission-board-status-lanes-requirements.md)
2. [Implementation Plan](sw-01-mission-board-status-lanes-implementation-plan.md)
3. [Runbook](sw-01-mission-board-status-lanes-runbook.md)
4. [Closure Checklist](sw-01-closure-checklist.md)

Forge documents (solid-train):

1. [Implementation Plan](../../../solid-train/docs/planning/sw-01/sw-01-mission-board-status-lanes-implementation-plan.md)
2. [Requirements](../../../solid-train/docs/planning/sw-01/sw-01-mission-board-status-lanes-requirements.md)
3. [M0 Contract Lock Execution Checklist](../../../solid-train/docs/planning/sw-01/sw-01-m0-contract-lock-execution-checklist.md)

## Shared Delivery Assumptions

1. SW-01 ships as v1-first.
2. Breaking contract cleanup is allowed.
3. Unknown status handling is strict fail plus visible warning.
4. No legacy compatibility logic remains.
5. Canary-only release progression is required.
6. Canonical mission status values are lowercase: `available`, `active`, `completed`.

## Milestone Sync Board

| Milestone | Nova (laughing-octo-journey) | Forge (solid-train) | QA Evidence | Status |
| --- | --- | --- | --- | --- |
| M0 Contract baseline lock | Acknowledged | Complete | Evidence accepted | Closed |
| M1 Producer emission compliance | N/A | Complete | Evidence accepted | Closed |
| M2 Integration contract confidence | N/A | Complete | Evidence accepted | Closed |
| M3 Cross-repo gate alignment | Shared inventory validated | Complete | Evidence accepted | Closed |
| M4 Dual gate enforcement | Complete | Complete | Evidence accepted | Closed |
| M5 Canary validation | Ready | Ready | M4 recommendation approved | Ready |
| M6 Release decision | Shared | Shared | Pending | Open |

## Merge and Release Sequence

1. Forge updates canonical mission status contract and producer emissions.
2. Nova aligns consumer assumptions and UI behavior.
3. Both repos pass strict contract and verification gates.
4. Canary enablement and soak verification run with shared checklist.
5. Go or no-go decision is recorded with evidence.

## Drift Triage Contract

When SW-01 drift or UI-contract mismatch appears:

1. Assign owner within 1 business day.
2. Reproduce in affected repo and verify cross-repo artifact alignment.
3. Choose fix path: producer fix, consumer fix, or merge-sequence correction.
4. Re-run strict gates and attach proof.
5. Close with root cause and preventive update.

## Status Updates

| Date | Repo | Update | Owner |
| --- | --- | --- | --- |
| 2026-05-30 | laughing-octo-journey | SW-01 M3 Nova violation-path behavior marked complete with strict visible contract-violation UI, stable telemetry payload fields, and passing component/route smoke evidence | Nova |
| 2026-05-30 | laughing-octo-journey | SW-01 M2 Nova lane rendering/filtering marked complete with strict unknown-status violation UI + telemetry and passing component/route smoke evidence | Nova |
| 2026-05-30 | laughing-octo-journey | SW-01 M4 dual gate enforcement marked complete (Forge) with Forge hard-fail + Nova preflight hard-fail gate evidence accepted | Nova |
| 2026-05-30 | laughing-octo-journey | SW-01 M5 recommendation marked ready based on dual-gate closure and clean post-drift recovery | Orion |
| 2026-05-30 | laughing-octo-journey | SW-01 M3 cross-repo gate alignment marked complete (Forge) with deterministic hard-fail drift checks and actionable diagnostics evidence accepted | Nova |
| 2026-05-30 | laughing-octo-journey | SW-01 M4 recommendation marked ready based on stable M0-M3 evidence chain | Orion |
| 2026-05-30 | laughing-octo-journey | SW-01 M2 integration contract confidence marked complete (Forge) with integration and contract gate evidence accepted | Nova |
| 2026-05-30 | laughing-octo-journey | SW-01 M1 producer emission compliance marked complete (Forge) with canonical lowercase emission and strict invalid-status rejection evidence accepted | Nova |
| 2026-05-30 | laughing-octo-journey | SW-01 M0 handoff acknowledged; shared sign-offs recorded; M1 kickoff authorized | Nova |
| 2026-05-26 | laughing-octo-journey | SW-01 Nova planning set created | Orion |

## Change Log

- 2026-05-30: Added Nova M3 closure evidence (strict violation-path behavior complete with telemetry field contract and passing mission-board component + route smoke checks).
- 2026-05-30: Added Nova M2 closure evidence (lane rendering/filtering complete with strict violation visibility and passing mission-board component + route smoke checks).
- 2026-05-30: Reflected shared M4 closure state (dual-gate enforcement complete; evidence accepted) and aligned M5 readiness recommendation.
- 2026-05-30: Reflected shared M3 closure state (cross-repo gate alignment complete; evidence accepted) and aligned M4 readiness recommendation.
- 2026-05-30: Reflected shared M2 closure state (Forge integration contract confidence complete; evidence accepted) and milestone board alignment.
- 2026-05-30: Reflected shared M1 closure state (Forge complete; evidence accepted) and advanced milestone board alignment.
- 2026-05-30: Reflected shared M0 closure state (Nova acknowledgment + Forge/Nova/QA/Orion sign-offs) and M1 authorization.
- 2026-05-30: Canonical mission status values updated to lowercase (`available`, `active`, `completed`) across SW-01 planning artifacts.
- 2026-05-30: Added Forge-first M0 contract lock checklist link for execution kickoff alignment.
- 2026-05-26: Initial SW-01 Nova cross-repo index created and linked to Forge and Nova artifacts.
