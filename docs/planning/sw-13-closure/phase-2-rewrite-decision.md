# Phase 2 Rewrite Decision — Architecture Reset (2026-06-30)

## Summary
All Phase 2 implementation changes have been reverted. A complete architectural redesign is required before proceeding.

## What Went Wrong

**Root Cause:** Fundamental misunderstanding of the multi-ship context architecture.

**Original Intent (Correct):**
- Each `ShipSceneContext` should own its **own isolated THREE.js scene** with independent:
  - `THREE.Scene`, `THREE.Camera`, `THREE.WebGLRenderer`
  - Mesh/geometry/materials (not shared across ships)
  - Camera state, visual properties, pause state
- On ship switch: swap entire rendering pipeline, not just recolor a global scene

**What Was Built (Wrong):**
- Single global `THREE.Scene`, `camera`, `renderer`, `cube`
- On ship switch: only changed cube color via effect
- All ships rendered the same scene with different colors
- Defeats the entire purpose of `ShipSceneRegistry`

**GATE 3 Failure Result:**
- User clicked "View Exterior" on Ship 1 → rendered scene
- User clicked "Set as Active Ship" on Ship 2, then "View Exterior" → **same scene rendered**
- Expected: Two visually distinct scenes, one per ship
- Got: Single recolored scene

## Why This Happened

1. **Missed architectural memory:** Failed to read `/memories/repo/ship-exterior-view-architecture.md` before implementation
   - Would have immediately shown: "Position cube at world coordinates from ShipSceneContextState.world.shipPosition" → implies per-ship scenes

2. **Jumped to implementation:** No design-first validation of architecture
   - Should have asked: "How do we test that two ships have different scenes?"
   - That question would have exposed the single-scene design immediately

3. **Assumed data-only contexts:** Built `ShipSceneContext` as pure state holder, not rendering encapsulation

## Fresh Start Path

**Next steps:**
1. Design phase (design document: `phase-2-fresh-start-implementation-prompt.md`)
2. Complete architectural rewrite of:
   - `ShipSceneContext` (owns THREE.js objects)
   - `ShipSceneRegistry` (manages rendering contexts)
   - Component rendering logic (context-aware, multi-scene)
3. Preserve reusable pieces:
   - `OrbitCameraControls.ts`
   - Template/CSS files
   - E2E test structure
   - Socket integration

## Lessons Learned

- **Read memory files first** before implementation on projects with prior context
- **Design-first validation:** If architecture can't answer "how do we test this?", it's wrong
- **Context isolation matters:** Three.js object ownership must be clear per context
- **Architecture review blocker:** Should have caught this mismatch before code

## Status

- Phase 2 code: ❌ Reverted
- GATE 3 approval: ❌ Failed (architectural)
- New implementation: ⏳ Ready to start (design prompt provided)
