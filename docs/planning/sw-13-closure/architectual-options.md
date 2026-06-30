# Ship-External-View Architectural Options (G2)

Status: Draft for decision
Date: 2026-06-30
Owner: Nova
Reviewer: Pete
Policy: No legacy support

## 1. Problem Statement

`src/app/scene/ship-exterior-view.ts` must support a per-ship scene that:

1. Is created lazily per ship (key: `playerName + characterId + shipId`).
2. Stays resident until logout.
3. Is fully paused when its ship is not the active ship.
4. Switches A -> B -> A by activation only, with no reconstruction, reseed, or restore choreography.
5. Is stable, testable, and maintainable.

Current reality: repeated in-place attempts did not produce correct A -> B -> A visual
continuity. Scene lifecycle/instrumentation is correct (no recreation), but coordinate/
visual state still resets on switch-back. The root difficulty is that the existing component
is a very large, multi-responsibility class (~4400 lines) where ship-local state, async
hydration, flight, missions, route feeds, debris, and rendering are interleaved. That makes
the single required invariant — "active-only state with strict per-ship ownership" — hard to
guarantee, because many code paths can write shared signals.

## 2. Decision Criteria (Weighted)

Primary driver (confirmed): Testability first.

| Criterion | Weight | Why |
| --- | --- | --- |
| Testability (deterministic per-ship + pause) | 5 | Confirmed top priority; we must be able to prove the invariant in unit/e2e. |
| Delivery risk (chance of another failed attempt) | 4 | We have already lost significant time to a failed approach. |
| Maintainability (separation, low future-change risk) | 4 | Future SW-13 work must not be blocked by this component again. |
| Time-to-working-visual | 3 | Important, but not at the expense of correctness. |
| Scope preservation (reuse current behavior) | 2 | Useful, but contracts are the only hard asset to preserve. |

Confirmed constraints:

1. Preserve contracts only (socket events / OpenAPI). Everything else is replaceable.
2. Recommendation required.
3. Greenfield MVP scene = bare scene: ship + starfield + per-ship camera state + pause/resume.
   No asteroids/missions/route-feed in the first proof.

## 3. Hard Invariant To Prove (All Options)

The architecture must make this provable in a unit test without a browser:

1. Two ship contexts (A, B) can be initialized.
2. Switching to B pauses A's loops and shows only B state.
3. Switching back to A shows A's exact prior state (camera/position) with no write from any
   async/hydration path in between.
4. No scene instance is destroyed/recreated during in-session switching.

If an option cannot express this as a small deterministic test, it scores low on the top
criterion by definition.

## 4. Options

### Option A: Full Rip-and-Replace (Greenfield Component)

Build a brand-new `ship-exterior` component/subtree from scratch, contracts-only reuse,
starting from the bare MVP scene and growing feature parity in slices behind tests.

How it works:

1. New component owns a `ShipSceneRegistry` keyed by `playerName + characterId + shipId`.
2. Each entry is a self-contained `ShipSceneContext` object (state + controllers + pause flag).
3. The component renders exactly one active context; all others are paused and untouched.
4. Async/socket responses are delivered to a context by key; a non-active key can update its
   own context data but never the active render state.
5. Feature parity (asteroids, missions, route feed, debris, flight) is re-added slice by slice,
   each slice gated by tests.

Benefits:

1. Testability: Highest. The registry + context model is unit-testable in isolation, and the
   hard invariant (Section 3) is a first-class test from day one.
2. Maintainability: Highest. Single-responsibility boundaries by construction; no inherited
   interleaving.
3. Delivery risk per slice: Low and bounded; each slice is independently verifiable.

Costs / risks:

1. Largest total scope; full parity takes the longest elapsed time.
2. Temporary feature gap between MVP and parity (must run old component in parallel or behind a
   flag until parity is reached).
3. Requires disciplined slice sequencing to avoid re-importing the old interleaving.

Best when: correctness and long-term maintainability dominate, and a staged parity climb is
acceptable.

### Option B: Continue In-Place Modification (Where We Ended Up)

Keep the existing component and continue hardening write paths (ownership guards, hydration
skips, capture-from-live-location, etc.).

How it works:

1. Keep the current class.
2. Continue closing each clobbering write path as it is discovered.

Benefits:

1. No feature regression; parity already exists.
2. Lowest upfront effort to attempt the next fix.

Costs / risks:

1. Testability: Low. The invariant cannot be cheaply isolated because many code paths mutate
   shared signals; tests pass while manual visual still fails.
2. Delivery risk: High. This is the approach that already failed repeatedly; root cause is
   structural (interleaving), not a single missed branch.
3. Maintainability: Low. Each fix increases conditional complexity in an already large class.

Best when: the defect were known to be a single isolated writer. Evidence says it is not.

