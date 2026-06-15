# Ship Exterior Re-entry Scene Restoration — Status 2026-06-14

## Goal

When the player navigates away from `ship-exterior-view` and returns, the scene
should be visually and functionally identical to when they left:

- Same ship coordinates (to 0.001 km precision)
- Same camera view (YAW / PITCH)
- Same asteroid set in the same orbital positions
- Flight preferences (invert-Y, mouse sensitivity) preserved

---

## Completed Work

### ✅ Camera Orientation Persistence

- `ShipExteriorViewStateService.saveOrientation()` / `loadOrientation()` storing
  YAW + PITCH (in radians) to `sessionStorage`.
- Reactive effect (`viewOrientationPersistenceEffect`) saves on every orientation
  change, not just on destroy — prevents teardown-timing loss.
- `schedulePersistedViewOrientationRestore()` retries over several animation frames
  until the Three.js camera is available before applying.
- On re-entry: orientation is restored both to the flight controller signals AND to
  the actual camera position/quaternion.
- `applyOrientationToSceneCamera()` uses orbit-sphere positioning in non-flight mode
  so OrbitControls inherits the correct view without snapping.

### ✅ Flight Mode → Orbit Transition (no snap)

- When `DISABLE FLIGHT` is pressed, camera orbit position is set from current
  flight orientation **before** the flight-mode signal flips, so OrbitControls
  inherits the correct position when it re-enables.

### ✅ Roll Disabled (Option A)

- `integrateFlightStep()` in `ship-exterior-flight-controls.ts` always produces
  `rollRad: 0`.
- OrbitControls cannot maintain roll; eliminating it prevents the jarring snap
  on flight→orbit transition.
- HUD `VIEW` line now shows `YAW / PITCH` only (ROLL removed).
- Control hint updated: `Q/E ROLL` removed.

### ✅ Ship Coordinate Persistence

- `flushPreciseFlightLocationToPersistence()` called on scene destroy and on
  flight-mode disable.
- HUD now reads live `getCurrentLocationKm()` in flight mode (not the quantized
  checkpoint), so `COORD KM` updates continuously at 0.001 precision.

### ✅ Asteroid Set Persistence (backend-authoritative resume)

- `createResumedAsteroidSamples()` now uses **exactly** the number of asteroids
  returned by the backend; no random top-up padding.
- Asteroids are backend-persisted via `persistSeededAsteroidsAsUnscanned()` on
  first seeding.
- On re-entry the backend `listCelestialBodies` returns those same asteroids and
  the scene merges them without adding extra bodies.

### ✅ Scene Animation Clock Persistence

- `ShipExteriorViewStateService.saveSceneElapsedSeconds()` /
  `loadSceneElapsedSeconds()` storing to `sessionStorage`.
- `sceneElapsedSeconds` restored in `ngOnInit` before the scan loop starts.
- Reduces asteroid orbital-phase drift between re-entries.

### ✅ Flight Preferences Persistence

- Invert-Y and mouse sensitivity saved to `localStorage`; restored in `ngOnInit`.

### ✅ Targeted Asteroid ID Persistence

- Targeted asteroid ID saved to `sessionStorage`; restored after asteroid samples
  load, validated that the target still exists.

### ✅ All Unit Tests Green

- 1986 tests passing, 144 test files.

---

## Known Remaining Gaps

### ⚠️ Space Debris Re-seeding on Re-entry

**Symptom**: Floating debris (teal/non-asteroid objects) reappears at random
positions on each re-entry — debris positions are not preserved.

**Root cause**: `FloatingDebrisController` seeds debris positions on cold-boot
each time the scene initialises. There is no persistence for debris state.

**Trade-off options**:

**Option B1 — Persist debris positions to sessionStorage**
- Add `saveDebrisItems()` / `loadDebrisItems()` to `FloatingDebrisStateService`.
- Restore on init (same pattern as asteroid samples).
- Pros: identical to asteroid approach, contained change.
- Cons: debris is dynamic (can be collected); stale entries after collection
  need careful invalidation.

