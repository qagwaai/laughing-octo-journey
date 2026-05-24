# SW-08 Contract Safety Gate Requirements (Frontend-Led)

Status: Draft
Date: 2026-05-24
Repo: laughing-octo-journey
Related repo: solid-train
Owner: Frontend lead (primary), Backend lead (co-owner), QA lead (validation)

## 1. Purpose

Define a CI gate that detects frontend/backend contract drift before merge so player-visible regressions are prevented early.

## 2. Scope

In scope:
- Validate frontend contract assumptions against canonical backend API and event contracts.
- Fail CI when breaking drift is detected (after rollout phase).
- Provide actionable diagnostics for both teams.

Out of scope:
- Runtime feature flags.
- Business rule correctness beyond contract shape and required-field semantics.
- Performance profiling.

## 3. Contract Sources of Truth

Primary sources:
- Backend OpenAPI and event payload definitions from solid-train.
- Frontend contract usage and model assumptions in laughing-octo-journey.

Contract types covered:
- HTTP request/response schemas.
- Socket event request/response payloads.
- Required fields and enum/value constraints used in UI logic.

## 4. Drift Definition

Drift means any incompatible mismatch between frontend expectation and backend contract, including:
- Missing required fields.
- Type mismatch.
- Enum/value mismatch.
- Endpoint/event missing or renamed.
- Breaking structural changes without migration path.

Non-breaking drift examples:
- New optional field added.
- New enum value that frontend safely ignores by design.

## 5. Gate Behavior

Execution:
- Run in CI on pull requests and main branch merges.
- Expose local command for developer preflight.

Modes:
- Phase 1: Report-only (warn).
- Phase 2: Soft fail with approved bypass.
- Phase 3: Hard fail (default).

Failure output must include:
- Contract artifact location.
- Consumer location in frontend.
- Drift category.
- Suggested remediation owner (frontend/backend/shared).

## 6. Acceptance Criteria

Required for SW-08 completion:
1. CI job exists and runs automatically on PR.
2. At least one intentional mismatch fixture demonstrates failure path.
3. Error output is readable and points to both producer and consumer.
4. Team runbook exists and is linked from this document.
5. Rollout plan and ownership are approved by both leads.

## 7. Ownership and SLA

Ownership model:
- Frontend lead owns consumer compatibility updates.
- Backend lead owns producer contract updates and release notes.
- QA lead owns validation scenarios and CI health checks.

SLA target:
- Red gate triage started within 1 business day.
- Fix or approved exception within 2 business days.

## 8. Exception Policy

Allowed only when:
- Change is urgent and non-mergeable otherwise.
- Exception has expiry date and ticket reference.
- Both frontend and backend leads approve.

Mandatory fields for exception:
- Reason.
- Risk summary.
- Expiry date.
- Rollback plan.

## 9. Rollout Plan

1. Week 1: Report-only, collect baseline drift signal.
2. Week 2: Soft fail with controlled bypass.
3. Week 3: Hard fail on main PR path.

## 10. Metrics

Track:
- Number of drift failures per week.
- Mean time to resolve drift failures.
- Regression escapes attributable to contract mismatch.
- Bypass usage count and expiry compliance.

## 11. Related Documents

- docs/planning/sw-08-contract-safety-gate-implementation-plan.md
- docs/planning/sw-08-contract-safety-gate-runbook.md
- docs/planning/sw-08-contract-safety-gate-prompt-pack.md
