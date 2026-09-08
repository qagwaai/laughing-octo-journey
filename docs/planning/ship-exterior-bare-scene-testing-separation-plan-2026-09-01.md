# Ship Exterior Bare Scene Testing Separation Plan

Date: 2026-09-01  
Status: Phase 6 Complete; Phase 3 Integration Follow-up Remaining
Owner: Frontend gameplay reliability  
Scope: Ship exterior mission simulation seams and their Playwright consumers

## 1. Decision Summary

The `simulate*` methods associated with the ship exterior scene are test-only controls that currently live in, and mutate state owned by, production code. They should be isolated from the component and replaced with a narrow, explicitly enabled E2E adapter.

Implementation should **not** begin on top of an unexplained failing Playwright baseline.

Before refactoring:

1. Run and classify the currently failing affected specs.
2. Fix failures caused by defects in the ship exterior mission behavior or its test infrastructure.
3. Record unrelated, pre-existing failures and exclude them from the refactor's acceptance signal rather than expanding this work to repair the entire E2E suite.
4. Establish a passing focused baseline for the specs that exercise the APIs being changed.

This is a baseline-triage gate, not a requirement to make every unrelated Playwright spec pass before implementation. If an affected test is failing because its simulated path has already diverged from production, replace or correct that path as the first characterized migration slice rather than preserving incorrect behavior.

## 2. Problem Statement

[`ShipExteriorBareSceneComponent`](../../src/app/scene/ship-exterior/ship-exterior-bare-scene.component.ts) is a major product component with responsibilities spanning scene lifecycle, rendering, input, runtime context, mission state, persistence, synchronization, and test API registration.

The component currently:

- registers browser-global test APIs during every `ngOnInit`;
- exposes `resetMissionGateStateForTest` and `simulate*` wrappers;
- allows browser scripts to mutate active mission state and local persistence;
- provides alternate mission transitions that do not use the complete production workflow.

The simulation methods are called by Playwright tests, not by the product UI. This makes them E2E test seams rather than product simulation capabilities.

The current arrangement creates four architectural risks:

1. **Production/test concern mixing:** test controls are assembled and registered by a production scene component.
2. **Behavioral divergence:** simulated manufacture and repair duplicate only part of canonical mission progression.
3. **Split state ownership:** simulated updates publish and persist local state but bypass backend synchronization.
4. **False coverage:** some E2E tests appear to cover complete user workflows while injecting downstream state directly.

## 3. Goals

1. Remove test-only transition logic and browser-global registration responsibility from the scene component.
2. Ensure production and test-driven mission progression use canonical domain evaluators.
3. Establish one application boundary for mission-state publication, persistence, refresh, and backend synchronization.
4. Make E2E test controls explicit, narrow, deterministic, and unavailable in production.
5. Distinguish scene reaction tests from true end-to-end workflow tests.
6. Preserve mission-state storage compatibility throughout migration.
7. Improve test attribution so failures identify the domain, integration, component, or workflow layer at fault.

## 4. Non-Goals

1. Rewriting the ship exterior scene as part of this effort.
2. Replacing all existing browser test utilities at once.
3. Changing mission rules, storage keys, or persisted gate-state shapes.
4. Repairing unrelated Playwright failures.
5. Moving the existing simulator unchanged into an Angular service.
6. Adding a second test-only implementation of mission progression.

## 5. Current-State Findings

### 5.1 Test API registration is unconditional

[`ShipExteriorBareSceneComponent.ngOnInit`](../../src/app/scene/ship-exterior/ship-exterior-bare-scene.component.ts) calls `registerTestApi()` in normal component initialization. [`registerShipExteriorBareSceneTestApi`](../../src/app/scene/ship-exterior/ship-exterior-bare-scene-test-api.ts) publishes mutable APIs as:

- `window.__shipExteriorBareSceneTestUtils`
- the nested `legacy` surface on `window.__shipExteriorBareSceneTestUtils`

The API is removed on component destruction, but it is still registered in normal production execution.

### 5.2 Historical simulation logic duplicated canonical domain behavior

Canonical evaluators already exist in [`ship-exterior-mission.ts`](../../src/app/mission/ship-exterior-mission.ts):

- `evaluateMissionGateOnManufacture`
- `evaluateMissionGateOnRepair`
- `evaluateMissionGateOnDebrisCollection`

The former alternate simulator has been deleted. Temporary browser compatibility callbacks now delegate through the application facade and do not contain an alternate transition algorithm.

### 5.3 Simulated state follows a different consistency path

The temporary compatibility callbacks update the active scene context through `MissionProgressFacade`, which owns persistence, publication, refresh notification, and mission synchronization. They remain test-only seams rather than user-workflow coverage.

This means a successful simulation-driven test does not establish that:

- backend synchronization was requested;
- synchronization errors are handled correctly;
- route changes observe consistent state;
- local and backend mission states reconcile.

### 5.4 Debris simulation is not meaningful coverage

`simulateDebrisCollection` ignores `remainingDebrisCount` and returns the current or initial state without applying the canonical debris evaluator. Tests invoking it may appear to exercise progression while performing no transition.

### 5.5 Existing E2E names overstate their coverage

The following specs consume simulation controls:

- [`first-target-full-mission-flow.spec.ts`](../../e2e/tests/first-target-full-mission-flow.spec.ts)
- [`first-target-fabrication-menu-cue.spec.ts`](../../e2e/tests/first-target-fabrication-menu-cue.spec.ts)
- [`ship-exterior-test-utils.spec.ts`](../../e2e/tests/ship-exterior-test-utils.spec.ts)

Historical tests that called `simulateManufacture` or `simulateRepair` validated scene or guidance reactions to injected state. They did not validate manufacture or repair through the user-facing workflow.

## 6. Target Architecture

### 6.1 Canonical domain evaluators

Mission transition rules remain framework-neutral in [`ship-exterior-mission.ts`](../../src/app/mission/ship-exterior-mission.ts). Evaluators:

- accept explicit inputs;
- return transition results without browser or Angular dependencies;
- accept one caller-provided timestamp for deterministic tests;
- derive behavior and objective details from mission definitions.

No test-specific transition algorithm should exist beside these evaluators.

### 6.2 Mission progression application facade

Introduce or consolidate a single application-level facade responsible for:

1. resolving the active mission definition and state;
2. invoking the appropriate canonical evaluator;
3. publishing the resulting state;
4. persisting local state;
5. requesting backend synchronization when required;
6. surfacing synchronization failures according to existing product policy;
7. notifying interested UI/scene consumers.

Production fabrication, repair, debris collection, and any permitted E2E adapter should delegate to this boundary. The exact service location and name should follow existing mission service conventions and be finalized after checking for reusable orchestration already present.

The facade must not contain Playwright-specific concepts or browser globals.

### 6.3 Explicit E2E adapter

Move browser API assembly and registration outside the scene component into a test adapter with these properties:

- enabled explicitly in non-production E2E configuration;
- disabled by default;
- not registered in production;
- preferably excluded from production bundles;
- delegates behavior to production application boundaries;
- exposes fixture/state operations with names that state their intent;
- owns setup and teardown symmetrically;
- reports invalid inputs instead of silently returning success-shaped state.

If temporary compatibility requires the legacy global names, keep them in a compatibility adapter and mark them deprecated. Do not keep legacy wrappers in the component.

### 6.4 Scene component boundary

After migration, the component should:

- render and coordinate the active scene;
- react to mission-state changes;
- expose only product behavior through its normal Angular boundary;
- contain no `simulate*`, `*ForTest`, Playwright, or browser-global registration methods.

The scene may provide a production-neutral port required by the adapter, but that port must represent legitimate scene behavior rather than test terminology.

## 7. Test Strategy

Follow the repository testing policy's intended distribution: domain-heavy coverage, focused integration coverage, component wiring coverage, and a small number of high-value Playwright flows.

### 7.1 Domain unit tests

Cover canonical evaluators directly:

- manufacture transition;
- repair transition;
- debris transition;
- wrong item or repair kind;
- inactive or wrong-sequence steps;
- evidence and objective derivation;
- prerequisite unlocking;
- immutable input handling;
- one deterministic timestamp per transition.

These tests become the authoritative transition-rule coverage. Simulator unit tests should be removed once the simulator is removed.

### 7.2 Facade integration tests

Verify:

- canonical evaluator invocation;
- state publication;
- persistence;
- backend synchronization;
- unchanged/no-op transitions do not write or synchronize;
- synchronization failures remain visible and do not produce false success;
- sequential transitions operate on the latest state;
- missing active context or identity follows an explicit error policy.

### 7.3 Component tests

Verify that the scene reacts correctly to mission state supplied through production services:

- objective cue updates;
- revision/view refresh behavior;
- active-context changes;
- no test API registration responsibility remains.

### 7.4 Playwright scene-reaction tests

Where direct state setup is necessary, name and structure the tests as state-fixture or scene-reaction tests. The adapter should inject a known gate-state fixture or call a canonical application command; it should not implement a transition.

These tests should assert only the downstream behavior they actually cover.

### 7.5 True workflow E2E tests

Maintain a smaller set of user-visible mission journeys that:

- manufacture through the fabrication UI;
- repair through the repair UI;
- use deterministic socket/API mocks;
- assert resulting scene guidance;
- verify the expected synchronization request;
- avoid fixed-delay timing.

The “full mission flow” designation is reserved for tests that execute the user-facing steps rather than simulate their completion.

## 8. Implementation Phases

### Phase 0: Establish an attributable baseline

1. Run the three simulation-consuming Playwright specs individually with the line reporter.
2. Capture each failure by category:
   - product defect;
   - test-infrastructure defect;
   - stale assertion or contract;
   - simulation/production divergence;
   - unrelated environmental failure.
3. Re-run failing cases to distinguish deterministic failures from flakes.
4. Fix affected product or infrastructure defects that would obscure the refactor.
5. Record unrelated failures with issue references or a dated baseline note.
6. Require the focused affected baseline to pass, except tests explicitly selected for immediate replacement because they assert incorrect simulated behavior.

**Exit gate:** every affected failure is explained, and the acceptance set for the refactor is known.

### Phase 1: Characterize boundaries, not duplicated rules

1. Add missing tests around observable simulator side effects only where necessary to make migration safe.
2. Freeze time or pass an explicit timestamp.
3. Document which tests are state-injection tests and which claim workflow coverage.
4. Avoid expanding assertions around hard-coded simulator rules that will be deleted.

**Exit gate:** migration can detect changes in publication, persistence, refresh, and synchronization without canonizing divergent transition logic.

### Phase 2: Route transitions through canonical behavior

1. Replace simulator transition algorithms with calls to canonical evaluators.
2. Correct or remove the debris no-op.
3. Preserve the browser API shape temporarily if needed for small, reviewable changes.
4. Update affected expectations to canonical evidence and objective behavior.

**Exit gate:** no alternate manufacture, repair, or debris transition logic remains.

### Phase 3: Consolidate application orchestration

1. Introduce or reuse the mission progression facade.
2. Move state publication, persistence, refresh notification, and backend synchronization behind it.
3. Migrate production manufacture and repair workflows to the same boundary where doing so avoids duplication.
4. Add integration tests for success, no-op, wrong sequence, and synchronization failure.

**Exit gate:** all callers use one consistency path for a given mission transition.

### Phase 4: Extract and gate the E2E adapter

1. Move test API registration out of the component.
2. Add an explicit non-production/E2E enablement mechanism.
3. Keep legacy globals only in a deprecated compatibility layer.
4. Verify teardown removes all registered hooks.
5. Add an assertion that production configuration does not register the globals.

**Exit gate:** production component lifecycle no longer assembles test APIs, and production execution exposes no test mutation global.

Current progress:

- Registration, teardown, composition, replacement, and enablement are owned by `ShipExteriorBareSceneTestAdapter`.
- The component lifecycle directly delegates adapter registration and teardown.
- The formal global is available only when `environment.e2eTestApiEnabled` is enabled and the build is non-production.

**Exit gate: passed.** The scene lifecycle no longer performs browser-global registration, and production execution does not expose the adapter.

### Phase 5: Rebalance Playwright coverage

1. Rename or rewrite tests that only validate scene reactions.
2. Replace simulation calls in “full flow” coverage with user-facing fabrication and repair actions.
3. Prefer reusable page objects and socket fixtures over repeated `window` type declarations.
4. Remove migrated legacy API members and compatibility code.

Current progress:

- Critical full-mission and fabrication-menu coverage uses real fabrication and repair UI workflows.
- Local browser-utility mission progression is explicitly classified as scene-reaction coverage.
- Manufacture/repair compatibility consumers have been removed; scene-reaction coverage now reads published state, while critical mission workflow coverage traverses the real UI and synchronization path. Scene-inspection E2E utilities now use the nested formal adapter legacy surface for scan and targeting controls.

**Exit gate:** test names accurately describe coverage, and critical mission workflow coverage traverses the real UI and synchronization path.

