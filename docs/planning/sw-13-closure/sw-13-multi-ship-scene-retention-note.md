# SW-13 Multi-Ship Scene Retention Note

Status: Draft
Date: 2026-06-29
Owner: Nova
Reviewer: Pete
Policy: No legacy support

## 1. Purpose

Define the corrected G2 target behavior for multi-ship ship-external scenes and record the gap between the delivered slice and required semantics.

## 2. Corrected Target Semantics (Reviewer-Aligned)

Required behavior:

1. Each ship has its own ship-external-view scene instance in memory for the active login session.
2. Switching active ships is a scene activation switch, not a state restore/reseed operation.
3. Scene hydration occurs only for uninitialized ship scenes (lazy init) and not for already initialized scenes.
4. No legacy fallback/remap behavior is introduced.

## 2A. Architecture Clarification (Reviewer Confirmed 2026-06-29)

1. Initialization strategy: Lazy init per ship on first View Exterior selection.
2. Scene identity key: playerName + characterId + shipId.
3. Scene lifecycle: Once initialized, a ship scene remains resident until logout.
4. Inactive scenes: Fully paused when not active.
5. First-time hydration: Seed first, backend reconcile after seed.
6. Strict ship-local state: camera orientation, flight position, scan progress/results, target selection, mission gate/UI state.
7. Shared/system-scoped state: asteroid world catalog remains shared/system-scoped.
8. Async response routing: responses for ship A apply only to ship A scene context, never to active ship B context.
9. Runtime ship roster changes: scene contexts are created/removed as ship roster changes.
10. Re-entry rule: selecting View Exterior for an already initialized ship performs scene switch only (no hydration/reseed).

## 3. What Was Implemented (And Why It Failed Validation)

Delivered slice behavior (2026-06-29):

1. Snapshot capture of ship scene-related state on swap.
2. Restore of cached state when returning to a ship.
3. Fallback to seeded path when no cache entry exists.

This failed reviewer intent because it is restore/reconstruction semantics, not keep-alive runtime scene semantics.

## 4. Evidence of Misalignment

Implementation/test evidence associated with the failed interpretation:

1. `src/app/scene/ship-exterior-view.vitest.ts`
2. Test: "should retain ship-specific asteroid and targeting state across ship swap round-trip"
3. Test: "should retain ship-specific mission gate state across ship swap round-trip"
4. Test: "should retain ship-specific targeted debris id across ship swap round-trip"
5. Test: "should evict oldest retained ship state when retention capacity is exceeded"

These tests prove state retention correctness, but do not prove keep-alive scene-instance switching.

## 5. Required Validation Criteria (Updated)

G2 is considered satisfied only when all criteria below are true:

1. Switching A -> B shows B scene context immediately as the active scene.
2. Switching B -> A returns to A scene context without reconstruction/reseed.
3. Active-only display is enforced (no cross-ship visible bleed).
4. No restoration dependency is required for expected continuity behavior.
5. Lifecycle and memory bounds are documented and reviewer-accepted.

## 6. Runtime Scope Expectations

Per-ship runtime scene context must preserve at least:

1. Asteroid scene state.
2. Mission gate progression context.
3. Targeting context (asteroid and debris).
4. Camera/view context for the active ship.

## 7. Lifecycle and Memory Policy

1. Retention must be explicit and bounded.
2. Eviction policy, if used, must not violate active switch continuity requirements.
3. Cleanup behavior must be deterministic and documented.

## 8. Current G2 Status

G2 is Blocked and not closure-ready:

1. Prior slices delivered snapshot/restore behavior, not true per-ship concurrent scene instances.
2. Reviewer validation confirmed cross-context bleed remains under manual timing scenarios.
3. Current runtime does not yet satisfy scene activation-switch semantics.
4. Next slice must implement true per-ship scene instances with inactive-scene pause and strict async routing.

## 9. Next Slice Directive

Implement true per-ship scene instances with activation-switch semantics:

1. Build scene manager keyed by playerName + characterId + shipId.
2. Apply lazy scene initialization on first View Exterior for each ship.
3. Keep initialized scenes resident until logout.
4. Pause inactive scenes fully and route async payloads to owning scene only.
5. Remove restore-first assumptions from switch continuity behavior.

Progress addendum (2026-06-29, Milestone 4 Step 2):

1. Intermediate runtime updates and test additions landed, but do not yet satisfy the confirmed architecture contract.
2. Reviewer manual validation found cross-context behavior regressions (including rotation and scan-tier bleed).
3. Prior green unit/e2e signals are not sufficient for G2 sign-off under updated architecture requirements.

## 10. Reviewer Handoff

Decision: Milestone 3 failed for semantic mismatch (expected keep-alive scene behavior).

Milestone 4 current disposition:

1. Unit validation: Informative only; not closure-significant for true scene-instance semantics.
2. E2E/manual validation: Failing architecture criteria due to cross-context bleed.
3. G2 gate status: Blocked pending true per-ship scene-instance implementation.

Implementation addendum (2026-06-29, ownership-gate validation slice):

1. Async response paths now use default-deny ownership gating keyed by playerName + characterId + shipId.
2. Non-owning async callbacks are ignored and recorded through ownership-drop telemetry.
3. Launch responses now require explicit `shipId` ownership (missing `shipId` is dropped and counted).
4. Pending celestial upsert ownership is tracked per sample id to prevent cross-context writeback.
5. Test utility debug hooks expose ownership drop count/reason for deterministic unit assertions.

Validation owner: Pete
Execution owners: Nova (+ Forge as needed for contract/runtime integration alignment)

## 11. Execution Communication Protocol (Patch vs Replacement)

This section records the explicit language needed to avoid accidental incremental patching when G2 requires an architectural replacement.

Required opening declaration before any implementation work:

1. "This is an architecture replacement, not a bug-fix patch."
2. "No restore/reseed compatibility behavior for initialized ship scenes."
3. "Switching is activation-only; fallback/restore paths are out of scope."

Mandatory pre-coding checkpoint:

1. List the old pattern/components that will be removed.
2. List the new per-ship runtime ownership model that replaces them.
3. Confirm no compatibility shim is being introduced.

Stop-and-replan conditions:

1. Proposed changes add guards/fallbacks to existing restore-first flow instead of replacing it.
2. The plan preserves snapshot/replay as the continuity mechanism for initialized scenes.
3. The implementation cannot name concrete old paths scheduled for removal.

Execution keywords that mean replacement mode:

1. "rewrite"
2. "rip and replace"
3. "replace architecture"
4. "delete old path"
5. "no legacy path"

## 12. Validation Checklist (Ownership-Gate Slice)

Use this checklist to verify the implemented ownership-gate behavior:

1. Non-owning piracy response is ignored and increments ownership drop telemetry.
2. Missing-ship-id piracy response is ignored and increments ownership drop telemetry.
3. Route-feed and ship-list async callbacks only mutate state when request context matches active ship-scene key.
4. Celestial upsert async writeback is ignored when pending sample owner key does not match active ship scene.
5. Ownership telemetry can be reset/read via test utils hooks before/after assertions.

Suggested focused test command:

```bash
npm run test:spec -- src/app/scene/ship-exterior-view.vitest.ts
```
