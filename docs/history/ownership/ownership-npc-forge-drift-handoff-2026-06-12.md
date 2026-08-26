# Ownership NPC Drift Handoff for Forge (2026-06-12)

## Goal

Clear SW-08 hard-fail gate drift for ownership/NPC rollout.

## Evidence Source

1. `reports/sw-08-contract-safety-gate/report.md`
2. `docs/planning/ownership/ownership-npc-m6-gate-evidence-2026-06-12.md`

## Required Producer-Side Contract Fixes

1. Align `ship.listByOwner` request enum at `request.owner.ownerType` to canonical set:
   - `player-character`
   - `npc-pirate`
   - `unowned`
   - `unknown`

2. Add/restore ownership operation socket event pairs in OpenAPI/artifact:
   - `item-list-by-owner-request` -> `item-list-by-owner-response`
   - `ship-list-by-npc-owner-request` -> `ship-list-by-npc-owner-response`
   - `ship-salvage-claim-request` -> `ship-salvage-claim-response`
   - `ship-piracy-seize-request` -> `ship-piracy-seize-response`
   - `market-listing-create-request` -> `market-listing-create-response`
   - `market-offer-create-request` -> `market-offer-create-response`
   - `market-offer-accept-request` -> `market-offer-accept-response`

## Acceptance Criteria

1. `npm run contract:check:stage3` exits `0`.
2. `npm run contract:check:stage5` exits `0`.
3. `reports/sw-08-contract-safety-gate/report.md` shows:
   - Decision: `pass`
   - Findings: `0` or only approved non-breaking exceptions

## Notes

1. Do not use frontend compatibility aliases as a substitute for producer contract correction.
2. If any temporary exception is needed, it must be explicit, approved, and short-lived.
