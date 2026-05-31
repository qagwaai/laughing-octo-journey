# Forge Escalation: Launch-Item Inventory Membership Contract Variance (2026-05-26)

## Summary
Cold-boot first-mission flow still fails at launch even when Ship Exterior shows a valid launchable dart drone in hotkey slot 1 and launch hotkeys are enabled.

This is not a frontend target-gating issue.

Two backend-facing failure modes are now observed:
1. Response reject path: launch response returns `Item is not in ship inventory` while the same item id is present in frontend inventory payloads.
2. No-response path: launch request is emitted with valid correlation and identity but no `launch-item-response` arrives within timeout.

Round-8 update: no frontend literal `raw-material-iron` remains in this workspace, but backend launch handler still throws `Unsupported runtime item type: raw-material-iron` during launch processing.

## Scope and Constraints
- Strict-contract mode: no backward-compatibility shims on frontend.
- Goal acceptance criteria: launch request succeeds and mission progresses.
- No outstanding backend launchable-flag enforcement work is pending for this repro.

## Repro Path (Deterministic)
1. Create new character.
2. Start Cold Boot.
3. Click Start Scanning to enter Ship Exterior.
4. Confirm Expendable Dart Drone in hotkey slot 1.
5. Select target asteroid (hotkeys ON).
6. Press hotkey 1 to launch.

Observed: depending on run/database state, either
- launch response rejected with message `Item is not in ship inventory`, or
- no launch response received.

## Round-3 Runtime Evidence
### Launchability snapshots (both sources)
- `source: "navigation-state"`
  - `shipId: 1a6ebfcc-0339-48b6-9c9d-ee451d0a40d9-ship-1`
  - `inventoryCount: 5`
  - `launchableCount: 1`
  - `droneCount: 1`
  - `launchableDroneCount: 1`
- `source: "ship-list-response"`
  - same counts as above

### Request and response parity
From `request-summary` and `reject-summary` logs:
- `corr`: `launch-item:mpmxpjg2:ceadb569-919f-46cb-af1a-bbcaeb2b1256`
- `item`: `1a6ebfcc-0339-48b6-9c9d-ee451d0a40d9-ship-1-item-1`
- `itemType`: `expendable-dart-drone`
- `ship`: `1a6ebfcc-0339-48b6-9c9d-ee451d0a40d9-ship-1`
- `target`: `cb-1a6ebfcc-0339-48b6-9c9d-ee451d0a40d9-first-target-sample-a1`

Response identity also matches operation/entity/container:
- `respIdentity.operation`: `launch-item`
- `respIdentity.entityType`: `expendable-dart-drone`
- `respIdentity.containerId`: `1a6ebfcc-0339-48b6-9c9d-ee451d0a40d9-ship-1`

### Inventory identity surfaces at reject time
- `navIds` contains launch item id:
  - `1a6ebfcc-0339-48b6-9c9d-ee451d0a40d9-ship-1-item-1`
  - plus starter module item ids
- `launchableIds` contains:
  - `1a6ebfcc-0339-48b6-9c9d-ee451d0a40d9-ship-1-item-1`
- `shipInventoryItemIds`: `[]`
- `shipInventoryIds`: `[]`

### Error message
- `response.message`: `Item is not in ship inventory`

## Round-5 Runtime Evidence (New DB + Refreshed Browser)
### Launchability and request emission
- `source: "navigation-state"` and `source: "ship-list-response"` both report:
  - `shipModel: "Scavenger Pod"`
  - `inventoryCount: 5`
  - `launchableCount: 1`
- Launch request summary confirms emitted request fields:
  - `corr`: `launch-item:mpmyn4qi:428cd388-f961-470b-9d8f-6fc071608a97`
  - `item`: `4e2598d3-1c20-4b94-9ae1-06a82505c955-ship-1-item-1`
  - `itemType`: `expendable-dart-drone`
  - `ship`: `4e2598d3-1c20-4b94-9ae1-06a82505c955-ship-1`
  - `target`: `cb-1f284194-0baf-4bfd-935b-183c4d017831-first-target-sample-a1`

### New failure mode
- No reject summary and no success response.
- Timeout diagnostic emitted:
  - `[ship-exterior-launch-contract] No launch-item response received within 3000ms ... correlationId=launch-item:mpmyn4qi:428cd388-f961-470b-9d8f-6fc071608a97 ...`

Impact:
- Asteroid is not destroyed.
- Mission does not progress.

## Backend Error Evidence (Round-6)
Observed backend runtime error:
- `[socket] Launch item handler error: Unsupported runtime item type: iron`

Forge confirmation:
- `iron` is not a supported item type.

Interpretation:
- This strongly explains the no-response failure mode: launch handler throws during runtime item/debris resolution and does not emit terminal `launch-item-response`.
- The failure appears to occur after request ingress, during launch outcome material/item projection.
- Contract impact: launch path can violate response guarantee under valid request framing when target yield resolves to an unsupported runtime item type token (`iron`).

