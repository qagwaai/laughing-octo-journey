# SW-13 Phase 0: Contract-Usage List (Forge Sign-Off Required)

Status: GATE 0 PASS — CONTRACT CONFIRMED — PHASE 1 AUTHORIZED
Date: 2026-06-30
Owner: Nova
Stakeholder action required: Forge must confirm or escalate before Phase 1 begins.

## Purpose

This document lists every socket event and model field the new greenfield ship-exterior component
will consume, organized by delivery phase. Forge must confirm that existing socket/OpenAPI
contracts are sufficient as-is for each phase before that phase's build begins.

Forge action per phase: review the listed events/fields, then respond with one of:
  CONFIRMED — contracts sufficient, no change needed.
  MISSING — field/event not in contract; escalate before proceeding (do not invent a fallback).

## Phase 0 Gate Requirement

Phase 1 (headless engine build) does not start until Forge signs off on at least the Bare Scene
flow below. Parity-slice confirmations can follow as those phases approach.

## Bare Scene Flows (Phase 2 — ship + starfield + per-ship camera + pause/resume)

Only one socket flow is required to render the bare scene.

### Flow 1: Bootstrap / Active-Ship Selection

Purpose: Identify which ships the current player owns and select the active ship on scene entry.

| Item | Value |
| --- | --- |
| Request event | `ship-list-by-owner-request` (constant: `SHIP_LIST_BY_OWNER_REQUEST_EVENT`) |
| Response event | `ship-list-by-owner-response` (constant: `SHIP_LIST_BY_OWNER_RESPONSE_EVENT`) |
| Request fields used | `playerName`, `sessionKey`, `correlationId`, `requestIdentity`, `owner` |
| Response type | `ShipListByOwnerResponse` (src/app/model/ship-list-by-owner.ts) |
| Response fields used | `success`, `correlationId`, `requestIdentity`, `owner`, `ships[].id`, `ships[].spatial.positionKm`, `ships[].model` |
| Service wrapper | `ShipExteriorSocketService.listShipsByOwner()` |
| Notes | `spatial.positionKm` is the field that places the ship in the scene. `model` drives which 3D asset is loaded. These are the only fields needed for the bare scene. |

Forge confirmation required:
  [ ] `ship-list-by-owner-request` and `ship-list-by-owner-response` are in the current
      OpenAPI/socket contract with the listed fields.
  [ ] `ships[].spatial.positionKm` (Triple: x, y, z) is present and stable.
  [ ] `ships[].model` is present and stable.

## Parity-Slice Flows (Phases 4–7 — confirmation can follow as each phase approaches)

Listed here for Forge's awareness. Nova will request confirmation before each phase begins.

### Flow 2: Asteroid Hydration (Phase 5)

| Item | Value |
| --- | --- |
| Request event | `celestial-body-list-request` (`CELESTIAL_BODY_LIST_REQUEST_EVENT`) |
| Response event | `celestial-body-list-response` (`CELESTIAL_BODY_LIST_RESPONSE_EVENT`) |
| Key response fields | `celestialBodies[].id`, `.spatial.positionKm`, `.composition`, `.state`, `.destroyedAt`, `.distanceKm` |
| Response type | `CelestialBodyListItem` (src/app/model/celestial-body-list.ts) |

### Flow 3: Floating Debris (Phase 5 / Phase 7)

| Item | Value |
| --- | --- |
| Request event | `item-list-by-location` (`ITEM_LIST_BY_LOCATION_REQUEST_EVENT`) |
| Response event | `item-list-by-location-response` (`ITEM_LIST_BY_LOCATION_RESPONSE_EVENT`) |
| Key response fields | `items[]` typed as `ShipItem` array; `id`, `itemType`, `displayName`, `positionKm`, `state`, `damageStatus` |
| Response type | `FloatingDebrisItem` (src/app/model/floating-debris-item.ts) |

### Flow 4: Launch / Weapons (Phase 6)

| Item | Value |
| --- | --- |
| Request event | `launch-item-request` (`LAUNCH_ITEM_REQUEST_EVENT`) |
| Response event | `launch-item-response` (`LAUNCH_ITEM_RESPONSE_EVENT`) |
| Key response fields | `success`, `correlationId`, `requestIdentity`, `shipId`, `targetCelestialBodyId`, `resolution.outcome`, `resolution.yieldedMaterials`, `resolution.launchSeed` |
| Response type | `LaunchItemResponse` (src/app/model/launch-item.ts) |

