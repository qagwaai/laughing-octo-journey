# SW-13 Replacement Design Checkpoint

Status: Active
Date: 2026-07-09
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
3. npm run e2e:3d:ui
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
2. Command: `npm run e2e:3d:ui`

Prompt B (focused automated spec once created):
1. Expected result: A -> B -> A screenshot/overlay checks pass for per-instance isolation.
2. Command: `npm run e2e:spec -- e2e/tests/ship-exterior-visual-phase2.spec.ts`

## 9) Milestone-1 Exit Checklist

1. Route cutover to new component is complete.
2. Deterministic context-isolation unit assertion exists and passes when Pete runs it.
3. Visual validation prompt is prepared and executed by Pete.
4. Any expected red tests are explicitly labeled and tracked.
5. Milestone-1 commit is created.
