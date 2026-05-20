# Floating Debris & Tractor Beam — Feature Plan

**Feature**: During the `first-target` mission, after an asteroid is destroyed, ship parts / raw
material chunks float in space at the destruction site. The player must manually pilot the Scavenger
Pod close enough for the tractor beam to pull them into the hold.

**This document covers**: the current state of the codebase, what is already in place, every gap
that must be closed (backend and frontend), and a phased implementation order.

---

## Vision (from mission narrative)

> *"Step 4 — The Manual Retrieval: Without a Tug Drone, you must manually pilot your Scavenger Pod
> to 'catch' the floating debris in your gravity scoop."*

The desired gameplay loop is:

1. Player launches Expendable Dart Drone at Iron asteroid → asteroid destroyed.
2. Debris (raw Iron chunks, possibly a ship part) **spawn as floating items** at the explosion site.
3. Player flies the Scavenger Pod into tractor-beam range of each debris item.
4. The tractor beam activates automatically (or via key press) and pulls items into the hold.
5. Mission gate advances once all required materials are collected.

---

## What Already Exists

### Data model — fully in place

| Symbol | File | Notes |
|---|---|---|
| `ShipItem` | `src/app/model/ship-item.ts` | Has `state: 'deployed'`, `spatial: SpatialState \| null`, `motion?: MotionState` |
| `ItemState` | `src/app/model/ship-item.ts` | `'contained' \| 'deployed' \| 'destroyed'` |
| `ItemContainer` | `src/app/model/ship-item.ts` | `{ containerType: 'ship' \| 'market', containerId }` |
| `ItemUpsertPayload` | `src/app/model/item-upsert.ts` | Supports `state`, `container`, `spatial`, `motion` |
| `SpatialState` | `src/app/model/math/spatial.ts` | `{ solarSystemId, frame: 'barycentric', positionKm, epochMs }` |
| `MotionState` | same | `{ velocityKmPerSec }` |

### Socket contracts — already defined

| Event | Direction | Status |
|---|---|---|
| `item-list-by-location-request/response` | client ↔ server | Contract exists; fetches deployed items within `distanceKm` radius |
| `item-upsert-request/response` | client → server | Used to move an item from `deployed` → `contained` |
| `launch-item-response` | server → client | Already carries `resolution.yieldedItems`, `resolution.targetCelestialBody.debris`, `debrisSeed` |

### Celestial body destruction — already carries debris seed

When `launch-item-response` resolves with `outcome: "target-destroyed"`, the response includes:

```json
"resolution": {
  "targetCelestialBody": {
    "state": "destroyed",
    "debrisSeed": 123456789,
    "debris": [
      { "material": "Iron", "rarity": "Common", "quantity": 14, "itemType": "raw-material-iron" }
    ]
  },
  "yieldedItems": [ ... ]
}
```

The `debrisSeed` is deterministic — the same seed can be used client- and server-side to derive
debris positions near the asteroid's `spatial.positionKm`.

### Ship exterior scene controllers — existing extension points

| Controller | Purpose |
|---|---|
| `ShipExteriorBootstrapController` | Seeding/resuming asteroids on scene load |
| `ShipExteriorLaunchController` | Manages launch events |
| `ShipExteriorMissionProgressController` | Evaluates gate step completions |
| `ShipExteriorCelestialBodyController` | Asteroid rendering state |

---

## Gaps That Must Be Closed

### Backend gaps — requirements for the server team

These are blocking; the frontend can mock them locally but needs backend changes before shipping.

#### 1. `launch-item-response`: spawn debris as `deployed` items, not `contained`

**Current behaviour**: `resolution.yieldedItems` are returned with `state: "contained"` and
`container: { containerType: "ship", containerId: "<shipId>" }`. Items land directly in the hold.

**Required behaviour**: For the `first-target` mission (and any mission that uses manual retrieval),
the server should instead:

- Create each debris item with `state: "deployed"`, `container: null`, and a `spatial` position
  near the destroyed asteroid:
  ```json
  "spatial": {
    "solarSystemId": "sol",
    "frame": "barycentric",
    "positionKm": { "x": <asteroidX + offset>, "y": <asteroidY + offset>, "z": <asteroidZ + offset> },
    "epochMs": <now>
  }
  ```
- Positions should be derived deterministically from `debrisSeed` so the client can verify/predict
  them without a second request.
- Return the deployed items in `resolution.yieldedItems` instead of hold items.

**Suggested phasing**: The server could gate this on mission ID so existing behaviour for other
missions is unaffected. A `missionId` field already exists on the request context.

#### 2. `item-list-by-location-response`: use canonical `spatial`, not legacy `kinematics`

