# Forge Escalation: Expendable Dart Drone Launchability Contract Violation (2026-05-25)

## Summary
In Ship Exterior, Expendable Dart Drone can appear in inventory but is sometimes not launchable.

This is not a frontend fallback issue. The frontend intentionally requires `launchable: true` to include an item in launch hotkey slots.

If backend emits Expendable Dart Drone with `launchable: false`, the item is visible in inventory but excluded from launch controls.

## Evidence in Repository
- Launch slots only include launchable items:
  - [src/app/scene/ship-exterior-view.ts](src/app/scene/ship-exterior-view.ts)
- Inventory coercion preserves explicit `launchable: false` from payload:
  - [src/app/model/ship-item.ts](src/app/model/ship-item.ts)
- Ship inventory contract tests confirm behavior:
  - [src/app/model/ship-list.spec.ts](src/app/model/ship-list.spec.ts)

## Runtime Symptom
- User-visible symptom: no launchable Expendable Dart Drone in Ship Exterior even though drone is listed in inventory.
- Browser warning seen at same time: `[Violation] 'setTimeout' handler took 248ms`.
  - This is a performance warning, not the root cause of launchability mismatch.

## New Evidence (2026-05-25)
- Ship Exterior runtime diagnostics now show both:
  - `source: "navigation-state"` with `inventoryCount: 0`
  - `source: "ship-list-response"` with `inventoryCount: 0`
- Runtime schema confirms `ship-list-by-owner-response` does not require ship inventory details in each ship item.
  - Required fields currently include only top-level response metadata (`success`, `message`, `ships`, `correlationId`, `requestIdentity`).
  - `ships[].inventory` is not required by the schema and can be omitted.

Impact:
- Ship Exterior cannot derive launch hotkey items from `ships[].inventory` if omitted.
- Result is deterministic: no launchable dart drone can be selected even when gameplay expects one.

### Latest Runtime Log Snapshot (User Repro)
- `source: "navigation-state"`
  - `hasInventoryArray: true`
  - `inventoryCount: 4`
  - `droneCount: 0`
  - `launchableDroneCount: 0`
  - `inventoryItemIdsCount: 0`
  - `inventoryIdsCount: 0`
  - `inventoryItemTypes: ["propulsion-manifold", "sensor-array", "power-distribution-bus", "ship-tractor-beam"]`
- `source: "ship-list-response"`
  - `hasInventoryArray: true`
  - `inventoryCount: 4`
  - `droneCount: 0`
  - `launchableDroneCount: 0`
  - `inventoryItemIdsCount: 0`
  - `inventoryIdsCount: 0`
  - `inventoryItemTypes: ["propulsion-manifold", "sensor-array", "power-distribution-bus", "ship-tractor-beam"]`
- Contract warning emitted by client:
  - `[ship-exterior-contract] Scavenger Pod inventory missing Expendable Dart Drone.`

Conclusion:
- This run is not a `launchable: false` mismatch.
- This run is not an empty-inventory payload anymore.
- This run is a **missing required item** payload: `expendable-dart-drone` is absent from Scavenger Pod inventory.

## Copy/Paste Prompt for Forge
Please investigate and fix a socket contract violation in ship inventory payloads.

Problem:
- Expendable Dart Drone is sometimes returned with `launchable: false`.
- Frontend behavior is strict: launch hotkeys only include items where `launchable === true`.
- Result: drone appears in inventory but cannot be fired, blocking first-target progression.

Expected contract behavior:
- Canonical Expendable Dart Drone items must be emitted as launchable.
- For itemType `expendable-dart-drone`, backend should always emit `launchable: true`.

Repro context:
1. Enter Ship Exterior with a ship inventory that includes Expendable Dart Drone.
2. Receive ship/inventory payload where drone has `launchable: false`.
3. Observe drone in inventory UI but absent from launch hotkey slots.

Requested Forge changes:
1. Enforce canonical launchability for `expendable-dart-drone` at payload generation time.
2. Ensure `ship-list-by-owner-response` includes canonical `ships[].inventory` payload for ship inventory consumers.
3. Add backend guards/tests so this cannot regress (both launchable flag and inventory presence).
4. Confirm all ship/inventory endpoints that can surface this item follow the same rule.

Acceptance criteria:
1. Any emitted item with `itemType: "expendable-dart-drone"` includes `launchable: true`.
2. `ship-list-by-owner-response` includes `ships[].inventory` for active player-character ships.
3. Ship Exterior receives drone as launchable and hotkey launch becomes available.
4. No payload path emits canonical dart drone with `launchable: false`.