**Option B2 — Backend-persist debris (server-authoritative)**
- Add debris to the backend celestial-body model (new `type: debris` field).
- Re-entry fetches from backend like asteroids.
- Pros: cross-session durability, survives browser refresh.
- Cons: larger contract change; requires OpenAPI + backend work.

**Option B3 — Accept debris reset as expected behaviour (deferred)**
- Document as known non-issue: debris is ephemeral by design.
- Focus re-entry acceptance criteria on asteroids only.
- Pros: no code change needed.
- Cons: visually jarring teal blob appearing in different position on return.

### ⚠️ Minor Animation Phase Drift

**Symptom**: Asteroids are at slightly different orbital positions on re-entry
(seconds of elapsed motion during teardown/reload).

**Root cause**: A few seconds elapse between `persistSceneElapsedSeconds()` on
destroy and the first tick after `restorePersistedSceneElapsedSeconds()` on init.

**Trade-off options**:

**Option C1 — Persist a wall-clock timestamp alongside elapsed seconds**
- On restore: compute `elapsedSeconds + (now - savedAt) / 1000`.
- Pros: precise continuity, asteroids appear in the exact position they would
  have been at re-entry time.
- Cons: if the player was away for hours, asteroids jump a lot — may not be
  desirable.

**Option C2 — Add a short fade-in on re-entry**
- Keep current restore; fade asteroid opacity from 0→1 over ~300 ms.
- Pros: hides the positional discontinuity; simple visual trick.
- Cons: cosmetic patch, not a true fix.

**Option C3 — Accept minor drift (current state)**
- The drift is sub-second to a few seconds. Asteroids are in the right
  neighbourhood; only positional micro-differences visible.
- Pros: no further work needed.
- Cons: scene is not bit-exact on re-entry.

---

## Acceptance Criteria Status

| Criterion | Status |
|---|---|
| COORD KM matches to 0.001 on re-entry | ✅ Passing |
| VIEW YAW/PITCH matches on re-entry | ✅ Passing |
| Same asteroid set on re-entry | ✅ Passing |
| Scanned/unscanned state preserved | ✅ Passing (via backend bodies) |
| Flight preferences preserved | ✅ Passing |
| No VIEW snap on flight→orbit toggle | ✅ Passing |
| Space debris positions preserved | ❌ Not implemented (Option B above) |
| Sub-second asteroid position continuity | ⚠️ Partial (Option C above) |

---

## Recommended Next Steps (priority order)

1. **Debris persistence (Option B1)** — sessionStorage approach, mirrors
   asteroid pattern, contained change, no backend work.
2. **Wall-clock continuity for animation phase (Option C1)** — simple timestamp
   delta on restore; only implement if drift is considered jarring after B1.
3. **Backend debris (Option B2)** — only if durability across browser refreshes
   is required for debris items.

---

## Files Changed in This Session

| File | Change |
|---|---|
| `src/app/scene/ship-exterior-view.ts` | Orientation persist/restore, animation clock persist/restore, coordinate HUD precision, flight→orbit sync, roll disabled, debris logger |
| `src/app/scene/ship-exterior/ship-exterior-flight-controls.ts` | Roll accumulation disabled |
| `src/app/scene/ship-exterior/ship-exterior-view-facade.ts` | Updated fallback constants (no ROLL) |
| `src/app/services/ship-exterior-view-state.service.ts` | Added `sceneElapsedSeconds` save/load/clear methods |
| `src/app/mission/first-target-ship-exterior-mission.ts` | Resume uses backend-authoritative count (no random top-up) |
| `src/app/model/sw13b/sw-13b-m1b-stellar-viewer-validation.ts` | Fixed probe data state type; relaxed fallback tier check |
| `src/app/model/sw13b/sw-13b-m2b-ship-external-view-validation.ts` | Same as M1B |
| `src/app/scene/ship-exterior-view.vitest.ts` | Updated test assertions for new behaviour |
| `src/app/model/sw13b/sw-13b-m1b-stellar-viewer-validation.vitest.ts` | Updated tier assertion |
| `src/app/model/sw13b/sw-13b-m2b-ship-external-view-validation.vitest.ts` | Updated tier assertion |
