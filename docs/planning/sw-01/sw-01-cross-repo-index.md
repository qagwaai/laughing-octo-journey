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

## Shared Delivery Assumptions

1. SW-01 ships as v1-first.
2. Breaking contract cleanup is allowed.
3. Unknown status handling is strict fail plus visible warning.
4. No legacy compatibility logic remains.
5. Canary-only release progression is required.

## Milestone Sync Board

| Milestone | Nova (laughing-octo-journey) | Forge (solid-train) | QA Evidence | Status |
| --- | --- | --- | --- | --- |
| M0 Contract baseline lock | Not started | Not started | Pending | Open |
| M1 Producer emission compliance | N/A | Not started | Pending | Open |
| M2 Lane rendering and filtering | Not started | N/A | Pending | Open |
| M3 Strict violation behavior | Shared | Shared | Pending | Open |
| M4 Dual gate enforcement | Shared | Shared | Pending | Open |
| M5 Canary validation | Shared | Shared | Pending | Open |
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
| 2026-05-26 | laughing-octo-journey | SW-01 Nova planning set created | Orion |

## Change Log

- 2026-05-26: Initial SW-01 Nova cross-repo index created and linked to Forge and Nova artifacts.