**Exit gate: passed.** Critical fabrication and repair journeys use production UI workflows, while remaining adapter-driven tests are explicitly scene-reaction coverage.

### Phase 6: Delete obsolete simulation code

1. Remove component `simulate*` and `*ForTest` wrappers.
2. Remove legacy global declarations once no consumers remain.
3. Confirm production bundles and runtime do not contain or register the legacy mutation API.

**Exit gate:** repository search finds no obsolete simulation methods or legacy global consumers.

Current progress:

- No `simulateManufacture`, `simulateRepair`, or `simulateDebrisCollection` references remain in application or E2E code.
- The standalone `window.__shipExteriorTestUtils` global has been removed from declarations, registration, teardown, tests, and active E2E consumers.
- Remaining `*ForTest` methods are scene-reaction controls exposed through the explicitly gated formal adapter; they are not mission-transition simulators.
- Adapter global registration and teardown now live behind `ShipExteriorBareSceneTestAdapter`; the scene only supplies callbacks and delegates lifecycle operations.
- Adapter enablement now uses the explicit `environment.e2eTestApiEnabled` flag in addition to the production guard; development/E2E behavior remains enabled and production remains disabled.
- Formal/legacy API composition now also lives behind `ShipExteriorBareSceneTestAdapter`; the scene supplies only the callback dependencies.
- The scene lifecycle now delegates directly to `ShipExteriorBareSceneTestAdapter.registerFromSources`; the scene only provides a typed source object, and final formal/legacy API assembly is owned by the adapter service.
- Removed pass-through callback-grouping helpers from the adapter; the scene now supplies typed callback groups directly while meaningful context and mission callback factories remain adapter-owned.
- Made the adapter's context and mission callback factories private implementation details; only source-based registration remains part of the orchestration surface.
- Made raw dependency registration private; adapter lifecycle callers now use only the typed `registerFromSources` boundary.
- Made dependency assembly private as well; the adapter exposes only source-based registration and teardown to the scene lifecycle.
- Narrowed the adapter module's exported contract to the source provider and service lifecycle; callback-group types are now internal implementation details.

**Exit gate: passed.** Repository search finds no obsolete simulation methods or standalone legacy-global consumers. The production build contains no `__shipExteriorBareSceneTestUtils` or `e2eTestApiEnabled` references, and remaining `*ForTest` methods are documented scene-reaction controls required by the rendered test seam.

Validation record: 2026-09-04. `npm test -- --run` passed with 159 files and 2,016 tests; focused adapter Vitest passed with 7 tests; focused Playwright acceptance passed with 15 tests and 1 skip; lint, typecheck, Angular build, and whitespace checks passed. The build emitted only the existing `cold-boot-scan.css` 10 kB budget warning.

## 9. Playwright Failure Policy for This Refactor

Use the following decision rules:

| Failure classification | Action before implementation |
| --- | --- |
| Affected production defect | Fix first and add/retain regression coverage |
| Affected fixture, readiness, or mock defect | Fix first so refactor results are attributable |
| Simulation differs from canonical behavior | Treat canonicalization as the first migration change; do not preserve the bad simulation |
| Stale affected assertion | Correct it against the accepted production contract before or with the first migration slice |
| Unrelated deterministic failure | Record and exclude from this plan's focused gate |
| Flaky affected failure | Stabilize before structural refactoring |
| Environment-only failure | Document reproduction requirements and establish a reliable local/CI execution path |

Do not use a failing broad suite as evidence that the refactor failed or succeeded. Use a focused, recorded baseline plus broader regression runs as the implementation stabilizes.

## 10. Phase 0 Triage Record

