# Backend: Canonical Spatial Model Cutover

**Status**: Frontend complete, validated (1181 tests passing). Backend implementation ready to begin.

**Scope**: Refactor all entity schemas and API responses to use a single authoritative spatial container. Remove fallback position readers.

**Timeline Dependency**: This is a coordinated change—frontend is complete and waiting. Backend can begin immediately.

---

## Executive Summary

The frontend has migrated to a hard-cut spatial model where:
- **Every in-world entity has one required `spatial` field** carrying position, system ID, frame, and epoch.
- **Motion is optional**, stored separately as `motion`.
- **Legacy fields are removed entirely**: no `location`, no `kinematics`, no fallback readers.

All 1181 frontend tests pass with the new structure. Backend must implement the same contract.

---

## Field Migration Map

### Ships

**Before:**
```typescript
{
  id: string;
  model: string;
  name: string;
  location?: { positionKm: Triple };
  kinematics?: {
    position: Triple;
    velocity: Triple;
    reference: {
      solarSystemId: string;
      referenceKind: string;
      distanceUnit: string;
      velocityUnit: string;
      epochMs: number;
    };
  };
  // ... other fields
}
```

**After:**
```typescript
{
  id: string;
  model: string;
  name: string;
  spatial: {
    solarSystemId: string;
    frame: 'barycentric';
    positionKm: Triple;
    epochMs: number;
  };
  motion?: {
    velocityKmPerSec: Triple;
  };
  // ... other fields (unchanged)
}
```

**Mapping Rules:**
- `location.positionKm` → `spatial.positionKm`
- `kinematics.reference.solarSystemId` → `spatial.solarSystemId`
- `kinematics.reference.epochMs` → `spatial.epochMs`
- `kinematics.velocity` → `motion.velocityKmPerSec`
- `kinematics.reference.referenceKind` → `spatial.frame` (hardcoded to `'barycentric'`)
- **Remove entirely:** `location`, `kinematics.reference`, `kinematics.position`, `kinematics.distanceUnit`, `kinematics.velocityUnit`

**Affected Response Events:**
- `SHIP_LIST_RESPONSE` → all ships must have `spatial`
- `SHIP_DETAILS_RESPONSE` → ships must have `spatial`
- `SHIP_UPSERT_RESPONSE` → returned ship must have `spatial`

**Affected Request Payloads:**
- `SHIP_UPSERT_REQUEST` → accept `spatial` and `motion` in ship payload; reject `location` and `kinematics`

---

### Celestial Bodies

**Before:**
```typescript
{
  id: string;
  catalogId: string;
  location?: { positionKm: Triple };
  solarSystemId?: string;
  kinematics?: {
    velocityKmPerSec: Triple;
    angularVelocityRadPerSec?: Triple;
    estimatedMassKg?: number;
    estimatedDiameterM?: number;
    // ... other kinematics fields
  };
  composition?: { /* ... */ };
  scanState?: string;
  visibility?: string;
  // ... other fields
}
```

**After:**
```typescript
{
  id: string;
  catalogId: string;
  spatial: {
    solarSystemId: string;
    frame: 'barycentric';
    positionKm: Triple;
    epochMs: number;
  };
  motion?: {
    velocityKmPerSec: Triple;
    angularVelocityRadPerSec?: Triple;
  };
  physical?: {
    estimatedMassKg?: number;
    estimatedDiameterM?: number;
  };
  observability: {
    visibility: 'visible' | 'not-visible' | 'cloaked';
    scanState: 'unscanned' | 'scanned';
  };
  composition?: { /* ... */ };
  // ... other fields (unchanged)
}
```

**Mapping Rules:**
- `location.positionKm` → `spatial.positionKm`
- `solarSystemId` → `spatial.solarSystemId`
- `kinematics.velocityKmPerSec` → `motion.velocityKmPerSec`
- `kinematics.angularVelocityRadPerSec` → `motion.angularVelocityRadPerSec`
- `kinematics.estimatedMassKg` → `physical.estimatedMassKg`
- `kinematics.estimatedDiameterM` → `physical.estimatedDiameterM`
- `scanState` → `observability.scanState`
- `visibility` → `observability.visibility`
- **Remove entirely:** `location`, `kinematics`

