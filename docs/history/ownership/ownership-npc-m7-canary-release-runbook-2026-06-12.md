# Ownership NPC M7 Canary and Release Runbook (2026-06-12)

## Purpose

Define the canary execution, release decision, and rollback criteria for ownership/NPC rollout once M6 contract drift is cleared.

## Entry Criteria

1. M6 gate is passing:
   - `npm run contract:check:stage3` exit code `0`
   - `npm run contract:check:stage5` exit code `0`
2. Latest full unit run is green.
3. Latest full Playwright run is green.

## Canary Execution Order

1. Ownership-focused e2e subset
   - `npm run e2e:spec -- e2e/tests/market-hub-by-location.spec.ts`
   - `npm run e2e:spec -- e2e/tests/market-hub-docking.spec.ts`
   - `npx playwright test e2e/tests/repair-retrofit.spec.ts --reporter=line`
   - `npx playwright test e2e/tests/ship-exterior-test-utils.spec.ts --reporter=line`
2. Broader regression confidence
   - `npm run test`
   - `npm run e2e`

## Runtime Contract-Failure Visibility Checks

1. Confirm ownership hard-fail UX text appears when ownership preflight fails in market flow.
2. Confirm ship exterior piracy ownership failure is visible as error toast.
3. Confirm diagnostics include operation, correlation, and reason code context in logs.

## Go Criteria

1. No ownership/NPC contract gate failures.
2. Canary targeted specs pass without retries.
3. Full unit and e2e suites remain green.
4. No silent ownership failure paths observed.

## No-Go Criteria

1. Any stage3/stage5 hard-fail finding reappears.
2. Any ownership/NPC e2e failure affecting user path reliability.
3. Missing or ambiguous runtime ownership failure diagnostics.

## Rollback Triggers

1. Contract drift returns in hard-fail mode after release candidate cut.
2. Ownership operation endpoint mismatch causes user-visible failure without deterministic fallback.
3. Market transaction ownership preflight blocks valid transactions at unacceptable rate.
4. Active ship ownership transitions produce inconsistent state in ship exterior flow.

## Rollback Actions

1. Stop rollout and mark decision as No-Go.
2. Revert ownership/NPC contract-consuming frontend changes to last green baseline.
3. Re-run:
   - `npm run contract:check:stage3`
   - `npm run contract:check:stage5`
   - `npm run test`
   - `npm run e2e`
4. Re-open M6 and capture new drift evidence before reattempting canary.

## Evidence Capture Template

1. Canary outputs:
   - path:
   - summary:
2. Runtime telemetry summary:
   - path:
   - summary:
3. Go/No-Go record:
   - decision:
   - approvers:
   - notes:
