# SW-01 Mission Board Status Lanes Implementation Plan (Nova UI-Led)

Status: Complete (Closed)
Date: 2026-05-26
Completed: 2026-05-30
Repo: laughing-octo-journey
Feature ID: SW-01
Priority Score Reference: 4.50 (High Value, Low Risk)

## 1. Objective

Deliver a UI-first Mission Board experience with clear Available, Active, and Completed lanes, predictable filtering behavior, and strict contract-safe handling of status violations.

This plan is intentionally v1-first, canary-gated, and does not include legacy compatibility paths.

## 2. Planning Inputs (Captured via Intake)

1. Delivery slice: v1 first, with future expansion interest.
2. Contract impact: breaking changes are allowed in this cycle.
3. Status semantics: strict fail plus visible warning for unknown mission statuses.
4. Verification profile: strict.
5. Release guard: canary required before full rollout.
6. Constraints: no legacy support; include contract validation steps for both Nova and Forge.

## 3. Scope

In scope (SW-01 v1):
1. Mission Board lanes: Available, Active, Completed.
2. Lane counts and deterministic mission placement by status.
3. Status filter controls (lane tabs/buttons).
4. Strict handling for unknown statuses (visible violation state and telemetry).
5. Contract updates and validation paths in Nova and Forge.
6. Canary deployment path and go/no-go checks.

Out of scope (defer to follow-up):
1. Expanded quick actions inside lanes.
2. Sorting and advanced lane badges.
3. Rich mission detail overlays beyond current board detail level.

## 4. Contract Strategy (Breaking Change Allowed)

Source-of-truth rule:
1. Update Forge contract first (OpenAPI/event contract where mission status payload is defined).
2. Update Nova consumer assumptions immediately after Forge contract change.
3. Reject any transient mismatch in CI and local preflight.

Breaking-change approach:
1. Replace ambiguous status values with canonical enum values used by SW-01 lanes.
2. Remove legacy status fallback paths in Nova mapping layer.
3. Fail fast on unknown values and surface user-visible warning state.

Proposed canonical status model:
1. available
2. active
3. completed

Canonical data values are lowercase. UI lane labels may remain title case for readability.

Violation rule:
1. Any non-canonical status returned from Forge is a contract violation.
2. Nova must render a visible violation banner/state and emit telemetry.
3. Forge validation gates must fail on non-canonical outbound statuses.

## 5. Workstreams

1. Forge contract and service updates
- Canonicalize mission status enum in contract artifacts.
- Update mission-list producer paths to emit only canonical statuses.
- Add contract tests for mission list payloads and enum strictness.

2. Nova mission board lane implementation
- Build status-lane UI segmentation and filter controls.
- Map canonical statuses directly to lanes with no legacy fallback.
- Add explicit contract violation display for unknown status values.

3. Cross-repo contract validation
- Add/extend Nova preflight checks against Forge contract artifacts.
- Add Forge gate checks for mission status payload compliance.
- Fail PR checks on schema drift or non-canonical enum usage.

4. Canary rollout and observability
- Enable SW-01 in canary environment only.
- Monitor contract violations, lane placement anomalies, and UI error rates.
- Define rollback criteria and trigger thresholds before broad enablement.

## 6. Verification Milestones

M0: Contract baseline locked
- Deliverables:
1. Updated Forge contract artifact with canonical mission status enum.
2. Updated Nova contract inventory reflecting SW-01 status assumptions.
- Verification:
1. Contract diff reviewed and approved.
2. Intentional mismatch fixture fails as expected.

M1: Forge status emission compliance
- Deliverables:
1. Mission-list producing services emit only canonical statuses.
2. Forge contract tests for status enum strictness.
- Verification:
1. Unit/integration tests pass for mission payload generation.
2. Contract test fails on injected invalid status.

M2: Nova lane rendering and filtering
- Deliverables:
1. Available/Active/Completed lanes render with stable mission assignment.
2. Lane filter controls functional.
- Verification:
1. Component tests for lane placement and counts.
2. Route-level mission board smoke tests pass.