**Current contract note**: *"Only items with `kinematics` are included"* — this implies the server
filters deployed items via the deprecated `kinematics` field. Because `kinematics` is rejected on
write, newly created debris items using canonical `spatial` would be invisible to this endpoint.

**Required change**: Server must filter and return items that have a valid canonical `spatial`
(state = `deployed`, spatial not null), not legacy `kinematics`. The `distanceKm` computed field
should use `spatial.positionKm`.

#### 3. Tractor beam collection: server-side proximity validation (optional, deferred)

The simplest client path is to call `item-upsert-request` with:
```json
{
  "item": {
    "id": "<debris item id>",
    "state": "contained",
    "container": { "containerType": "ship", "containerId": "<shipId>" },
    "spatial": null
  }
}
```

The backend contract already says "any authenticated player may upsert any item" with no ownership
check, so this works immediately. However, for production integrity a server-side check that
`ship.spatial` is within tractor beam range of `item.spatial` is recommended before merging.

---

### Frontend gaps — can start building now

#### Phase 1 — Model and service layer (no scene changes)

**1a. TypeScript model file for `item-list-by-location`**

Create `src/app/model/item-list-by-location.ts`:
```ts
export const ITEM_LIST_BY_LOCATION_REQUEST_EVENT = 'item-list-by-location-request';
export const ITEM_LIST_BY_LOCATION_RESPONSE_EVENT = 'item-list-by-location-response';

export interface ItemListByLocationRequest {
  playerName: string;
  sessionKey: string;
  solarSystemId: string;
  positionKm: { x: number; y: number; z: number };
  distanceKm: number;
  itemType?: string;
  limit?: number;
}

export interface ItemListByLocationResponse {
  success: boolean;
  message: string;
  playerName: string;
  solarSystemId: string;
  positionKm: { x: number; y: number; z: number };
  distanceKm: number;
  itemType: string | null;
  items: (ShipItem & { distanceKm: number })[];
}
```

**1b. Add `listNearbyDeployedItems()` to `ShipExteriorSocketService`**

The existing socket service already handles ship list, celestial body list, and launch responses.
Add a parallel method for location-based item queries.

**1c. `FloatingDebrisStateService`**

New service scoped to `src/app/services/floating-debris-state.service.ts`:
- Stores active floating item list as a signal: `readonly floatingItems: Signal<FloatingDebrisItem[]>`
- Persists to `sessionStorage` keyed by `missionId::playerName::characterId` (matching the
  pattern established by `ShipExteriorAsteroidStateService`)
- Exposes `loadItems(context)`, `saveItems(context, items)`, `clearItems(context)`

**1d. `FloatingDebrisItem` domain type**

```ts
export interface FloatingDebrisItem {
  id: string;
  itemType: string;
  displayName: string;
  /** Scene-local position (not km-scale; scaled from spatial for Three.js) */
  scenePosition: [number, number, number];
  /** Canonical spatial for server round-trips */
  spatial: SpatialState;
  distanceKm: number;
  collected: boolean;
}
```

---

#### Phase 2 — Populate floating items from destruction events

**2a. `FloatingDebrisController`** (new, follows the same pattern as `ShipExteriorBootstrapController`)

Responsibilities:
- Listens to `launch-item-response` events in the scene.
- On `target-destroyed` outcome, reads `resolution.yieldedItems` (currently contained) OR (post-backend
  change) the deployed items — determine which path by checking `item.state`.
- Derives scene positions from `debrisSeed` + destroyed asteroid `spatial.positionKm` using a
  small seeded scatter (matching the approach in `first-target-ship-exterior-mission.ts`).
- Writes to `FloatingDebrisStateService`.

