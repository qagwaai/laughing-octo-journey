# Ship Exterior Mission Layer Architecture Decision

- Date: 2026-04-28
- Status: Accepted
- Scope: Separating mission-specific behavior from the reusable `ship-exterior-view` scene

## Context

The `ship-exterior-view` scene is shared across missions.  After the seeding architecture was introduced (see `ship-exterior-view-seeding-architecture-decision.md`), mission-specific logic remained inline in the scene:

- Deterministic asteroid generation (fallback, new, resumed sets) hard-coded for the `first-target` mission.
- Launch item response handling specific to `first-target` outcomes.
- Inventory inspection (`normalizeInventoryToken`, `hasExpendableDartDroneInInventory`) specific to `first-target` targeting rules.
- `applyLaunchTargetDestroyedState` referencing `first-target` asteroid IDs directly.

This made the scene impossible to reuse for a second mission without branching or duplication.

## Decision

Introduce a **mission definition layer** that isolates all mission-specific behavior behind a per-mission object implementing a shared interface.  The scene delegates exclusively to that object; it contains no mission-specific code.

### Core interface — `ShipExteriorMissionDefinition`

```typescript
export interface ShipExteriorMissionDefinition {
    readonly missionId: string;

    // Whether targeting mode is available for the given ship + inventory state
    canTargetAsteroids(params: ShipExteriorMissionTargetingParams): boolean;

    // Whether the raw ship inventory contains the item that unlocks targeting
    resolveTargetingCapabilityFromInventory(rawInventory: unknown): boolean;

    // How a LaunchItemResponse should be interpreted (target destroyed vs failure)
    resolveLaunchItemResponse(
        response: LaunchItemResponse,
        params: ShipExteriorMissionLaunchResponseResolution
    ): ShipExteriorMissionLaunchResult;

    // Asteroid sample creation for cold-start, resume, and fallback paths
    createNewAsteroidSamplesAroundShip(ship: CelestialBodyListItem): AsteroidScanSample[];
    createResumedAsteroidSamples(
        serverBodies: CelestialBodyListItem[],
        ship: CelestialBodyListItem
    ): AsteroidScanSample[];
    createFallbackAsteroidSamples(seed: string): AsteroidScanSample[];
}
```

### Registry — `resolveShipExteriorMission`

A `Map<string, ShipExteriorMissionDefinition>` keyed by `missionId`.  `resolveShipExteriorMission(missionId?)` looks up by id and falls back to the first-target mission when the id is absent or unrecognised.

```typescript
export function resolveShipExteriorMission(missionId?: string | null): ShipExteriorMissionDefinition
```

### Scene contract

`ShipExteriorViewScene` calls `resolveShipExteriorMission(this.navigationState.missionContext?.missionId)` at construction and stores the result as `this.missionDefinition`.  Every path that previously contained mission-specific logic is replaced with a call to the appropriate method on that object.

## File Layout

| File | Purpose |
|---|---|
| `src/app/mission/ship-exterior-mission.ts` | Interface, supporting types, registry, resolver |
| `src/app/mission/ship-exterior-mission.spec.ts` | Registry resolver tests |
| `src/app/mission/first-target-ship-exterior-mission.ts` | `FIRST_TARGET_SHIP_EXTERIOR_MISSION` constant implementing the interface |
| `src/app/mission/first-target-ship-exterior-mission.spec.ts` | Behaviour tests for the first-target implementation |
| `src/app/model/ship-exterior-asteroid-sample.ts` | Shared `AsteroidScanSample` type (used by both mission and scene layers) |

## Rationale

- `ship-exterior-view.ts` becomes a pure host: rendering, signals, socket wiring.  Zero mission knowledge.
- Each mission owns its own file and can evolve independently.
- Adding a new mission is a single, isolated change: create the file, implement the interface, register the constant.
- All first-target logic is co-located and unit-testable without a full Angular component harness.

## Alternatives Considered

1. **Inline `if (missionId === 'first-target')` branches in the scene.**  
   Rejected: scales linearly with missions; mixes concerns; makes the scene untestable in isolation.

2. **Angular services per mission injected into the scene.**  
   Considered but deferred: DI overhead for objects that are pure data/logic with no Angular lifecycle needs.  Plain objects behind an interface are simpler and fully testable.

3. **A single shared service with strategy methods keyed by `missionId`.**  
   Rejected: same coupling problem as inline branching, just moved to a different file.

## Consequences

Positive:

- Scene has no first-target imports.
- First-target RNG logic (seeded `hashToSeed` + `seededRandom` LCG) is private to the mission file.
- Adding a second mission requires no changes to `ship-exterior-view.ts`.

Trade-offs:

- A new mission author must implement every method on the interface, even those that may not apply (e.g., a mission with no asteroids still needs stub implementations).

## Adding a New Mission — Step-by-Step

1. **Create** `src/app/mission/<mission-id>-ship-exterior-mission.ts`.
2. **Implement** `ShipExteriorMissionDefinition`.  Import the interface from `./ship-exterior-mission`.
3. **Export** a named constant: `export const MY_MISSION_SHIP_EXTERIOR_MISSION: ShipExteriorMissionDefinition = { ... }`.
4. **Register** it in the `MISSION_REGISTRY` map inside `ship-exterior-mission.ts`:
   ```typescript
   import { MY_MISSION_SHIP_EXTERIOR_MISSION } from './my-mission-ship-exterior-mission';
   // add to map:
   [MY_MISSION_ID, MY_MISSION_SHIP_EXTERIOR_MISSION],
   ```
5. **Add `missionId`** to `SHIP_EXTERIOR_MISSION_IDS` if a compile-time constant is useful.
6. **Write tests** in `<mission-id>-ship-exterior-mission.spec.ts` — no Angular TestBed needed, plain unit tests only.
7. **Navigate** into the scene with `missionContext: { missionId: MY_MISSION_ID, ... }` from the mission's entry page.

## Implementation Notes

Key methods and their first-target implementations:

- `canTargetAsteroids` — `true` only when ship model is `Scavenger Pod` and `hasExpendableDartDrone` is `true`.
- `resolveTargetingCapabilityFromInventory` — checks coerced inventory for `itemType` or `displayName` matching `expendable-dart-drone` (after normalisation: lowercase, spaces/underscores → hyphens, non-alphanumeric stripped).
- `resolveLaunchItemResponse` — maps `LAUNCH_TARGET_DESTROYED` response code to a destroy-asteroid result and any other failure to a failed-launch result.
- `createNewAsteroidSamplesAroundShip` / `createResumedAsteroidSamples` / `createFallbackAsteroidSamples` — deterministic generation via FNV-1a `hashToSeed` + LCG `seededRandom`.

The scene uses the generic `removeAsteroidSamples(sampleIds: string[])` helper (not mission-specific) to apply destroyed-body state, receiving the list of ids from `resolveLaunchItemResponse`.

## Related Documents

- `docs/ship-exterior-view-seeding-architecture-decision.md` — seed policy contract that preceded this layer
- `docs/ship-exterior-view-seeding-architecture-decision.md` — context on `ShipExteriorViewMissionContext` shape