**Affected Response Events:**
- `CELESTIAL_BODY_LIST_RESPONSE` → all bodies must have `spatial` and `observability`
- `CELESTIAL_BODY_DETAILS_RESPONSE` → bodies must have `spatial` and `observability`

---

### Markets

**Before:**
```typescript
{
  marketId: string;
  marketName: string;
  solarSystemId: string;
  locationType: string;
  locationName: string;
  positionKm?: Triple;
  orbit?: {
    anchorBodyId: string;
    semiMajorAxisKm: number;
    eccentricity: number;
    // ... more orbital elements
  };
  priceMultiplier: number;
  driftPercentPerHour: number;
  restockIntervalMinutes: number;
  // ... other fields
}
```

**After:**
```typescript
{
  marketId: string;
  marketName: string;
  siteType: string;
  siteName: string;
  spatial: {
    solarSystemId: string;
    frame: 'barycentric';
    positionKm: Triple;
    epochMs: number;
  };
  trajectory?: {
    kind: 'static' | 'orbital-elements';
    orbit?: {
      anchorBodyId: string;
      semiMajorAxisKm: number;
      eccentricity: number;
      // ... more orbital elements (unchanged structure)
    };
  };
  priceMultiplier: number;
  driftPercentPerHour: number;
  restockIntervalMinutes: number;
  // ... other fields (unchanged)
}
```

**Mapping Rules:**
- `locationType` → `siteType`
- `locationName` → `siteName`
- `positionKm` → `spatial.positionKm`
- `solarSystemId` → `spatial.solarSystemId`
- `orbit` → `trajectory.orbit` (wrapped in descriptor with `kind` field)
- If `orbit` is null/undefined, `trajectory` should be omitted
- **Important:** If orbit is a long-lived source of truth, you must materialize `spatial.positionKm` from it (compute position at epoch) for client scene visibility queries

**Affected Response Events:**
- `MARKET_LIST_RESPONSE` → all markets must have `spatial`
- `MARKET_DETAILS_RESPONSE` → markets must have `spatial`

---

## Core Model Interfaces

All backends responses should use or expose these interfaces. (Language-specific translations acceptable; field names must match exactly.)

```typescript
export interface Triple {
  x: number;
  y: number;
  z: number;
}

export interface SpatialState {
  solarSystemId: string;
  frame: 'barycentric'; // Hardcoded, not a variable
  positionKm: Triple;
  epochMs: number;
}

export interface MotionState {
  velocityKmPerSec: Triple;
  angularVelocityRadPerSec?: Triple;
}

export interface PhysicalState {
  estimatedMassKg?: number;
  estimatedDiameterM?: number;
}

export interface ObservabilityState {
  visibility: 'visible' | 'not-visible' | 'cloaked';
  scanState: 'unscanned' | 'scanned';
}

export interface TrajectoryDescriptor {
  kind: 'static' | 'orbital-elements';
  orbit?: {
    anchorBodyId: string;
    semiMajorAxisKm: number;
    eccentricity: number;
    inclinationDeg: number;
    longitudeOfAscendingNodeDeg: number;
    argumentOfPeriapsisDeg: number;
    meanAnomalyAtEpochDeg: number;
    orbitalPeriodSec: number;
    epoch: string;
  };
}

export interface ShipSummary {
  id: string;
  name: string;
  model: string;
  tier: number;
  status?: string | null;
  launchable?: boolean;
  inventory?: ShipItem[];
  spatial: SpatialState; // Required
  motion?: MotionState; // Optional
  observability?: ObservabilityState; // Optional
  damageProfile?: ShipDamageProfile | null;
}

export interface CelestialBodyListItem {
  id: string;
  catalogId: string;
  sourceScanId: string;
  createdByCharacterId: string;
  missionId?: string;
  missionInstanceId?: string | null;
  createdAt: string;
  updatedAt: string;
  spatial: SpatialState; // Required
  motion?: MotionState; // Optional
  physical?: PhysicalState; // Optional
  composition?: AsteroidMaterialProfile;
  observability: ObservabilityState; // Required
  state?: 'active' | 'destroyed';
  destroyedAt?: string | null;
  destroyedReason?: string | null;
  distanceKm: number;
}

export interface MarketSummary {
  marketId: string;
  marketName: string;
  siteType: string; // Renamed from locationType
  siteName: string; // Renamed from locationName
  isStarterMarket?: boolean;
  spatial: SpatialState; // Required
  trajectory?: TrajectoryDescriptor; // Optional
  priceMultiplier: number;
  driftPercentPerHour: number;
  restockIntervalMinutes: number;
  distanceKm?: number;
  isDocked?: boolean;
}
```

