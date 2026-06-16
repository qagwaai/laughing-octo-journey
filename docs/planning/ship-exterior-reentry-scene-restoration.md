# Ship External View — Scene Restoration on Re-entry

Date: 2026-06-13  
Status: Mostly complete — re-entry restoration implemented except debris persistence and minor orbital drift  
Scope: `ship-exterior-view` / `opening-cold-boot-scan`

---

## Feature Goal

When the player navigates away from ship-external-view (to mission board, ship hangar, market hub, or any other page) and then returns via ship hangar "View Exterior" or any other entry point, the scene must look identical to when they left:

- Ship position (km coordinates) — **done**
- Scene world offset / camera displacement from original boot position — **done**
- Camera orientation (yaw, pitch, roll) — **not persisted**
- Targeted asteroid — **not persisted** (likely worked before if data model matched; needs verification)
- Active scan asteroid (hover) — **not persisted / intentionally ephemeral; deferred**
- Flight mode enabled state — **not persisted** (intentionally resets; needs policy decision)
- Flight mouse sensitivity / invert-Y pref — **not persisted** (user preference; should survive)
- Asteroid scan state (scanned/unscanned, materials) — **already persisted** via `ShipExteriorAsteroidStateService` (localStorage)
- Mission gate state — **already persisted** via `ShipExteriorMissionStateService` (localStorage)
- Floating debris state — **not persisted** (ephemeral server-driven; probably OK to leave as is)

---

## Progress Update (2026-06-14)

The scene restoration work now covers the main re-entry continuity cases:

- Ship coordinates restore to 0.001 km precision.
- Camera orientation restores across re-entry and flight/orbit transitions without a snap.
- Roll is intentionally disabled, so the orbit controller and flight controller stay aligned.
- Asteroid samples, scan state, and targeted asteroid state restore correctly.
- Scene elapsed time and flight preferences persist across navigation.

Remaining gaps are limited to floating debris re-seeding and a small amount of orbital phase drift.

---

## Position Persistence — What Was Fixed (2026-06-13)

### Root cause chain traced through multiple iterations

1. **No backend write on flight**: Flight checkpoint updates were only updating `SessionService` in memory; `ship-upsert` was never called. Coordinates were lost on page transition because backend still stored the original cold-boot location.

2. **Session stickiness guard blocking flight writes**: Added a "sticky spatial" guard to `SessionService.setActiveShip()` so stale backend list responses could not clobber fresh flight-derived positions. However, this guard also blocked the flight controller's own checkpoint commits, causing partial rollback.
   - **Fix**: Added `SessionService.forceUpdateActiveShipSpatial(shipId, spatial)` as a bypass path used exclusively by the flight controller. All external/backend sources still go through `setActiveShip()` with stickiness protection.

3. **Ship-list hydration overwriting session on re-entry**: When the scene bootstrapped, ship-list-by-owner responses were applied directly to `activeShipLocationKm`, bypassing session spatial that had been force-updated by flight. 
   - **Fix**: `resolvePreferredShipSnapshotForHydration()` in `ship-exterior-view.ts` now prefers valid session spatial for same-ship updates.

4. **Hangar passing stale ship-row spatial as navigation payload**: `ShipHangarPage.navigateToExteriorView()` was building the navigation state from the ship-list row, not from the active session ship. If ship-list was populated before flight (on hangar load), the stale coordinates from that fetch seeded the navigation state.
   - **Fix**: `resolvePreferredExteriorNavigationShip()` in `ship-hangar.ts` substitutes active session spatial into `joinShip` when same ship is navigated to exterior.

5. **Scene displacement reset to zero on re-entry**: Even when coordinates were correct in telemetry, the `flightWorldOffset` (Three.js scene group displacement) was always initialized to `[0, 0, 0]`. The scene visually snapped back to the boot position while showing correct km coords.
   - **Fix**: `ShipExteriorFlightController.initializeCurrentLocationFromReference(currentLocation, referenceLocation)` computes displacement delta from reference (navigation-state boot location) to current (session persisted location) and applies it to `flightDisplacementScene` and `syncFlightWorldTransform()` immediately on init.

6. **Final flush on navigate-away sometimes skipped**: `ngOnDestroy` called `persistFlightTrackingCheckpointToBackend()` only for the last quantized checkpoint. If in-progress movement had not reached the next 10 km quantization boundary, those sub-threshold km were lost.
   - **Fix**: `flushPreciseFlightLocationToPersistence()` on destroy and on flight-disable uses `flightController.getCurrentLocationKm()` to get the exact current position, bypassing quantization, before scene teardown.

### Files changed

