# SW-13 Replacement Design Checkpoint

Status: Active
Date: 2026-07-10
Scope: Ship Exterior hard replacement (Option A)

## 1) Confirmed Operating Decisions

1. Cutover model: Option A hard replace.
2. Legacy policy: no regression support, no legacy fallback path.
3. Ownership model: one Ship Exterior component type with multiple runtime instances.
4. Rendering isolation: each ship instance owns its own scene, camera, renderer, and canvas.
5. Switch model: show/hide + pause/resume between ship instances; no shared canvas retargeting.
6. Runtime invariants:
   - initialized ship instances remain resident until logout
   - inactive instances are fully paused
   - async writes are ship-owned only (no cross-ship mutation)
   - no reseed/rebuild for initialized instances on switch-back

## 2) Actor Split

1. Nova: UI/frontend architecture and implementation.
2. Forge: backend/contract changes only when needed.
3. Pete: testing and validation owner.

Note: If backend contract changes are needed, update openapi.yaml in the same pass.

## 3) Testing Protocol (Execution Guardrails)

1. Nova does not run tests without explicit permission from Pete.
2. Permission is requested per test command.
3. During implementation, temporary red tests are acceptable.
4. Milestone rule: return to green at each milestone checkpoint.
5. Full e2e suite is expensive (20+ min), so use targeted subsets first.

Recommended subsets from package scripts:
1. npm run test:spec -- <focused-file>
2. npm run e2e:3d
3. npm run e2e:3d:headed
4. npm run e2e:spec -- <focused-spec>

## 4) Milestone Rhythm

1. One commit per milestone (branching managed by Pete).
2. Expected failures must be explicitly labeled as either:
   - expected transitional failure
   - unacceptable regression
3. If unacceptable regression appears, decide immediately:
   - stop and stabilize now, or
   - continue to next scoped implementation step with an explicit debt note

## 5) First Proof Gate (Minimum)

Required evidence for first architecture proof:
1. Visual proof: ship A and ship B are distinct isolated instances.
2. Deterministic proof: one unit assertion that context isolation holds during A -> B -> A.

Suggested deterministic assertion:
- state in A remains byte-identical after A -> B -> A while B mutates only B-owned state.

## 6) Brief Test Request Template

Use this short format when requesting Pete-run tests:

- Expected result: <short statement>
- Command: <exact command>
- Optional note: expected transitional failure or unacceptable regression criteria

Example:
- Expected result: ship A state remains unchanged after A -> B -> A.
- Command: npm run test:spec -- src/app/scene/ship-exterior/ship-scene-engine.vitest.ts

## 7) Replacement Design Checkpoint Exit Criteria

Checkpoint is complete when all are true:
1. Old path removal map is documented (what will be deleted in hard replace).
2. New per-instance ownership map is documented (what each ship instance owns).
3. First proof slice scope is fixed (visual + deterministic unit assertion).
4. Milestone-1 implementation file targets are listed and approved.
5. First test request to Pete is prepared (but not executed).

## 8) Milestone-1 Implementation Map (Hard Replace)

Milestone-1 objective: establish per-instance ownership model (scene/camera/renderer/canvas), wire route cutover to the new component entry, and preserve HUD host integration contract.

### 8.1 Existing Paths To Remove Or Bypass

Primary replacement target:
1. Replace route component target from `src/app/scene/ship-exterior-view.ts` to new bare-scene component while keeping route path `ship-exterior-view` stable.

Legacy monolith scheduled for deletion after Milestone-1 proof gate:
1. `src/app/scene/ship-exterior-view.ts` (default export `ShipExteriorViewScene`).
2. `src/app/scene/ship-exterior-view.html`.
3. `src/app/scene/ship-exterior-view.vitest.ts` (replace with focused new-surface tests as parity slices land).

Potential follow-on cleanup (not Milestone-1 blocking):
1. `src/app/scene/ship-exterior/ship-exterior-bootstrap-controller.ts` and related controllers that are only monolith support.
2. Any monolith-only helpers under `src/app/scene/ship-exterior/` once no longer referenced.

