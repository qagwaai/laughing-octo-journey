# Ownership NPC M6 Gate Evidence (2026-06-12)

## Scope

Hard-fail SW-08 contract gate validation for ownership/NPC rollout readiness.

## Commands Executed

1. `npm run contract:check:stage3`
2. `npm run contract:check:stage5`
3. `npm run contract:check:stage3:fixture`

## Results

1. Initial Stage3: `hard-fail` (exit code 1)
2. Initial Stage5: `hard-fail` (exit code 1)
3. Stage3 fixture: `hard-fail` (exit code 1, intentional mismatch inventory/artifact)
4. Final Stage3 after artifact refresh: `pass` (exit code 0)
5. Final Stage5 after artifact refresh: `pass` (exit code 0)

## Canonical Report Artifacts (stage3/stage5)

1. `reports/sw-08-contract-safety-gate/report.md`
2. `reports/sw-08-contract-safety-gate/report.json`
3. `reports/sw-08-contract-safety-gate/gate-events.jsonl`

## Prior Drift Highlights Blocking M6 Closure

1. `character/ship` enum/value mismatch on `ship.listByOwner` at `request.owner.ownerType`.
2. `ownership operations` endpoint/event missing for:
   - `item-list-by-owner`
   - `ship-list-by-npc-owner`
   - `ship-salvage-claim`
   - `ship-piracy-seize`
   - `market-listing-create`
   - `market-offer-create`
   - `market-offer-accept`

## Fixture Hard-Fail Repro Note

The fixture command verifies hard-fail gate behavior against intentional mismatch artifacts. The gate uses a shared report path, so fixture runs overwrite `reports/sw-08-contract-safety-gate/report.md` until a canonical stage3/stage5 run is executed again.

## Resolution Notes

1. Live localhost OpenAPI was verified with a cache-busted fetch before final gate rerun.
2. The remaining gate failure source was the stale checked-in backend artifact in this repo.
3. Updating `docs/planning/sw-08/backend-contract-artifact.json` to match the remediated producer contract cleared the final drift.

## Decision

M6 is complete. Hard-fail gate behavior was reproduced, drift was resolved, and both canonical gate commands now pass.
