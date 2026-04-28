# Server Message Contracts

This document describes the socket message contracts currently used by the application when talking to the server.

## Scope

- Source of truth: client-side models and usage in page components.
- These contracts are what the client expects to send and receive.
- If server behavior differs, update both server and this document together.

## Global Requirements

- Transport: Socket.IO events.
- Message shape: JSON-compatible payloads.
- Session handling: authenticated character operations require a valid `sessionKey`.
- Invalid session behavior: server can emit `invalid-session` at any time; client clears session and routes back to login.
- One-response pattern: for each request event below, the client attaches one temporary response listener and unsubscribes after the first matching response.

## Event Catalog

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
      "createdAt": "string (optional)"
    }
  ]
}
```

Edge cases:

- `characters` should always be an array; client falls back to `[]` if undefined.
- Keep `id` stable and unique; it is used for edit/delete targeting.
- If `success` is `false`, include a user-safe `message`.

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
      "inventory": ["Expendable Dart Drone"],
      "location": {
        "positionKm": { "x": 0, "y": 0, "z": 0 }
      },
      "kinematics": {
        "position": { "x": 0, "y": 0, "z": 0 },
        "velocity": { "x": 0, "y": 0, "z": 0 },
        "reference": {
          "solarSystemId": "string",
          "referenceKind": "barycentric | body-centered",
          "referenceBodyId": "string (optional)",
          "distanceUnit": "km",
          "velocityUnit": "km/s",
          "epochMs": 0
        }
      }
    }
  ]
}
```

Edge cases:

- If `inventory` is missing on legacy `Scavenger Pod` records, server should backfill with `["Expendable Dart Drone"]` in response payloads.
- For non-starter ship models, default `inventory` should be `[]` when not set.
- Returned `ships` should always be an array.

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
    "location": {
      "positionKm": { "x": 0, "y": 0, "z": 0 }
    },
    "kinematics": {
      "position": { "x": 0, "y": 0, "z": 0 },
      "velocity": { "x": 0, "y": 0, "z": 0 },
      "reference": {
        "solarSystemId": "string",
        "referenceKind": "barycentric | body-centered",
        "referenceBodyId": "string (optional)",
        "distanceUnit": "km",
        "velocityUnit": "km/s",
        "epochMs": 0
      }
    }
  }
}
```

Client-side behavior:

- Upsert is patch-style: only provided fields mutate server state.
- Omitting `inventory` preserves existing inventory.

Server requirements:

- Validate `sessionKey` and ownership (`playerName` + `characterId` + existing `ship.id`).
- Treat `model`, `tier`, `inventory`, `location`, and `kinematics` as optional patch fields.
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
    "shipName": "string",
    "model": "string",
    "tier": 1,
    "inventory": ["Expendable Dart Drone"],
    "location": {
      "positionKm": { "x": 0, "y": 0, "z": 0 }
    },
    "kinematics": {
      "position": { "x": 0, "y": 0, "z": 0 },
      "velocity": { "x": 0, "y": 0, "z": 0 },
      "reference": {
        "solarSystemId": "string",
        "referenceKind": "barycentric | body-centered",
        "referenceBodyId": "string (optional)",
        "distanceUnit": "km",
        "velocityUnit": "km/s",
        "epochMs": 0
      }
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
      "location": {
        "positionKm": { "x": 0, "y": 0, "z": 0 }
      },
      "kinematics": {
        "position": { "x": 0, "y": 0, "z": 0 },
        "velocity": { "x": 0, "y": 0, "z": 0 },
        "reference": {
          "solarSystemId": "string",
          "referenceKind": "barycentric | body-centered",
          "referenceBodyId": "string (required only for body-centered)",
          "distanceUnit": "km",
          "velocityUnit": "km/s",
          "epochMs": 0
        }
      }
    }
  ]
}
```

Notes:

