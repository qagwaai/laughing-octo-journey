# Spatial Model Architecture Decision

- Date: 2026-05-05
- Status: Accepted
- Scope: Canonical spatial modeling for ships, celestial bodies, markets, and scene visibility queries

## Context

Prior to this decision, world entities exposed position through more than one field shape.

- Ships previously split coordinates and motion across `location` and `kinematics`.
- Celestial bodies previously split coordinates and motion across `location` and `kinematics`.
- Markets previously mixed semantic place labels (`locationType`, `locationName`), optional resolved coordinates (`positionKm`), and optional orbital elements (`orbit`).

Current canonical market fields are `siteType`, `siteName`, and required `spatial` position snapshots.

This forces consumers to guess which field is authoritative. The client already contains fallback logic that reads position from multiple places when building scene and market queries.

The near-term product need is simpler than full orbital simulation: determine whether one object is close enough to another object to be rendered or queried in a 3D scene such as `ship-exterior-view`.

## Decision

Adopt one canonical persisted spatial frame for all in-world entities and require one authoritative spatial container on every in-world record.

### Canonical frame

- Frame kind: `barycentric`
- Scope: one frame per `solarSystemId`
- Coordinate system: Cartesian
- Distance unit: kilometres
- Epoch field: required on spatial snapshots

### Authority rule

- Position lives only in `spatial.positionKm`.
- Motion never owns position.
- Visibility, scan state, and cloaking never change true position. They only change what an observer may know or render.
- Derived frames such as ship-local render space or body-centered interaction space are runtime transforms only, not alternate persisted truth.

### Required entity rule

- Ships must have `spatial`.
- Celestial bodies must have `spatial`.
- Markets must have `spatial`.
- Motion may be optional.

## Target Model Shape

```ts
import { Triple } from '../src/app/model/triple';

export interface SpatialState {
	solarSystemId: string;
	frame: 'barycentric';
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
```

### Ship target

```ts
export interface ShipSummary {
	id: string;
	name: string;
	status?: string | null;
	damageProfile?: ShipDamageProfile | null;
	model: string;
	tier: number;
	launchable?: boolean;
	inventory?: ShipItem[];
	spatial: SpatialState;
	motion?: MotionState;
	observability?: ObservabilityState;
}
```

### Celestial body target

```ts
export interface CelestialBodyListItem {
	id: string;
	catalogId: string;
	sourceScanId: string;
	createdByCharacterId: string;
	missionId?: string;
	missionInstanceId?: string | null;
	createdAt: string;
	updatedAt: string;
	spatial: SpatialState;
	motion?: MotionState;
	physical?: PhysicalState;
	composition?: AsteroidMaterialProfile;
	observability: ObservabilityState;
	state?: 'active' | 'destroyed';
	destroyedAt?: string | null;
	destroyedReason?: string | null;
	distanceKm: number;
}
```

### Market target

```ts
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

export interface MarketSummary {
	marketId: string;
	solarSystemId: string;
	marketName: string;
	siteType: string;
	siteName: string;
	isStarterMarket?: boolean;
	spatial: SpatialState;
	trajectory?: TrajectoryDescriptor;
	distanceKm?: number;
	isDocked?: boolean;
	priceMultiplier: number;
	driftPercentPerHour: number;
	restockIntervalMinutes: number;
}
```

## Distance and View Recommendation

For current gameplay, use barycentric Cartesian distance as the default primitive.

Distance between two objects:

$$
d(a,b)=\sqrt{(x_b-x_a)^2+(y_b-y_a)^2+(z_b-z_a)^2}
$$

Range checks should use squared distance to avoid unnecessary square roots:

$$
d^2(a,b)=(x_b-x_a)^2+(y_b-y_a)^2+(z_b-z_a)^2
$$

$$
\text{withinRange}(a,b,r) \iff d^2(a,b) \le r^2
$$

This is the most expedient and maintainable approach for:

- building `ship-exterior-view` candidate sets
- fetching nearby markets
- filtering visible celestial bodies around the player ship
- later adding cone or sensor checks on top of the same relative-position primitive

## Shared Spatial Utilities

Provide one shared helper module for all gameplay and scene code.

