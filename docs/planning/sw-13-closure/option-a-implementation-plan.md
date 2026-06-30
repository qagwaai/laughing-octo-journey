# SW-13 Option A Implementation Plan: Greenfield Ship-Exterior (Hard Replace)

Status: Ready for stakeholder confirmation
Date: 2026-06-30
Decision source: docs/planning/sw-13-closure/architectual-options.md (Option A)
Policy: No legacy support. Hard replace, delete old immediately.

## Stakeholders

1. Nova (frontend, me): builds the greenfield component, engine, unit/e2e tests, debug overlay,
   and runs automated visual capture/diff.
2. Forge (backend): confirms existing socket/OpenAPI contracts are sufficient as-is; no backend
   change expected. Forge signs off that contracts are stable for the rebuild.
3. Pete (you): owns visual sign-off at numbered GATE flags using the per-gate checklist.

## Confirmed Decisions (from intake form)

1. Cutover: Hard replace now, delete old `ship-exterior-view.ts` immediately once the new
   component reaches the gate that authorizes deletion (GATE 2). No feature flag, no parallel route.
2. Visual tooling: Playwright screenshot capture + saved artifacts; Playwright visual snapshot
   diffing (`toHaveScreenshot` baselines); a dev debug overlay (camera/position/pause readout) for
   deterministic asserts.
3. Forge: confirm existing contracts sufficient; no backend change expected.
4. Pete gates: explicit numbered GATE flags with checklist + pass/fail per gate.
5. Parity order: camera/pause hardening -> flight -> asteroids -> missions -> route feed.

## One Reversibility Safeguard (required before any deletion)

Hard replace removes the working fallback. To keep simplicity without losing the only safety net,
the single safeguard is a git checkpoint, not a parallel code path:

1. Before GATE 2 deletion, tag the current state: `git tag sw-13-pre-greenfield`.
2. Deletion happens in its own commit so it can be reverted atomically if a later gate fails.

This adds zero runtime/architecture complexity and preserves "delete old immediately" intent.

## Visual Inspection Flag (read this first)

Throughout this document, a line beginning with:

> VISUAL FLAG (Pete): ...

is your cue to start a manual visual inspection. Until you see a VISUAL FLAG, no manual visual
inspection is expected — automated capture/diff and unit tests carry verification. Each VISUAL FLAG
is paired with a numbered GATE checklist below it.

## Tooling Nova Will Wire In To Help With Visual Inspection

1. Dev debug overlay (`ShipExteriorDebugOverlay`): renders active ship id, camera position/target,
   ship world position, and pause state for every resident context. Hidden in production
   (`environment.production`), shown when a `?debugScene=1` query param or dev env is set. This makes
   visual state machine-readable so Playwright can assert exact values, not just pixels.
2. Playwright screenshot capture: a spec captures named PNG artifacts at each scene state
   (`A-initial`, `B-active`, `A-return`) into `test-results/` for you to eyeball quickly.
3. Playwright visual snapshot diffing: `expect(page).toHaveScreenshot('shipA-return.png')` baselines,
   so A->B->A regressions fail CI automatically once baselines are approved by you.
4. A focused e2e helper that drives ship switching deterministically via mocked sockets
   (`SocketIOMock`), so captures are stable and not timing-dependent.

How this helps me (Nova) assist your visual checks:

1. The overlay turns "does it look right" into "does camera/position equal the captured value",
   which I can assert in code and you can confirm at a glance.
2. The saved artifacts give you a 3-image strip per run instead of manual app driving.
3. Once you approve baselines, the diff tool flags future visual drift without you re-checking
   manually every time.

## Phase Plan With Gates

Each phase lists: goal, Nova work, Forge action, validation, and (where relevant) a VISUAL FLAG +
numbered GATE checklist for Pete with explicit pass/fail.

### Phase 0: Contract Lock (Forge + Nova)

1. Goal: Confirm the rebuild needs no contract change.
2. Nova: enumerate the socket events / OpenAPI fields the bare scene consumes (ship identity,
   ship position/transform, active-ship selection). Produce a short contract-usage list.