---

## Implementation Checklist

### Phase 1: Schema & Model Layer
- [ ] Update ship table/document to require `spatial` column/field
  - Add `spatial.solarSystemId`, `spatial.frame`, `spatial.positionKm`, `spatial.epochMs`
  - Add optional `motion.velocityKmPerSec`
  - Migrate existing `location.positionKm` and `kinematics.*` data into new fields
  - Remove `location` and `kinematics` columns/fields from schema
- [ ] Update celestial body table/document
  - Add `spatial.*` (required)
  - Add `motion.*` (optional)
  - Add `physical.*` (optional)
  - Migrate `scanState` and `visibility` into `observability`
  - Remove `location`, `solarSystemId` (if redundant), and `kinematics`
- [ ] Update market table/document
  - Rename `locationType` → `siteType`, `locationName` → `siteName`
  - Add `spatial.*` (required)
  - Add `trajectory.*` (optional, wraps `orbit`)
  - Materialize `spatial.positionKm` from `orbit` if orbit is source of truth

### Phase 2: Data Migration
- [ ] Write and test migration script to populate new fields from legacy fields
  - Ships: move `location.positionKm` and `kinematics.*` into `spatial` and `motion`
  - Bodies: move `location.positionKm`, `kinematics.*`, scan/visibility into new structure
  - Markets: rename fields, compute `spatial` from `positionKm` or `orbit`
- [ ] Verify migration integrity (counts, position values, epoch consistency)
- [ ] Back up existing data before migration

### Phase 3: API Response Contracts
- [ ] Update `ShipListResponse` → return ships with `spatial` (required), `motion` (optional)
- [ ] Update `ShipDetailsResponse` → same as above
- [ ] Update `ShipUpsertResponse` → returned ship must have `spatial`
- [ ] Update `CelestialBodyListResponse` → bodies must have `spatial` (required) and `observability` (required)
- [ ] Update `CelestialBodyDetailsResponse` → same as above
- [ ] Update `MarketListResponse` → markets must have `spatial` (required)
- [ ] Update `MarketDetailsResponse` → same as above
- [ ] Update any other response that includes ships, bodies, or markets

### Phase 4: Inbound Request Validation
- [ ] Update `ShipUpsertRequest` handler:
  - Accept `ship.spatial` and `ship.motion` in payload
  - Validate `spatial` is present and valid
  - Explicitly reject `location` and `kinematics` in request payload
  - Return clear error message if legacy fields are present
- [ ] Update any bulk ship operations to enforce same validation

### Phase 5: Testing & Validation
- [ ] Update all backend unit tests to use new shape for fixtures
  - Ship fixtures: add `spatial`, remove `location` and `kinematics`
  - Body fixtures: add `spatial`, `observability`; remove `location`, `kinematics`
  - Market fixtures: rename fields, add `spatial`
- [ ] Run full test suite → all tests must pass
- [ ] Run integration tests with frontend socket mocks (if available)

### Phase 6: Documentation
- [ ] Update `docs/server-message-contracts.md` with new response shapes
- [ ] Add example payloads for each response type
- [ ] Document validation rules (required fields, rejection conditions)
- [ ] Add migration notes if applicable

---

## Validation & Safety Rules

### Required Field Enforcement
Every in-world entity response **must** include `spatial`:
```
ships: ShipSummary[] → all have spatial: SpatialState ✓
celestialBodies: CelestialBodyListItem[] → all have spatial and observability ✓
markets: MarketSummary[] → all have spatial ✓
```

### Legacy Field Rejection
Any inbound request that includes `location` or `kinematics` should be rejected with a clear error:
```
POST /ship/upsert
{
  "ship": {
    "id": "...",
    "location": { "positionKm": {...} }  ← REJECT with 400 error
  }
}
```

Error message example:
```json
{
  "success": false,
  "message": "ShipUpsert: legacy field 'location' is not supported. Use 'spatial' instead."
}
```

