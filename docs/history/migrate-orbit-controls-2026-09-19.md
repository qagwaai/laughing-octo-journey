# Ship-Exterior Camera and Movement Migration

**Date:** 2026-09-19  
**Status:** Signed off  
**Primary signoff:** Pete  
**Scope:** Ship-exterior scene camera rotation, movement, and pilot-control model

## Decision summary

The ship-exterior scene should migrate away from `OrbitControls` as the
primary gameplay camera mechanism. `OrbitControls` is an inspection camera:
it rotates the camera around a target/origin point. That does not match the
game model in which the player is a pilot looking through a ship window.

The recommended gameplay model is:

1. Keep the pilot camera at a fixed local position inside the ship.
2. Make ship orientation and movement authoritative.
3. Use mouse input for pilot look/steering rather than orbiting a scene target.
4. Use keyboard or equivalent input for six-degree-of-freedom translation and
   optional roll.
5. Represent the ship and pilot camera with an explicit transform hierarchy.
6. Retain `OrbitCameraControls` only as an explicit inspection/debug mode, if
   that capability remains useful.

The existing `ShipExteriorFlightController` is the starting point for this
migration. The migration must resolve whether the authoritative implementation
uses a moving ship rig or a fixed camera with inverse world transforms. The
preferred gameplay abstraction is a ship/pilot rig; a fixed-camera,
ship-relative-world implementation remains acceptable if it is made explicit
and preserves large-world precision.

## Current implementation

The current normal camera mechanism is `OrbitCameraControls`, a wrapper around
Three.js `OrbitControls`:

- [`orbit-camera-controls.ts`](./../src/app/scene/ship-exterior/orbit-camera-controls.ts)
- Created in [`ShipSceneContext`](./../src/app/scene/ship-exterior/ship-scene-context.ts)
- Configured with rotation, zoom, and pan enabled
- Updated from `renderFrame()`

The current flight path is separate:

- [`ship-exterior-flight-controller.ts`](./../src/app/scene/ship-exterior/ship-exterior-flight-controller.ts)
- [`ship-exterior-flight-controls.ts`](./../src/app/scene/ship-exterior/ship-exterior-flight-controls.ts)
- Input routing lives in [`ship-exterior-bare-scene.component.ts`](./../src/app/scene/ship-exterior/ship-exterior-bare-scene.component.ts)

The flight implementation already supports forward/backward, lateral,
vertical, boost, mouse yaw/pitch, pointer lock, persisted orientation, and
runtime position state. Roll is currently forced to zero because the existing
OrbitControls transition cannot preserve roll.

## Recommended target architecture

Use explicit transform responsibilities:

```text
scene
└── shipRig                 authoritative ship position/orientation
    ├── shipModel           exterior/cockpit geometry
    └── pilotLookRig        optional head/look offset and limits
        └── pilotCamera     fixed local pilot/window camera
```

The exact node names may follow existing project conventions. The important
boundaries are:

- **Ship rig:** yaw, pitch, roll, translation, and persistence.
- **Pilot look rig:** optional constrained head-look independent of ship
  steering.
- **Camera:** projection and local pilot/window placement, not orbit behavior.
- **World-relative rendering:** may use inverse ship transforms when needed for
  floating-origin precision, but this must remain an implementation detail of
  the ship/world transform layer.

Mouse behavior must be decided and tested explicitly:

- Either mouse movement directly steers ship yaw/pitch.
- Or mouse movement controls constrained pilot look, with a separate steering
  input and recenter/flight-assist behavior.

The initial implementation should favor direct steering while flight controls
are active, with constrained head-look treated as a follow-up if the cockpit
experience requires it.

## Options considered

