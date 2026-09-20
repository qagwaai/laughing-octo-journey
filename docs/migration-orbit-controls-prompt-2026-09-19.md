# New Session Prompt: Migrate OrbitControls to Pilot Ship Movement

Use the following prompt to start a new implementation session:

---

You are implementing the ship-exterior camera and movement migration described
in [`docs/migrate-orbit-controls-2026-09-19.md`](./migrate-orbit-controls-2026-09-19.md).

## Objective

Replace origin-target `OrbitControls` as the normal ship-exterior gameplay
camera mechanism with a pilot-in-ship movement model. The player should feel
like they are inside a ship looking through a window. Mouse rotation and
movement must represent ship steering/pilot look, not orbiting the camera
around an origin point.

## Required approach

0. read the following document to get preferences (../.copilot-preferences.json)
1. Read and follow the migration decision document before editing.
2. Inspect the current implementation in:
   - [`src/app/scene/ship-exterior/orbit-camera-controls.ts`](../src/app/scene/ship-exterior/orbit-camera-controls.ts)
   - [`src/app/scene/ship-exterior/ship-scene-context.ts`](../src/app/scene/ship-exterior/ship-scene-context.ts)
   - [`src/app/scene/ship-exterior/ship-exterior-flight-controller.ts`](../src/app/scene/ship-exterior/ship-exterior-flight-controller.ts)
   - [`src/app/scene/ship-exterior/ship-exterior-flight-controls.ts`](../src/app/scene/ship-exterior/ship-exterior-flight-controls.ts)
   - [`src/app/scene/ship-exterior/ship-exterior-bare-scene.component.ts`](../src/app/scene/ship-exterior/ship-exterior-bare-scene.component.ts)
   - [`src/app/scene/ship-exterior/ship-scene-types.ts`](../src/app/scene/ship-exterior/ship-scene-types.ts)
3. Establish and document the authoritative coordinate/transform contract
   before changing behavior.
4. Prefer an explicit ship/pilot rig. If fixed-camera inverse world transforms
   are required for large-world precision, make that layer explicit and test
   its direction conventions.
5. Disable `OrbitCameraControls` for normal gameplay. Retain it only as an
   explicit inspection/debug mode if there is a demonstrated need.
6. Preserve existing pause/resume, context switching, disposal, persisted
   location/orientation, scan targeting, mission, launch, debris, ship, route
   feed, and HUD behavior.
7. Do not add Jest. Use Vitest and the repository's existing Playwright setup.
8. Keep edits surgical and follow existing Angular standalone, signal, and
   service/controller patterns.

## Scope decisions

- Start with direct mouse steering for yaw/pitch through the existing flight
  path unless the codebase reveals a strong reason to separate steering and
  constrained head-look.
- Decide roll explicitly. It may remain disabled for the first safe migration,
  but do not leave an undocumented implicit reset.
- Keep optional constrained head-look and external inspection mode out of the
  initial implementation unless required to preserve an existing supported
  workflow.
- Do not perform unrelated refactors.

## Progress tracking

Update [`docs/migrate-orbit-controls-2026-09-19.md`](./migrate-orbit-controls-2026-09-19.md)
as implementation proceeds. Mark phases with `Not started`, `In progress`,
`Blocked`, `Ready for Pete`, or `Signed off`, and add commands, test names,
screenshots, or other evidence in the notes column.

## Validation requirements

Run focused validation first, then broaden as needed:

- Relevant Vitest unit/component/integration specs
- `npm run typecheck`
- `npm run build` for Angular template/type validation
- Relevant Playwright specs, using deterministic socket fixtures where needed
- Visual validation of pilot perspective, mouse rotation, forward/reverse,
  strafe, vertical movement, transitions, pause/resume, and context changes

Pete is the primary signoff person and will perform all unit, integration, and
visual validation testing. Do not mark final signoff complete on Pete's behalf.
Prepare a concise handoff listing:

- Files changed
- Transform and input contract
- Tests run and results
- Known limitations
- Visual scenarios Pete must validate
- Any migration or compatibility concerns

## Completion requirements

Do not consider the task complete until normal gameplay no longer orbits an
origin target, the transform contract is tested, relevant tests/build pass, the
migration document is updated, and the work is ready for Pete's final signoff.

---

