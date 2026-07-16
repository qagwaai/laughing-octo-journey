# SW-13 Test Foundation Investment Plan (2026-07-11)

Status owner: Nova (frontend)
Audience: SW-13 implementation and test-maintenance contributors
Purpose: Define a supportable long-term testing approach after high-cost debugging on ship hangar resume flow

## 1. Why This Investment Is Needed

The recent effort to stabilize one core flow test exposed a systemic issue, not an isolated test issue.

Current signal:
1. 15 files were touched to stabilize one failing e2e path.
2. Changes mixed multiple scopes: production flight features, navigation behavior, socket safety hardening, test fixtures, and planning docs.
3. Failure symptoms persisted despite transport-level success, indicating weak observability and weak test seam design around UI state transitions.

Conclusion:
1. We need a dedicated test foundation layer for deterministic UI state verification.
2. We need stricter change isolation rules so one failing test does not force broad code churn.

## 2. Current Change Review (What We Learned)

## 2.1 Change Inventory by Domain

Core test harness and e2e surfaces:
1. e2e/page-objects/game-shell.page.ts
2. e2e/tests/ship-exterior-hangar-resume.spec.ts

Production behavior linked to test diagnosis:
1. src/app/page/game/ship-hangar.ts
2. src/app/services/socket.service.ts
3. src/app/services/ship.service.ts
4. src/app/services/ship-exterior-socket.service.ts
5. src/app/services/ship-exterior-view-state.service.ts

Parallel feature work (Milestone-3C flight lane):
1. src/app/scene/ship-exterior/ship-exterior-bare-scene.component.ts
2. src/app/scene/ship-exterior/ship-exterior-bare-scene.component.html
3. src/app/scene/ship-exterior/ship-exterior-bare-scene.component.css
4. src/app/scene/ship-exterior/ship-exterior-bare-scene-test-api.ts
5. src/app/scene/ship-exterior/ship-scene-context.ts
6. src/app/scene/ship-exterior/ship-scene-types.ts

Program docs:
1. docs/planning/sw-13-closure/sw-13-closure-status-2026-07-10.md
2. docs/planning/sw-13-closure/replacement-design-checkpoint.md

## 2.2 Root Causes Behind Debug Cost

1. Test seam too shallow:
The e2e test only observed DOM row count and URL, without a reliable app-state checkpoint for hangar load lifecycle.

2. Missing deterministic state contract:
There is no formalized "hangar loaded" signal for tests to wait on, so retries/timeouts were used as a proxy.

3. Mixed concerns during failure handling:
Feature delivery (Milestone-3C) and test stabilization happened in the same active change set, increasing cognitive and review load.

4. Incomplete layered assertions:
The test validated outcome but not intermediate states (request sent, response matched, store updated, component state resolved, UI rendered).

5. High reliance on ad hoc diagnostics:
Temporary logs and packet traces proved transport delivery, but that evidence was not codified into a reusable harness utility.

## 3. Long-Term Target Solution

Adopt a three-layer test architecture for stateful gameplay and scene transitions.

Layer A: Contract and correlation reliability tests (service-level)
1. Verify correlationId and requestIdentity matching behavior.
2. Verify duplicate-request and overlap behavior with deterministic fixtures.
3. Verify zone and callback error isolation guarantees.

Layer B: Component integration tests (Angular, mocked services)
1. Verify ShipHangarPage state machine transitions with deterministic mocked responses.
2. Assert explicit state sequence:
pending -> loading -> loaded or error.
3. Assert render mapping from state to DOM without Playwright.

Layer C: Slim e2e path tests (Playwright)
1. Keep e2e focused on cross-route and end-user behavior only.
2. Depend on a stable app test API contract for readiness checkpoints.
3. Avoid debugging internal component state from e2e except through approved test probes.

## 4. High-Value Test Infrastructure to Add

## 4.1 App-Level Test Readiness Contract

Create a minimal, versioned runtime test contract surfaced only in test mode.

Scope:
1. Scene and hangar readiness flags.
2. Last successful owner ship-list load metadata.
3. Current route context identity (playerName, characterId, shipId).

Requirements:
1. Read-only API.
2. No production behavior mutation.
3. Clear ownership and documentation.

## 4.2 Hangar State Machine Formalization

Refactor hangar loading into explicit states instead of loosely coupled booleans.

Proposed states:
1. idle
2. loading
3. loaded
4. empty
5. error

Outcome:
1. Tests can assert state transitions directly.
2. UI branch conditions become simpler and safer.
3. Overlapping requests can be handled with a request-generation token policy.

## 4.3 E2E Fixture and Page Object Standards

Define standards for gameplay e2e tests:
1. Page objects expose intent methods and readiness checks, not raw locator timing loops.
2. Socket mock handlers are reusable scenario modules with typed request echo support.
3. Each scenario must define deterministic setup, transition points, and success checkpoints.