### Distance Calculation Consistency
If the backend computes distances (for nearby object queries, visibility filtering, etc.):
1. Always use the same Cartesian distance formula as frontend:
   ```
   d = sqrt((x₂ - x₁)² + (y₂ - y₁)² + (z₂ - z₁)²)
   ```
2. Prefer squared distance for selection:
   ```
   d² = (x₂ - x₁)² + (y₂ - y₁)² + (z₂ - z₁)²
   within_range = d² ≤ r²
   ```
3. Assert matching `solarSystemId` and `frame` before computing distance
4. Consider throwing an error or returning null if frames mismatch

### Epoch Consistency
All positions in the same response/snapshot should share the same logical epoch (`epochMs`). If computing positions from orbital elements at different epochs, ensure epoch is clearly marked.

---

## Example Responses (After Implementation)

### ShipListResponse
```json
{
  "success": true,
  "message": "ok",
  "playerName": "Pioneer",
  "characterId": "char-1",
  "ships": [
    {
      "id": "ship-1",
      "name": "Explorer-1",
      "model": "Scavenger Pod",
      "tier": 1,
      "spatial": {
        "solarSystemId": "sol",
        "frame": "barycentric",
        "positionKm": { "x": 0, "y": 0, "z": 0 },
        "epochMs": 1234567890
      },
      "motion": {
        "velocityKmPerSec": { "x": 0.1, "y": 0, "z": 0.05 }
      },
      "inventory": [],
      "launchable": true
    }
  ]
}
```

### CelestialBodyListResponse
```json
{
  "success": true,
  "message": "ok",
  "bodies": [
    {
      "id": "body-1",
      "catalogId": "asteroid-001",
      "spatial": {
        "solarSystemId": "sol",
        "frame": "barycentric",
        "positionKm": { "x": 150000, "y": 50000, "z": 30000 },
        "epochMs": 1234567890
      },
      "motion": {
        "velocityKmPerSec": { "x": 0, "y": 0.2, "z": -0.1 }
      },
      "physical": {
        "estimatedMassKg": 1e18,
        "estimatedDiameterM": 500
      },
      "observability": {
        "visibility": "visible",
        "scanState": "scanned"
      },
      "composition": { /* ... */ },
      "distanceKm": 158114
    }
  ]
}
```

### MarketListResponse
```json
{
  "success": true,
  "message": "ok",
  "markets": [
    {
      "marketId": "market-1",
      "marketName": "Ceres Belt Trade Ring",
      "siteType": "station",
      "siteName": "Ceres Main",
      "spatial": {
        "solarSystemId": "sol",
        "frame": "barycentric",
        "positionKm": { "x": 413000, "y": 0, "z": 0 },
        "epochMs": 1234567890
      },
      "trajectory": {
        "kind": "orbital-elements",
        "orbit": {
          "anchorBodyId": "ceres",
          "semiMajorAxisKm": 413000,
          "eccentricity": 0.076,
          "inclinationDeg": 10.593,
          "longitudeOfAscendingNodeDeg": 80.329,
          "argumentOfPeriapsisDeg": 73.115,
          "meanAnomalyAtEpochDeg": 0,
          "orbitalPeriodSec": 145730400,
          "epoch": "2026-05-05T00:00:00Z"
        }
      },
      "priceMultiplier": 1.0,
      "driftPercentPerHour": 0.5,
      "restockIntervalMinutes": 60,
      "distanceKm": 413000
    }
  ]
}
```

---

## Questions & Coordination

- **Orbit computation**: If orbit is the authoritative data, how should the server compute `spatial.positionKm` at the target epoch? (E.g., use Kepler's equations, precompute at fixed intervals, or handle on client?)
- **Database timeline**: When can migration be scheduled? Are there any constraints on downtime?
- **Testing coordination**: Can we run integration tests between updated backend and frontend once both are complete?
- **Rollout plan**: Should backend and frontend go live simultaneously, or staggered?

---

## References

- **Architecture Decision**: `docs/spatial-model-architecture-decision.md`
- **Frontend Implementation**: Already complete (all 1181 tests passing)
- **Socket Event Contracts**: Update `docs/server-message-contracts.md` after implementation

---

**Ready to begin? Contact the frontend team once you have questions or reach key milestones.**