### 8.2 Files To Create

Core architecture files:
1. `src/app/scene/ship-exterior/ship-scene-context.ts`
2. `src/app/scene/ship-exterior/ship-scene-registry.ts`
3. `src/app/scene/ship-exterior/ship-scene-types.ts`
4. `src/app/scene/ship-exterior/orbit-camera-controls.ts`

New component surface:
1. `src/app/scene/ship-exterior/ship-exterior-bare-scene.component.ts`
2. `src/app/scene/ship-exterior/ship-exterior-bare-scene.component.html`
3. `src/app/scene/ship-exterior/ship-exterior-bare-scene.component.css`
4. `src/app/scene/ship-exterior/ship-exterior-bare-scene-test-api.ts`

Milestone-1 focused tests:
1. `src/app/scene/ship-exterior/ship-scene-context.vitest.ts`
2. `src/app/scene/ship-exterior/ship-scene-registry.vitest.ts`

### 8.3 Files To Update

Route cutover:
1. `src/app/routed.routes.ts`
   - update `ship-exterior-view` route `loadComponent` target to the new bare-scene component.

HUD integration continuity:
1. `src/app/services/ship-exterior-view-host.service.ts`
   - keep service contract; allow the new component to register as facade source.
2. `src/app/scene/ship-exterior/ship-exterior-view-facade.ts`
   - keep existing exported facade interfaces for app-level HUD compatibility in Milestone-1.
3. `src/app/app.component.ts`
   - keep existing host/facade wiring unless contract changes are intentionally approved.

### 8.4 Milestone-1 Symbol Targets

Legacy symbol to retire from route:
1. `ShipExteriorViewScene` in `src/app/scene/ship-exterior-view.ts`.

New symbols to land:
1. `ShipSceneContext`
2. `ShipSceneRegistry`
3. `ShipSceneRenderingState`
4. `ShipExteriorBareSceneComponent`

### 8.5 Milestone-1 Deterministic Unit Assertion Target

Test assertion (required):
1. A and B contexts initialized with distinct state.
2. Activate A, mutate A-owned state.
3. Activate B, mutate B-owned state.
4. Activate A again.
5. Assert A state is byte-identical to pre-switch A snapshot and B mutations never wrote into A.

Primary target file:
1. `src/app/scene/ship-exterior/ship-scene-registry.vitest.ts`

### 8.6 Milestone-1 Visual Validation Prompt (Pete-Run)

Prompt A (manual visual, shortest path):
1. Expected result: switching between two ships shows isolated visuals per ship instance and preserves A on return.
2. Command: `npm run e2e:3d:headed`

Prompt B (focused automated spec once created):
1. Expected result: A -> B -> A screenshot/overlay checks pass for per-instance isolation.
2. Command: `npm run e2e:spec -- e2e/tests/ship-exterior-visual-phase2.spec.ts`

## 9) Milestone-1 Exit Checklist

1. Route cutover to new component is complete.
2. Deterministic context-isolation unit assertion exists and passes when Pete runs it.
3. Visual validation prompt is prepared and executed by Pete.
4. Any expected red tests are explicitly labeled and tracked.
5. Milestone-1 commit is created.

Milestone-1 status (2026-07-10): complete.

## 10) Milestone-2 Kickoff Scope (Camera/Pause Hardening)

Milestone-2 objective:
1. Harden ship instance pause/resume semantics and camera continuity under repeated switching.
2. Ensure A -> B -> C -> A keeps each ship camera/runtime state isolated with no cross-write.
3. Keep the current bare-scene footprint stable while removing temporary dead code introduced during cutover.

In scope:
1. Per-context pause state instrumentation and deterministic state assertions.
2. Multi-switch continuity behavior for camera state.
3. Context lifecycle cleanup on logout/session reset.
4. Focused cleanup in the new bare-scene stack where symbols are now dead post-monolith deletion.