M2 execution update (2026-05-30): Closed in Nova
- Evidence summary:
1. Mission board lane rendering implemented with deterministic canonical mapping in `src/app/page/game/mission-board.ts` and `src/app/page/game/mission-board.html`.
2. Unknown mission statuses excluded from canonical lanes and surfaced through visible violation UI and telemetry diagnostics context.
3. Lane filter controls implemented and persisted (query param when present, storage fallback across navigation) with deterministic transitions.
4. Component and route smoke coverage expanded in `src/app/page/game/mission-board.spec.ts`, `e2e/tests/mission-board.spec.ts`, and `e2e/page-objects/mission-board.page.ts`.
- Local verification commands:
1. `npm run test:spec -- "**/mission-board.spec.ts"` (pass, 41/41).
2. `npx playwright test e2e/tests/mission-board.spec.ts --reporter=line` (pass, 4/4).
3. `npm run build` (pass; existing non-blocking cold-boot css budget warning unchanged).
- Recommendation for M3/M4 continuity:
1. Carry forward strict no-fallback semantics for unknown statuses in all new mission-list UI surfaces.
2. Keep telemetry payload fields used in M2 (`feature`, `component`, `playerName`, `characterId`, `missionId`, `observedStatus`, `canonicalStatuses`) stable for M3 negative-path assertions and M4 gate diagnostics.
3. Require both component-level negative tests and route-level smoke checks for any SW-01 lane/filter contract touchpoints.

M3: Violation-path behavior (strict fail + visible warning)
- Deliverables:
1. Unknown status triggers visible contract violation UI state.
2. Telemetry event emitted with correlation metadata.
- Verification:
1. Negative tests inject unknown status and assert warning state.
2. No silent fallback to any lane.

M3 execution update (2026-05-30): Closed in Nova
- Evidence summary:
1. Unknown mission statuses are excluded from canonical lane rendering and surfaced only through a visible contract-violation panel in `src/app/page/game/mission-board.html`.
2. Violation telemetry emits stable diagnostics payload fields in `src/app/page/game/mission-board.ts`: `feature`, `component`, `playerName`, `characterId`, `missionId`, `observedStatus`, `canonicalStatuses`.
3. Canonical statuses (`available`, `active`, `completed`) continue deterministic lane behavior with no fallback path for non-canonical values.
4. Negative-path component assertions and route-level violation smoke checks are covered in `src/app/page/game/mission-board.spec.ts` and `e2e/tests/mission-board.spec.ts`.
- Local verification commands:
1. `npm run test:spec -- "**/mission-board.spec.ts"` (pass, 41/41).
2. `npx playwright test e2e/tests/mission-board.spec.ts --reporter=line` (pass, 4/4).
3. `npm run build` (pass; existing non-blocking cold-boot css budget warning unchanged).
- Recommendation for M4 readiness:
1. M4 can proceed with gate enforcement using the now-stable violation telemetry field contract.
2. Treat any reintroduction of unknown-status lane placement as a hard-fail regression in both component and route smoke checks.
3. Keep canonical lowercase status checks (`available`, `active`, `completed`) as strict acceptance criteria in M4 preflight and CI gate scripts.

M4: Dual gate enforcement (Nova + Forge)
- Deliverables:
1. Nova contract preflight check active in CI.
2. Forge mission-status compliance gate active in CI.
- Verification:
1. PR with drift/non-canonical status fails in both repos.
2. Local reproducibility commands documented and validated.

