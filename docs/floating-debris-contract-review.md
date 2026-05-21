# Backend Contract Review: Floating Debris Support

**Date**: May 20, 2026  
**Status**: ❌ Backend changes NOT yet implemented

## Current Contract State

### `launch-item-response.resolution.yieldedItems`

**Current format** (from `docs/server-message-contracts.md` line 598–750):

```json
{
  "id": "<item id>",
  "itemType": "raw-material-nickel-iron",
  "displayName": "Nickel-Iron (Raw Material)",
  "quantity": 32,
  "state": "contained",  // ← Always "contained"
  "container": {          // ← Items go directly into ship hold
    "containerType": "ship",
    "containerId": "<ship id>"
  },
  "launchable": false
}
```

**TypeScript contract** (from `src/app/model/launch-item.ts`):

```ts
export interface LaunchItemYieldedItem {
  id: string;
  itemType: string;
  displayName: string;
  quantity: number;
  state: 'contained' | 'deployed' | 'destroyed';
  container: LaunchItemContainer | null;
  launchable: boolean;
  // ⚠️ Missing: spatial, motion
}
```

---

## What We Need for Floating Debris

From the [floating-debris-tractor-beam-plan.md](floating-debris-tractor-beam-plan.md), the required format for deployed items is:

```json
{
  "id": "<item id>",
  "itemType": "raw-material-nickel-iron",
  "displayName": "Nickel-Iron (Raw Material)",
  "quantity": 32,
  "state": "deployed",                  // ← Changed from "contained"
  "container": null,                    // ← No container (floating)
  "spatial": {                          // ← NEW: Position in space
    "solarSystemId": "sol",
    "frame": "barycentric",
    "positionKm": { "x": 100.5, "y": 42.3, "z": -25.8 },
    "epochMs": 1716240000000
  },
  "motion": {                           // ← NEW: Velocity for animation
    "velocityKmPerSec": { "x": 0.05, "y": -0.02, "z": 0.01 }
  },
  "launchable": false
}
```

---

## Gap Analysis

| Requirement | Current State | Status |
|---|---|---|
| Items can have `state: "deployed"` | Type allows it; contract always returns `"contained"` | ❌ Not implemented |
| Items can have `spatial: SpatialState` | No such field in contract | ❌ Missing |
| Items can have `motion: MotionState` | No such field in contract | ❌ Missing |
| Items can have `container: null` | Type allows it; contract always sets container | ❌ Not implemented |
| `debrisSeed` provided for determinism | ✅ Already in `targetCelestialBody.debrisSeed` | ✅ Ready |
| `targetCelestialBody` provided for position | ✅ Already provided | ✅ Ready |

---

## Action Items for Backend Team

**Priority 1 — Contract changes to `launch-item-response`:**

1. **Add spatial/motion fields to `LaunchItemYieldedItem`**:
   - Add `spatial?: SpatialState | null` 
   - Add `motion?: MotionState | null`
   - Import types from your item model (e.g., `SpatialState`, `MotionState` from wherever you define them)

2. **Deploy items as floating debris (not contained)**:
   - When `first-target` mission destroys an asteroid with outcome `target-destroyed`, set:
     - `yieldedItems[i].state = "deployed"`
     - `yieldedItems[i].container = null`
     - `yieldedItems[i].spatial = { solarSystemId, frame: "barycentric", positionKm: <near destroyed asteroid + seeded scatter>, epochMs: <now> }`
     - `yieldedItems[i].motion = { velocityKmPerSec: <small dispersal vectors> }`
   - Use `debrisSeed` to seed deterministic positions so client can verify them
   - Positions should scatter around `targetCelestialBody.positionKm` in a ~10–50km radius

3. **Gating** (recommended to avoid regressions):
   - Add a `deployDebris: true | false` field to `launch-item-request`, OR
   - Gate on `missionId === "first-target"`, OR
   - Use a server config flag
   - Default to current behaviour (contained items) for non-first-target missions

4. **Update contract documentation** in `docs/server-message-contracts.md` to show the new format with `spatial` and `motion` fields.

---

## Secondary Gap: `item-list-by-location-response`

**Current contract note** (line 2448 in `docs/server-message-contracts.md`):
> *"Only items with `kinematics` are included (deployed items)."*

**Problem**: The legacy `kinematics` field does not exist on new items created with canonical `spatial`. The filter needs to use `spatial` instead.

**Action**: Ensure server filters deployed items by:
```
WHERE state = 'deployed' AND spatial IS NOT NULL AND spatial.positionKm IS NOT NULL
```

Not by:
```
WHERE kinematics IS NOT NULL
```

---

## Frontend-Side Prep (Already Complete)

The frontend TypeScript contract definition (`src/app/model/launch-item.ts`) already declares:
- `state: 'contained' | 'deployed' | 'destroyed'` — can accommodate deployed items ✅
- `container: LaunchItemContainer | null` — can be null ✅
- Type system is ready; just awaiting backend payload changes

**Required frontend updates after backend completes:**
1. Add `spatial?: SpatialState | null` to `LaunchItemYieldedItem`
2. Add `motion?: MotionState | null` to `LaunchItemYieldedItem`
3. Implement Phase 2–6 from the implementation plan (scene rendering, collection, mission gate, etc.)

---

## Next Steps

1. ✅ Share this review with backend team
2. ⏳ Await backend implementation of spatial/motion fields + deployed state
3. ⏳ Update `src/app/model/launch-item.ts` types once backend deploys changes
4. ⏳ Proceed with frontend Phase 2+ implementation (debris controller, scene rendering, tractor beam)

---

## Reference Documents

- Implementation plan: [floating-debris-tractor-beam-plan.md](floating-debris-tractor-beam-plan.md)
- Socket contract spec: [server-message-contracts.md](server-message-contracts.md) (lines 598–750)
- Frontend type model: `src/app/model/launch-item.ts`