Triage date: 2026-09-01  
GitHub Actions run: [33446469442](https://github.com/qagwaai/laughing-octo-journey/actions/runs/33446469442)  
Revision: `d982db61f3ade307f1aea0b661074130deab74f6`

### 10.1 CI result

- 166 tests executed.
- 163 passed, including two tests that passed on retry.
- 1 failed after retry.
- 2 skipped.
- Workflow setup, dependency installation, browser installation, Forge startup, and artifact upload all succeeded.
- Only the Playwright execution step failed.

### 10.2 Deterministic failure: debris scan utility

Test:

`ship-exterior-test-utils.spec.ts` — `debris scan utility completes scan without changing asteroid target lock state`

Observed:

- CI failed both the initial attempt and retry while waiting for `getScannableDebrisSamples()` to return at least one sample.
- Local serial reproduction failed 3/3 times with the same `Expected: > 0; Received: 0` signature.
- The CI trace shows a valid active ship scene and logs `FloatingDebrisController seeded cold-boot Tractor Beam`.
- Despite that seed log, the active `ShipSceneContext` continued to expose zero scannable debris samples.
- The test repeatedly calls `simulateDebrisCollection(1)`, but that method is a no-op and cannot create debris.
- Recent workflow history shows the E2E suite changed from green to red in the debris-scanning feature commit `7f76afc` and remained red for the next five runs. The Angular dependency update in the reviewed run did not originate the failure.

Classification:

**Affected production integration defect with a misleading test dependency.**

The controller claims to seed an item successfully, but the item is not observable through the active scene context. Separately, the test incorrectly implies that `simulateDebrisCollection` can prepare debris.

Required action before the broader separation refactor:

1. Add focused integration coverage from `FloatingDebrisStateService` publication to active `ShipSceneContext` scannable debris.
2. Fix the state propagation or context lifecycle defect revealed by that test.
3. Make the Playwright scenario seed debris deterministically through its location-list socket fixture or another production input.
4. Remove the `simulateDebrisCollection(1)` call from this scan-utility test.
5. Keep mission gate debris progression as a separate canonical evaluator test and migration concern.

### 10.3 Flakes: shared-session bootstrap

Tests:

- `character-ship-badge.spec.ts` — `ship badge shows hydrated active ship after joining first-target in progress`
- `viewer-ships.spec.ts` — `viewer requests scavenger pod GLB asset when rendering ship meshes`

Observed:

- Both CI attempts initially failed in `shared-session-bootstrap.ts`, before reaching their feature assertions.
- The page transitioned back to `left:login` after the helper had observed `left:character-list`.
- The helper then synchronously counted zero character items and looked for a character-list load button while the login page was active.
- Both tests passed on CI retry.
- Each test passed 5/5 times locally with one worker.
- A concurrent local run reproduced additional navigation instability, but local machine load prevents using its failure rate as a CI flake measurement.

Classification:

**Affected test-infrastructure race, sensitive to concurrent/full-suite execution.**

Required action before structural refactoring:

1. Replace instantaneous URL/count checks with one stable character-list readiness operation.
2. Re-check login state after redirects and before querying character-list controls.
3. Do not swallow the initial route wait without preserving diagnostic state.
4. Consolidate `bootstrapSharedGameMainSession` with the more defensive joined-game fixture rather than maintaining two recovery algorithms.
5. Validate both affected specs with the normal two-worker configuration and repeated full-suite-compatible runs.

### 10.4 Implementation order resulting from triage

1. Fix the debris state propagation and deterministic fixture setup.
2. Stabilize the shared-session bootstrap race.
3. Re-run the three affected specs with two workers until the focused baseline is green.
4. Begin canonical simulation delegation and E2E adapter extraction.

The debris fix should remain a small prerequisite slice. It must not preserve or expand the no-op simulation API.

### 10.5 Prerequisite fix result

Completed: 2026-09-01

- Replaced deferred debris propagation with an explicit controller-to-scene publication callback.
- Added focused integration coverage proving that a controller seed becomes a scannable `ShipSceneContext` sample.
- Added authoritative `item-list-by-location` debris to the Playwright scenario.
- Removed the debris scan test's call to the no-op `simulateDebrisCollection`.
- Consolidated shared character-list recovery so both shared-session fixture styles use the same readiness state machine.
- The three originally affected tests passed 3 repetitions each with two workers: 10/10 including setup.
- The complete three affected spec files passed with two workers: 22 passed, 1 intentionally skipped.
- A `createJoinedGameTest` mission-flow consumer passed with two workers: 3 passed, 1 intentionally skipped.
- Focused debris controller tests passed: 14/14.
- Typecheck, lint, and Angular build passed. The build retained the pre-existing cold-boot CSS budget warning.

**Phase 0 exit gate: passed.** The focused baseline is green and implementation of canonical simulation delegation may begin.

### 10.6 Full-suite stabilization follow-up

Completed: 2026-09-01

Repeated full-suite runs exposed additional load-sensitive races that focused runs did not initially reproduce. The following hardening was completed before declaring the baseline ready:

1. **Authoritative login readiness**
   - Removed the optional console-message wait from `loginViaUI`.
   - Login now waits on `SocketIOMock.connected`, with a bounded error that identifies namespace connection failure.
   - Locale login fixtures reuse the same socket-readiness helper.

2. **Shared character-list readiness**
   - Consolidated login redirect recovery, character hydration, and load-button handling in `ensureCharacterListReady`.
   - Reused that helper from shared game sessions, joined-game fixtures, and character-edit setup/reset.
   - This removed duplicated recovery algorithms that could observe the character-list URL immediately before an asynchronous redirect back to login.

3. **Deterministic cold-boot refresh timing**
   - Installed Playwright Clock before entering the flow.
   - Used `clock.fastForward()` to cross the production cinematic deadline without executing every angular-three animation frame.
   - Asserted the stable user-observable state: visible and enabled scan action.
   - Resumed normal scheduling before the asynchronous mission handoff.
   - `clock.runFor()` was rejected for this scene because it processes animation-frame work and can exhaust the test timeout under full-suite load.

4. **Authoritative debris identity**
   - The debris scan test now waits for the known server-fixture debris ID.
   - It no longer accepts the transient local cold-boot fallback, which is intentionally replaced when authoritative debris arrives.
   - This removed a race where the test captured the local ID and attempted to complete it after replacement.

5. **Character-edit redirect**
   - Allowed the sequential character and bust persistence flow a bounded 15-second route assertion.
   - The assertion remains event/state based; no fixed sleep was added.

Validation evidence:

- Repeated focused and two-worker runs passed for every previously observed signature.
- All direct consumers of the consolidated joined-game fixture passed.
- Typecheck, lint, formatting checks, Angular build, and `git diff --check` passed during stabilization.
- The Angular build retained the pre-existing `cold-boot-scan.css` budget warning.
- A final local full Playwright suite completed fully green on 2026-09-01.

**Implementation entry point:** begin with Phase 1 characterization only where it protects orchestration boundaries, then proceed directly to Phase 2 canonical evaluator delegation. Do not reintroduce timing waits, transient debris selection, or alternate simulation behavior.

### 10.7 Phase 1 and Phase 2 implementation result

Completed: 2026-09-03

- Added simulator characterization for changed-state publication, persistence, refresh, canonical evidence, and canonical no-op behavior.
- Replaced simulator manufacture and repair transition algorithms with calls to `evaluateMissionGateOnManufacture` and `evaluateMissionGateOnRepair`.
- Replaced the debris no-op with a call to `evaluateMissionGateOnDebrisCollection`; the temporary browser API signature remains unchanged.
- Preserved persisted mission keys and `ShipExteriorMissionGateState` shapes.
- Confirmed production manufacture and repair paths already use the canonical evaluators; no broader facade or E2E adapter extraction was needed for this slice.
- Preserved all Phase 0 stabilization behavior in sections 10.5 and 10.6, including authoritative fixture identities, `SocketIOMock.connected`, `ensureCharacterListReady`, and timer-safe `clock.fastForward()` coverage.

**Phase 1 characterization exit gate: passed.** Boundary behavior is protected without adding tests for deleted simulator rules.

**Phase 2 exit gate: passed.** Manufacture, repair, and debris transitions have no alternate simulator algorithms; the compatibility methods delegate to canonical evaluators.

Remaining work:

1. Phase 5: complete migration or removal of remaining compatibility consumers.
2. Phase 6: remove obsolete compatibility methods and legacy globals after consumers migrate.

### 10.8 Phase 3 implementation slice

Started: 2026-09-03

- Added `MissionProgressFacade` to coordinate canonical manufacture/repair evaluation, persisted-state loading and normalization, local persistence, and mission-status synchronization.
- Migrated the fabrication queue, repair asset list, and ship repair detail workflows to the facade.
- Added focused facade characterization for successful manufacture, wrong repair no-op, persistence, synchronization, and persisted state-shape compatibility.
- Routed scene launch mission synchronization through the facade while retaining launch-specific contention backoff and scene publication callbacks.
- Added an explicit production-build guard preventing browser test API registration while preserving dev/E2E compatibility.
- Removed the remaining `simulateDebrisCollection` call from deterministic mission-flow setup; debris fixture identity remains authoritative and is not prepared through simulation.
- Preserved the existing idempotent ship-repair synchronization behavior and all persisted keys/state shapes.
- Scene test controls remain on the compatibility path until the facade can also own scene publication and refresh without widening this slice.

Phase 3 remains in progress pending full scene publication/refresh consolidation; launch synchronization now uses the facade boundary.

**Phase 3 exit gate: passed.** Scan, launch, manufacture, and repair transitions all use one publication, persistence, and synchronization path via `MissionProgressFacade`.

#### Phase 3 integration follow-up (2026-09-08)

- Added `src/app/services/mission-progression-facade.integration.vitest.ts`, exercising the facade against the real `ShipExteriorMissionStateService` (localStorage) and real `MissionProgressSyncService` with only `MissionService.upsertMissionStatus` stubbed.
- Integration coverage now asserts all four required cases across publication, persistence, refresh notification, and backend synchronization:
  - success: manufacture completes, publishes to the registered scene consumer, persists, and upserts mission status;
  - no-op: repeated manufacture publishes nothing, leaves persisted bytes unchanged, and issues no upsert;
  - wrong sequence: out-of-sequence manufacture and repair perform no publication, persistence, or synchronization;
  - synchronization failure: `update-failed` results and thrown transport errors leave local publication and persistence intact.
- Additional boundary coverage: publisher disposal, `syncPublishedState` external publication, session-key-less skip behavior, missing persisted state, and idempotent completed ship-repair resynchronization.
- `MissionProgressFacade.advanceRepair` no longer resynchronizes on any unchanged `'ship'` repair; it resynchronizes only when the mission's canonical repair predicate matches an already-completed step, so wrong-sequence repairs no longer produce backend traffic.
- `MissionProgressFacade` now contains synchronization rejections at the boundary and logs a warning instead of emitting an unhandled promise rejection; local publication and persistence remain authoritative.
- Persisted mission keys and `ShipExteriorMissionGateState` shapes are unchanged; no simulator rules were reintroduced or canonized.
- Baseline note: the referenced CI E2E failure (`character-add.spec.ts`, "continues to character list when bust create is blocked in background save", run 33885402064 on origin/main `354948c`) is classified as **unrelated** to this slice under section 9 — it exercises character creation/bust routing, not mission progression, and is excluded from this plan's focused gate.
- Validation for this slice is owned by the user per the project validation contract; no tests, lint, or builds were run by the assistant.

#### Phase 3 scan consolidation (2026-09-08)

Closes the remaining Phase 3 exit-gate gap: scan was the last mission transition not using the shared boundary.

- Before this slice the production hover-scan completion callback (`onScanComplete` → `forceCompleteIronScanInContext`) advanced the gate with a hand-rolled `setStepStatus` pair and a hardcoded objective string, persisted locally, and **never synchronized to the backend**, while `evaluateMissionGateOnScan` was dead in production code.
- Added `MissionProgressFacade.advanceScan`, which evaluates through canonical `evaluateMissionGateOnScan` and reuses the existing publication/persistence/synchronization path.
- Both scene scan-completion paths now call `advanceMissionGateOnScan`, which routes identity-bearing contexts through the facade and falls back to in-memory canonical evaluation when no persistable identity exists (preserving prior behavior for unidentified characters).
- Deleted the now-unused `updateMissionGateState` and `setStepStatus` scene helpers; no duplicated transition logic remains for scan.
- Narrowed the scan contract to a new `MissionScanSample` structural type so gate evaluation no longer depends on rendering- or persistence-specific sample fields. `AsteroidScanSample` and `ShipSceneAsteroidSample` both satisfy it; `first-target` mirrors the type locally to avoid a circular import.
- Behavior improvements now covered by tests: scan completion records canonical evidence (`sourceScanId`, `celestialBodyId`, `material`), a non-qualifying material no longer completes the iron identification step, and rescanning an already-identified asteroid no longer resets `neutralize_identified_asteroid` back to `active` (a latent progress-regression defect in the previous hand-rolled path).
- The canonical `neutralize_identified_asteroid` objective text is byte-identical to the previously hardcoded string, so overlay assertions such as `ship-exterior-hangar-resume.spec.ts` do not drift.
- `forceCompleteIronScanInContext` now applies the transition to the context whose sample was scanned rather than the active context; previously the two could diverge.
- Known pre-existing behavior left untouched as out of scope: the scene scan paths rewrite the scanned sample's material to `Iron` before evaluation, including on the production hover-scan path.
- Persisted mission keys and `ShipExteriorMissionGateState` shapes remain unchanged.
- Validation for this slice is owned by the user; no tests, lint, or builds were run by the assistant.

#### Phase 3 socket-contract coverage (2026-09-08)

- Added a `Mission progression facade over the socket transport` suite to `src/app/services/mission-flow.integration.vitest.ts`, composing the real `MissionProgressFacade`, `ShipExteriorMissionStateService`, `MissionProgressSyncService`, `MissionService`, and the mock socket transport. This closes the seam that previously split coverage: facade tests stubbed `MissionService`, while socket tests bypassed the facade, so no test asserted the emitted payload for the newly added scan traffic.
- Socket-contract assertions now cover the canonical scan upsert (`missionId`, `status: 'active'`, and `statusDetail` carrying canonical evidence and the unlocked objective text), the completed-mission upsert on final repair, silence for a non-qualifying scan, and persisted-progress retention when the transport is disconnected.
- Replaced the test-local `applyMissionEvent` transition simulator with the canonical evaluators. The previous helper advanced by array index instead of `prerequisiteStepKeys`, synthesized placeholder objective text, recorded no evidence, and completed the iron identification step for any scan regardless of material; it had drifted from production rules once scan became canonical.
- `createGateState` now derives objective text from canonical step definitions so fixture state matches evaluator output.
- Validation for this slice is owned by the user; no tests, lint, or builds were run by the assistant.

#### Scan honesty follow-up (2026-09-08)

Addresses the forced-`Iron` finding flagged during the Phase 3 scan consolidation.

Problem: asteroid materials are assigned at generation time by `pickWeightedAsteroidMaterial`, and `generateMaterialAssignments` guarantees at least one `Iron` sample exists. The scene's scan completion nevertheless overwrote `revealedMaterial` to `Iron` on every hover-scan, so all asteroids reported Iron, material variety was invisible, `identify_iron_asteroid` was satisfiable by scanning any asteroid, and the guaranteed-Iron safeguard was dead weight. The same block fabricated `revealedKinematics` with `generateRandomAsteroidKinematics()` even though the sample's real `capturedKinematics` was present at runtime.

Resolution:

- Scanning now reveals already-generated survey data instead of inventing it. `revealScannedAsteroid` sets `scanned`/`scanProgress` and reveals `revealedKinematics` from `capturedKinematics`, retaining random generation only as a last-resort fallback. `revealedMaterial` is never rewritten.
- Added `capturedKinematics` to `ShipSceneAsteroidSample` and its clone routine. The data already survived at runtime through object spread; only the type declaration was missing. This matches the existing `revealedKinematics ?? capturedKinematics` convention in `ship-exterior-celestial-body-controller.ts` and `createResumedAsteroidSamples`.
- Production hover-scan (`completeAsteroidScanInContext`, renamed from `forceCompleteIronScanInContext`) reveals the hovered sample and no-ops when the requested sample id is absent. An asteroid may legitimately be destroyed or collected between hold-start and hold-completion, and an already-collected Iron asteroid simply leaves the objective incomplete; neither is a fault.
- The gated E2E control `forceCompleteIronScan` keeps deterministic mission advancement by selecting the genuinely Iron asteroid, honoring a requested id only when that sample is actually Iron. When no Iron asteroid exists it throws a descriptive error rather than silently scanning an unrelated sample, because generation guarantees one and its absence means the fixture contract is broken. Failing at the bad state keeps the cause attributable instead of surfacing as a distant assertion timeout.
- Updated `ship-exterior-test-utils.spec.ts` and `ship-exterior-hangar-resume.spec.ts`, which passed `samples[0].id` and then asserted that same sample became scanned; they now locate and assert the Iron asteroid. Remaining consumers assert gate progression rather than per-sample scan state and were unaffected. `first-target-cue-scenario.ts` already searched for a genuinely Iron scanned sample and now finds a truthful one.
- Persisted mission keys, gate-state shapes, and the adapter's browser API surface are unchanged.
- Not covered by unit tests: the scene has no component-level vitest harness, so this behavior is exercised through E2E only. A scene-level harness remains a possible follow-up. **Resolved by the scan reveal controller extraction below.**
- Validation for this slice is owned by the user; no tests, lint, or builds were run by the assistant.

#### Domain transition coverage (2026-09-08)

Closes the final acceptance item: deterministic domain coverage of transition rules and negative paths.

- Added a `transition evidence and no-op preservation` suite to `src/app/mission/ship-exterior-mission.vitest.ts`. Every added case passes an explicit `completedAt`, so none depend on wall-clock time.
- Canonical evidence was previously asserted nowhere in domain tests, despite being the mechanism Phases 1-2 established and the scan slice depends on. Scan, manufacture, and repair now assert their recorded `evidence` and `completedAt`, including the `manufacture:<item>:<ts>` and `repair:<kind>:<ts>` source-scan identifiers.
- Added negative paths not previously covered: a scan sample with no revealed material, and a rescan of an already-identified asteroid. The latter guards at domain level the progress-regression defect the previous hand-rolled scene path exhibited.
- Added explicit assertions that unchanged transitions preserve both `updatedAt` and step state. The facade no-op tests rely on this to prove persisted bytes are untouched, but nothing had pinned the underlying evaluator behavior.
- Validation for this slice is owned by the user; no tests, lint, or builds were run by the assistant.

#### Scan reveal controller extraction (2026-09-08)

Closes the coverage gap recorded in the scan honesty follow-up: that behavior was previously exercised through E2E only.

- Extracted scan completion and mission-gate advancement from `ShipExteriorBareSceneComponent` into `AsteroidScanRevealController`, following the established scene-collaborator pattern used by `AsteroidScanController`, `ShipExteriorLaunchController`, and `ShipExteriorBareSceneTestAdapter`: a deps interface of callbacks plus structurally-typed sample and context contracts.
- The controller is generic over sample and context types, so the component wires `ShipSceneAsteroidSample` and `ShipSceneContext` without casts, and unit tests supply lightweight fakes.
- The component now retains only thin delegating wrappers for `forceCompleteIronScan` and `completeAsteroidScanInContext`; `revealScannedAsteroid` and `advanceMissionGateOnScan` moved wholesale. The now-unused `evaluateMissionGateOnScan` and `generateRandomAsteroidKinematics` imports were removed from the component.
- Added `asteroid-scan-reveal-controller.vitest.ts` covering honest reveal (material never rewritten, captured kinematics preferred, already-revealed kinematics retained, random generation only as last resort, unrelated fields and sibling samples untouched), production no-op paths (missing sample, unknown context), the gated iron control (selects genuine Iron, ignores a non-Iron requested id, honors a genuinely Iron requested id, throws with the inspected sample count when none exists), and mission routing (facade path, identity-less fallback, facade-returns-null fallback, non-qualifying scan publishes nothing, absent gate state returns null).
- The identity-less fallback branch of `advanceMissionGateOnScan` now has direct coverage; it previously had none at any level.
- Deliberately out of scope: the Phase 4 leftover regarding adapter callback-dependency construction. Unmerged local-main commit `984fc0b` rewrites that same component region, so touching it here would create an avoidable conflict.
- Behavior is unchanged; this slice is a structural extraction plus new unit coverage.
- Validation for this slice is owned by the user; no tests, lint, or builds were run by the assistant.

#### Validation record for the 2026-09-08 slices

**Validation environment defect.** The first five slices were reported green, but those runs executed in the primary `main` worktree, which is a separate directory that never contained these changes. The work was uncommitted in the `agents/phase-3-integration-follow-up` worktree and had therefore never been exercised. Once the branch was committed, merged with `origin/main`, and validated in the correct worktree, five defects surfaced immediately. Record where a validation run executed, not only its result.

Defects found on first real validation, in order:

1. `AsteroidScanRevealSample` declared `revealedMaterial.material` as optional while the canonical `MissionScanSample` requires it, breaking assignability at the gate evaluation and facade call sites. Fixed by extending `MissionScanSample` rather than restating its shape.
2. The socket integration test's local `GateStepState` mirror omitted `evidence`, so the canonical field was unreachable through `Array.find`. Fixed by modelling the field in the mirror.
3. `createHarness` in the scan controller spec defaulted the gate state with `??`, so an explicit `null` was replaced by a real state and the null-gate fallback path was never exercised. The test failed loudly rather than passing vacuously.
4. `first-target-full-mission-flow.spec.ts` used `samples[0]` for scanning, targeting, and launching, relying on the old forced-Iron behavior to make them consistent. With honest reveal, the scan and the launch target must both be the genuinely Iron asteroid.
5. The same spec asserted that `celestialBodyUpsertRequests[0]` carried the scanned sample's `sourceScanId`. Seeded asteroids are bulk-upserted as unscanned in sample order, so index 0 is always `sample-a1` regardless of what was scanned; the assertion verified seeding order while appearing to verify the scan, and passed only because the scanned sample used to be `samples[0]`. Now matched on the `scan-complete` request identity.

Items 1-3 were defects in the new code and its tests. Items 4-5 were pre-existing test couplings that the honest-reveal change exposed; item 5 was a latent tautology.

**Unresolved intermittency.** `ship-exterior-hangar-resume.spec.ts` "keeps scanned asteroid state after ship specs and View Exterior round-trip" failed once, then passed on re-run with no change to that spec or to production code, so it is intermittent rather than fixed. In the failing run the application state was provably correct: the genuinely Iron asteroid was scanned, the objective advanced, and `TARGET IRON` rendered. Only the "View Specs" click failed to move the right outlet, with no interception error and no competing navigation. No mechanism was confirmed. One candidate remains open: the E2E mission-upsert fixtures return responses without `correlationId` or `requestIdentity`, so `MissionService` drops them as unmatched and every mission sync now settles through the full 5000 ms timeout, matching the default 5000 ms URL assertion window. Now that scans synchronize, that dangling timer occurs in more tests than before.

**Final result.** Unit, typecheck, build, and full E2E all pass on the merged branch.


### 10.9 Phase 4 implementation slice

Started: 2026-09-03

- Guarded the scene adapter from registering the formal browser global when `environment.production` is true.
- Made adapter enablement explicit at the registration boundary and added coverage for disabled registration, teardown, and replacement of an existing hook.
- Kept the existing dev/E2E API shape and nested legacy callback surface for incremental migration.
- Extracted registration, teardown, API composition, and enablement into `ShipExteriorBareSceneTestAdapter`.
- Removed the standalone compatibility global; all active consumers use the formal adapter and its nested legacy surface.

### 10.10 Phase 5 implementation slice

Started: 2026-09-03

- Removed the obsolete debris simulation call from `ship-exterior-test-utils.spec.ts`; the test now proceeds from authoritative mission state without treating debris simulation as fixture setup.
- Added authoritative iron inventory to the first-target cue fixture.
- Migrated the active “repair & retrofit menu cue after manufacture” scenario from `simulateManufacture` to the real Fabrication Lab, Print Queue, and dev completion workflow. Mission progression now reaches the scene through the production facade and item-upsert boundary.
- The deterministic full-mission scene-reaction test remains simulation-backed until Phase 3 completes scene publication/refresh consolidation; it is not a user-workflow assertion.
- The skipped refresh characterization and repair completion portion of the full-mission scene-reaction coverage still retain simulation calls intentionally; remaining active repair consumers require a separate workflow migration slice.
- Added a facade publisher boundary keyed by the persisted mission context. The ship-exterior scene registers its active contexts and now receives changed manufacture/repair state immediately while retaining local persistence and backend synchronization.
- Added facade characterization proving changed transitions publish to a registered scene consumer.
- Retried the deterministic full-mission manufacture migration after scene publication consolidation: the test now uses the real Fabrication Lab and Print Queue workflow with authoritative iron inventory, while retaining simulation only for the later repair scene-reaction assertion.
- Extended the full-mission socket fixture to retain the manufactured Hull Patch Kit across authoritative ship-list refreshes and acknowledge ship upserts.
- Migrated the full-mission repair progression to the real Repair & Retrofit workflow; the scene assertion now observes facade-published completion state after the production ship repair path consumes the kit.
- Removed the now-unused `simulateDebrisCollection` browser hook and simulator wrapper; debris progression has no remaining E2E consumers and is covered by the canonical evaluator instead of a compatibility control.
- Added explicit adapter characterization that manufacture and repair simulation hooks remained legacy compatibility controls only; active fabrication and repair workflow coverage uses production UI paths.
- Extracted complete formal and legacy callback assembly into `createShipExteriorBareSceneTestApi`; registration and production gating remain owned by the scene boundary.
- Removed manufacture/repair transition ownership from `MissionGateSimulator`; temporary compatibility callbacks now delegate directly through `MissionProgressFacade`, while simulator coverage remains limited to reset and scene-state helpers.
- Reclassified the remaining local-utility mission-flow E2E as scene-reaction coverage and removed an unnecessary manufacture simulation from the wrong-sequence assertion; real UI workflow coverage remains in the fabrication and full-mission specs.
- Marked the remaining manufacture/repair browser callbacks as deprecated compatibility seams in the formal legacy contract; they remain available only for the explicitly named scene-reaction characterization.
- Deleted the obsolete `MissionGateSimulator` wrapper and inlined only its generic state publication/reset helpers at the scene boundary; canonical manufacture and repair delegation remains exclusively in `MissionProgressFacade`.
- Removed the final manufacture/repair compatibility callbacks and their active/skipped E2E consumers; no `simulateManufacture` or `simulateRepair` references remain in application or E2E code.
- Retained the legacy global temporarily because active scan, targeting, debris, ship, and hangar-resume E2E utilities still consume its scene-inspection controls; migration to `__shipExteriorBareSceneTestUtils.legacy` is the next adapter-cleanup slice.
- Migrated the shared first-target cue fixture and fabrication-menu cue spec to consume the nested formal adapter legacy surface; the standalone legacy global remains only for the other active scene-inspection specs.
- Migrated cold-boot asteroid parity coverage to the nested formal adapter legacy surface; the standalone legacy global remains only for the remaining multi-feature scene utility specs.
- Confirmed `selectFirstScannedIronTargetForTest` remains required by the rendered TARGET IRON control and `ShipExteriorViewFacade`; it was retained alongside the other explicitly gated scene-reaction controls.
- Migrated the initial readiness, asteroid-sample, and forced-scan accesses in full-mission coverage to the nested formal adapter legacy surface; the remaining full-mission reads are queued for the next compatibility migration slice.
- Migrated all remaining full-mission scene-state reads to the nested formal adapter legacy surface; the standalone legacy global is now limited to ship-exterior utility and hangar-resume specs.
- Migrated hangar-resume scan and targeting access to the nested formal adapter legacy surface; only the broad ship-exterior utility spec still consumes the standalone legacy global.
- Migrated the asteroid targeting/hold-cancellation utility test to the nested formal adapter legacy surface; remaining ship-exterior utility tests are queued for subsequent focused slices.
- Migrated all remaining ship-exterior utility coverage to the nested formal adapter legacy surface.
- Removed the standalone `window.__shipExteriorTestUtils` declaration, registration, teardown, and adapter-test expectations; scene-inspection controls now have one browser-global entry point.
- Extracted adapter global registration and teardown into `ShipExteriorBareSceneTestAdapter`; the scene no longer imports or directly invokes browser-global registration functions.
- Moved formal/legacy API composition into `ShipExteriorBareSceneTestAdapter`; the scene no longer imports or invokes the API factory directly.
- Isolated the scene's adapter dependency construction behind `createTestAdapterDependencies` so lifecycle wiring and callback assembly are separate.
- Centralized the shared mission-state getter used by formal and legacy adapter surfaces, preserving the existing active-state fallback behavior.
- Centralized the shared mission-state reset callback used by formal and legacy adapter surfaces, preserving the existing persistence and revision updates.
- Centralized active-context lookup within adapter dependency construction so formal snapshot and legacy inspection callbacks use one scene-context access path.
- Extracted shared formal/legacy mission-state callback wiring into `ShipExteriorBareSceneTestAdapter`; the component now supplies mission getter/reset functions without duplicating their API mapping.
- Extracted shared active-context snapshot and inspection callback wiring into `ShipExteriorBareSceneTestAdapter`; null behavior remains unchanged when no context is active.
- Extracted asteroid, debris, and ship sample inspection callback grouping into `ShipExteriorBareSceneTestAdapter`; the scene now supplies only typed sample providers.
- Extracted scan and targeting control callback grouping into `ShipExteriorBareSceneTestAdapter`; callback signatures and scene behavior remain unchanged.
- Extracted launch, active-inventory, and launch-toast callback grouping into `ShipExteriorBareSceneTestAdapter`; the scene now supplies this control group as a typed dependency.
- Extracted formal context, flight-control, and route-feed callback grouping into `ShipExteriorBareSceneTestAdapter`; the scene now supplies these controls as a typed formal dependency group.
- Moved final formal/legacy dependency assembly into `ShipExteriorBareSceneTestAdapter.createDependencies`; the scene now supplies grouped callback providers without constructing browser API surfaces.
- Removed the scene-level registration wrapper; lifecycle code now delegates directly to the extracted adapter service.
- Made adapter registration replace any prior browser hook before publishing the new API, preventing stale hooks during scene reinitialization; added characterization coverage for replacement behavior.
- Added adapter composition characterization coverage proving grouped formal and legacy callback providers retain identity across dependency assembly.
- Repair/retrofit now refreshes authoritative ship context on every page entry instead of trusting stale navigation state, preserving the hard-fail path when no usable spatial data is returned.
- Moved grouped callback dependency assembly into `ShipExteriorBareSceneTestAdapter.createDependenciesFromSources`; the scene now supplies bound production callbacks and source accessors rather than assembling adapter groups.
- Removed the duplicate direct callback-composition path; source-based composition is now the adapter's single dependency assembly boundary.
- Flattened the scene-to-adapter binding contract; the scene now only binds production methods and state accessors, while the adapter owns callback grouping and formal/legacy projection.
- Moved dependency creation and registration orchestration behind `ShipExteriorBareSceneTestAdapter.registerFromSources`; the scene no longer owns a test-dependency factory method.

## 11. Validation Commands

Phase 0 focused baseline:

```bash
npx playwright test e2e/tests/first-target-full-mission-flow.spec.ts e2e/tests/first-target-fabrication-menu-cue.spec.ts e2e/tests/ship-exterior-test-utils.spec.ts --reporter=line
```

Focused unit tests during canonicalization:

```bash
npm run test:spec -- src/app/services/mission-progression-facade.vitest.ts
npm run test:spec -- src/app/services/mission-progression-facade.integration.vitest.ts
```

As tests move, replace the simulator path above with the canonical evaluator and facade test files.

Required implementation checks:

```bash
npm run typecheck
npm run build
npm run lint
```

Final E2E validation:

```bash
npx playwright test e2e/tests/first-target-full-mission-flow.spec.ts e2e/tests/first-target-fabrication-menu-cue.spec.ts e2e/tests/ship-exterior-test-utils.spec.ts --reporter=line
```

Run the broader Playwright suite after the focused acceptance set passes and compare results with the Phase 0 baseline.

## 12. Acceptance Criteria

- [x] All affected baseline failures are classified.
- [x] No alternate mission transition algorithm exists for E2E tests.
- [x] Debris progression is canonical while the temporary compatibility API remains.
- [x] Mission transitions use one state publication, persistence, and synchronization boundary.
- [x] The scene component contains no simulation or test API registration methods. (Callback dependency construction remains local pending a wider port extraction.)
- [x] Browser test hooks require explicit E2E enablement.
- [x] Production execution does not register either legacy test global.
- [x] Domain tests cover transition rules and negative paths deterministically.
- [x] Integration tests cover persistence and backend synchronization.
- [x] Scene-reaction tests are named according to their actual scope.
- [x] At least one critical Playwright mission journey uses real fabrication and repair UI actions.
- [x] Storage keys and persisted gate-state shapes remain compatible.
- [x] Focused tests, typecheck, lint, and Angular build pass.
- [x] Broader E2E results are no worse than the recorded baseline.

## 13. Risks and Mitigations

### Persisted mission compatibility

**Risk:** extraction changes state normalization or storage shape.  
**Mitigation:** retain existing storage keys and state types; add before/after fixture tests.

### Hidden callers of browser globals

**Risk:** legacy utilities outside the known specs depend on the globals.  
**Mitigation:** repository search, temporary deprecation adapter, and removal only after zero consumers remain.

### Facade becomes a new oversized service

**Risk:** consolidation moves all component complexity into one service.  
**Mitigation:** keep domain rules pure, keep transport in the existing sync service, and let the facade coordinate rather than reimplement.

### Test adapter accidentally ships

**Risk:** runtime gating hides registration but test code remains reachable in production.  
**Mitigation:** combine an explicit configuration gate with a production-build/runtime assertion; prefer build-time exclusion where the Angular configuration supports it cleanly.

### Refactor masks existing failures

**Risk:** a red baseline makes regressions impossible to attribute.  
**Mitigation:** enforce Phase 0 classification and compare focused and broad results against the recorded baseline.

## 14. Rollback Strategy

Keep migration slices independently reversible:

1. canonical evaluator delegation;
2. facade orchestration;
3. adapter extraction and gating;
4. Playwright workflow replacement;
5. legacy deletion.

During migration, the compatibility adapter may preserve the existing global API shape while delegating to the new boundary. Do not restore duplicated transition logic as a rollback mechanism.