| Option | Recommendation | Rationale |
| --- | --- | --- |
| Always-on existing flight mode | Good transition step | Reuses current pointer-lock and movement code, but does not by itself establish a clean ship/camera transform model. |
| Explicit ship/pilot rig | **Preferred target** | Matches the pilot-in-ship mental model and makes cockpit geometry, ship orientation, and camera placement coherent. |
| Fixed camera with inverse world transforms | Acceptable implementation variant | Supports large-world precision and existing relative-world behavior, but needs clear naming and transform contracts. |
| Hybrid constrained free-look | Optional follow-up | Improves immersion, but should not be mixed into the first migration unless steering and look responsibilities are clearly separated. |
| Temporary external inspection mode | Optional supporting feature | Preserves scene inspection/debugging without making orbit behavior the gameplay paradigm. |
| Full six-degree-of-freedom inertial flight | Target capability | Appropriate for spaceflight, but acceleration, damping, auto-leveling, roll, and motion-comfort behavior require deliberate tuning. |

## Migration principles

- Do not silently retain an origin-target orbit path in gameplay.
- Keep ship position/orientation as the authoritative state.
- Preserve persisted view orientation and location contracts.
- Keep camera and world coordinate conventions documented and tested.
- Avoid introducing roll until transitions, persistence, and visual validation
  demonstrate that roll is stable.
- Preserve scan targeting, mission progression, socket behavior, and route-feed
  rendering while changing camera/movement behavior.
- Prefer incremental seams over a broad rewrite of `ShipSceneContext`.
- Use Vitest, Angular build/type validation, and Playwright visual checks; Jest
  is not used in this repository.

## Authoritative coordinate and transform contract

The initial migration uses an explicit **fixed pilot camera with inverse
world transforms** to retain the existing floating-origin precision model:

```text
scene
├── worldRelativeGroup       inverse of the authoritative ship transform
│   ├── starfield, ships, stations, gates, debris, asteroids
└── pilotRig                 fixed at the ship origin
    └── pilotLookRig         reserved for a future constrained head-look layer
        └── pilotCamera      local position (0, 0, 0), looking down local -Z
```

- The authoritative state is `flight.currentLocationKm` plus
  `flight.orientation` (`YXZ` Euler order).
- Ship-local forward is **-Z**, right is **+X**, and up is **+Y**. W/S,
  A/D, and Space/Ctrl (or C) move along those local axes; the controller
  rotates that input by the ship orientation before updating the authoritative
  world position.
- Mouse X decreases yaw and mouse Y decreases pitch unless invert-Y is
  enabled. Mouse steering directly changes ship heading; it never targets or
  orbits a world origin.
- `worldRelativeGroup` applies the inverse ship rotation and the inverse ship
  position in that rotated frame: `R^-1 * (world - shipPosition)`. This keeps
  the camera local and prevents large coordinates reaching render transforms.
- Roll is explicitly **disabled** in this first migration. Q/E do not affect
  orientation and persisted `rollRad` is normalized to zero by movement.
- Scan hover/targeting continues while the pointer is unlocked. Pointer lock
  switches mouse input to pilot steering.
- Focus loss (`blur` or a hidden document) releases this scene's pointer lock,
  cancels pending capture intent, and clears held movement/boost keys. Focus
  return never requests capture. Only a left-click on the active, unpaused
  canvas requests it; toolbar/HUD clicks and right-click targeting do not.

## Progress tracking

Update the status column and evidence links as work proceeds. Use:

- `Not started`
- `In progress`
- `Blocked`
- `Ready for Pete`
- `Signed off`