### Option C: Greenfield Scene Behind a Façade (Strangler / Hybrid) — middle path

Build a new self-contained scene-context engine (as in Option A), but introduce it behind the
existing component's public surface (route, selector, navigation state, test-utils API) so it
can be swapped in without a big-bang cutover.

How it works:

1. Extract a new `ShipSceneRegistry` + `ShipSceneContext` engine with the bare MVP scene.
2. The existing component becomes a thin façade that delegates lifecycle/activation to the new
   engine while still satisfying current contracts and routing.
3. Migrate features into the engine slice by slice; each migrated slice deletes the old path it
   replaces (no compatibility shim retained).
4. When parity is reached, the façade is reduced to a trivial host.

Benefits:

1. Testability: High. The engine is unit-testable in isolation exactly like Option A; the hard
   invariant is provable early.
2. Delivery risk: Low-to-moderate. Cutover is incremental and reversible per slice; contracts and
   routing stay stable throughout.
3. Maintainability: High at the end state; improves continuously as slices migrate.
4. Time-to-working-visual: Better than A, because the façade keeps the app wired while the engine
   grows.

Costs / risks:

1. Requires a clean façade boundary up front; if the boundary leaks, it can regress toward
   Option B's interleaving.
2. Temporary dual-path period (old paths + new engine) must be policed so migrated slices delete
   their old code rather than wrap it.

Best when: you want Option A's correctness/testability but need the app to stay continuously
working and want reversible, slice-sized cutover.

## 5. Scored Comparison

Scores are 1 (poor) to 5 (excellent), then weighted by Section 2.

| Criterion (weight) | A: Rip-and-Replace | B: In-Place | C: Façade/Strangler |
| --- | --- | --- | --- |
| Testability (5) | 5 | 2 | 5 |
| Delivery risk (4) | 4 | 1 | 4 |
| Maintainability (4) | 5 | 2 | 5 |
| Time-to-working-visual (3) | 2 | 3 | 4 |
| Scope preservation (2) | 2 | 5 | 3 |
| Weighted total | 71 | 41 | 79 |

Weighted totals (authoritative):

1. Option A: (5x5)+(4x4)+(5x4)+(2x3)+(2x2) = 25+16+20+6+4 = 71.
2. Option B: (2x5)+(1x4)+(2x4)+(3x3)+(5x2) = 10+4+8+9+10 = 41.
3. Option C: (5x5)+(4x4)+(5x4)+(4x3)+(3x2) = 25+16+20+12+6 = 79.

Ranking: C (79) > A (71) > B (41).

## 6. Recommendation

Recommended: Option C — Greenfield scene engine behind a façade (strangler migration).

Rationale:

1. It delivers Option A's correctness and testability (a small, isolated per-ship engine where
   the hard invariant is a first-class unit test) while keeping the application continuously
   working and contracts stable.
2. It directly attacks the real root cause (interleaved write paths in a monolithic class) by
   relocating ship-local state into a single-owner context engine, instead of adding more guards
   to the existing flow (Option B), which has already failed.
3. Cutover is reversible and slice-sized, which is the strongest available control against
   another large failed attempt.

If reviewer prefers maximum simplicity over continuity, Option A is the acceptable fallback; it
reaches the same end state but with a temporary parallel-running period and a larger single
cutover. Option B is not recommended: the evidence is that the defect is structural, and further
in-place patching is the lowest-testability, highest-risk path.

## 7. Recommended MVP (Proof Slice) — applies to A and C

Bare scene only (confirmed scope):

1. Render one ship + starfield for the active context.
2. Per-ship camera/position state held in the context, not in shared component signals.
3. Pause/resume: inactive context runs no loops and receives no render writes.
4. Switch A -> B -> A proves identical A camera/position with zero intervening writes.

Exit test (must exist before any feature migration):

1. Unit test constructs contexts A and B, sets distinct camera/position, switches A->B->A, and
   asserts A is byte-identical and B never mutated A.
2. No scene instance create/destroy occurs during switching.

## 8. Engine Shape (for A and C)

Minimal contracts the engine must expose to be testable headlessly:

1. `getOrCreateContext(key): ShipSceneContext` — lazy init only.
2. `activate(key)` — pauses previous, resumes target, performs no hydration for initialized keys.
3. `routeAsyncResponse(key, payload)` — mutates only the addressed context.
4. `pause(key)` / `isPaused(key)` — deterministic, observable.
5. `dispose()` — only valid path that clears contexts (logout/session teardown).

Each method is directly unit-testable without Angular rendering, which is what makes the top
criterion (testability) achievable.

## 9. Decision Required

1. Confirm Option C (recommended), or select Option A as the simpler-cutover alternative.
2. On confirmation, next deliverable is the headless engine + the Section 7 exit test, before any
   feature parity migration begins.