Naming convention evidence:
- Frontend launch-reward fallback in [src/app/scene/ship-exterior-view.ts](src/app/scene/ship-exterior-view.ts#L2088) uses `iron` for iron and `{token}-raw-material` for other materials.
- Live OpenAPI examples use canonical `iron` itemType for iron materials.
- Backend and Forge confirmation indicate `iron` is unsupported, so any generator/mapper emitting that token is producing invalid runtime item types.

## Backend Error Evidence (Round-8)
Observed backend runtime error:
- `[socket] Launch item handler error: Unsupported runtime item type: raw-material-iron`

Correlated launch request evidence (same round):
- Frontend request summary still emits canonical launch payload for the dart item:
  - `itemType: expendable-dart-drone`
  - `item: ...-ship-1-item-1`
  - `ship: ...-ship-1`
- No launch response emitted within timeout:
  - `[ship-exterior-launch-contract] No launch-item response received within 3000ms ...`

Interpretation:
- The unsupported token is being generated inside backend launch processing (post-request ingress), not by the frontend launch request payload.
- This aligns with backend guidance that launch runtime currently builds `raw-material-*` variants dynamically and then fails runtime validation for unsupported item types.
- Contract impact remains: validly framed launch requests can terminate without a terminal `launch-item-response` if backend runtime item materialization throws.

## Diagnosis
Current behavior indicates two independent backend contract/execution faults:
1. Membership validation drift (reject path):
  - frontend-readable inventory includes the launch item id;
  - backend launch-item membership validation rejects that same id as not in ship inventory.
2. Response delivery gap (no-response path):
  - launch request is emitted with correlation and identity;
  - backend does not return `launch-item-response` for that correlation within timeout.

Most likely backend causes:
- Launch membership validation and canonical ship inventory projection are not consistently sourced from the same projection under all states.
- Under some request paths, launch processing does not emit terminal response payloads (success or failure), violating request/response contract expectations.
- Runtime material-to-itemType mapping emits at least one invalid token (`iron`) that is not supported by runtime item catalogs, causing handler exceptions.
- Runtime material-to-itemType mapping can emit unsupported `raw-material-*` tokens (explicitly observed: `raw-material-iron`) that fail runtime catalog validation and abort response emission.

## OpenAPI Confirmation (localhost:3000/openapi.yaml)
The live OpenAPI now explicitly codifies the expected backend behavior for this variance.

Confirmed contract points:
- `/socket/launch-item` preconditions now state the item must exist in the ship canonical projected inventory emitted by `ship-list`/`ship-list-by-owner`.
- `/socket/launch-item` contract guarantees now state launch membership validation uses the same canonical inventory projection as `ship-list`/`ship-list-by-owner`.
- `/socket/launch-item` contract guarantees now explicitly state legacy `inventoryIds` and `inventoryItemIds` are not used for launch membership validation.
- `/socket/ship-list-by-owner` response notes now state each returned ship includes canonical `inventory` payloads and canonical `expendable-dart-drone` launchability for first-target readiness.
- `ship-list-by-owner-response.schema.json` now requires each ship item to include `inventory`.

Implication:
- The observed reject path (`Item is not in ship inventory`) should now be treated as backend canonical-inventory projection drift, not a frontend launch-slot or targeting issue.

## Requested Forge Changes
1. Align launch-item membership validation source with canonical emitted ship inventory item set.
2. Ensure launch validation and `ship-list-by-owner` inventory emission use the same canonical inventory projection for a ship.
3. Ensure launch-item processing always emits a terminal `launch-item-response` (success or failure) for every validly framed request correlation.
4. Add backend diagnostics for launch lifecycle to trace request ingress, validation stage, and response emit stage by correlation id.
5. If `inventoryItemIds` or `inventoryIds` are required by any launch path, enforce population invariants in the same transaction that emits ship inventory.
6. Normalize launch-yield item typing so every yielded material maps only to supported canonical runtime item types (explicitly forbid emitting `raw-material-*` tokens, including `raw-material-iron`) or gracefully degrades with explicit response failure.
7. Add backend regression tests for cold-boot starter ship validating this exact sequence:
   - inventory payload includes dart item id
  - launch-item request with same id receives terminal response
  - launch-item request with same id succeeds
   - mission progression trigger is emitted/observable
  - launch-yield material paths (including iron) do not throw handler exceptions

## Acceptance Criteria
1. For first-mission cold-boot flow, launch request for slot-1 dart succeeds (`response.success = true`).
2. Launch response no longer returns `Item is not in ship inventory` for item ids that are present in emitted ship inventory.
3. Every launch request with valid request framing receives exactly one terminal `launch-item-response` for the same correlation id.
4. Backend contract guarantees parity between emitted inventory and launch membership validation source.
5. Mission progresses after successful launch in the same user flow.
6. Backend launch handler does not throw `Unsupported runtime item type` for any canonical yield material path, including iron yields, and never emits `raw-material-*` runtime item types.

## Relevant Frontend Instrumentation
- Launch gate and slot population: `src/app/scene/ship-exterior-view.ts`
- Launch request/response contract logs: `src/app/scene/ship-exterior-view.ts`
- Launch request wrapper/correlation registration: `src/app/services/ship-exterior-socket.service.ts`
- Launch request/response types: `src/app/model/launch-item.ts`
