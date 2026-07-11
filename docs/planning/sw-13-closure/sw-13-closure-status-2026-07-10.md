# SW-13 Closure Status Readout (2026-07-10)

Status owner: Nova (frontend)
Program: SW-13 closure (Option A hard replace)
Overall state: Milestone-3C validation complete for pre-test-investment commit; known hangar-resume e2e non-blocker documented

## Executive Snapshot

1. Milestone-1 is complete and monolith removal is complete.
2. Milestone-2 (camera/pause hardening) implementation is complete.
3. Focused unit + focused e2e + manual visual validation are all confirmed PASS.
4. Build is green (`npm run build` succeeded).
5. Milestone-2 acceptance criteria are satisfied and commit gate is completed.

## Confirmed Decisions In Force

1. Option A hard replace (no legacy runtime fallback path).
2. One Ship Exterior component type with multiple runtime instances.
3. Per-ship isolation for scene/camera/renderer/canvas ownership.
4. Inactive ship contexts remain paused; initialized contexts are kept resident until logout.
5. Test execution ownership remains with Pete (per-command permission model).

## Delivered In Milestone-1

1. Route cutover to the new bare scene component for `ship-exterior-view`.
2. New scene architecture base landed:
   - `ShipSceneContext`
   - `ShipSceneRegistry`
   - `ShipSceneRenderingState` and related scene types
   - bare scene component and test API surface
3. App host behavior adjusted so ship-exterior no longer depends on the shared global Angular Three canvas.
4. Deterministic isolation unit coverage added for A -> B -> A context behavior.
5. Legacy monolith artifacts removed from source tree:
   - old ship-exterior component implementation
   - old ship-exterior template
   - old monolith vitest file
   - old monolith-specific test-utils source

## Delivered In Milestone-2

1. Registry/context hardening landed for active/inactive pause invariants.
2. Deterministic context lifecycle behavior added (`deactivateAll`, active-context promotion on removal, deterministic disposal flow).
3. Session-reset teardown handling added in bare-scene component.
4. Console validation readout improved with per-context paused state and rendered frame counts.
5. Focused unit coverage expanded for pause invariants and context lifecycle behavior.

## Validation Readout

1. Build: PASS (latest run successful).
2. Focused unit tests: PASS (Pete-confirmed).
3. Focused e2e tests: PASS (Pete-confirmed).
4. Manual visual continuity and behavior checks: PASS (Pete-confirmed).
5. Runtime observation: multiple `ship-scene-canvas` elements present for initialized ships is expected behavior and consistent with keep-alive context design.
6. Runtime console evidence: exactly one active context (`paused: false`) while resident inactive contexts remain paused (`paused: true`) and rendered frame counts advance only on active context.
7. Milestone-3A starfield persistence validation: PASS (starfield remains ship-local and persistent across cross-ship exterior viewing).
8. Milestone-3B orbit-controls validation: PASS (no bleed, starfield persistence during orbit, active-only cube rotation pause/resume, focused unit/e2e/build green).

## Known Gaps / Transitional Debt

1. Legacy-compat test hooks are currently preserved through the new bare-scene test API surface to avoid abrupt test harness breakage.
2. Camera-state-driven visual differentiation is still limited in the bare scene, so console/telemetry readout remains the primary no-cross-bleed proof aid.
3. A standing CSS budget warning exists in `src/app/page/opening/cold-boot-scan.css` (non-blocking for SW-13 closure architecture).

## Milestone-2 Gate Readiness

1. A -> B -> C -> A continuity: PASS.
2. No cross-ship bleed: PASS.
3. Active-only animation behavior: PASS.
4. Context residency behavior: PASS.
5. Ship-hangar-driven switching path: PASS.
6. Session teardown sanity: PASS.
7. Buy Test Scavenger Pod lazy-init behavior: PASS (new ship context initializes on View Exterior, not at purchase).
8. Milestone-2 gate status: COMMIT COMPLETED.

## Next Slice Outlook (Post Milestone-2)

Next planning target: Milestone-3B orbit controls lane, followed by Milestone-3C flight lane.

In scope:
1. Execute Milestone-3B (active-context orbit controls with strict no-cross-context camera mutation).
2. Preserve proven isolation invariants while reintroducing interaction behavior.
3. Keep focused test cadence and manual visual confirmation at milestone gate.

Out of scope:
1. Broad multi-lane parity work in one milestone.
2. Full-suite e2e runs unless specifically needed.
3. Backend contract changes unless explicitly approved.

## Gate Snapshot

1. Milestone-3A: validation complete and ready for commit gate.
2. Milestone-3B: validation complete and ready for commit gate.
3. Milestone-3C: focused unit + manual visual validation complete; ready for commit with known e2e waiver.
4. Non-blocking warning persists: `src/app/page/opening/cold-boot-scan.css` budget warning (unchanged).

## New Chat Bootstrap

1. Commit the Milestone-3C flight-lane change set before starting broader test-foundation investment.
2. Treat `ship-exterior-hangar-resume.spec.ts` as a known non-blocking e2e failure for this commit only.
3. After commit, resume the test-foundation plan and migrate hangar-resume e2e to `sw13.v1` readiness checkpoints.

## Milestone-3C Closure Progress (2026-07-11)

1. Flight toggle and active-context proof hooks are wired into the bare-scene stack.
2. Per-ship flight state owns movement/runtime mutation state locally.
3. Focused unit tests are green (Pete-confirmed).
4. Manual visual validation is green for flight toggle, Escape exit, WASD movement, active-only mutation, no cross-ship bleed, inactive pause, pointer-lock behavior, hangar round trip, and Options removal.
5. Milestone-3C is ready for commit before the broader test-foundation investment.

## Milestone-3C Signoff Tracker

1. Required signoff e2e: `npm run e2e:spec -- e2e/tests/ship-exterior-hangar-resume.spec.ts`.
2. Current state: FAILING.
3. Classification: known non-blocker for the pre-test-investment Milestone-3C commit, owner-accepted.
4. Rationale: the failure belongs to the readiness-migration gap already captured by the SW-13 test-foundation investment plan, not the active-only flight behavior validated manually.
5. Closure path: after this commit, migrate this spec to readiness-contract checkpoints (`sw13.v1`) and re-run focused e2e gate.

## Canonical Planning Reference

Use this as the source-of-truth checkpoint document:
- `docs/planning/sw-13-closure/replacement-design-checkpoint.md`

## Strategic Test Investment Reference

Use this document for the long-term maintainable test solution plan:
- `docs/planning/sw-13-closure/sw-13-test-foundation-investment-plan-2026-07-11.md`

## Test-Foundation Phase-1 Artifact

Readiness contract + hangar state-machine spec:
- `docs/planning/sw-13-closure/sw-13-phase1-readiness-contract-spec-2026-07-11.md`