| File | Change |
|---|---|
| `src/app/services/session.service.ts` | Added stickiness guard; added `forceUpdateActiveShipSpatial()` |
| `src/app/scene/ship-exterior-view.ts` | Backend checkpoint upsert; `forceUpdateActiveShipSpatial` in checkpoint commit; `resolvePreferredShipSnapshotForHydration()`; `flushPreciseFlightLocationToPersistence()`; `resolveRouteEntryShipLocationKm()`; session/nav fallback in `resolveNavigationShipLocationKm()` and `resolveNavigationSolarSystemId()` |
| `src/app/scene/ship-exterior/ship-exterior-flight-controller.ts` | `getCurrentLocationKm()`; `initializeCurrentLocationFromReference()` |
| `src/app/page/game/ship-hangar.ts` | `resolvePreferredExteriorNavigationShip()` in navigation payload |
| `src/testing/mock-session.service.ts` | Added `forceUpdateActiveShipSpatial()` to mock |

---

## Scene Restoration — Remaining Work

### 1. Floating debris

**Current state**: Reloaded from server on every entry; no local persistence.

**Desired state**: Debris positions remain stable across re-entry if that is treated as a durability requirement.

**Design options**:
- Option B1: Persist debris positions to `sessionStorage` in `FloatingDebrisStateService`.
- Option B2: Backend-persist debris as part of the celestial-body model.
- Option B3: Accept debris reset as expected behaviour and keep it documented as ephemeral.

### 2. Minor animation phase drift

**Current state**: Asteroids restore to the right set and general orbital neighborhood, but can drift by a small amount during teardown/reload.

**Desired state**: Either compensate for wall-clock time or explicitly accept the remaining micro-drift.

**Design options**:
- Option C1: Persist a wall-clock timestamp alongside elapsed seconds and advance the scene clock by real elapsed time on restore.
- Option C2: Add a brief fade-in on re-entry to hide the tiny positional discontinuity.
- Option C3: Accept minor drift as the current behavior.

### 3. Flight mode enabled on re-entry

**Policy question**: Should flight mode be re-enabled on re-entry if it was active when the player left?

- If yes: persist `flightModeEnabled` alongside orientation; call `setFlightModeEnabled(true)` in `ngOnInit` after displacement is restored.
- If no: flight always boots in OFF state (current behavior); player re-enables manually.
- **Recommendation**: Default to OFF on re-entry for safety (pointer lock, key capture). Document this as intentional policy.

**Decision**: Flight mode remains OFF on re-entry. This is intentional and now treated as the policy for ship-exterior-view; the player re-enables it manually if needed.

### 4. Active scan asteroid (hover)

**Current state**: `activeScanAsteroidId` resets to null.

**Desired state**: Ephemeral hover state. This is intentionally not restored (player is not hovering on re-entry). Leave as is.

---

## Implementation Sequence (Recommended)

| Priority | Item | Effort | Notes |
|---|---|---|---|
| 1 | Debris persistence (Option B1) | Small | Mirrors asteroid persistence pattern |
| 2 | Wall-clock continuity for animation phase (Option C1) | Small | Only if the remaining drift is objectionable |
| 3 | Backend debris (Option B2) | Large | Only if debris durability must survive browser refresh |

---

## Data Model Notes

`SpatialState` (shared between ship-list, ship-upsert, and spatial math):
```typescript
export interface SpatialState {
  solarSystemId: string;
  frame: SpatialFrame; // 'barycentric'
  positionKm: Triple;
  epochMs: number;
}
```

No heading field exists client-side. Backend `ship-upsert` uses the same `SpatialState` shape. Adding `heading` would be a backend contract change coordinated through `openapi.yaml`.

`FlightOrientation` (client-only, in flight controller):
```typescript
export interface FlightOrientation {
  yawRad: number;
  pitchRad: number;
  rollRad: number;
}
```

This is the authoritative orientation for flight mode. The OrbitControls camera quaternion is the authority in non-flight mode.

---

## Test Coverage Added

| File | Tests added |
|---|---|
| `src/app/services/session.service.vitest.ts` | Stickiness guard: same-ship usable spatial preserved; unusable falls through; force-update bypasses guard; id-mismatch rejected; case/whitespace normalization |
| `src/app/scene/ship-exterior-view.vitest.ts` | Flight checkpoint sends `upsertShip`; stale ship-list cannot roll back session; scene re-entry reconstructs world offset from persisted-vs-entry delta |
| `src/app/page/game/ship-hangar.vitest.ts` | Exterior navigation prefers active-session spatial over stale ship-row spatial |
| `e2e/tests/ship-exterior-flight-position-persistence.spec.ts` | Full navigate-away/return cycle via mission board + market hub + hangar; second cycle with reversed page order |