### Flow 5: Piracy Seize (Phase 7)

| Item | Value |
| --- | --- |
| Response event | `ship-piracy-seize-response` (`SHIP_PIRACY_SEIZE_RESPONSE_EVENT`) |
| Notes | Listen-only from scene (no preceding request emitted by scene). Direct SocketService.on() call. |
| Response type | (src/app/model/ownership-operations.ts) |

## Service Wrappers (No Direct Socket Changes Expected)

All bare-scene socket traffic is mediated by `ShipExteriorSocketService`. The greenfield
component will consume the same service API. No change to the service is expected for the bare
scene.

| Service | File |
| --- | --- |
| ShipExteriorSocketService | src/app/services/ship-exterior-socket.service.ts |
| SocketService (piracy seize only) | src/app/services/ (direct .on() call) |

## Event Constants Files

Event name constants are distributed across model files (not centralized). The greenfield
component will import from the same locations:

| Constant | Value | File |
| --- | --- | --- |
| SHIP_LIST_BY_OWNER_REQUEST_EVENT | `ship-list-by-owner-request` | src/app/model/ship-list-by-owner.ts |
| SHIP_LIST_BY_OWNER_RESPONSE_EVENT | `ship-list-by-owner-response` | src/app/model/ship-list-by-owner.ts |
| CELESTIAL_BODY_LIST_REQUEST_EVENT | `celestial-body-list-request` | src/app/model/celestial-body-list.ts |
| CELESTIAL_BODY_LIST_RESPONSE_EVENT | `celestial-body-list-response` | src/app/model/celestial-body-list.ts |
| ITEM_LIST_BY_LOCATION_REQUEST_EVENT | `item-list-by-location` | src/app/model/item-list-by-location.ts |
| ITEM_LIST_BY_LOCATION_RESPONSE_EVENT | `item-list-by-location-response` | src/app/model/item-list-by-location.ts |
| LAUNCH_ITEM_REQUEST_EVENT | `launch-item-request` | src/app/model/launch-item.ts |
| LAUNCH_ITEM_RESPONSE_EVENT | `launch-item-response` | src/app/model/launch-item.ts |
| SHIP_PIRACY_SEIZE_RESPONSE_EVENT | `ship-piracy-seize-response` | src/app/model/ownership-operations.ts |

## Forge Sign-Off Block

### Forge response received 2026-06-30

Flow 1 bare scene — request shape:
  Status: CONFIRMED
  Notes: ship-list-by-owner-request envelope matches current contract.
  See ship-list-by-owner-request.schema.json:4-37 and openapi.yaml:335-373.

Flow 1 bare scene — response fields (spatial.positionKm, model):
  Status: MISSING
  Missing fields: ships[].spatial.positionKm, ships[].model
  Notes: Current ship-list-by-owner-response schema is inventory-centric. Each ship item
  requires only id and inventory; response requires message. No spatial or model field exists.
  See ship-list-by-owner-response.schema.json:4-45 and openapi.yaml:374-390.

Parity-slice advance warning:
  No planned contract changes for asteroids, debris, launch, or piracy in current repo state.
  Historical routing bug around ship-list-by-owner response-channel misrouting noted; not a
  schema change.

GATE 0 result: PASS — escalate before Nova starts Phase 1.

## Escalation Resolution 2026-06-30

Root cause confirmed: spatial.positionKm and model were already present in the live runtime
payload (emitted by normalizeShip() in normalizers.js:485, returned unchanged by
ship-operations-service.js:166). The gap was schema documentation only, not a missing field.

Forge fix applied:
  - ship-list-by-owner-response.schema.json updated at line 39 to include spatial and model.
  - openapi.yaml updated at line 329; root info.version bumped from 3.1.2 to 3.1.3.
  - OpenAPI validation passed and contract artifact regenerated successfully.

Nova verification: fetched http://localhost:3000/openapi.yaml with cache-bust parameter.
  Confirmed info.version = 3.1.3. ShipListByOwnerResponse schema reference present.

GATE 0 final result: PASS — Phase 1 authorized.