- `location.positionKm` and `kinematics` are required by the current client contract.
- `velocity` is the direction of travel plus speed magnitude.
- Use `referenceKind: "barycentric"` for multi-star systems (for example, binary stars) so position/velocity remain stable relative to the system barycenter.
- `distanceUnit` must be `"km"` and `velocityUnit` must be `"km/s"`.

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
    "location": {
      "positionKm": { "x": 0, "y": 0, "z": 0 }
    },
    "kinematics": {
      "position": { "x": 0, "y": 0, "z": 0 },
      "velocity": { "x": 0, "y": 0, "z": 0 },
      "reference": {
        "solarSystemId": "sol",
        "referenceKind": "barycentric",
        "distanceUnit": "km",
        "velocityUnit": "km/s",
        "epochMs": 0
      }
    }
  }
}
```

Client-side behavior:

- Client first requests `drone-list` and then upserts by existing starter drone `id` (contract requires existing drone ownership).
- Upsert payload mutates location/kinematics for that existing drone.

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
    "location": {
      "positionKm": { "x": 0, "y": 0, "z": 0 }
    },
    "kinematics": {
      "position": { "x": 0, "y": 0, "z": 0 },
      "velocity": { "x": 0, "y": 0, "z": 0 },
      "reference": {
        "solarSystemId": "string",
        "referenceKind": "barycentric | body-centered",
        "distanceUnit": "km",
        "velocityUnit": "km/s",
        "epochMs": 0
      }
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
  "status": "available | started | in-progress | failed | completed | locked | abandoned | paused | turned-in (optional)"
}
```

Client-side behavior:

- Use this event to create or upsert a mission status entry for one character.
- If `status` is omitted, server should default to `available`.

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
    "solarSystemId": "sol | string",
    "sourceScanId": "string",
    "createdByCharacterId": "string",
    "createdAt": "ISO-8601 string",
    "updatedAt": "ISO-8601 string",
    "location": {
      "positionKm": { "x": 0, "y": 0, "z": 0 }
    },
    "kinematics": {
      "velocityKmPerSec": { "x": 0, "y": 0, "z": 0 },
      "angularVelocityRadPerSec": { "x": 0, "y": 0, "z": 0 },
      "estimatedMassKg": 0,
      "estimatedDiameterM": 0
    },
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
- Current client defaults `solarSystemId` to `sol` for filtering.

Server requirements:

- Validate `sessionKey` and that `createdByCharacterId` belongs to the authenticated session context.
- Upsert by stable identity (`id` and/or `sourceScanId` + `solarSystemId`) with deterministic behavior.
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
    "solarSystemId": "string",
    "sourceScanId": "string",
    "createdByCharacterId": "string",
    "createdAt": "ISO-8601 string",
    "updatedAt": "ISO-8601 string"
  }
}
```

Edge cases:

- If the same source scan is sent repeatedly, return deterministic idempotent success with the authoritative stored record.
- If `solarSystemId` is unknown, return `success: false` with a user-safe message.
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
  "status": "available | started | in-progress | failed | completed | locked | abandoned | paused | turned-in"
}
```

Client-side behavior:

- Use this contract when a flow must explicitly set mission status (for example transitioning `first-target` to `started`).
- Unlike Mission Add, `status` is required for upsert requests.

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

Canonical mission ID:

- `first-target`

English mission content:

- Title: `The First Mission: Your First Target`
- Briefing line 1: `Yes, the player starts by targeting an asteroid, but with a twist: The Dart Maneuver.`
- Briefing line 2: `Instead of a mining laser, you are given a single Expendable "Dart" Drone. Since you have no "Permanent" drones yet, you must use your own ship's HUD to manually lock onto a nearby Level 1 Silicate Asteroid.`
- Gameplay loop title: `The Gameplay Loop of the Tutorial`
- Step 1: `Scanning: You move your crosshair over a cluster of rocks. The HUD identifies a "High-Iron Trace."`
- Step 2: `Launching: You press the ignition. The Expendable "Dart" (like the one you saw in the hangar) screams out of your launch tube.`
- Step 3: `The Impact: The Dart does not mine - it impacts. It slams into the asteroid, shattering it into three manageable chunks.`
- Step 4: `The Manual Retrieval: Without a Tug Drone, you must manually pilot your Scavenger Pod to "catch" the floating debris in your gravity scoop.`

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