**2b. Polling `item-list-by-location-request`** (activate after backend gap #1 and #2 are closed)

- On scene tick (low frequency — every 2–5 seconds), emit `item-list-by-location-request` centred
  on the ship's current `spatial.positionKm` with a `distanceKm` radius matching tractor beam range.
- Merge results into `FloatingDebrisStateService` — this handles multi-session resume (player
  re-enters scene after items were left floating).

---

#### Phase 3 — Three.js scene rendering

**3a. `FloatingDebrisNode` component** (Angular Three component)

A new Three.js node rendered for each `FloatingDebrisItem` in the scene:
- Geometry: a small icosahedron or cube with emissive material to make it visible.
- Optionally reuse the asteroid mesh pipeline at a tiny scale for visual consistency.
- Slow tumbling rotation via Angular Three's `(beforeRender)` event.
- Glow/halo when within tractor beam range.

**3b. Tractor beam range indicator**

A wireframe sphere or ring drawn at the tractor beam collection radius around the ship.
- Only visible when there is at least one floating item in the scene.
- Colour shifts to indicate item is within range.

---

#### Phase 4 — Tractor beam collection mechanic

**4a. Proximity detection**

In the scene's render loop, compare each `FloatingDebrisItem.scenePosition` against the ship's
current position. When distance drops below `TRACTOR_BEAM_RANGE_SCENE_UNITS`:
- Transition the item's state to `in-range` in the signal.
- Trigger a "beam lock" visual (particle trail from ship to item).

**4b. Collection action**

Two possible UX models to decide:
- **Auto-collect**: item is automatically collected as soon as it enters range (simplest, matches
  "gravity scoop" narrative).
- **Key-press collect**: player presses `F` (or similar) to activate tractor beam when in range.

Collection sends `item-upsert-request`:
```ts
socketService.upsertItem({
  playerName,
  sessionKey,
  item: {
    id: item.id,
    state: 'contained',
    container: { containerType: 'ship', containerId: activeShip.id },
    spatial: null,
    motion: null,
  }
});
```

On `item-upsert-response` success:
- Remove item from `FloatingDebrisStateService`.
- Animate item dissolving into ship (brief flash).
- Re-fetch `ship-list-request` to reconcile authoritative hold inventory.

---

#### Phase 5 — Mission gate integration

**5a. New gate step in `first-target-ship-exterior-mission.ts`**

After `neutralize_identified_asteroid` completes, unlock:
```ts
{
  key: 'collect_floating_debris',
  objectiveText: 'Objective unlocked: Pilot the Scavenger Pod to collect the floating debris via tractor beam.',
  completionToastMessage: 'Mission update: Debris collected.',
  prerequisiteStepKeys: ['neutralize_identified_asteroid'],
}
```

Completion evidence: all `FloatingDebrisItems` from the destroyed Iron asteroid are collected
(tracked in `FloatingDebrisStateService`).

**5b. `ShipExteriorMissionProgressController` update**

Add evaluation logic for `collect_floating_debris` — triggered by `FloatingDebrisStateService`
signal change when last item is collected.

---

#### Phase 6 — i18n

Add to both `src/app/i18n/locales/en.ts` and `it.ts`:

```ts
shipExterior: {
  tractorBeam: {
    rangeIndicator: 'Tractor Beam Range',
    itemDetected: 'Debris detected',
    itemsDetected: '{{count}} debris items detected',
    collecting: 'Collecting...',
    collected: 'Collected: {{name}}',
    allCollected: 'All debris collected.',
  }
}
```

---

## What to Communicate to the Backend Team

Summarised requirements for the backend:

1. **`launch-item-response` change**: For `first-target` mission (or mission-gated), change
   `resolution.yieldedItems` from `state: "contained"` to `state: "deployed"` with canonical
   `spatial` positions derived from destroyed celestial body position + `debrisSeed` scatter.
   Provide a `missionId` or `deployDebris: true` flag on `launch-item-request` to opt in.

2. **`item-list-by-location-response` fix**: Filter and return items by canonical `spatial`
   (not legacy `kinematics`). Include `distanceKm` as a computed field in each item entry.

3. **Tractor beam proximity enforcement** (optional phase 2 backend): Accept `item-upsert-request`
   state transitions from `deployed` → `contained` only when `ship.spatial` is within a defined
   `tractorBeamRangeKm` of `item.spatial`. Return `success: false` with reason `OUT_OF_RANGE`
   when violated.

4. **No new socket events needed** — existing `item-upsert-request`, `item-list-by-location-request`,
   and `launch-item-response` are sufficient. The only changes are to payload semantics.

---

## Implementation Order (recommended)

| Phase | Unblocked? | Deliverable |
|---|---|---|
| 1 — Model + service layer | ✅ Yes | `item-list-by-location.ts`, `FloatingDebrisStateService`, `FloatingDebrisItem` type |
| 2a — Debris from destruction | ✅ Yes (client-side seed only) | `FloatingDebrisController`, derives positions from `debrisSeed` |
| 3a — Scene node rendering | ✅ Yes | `FloatingDebrisNode` Three.js component |
| 3b — Range indicator | ✅ Yes | Wireframe sphere HUD |
| 4 — Tractor beam collection | ✅ Yes (client trusts proximity) | Proximity detection + `item-upsert` collection |
| 5 — Mission gate step | ✅ Yes | New `collect_floating_debris` step |
| 6 — i18n | ✅ Yes | en.ts + it.ts strings |
| 2b — Backend location poll | ❌ Blocked on backend gap #1 + #2 | `item-list-by-location` polling for resume |
| Proximity validation | ❌ Blocked on backend gap #3 | Server-enforced range check |

Phases 1–6 can all be built and tested end-to-end on the frontend using client-side debris position
seeding (the same deterministic approach already used for asteroids). The backend integration slots
in without changing the client API surface.