| Phase | Deliverable | Status | Owner | Evidence / notes |
| --- | --- | --- | --- | --- |
| 0 | Baseline current OrbitControls and flight behavior | Signed off | Pete | Baseline implementation inspected; subsequent visual comparison accepted by Pete. No pre-change screenshot/video captured. |
| 1 | Define ship/world/camera transform contract | Signed off | Implementation session | Contract documented above; direction-specific Vitest coverage added. |
| 2 | Introduce pilot/ship rig seam | Signed off | Implementation session | `worldRelativeGroup`, `pilotRig`, and `pilotLookRig` established in `ShipSceneContext`. |
| 3 | Route gameplay input away from OrbitControls | Signed off | Implementation session | `OrbitCameraControls` removed; pilot controls are always active in normal gameplay. |
| 4 | Implement authoritative ship rotation and movement | Signed off | Pete | Movement, heading-relative directions, and boost accepted; new steering/movement e2e regressions green at 20:09 (-06:00). Steering comfort enhancement deferred. |
| 5 | Handle pause, resume, context switching, and disposal | Signed off | Pete | At 20:02 (-06:00), Pete reported all unit/e2e tests green and visual validation complete after the focus-loss patch. |
| 6 | Decide optional constrained head-look | Signed off | Pete | Deferred from initial scope; completed visual validation did not require a separate head-look layer. |
| 7 | Add or retain explicit inspection/debug mode | Signed off | Implementation session | Not retained: Pete confirmed no inspection/orbit workflow is required. |
| 8 | Unit and integration validation | Signed off | Pete | All unit tests reported green at 20:02 (-06:00), including the focus-loss follow-up. Typecheck/build confirmation tracked separately below. |
| 9 | Visual and Playwright validation | Signed off | Pete | Visual validation complete at 20:02; new steering, movement, and Escape e2e tests fully green at 20:09 (-06:00). |
| 10 | Final signoff | Signed off | Pete | 2026-09-19 20:09 (-06:00): "we are fully green with new e2e tests - ready to signoff". Ship-dependent steering remains a separate follow-up. |

### Pete validation report (2026-09-19)

Latest report at 20:02 (-06:00): "all unit and e2e tests are green -
visual validation is complete - ready for next". This supersedes the earlier
focus-loss retest pending status. Build/typecheck results have not been
separately reported. Pete then confirmed that build/typecheck still need
running. At 20:04 (-06:00), Pete confirmed build and typecheck are done.
At 20:09 (-06:00), Pete reported "we are fully green with new e2e tests -
ready to signoff". Final signoff is recorded from that user confirmation,
including the new Escape release fix and e2e hardening batch.

- All unit and e2e tests reported green before the focus-loss follow-up.
- Pilot perspective without orbiting: green.
- Pointer-locked yaw/pitch without a target pivot: green.
- Forward/reverse, strafe, vertical movement, diagonal normalization, and
  heading-relative movement: green. Boost subsequently confirmed working
  as desired; no boost changes made.
- Unlocked asteroid/debris/ship hover scanning and targeting: green.
- Pause/resume, navigation/re-entry, context switching, and persisted
  location/orientation: green except browser focus loss/return.
- Mission, launch, debris, ship, route-feed, HUD, and scans: green.
- Mouse sweeps feel too fast/instantaneous; see deferred steering work below.

Focus-loss implementation adds coverage in
`ship-exterior-flight-controller.vitest.ts`,
`ship-exterior-input-adapter.vitest.ts`, and
`ship-exterior-flight-mode.spec.ts` (real pointer lock with synthetic blur/focus
events and Playwright Clock for deterministic held-key checks). These new tests
have not been executed by the implementation session, per Pete's preferences.
Pete subsequently reported unit/e2e tests green and visual validation complete.
Validation commands for reference (build/typecheck completion subsequently
confirmed by Pete at 20:04):

```powershell
npm run test:spec -- ship-exterior-flight-controller.vitest.ts ship-exterior-input-adapter.vitest.ts ship-scene-context.vitest.ts
npm run typecheck
npm run build
npx playwright test "ship-exterior-flight-mode.spec.ts" "ship-exterior-flight-position-persistence.spec.ts" --project=chromium --reporter=line
```

Completed visual-validation checklist: hold movement plus Shift while locked, alt-tab or hide the tab,
return, and verify no capture or drift until new input. Toolbar clicks must not
capture; a deliberate left-click on the canvas must capture. Check right-click
targeting and context changes again. Synthetic browser events do not replace
these OS/browser focus checks.

