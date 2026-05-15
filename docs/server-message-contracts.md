# Server Message Contracts

This document describes the socket message contracts currently used by the application when talking to the server. This is the canonical specification; implementation must conform to this contract.

**Contract Version**: 2.0.0 (canonical-only; no dual-key transition)  
**Last Updated**: 2026-05-15

## Scope

- Source of truth: remote server contract (https://github.com/qagwaai/solid-train/blob/main/MESSAGE_CONTRACT.md)
- These contracts are what the client must send and receive.
- All string fields are trimmed by the server.
- Player lookup is case-insensitive by `playerName`; canonical casing is returned.
- Invalid or missing session for character operations emits `invalid-session` event instead of typed response.

## Global Requirements

- Transport: Socket.IO events.
- Message shape: JSON-compatible payloads.
- Session handling: authenticated character operations require a valid `sessionKey`.
- Invalid session behavior: server emits `invalid-session` at any time; client clears session and routes back to login.
- One-response pattern: for each request event below, the client attaches one temporary response listener and unsubscribes after the first matching response.

## Canonical Data Models

### Spatial Representation

All entities in space use canonical spatial + optional motion representation:

```typescript
spatial: {
  solarSystemId: string;        // unique solar system identifier
  frame: "barycentric";         // always barycentric (center-of-mass frame)
  positionKm: { x, y, z };      // position in kilometers
  epochMs: number;              // milliseconds timestamp
}

motion: {
  velocityKmPerSec: { x, y, z }; // optional motion vector
}
```

### Distance Units

- **Spatial distances**: always in kilometers (`distanceKm`)
- **Market/drive distances**: always in astronomical units (`distanceAu`), 1 AU = 149,597,870.7 km
- **Market route descriptor**: `{ kind: "in-system" | "gate-route" | "no-route", hops?: number }`

### Item Spatial (Canonical)

Items use canonical spatial + optional motion; legacy `kinematics` is rejected:

```typescript
spatial: SpatialState | null;      // null for contained items
motion?: MotionState | null;       // optional when present
// kinematics is REJECTED with message: "use canonical item.spatial (and optional item.motion) instead"
```

### Celestial Body Lifecycle

Celestial bodies track lifecycle state and destruction:

```typescript
state: "unscanned" | "active" | "destroyed";   // defaults to "active"
destroyedAt?: string | null;                   // ISO timestamp
destroyedReason?: string | null;               // reason for destruction
debrisSeed?: number | null;                    // deterministic seed for debris
debris?: Array<{ material, rarity, quantity, itemType }>;
```

### Market Response Fields

Markets include:

```typescript
spatial: SpatialState;                    // canonical position
trajectory?: {                            // optional orbital data
  kind: "static" | "orbital-elements";
  orbit?: { anchorBodyId, semiMajorAxisKm, eccentricity, ... }
};
route?: {                                 // for location-filtered queries
  kind: "in-system" | "gate-route" | "no-route";
  hops?: number;
};
distanceAu?: number;                      // distance in AU (null for cross-system)
isStarterMarket?: boolean;
```

### Ship Drive Profile (Canonical)

Ships optionally include configured drives:

```typescript
driveProfile?: {
  id: "standard-cruise" | "rapid-transit" | "quantum-fold";
  name: string;
  rangeAu: number;
  cruiseSpeedAuPerHour: number;
  fuelCostPerAu: number;
} | null;
```

All numeric fields must be positive and finite; invalid profiles are silently dropped.

### Ship Spatial Placement (Free Bodies)

Ships are **free barycentric bodies**: they are NOT anchored to any celestial body and may
occupy any position in the solar system, like a celestial body. The `spatial` field on a
ship summary uses the same canonical `SpatialState` shape (`{ solarSystemId, frame:
'barycentric', positionKm, epochMs }`) as celestial bodies.

The client treats the following spatial values as **invalid** and will not render the ship
at that position:

- `spatial` is `null` or `undefined`
- `frame` is not `'barycentric'`
- `solarSystemId` is empty
- `positionKm.{x,y,z}` contains `NaN` or `Infinity`
- `positionKm` magnitude is less than 1 km (sun-origin / `(0,0,0)` placeholder)

Invalid spatial triggers a **lazy client-side repair**: the client re-issues a
deterministic `ship-upsert-request` seeded by `(playerName, characterId, shipId)` that
places the ship in the asteroid belt (~3.29e8–4.79e8 km from the sun). While the repair
is in flight, the viewer renders the ship at a fallback offset with the "Unknown location"
legend swatch (red, `#ef4444`).

Servers SHOULD always emit ships with valid non-origin spatial; the client repair path
exists to recover from legacy or partially seeded data.

### Locale Handling

- `register` and `login` accept optional `locale` parameter
- Normalized as lowercase base language: `en-US` → `en`, `it-IT` → `it`
- Supported: `en`, `it`; unknown/missing defaults to `en`
- `register`: persists locale as `preferredLocale`
- `login`: updates `preferredLocale` when locale is provided; preserves existing when omitted

---

## Event Catalog

| Event Name | Direction | Purpose |
| --- | --- | --- |
| `login` | client -> server | Authenticate existing player |
| `login-response` | server -> client | Return login result with sessionKey |
| `register` | client -> server | Register a new player |
| `register-response` | server -> client | Return registration result |
| `character-list-request` | client -> server | Fetch player characters |
| `character-list-response` | server -> client | Return character list with ships/missions |
| `character-add-request` | client -> server | Create a new character |
| `character-add-response` | server -> client | Return character creation result |
| `character-edit` | client -> server | Update an existing character |
| `character-edit-response` | server -> client | Return character edit result |
| `character-delete-request` | client -> server | Delete an existing character |
| `character-delete-response` | server -> client | Return character delete result |
| `game-join` | client -> server | Validate and begin game join for selected character |
| `game-join-response` | server -> client | Return game join validation/result |
| `ship-list-request` | client -> server | Fetch ship list for selected character |
| `ship-list-response` | server -> client | Return ship list with canonical spatial and driveProfile |
| `ship-upsert-request` | client -> server | Patch/update an existing ship |
| `ship-upsert-response` | server -> client | Return ship patch/update result |
| `celestial-body-upsert-request` | client -> server | Upsert scanned celestial body with canonical spatial |
| `celestial-body-upsert-response` | server -> client | Return celestial body upsert result |
| `celestial-body-list-request` | client -> server | Fetch celestial bodies within spatial radius |
| `celestial-body-list-response` | server -> client | Return celestial body list with lifecycle state |
| `add-mission-request` | client -> server | Add mission status record for selected character |
| `add-mission-response` | server -> client | Return mission add result |
| `mission-upsert-request` | client -> server | Alias for add-mission-request |
| `mission-upsert-response` | server -> client | Alias for add-mission-response |
| `list-missions-request` | client -> server | Fetch missions and statuses for selected character |
| `list-missions-response` | server -> client | Return mission list/statuses |
| `market-list-request` | client -> server | Fetch markets for current or requested solar system |
| `market-list-response` | server -> client | Return market list with canonical spatial and trajectory |
| `market-list-by-location-request` | client -> server | Fetch nearby markets by position and distanceAu radius |
| `market-list-by-location-response` | server -> client | Return nearby markets with route descriptor and docking state |
| `market-quote-request` | client -> server | Request a buy or sell price quote for a market item |
| `market-quote-response` | server -> client | Return price quote with requestId echo |
| `market-inventory-list-request` | client -> server | Fetch paginated market item catalog |
| `market-inventory-list-response` | server -> client | Return market item catalog with stock levels |
| `market-buy-request` | client -> server | Execute a buy transaction at a market |
| `market-buy-response` | server -> client | Return buy transaction result with requestId echo |
| `market-sell-request` | client -> server | Execute a sell transaction at a market |
| `market-sell-response` | server -> client | Return sell transaction result with requestId echo |
| `market-ledger-list-request` | client -> server | Fetch paginated market transaction ledger |
| `market-ledger-list-response` | server -> client | Return market transaction ledger entries |
| `item-upsert-request` | client -> server | Create or update an item with canonical spatial/motion |
| `item-upsert-response` | server -> client | Return item create/update result |
| `item-list-by-container-request` | client -> server | Fetch items by container (ship or market) |
| `item-list-by-container-response` | server -> client | Return items in a specified container |
| `item-list-by-location-request` | client -> server | Fetch deployed items within spatial radius |
| `item-list-by-location-response` | server -> client | Return deployed items within spatial radius with distanceKm |
| `launch-item-request` | client -> server | Launch a ship inventory item at a target celestial body |
| `launch-item-response` | server -> client | Return launch outcome and resolution details |
| `invalid-session` | server -> client | Notify client session is no longer valid |

---

## Market Listing

### `market-list-request` (request)

Required payload:

```json
{
  "playerName": "string",
  "sessionKey": "string",
  "solarSystemId": "string (optional)"
}
```

Client-side behavior:

- `playerName` is trimmed before sending.
- `sessionKey` is required.
- Omitting `solarSystemId` returns markets across all solar systems.

### `market-list-response` (response)

Payload:

```json
{
  "success": true,
  "message": "Market list retrieved successfully",
  "playerName": "canonical player name",
  "solarSystemId": "sol (optional)",
  "markets": [
    {
      "marketId": "sol-ceres-exchange",
      "solarSystemId": "sol",
      "marketName": "Ceres Exchange",
      "siteType": "station",
      "siteName": "Ceres Belt Trade Ring",
      "spatial": {
        "solarSystemId": "sol",
        "frame": "barycentric",
        "positionKm": { "x": 123.45, "y": -22.1, "z": 0.9 },
        "epochMs": 1776384000000
      },
      "trajectory": {
        "kind": "orbital-elements",
        "orbit": {
          "anchorBodyId": "ceres",
          "semiMajorAxisKm": 480,
          "eccentricity": 0.006,
          "inclinationDeg": 2.1,
          "longitudeOfAscendingNodeDeg": 95,
          "argumentOfPeriapsisDeg": 12,
          "meanAnomalyAtEpochDeg": 8,
          "orbitalPeriodSec": 21600,
          "epoch": "2026-05-08T00:00:00.000Z"
        }
      },
      "distanceAu": 2.766,
      "priceMultiplier": 1,
      "driftPercentPerHour": 6,
      "restockIntervalMinutes": 60
    }
  ]
}
```

**Edge cases:**
- `distanceAu` is computed from solar system barycenter `{x:0,y:0,z:0}`

### `market-list-by-location-request` (request)

Required payload:

```json
{
  "playerName": "string",
  "sessionKey": "string",
  "solarSystemId": "string",
  "positionKm": { "x": 0, "y": 0, "z": 0 },
  "distanceAu": 0.5,
  "limit": 50 (optional),
  "locationTypes": ["station"] (optional; case-insensitive match),
  "characterId": "string (optional; for docking state)",
  "shipId": "string (optional; for docking state)"
}
```

Client-side behavior:

- Used by Market Hub for local-area browsing.
- `positionKm` comes from active ship spatial state.
- `distanceAu` comes from user-selected radius (NOT `distanceKm`).
- Client clamps `distanceAu` to the active drive range before emitting the request.
- `locationTypes` is a request-time filter list (for example `['station']`).
- `characterId` and `shipId` are included when available so server can compute docking state.

### `market-list-by-location-response` (response)

Payload:

```json
{
  "success": true,
  "message": "Local market list retrieved successfully",
  "playerName": "canonical player name",
  "solarSystemId": "sol",
  "positionKm": { "x": 0, "y": 0, "z": 0 },
  "distanceAu": 0.5,
  "locationTypes": ["station"],
  "isDocked": false,
  "dockedMarketId": null,
  "markets": [
    {
      "marketId": "sol-ceres-exchange",
      "solarSystemId": "sol",
      "marketName": "Ceres Exchange",
      "siteType": "station",
      "siteName": "Ceres Belt Trade Ring",
      "isStarterMarket": true,
      "spatial": {
        "solarSystemId": "sol",
        "frame": "barycentric",
        "positionKm": { "x": 123.45, "y": -22.1, "z": 0.9 },
        "epochMs": 1776384000000
      },
      "trajectory": {
        "kind": "orbital-elements",
        "orbit": { ... }
      },
      "distanceAu": 0.032,
      "route": { "kind": "in-system" },
      "isDocked": false,
      "priceMultiplier": 1,
      "driftPercentPerHour": 6,
      "restockIntervalMinutes": 60
    },
    {
      "marketId": "ac-proxima-station",
      "solarSystemId": "alpha-centauri",
      "marketName": "Proxima Gateway Market",
      "siteType": "station",
      "siteName": "Proxima Centauri Orbital Market",
      "isStarterMarket": true,
      "spatial": { ... },
      "trajectory": { ... },
      "distanceAu": null,
      "route": { "kind": "gate-route", "hops": 1 },
      "isDocked": false,
      "priceMultiplier": 1.12,
      "driftPercentPerHour": 6,
      "restockIntervalMinutes": 60
    }
  ]
}
```

**Edge cases:**
- Invalid session emits `invalid-session` instead of market-list-by-location-response.
- Distances are server-computed from market spatial state and request `positionKm`.
- Distance is expressed as `distanceAu` (1 AU = 149,597,870.7 km).
- Results sorted: in-system markets first (nearest-first by km), then gate-route markets (fewest hops), then no-route markets.
- Cross-system markets have `distanceAu: null` since in-system distances are not applicable.
- Results are capped by `limit` after sorting.

---

## Ship List

### `ship-list-request` (request)

Required payload:

```json
{
  "playerName": "string",
  "characterId": "string",
  "sessionKey": "string"
}
```

### `ship-list-response` (response)

Payload:

```json
{
  "success": true,
  "message": "Ship list retrieved successfully",
  "playerName": "canonical player name",
  "characterId": "<character id>",
  "ships": [
    {
      "id": "<ship id>",
      "name": "<ship name>",
      "status": "active (or null)",
      "model": "Scavenger Pod",
      "tier": 1,
      "inventory": [ ... ],
      "spatial": {
        "solarSystemId": "sol",
        "frame": "barycentric",
        "positionKm": { "x": 100.5, "y": 200.3, "z": 50.1 },
        "epochMs": 1713607200000
      },
      "motion": {
        "velocityKmPerSec": { "x": 0.5, "y": -0.2, "z": 0.1 }
      },
      "launchable": true,
      "damageProfile": { ... } or null,
      "driveProfile": {
        "id": "standard-cruise",
        "name": "Standard Cruise Drive",
        "rangeAu": 10,
        "cruiseSpeedAuPerHour": 0.5,
        "fuelCostPerAu": 2.5
      } or null
    }
  ]
}
```

**Edge cases:**
- Invalid session emits `invalid-session`.
- `driveProfile` is included when the ship has a configured drive; it is `null` or absent otherwise.
- All `driveProfile` numeric fields must be positive and finite; invalid profiles are silently dropped.

---

## Item Upsert

### `item-upsert-request` (request)

Required payload (example):

```json
{
  "playerName": "string",
  "sessionKey": "string",
  "item": {
    "id": "string (optional; omit to create)",
    "itemType": "expendable-dart-drone",
    "displayName": "Expendable Dart Drone",
    "state": "deployed",
    "damageStatus": "intact",
    "container": null,
    "spatial": {
      "solarSystemId": "sol",
      "frame": "barycentric",
      "positionKm": { "x": 100, "y": 200, "z": 300 },
      "epochMs": 1713607200000
    },
    "motion": {
      "velocityKmPerSec": { "x": 1, "y": 0.5, "z": 0 }
    },
    "launchable": true
  }
}
```

**Key contract changes:**
- `spatial` and optional `motion` are now CANONICAL (required for deployed items).
- Legacy `kinematics` is EXPLICITLY REJECTED with message: "item.kinematics is no longer accepted; use canonical item.spatial (and optional item.motion) instead"
- Contained items have `spatial: null`.
- `motion` is optional and only set when item is moving.

### `item-upsert-response` (response)

Payload:

```json
{
  "success": true,
  "message": "Item created successfully",
  "playerName": "canonical player name",
  "item": {
    "id": "<uuid>",
    "itemType": "expendable-dart-drone",
    "displayName": "Expendable Dart Drone",
    "state": "contained",
    "damageStatus": "intact",
    "container": { "containerType": "ship", "containerId": "<ship id>" },
    "spatial": null,
    "motion": null,
    "owningPlayerId": "<player id>",
    "owningCharacterId": "<character id>",
    "destroyedAt": null,
    "destroyedReason": null,
    "discoveredAt": null,
    "discoveredByCharacterId": null,
    "launchable": true,
    "createdAt": "2026-05-08T...",
    "updatedAt": "2026-05-08T..."
  }
}
```

---

## Celestial Body Listing

### `celestial-body-list-request` (request)

Required payload:

```json
{
  "playerName": "string",
  "sessionKey": "string",
  "solarSystemId": "string",
  "positionKm": { "x": 0, "y": 0, "z": 0 },
  "distanceKm": 100,
  "limit": 50 (optional),
  "states": ["active", "unscanned"] (optional)
}
```

**Note:** Uses `distanceKm`, NOT `distanceAu` (unlike market queries).

### `celestial-body-list-response` (response)

Payload:

```json
{
  "success": true,
  "message": "Celestial body list retrieved successfully",
  "playerName": "canonical player name",
  "solarSystemId": "sol",
  "positionKm": { "x": 0, "y": 0, "z": 0 },
  "distanceKm": 100,
  "celestialBodies": [
    {
      "id": "<celestial body id>",
      "catalogId": "<catalog id>",
      "sourceScanId": "<scan id>",
      "createdByCharacterId": "<character id>",
      "missionId": "first-target",
      "missionInstanceId": null,
      "createdAt": "2026-05-08T...",
      "updatedAt": "2026-05-08T...",
      "spatial": {
        "solarSystemId": "sol",
        "frame": "barycentric",
        "positionKm": { "x": 1, "y": 2, "z": 3 },
        "epochMs": 1776384000000
      },
      "motion": {
        "velocityKmPerSec": { "x": 1, "y": 2, "z": 3 }
      },
      "physical": {
        "estimatedMassKg": 42000000000,
        "estimatedDiameterM": 320
      },
      "observability": {
        "visibility": "visible",
        "scanState": "scanned"
      },
      "composition": {
        "rarity": "Rare",
        "material": "Nickel-Iron",
        "textureColor": "#8df7b2"
      },
      "state": "active",
      "destroyedAt": null,
      "destroyedReason": null,
      "debrisSeed": null,
      "debris": [],
      "distanceKm": 3.74
    }
  ]
}
```

**Edge cases:**
- Invalid session emits `invalid-session`.
- By default, list includes all lifecycle states unless `states` filter is provided.
- Results are sorted nearest-first by computed `distanceKm`.
- `limit` is applied after filtering and sorting.

---

## Launch Item

### `launch-item-request` (request)

Required payload:

```json
{
  "playerName": "string",
  "sessionKey": "string",
  "characterId": "string",
  "shipId": "string",
  "targetCelestialBodyId": "string",
  "hotkey": 1,
  "itemId": "string",
  "itemType": "string"
}
```

### `launch-item-response` (response)

**Success: target-destroyed outcome**

```json
{
  "success": true,
  "message": "Launch successful: target destroyed and materials yielded",
  "playerName": "canonical player name",
  "characterId": "<character id>",
  "shipId": "<ship id>",
  "targetCelestialBodyId": "<celestial body id>",
  "hotkey": 3,
  "itemId": "<item id>",
  "itemType": "expendable-dart-drone",
  "launchedItem": {
    "id": "<item id>",
    "state": "destroyed",
    "container": null,
    "launchable": false,
    "destroyedAt": "2026-05-08T...",
    "destroyedReason": "expended-on-target:<celestial body id>",
    "updatedAt": "2026-05-08T..."
  },
  "resolution": {
    "outcome": "target-destroyed",
    "targetDestroyed": true,
    "yieldedMaterials": [
      {
        "material": "Nickel-Iron",
        "rarity": "Rare",
        "quantity": 32
      }
    ],
    "yieldedItems": [
      {
        "id": "<item id>",
        "itemType": "raw-material-nickel-iron",
        "displayName": "Nickel-Iron (Raw Material)",
        "quantity": 32,
        "state": "contained",
        "container": {
          "containerType": "ship",
          "containerId": "<ship id>"
        },
        "launchable": false
      }
    ],
    "targetCelestialBody": {
      "id": "<celestial body id>",
      "state": "destroyed",
      "destroyedAt": "2026-05-08T...",
      "destroyedReason": "impacted-by:expendable-dart-drone",
      "debrisSeed": 123456789,
      "debris": [
        {
          "material": "Nickel-Iron",
          "rarity": "Rare",
          "quantity": 32,
          "itemType": "raw-material-nickel-iron"
        }
      ]
    },
    "launchSeed": 123456789
  }
}
```

**Success: no-effect outcome**

```json
{
  "success": true,
  "message": "Launch completed with no effect for itemType: basic-mining-laser",
  "playerName": "canonical player name",
  "characterId": "<character id>",
  "shipId": "<ship id>",
  "targetCelestialBodyId": "<celestial body id>",
  "hotkey": 2,
  "itemId": "<item id>",
  "itemType": "basic-mining-laser",
  "launchedItem": {
    "id": "<item id>",
    "state": "destroyed",
    "container": null,
    "launchable": false
  },
  "resolution": {
    "outcome": "no-effect",
    "targetDestroyed": false,
    "yieldedMaterials": [],
    "yieldedItems": [],
    "launchSeed": 123456789
  }
}
```

**Yield Quantity Calculation:**
```
baseFromMass = max(1, round(estimatedMassKg / 5,000,000,000))
quantity = clamp(baseFromMass * 2, 1, 100)
```

**Edge cases:**
- Invalid session emits `invalid-session`.
- The launched item is always consumed, including `no-effect` outcomes.
- `launchSeed` is deterministic for same inputs.
- Yielded materials persisted as quantity-based item records added to ship inventory.
- Target state transitions to `destroyed`; `destroyedAt` and `destroyedReason` are server-set.

---

## Notes For Client Implementers

- Treat `invalid-session` as a top-level auth/session failure signal; clear session and route to login.
- Use returned `playerName` as the canonical casing from server state when present.
- For login failures, branch on `reason` field in addition to `message`.
- **Item spatial/motion is CANONICAL**; reject requests with legacy `kinematics`.
- **Market distances are in AU**; clamp `distanceAu` to drive range before sending market-list-by-location-request.
- **Celestial body distances are in km** (spherical radius query).
- Market responses include `trajectory` for orbital mechanics; `route` for pathfinding context.
- Ship responses include optional `driveProfile` when a drive is configured.



| Event Name | Direction | Purpose |
| --- | --- | --- |
| `login` | client -> server | Authenticate existing player |
| `login-response` | server -> client | Return login result |
| `register` | client -> server | Register a new player |
| `register-response` | server -> client | Return registration result |
| `character-list-request` | client -> server | Fetch player characters |
| `character-list-response` | server -> client | Return character list |
| `character-add-request` | client -> server | Create a new character |
| `character-add-response` | server -> client | Return character creation result |
| `character-edit` | client -> server | Update an existing character |
| `character-edit-response` | server -> client | Return character edit result |
| `character-delete-request` | client -> server | Delete an existing character |
| `character-delete-response` | server -> client | Return character delete result |
| `game-join` | client -> server | Validate and begin game join for selected character |
| `game-join-response` | server -> client | Return game join validation/result |
| `ship-list-request` | client -> server | Fetch ship list for selected character |
| `ship-list-response` | server -> client | Return ship list for selected character |
| `ship-upsert-request` | client -> server | Patch/update an existing ship owned by player+character |
| `ship-upsert-response` | server -> client | Return ship patch/update result |
| `drone-list-request` | client -> server | Fetch drone list for selected character |
| `drone-list-response` | server -> client | Return drone list for selected character |
| `drone-upsert-request` | client -> server | Upsert a drone record owned by player+character |
| `drone-upsert-response` | server -> client | Return drone upsert result |
| `celestial-body-upsert-request` | client -> server | Upsert scanned celestial body record under a solar system |
| `celestial-body-upsert-response` | server -> client | Return celestial body upsert result |
| `add-mission-request` | client -> server | Add mission status record for selected character |
| `add-mission-response` | server -> client | Return mission add result |
| `mission-upsert-request` | client -> server | Upsert mission status for selected character (logical contract; currently sent as `add-mission-request`) |
| `mission-upsert-response` | server -> client | Return mission upsert result (logical contract; currently received as `add-mission-response`) |
| `list-missions-request` | client -> server | Fetch missions and statuses for selected character |
| `list-missions-response` | server -> client | Return mission list/statuses |
| `market-list-request` | client -> server | Fetch markets for current or requested solar system |
| `market-list-response` | server -> client | Return market list and metadata |
| `market-list-by-location-request` | client -> server | Fetch nearby markets by position and radius |
| `market-list-by-location-response` | server -> client | Return nearby markets with authoritative distance and docking state |
| `market-quote-request` | client -> server | Request a buy or sell price quote for a market item |
| `market-quote-response` | server -> client | Return price quote for a market item |
| `market-inventory-list-request` | client -> server | Fetch paginated market item catalog |
| `market-inventory-list-response` | server -> client | Return market item catalog with stock levels |
| `market-buy-request` | client -> server | Execute a buy transaction at a market |
| `market-buy-response` | server -> client | Return buy transaction result |
| `market-sell-request` | client -> server | Execute a sell transaction at a market |
| `market-sell-response` | server -> client | Return sell transaction result |
| `market-ledger-list-request` | client -> server | Fetch paginated market transaction ledger |
| `market-ledger-list-response` | server -> client | Return market transaction ledger entries |
| `item-upsert-request` | client -> server | Create or update an item record |
| `item-upsert-response` | server -> client | Return item create/update result |
| `item-list-by-container-request` | client -> server | Fetch items by container (ship or market) |
| `item-list-by-container-response` | server -> client | Return items in a specified container |
| `item-list-by-location-request` | client -> server | Fetch deployed items within spatial radius |
| `item-list-by-location-response` | server -> client | Return deployed items within spatial radius |
| `launch-item-request` | client -> server | Launch a ship inventory item at a target celestial body |
| `launch-item-response` | server -> client | Return launch outcome and resolution details |
| `invalid-session` | server -> client | Notify client session is no longer valid |

---

## Launch Item

### `launch-item-request` (request)

Required payload:

```json
{
  "playerName": "string",
  "sessionKey": "string",
  "characterId": "string",
  "shipId": "string",
  "targetCelestialBodyId": "string",
  "hotkey": 1,
  "itemId": "string",
  "itemType": "string"
}
```

### `launch-item-response` (response)

Required payload fields on success include request echo fields plus:

- `launchedItem`
- `resolution.outcome` (`target-destroyed` | `no-effect`)
- `resolution.targetDestroyed`
- `resolution.yieldedMaterials`
- `resolution.yieldedItems`
- `resolution.launchSeed`
- `resolution.targetCelestialBody` when outcome is `target-destroyed`

Client behavior decision:

- The client allows rapid launches (no single in-flight lock).
- Responses are processed from a shared `launch-item-response` listener.
- After each successful response, the client refetches `ship-list-request` and `celestial-body-list-request` to reconcile authoritative inventory and asteroid state.

---

## Login

### `login` (request)

Required payload:

```json
{
  "playerName": "string",
  "password": "string"
}
```

Client-side field constraints:

- `playerName`: required, length 3..20.
- `password`: required, minimum length 8.

Server requirements:

- Validate presence and type for both fields.
- Authenticate against stored player credentials.
- Return `login-response` for every `login` request.

### `login-response` (response)

Payload:

```json
{
  "success": true,
  "message": "string",
  "reason": "PLAYER_NOT_REGISTERED | PASSWORD_MISMATCH | UNKNOWN (optional)",
  "playerId": "string (optional)",
  "sessionKey": "string (optional)"
}
```

Edge cases:

- If `success` is `true` and `sessionKey` is omitted, login still appears successful in UI but later authenticated operations can fail. Prefer always returning `sessionKey` on success.
- For failures, use stable `reason` values so UI branches correctly:
  - `PLAYER_NOT_REGISTERED`: UI suggests registration.
  - `PASSWORD_MISMATCH`: UI does not suggest registration.

---

## Registration

### `register` (request)

Required payload:

```json
{
  "playerName": "string",
  "email": "string",
  "password": "string"
}
```

Client-side field constraints:

- `playerName`: required, length 3..20.
- `email`: required, must pass email validator.
- `password`: required, minimum length 8.
- Client confirms password separately before emitting `register`.

Server requirements:

- Validate field presence/types and reject malformed input.
- Enforce uniqueness constraints (player name and/or email).
- Return `register-response` for every `register` request.

### `register-response` (response)

Payload:

```json
{
  "success": true,
  "message": "string",
  "playerId": "string (optional)",
  "sessionKey": "string (optional)"
}
```

Edge cases:

- If `success` is `true` without `sessionKey`, immediate navigation succeeds but next authenticated request may fail. Prefer returning `sessionKey` on success.
- On failure, return clear `message` values because UI displays message directly.

---

## Character Listing

### `character-list-request` (request)

Required payload:

```json
{
  "playerName": "string",
  "sessionKey": "string"
}
```

Client-side behavior:

- `playerName` is trimmed before sending.
- If trimmed `playerName` is empty, request is not sent.

Server requirements:

- Validate `sessionKey` and player ownership.
- Return `character-list-response`.
- If session is invalid/expired, emit `invalid-session`.

### `character-list-response` (response)

Payload:

```json
{
  "success": true,
  "message": "string",
  "playerName": "string",
  "characters": [
    {
      "id": "string",
      "characterName": "string",
      "level": "number (optional)",
      "createdAt": "string (optional)",
      "credits": "number",
      "creditLedger": [
        {
          "type": "put | take",
          "amount": "number",
          "description": "string",
          "timestamp": "string (ISO 8601)",
          "referenceId": "string | null"
        }
      ]
    }
  ]
}
```

Edge cases:

- `characters` should always be an array; client falls back to `[]` if undefined.
- Keep `id` stable and unique; it is used for edit/delete targeting.
- If `success` is `false`, include a user-safe `message`.
- `credits` is a server-computed value: `sum(put.amount) - sum(take.amount)` across `creditLedger`.
- `creditLedger` defaults to `[]` when a character has no transactions.
- Client treats missing `credits` as `0` and missing `creditLedger` as `[]`.

---

## Market Listing

### `market-list-request` (request)

Required payload:

```json
{
  "playerName": "string",
  "sessionKey": "string",
  "solarSystemId": "string (optional)"
}
```

Client-side behavior:

- `playerName` is trimmed before sending.
- `sessionKey` is required.
- The market hub scopes requests to the active ship solar system when available.

### `market-list-by-location-request` (request)

Required payload:

```json
{
  "playerName": "string",
  "sessionKey": "string",
  "solarSystemId": "string",
  "positionKm": { "x": 0, "y": 0, "z": 0 },
  "distanceAu": 0.5,
  "limit": 50,
  "locationTypes": ["station"],
  "characterId": "string (optional)",
  "shipId": "string (optional)"
}
```

Client-side behavior:

- Used by Market Hub for local-area browsing.
- `positionKm` comes from active ship spatial state.
- `distanceAu` comes from user-selected radius.
- Client clamps `distanceAu` to the active drive range before emitting the request.
- `locationTypes` is a request-time filter list (for example `['station']`).
- `characterId` and `shipId` are included when available so server can compute docking state.

### `market-list-by-location-response` (response)

Payload:

```json
{
  "success": true,
  "message": "Local market list retrieved successfully",
  "playerName": "string",
  "solarSystemId": "sol",
  "positionKm": { "x": 0, "y": 0, "z": 0 },
  "distanceAu": 0.5,
  "locationTypes": ["station"],
  "isDocked": false,
  "dockedMarketId": null,
  "markets": [
    {
      "marketId": "sol-ceres-exchange",
      "solarSystemId": "sol",
      "marketName": "Ceres Exchange",
      "siteType": "station",
      "siteName": "Ceres Belt Trade Ring",
      "route": {
        "kind": "in-system | gate-route | no-route",
        "hops": 0
      },
      "isStarterMarket": true,
      "spatial": {
        "solarSystemId": "sol",
        "frame": "barycentric",
        "positionKm": { "x": 123.45, "y": -22.1, "z": 0.9 },
        "epochMs": 1775000000000
      },
      "distanceAu": 2.3,
      "isDocked": false,
      "priceMultiplier": 1,
      "driftPercentPerHour": 6,
      "restockIntervalMinutes": 60
    }
  ]
}
```

### `market-list-response` (response)

Payload:

```json
{
  "success": true,
  "message": "Market list retrieved successfully",
  "playerName": "string",
  "solarSystemId": "sol",
  "markets": [
    {
      "marketId": "sol-ceres-exchange",
      "solarSystemId": "sol",
      "marketName": "Ceres Exchange",
      "siteType": "station",
      "siteName": "Ceres Belt Trade Ring",
      "spatial": {
        "solarSystemId": "sol",
        "frame": "barycentric",
        "positionKm": { "x": 123.45, "y": -22.1, "z": 0.9 },
        "epochMs": 1775000000000
      },
      "distanceAu": 2.766,
      "priceMultiplier": 1,
      "driftPercentPerHour": 6,
      "restockIntervalMinutes": 60
    }
  ]
}
```

Edge cases:

- Invalid session emits `invalid-session` instead of `market-list-response` or `market-list-by-location-response`.
- If `solarSystemId` is omitted, server may return markets across all solar systems.
- Distances in `markets[].distanceAu` are server-authoritative and nearest-first.
- Optional `markets[].route` can be supplied by server to hint cross-system routing (`kind` plus optional hop count).
- Docking state is server-authoritative via top-level `isDocked` / `dockedMarketId` and per-market `isDocked`.
- Market browsing is always allowed, but transact actions are disabled unless ship is docked at the specific market.
- Market payloads should use `siteType` / `siteName` and `spatial` (legacy `locationType` / `locationName` fields are deprecated).

---

## Character Create

### `character-add-request` (request)

Required payload:

```json
{
  "playerName": "string",
  "characterName": "string",
  "sessionKey": "string"
}
```

Client-side field constraints:

- `characterName`: required, length 2..24.
- `playerName` must be non-empty after trim.

Server requirements:

- Validate `sessionKey` and ownership.
- Validate character name policy (length, charset, uniqueness rules).
- Return `character-add-response`.

### `character-add-response` (response)

Payload:

```json
{
  "success": true,
  "message": "string",
  "playerName": "string",
  "characterName": "string (optional)",
  "characterId": "string (optional)"
}
```

Edge cases:

- On success, include `characterId` when possible to support future client-side optimistic updates.
- On failure, include actionable `message` (for example duplicate name).

---

## Character Edit

### `character-edit` (request)

Required payload:

```json
{
  "characterId": "string",
  "playerName": "string",
  "characterName": "string",
  "sessionKey": "string"
}
```

Client-side requirements:

- Sent only when setup page is in edit mode.
- Client refuses to emit if `characterId` is missing.
- Same character name validation as create mode.

Server requirements:

- Verify `characterId` exists and belongs to `playerName` in current session.
- Apply rename/update semantics for the existing character record.
- Return `character-edit-response`.

### `character-edit-response` (response)

Payload:

```json
{
  "success": true,
  "message": "string",
  "playerName": "string",
  "characterId": "string",
  "characterName": "string (optional)"
}
```

Edge cases:

- If `characterId` is not found or does not belong to the player, return `success: false` with explicit message.
- If name conflicts with another character, return `success: false` and message indicating conflict.

---

## Character Delete

### `character-delete-request` (request)

Required payload:

```json
{
  "playerName": "string",
  "characterId": "string",
  "characterName": "string (optional)",
  "sessionKey": "string"
}
```

Client-side behavior:

- Request is sent only after explicit user confirmation.
- `characterName` is included as optional metadata.

Server requirements:

- Validate session and ownership.
- Delete by `characterId` (do not rely on `characterName`).
- Return `character-delete-response`.

### `character-delete-response` (response)

Payload:

```json
{
  "success": true,
  "message": "string",
  "playerName": "string",
  "characterId": "string (optional)"
}
```

Edge cases:

- If already deleted, choose deterministic behavior:
  - Either idempotent success with message, or
  - failure with explicit not-found message.
- Returning `characterId` helps client reconciliation in multi-tab scenarios.

---

## Game Join

### `game-join` (request)

Required payload:

```json
{
  "playerName": "string",
  "characterId": "string",
  "sessionKey": "string"
}
```

Client-side behavior:

- Emitted from Character List when user clicks `Join Game`.
- Client requires non-empty `playerName` and `characterId` before emitting.
- Client also navigates to game-join page with selected character state for display context.

Server requirements:

- Validate `sessionKey` and ownership of `characterId` under `playerName`.
- Reject joins for unknown, deleted, or unauthorized characters.
- Return `game-join-response` for each `game-join` request.
- Emit `invalid-session` when session is missing/expired/revoked.

### `game-join-response` (response)

Payload:

```json
{
  "success": true,
  "message": "string",
  "playerName": "string",
  "characterId": "string"
}
```

Edge cases:

- If `characterId` does not belong to `playerName`, return `success: false` with a non-sensitive message.
- If character record exists but is not currently joinable (for example locked/inactive), return `success: false` with a clear reason.
- If client sends stale character IDs from older list state, return deterministic not-found/not-joinable error.

---

## Ship List

### `ship-list-request` (request)

Required payload:

```json
{
  "playerName": "string",
  "characterId": "string",
  "sessionKey": "string"
}
```

Client-side behavior:

- Emitted from game-join and ship-hangar contexts for the currently selected character.
- Client requires non-empty `playerName`, `characterId`, and `sessionKey` before emitting.

Server requirements:

- Validate `sessionKey` and ensure `characterId` belongs to `playerName`.
- Return `ship-list-response` for every `ship-list-request`.
- Emit `invalid-session` for expired/revoked/invalid sessions.

### `ship-list-response` (response)

Payload:

```json
{
  "success": true,
  "message": "string",
  "playerName": "string",
  "characterId": "string",
  "ships": [
    {
      "id": "string",
      "name": "string",
      "status": "string (optional)",
      "model": "string",
      "tier": 1,
      "driveProfile": {
        "id": "standard-cruise | rapid-transit | quantum-fold",
        "name": "string",
        "rangeAu": 0.5,
        "cruiseSpeedAuPerHour": 0.3,
        "fuelCostPerAu": 1
      },
      "inventory": ["Expendable Dart Drone"],
      "spatial": {
        "solarSystemId": "sol",
        "frame": "barycentric",
        "positionKm": { "x": 0, "y": 0, "z": 0 },
        "epochMs": 0
      },
      "motion": {
        "velocityKmPerSec": { "x": 0, "y": 0, "z": 0 },
        "angularVelocityRadPerSec": { "x": 0, "y": 0, "z": 0 }
      },
      "observability": {
        "visibility": "visible",
        "scanState": "scanned"
      }
    }
  ]
}
```

Edge cases:

- If `inventory` is missing on legacy `Scavenger Pod` records, server should backfill with `["Expendable Dart Drone"]` in response payloads.
- For non-starter ship models, default `inventory` should be `[]` when not set.
- Returned `ships` should always be an array.
- `driveProfile` is optional; when omitted, clients may apply local default drive heuristics.

---

## Ship Upsert

### `ship-upsert-request` (request)

Required payload:

```json
{
  "playerName": "string",
  "characterId": "string",
  "sessionKey": "string",
  "ship": {
    "id": "string",
    "model": "string (optional patch field)",
    "tier": "number 1..10 (optional patch field)",
    "inventory": ["string", "... (optional patch field)"],
    "spatial": {
      "solarSystemId": "sol",
      "frame": "barycentric",
      "positionKm": { "x": 0, "y": 0, "z": 0 },
      "epochMs": 0
    },
    "motion": {
      "velocityKmPerSec": { "x": 0, "y": 0, "z": 0 },
      "angularVelocityRadPerSec": { "x": 0, "y": 0, "z": 0 }
    },
    "observability": {
      "visibility": "visible",
      "scanState": "unscanned"
    }
  }
}
```

Client-side behavior:

- Upsert is patch-style: only provided fields mutate server state.
- Omitting `inventory` preserves existing inventory.

Server requirements:

- Validate `sessionKey` and ownership (`playerName` + `characterId` + existing `ship.id`).
- Treat `model`, `tier`, `inventory`, `spatial`, `motion`, and `observability` as optional patch fields.
- Return `ship-upsert-response` for every request.

### `ship-upsert-response` (response)

Payload:

```json
{
  "success": true,
  "message": "string",
  "playerName": "string",
  "characterId": "string",
  "ship": {
    "id": "string",
    "name": "string",
    "model": "string",
    "tier": 1,
    "inventory": ["Expendable Dart Drone"],
    "spatial": {
      "solarSystemId": "sol",
      "frame": "barycentric",
      "positionKm": { "x": 0, "y": 0, "z": 0 },
      "epochMs": 0
    },
    "motion": {
      "velocityKmPerSec": { "x": 0, "y": 0, "z": 0 },
      "angularVelocityRadPerSec": { "x": 0, "y": 0, "z": 0 }
    },
    "observability": {
      "visibility": "visible",
      "scanState": "scanned"
    }
  }
}
```

Edge cases:

- If `inventory` is omitted in request, response should include persisted inventory unchanged.
- If ship is a `Scavenger Pod` with missing inventory in storage, response should include backfilled `["Expendable Dart Drone"]`.
- Invalid session emits `invalid-session`.

---

## Drone List

### `drone-list-request` (request)

Required payload:

```json
{
  "playerName": "string",
  "characterId": "string",
  "sessionKey": "string"
}
```

Client-side behavior:

- Emitted immediately when game-join page renders (once socket is connected).
- Request targets the selected character context used to enter game-join.
- Client requires non-empty `playerName` and `characterId` before emitting.

Server requirements:

- Validate `sessionKey` and ensure `characterId` belongs to `playerName`.
- Return `drone-list-response` for every `drone-list-request`.
- Emit `invalid-session` for expired/revoked/invalid sessions.

### `drone-list-response` (response)

Payload:

```json
{
  "success": true,
  "message": "string",
  "playerName": "string",
  "characterId": "string",
  "drones": [
    {
      "id": "string",
      "name": "string",
      "status": "string (optional)",
      "model": "string (optional)",
      "spatial": {
        "solarSystemId": "string",
        "frame": "barycentric",
        "positionKm": { "x": 0, "y": 0, "z": 0 },
        "epochMs": 0
      },
      "motion": {
        "velocityKmPerSec": { "x": 0, "y": 0, "z": 0 }
      },
      "observability": {
        "visibility": "visible",
        "scanState": "scanned"
      }
    }
  ]
}
```

Notes:

- `spatial` is required for drone records consumed by the client.
- `motion.velocityKmPerSec` carries direction plus speed magnitude.

Edge cases:

- If the character is valid but has no drones, return `success: true` with `drones: []`.
- If `characterId` is stale or unauthorized, return `success: false` with user-safe message.
- `drones` should always be present as an array to avoid ambiguous UI state.

---

## Drone Upsert

### `drone-upsert-request` (request)

Required payload:

```json
{
  "playerName": "string",
  "characterId": "string",
  "sessionKey": "string",
  "drone": {
    "id": "string",
    "spatial": {
      "solarSystemId": "sol",
      "frame": "barycentric",
      "positionKm": { "x": 0, "y": 0, "z": 0 },
      "epochMs": 0
    },
    "motion": {
      "velocityKmPerSec": { "x": 0, "y": 0, "z": 0 }
    },
    "observability": {
      "visibility": "visible",
      "scanState": "scanned"
    }
  }
}
```

Client-side behavior:

- Client first requests `drone-list` and then upserts by existing starter drone `id` (contract requires existing drone ownership).
- Upsert payload mutates spatial/motion/observability for that existing drone.

Server requirements:

- Validate `sessionKey` and ownership (`playerName` + `characterId`).
- Upsert by stable drone id, preserving ownership semantics.
- Return `drone-upsert-response` for every request.

### `drone-upsert-response` (response)

Payload:

```json
{
  "success": true,
  "message": "string",
  "playerName": "string",
  "characterId": "string",
  "drone": {
    "id": "string",
    "droneName": "string (optional)",
    "spatial": {
      "solarSystemId": "string",
      "frame": "barycentric",
      "positionKm": { "x": 0, "y": 0, "z": 0 },
      "epochMs": 0
    },
    "motion": {
      "velocityKmPerSec": { "x": 0, "y": 0, "z": 0 }
    },
    "observability": {
      "visibility": "visible",
      "scanState": "scanned"
    }
  }
}
```

---

## Mission Add

### `add-mission-request` (request)

Required payload:

```json
{
  "playerName": "string",
  "characterId": "string",
  "missionId": "string",
  "sessionKey": "string",
  "status": "available | started | in-progress | failed | completed | locked | abandoned | paused | turned-in (optional)",
  "statusDetail": "string (optional)",
  "requestId": "string (optional, echoed in response)"
}
```

Canonical mission catalog IDs:

- `first-target`
- `m-01`, `m-02`, `m-03`, `m-04`, `m-05`
- `sq-01`, `sq-02`, `sq-03`, `sq-04`, `sq-system-survey-01`

Prerequisite graph (server auto-unlocks dependents on `completed`/`turned-in`):

- `first-target` → `m-01`, `sq-02`, `sq-03`, `sq-system-survey-01`
- `m-01` → `m-02`
- `m-02` → `m-03`, `sq-01`
- `m-03` → `m-04`
- `m-04` → `m-05`, `sq-04`

Client-side behavior:

- Use this event to create or upsert a mission status entry for one character.
- If `status` is omitted, server should default to `available`.
- Include `requestId` to correlate responses and avoid cross-response matching ambiguity.

Server requirements:

- Validate `sessionKey` and ownership of `characterId` for `playerName`.
- Validate `missionId` against server mission catalog.
- Accept canonical statuses and optionally server-defined extensions.
- Return `add-mission-response` for each request.
- Emit `invalid-session` for expired/revoked/invalid sessions.

### `add-mission-response` (response)

Payload:

```json
{
  "success": true,
  "message": "string",
  "playerName": "string",
  "characterId": "string",
  "requestId": "string (optional, echoed when provided)",
  "mission": {
    "missionId": "string",
    "status": "string",
    "startedAt": "string (optional)",
    "inProgressAt": "string (optional)",
    "failedAt": "string (optional)",
    "completedAt": "string (optional)",
    "updatedAt": "string (optional)",
    "failureReason": "string (optional)",
    "statusDetail": "string (optional)"
  }
}
```

Edge cases:

- If mission already exists for the character, prefer deterministic upsert semantics and return updated `mission`.
- If mission is unknown, return `success: false` with a safe message.
- If a status transition is invalid by server rules, return `success: false` with transition guidance.

---

## Celestial Body Upsert

### `celestial-body-upsert-request` (request)

Required payload:

```json
{
  "sessionKey": "string",
  "playerName": "string",
  "createdByCharacterId": "string",
  "celestialBody": {
    "id": "string",
    "catalogId": "string",
    "sourceScanId": "string",
    "createdByCharacterId": "string",
    "bodyType": "asteroid (optional)",
    "displayName": "string (optional)",
    "clusterId": "string (optional)",
    "clusterCenterKm": { "x": 0, "y": 0, "z": 0 },
    "localOffsetKm": { "x": 0, "y": 0, "z": 0 },
    "distanceFromClusterCenterKm": 0,
    "createdAt": "ISO-8601 string",
    "updatedAt": "ISO-8601 string",
    "spatial": {
      "solarSystemId": "sol | string",
      "frame": "barycentric",
      "positionKm": { "x": 0, "y": 0, "z": 0 },
      "epochMs": 0
    },
    "motion": {
      "velocityKmPerSec": { "x": 0, "y": 0, "z": 0 },
      "angularVelocityRadPerSec": { "x": 0, "y": 0, "z": 0 }
    },
    "physical": {
      "estimatedMassKg": 0,
      "estimatedDiameterM": 0
    },
    "physicalCatalog": {
      "estimatedMassKg": 0,
      "estimatedDiameterM": 0,
      "radiusKm": 0
    },
    "visualization": {
      "colorHex": "#RRGGBB (optional)",
      "textureKey": "string | null (optional)"
    },
    "observability": {
      "visibility": "visible | not-visible | cloaked",
      "scanState": "unscanned | scanned"
    },
    "state": "active | destroyed",
    "composition": {
      "rarity": "Common | Uncommon | Rare | Exotic",
      "material": "string",
      "textureColor": "string"
    }
  }
}
```

Client-side behavior:

- Emitted immediately after a successful asteroid scan completes.
- Includes `playerName` as request context for audit/logging, but ownership association remains character-scoped.
- Uses `createdByCharacterId` both at top-level and inside `celestialBody` for compatibility with backend parsers.

Server requirements:

- Validate `sessionKey` and that `createdByCharacterId` belongs to the authenticated session context.
- Reject legacy `location`/`kinematics` fields with a clear validation error.
- Upsert by stable identity (`id` and/or `sourceScanId` + `spatial.solarSystemId`) with deterministic behavior.
- Preserve `createdAt` for existing records and update `updatedAt` on every accepted mutation.
- Return `celestial-body-upsert-response` for every request.

### `celestial-body-upsert-response` (response)

Payload:

```json
{
  "success": true,
  "message": "string",
  "celestialBody": {
    "id": "string",
    "catalogId": "string",
    "sourceScanId": "string",
    "createdByCharacterId": "string",
    "bodyType": "asteroid (optional)",
    "displayName": "string (optional)",
    "clusterId": "string (optional)",
    "clusterCenterKm": { "x": 0, "y": 0, "z": 0 },
    "localOffsetKm": { "x": 0, "y": 0, "z": 0 },
    "distanceFromClusterCenterKm": 0,
    "createdAt": "ISO-8601 string",
    "updatedAt": "ISO-8601 string",
    "spatial": {
      "solarSystemId": "string",
      "frame": "barycentric",
      "positionKm": { "x": 0, "y": 0, "z": 0 },
      "epochMs": 0
    },
    "motion": {
      "velocityKmPerSec": { "x": 0, "y": 0, "z": 0 },
      "angularVelocityRadPerSec": { "x": 0, "y": 0, "z": 0 },
    },
    "physical": {
      "estimatedMassKg": 0,
      "estimatedDiameterM": 0
    },
    "physicalCatalog": {
      "estimatedMassKg": 0,
      "estimatedDiameterM": 0,
      "radiusKm": 0
    },
    "visualization": {
      "colorHex": "#RRGGBB (optional)",
      "textureKey": "string | null (optional)"
    },
    "observability": {
      "visibility": "visible",
      "scanState": "scanned"
    },
    "state": "active | destroyed"
  }
}
```

Edge cases:

- If the same source scan is sent repeatedly, return deterministic idempotent success with the authoritative stored record.
- If `spatial.solarSystemId` is unknown, return `success: false` with a user-safe message.
- If timestamps are malformed, either normalize server-side or reject with explicit validation guidance.

---

## Mission Upsert

`mission-upsert` is the explicit client-side contract for status updates and status-aware creation.

Compatibility mapping (current implementation):

- `mission-upsert-request` maps to wire event `add-mission-request`.
- `mission-upsert-response` maps to wire event `add-mission-response`.

### `mission-upsert-request` (request)

Required payload:

```json
{
  "playerName": "string",
  "characterId": "string",
  "missionId": "string",
  "sessionKey": "string",
  "status": "available | started | in-progress | failed | completed | locked | abandoned | paused | turned-in",
  "statusDetail": "string (optional)",
  "requestId": "string (optional, echoed in response)"
}
```

Client-side behavior:

- Use this contract when a flow must explicitly set mission status (for example transitioning `first-target` to `started`).
- Unlike Mission Add, `status` is required for upsert requests.
- Include `requestId` to correlate responses and avoid cross-response matching ambiguity.

Server requirements:

- Validate `sessionKey` and ownership of `characterId` for `playerName`.
- Validate `missionId` against server mission catalog.
- Apply deterministic upsert semantics: create mission if missing or update existing mission status if present.
- Return `mission-upsert-response` (currently emitted as `add-mission-response`) for each request.
- Emit `invalid-session` for expired/revoked/invalid sessions.

### `mission-upsert-response` (response)

Payload:

```json
{
  "success": true,
  "message": "string",
  "playerName": "string",
  "characterId": "string",
  "requestId": "string (optional, echoed when provided)",
  "mission": {
    "missionId": "string",
    "status": "string",
    "startedAt": "string (optional)",
    "inProgressAt": "string (optional)",
    "failedAt": "string (optional)",
    "completedAt": "string (optional)",
    "updatedAt": "string (optional)",
    "failureReason": "string (optional)",
    "statusDetail": "string (optional)"
  }
}
```

Edge cases:

- If mission does not exist, server should create then return the created/updated mission snapshot.
- If a status transition is invalid by server rules, return `success: false` with transition guidance.
- Return the authoritative stored status/timestamps in `mission` after transition.

---

## Mission List

### `list-missions-request` (request)

Required payload:

```json
{
  "playerName": "string",
  "characterId": "string",
  "sessionKey": "string",
  "statuses": ["available", "started", "in-progress", "failed", "completed"]
}
```

Client-side behavior:

- Request all character missions when entering progression or mission views.
- `statuses` is optional and can be used as a server-side filter.

Server requirements:

- Validate `sessionKey` and ownership of `characterId`.
- Return `list-missions-response` for every `list-missions-request`.
- Emit `invalid-session` for invalid session context.

### `list-missions-response` (response)

Payload:

```json
{
  "success": true,
  "message": "string",
  "playerName": "string",
  "characterId": "string",
  "missions": [
    {
      "missionId": "string",
      "status": "string",
      "startedAt": "string (optional)",
      "inProgressAt": "string (optional)",
      "failedAt": "string (optional)",
      "completedAt": "string (optional)",
      "updatedAt": "string (optional)",
      "failureReason": "string (optional)",
      "statusDetail": "string (optional)"
    }
  ]
}
```

Edge cases:

- If the character has no missions yet, return `success: true` and `missions: []`.
- `missions` should always be present as an array.
- If filters are applied, return only matching statuses.

---

## Mission Locale Content

Client mission narrative text should be sourced from locale content rather than hard-coded in pages.

Canonical mission IDs include:

- `first-target`
- `m-01`, `m-02`, `m-03`, `m-04`, `m-05`
- `sq-01`, `sq-02`, `sq-03`, `sq-04`, `sq-system-survey-01`

English mission content:

- Title: `The First Mission: Your First Target`
- Briefing line 1: `Yes, the player starts by targeting an asteroid, but with a twist: The Dart Maneuver.`
- Briefing line 2: `Instead of a mining laser, you are given a single Expendable "Dart" Drone. Since you have no "Permanent" drones yet, you must use your own ship's HUD to manually lock onto a nearby Level 1 Silicate Asteroid.`
- Gameplay loop title: `The Gameplay Loop of the Tutorial`
- Step 1: `Scanning: You move your crosshair over a cluster of rocks. The HUD identifies a "High-Iron Trace."`
- Step 2: `Launching: You press the ignition. The Expendable "Dart" (like the one you saw in the hangar) screams out of your launch tube.`
- Step 3: `The Impact: The Dart does not mine - it impacts. It slams into the asteroid, shattering it into three manageable chunks.`
- Step 4: `The Manual Retrieval: Without a Tug Drone, you must manually pilot your Scavenger Pod to "catch" the floating debris in your gravity scoop.`

English side mission content (post-tutorial parallel unlock):

- Mission ID: `sq-system-survey-01`
- Title: `Local Survey Contract`
- Briefing line 1: `Station control flags your ship for a paid reconnaissance sweep after your first-target success.`
- Briefing line 2: `Map nearby bodies, check in at a local market, and uplink telemetry to prove this system is chart-ready.`
- Gameplay loop title: `Side Quest Objectives`
- Step 1: `Scan three distinct bodies in the current system.`
- Step 2: `Reach one market or outpost and establish contact.`
- Step 3: `Upload telemetry to complete the survey contract.`

---

## Invalid Session

### `invalid-session` (server event)

Payload:

```json
{
  "message": "string"
}
```

Client behavior:

- Clears local session key.
- Navigates to login view.

Server recommendations:

- Emit when session key is missing, expired, revoked, malformed, or mismatched to player context.
- Keep `message` safe for end users (avoid leaking internals).

---

## Credit Ledger

### Overview

Each character carries a `creditLedger` array and a computed `credits` summary field. Both are returned as part of `character-list-response`.

### `CreditLedgerEntry` shape

```json
{
  "type": "put | take",
  "amount": "number (positive)",
  "description": "string",
  "timestamp": "string (ISO 8601)",
  "referenceId": "string | null"
}
```

Field semantics:

- `type`: `"put"` = credits earned/deposited; `"take"` = credits spent/withdrawn.
- `amount`: always a positive number regardless of direction.
- `description`: human-readable reason for the transaction (for example `"Starting credits"`, `"Mission reward"`).
- `timestamp`: ISO 8601 timestamp of when the transaction occurred.
- `referenceId`: optional link to a source event (mission id, market item, etc.); `null` when not applicable.

### `credits` field

- Computed by the server as `sum(put.amount) - sum(take.amount)` across the character's full `creditLedger`.
- Never stored independently; recalculated on every `normalizeCharacter` call.
- Characters with no ledger entries have `credits: 0` and `creditLedger: []`.
- The client never mutates this value locally; it is always authoritative from the server response.

### Client display behavior

- The character profile page renders `credits` as the current balance.
- Each `creditLedger` entry is shown in a table with columns: Type, Amount, Description, Date.
- `put` entries are styled green; `take` entries are styled red.
- If `creditLedger` is absent or empty, a "No ledger entries" placeholder is shown.
- All strings are i18n-keyed under `game.characterProfile.credits`.

### New character initialization

- On `character-add-request` success, the server seeds a starting balance of 425 credits recorded as a single `put` ledger entry with description `"Starting credits"`.

---

## Market Commerce

### `market-quote-request` (request)

Required payload:

```json
{
  "playerName": "string",
  "characterId": "string",
  "sessionKey": "string",
  "marketId": "string",
  "solarSystemId": "string",
  "itemId": "string",
  "direction": "buy | sell",
  "quantity": 1,
  "requestId": "string (optional, echoed in response)"
}
```

### `market-quote-response` (response)

Payload:

```json
{
  "success": true,
  "message": "string",
  "playerName": "string",
  "characterId": "string",
  "requestId": "string (optional)",
  "quote": {
    "marketId": "string",
    "solarSystemId": "string",
    "itemId": "string",
    "itemType": "string",
    "displayName": "string",
    "rarity": "string",
    "direction": "buy | sell",
    "quantity": 5,
    "unitPrice": 29,
    "totalPrice": 145,
    "availableStock": 1200,
    "marketCanBuy": true,
    "marketCanSell": true,
    "marketMultiplier": 1,
    "driftMultiplier": 0.97,
    "quotedAt": "ISO-8601 string"
  }
}
```

Failure `reason` values: `INVALID_PAYLOAD`, `PLAYER_NOT_REGISTERED`, `CHARACTER_NOT_FOUND`, `MARKET_NOT_FOUND`, `ITEM_NOT_FOUND`, `ITEM_NOT_TRADEABLE`, `INVALID_DIRECTION`, `INVALID_QUANTITY`, `MARKET_DOES_NOT_BUY_ITEM`.

Edge cases:

- Price is evaluated at quote request time (not pre-locked).
- Unit price applies market multiplier and hourly deterministic drift.
- Invalid session emits `invalid-session`.

---

### `market-inventory-list-request` (request)

Required payload:

```json
{
  "playerName": "string",
  "sessionKey": "string",
  "marketId": "string",
  "solarSystemId": "string",
  "offset": 0,
  "limit": 50
}
```

`offset` and `limit` are optional (defaults `0` and `50`).

### `market-inventory-list-response` (response)

Payload:

```json
{
  "success": true,
  "message": "string",
  "playerName": "string",
  "marketId": "string",
  "solarSystemId": "string",
  "marketName": "string",
  "inventory": [
    {
      "itemId": "string",
      "itemType": "string",
      "displayName": "string",
      "rarity": "string",
      "stock": 1198,
      "maxStock": 1200,
      "restockPerInterval": 96,
      "marketCanBuy": true,
      "marketCanSell": true
    }
  ],
  "total": 21,
  "offset": 0,
  "limit": 50,
  "asOf": "ISO-8601 string"
}
```

Edge cases:

- Market stock is restocked lazily on reads based on `restockIntervalMinutes`.
- Invalid session emits `invalid-session`.

---

### `market-buy-request` (request)

Required payload:

```json
{
  "playerName": "string",
  "characterId": "string",
  "sessionKey": "string",
  "marketId": "string",
  "solarSystemId": "string",
  "itemId": "string",
  "quantity": 3,
  "requestId": "string (optional)",
  "transactionId": "string (optional, idempotency key; autogenerated when omitted)"
}
```

### `market-buy-response` (response)

Payload on success:

```json
{
  "success": true,
  "message": "string",
  "requestId": "string (optional)",
  "transaction": {
    "transactionId": "string",
    "requestId": "string (optional)",
    "marketId": "string",
    "solarSystemId": "string",
    "characterId": "string",
    "itemId": "string",
    "direction": "buy",
    "quantity": 3,
    "unitPrice": 29,
    "totalPrice": 87,
    "timestamp": "ISO-8601 string",
    "characterCredits": 338,
    "marketStock": 1197
  }
}
```

Failure `reason` values: `INVALID_PAYLOAD`, `PLAYER_NOT_REGISTERED`, `CHARACTER_NOT_FOUND`, `MARKET_NOT_FOUND`, `ITEM_NOT_FOUND`, `ITEM_NOT_TRADEABLE`, `INSUFFICIENT_CREDITS`, `INSUFFICIENT_MARKET_STOCK`, `NO_SHIP_AVAILABLE`, `PARTIAL_WRITE_REVERSED`, `TRANSACTION_FAILED`.

---

### `market-sell-request` / `market-sell-response`

Same request/response shape as `market-buy-request` / `market-buy-response`, with `direction: "sell"`.

Additional failure `reason` values for sell: `MARKET_DOES_NOT_BUY_ITEM`, `INSUFFICIENT_ITEM_QUANTITY`.

Edge cases (both buy and sell):

- `characterCredits` in the transaction reflects the post-transaction balance.
- Character's `creditLedger` is updated server-side; client should re-fetch `character-list-response` or trust `characterCredits` from transaction.
- Invalid session emits `invalid-session`.

---

### `market-ledger-list-request` (request)

Required payload:

```json
{
  "playerName": "string",
  "sessionKey": "string",
  "marketId": "string",
  "solarSystemId": "string",
  "characterId": "string (optional)",
  "itemId": "string (optional)",
  "direction": "buy | sell | reversal (optional)",
  "startAt": "ISO-8601 string (optional, inclusive)",
  "endAt": "ISO-8601 string (optional, inclusive)",
  "offset": 0,
  "limit": 50
}
```

### `market-ledger-list-response` (response)

Payload:

```json
{
  "success": true,
  "message": "string",
  "playerName": "string",
  "marketId": "string",
  "solarSystemId": "string",
  "entries": [
    {
      "transactionId": "string",
      "requestId": "string (optional)",
      "characterId": "string",
      "itemId": "string",
      "direction": "buy | sell | reversal",
      "quantity": 3,
      "unitPrice": 29,
      "totalPrice": 87,
      "timestamp": "ISO-8601 string",
      "reversalOfTransactionId": "string | null"
    }
  ],
  "total": 2,
  "offset": 0,
  "limit": 50
}
```

Edge cases:

- Ledger is append-only. Failed partial writes append a reversal entry where possible (`PARTIAL_WRITE_REVERSED`).
- Invalid session emits `invalid-session`.

---

## Item Events

### `item-upsert-request` (request)

Required payload:

```json
{
  "playerName": "string",
  "sessionKey": "string",
  "item": {
    "id": "string (optional; omit to create)",
    "itemType": "string (required on create)",
    "displayName": "string (required on create)",
    "state": "contained | deployed | destroyed (optional)",
    "damageStatus": "intact | damaged | disabled | destroyed (optional)",
    "container": {
      "containerType": "ship | market",
      "containerId": "string"
    },
    "kinematics": null,
    "owningPlayerId": "string (optional)",
    "owningCharacterId": "string (optional)",
    "destroyedAt": "ISO-8601 string (optional)",
    "destroyedReason": "string (optional)",
    "launchable": true
  }
}
```

### `item-upsert-response` (response)

Payload:

```json
{
  "success": true,
  "message": "Item created successfully | Item updated successfully",
  "playerName": "string",
  "item": {
    "id": "string",
    "itemType": "string",
    "displayName": "string",
    "state": "string",
    "damageStatus": "string",
    "container": { "containerType": "string", "containerId": "string" },
    "kinematics": null,
    "owningPlayerId": "string",
    "owningCharacterId": "string",
    "destroyedAt": null,
    "destroyedReason": null,
    "discoveredAt": null,
    "discoveredByCharacterId": null,
    "launchable": true,
    "createdAt": "ISO-8601 string",
    "updatedAt": "ISO-8601 string"
  }
}
```

Edge cases:

- Any authenticated player may upsert any item (no ownership check).
- When `state` transitions to `destroyed` and no `destroyedAt` is provided, server auto-sets it.
- Items are stored in global `items` collection; ship inventory stores references hydrated on response.
- Invalid session emits `invalid-session`.

---

### `item-list-by-container-request` (request)

Required payload:

```json
{
  "playerName": "string",
  "sessionKey": "string",
  "containerType": "ship | market",
  "containerId": "string"
}
```

### `item-list-by-container-response` (response)

Payload:

```json
{
  "success": true,
  "message": "string",
  "playerName": "string",
  "containerType": "string",
  "containerId": "string",
  "items": [ ]
}
```

`items` entries use the same shape as `item-upsert-response.item`. Returns `[]` when no items match.

---

### `item-list-by-location-request` (request)

Required payload:

```json
{
  "playerName": "string",
  "sessionKey": "string",
  "solarSystemId": "string",
  "positionKm": { "x": 0, "y": 0, "z": 0 },
  "distanceKm": 100,
  "itemType": "string (optional filter)",
  "limit": 50
}
```

Note: this endpoint uses `distanceKm` (not `distanceAu`) — asteroid/item proximity queries operate at short km-scale.

### `item-list-by-location-response` (response)

Payload:

```json
{
  "success": true,
  "message": "string",
  "playerName": "string",
  "solarSystemId": "string",
  "positionKm": { "x": 0, "y": 0, "z": 0 },
  "distanceKm": 100,
  "itemType": null,
  "items": [ ]
}
```

`items` entries include `distanceKm` as a computed field. Only items with `kinematics` are included (deployed items). Results sorted nearest-first.

---

## Cross-Cutting Edge Cases

- Out-of-order responses:
  - Client assumes one in-flight request per message type in a page.
  - If server can reply out of order under concurrency, consider adding a `requestId` field in future versions.
- Missing response:
  - Current client has no timeout/retry per request. Silent server drops will leave UI in submitting/loading state.
  - Recommended improvement: server always acknowledges requests; client can add timeout handling later.
- Payload normalization:
  - Some requests trim values client-side (`playerName` in character pages), some do not (`login`, `register`).
  - Server should normalize and validate consistently.
- Error messages:
  - Several pages display server `message` directly.
  - Keep messages user-readable and non-sensitive.

---

## Solar System Viewer (HYG-backed)

These contracts power the left-pane Viewer page and right-pane Viewer scene.
They consume the upstream HYG-derived dataset described by the backend's
`MESSAGE_CONTRACT.md` (see `solid-train` repository).

### `solar-system-list-request`

Client-emitted to fetch a paginated list of curated/procedural systems.

```ts
interface SolarSystemListRequest {
  playerName: string;
  sessionKey: string;
  source?: 'curated' | 'procedural';
  maxDistanceParsec?: number;
  search?: string;
  limit?: number;
  requestId?: string;
}
```

### `solar-system-list-response`

```ts
interface SolarSystemListResponse {
  success: boolean;
  message: string;
  playerName?: string;
  solarSystems: SolarSystemSummary[];
  requestId?: string;
}
```

`SolarSystemSummary` exposes display name, source, distance in parsecs,
multi-star flag, a `primaryStar` summary (`spectralClass`, `colorHex`,
`luminositySolar`, `massSolar`), and optional aggregate counts: `planetCount`,
`moonCount`, `asteroidCount`, `marketCount`. All count fields are optional;
omitted when data is unavailable. Models live in `src/app/model/solar-system-list.ts`.

### `solar-system-get-request`

Client-emitted when the user selects a system in the Viewer list.

```ts
interface SolarSystemGetRequest {
  playerName: string;
  sessionKey: string;
  solarSystemId: string;
  asOf?: string; // ISO timestamp; backend may compute orbital positions
  requestId?: string;
}
```

### `solar-system-get-response`

```ts
interface SolarSystemGetResponse {
  success: boolean;
  message: string;
  playerName?: string;
  solarSystemId?: string;
  solarSystem?: SolarSystemSummary;
  stars?: ViewerBody[]; // bodyType === 'star'
  bodies: ViewerBody[]; // planets, moons, asteroids, stations, ...
  requestId?: string;
}
```

`ViewerBody` carries `spatial.positionKm` (canonical world frame),
`visualization.colorHex`, `physicalCatalog.estimatedDiameterM`, optional
`orbitalElements`, and (for stars) `spectralClass` + `luminositySolar`.
Mission-generated asteroids also carry optional cluster metadata:
`clusterId`, `clusterCenterKm`, `localOffsetKm`, and optional
`distanceFromClusterCenterKm`.
Models live in `src/app/model/solar-system-get.ts`.

#### `orbitalElements.anchorBodyId` — required for moons and sub-orbital bodies

When a body's `orbitalElements.semiMajorAxisKm` is measured relative to a parent body
(e.g. a moon orbiting a planet), the backend **must** include `anchorBodyId` set to the
parent body's `id` (e.g. `"sol-earth"` for Luna).

Without `anchorBodyId` the client cannot distinguish a planet-relative semi-major axis
from a star-relative one, so the body falls back to its `spatial.positionKm` and loses
accurate orbital-plane positioning. Planets that orbit the primary star directly do not
need `anchorBodyId`.

```jsonc
// ✅ Correct — Luna specifies its parent planet
{
  "id": "sol-luna",
  "bodyType": "moon",
  "orbitalElements": {
    "anchorBodyId": "sol-earth",   // <-- required for moons
    "semiMajorAxisKm": 384400,
    "eccentricity": 0.0549,
    "inclinationDeg": 5.145,
    "longitudeOfAscendingNodeDeg": 0,
    "argumentOfPeriapsisDeg": 0,
    "meanAnomalyAtEpochDeg": 0,
    "orbitalPeriodSec": 2360591.5104
  }
}

// ❌ Incorrect — missing anchorBodyId; client falls back to spatial position
{
  "id": "sol-luna",
  "bodyType": "moon",
  "orbitalElements": {
    "semiMajorAxisKm": 384400   // interpreted as heliocentric — wrong
  }
}
```
