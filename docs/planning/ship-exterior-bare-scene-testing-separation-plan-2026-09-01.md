# Ship Exterior Bare Scene Testing Separation Plan

Date: 2026-09-01  
Status: Phase 4 In Progress; Phases 3-6 Remaining  
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

- constructs [`MissionGateSimulator`](../../src/app/scene/ship-exterior/mission-gate-simulator.ts) directly;
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
- `window.__shipExteriorTestUtils`

The API is removed on component destruction, but it is still registered in normal production execution.

### 5.2 Simulation logic duplicates canonical domain behavior

[`MissionGateSimulator`](../../src/app/scene/ship-exterior/mission-gate-simulator.ts) hard-codes:

- mission step keys;
- accepted manufacture and repair types;
- objective text;
- status transitions;
- current-time creation.

Canonical evaluators already exist in [`ship-exterior-mission.ts`](../../src/app/mission/ship-exterior-mission.ts):

- `evaluateMissionGateOnManufacture`
- `evaluateMissionGateOnRepair`
- `evaluateMissionGateOnDebrisCollection`

The alternate simulator does not reproduce the full evidence, prerequisite, definition, and synchronization behavior of production workflows.

### 5.3 Simulated state follows a different consistency path

The component supplies simulator callbacks that update the active scene context, persist mission state, and refresh the view. Unlike production manufacture and repair workflows, this path does not synchronize mission progress through `MissionProgressSyncService`.

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

Tests that call `simulateManufacture` or `simulateRepair` validate scene or guidance reactions to injected state. They do not validate manufacture or repair through the user-facing workflow.

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

### Phase 5: Rebalance Playwright coverage

1. Rename or rewrite tests that only validate scene reactions.
2. Replace simulation calls in “full flow” coverage with user-facing fabrication and repair actions.
3. Prefer reusable page objects and socket fixtures over repeated `window` type declarations.
4. Remove migrated legacy API members and compatibility code.

**Exit gate:** test names accurately describe coverage, and critical mission workflow coverage traverses the real UI and synchronization path.

### Phase 6: Delete obsolete simulation code

1. Delete [`mission-gate-simulator.ts`](../../src/app/scene/ship-exterior/mission-gate-simulator.ts).
2. Delete or migrate [`mission-gate-simulator.vitest.ts`](../../src/app/scene/ship-exterior/mission-gate-simulator.vitest.ts).
3. Remove component `simulate*` and `*ForTest` wrappers.
4. Remove legacy global declarations once no consumers remain.
5. Confirm production bundles and runtime do not contain or register the legacy mutation API.

**Exit gate:** repository search finds no obsolete simulation methods or legacy global consumers.

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

1. Phase 3: finish consolidating scene publication/refresh and add facade boundary characterization.
2. Phase 4: extract and explicitly gate the E2E adapter while retaining only temporary legacy compatibility.
3. Phase 5: rebalance Playwright coverage toward real fabrication and repair UI workflows.
4. Phase 6: remove obsolete simulator methods, tests, and legacy globals after consumers migrate.

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

### 10.9 Phase 4 implementation slice

Started: 2026-09-03

- Guarded `registerTestApi()` from registering either legacy browser global when `environment.production` is true.
- Made adapter enablement explicit at the registration boundary and added coverage for disabled registration and complete teardown of both globals.
- Kept the existing dev/E2E API shape and legacy compatibility globals unchanged for incremental migration.
- Explicit adapter extraction, teardown assertions, and removal of legacy globals remain for the rest of Phase 4.

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
- Added explicit adapter characterization that manufacture and repair simulation hooks remain legacy compatibility controls only; active fabrication and repair workflow coverage now uses production UI paths.
- Kept those two legacy hooks until the dedicated scene-reaction/test-utility consumers are reclassified or removed in Phase 6.

## 11. Validation Commands

Phase 0 focused baseline:

```bash
npx playwright test e2e/tests/first-target-full-mission-flow.spec.ts e2e/tests/first-target-fabrication-menu-cue.spec.ts e2e/tests/ship-exterior-test-utils.spec.ts --reporter=line
```

Focused unit tests during canonicalization:

```bash
npm run test:spec -- src/app/scene/ship-exterior/mission-gate-simulator.vitest.ts
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
- [ ] Mission transitions use one state publication, persistence, and synchronization boundary.
- [ ] The scene component contains no simulation or test API registration methods.
- [ ] Browser test hooks require explicit E2E enablement.
- [ ] Production execution does not register either legacy test global.
- [ ] Domain tests cover transition rules and negative paths deterministically.
- [ ] Integration tests cover persistence and backend synchronization.
- [ ] Scene-reaction tests are named according to their actual scope.
- [ ] At least one critical Playwright mission journey uses real fabrication and repair UI actions.
- [ ] Storage keys and persisted gate-state shapes remain compatible.
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
