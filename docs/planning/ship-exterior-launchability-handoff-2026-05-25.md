# Ship Exterior Launchability Handoff (2026-05-25)

## Current Status

Manual testing confirmed multiple backend/runtime states over the session:

1. Earlier state: Ship Exterior received empty inventory payloads.
2. Later state: Inventory payload arrived, but `expendable-dart-drone` was missing.
3. Latest state (final user report): a launchable dart drone is present, but launch is still unavailable.

This means we moved past one contract failure mode, but launch gating is still not working end-to-end.

## Evidence Already Captured

- Runtime launchability snapshots are emitted from [src/app/scene/ship-exterior-view.ts](src/app/scene/ship-exterior-view.ts#L1620).
- Empty inventory warning is emitted from [src/app/scene/ship-exterior-view.ts](src/app/scene/ship-exterior-view.ts#L1636).
- Missing dart warning is emitted from [src/app/scene/ship-exterior-view.ts](src/app/scene/ship-exterior-view.ts#L1650).
- Hotkey gating is computed in [src/app/scene/ship-exterior-view.ts](src/app/scene/ship-exterior-view.ts#L491).
- Hotkey slot population is computed in [src/app/scene/ship-exterior-view.ts](src/app/scene/ship-exterior-view.ts#L501).
- Launch debug line includes HOTKEYS ON/OFF in [src/app/scene/ship-exterior-view.ts](src/app/scene/ship-exterior-view.ts#L529).
- Launch action lookup uses populated slots in [src/app/scene/ship-exterior-view.ts](src/app/scene/ship-exterior-view.ts#L1708).
- Forge escalation record with evolving evidence is in [docs/planning/forge-launchable-dart-contract-escalation-2026-05-25.md](docs/planning/forge-launchable-dart-contract-escalation-2026-05-25.md#L23).

## Most Likely Remaining Cause

Given final report "launchable dart drone exists but cannot launch", likely remaining blockers are:

1. Hotkeys disabled due to targeting gate (`launchHotkeysEnabled` false).
2. Target selected but missing `serverCelestialBodyId` (target sync gate).
3. Slot population mismatch where dart exists in inventory but does not appear in first 5 launchable slots.

## Tomorrow First-Pass Checklist (5-10 min)

1. Reproduce once and capture 3 logs:
   - `[ship-exterior-launchability] Snapshot` (both sources)
   - `LAUNCH DBG ... HOTKEYS ...`
   - `LAUNCH ID DBG ...` after pressing a hotkey
2. In launchability snapshot, verify:
   - `droneCount`
   - `launchableDroneCount`
   - `inventoryItemTypes`
   - `inventoryLaunchableFlags`
3. In LAUNCH DBG line, verify:
   - `HAS_DRONE Y`
   - `LAUNCHABLE >= 1`
   - `TARGET Y`
   - `HOTKEYS ON`
4. If `TARGET Y` but `HOTKEYS OFF`, inspect target sample for missing `serverCelestialBodyId`.
5. If `HOTKEYS ON` but click still fails, capture `LAUNCH ID DBG` request/response fields.

## Decision Rules for Next Action

1. If `launchableDroneCount` is 0: backend payload composition bug persists.
2. If `launchableDroneCount` is >= 1 but `HOTKEYS OFF`: targeting synchronization bug.
3. If `HOTKEYS ON` and request emits but no valid response: correlation/response routing bug.
4. If request and response are valid but mission does not progress: launch resolution/business logic bug.