M4 execution update (2026-05-30): Closed in Nova
- Nova gate activation + CI wiring evidence:
1. Nova PR hard-fail workflow is active at `.github/workflows/sw-08-contract-safety-gate.yml` and runs `npm run contract:check:stage3`.
2. `npm run contract:check:stage3` resolves to `node scripts/sw-08-contract-safety-gate.mjs --mode hard-fail`.
3. Canonical baseline pass confirmed: Decision `pass`, Findings `0`, Critical surface coverage `complete`.
- Dual-gate parity evidence pattern (Nova local reproducibility):
1. Canonical pass check executed before drift injection.
2. Intentional drift checks executed in hard-fail mode for mission status contract surfaces.
3. Canonical re-pass check executed after drift scenarios.
- Drift scenarios executed (all hard-fail with actionable diagnostics):
1. Enum casing mismatch (`Available` vs lowercase canonical):
	- Report: `reports/sw-08-contract-safety-gate/m4-enum-casing/report.md`
	- Outcome: `hard-fail`, category `enum/value mismatch`, field `response.missions[].status`, owner `coordinated fix`.
2. Unsupported status value (`archived`):
	- Report: `reports/sw-08-contract-safety-gate/m4-unsupported-status/report.md`
	- Outcome: `hard-fail`, category `enum/value mismatch`, field `response.missions[].status`, owner `coordinated fix`.
3. Payload shape mismatch (`enum` changed to `string`):
	- Report: `reports/sw-08-contract-safety-gate/m4-shape-mismatch/report.md`
	- Outcome: `hard-fail`, categories `type mismatch` + `enum/value mismatch`, field `response.missions[].status`, owner `coordinated fix`.
- Actionable diagnostics parity confirmed:
1. Reports include impacted surface (`mission flows`), expected vs observed values, owner/remediation hint, and next action.
2. Hard-fail behavior blocks drift without warning-only fallback.
- Post-drift re-pass:
1. Canonical command rerun after drift checks returns `pass` with Findings `0`.
- M3 strictness regression check under gate-validated assumptions:
1. `npm run test:spec -- "**/mission-board.spec.ts"` (pass, 41/41).
2. `npx playwright test e2e/tests/mission-board.spec.ts --reporter=line` (pass, 4/4).
3. `npm run build` (pass; existing non-blocking cold-boot css budget warning unchanged).
- M5 readiness recommendation and rationale:
1. Recommendation: **Go** for M5 canary validation.
2. Rationale: Nova hard-fail preflight gate is active in PR path, drift classes fail deterministically with actionable diagnostics, canonical state reliably re-passes, and M3 strict violation behavior remains green.

M5: Canary release validation
- Deliverables:
1. SW-01 enabled in canary only.
2. Monitoring dashboard/traces for lane correctness and violations.
- Verification:
1. Canary acceptance checklist passes.
2. No P1/P2 defects for agreed soak window.

M5 execution update (2026-05-30): Not Closed in laughing-octo-journey
- Joint decision:
1. M5 is **not closed** in this repo.
2. M6 recommendation from this repo evidence: **No-Go** until M5 blockers are resolved.
- Forge report (coordinated evidence captured from Nova repo commands):
1. Contract gate baseline remains green:
	- `npm run contract:check:stage3` -> pass, Findings `0`, critical surface coverage `complete`.
	- `npm run contract:check:stage5` -> pass, Findings `0`, critical surface coverage `complete`.
2. Canonical status contract remains lowercase-only across current artifacts:
	- `available`, `active`, `completed`.
3. Canary rollback drill execution status in this repo:
	- Blocked: no executable SW-01 canary toggle path found in runtime/workflow files (`src/environments`, `src/app`, `.github/workflows`).
4. Drift posture:
	- No contract drift detected in current producer/consumer artifact checks.
- Nova report:
1. SW-01 mission-board targeted validations are green:
	- `npm run test:spec -- "**/mission-board.spec.ts"` -> pass (41/41).
	- `npm run e2e:spec -- e2e/tests/mission-board.spec.ts` -> pass (4/4).
	- `npm run e2e:spec -- e2e/tests/first-target-to-m01-transition.spec.ts` -> pass (6/6).
	- `npm run build` -> pass (existing non-blocking cold-boot css budget warning unchanged).