3. Forge action (sign-off required): review the usage list and confirm existing
   socket/OpenAPI contracts are sufficient as-is. If a field is missing, STOP and escalate;
   do not invent a fallback.
4. Validation: Forge written confirmation "contracts sufficient, no change". OpenAPI
   `info.version` unchanged (no contract edit expected).
5. No VISUAL FLAG (no UI yet).

GATE 0 (Forge): PASS = Forge confirms contracts sufficient. FAIL = any missing field -> escalate,
plan paused.

### Phase 1: Headless Engine + Exit Test (Nova)

1. Goal: Build the per-ship scene engine with the hard invariant provable without a browser.
2. Nova: implement `ShipSceneRegistry` + `ShipSceneContext` with:
   - `getOrCreateContext(key)` lazy init (key = playerName + characterId + shipId).
   - `activate(key)` pauses previous, resumes target, no hydration for initialized keys.
   - `routeAsyncResponse(key, payload)` mutates only the addressed context.
   - `pause(key)` / `isPaused(key)`.
   - `dispose()` only valid path that clears contexts (logout/teardown).
3. Nova: write the exit test (Vitest): construct contexts A and B, set distinct camera/position,
   switch A->B->A, assert A is byte-identical and B never mutated A, and zero create/destroy during
   switching.
4. Forge action: none.
5. Validation: exit test green; engine has no Angular/render dependency.
6. No VISUAL FLAG (headless only).

GATE 1 (Nova internal): PASS = exit test green. This gate authorizes building the visual component.

### Phase 2: Bare Scene Component + Hard Replace (Nova)

1. Goal: Render the bare scene (ship + starfield + per-ship camera state + pause/resume) wired to
   the engine, replace the old component, delete it.
2. Nova: new standalone component renders one active context (ship + starfield), per-ship camera
   state from the context, pause/resume on switch. Add the debug overlay. Wire to the existing
   route/host seam that the old component used (contracts/route preserved).
3. Nova: `git tag sw-13-pre-greenfield`, then delete `ship-exterior-view.ts` and its now-dead
   helpers in a dedicated commit. Update imports/route to the new component.
4. Nova: add Playwright capture spec producing `A-initial`, `B-active`, `A-return` artifacts and
   the `toHaveScreenshot` baseline scaffolding (baselines NOT yet approved).
5. Forge action: none.
6. Validation: build clean (`npm run build`), unit tests green, capture spec produces 3 artifacts,
   no scene create/destroy on switch (asserted via overlay values in e2e).

> VISUAL FLAG (Pete): Start manual visual inspection of the bare scene now.

GATE 2 (Pete) — bare-scene visual sign-off (this gate authorizes deleting the old component to be
permanent / approving baselines):

1. [ ] Ship A renders (single ship + starfield) with no console errors. PASS/FAIL
2. [ ] Switching to ship B shows B's own scene; A's loops are paused (overlay shows A paused). PASS/FAIL
3. [ ] Switching back to A shows the exact prior camera/position (overlay A values match the
   `A-initial` capture). PASS/FAIL
4. [ ] No flicker/reconstruction on switch (single scene instance id persists in overlay). PASS/FAIL
5. [ ] You approve the three screenshots as the visual baseline. PASS/FAIL

GATE 2 result: ALL PASS -> approve `toHaveScreenshot` baselines, deletion is permanent, proceed.
Any FAIL -> Nova fixes before parity work; `git revert` of the deletion commit is available if needed.

### Phase 3: Parity Slice 1 — Camera/Pause Hardening (Nova)

1. Goal: Lock camera + pause semantics across many switches and a logout.
2. Nova: add tests for N-ship rotation (A->B->C->A...), logout disposes all contexts, re-login
   re-inits lazily. Extend overlay assertions.
3. Validation: unit + e2e green; visual diff against GATE 2 baselines passes automatically.
4. VISUAL FLAG only if diff fails.