## 4.4 Diagnostic Tooling That Scales

Replace ad hoc logs with opt-in structured diagnostics.

Scope:
1. Event timeline buffer in test mode (bounded, memory safe).
2. Standard failure artifact dump helper for e2e tests.
3. One command to capture timeline + URL + key readiness states on failure.

## 5. Execution Plan (Clear Steps)

Phase 0: Change isolation and branch hygiene
1. Split current work into two tracks:
Milestone-3C feature track and test-foundation stabilization track.
2. Keep only test-related and hangar-readiness stabilization changes in stabilization track.
3. Record explicit keep/revert decisions for all 15 changed files.

Phase 1: Define test contracts
1. Create a short spec doc for app test readiness contract and hangar state machine.
2. Add typed interface for readiness state and timeline events.
3. Add unit tests for contract serialization and state transitions.

Phase 2: Implement deterministic component integration coverage
1. Add integration tests for ShipHangarPage loading lifecycle.
2. Add tests for duplicate requests, delayed responses, and out-of-order responses.
3. Validate that UI branch mapping is correct for all defined states.

Phase 3: Harden e2e harness
1. Introduce page-object readiness methods based on contract states.
2. Remove polling on raw row count where readiness state is available.
3. Modularize socket mock scenario builders for reuse.

Phase 4: Trim and stabilize e2e specs
1. Refactor ship-hangar-resume test to assert only cross-surface behavior.
2. Move transport/correlation assertions to lower layers.
3. Keep one golden-path e2e and one resilience-path e2e for this flow.

Phase 5: CI and governance
1. Add a targeted quality gate for critical stateful routes.
2. Require deterministic readiness assertions for new gameplay e2e tests.
3. Add review checklist item: "Does this test rely on implicit timing or explicit app readiness?"

## 6. Definition of Done for This Investment

This investment is complete when:
1. Hangar and ship exterior critical flows have explicit readiness contracts and state-machine tests.
2. The failing resume flow is green with no temporary debug instrumentation.
3. Similar route transition tests can be added by reusing fixture modules and readiness helpers, with minimal app code changes.
4. New critical e2e tests can be authored without introducing broad production-file churn.

## 7. Immediate Next Actions (Next Session)

1. Approve track split and file-level keep/revert matrix for the current 15-file change set.
2. Author the test readiness contract doc and hangar state-machine spec.
3. Implement ShipHangarPage state-machine refactor behind unchanged UI behavior.
4. Add focused integration tests for state transitions before touching e2e assertions again.
5. Update ship-hangar-resume e2e to use readiness API once available.

## 8. Risk Notes

1. Without this investment, each new stateful gameplay feature can repeat the same high-cost debugging cycle.
2. Continuing to solve e2e flakiness only at Playwright level will likely increase production code churn.
3. Mixing feature rollout and test stabilization in one change set should be treated as an exception, not normal workflow.

## 9. Progress Checkpoint (2026-07-16)

Estimated overall completion: 74%

Phase status:
1. Phase 0 (Change isolation and branch hygiene): 35%
2. Phase 1 (Define test contracts): 90%
3. Phase 2 (Deterministic component integration coverage): 78%
4. Phase 3 (Harden e2e harness): 89%
5. Phase 4 (Trim and stabilize e2e specs): 71%
6. Phase 5 (CI and governance): 33%

Evidence added in this checkpoint:
1. Phase-0 keep/revert matrix published in `docs/planning/sw-13-closure/sw-13-phase0-keep-revert-matrix-2026-07-16.md`.
2. Automated SW-13 readiness gate added via `scripts/check-stateful-readiness-gate.mjs`.
3. Readiness gate wired into `pree2e` and `pree2e:spec` in `package.json`.
4. Governance checklist updated in `docs/testing-policy.md` with explicit readiness-assertion requirement for Ship Hangar stateful specs.
5. Viewer scene assertions consolidated in `e2e/page-objects/viewer.page.ts` via reusable route/component/loaded/error helper methods.
6. Viewer specs migrated to intent-level helpers (`viewer-scene-rendering`, `viewer-interactions`, `viewer-list`, `viewer-ships`, `planet-view-zoom`) to reduce duplicated implicit timing checks.
7. Viewer fixture login/join setup standardized with `e2e/fixtures/viewer-session-bootstrap.ts` and adopted across viewer fixture modules without reintroducing the shared load-button regression path.

Open closure gaps remaining:
1. Phase-0 track split evidence is still partially documentary and not yet represented as an audited branch-level keep/revert outcome.
2. Readiness-contract usage is not yet universal across all stateful gameplay tests, only where Ship Hangar route surfaces are exercised.
3. Trim pass remains to remove residual implicit timing assertions in non-viewer high-churn stateful specs where deterministic readiness checks are now available.
4. CI/governance still needs a reviewer-facing checklist enforcement artifact linked from SW-13 closure status.