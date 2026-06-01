# Ship Ownership Owner-Only Handoff Checklist

Date: 2026-05-24
Scope: Cross-repo and external consumer confirmation after owner-only migration
Status: Active

## Objective

Confirm all consumers use owner-scoped ship loading APIs and no longer rely on legacy `listShips(...)` wrapper methods removed from frontend service wrappers.

## Completed Local Evidence (this repo)

1. Source audit: `rg -n "\blistShips\s*\(" src --glob "*.ts"` returns no matches.
2. Unit and integration validation:
- `npm run test:ci` passed (1586/1586).
- `npm run build` passed.
3. Playwright validation:
- `repair-retrofit` + `print-queue`: 4/4 passed.
- `character-add` + `character-ship-badge` + `ship-exterior-flight-mode` + `ship-exterior-hangar-resume`: 9/9 passed.

## External Consumer Checklist

1. Identify callers
- Enumerate any shared libs, scripts, or downstream repos that import frontend ship service wrappers.
- Confirm no external caller expects `ShipService.listShips(...)` or `ShipExteriorSocketService.listShips(...)`.

2. Contract alignment
- Confirm caller request payloads use owner descriptor format:
  - `owner.ownerType = player-character`
  - `owner.characterId` populated where required.
- Confirm response handling expects `ShipListByOwnerResponse` shape.

3. Runtime verification
- Run caller-specific smoke tests against `/socket/ship-list-by-owner` path.
- Verify no runtime dependency remains on `/socket/ship-list` wrapper behavior.

4. Sign-off
- Frontend owner sign-off: ____
- Backend owner sign-off: ____
- QA owner sign-off: ____
- Date: ____

## Suggested Validation Commands for Consumers

1. Source scan for legacy wrapper calls:
- `rg -n "\blistShips\s*\(" <consumer-root> --glob "*.ts"`

2. Source scan for owner-scoped usage:
- `rg -n "listShipsByOwner|ship-list-by-owner" <consumer-root> --glob "*.ts"`

3. Run consumer tests/build using existing repo standards.

## Exit Criteria

1. No legacy wrapper calls found in any scoped consumer repos.
2. Owner-scoped API calls validated in smoke tests.
3. All three sign-offs completed.
