# SW-13 Visual Testing Readiness Plan (G2)

Status: In Progress
Date: 2026-06-29
Owner: Nova
Reviewer: Pete
Policy: No legacy support

## Progress Update (2026-06-29)

1. Step 1 implemented in runtime:
- In-session context clear is blocked.
- Context clear is allowed only during logout/session teardown.
- Force-initialize against existing context is treated as contract violation and activation-only behavior is enforced.

2. Step 2 implemented with debug-scoped instrumentation:
- Stable scene instance id added.
- Lifecycle and context transition traces added (ring-buffered in memory).
- Trace/debug payload exposed through ship exterior test utils for manual verification.

## 1. Hard Requirement (Non-Negotiable)

1. Ship-external scene recreation must not happen during ship switching.
2. Recreation is allowed only on logout (or explicit session teardown).
3. Any behavior that depends on scene reconstruction for A -> B -> A continuity is a failure.

## 2. Goal

Reach a state where manual visual testing is meaningful and deterministic for:

1. View Ship A external scene.
2. Switch to Ship B external scene.
3. Switch back to Ship A external scene.
4. Confirm Ship A scene continuity without reseed/reconstruction drift.

## 3. Exit Criteria To Start Visual Testing

All criteria must be true before visual/manual sign-off work begins.

1. Runtime lifecycle guarantee:
- No `ShipExteriorViewScene` destruction/recreation during in-session ship switching.
- Destroy/recreate occurs only on logout teardown.

2. State continuity guarantee:
- A -> B -> A restores A ship-local runtime state from resident context, not reseed path.
- Ship-local state includes asteroid set, target lock, mission gate progress, route feed state, and flight/camera state.

3. Isolation guarantee:
- Inactive scene contexts are explicitly paused.
- Async responses mutate only owning ship context.

4. Evidence guarantee:
- Unit tests cover lifecycle, continuity, and isolation with stable assertions.
- Manual visual worksheet run has deterministic steps and pass/fail evidence.

## 4. Step-by-Step Plan

### Step 1: Lock Lifecycle Contract in Runtime

1. Add explicit runtime guard that rejects in-session reconstruction paths.
2. Ensure switch flow uses context activation only for initialized scenes.
3. Enforce that any teardown/clear of per-ship contexts is bound to logout/session teardown only.

Acceptance checks:

1. No context clear on ship switch.
2. No bootstrap reseed call for already-initialized ship context.
3. Context registry remains populated across A -> B -> A.

### Step 2: Add Instrumentation for Proof (Temporary, Debug-Scoped)

1. Add stable instance identifier for `ShipExteriorViewScene`.
2. Record lifecycle events:
- init, activate(ship), pause(ship), resume(ship), deactivate, destroy.
3. Record context events:
- context-created, context-activated, context-restored, context-pruned.

Acceptance checks:

1. In A -> B -> A run, init/destroy count remains 1/0 until logout.
2. Logs show activation/restoration events, not reconstruction events.

### Step 3: Enforce Activation-Only for Initialized Contexts

1. Ensure initialized contexts skip seed/bootstrap path.
2. Ensure context apply path restores all ship-local runtime facets.
3. Ensure persistence-backed fallback applies only for truly uninitialized contexts.

Acceptance checks:

1. A -> B -> A produces no reseed visual drift for A.
2. Targeted asteroid and mission gate state for A are restored.

### Step 4: Complete Pause/Resume Isolation Semantics

1. On ship switch, pause inactive context controllers (scan loop, flight ticking, debris polling, tractor loop).
2. On activation, resume only active context controllers.
3. Keep ownership-gated async routing in place as defense-in-depth.

Acceptance checks:

1. Inactive context receives zero visible state mutations from active-scene interactions.
2. Pause/resume counters match switch events.

### Step 5: Stabilize Route/Debris/Focus Continuity

1. Ensure route feed and debris scopes are context-keyed per ship.
2. Ensure target/focus state is context-local and restored on re-activation.
3. Validate no cross-ship descriptor or marker bleed.

Acceptance checks:

1. A route markers unchanged after A -> B -> A.
2. A debris/focus state unchanged after A -> B -> A.

### Step 6: Unit Test Hardening Before Visual Run

1. Add/adjust tests for:
- no recreation in switch flow,
- activation-only for initialized contexts,
- pause/resume correctness,
- route/debris/target continuity,
- strict context ownership routing.
2. Remove or defer assertions that assume reconstruction paths.

Acceptance checks:

1. Focused suite for `ship-exterior-view.vitest.ts` is green.
2. Tests explicitly assert logout-only destruction semantics.

### Step 7: Visual Test Readiness Gate

1. Run deterministic manual flow script (A -> B -> A, repeated 3 cycles).
2. Capture before/switch/back screenshots for each cycle.
3. Compare stable anchors:
- asteroid arrangement,
- target lock marker,
- route feed markers,
- camera orientation/coords,
- mission objective/progress line.

Acceptance checks:

1. All 3 cycles preserve A continuity within expected runtime tolerance.
2. No reseed-like resets or cross-ship bleed observed.

### Step 8: Closure Record Update

1. Update SW-13 closure docs with pass/fail outcomes and evidence links.
2. Mark G2 status based on objective gate results only.

Acceptance checks:

1. Evidence package contains logs + screenshots + test run references.
2. Reviewer disposition recorded with explicit go/no-go for visual validation start.

## 5. Fail-Fast Conditions (Block Visual Testing)

1. Any in-session scene destroy/recreate during ship switch.
2. Any reseed/bootstrap for an already-initialized context.
3. Any cross-ship mutation visible after switch.
4. Any missing evidence for lifecycle and context activation path.

## 6. Minimal Manual Visual Script (When Gate Opens)

1. Enter external view on Ship A.
2. Capture baseline screenshot and key telemetry lines.
3. Set visible anchor state on A (target asteroid, camera angle, optional flight offset).
4. Switch to Ship B external view and capture screenshot.
5. Switch back to Ship A and capture screenshot.
6. Compare A-before vs A-after anchors.

Pass condition:

1. A-before and A-after match on declared anchors (no reconstruction drift).

## 7. Ownership

1. Nova: Runtime lifecycle and context activation implementation.
2. Forge: Contract/async path integrity and ownership-route enforcement support.
3. Pete: Reviewer gate decision for visual testing start.