```ts
export function assertSameSpatialFrame(a: SpatialState, b: SpatialState): void;
export function relativePositionKm(from: SpatialState, to: SpatialState): Triple;
export function distanceSquaredKm(from: SpatialState, to: SpatialState): number;
export function distanceKm(from: SpatialState, to: SpatialState): number;
export function isWithinRange(from: SpatialState, to: SpatialState, rangeKm: number): boolean;
```

Rules:

- Throw or explicitly fail if `solarSystemId` differs.
- Throw or explicitly fail if `frame` differs.
- Prefer `distanceSquaredKm` for selection and visibility checks.
- Only use `distanceKm` for presentation or when exact magnitude is required.

## Observability Rules

Object state should not be overloaded into spatial fields.

- `scanState: unscanned | scanned` controls informational detail.
- `visibility: visible | not-visible | cloaked` controls whether the observer may currently render or target the object.
- `not-visible` means the object still exists and still has a true spatial position.
- `cloaked` means the object still exists and still has a true spatial position, but the observer should treat it as hidden until game rules reveal it.

This separation supports the planned states:

- non-scanned
- scanned
- not visible
- active cloaking

## Migration Map

Hard schema cut only. No legacy aliases or fallback reads are retained.

### Ships

- `location.positionKm` -> `spatial.positionKm`
- `kinematics.reference.solarSystemId` -> `spatial.solarSystemId`
- `kinematics.reference.epochMs` -> `spatial.epochMs`
- `kinematics.position` -> removed
- `kinematics.velocity` -> `motion.velocityKmPerSec`
- `location` -> removed
- `kinematics.reference` -> removed from persisted ship shape once folded into `spatial`

### Celestial bodies

- `location.positionKm` -> `spatial.positionKm`
- `solarSystemId` -> `spatial.solarSystemId` remains duplicated only if needed for indexing; otherwise read from `spatial`
- `kinematics.velocityKmPerSec` -> `motion.velocityKmPerSec`
- `kinematics.angularVelocityRadPerSec` -> `motion.angularVelocityRadPerSec`
- `kinematics.estimatedMassKg` -> `physical.estimatedMassKg`
- `kinematics.estimatedDiameterM` -> `physical.estimatedDiameterM`
- `location` -> removed
- `kinematics` -> removed
- scan visibility fields should move into `observability`

### Markets

- `positionKm` -> `spatial.positionKm`
- `solarSystemId` -> `spatial.solarSystemId`
- `locationType` -> `siteType`
- `locationName` -> `siteName`
- `orbit` -> `trajectory.orbit`
- if orbit is the long-lived source of truth, server must also materialize `spatial` for client selection and rendering

### Scene samples and transient gameplay models

- `solarSystemLocation` -> `spatial`
- `revealedKinematics` and `capturedKinematics` should be revisited as separate observational payloads, not as alternate position carriers
- any sample type that can exist in-world should reference one authoritative `spatial`

## Consequences

Positive:

- One unambiguous answer to "where is this object?"
- Faster and simpler scene-range checks
- Cleaner server contracts for nearby-object queries
- Clear separation between location, motion, physical properties, and observability
- Lower frontend complexity because fallback normalization logic was removed once canonical spatial contracts landed

Trade-offs:

- Hard cut requires coordinated backend and frontend rollout
- Existing tests and fixtures that rely on alternate position fields must be rewritten
- Runtime-derived frames still need utility support for rendering and docking workflows

## Implementation Notes

Frontend implementation should begin by replacing fallback readers in:

- `src/app/page/game/market-hub.ts`
- `src/app/page/game/game-join.ts`
- `src/app/model/ship-list.ts`
- `src/app/model/celestial-body-list.ts`
- `src/app/model/market-list.ts`

Backend implementation should expose one authoritative spatial field on every returned entity and reject payloads that attempt to provide alternate position carriers.

## Follow-up Recommendations

1. Add a dedicated spatial utility module and route all distance calculations through it.
2. Update server message contracts after the hard-cut interfaces are implemented on both client and backend.
3. Add focused unit tests for `distanceSquaredKm`, frame mismatches, and range selection behavior.
4. Add one integration test around `ship-exterior-view` candidate filtering using canonical `spatial` inputs only.