# Ownership and NPC M0 Delta Baseline (Nova)

Status: In Progress 🟨
Date: 2026-06-12
Repo: laughing-octo-journey
Contract Source: http://localhost:3000/openapi.yaml (v3.1.0)

## 1. Ownership and NPC Endpoint Snapshot

Captured ownership/NPC contract operations from current OpenAPI index:

1. /socket/ship-list-by-owner
2. /socket/ship-list-by-npc-owner
3. /socket/item-list-by-owner
4. /socket/ship-salvage-claim
5. /socket/ship-piracy-seize
6. /socket/market-listing-create
7. /socket/market-offer-create
8. /socket/market-offer-accept
9. /socket/npc-bust-create
10. /socket/npc-bust-read
11. /socket/npc-bust-update

## 2. Canonical OwnerType Baseline

Working canonical set for this migration:

1. player-character
2. npc-pirate
3. unowned
4. unknown

## 3. Initial Nova Delta Findings

Potential incompatibility to resolve in M1:

1. src/app/model/ship-owner.ts currently accepts additional owner types not in this migration baseline:
- player
- npc
- faction

Potential integration expansion points for M2/M3:

1. Dedicated wrappers for salvage, piracy, item-list-by-owner, and market ownership endpoints are not all centralized in current Nova services.
2. NPC bust flows appear in contract but require explicit mapping confirmation in Nova feature surfaces.

## 4. Next Actions

1. Nova performs primary validation for ownership/NPC migration.
2. Forge is notified only when Nova finds contract/source-of-truth mismatches.
3. Convert ship-owner type coercion to strict baseline set.
4. Build per-endpoint service wiring task list for M2 implementation.
