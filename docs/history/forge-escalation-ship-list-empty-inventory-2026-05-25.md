# Forge Escalation: Ship List Empty Inventory Contract Violation (2026-05-25)

## Paste-Ready Message

We have a confirmed backend contract violation on the Ship Exterior path.

Observed runtime behavior (client diagnostics):
- `source: "navigation-state"` => `inventoryCount: 0`, `droneCount: 0`, `launchableDroneCount: 0`
- `source: "ship-list-response"` => `inventoryCount: 0`, `droneCount: 0`, `launchableDroneCount: 0`
- Client warning emitted:
  - `[ship-exterior-contract] Ship list response contains ship with empty inventory payload.`

Important:
- This repro is **not** a frontend filtering issue.
- This repro is **not** a `launchable: false` mismatch case.
- The ship payload itself is arriving with empty inventory, so no launchable dart can be selected.

Requested backend fixes:
1. Ensure `ship-list-by-owner-response` returns canonical `ships[].inventory` for active player-character ships.
2. Ensure canonical item invariants are preserved in that inventory (for `itemType: "expendable-dart-drone"`, emit `launchable: true`).
3. Enforce this on all response paths (success + edge/error paths that still include ships).
4. Update schema/contracts so inventory presence for this surface is explicit (not optional drift).

Required backend tests:
1. `ship-list-by-owner` returns non-empty `ships[].inventory` when ship has inventory.
2. `ships[].inventory` includes `expendable-dart-drone` with `launchable: true` when present.
3. Regression test for Ship Exterior cold-boot/in-progress path using real response fixtures.

Acceptance criteria:
1. Ship Exterior receives inventory via `ship-list-by-owner-response` and can populate launch hotkey slots.
2. Expendable Dart Drone appears as launchable when present.
3. No path emits ship rows with silently empty inventory when inventory exists server-side.