### E2E hardening follow-up (requested at 20:06)

Added the following regressions to `ship-exterior-flight-mode.spec.ts`:

1. Acquire actual canvas pointer lock; dispatch controlled yaw/pitch mouse
   deltas through the input event handler. Assert inverse-world heading changes,
   camera remains at local origin, ship location stays fixed, and frames render.
   Unlock and verify further mouse deltas do not steer.
2. Steer to nonzero yaw and pitch, then test W/S, D/A, Space/ControlLeft
   separately. Compare normalized authoritative displacement with independently
   calculated ship-local axes. Assert fixed camera position, preserved heading,
   and no continued movement after key release.
3. Replace the old Escape check with actual capture before Escape, then require
   `document.pointerLockElement === null`, preserved heading/location/camera,
   active pilot controls, and no recapture after mouse input or elapsed time.

The tests reuse deterministic socket fixtures and existing runtime snapshots.
Real pointer lock is combined with synthetic window-level mouse deltas to avoid
OS mouse acceleration and duplicate event bubbling. Playwright Clock is paused
after readiness and advanced without processing every animation frame; movement
checks measure direction rather than assuming a timer catch-up distance.
These assertions cover the input/state contract, not pixel-level render parity.

The initial hardening batch was test/documentation only. Pete's 20:08 Chromium
run exposed an Escape release gap: with actual canvas capture, pressing Escape
left `pointerLockElement` non-null. The application now explicitly calls the
existing pilot-input release path on Escape, clearing pending capture and held
movement/boost without disabling pilot mode or changing orientation. It does
not prevent the browser's default Escape behavior. The regression also verifies
that keys held at Escape cannot cause drift afterward.

Pete subsequently confirmed the new e2e tests fully green at 20:09 (-06:00),
including this Escape release fix. Rerun command retained for reference:

```powershell
npx playwright test "ship-exterior-flight-mode.spec.ts" --project=chromium --reporter=line
```

### Deferred steering response / ship handling

Pete reports that sweeping the mouse feels almost too fast, with no sense of
ship inertia. Current steering directly maps mouse deltas to yaw/pitch and is
not a physical angular-motion model. Track a separate follow-up for bounded
angular velocity, acceleration/deceleration or damping, and ship-dependent
handling (for example, larger/heavier ships responding more slowly). Keep
mouse sensitivity distinct from ship maneuverability and tune for comfort.
No new physics, head-look, roll, or sensitivity change is included here.

### Implementation checklist

Validation follow-up: Pete's next Chromium run passed the exact coordinate
comparison after the first re-entry in both persistence cases, then failed
the whole-kilometer comparison on `0` versus `-0`. The test-only
`toTelemetryCoords` helper now canonicalizes signed zero after rounding on
all three axes. Production coordinates, comparison precision, and exact
re-entry assertions are unchanged. Pete subsequently reported all unit and
e2e tests green, followed by green tests and completed visual validation after
the focus-loss changes.

