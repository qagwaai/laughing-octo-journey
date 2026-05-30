# SW-01 Mission Board Status Lanes Requirements (Nova UI-Led)

Status: Draft (Execution Ready)
Date: 2026-05-26
Repo: laughing-octo-journey
Related repo: solid-train
Owner: Nova lead (primary), Forge lead (co-owner), QA lead (validation)

## 1. Purpose

Define frontend requirements for SW-01 so mission status lanes are visually clear, interaction-safe, and contract-valid under strict status semantics.

## 2. Scope

In scope:

- Mission Board UI lanes for Available, Active, Completed.
- Deterministic mission-to-lane placement from canonical status values.
- Filter interaction behavior, lane counts, and empty states.
- Visible violation UX for unknown statuses.
- Consumer contract validation against Forge producer artifacts.

Out of scope:

- Legacy status fallback behavior.
- Expanded quick actions and advanced sorting.
- Mission board visual redesign beyond lane-focused v1.

## 3. UX and Interaction Requirements

1. Lane visibility
- All three lanes are always visible in board context.

2. Lane counts
- Counts must match currently rendered missions in each lane.

3. Filtering behavior
- Selecting a lane filter updates visible missions immediately and consistently.

4. Empty states
- Empty lane state must be explicit and informative.

5. Loading and error states
- Loading state is distinguishable from empty state.
- Contract violation state is distinguishable from generic error state.

## 4. Contract and Data Requirements

Canonical status enum:

1. available
2. active
3. completed

Canonical data values are lowercase. Any title-case lane labels are presentation-only.

Required behavior:

1. UI maps canonical statuses directly to lanes.
2. Unknown status values trigger visible violation UI and telemetry.
3. No silent fallback mapping to other lanes.
4. No legacy mapping layer retained.

## 5. Accessibility and Usability Requirements

1. Keyboard access
- Lane controls and mission items are keyboard reachable and operable.

2. Screen reader support
- Lane names, counts, and state changes are announced meaningfully.

3. Contrast and readability
- Status lane and selected filter state meet accessibility contrast standards.

4. Responsive behavior
- Lane controls and mission cards remain usable on desktop and mobile breakpoints.

## 6. Verification Requirements

1. Component tests
- Validate lane placement, counts, filter behavior, and empty states.

2. Negative contract tests
- Inject unknown status and assert visible violation path.

3. Route smoke tests
- Validate mission board load and basic interaction path.

4. Contract gates
- Fail pre-merge when Nova consumer inventory drifts from Forge producer artifact.

## 7. Acceptance Criteria

1. Users can clearly differentiate Available, Active, and Completed missions.
2. Lane filtering and counts remain consistent under refresh and navigation.
3. Unknown status behavior is strict, visible, and telemetry-backed.
4. Nova contract checks fail on drift and pass on alignment.
5. No legacy compatibility behavior exists in lane mapping logic.

## 8. Ownership and SLA

Nova lead:

- Own lane UX behavior and strict violation presentation.

Forge lead:

- Own canonical status contract publication and producer integrity.

QA lead:

- Own UI behavior evidence and negative contract scenario validation.

SLA:

1. Triage failures in 1 business day.
2. Resolve or rollback in 2 business days.

## 9. Related Documents

1. docs/planning/sw-01/sw-01-mission-board-status-lanes-implementation-plan.md
2. docs/planning/sw-01/sw-01-mission-board-status-lanes-runbook.md
3. docs/planning/sw-01/sw-01-cross-repo-index.md
4. ../../../solid-train/docs/planning/sw-01/sw-01-mission-board-status-lanes-implementation-plan.md