Out of scope:
1. Reintroducing flight controller behavior.
2. Asteroid gameplay parity expansion.
3. Mission/route-feed parity expansion.
4. Backend contract changes.

Primary files to update:
1. `src/app/scene/ship-exterior/ship-scene-context.ts`
2. `src/app/scene/ship-exterior/ship-scene-registry.ts`
3. `src/app/scene/ship-exterior/ship-exterior-bare-scene.component.ts`
4. `src/app/scene/ship-exterior/ship-scene-registry.vitest.ts`
5. `src/app/scene/ship-exterior/ship-scene-context.vitest.ts`

Milestone-2 acceptance criteria:
1. Repeated switching across >= 3 ships preserves ship-local camera/runtime state.
2. Inactive contexts are paused and do not advance animation/runtime state while hidden.
3. Session teardown disposes contexts deterministically.
4. No new references to deleted monolith files exist.
5. Build remains green.

Milestone-2 expected failure policy:
1. Focused tests can be temporarily red during implementation.
2. End-of-milestone target is green for focused unit + selected e2e validation.

Milestone-2 brief test prompts (Pete-run):
1. Expected result: registry/context unit coverage proves multi-switch isolation and pause semantics.
2. Command: `npm run test:spec -- src/app/scene/ship-exterior/ship-scene-registry.vitest.ts src/app/scene/ship-exterior/ship-scene-context.vitest.ts`

3. Expected result: ship-hangar resume flow preserves per-ship visual continuity across context switches.
4. Command: `npm run e2e:spec -- e2e/tests/ship-exterior-hangar-resume.spec.ts`

5. Expected result: manual visual confirms A -> B -> C -> A continuity with no cross-bleed.
6. Command: `npm run e2e:3d:headed`

Milestone-2 commit gate:
1. Commit after acceptance criteria are met and validation outcome is recorded.

## 11) Milestone-2 Validation Evidence (2026-07-10)

Validation outcome:
1. Focused unit tests: PASS (confirmed by Pete).
2. Focused e2e tests: PASS (confirmed by Pete).
3. Manual visual continuity checks: PASS (confirmed by Pete).

Manual validation confirmations captured:
1. A -> B -> C -> A continuity: PASS.
2. No cross-ship bleed: PASS.
3. Active-only animation behavior: PASS (validated with console context readout).
4. Context residency behavior: PASS.
5. Ship-hangar-driven switching path: PASS.
6. Session teardown sanity: PASS.
7. Buy Test Scavenger Pod lazy-init behavior: PASS (new ship context initializes on View Exterior, not at purchase time).

Runtime evidence summary:
1. Console switch logs show stable context identities per ship key.
2. Exactly one context is active (`paused: false`) while all other resident contexts remain paused (`paused: true`).
3. Rendered frame count advances only on the active context at switch time.
4. Context count remains stable across switching (no unintended context recreation).

Milestone-2 gate status:
1. Acceptance criteria satisfied.
2. Milestone-2 commit gate completed.

## 12) Milestone-3 Kickoff Documentation (Parity Lane Selection)

Milestone-3 objective:
1. Start parity recovery with one narrowly scoped lane while preserving all isolation guarantees validated in Milestone-2.

Candidate lanes:
1. Orbit controls lane.
2. Flight lane.
3. Cold Boot sequence lane.
4. Asteroid gameplay lane.
5. Mission/route-feed lane.

Selection criteria:
1. Lowest risk to scene-isolation invariants.
2. Minimal backend/contract dependency.
3. High user-visible value per implementation effort.
4. Strong focused-test coverage potential.

Ranking (recommended order):
1. Starfield visual parity slice (recommended first; Milestone-3A).
2. Orbit controls lane (Milestone-3B).
3. Flight lane (Milestone-3C).
4. Cold Boot sequence lane.
5. Asteroid gameplay lane.
6. Mission/route-feed lane.

