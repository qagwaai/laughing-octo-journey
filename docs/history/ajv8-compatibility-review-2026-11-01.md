# AJV 8 Compatibility Review

Date: 2026-11-01
Repos: laughing-octo-journey (Nova), solid-train (Forge)
Scope: Compatibility with solid-train PR #67's AJV validator migration

## Status

PR #67 is merged in `qagwaai/solid-train` (merge commit
`c22d28dc41a3d906ebfe911b92acf8832fb9ff2d`). The migration uses AJV 8.20.0
and `ajv-formats` 3.0.1 in full mode. The live API reports contract version
4.0.0. Runtime validation is green, as confirmed for this review. The live
service does not expose a deployed commit or validator build identifier.

## Nova compatibility changes

- Celestial-body list and upsert correlation IDs now satisfy the approved
  schema's `format: uuid` requirement. A valid caller-provided UUID is
  preserved; missing or invalid values receive a generated UUID.
- The generic correlation-ID helper remains available for operations whose
  schemas permit opaque values. Credit-ledger opaque-ID behavior is covered by
  a regression assertion.
- No date-time producer edits were needed. The audited celestial-body and
  item lifecycle producers use `Date.toISOString()` to emit timezone-qualified
  UTC instants. No invalid source date fallback was found.
- No event, payload field, required field, enum, or response envelope changed.
  Existing response/error handling remains in place; Nova does not interpret
  raw AJV errors.

The approved Forge validator regression tests cover acceptance of leap-day and
timezone-offset timestamps and rejection of impossible dates, missing
timezones, malformed timestamps, and invalid UUID formats.

## Validation evidence

Nova checks:

- `npm run typecheck` — passed.
- `npx vitest run --config vitest.config.mts src/app/services/socket-correlation.vitest.ts src/app/services/socket.service.vitest.ts src/app/services/ship-exterior-socket.service.vitest.ts src/app/services/credit-ledger.service.vitest.ts src/app/scene/ship-exterior/asteroid-persistence.service.vitest.ts` — passed; 5 files, 76 tests.
- `git diff --check` — passed.

Forge validator and consumer checks:

- `node --test test/schema-validator.test.js` — passed; 6 tests.
- `node scripts/sw01/run-cross-repo-gate.js --baseline test/fixtures/sw01/m3/nova-consumer-inventory-aligned.json --current api/artifacts/contracts/contract-artifact.json --report "$env:TEMP\nova-ajv8-sw01-preflight.json" --mode hard-fail` — passed; zero issues.
- `node scripts/sw13/run-cross-repo-gate.js --baseline test/fixtures/sw13/m3/nova-consumer-inventory-aligned.json --current api/artifacts/contracts/contract-artifact.json --report "$env:TEMP\nova-ajv8-sw13-preflight.json" --mode hard-fail` — passed; zero issues.

The preflights use checked-in aligned Nova inventory fixtures. They do not
constitute a fresh inventory generated from current Nova source. Nova has no
local preflight command for this Forge artifact format.

The approved Forge contract artifact and baseline both had SHA-256
`7AD894C618C5720EA1A05FA69CA517A4473F438E2150559F19C3345DD14E0A38`; neither
was regenerated or changed.

## Rollout note

Runtime validation is green. The live service's exposed metadata confirms API
contract version 4.0.0 but does not independently identify the deployed
validator build. No remaining Nova incompatibility was demonstrated in the
reviewed date-time or correlation-ID paths.