- [ ] Capture the baseline behavior before changing controls.
- [x] Define and document the authoritative ship/world transform contract.
- [x] Choose moving ship rig or explicit inverse world transform implementation.
- [x] Remove normal gameplay dependence on `OrbitCameraControls`.
- [x] Preserve pause/resume and scene-context lifecycle behavior.
- [x] Preserve persisted location and orientation behavior.
- [x] Decide and implement roll policy.
- [x] Add regression tests for mouse rotation and movement direction.
- [x] Add regression tests for flight-mode transitions and pointer lock.
- [ ] Add regression tests for context switching and disposal.
- [x] Validate scan targeting and hover behavior after camera changes.
- [x] Validate mission, launch, debris, ship, asteroid, and route-feed behavior.
- [x] Capture visual validation evidence (Pete's written report above; no screenshot/video attached).
- [x] Update this document with implementation status and evidence.

## Validation plan

### Unit tests

Validate at minimum:

- Mouse movement maps to the intended yaw and pitch directions.
- Pitch remains within configured limits.
- Invert-Y and sensitivity settings remain correct.
- Translation directions match the ship/camera coordinate contract.
- Boost, key release, and simultaneous-axis inputs behave correctly.
- Roll policy is deterministic and persisted correctly if enabled.
- Location/orientation serialization and restoration remain stable.

### Integration/component tests

Validate:

- Input events reach the active scene context only.
- Pointer lock is requested/released at the correct lifecycle points.
- Pause and resume stop/restart active flight behavior correctly.
- Context switching does not leave stale controls or timers active.
- Disposal releases render controls and flight resources.
- Existing mission and scan state remains independent of camera movement.

### Visual and Playwright validation

Pete is responsible for final visual validation. At minimum, validate:

- The camera behaves as if located inside the ship rather than orbiting an
  origin target.
- Mouse rotation changes ship heading or pilot look according to the chosen
  contract.
- Forward, reverse, strafe, and vertical movement travel in the expected
  directions.
- Cockpit/window geometry remains aligned with the view.
- Flight-mode entry/exit does not snap to an orbit target or lose orientation.
- Pause, resume, navigation, and context changes do not change the view
  unexpectedly.
- Existing scan targets, asteroid visuals, debris, ships, stations, gates, and
  HUD/debug state remain usable.
- The experience is visually comfortable and does not introduce unacceptable
  motion sickness or disorientation.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Camera/world transform inversion causes reversed movement | Establish a written coordinate contract and add direction-specific tests. |
| Existing persisted orientation becomes incompatible | Add an explicit migration/defaulting path and test old state restoration. |
| Roll causes abrupt visual transitions | Keep roll disabled initially or add damping and explicit transition tests. |
| Large-world precision regresses | Preserve a ship-relative/floating-origin layer where needed. |
| OrbitControls remains active accidentally | Add a gameplay-mode assertion and lifecycle tests. |
| Scan raycasting changes with camera placement | Revalidate pointer normalization and target-selection integration. |
| Visual change breaks existing gameplay flows | Run focused mission/scan/launch and Playwright regression suites before signoff. |

## Pete signoff

Pete is the primary signoff person and owns all final unit, integration, and
visual validation testing.

| Signoff area | Status | Pete notes / evidence |
| --- | --- | --- |
| Unit tests pass | Signed off | Pete reports all unit tests green after the focus-loss patch, 20:02 (-06:00). |
| Integration/component tests pass | Signed off | Covered by Pete's all-unit/e2e-green report after the focus-loss patch. |
| Angular build and template type validation pass | Signed off | Pete confirmed build and typecheck done at 20:04 (-06:00), following green tests and completed visual validation. |
| Relevant Playwright tests pass | Signed off | Pete reports fully green with the new steering, movement, and Escape regressions, 20:09 (-06:00). |
| Visual pilot-perspective validation complete | Signed off | Pete reports visual validation complete, 20:02 (-06:00). |
| Movement/rotation direction and comfort accepted | Signed off | Visual validation complete per Pete; ship-dependent steering response retained as a deferred enhancement. |
| No unacceptable regressions in scan/mission/HUD flows | Signed off | Scenarios green; subsequent visual validation complete per Pete. |
| Migration documentation updated | Signed off | Validation history, final green report, and deferred work recorded. |
| **Final Pete signoff** | **Signed off** | **Pete, 2026-09-19 20:09 (-06:00): "we are fully green with new e2e tests - ready to signoff".** |

## Completion criteria

The migration is complete only when:

1. Normal gameplay no longer uses an origin-target orbit camera.
2. The chosen ship/world transform contract is documented and covered by tests.
3. Unit and integration validation passes.
4. Angular build/template validation passes.
5. Pete completes visual and Playwright validation.
6. Existing ship-exterior gameplay flows remain functional.
7. This document's progress and evidence fields are updated.
8. Pete records final signoff.