Recommendation rationale:
1. Starfield visual parity adds clear per-ship visual differentiation with minimal behavioral risk and no flight/input complexity.
2. Orbit controls is the smallest interaction layer to reintroduce after starfield, giving high user-visible value while keeping risk localized to active-context camera input.
3. Flight lane follows orbit controls and benefits from prior camera/input hardening.
4. Cold Boot sequence lane is strongly user-visible and mostly flow/orchestration behavior, making it a good follow-on lane.
5. Asteroid lane introduces heavier render and interaction state, increasing the surface for accidental cross-write.
6. Mission/route-feed lane has the highest async and contract routing complexity, so it should follow after active-context mechanics are fully hardened.

### 12.1 Milestone-3A Scope (Starfield Visual Parity)

In scope:
1. Add deterministic per-ship starfield generation owned by each ship context.
2. Ensure each ship context keeps a stable, ship-local starfield signature across switching.
3. Preserve active/inactive pause invariants while starfield is rendered.
4. Add minimal validation hooks/logs needed to prove starfield continuity per context.

Out of scope:
1. Flight controls and movement.
2. Asteroid scan/material parity work.
3. Mission gate/state parity work.
4. Route-feed parity work.
5. Backend contract changes.

Primary files to update:
1. `src/app/scene/ship-exterior/ship-scene-context.ts`
2. `src/app/scene/ship-exterior/ship-exterior-bare-scene.component.ts`
3. `src/app/scene/ship-exterior/ship-scene-context.vitest.ts`
4. `src/app/scene/ship-exterior/ship-scene-registry.vitest.ts`
5. (If needed) `src/app/scene/ship-exterior/ship-scene-types.ts`

### 12.2 Milestone-3A Acceptance Criteria

1. Ship A and Ship B render visibly distinct starfields.
2. A -> B -> C -> A restores A's original starfield signature (no reseed from other ships).
3. Inactive contexts remain paused while active context starfield updates/rendering proceed.
4. Build remains green.

### 12.3 Milestone-3A Test Prompts (Pete-run)

1. Expected result: focused unit tests prove starfield seed/signature remains ship-local across switching.
2. Command: `npm run test:spec -- src/app/scene/ship-exterior/ship-scene-context.vitest.ts src/app/scene/ship-exterior/ship-scene-registry.vitest.ts`

3. Expected result: focused hangar resume flow preserves starfield continuity on ship switching.
4. Command: `npm run e2e:spec -- e2e/tests/ship-exterior-hangar-resume.spec.ts`

5. Expected result: manual visual confirms distinct starfield per ship and stable return pattern on A -> B -> C -> A.
6. Command: `npm run e2e:3d:headed`

### 12.4 Milestone-3A Failure Policy

1. Temporary focused-test failures are acceptable during implementation.
2. End-of-milestone requirement is green focused unit and focused e2e validation.

### 12.5 Milestone-3A Commit Gate

1. Commit after acceptance criteria are met and validation outcome is recorded in this document.

Milestone-3A validation evidence (complete):
1. Manual visual persistence across cross-ship viewing: PASS (Pete-confirmed).
2. Focused unit validation: PASS (2 files, 10 tests passing).
3. Focused e2e validation: PASS (`ship-exterior-hangar-resume.spec.ts`, 3 tests passing).
4. Build validation: PASS (`npm run build` successful; existing cold-boot CSS budget warning remains non-blocking and unchanged).
5. Gate status: Milestone-3A acceptance criteria satisfied and ready for commit gate.

### 12.6 Milestone-3B Scope (Orbit Controls Lane)

In scope:
1. Re-enable active-context orbit controls for camera orbit, pan, and zoom interactions.
2. Enforce that only the active context receives orbit-control input updates.
3. Preserve inactive-context pause guarantees while active context camera input is in use.
4. Add focused test API/readout hooks needed for deterministic validation of active-only camera mutation.
5. Render ship and starfield in a per-context local anchor frame (floating-origin style) for numeric stability.
6. Keep ship world position in context state as retained data for future scene hydration.
7. Apply orbit zoom bounds so visual anchor elements remain visible during interaction.

