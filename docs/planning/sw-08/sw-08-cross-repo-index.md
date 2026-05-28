# SW-08 Cross-Repo Coordination Index

Status: Completed (Maintenance Mode)
Date: 2026-05-24
Completed: 2026-05-25
Scope: Contract Safety Gate across laughing-octo-journey and solid-train

## Purpose

Provide a single coordination view for SW-08 so frontend, backend, and QA teams track rollout state, ownership, and drift incidents consistently.

## Canonical Document Set

Frontend repo documents:
1. [Requirements](sw-08-contract-safety-gate-requirements.md)
2. [Implementation Plan](sw-08-contract-safety-gate-implementation-plan.md)
3. [Runbook](sw-08-contract-safety-gate-runbook.md)
4. [Prompt Pack](sw-08-contract-safety-gate-prompt-pack.md)
5. [Closure Checklist](sw-08-closure-checklist.md)

Backend repo documents:
1. [solid-train Requirements](../../../solid-train/docs/planning/sw-08-contract-safety-gate-requirements.md)
2. [solid-train Implementation Plan](../../../solid-train/docs/planning/sw-08-contract-safety-gate-implementation-plan.md)
3. [solid-train Runbook](../../../solid-train/docs/planning/sw-08-contract-safety-gate-runbook.md)
4. [solid-train Prompt Pack](../../../solid-train/docs/planning/sw-08-contract-safety-gate-prompt-pack.md)
5. [solid-train Closure Checklist](../../../solid-train/docs/planning/sw-08-closure-checklist.md)

## Shared Rollout Stages

1. Stage 1: Report-only (warn)
2. Stage 2: Soft fail with approved bypass
3. Stage 3: Hard fail on PR path
4. Stage 4: Operational stabilization with weekly metrics
5. Stage 5: Optimization and continuous assurance

## Current Status

| Repo | Stage | PR Gate | Notes |
| --- | --- | --- | --- |
| laughing-octo-journey | Stage 5 | Hard fail | Weekly metrics + trend/recurrence guardrails active |
| solid-train | Stage 5 | Hard fail | Producer-side checklist, migration-note discipline, and SLA timing active |

## Communication Semantics Companion (SW-COR)

Status: Completed (Maintenance Mode)
Completed: 2026-05-25

Purpose:
- SW-08 remains the shape-level contract gate.
- SW-COR is the communication-semantics companion for request/response correlation guarantees.

Canonical references:
1. [SW-COR spec (laughing-octo-journey)](socket-correlation-contract-spec.md)
2. [SW-COR spec (solid-train)](../../../solid-train/docs/planning/socket-correlation-contract-spec.md)
3. [SW-COR prompt pack (laughing-octo-journey)](sw-cor-correlation-hardening-prompt-pack.md)
4. [SW-COR prompt pack (solid-train)](../../../solid-train/docs/planning/sw-cor-correlation-hardening-prompt-pack.md)

Sign-off:
- Nova and Forge confirmed SW-COR + SW-08 complete on 2026-05-25.

## Shared Status Board Template

Use this table in sprint reviews and incident triage:

| Date | Stage | Repo | CI Status | Drift Count | Open Exceptions | Owner | ETA | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| YYYY-MM-DD | Report/Soft/Hard | laughing-octo-journey | Green/Red | 0 | 0 | Frontend Lead | YYYY-MM-DD | |
| YYYY-MM-DD | Report/Soft/Hard | solid-train | Green/Red | 0 | 0 | Backend Lead | YYYY-MM-DD | |

## Drift Triage Contract (Shared)

When a drift is detected:
1. Assign owner within 1 business day.
2. Reproduce locally in both repos.
3. Decide fix path: frontend update, backend compatibility, or coordinated sequence.
4. If bypass is required, attach expiry and rollback plan.
5. Close incident with root-cause note and preventive action.

## Exception Governance

Bypass requires:
1. Frontend lead approval.
2. Backend lead approval.
3. Expiry date.
4. Rollback strategy.
5. Follow-up ticket ID.

## Metrics to Review Weekly

1. Drift failures per week.
2. Mean time to resolve drift.
3. Number of bypasses and expiry compliance.
4. Contract-related regressions that escaped CI.

## Change Log

- 2026-05-24: Initial cross-repo index and shared status board template created.
- 2026-05-25: SW-08 marked complete and transitioned to maintenance mode across both repos.
- 2026-05-25: SW-COR completion recorded and linked as the communication-semantics companion to SW-08.