GATE 3 (Pete): PASS = visual diff clean across multi-switch + logout cycle (you confirm only if the
automated diff flags a change). FAIL = any drift -> Nova fixes.

### Phase 4: Parity Slice 2 — Flight (Nova)

1. Goal: Re-add flight controller bound to the active context only.
2. Nova: flight writes only to active context; inactive contexts receive no flight updates;
   tests assert paused context position is immutable during another ship's flight.
3. Validation: unit + e2e green; new flight capture artifacts.

> VISUAL FLAG (Pete): Inspect flight on active ship + confirm inactive ship unchanged after return.

GATE 4 (Pete): 1) [ ] Active ship flies correctly. 2) [ ] Return to other ship shows untouched
position. 3) [ ] New baselines approved. ALL PASS -> proceed.

### Phase 5: Parity Slice 3 — Asteroids (Nova)

1. Goal: Re-add asteroid world (shared/system-scoped catalog) rendered per active context.
2. Nova: asteroid catalog shared; per-ship view state isolated; tests assert catalog shared but
   per-ship targeting state isolated.
3. Validation: unit + e2e green; asteroid capture artifacts.

> VISUAL FLAG (Pete): Inspect asteroid layout stability across A->B->A.

GATE 5 (Pete): 1) [ ] Asteroids render. 2) [ ] A->B->A asteroid layout identical (the original
defect). 3) [ ] Baselines approved. ALL PASS -> proceed.

### Phase 6: Parity Slice 4 — Missions (Nova)

1. Goal: Re-add mission state per active context with strict async routing.
2. Nova: mission async responses routed only to owning context; tests assert non-active mission
   updates never touch active render.
3. Validation: unit + e2e green.

> VISUAL FLAG (Pete): Inspect mission UI on active ship.

GATE 6 (Pete): 1) [ ] Mission UI correct on active ship. 2) [ ] Switch-away/back preserves mission
state. 3) [ ] Baselines approved. ALL PASS -> proceed.

### Phase 7: Parity Slice 5 — Route Feed (Nova)

1. Goal: Re-add route/navigation feed per active context.
2. Nova: route feed bound to active context; tests assert inactive contexts ignore feed.
3. Validation: full `npm run test:ci` + full Playwright suite green.

> VISUAL FLAG (Pete): Final full-feature inspection across A->B->A with all systems live.

GATE 7 (Pete) — parity sign-off: 1) [ ] All systems render. 2) [ ] A->B->A continuity holds for
camera, position, asteroids, missions, route. 3) [ ] Final baselines approved. ALL PASS -> SW-13 G2
complete.

## Validation Matrix (per gate)

| Gate | Owner | Automated check | Manual visual? |
| --- | --- | --- | --- |
| 0 | Forge | Contract usage list reviewed | No |
| 1 | Nova | Headless exit test green | No |
| 2 | Pete | Build + capture artifacts + overlay asserts | Yes (first visual) |
| 3 | Pete | Visual diff multi-switch + logout | Only if diff fails |
| 4 | Pete | Flight unit/e2e + capture | Yes |
| 5 | Pete | Asteroid unit/e2e + capture | Yes |
| 6 | Pete | Mission unit/e2e | Yes |
| 7 | Pete | Full test:ci + full Playwright | Yes (final) |

## Test Execution Note

Per project policy, Nova will provide exact commands; Pete runs tests. Suggested commands:

1. Headless engine test: `npm run test:spec -- src/app/scene/ship-exterior/<engine>.vitest.ts`
2. Visual capture spec: `npx playwright test e2e/tests/ship-exterior-visual.spec.ts --reporter=line`
3. Baseline update (after your approval only):
   `npx playwright test e2e/tests/ship-exterior-visual.spec.ts --update-snapshots`
4. Full regression: `npm run test:ci` then full Playwright per AGENTS.md e2e protocol.

## Summary Of When Pete Looks

1. First visual inspection: GATE 2 (bare scene). Before that, nothing to look at.
2. Then at GATE 4, 5, 6, 7 as each feature slice lands.
3. GATE 3 only if the automated visual diff flags drift.