Out of scope:
1. Flight movement and propulsion behavior.
2. Asteroid scan/material parity work.
3. Mission gate/state parity work.
4. Route-feed parity work.
5. Backend contract changes.
6. Full world-space celestial-body/debris hydration.

Primary files to update:
1. `src/app/scene/ship-exterior/ship-exterior-bare-scene.component.ts`
2. `src/app/scene/ship-exterior/ship-scene-context.ts`
3. `src/app/scene/ship-exterior/ship-scene-registry.ts`
4. `src/app/scene/ship-exterior/ship-scene-context.vitest.ts`
5. `src/app/scene/ship-exterior/ship-scene-registry.vitest.ts`
6. (If needed) `src/app/scene/ship-exterior/ship-exterior-bare-scene-test-api.ts`

### 12.7 Milestone-3B Acceptance Criteria

1. Orbit controls are enabled on the active ship context and disabled on inactive contexts.
2. Active ship camera updates are deterministic and remain ship-local.
3. Inactive contexts remain paused and do not receive camera-state mutations.
4. A -> B -> A after active camera interaction on B returns A camera state unchanged.
5. Build remains green.
6. Starfield remains visible while dragging/orbiting and behaves as a stable 3D visual anchor.

### 12.8 Milestone-3B Test Prompts (Pete-run)

1. Expected result: focused unit tests prove active-only camera mutation and preserved inactive contexts.
2. Command: `npm run test:spec -- src/app/scene/ship-exterior/ship-scene-registry.vitest.ts src/app/scene/ship-exterior/ship-scene-context.vitest.ts`

3. Expected result: focused ship-exterior hangar resume flow remains stable with orbit controls enabled.
4. Command: `npm run e2e:spec -- e2e/tests/ship-exterior-hangar-resume.spec.ts`

5. Expected result: manual visual confirms camera interaction changes only on active ship and no bleed on switch back.
6. Command: `npm run e2e:3d:headed`

### 12.9 Milestone-3B Failure Policy

1. Temporary focused-test failures are acceptable during implementation.
2. End-of-milestone requirement is green focused unit and focused e2e validation.

### 12.10 Milestone-3B Commit Gate

1. Commit after acceptance criteria are met and validation outcome is recorded in this document.

Milestone-3B validation evidence (complete):
1. Manual visual no-bleed validation: PASS (Pete-confirmed).
2. Manual visual starfield persistence during orbit interaction: PASS (Pete-confirmed).
3. Manual visual active-only animation behavior: PASS (cube rotation pauses on inactive scene and resumes on re-activation).
4. Focused unit validation: PASS (2 files, 10 tests passing).
5. Focused e2e validation: PASS (`e2e/tests/ship-exterior-hangar-resume.spec.ts`, 3 tests passing).
6. Build validation: PASS (`npm run build` successful; existing cold-boot CSS budget warning remains non-blocking and unchanged).
7. Gate status: Milestone-3B acceptance criteria satisfied and ready for commit gate.

### 12.11 Milestone-3C Scope (Flight Lane)

In scope:
1. Reintroduce active-context flight toggle and movement updates.
2. Enforce that only active context receives movement writes and animation updates.
3. Preserve inactive-context pause guarantees during flight activity on another ship.
4. Add focused test API/readout hooks needed for deterministic validation.

Out of scope:
1. Asteroid scan/material parity work.
2. Mission gate/state parity work.
3. Route-feed parity work.
4. Backend contract changes.

Primary files to update:
1. `src/app/scene/ship-exterior/ship-exterior-bare-scene.component.ts`
2. `src/app/scene/ship-exterior/ship-scene-context.ts`
3. `src/app/scene/ship-exterior/ship-scene-registry.ts`
4. `src/app/scene/ship-exterior/ship-scene-context.vitest.ts`
5. `src/app/scene/ship-exterior/ship-scene-registry.vitest.ts`
6. (If needed) `src/app/scene/ship-exterior/ship-exterior-bare-scene-test-api.ts`