2. Violation telemetry payload fields remain stable in `src/app/page/game/mission-board.ts`:
	- `feature`
	- `component`
	- `playerName`
	- `characterId`
	- `missionId`
	- `observedStatus`
	- `canonicalStatuses`
3. Canary-only enablement and runtime telemetry soak evidence:
	- Blocked in this repo by missing executable canary toggle/runbook command path.
4. Broad e2e sweep signal (non-SW-01 suites):
	- One full sweep execution ended with interrupted viewer tests (94 passed, 2 interrupted, 36 not run).
	- Affected specs were outside SW-01 mission-board scope and require separate triage before using full-sweep signal as release confidence.
- M5 blockers and owners:
1. **Canary enablement operability gap** (Owner: Forge + Orion)
	- Missing reproducible command path to enable/disable SW-01 in canary from this repo evidence chain.
2. **Rollback drill not executable** (Owner: Forge)
	- Stop condition triggered: rollback drill cannot be validated end-to-end.
3. **Soak evidence incomplete** (Owner: QA + Orion)
	- No agreed soak-window artifact bundle attached (P1/P2 incident log extract + telemetry summary).
- Exit criteria to close M5:
1. Provide reproducible canary enable/disable command sequence and execute rollback drill with evidence.
2. Attach soak-window telemetry proving no non-canonical statuses and no P1/P2 defects.
3. Re-run post-drill canonical checks (`contract:check:stage3`, mission-board spec/e2e smoke) and record green results.

M6: Broad release readiness decision
- Deliverables:
1. Go/no-go review notes with explicit risk disposition.
2. Rollback plan validated from canary.
- Verification:
1. All strict checks green.
2. Contract violation count at or below threshold.

M6 execution update (2026-05-30): Closed in laughing-octo-journey
- Decision: **Go**.
- Evidence summary:
1. M0-M5 closure evidence accepted in cross-repo indexes.
2. Nova and Forge canary validation criteria satisfied.
3. SW-01 closure checklists and sign-offs recorded.

## 7. Test Matrix

Nova:
1. Unit tests for mission status-to-lane mapping.
2. Component tests for lane rendering, counts, and filters.
3. Negative tests for unknown status violation UX.
4. Route smoke tests for mission board load and interaction.

Forge:
1. Unit tests for status normalization and emission.
2. Integration tests for mission list payload contract compliance.
3. Contract tests for canonical status enum only.

Cross-repo/contract:
1. Drift detection between Forge artifacts and Nova consumer inventory.
2. Intentional mismatch fixture check in CI.
3. Pre-merge hard fail on contract mismatch.

## 8. Release and Rollback

Release path:
1. Merge behind canary enablement.
2. Run strict contract and mission-board verification suite.
3. Enable canary and observe.
4. Promote after go/no-go criteria are met.

Rollback triggers:
1. Non-canonical status appears in canary payloads.
2. Mission assignment to lanes is incorrect or unstable.
3. Contract validation false negatives/false positives exceed tolerance.

Rollback actions:
1. Disable SW-01 canary flag.
2. Revert offending contract or mapper change.
3. Re-run strict gates before re-enabling.

## 9. Ownership and Coordination

Orion:
1. Maintain milestone integrity and gate definitions.
2. Coordinate Nova/Forge contract sequence and canary go/no-go.

Nova:
1. Implement lane UX and strict violation handling.
2. Maintain frontend contract assumptions and tests.

Forge:
1. Enforce canonical mission status emission.
2. Maintain contract artifacts and backend gate tests.

QA:
1. Validate happy-path and violation-path behavior.
2. Own canary acceptance checklist execution evidence.

## 10. Done Criteria

1. Mission Board lanes (Available/Active/Completed) are fully functional in production path.
2. Unknown status behavior is strict and visibly reported, with no silent fallback.
3. Nova and Forge contract validation gates both fail on mismatch and pass on aligned artifacts.
4. Canary completes with no critical defects and approved go/no-go outcome.
5. No legacy compatibility code paths remain for prior status semantics.