### 12.12 Milestone-3C Acceptance Criteria

1. Flight mode can be enabled and disabled on the active ship context.
2. Active ship flight updates its own runtime state deterministically.
3. Inactive contexts remain paused and do not receive flight-state mutations.
4. A -> B -> A after active flight on B returns A unchanged.
5. Build remains green.

### 12.13 Milestone-3C Test Prompts (Pete-run)

1. Expected result: focused unit tests prove active-only flight mutation and preserved inactive contexts.
2. Command: `npm run test:spec -- src/app/scene/ship-exterior/ship-scene-registry.vitest.ts src/app/scene/ship-exterior/ship-scene-context.vitest.ts`

3. Expected result: focused ship-exterior hangar resume flow remains stable with flight lane enabled.
4. Command: `npm run e2e:spec -- e2e/tests/ship-exterior-hangar-resume.spec.ts`

5. Expected result: manual visual confirms flight changes only on active ship and no bleed on switch back.
6. Command: `npm run e2e:3d:headed`

### 12.14 Milestone-3C Failure Policy

1. Temporary focused-test failures are acceptable during implementation.
2. End-of-milestone requirement is green focused unit validation, manual visual validation, and explicit classification of any focused e2e failure.
3. `ship-exterior-hangar-resume.spec.ts` may be owner-waived as a known readiness-migration non-blocker for the pre-test-investment commit only.

### 12.15 Milestone-3C Commit Gate

1. Commit after acceptance criteria are met and validation outcome is recorded in this document.

Milestone-3C signoff note (hangar resume e2e):
1. `npm run e2e:spec -- e2e/tests/ship-exterior-hangar-resume.spec.ts` is a required signoff input.
2. If this spec is failing, signoff must include explicit classification:
   - Expected known failure (readiness migration pending), or
   - Regression (new failure mode outside known readiness gap).
3. Milestone-3C cannot close as green until this spec is either:
   - Green, or
   - Explicitly waived with owner-approved expected-failure rationale and follow-up issue reference.
4. For expected-failure classification, signoff must record the planned closure step: migrate this spec to readiness-contract checkpoints from Phase-1 (`sw13.v1`) without test-only production mutations.

Milestone-3C validation evidence (complete for pre-test-investment commit):
1. Focused unit validation: PASS (Pete-confirmed).
2. Manual visual flight toggle validation: PASS (flight can enter and exit through UI button).
3. Manual visual Escape validation: PASS (Escape exits flight mode immediately).
4. Manual visual movement validation: PASS (WASD movement changes coordinates and active ship/cube position).
5. Manual visual active-only ownership validation: PASS (movement affects only active ship context).
6. Manual visual no-cross-ship-bleed validation: PASS (A -> B -> A preserves independent ship state).
7. Manual visual inactive-pause validation: PASS (inactive contexts remain paused while active ship flies).
8. Manual visual pointer-lock validation: PASS (lock/release behavior works without stuck lock).
9. Manual visual hangar round-trip validation: PASS (Exterior -> Hangar -> Exterior preserves expected context without unwanted reset/mutation).
10. Temporary Options dropdown removal: PASS.
11. Focused e2e validation: FAILING but owner-classified as known non-blocker for this commit (`ship-exterior-hangar-resume.spec.ts`, readiness-contract migration pending).
12. Follow-up closure path: invest in test-foundation plan after this commit, then migrate hangar-resume e2e to `sw13.v1` readiness checkpoints.
13. Gate status: Milestone-3C acceptance criteria satisfied for commit with documented e2e waiver.

## 13) Session Closure Handoff (2026-07-11)

1. Milestone-3A validation evidence is complete and gate-ready.
2. Milestone-3B validation evidence is complete and gate-ready.
3. Milestone-3C validation evidence is complete and ready for pre-test-investment commit.
4. Next work after commit should continue the test-foundation investment plan and migrate the known failing hangar-resume e2e to readiness-contract checkpoints.
