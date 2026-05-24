# Ship Ownership Contract Rollout Plan

## Source Contract

- Live contract reviewed from `http://localhost:3000/openapi.yaml` using a cache-busted request.
- Primary contract theme for this rollout: backend ownership semantics are becoming explicit, and ship data is no longer safely modeled as character-bound by default.

## Implementation Status (2026-05-24)

- Phase 2 decision was finalized as full cutover now (no legacy fallback).
- Compatibility wrapper retirement is complete: legacy `listShips(...)` APIs were removed from `ShipService` and `ShipExteriorSocketService`.
- Owner-scoped loading now uses explicit `listShipsByOwner(...)` APIs end-to-end in production callers.
- Phase 3 active-ship policy is now implemented with shared resolver usage across mission navigation, market hub hydration, ship hangar refresh, and ship inventory refresh.
- Phase 3 policy is now also applied to repair/retrofit and print-queue ship hydration flows.
- Phase 3 uses strict hard-fail semantics when no usable ship spatial data is returned (no fallback to first returned ship).
- Phase 3 is complete for the planned gameplay surfaces (mission navigation, game join/hangar-market hydration, repair/retrofit, print queue, inventory refresh).
- Hard-fail paths now emit runtime logs and surface UI-visible warnings/errors in impacted pages.
- Phase 4 explicit owner-scoped loading (`listShipsByOwner`) is complete across: mission navigation, game join, ship hangar, market hub hydration, repair/retrofit, print queue, and repair/retrofit ship-detail refresh.
- Phase 4 owner-scoped loading also covers ship inventory refresh, viewer-scene system ship hydration, and solar-system-details ship hydration facades.
- Phase 4 owner-scoped loading also covers starter-ship bootstrap in character setup and ship-exterior bootstrap/post-launch refresh flows.
- Validation for this extension is green: focused specs for `repair-retrofit` + `print-queue`, `npm run build`, and selected Playwright `e2e/tests/first-target-fabrication-menu-cue.spec.ts`.
- Latest validation after Phase 4 start: `npm run build` passed and Playwright `e2e/tests/repair-retrofit.spec.ts` + `e2e/tests/print-queue.spec.ts` passed (4/4).
- Full `npm run test:ci` is green after wrapper retirement (1586/1586).

## Current Phase 4 Result

Phase 4 owner-scoped caller migration is complete for production gameplay/scene code in this repo.

No remaining `listShips(...)` symbols are present in `src/`.

## Contract Changes That Matter

### Active frontend runtime path

- `/socket/ship-list-by-owner`
  - Primary runtime request/response path for ship loading in migrated production callers.
  - Owner payload currently standardized as `ownerType: player-character` plus `characterId`.

### Legacy compatibility path status

- `/socket/ship-list`
  - Legacy service-level compatibility APIs were removed from frontend service wrappers.
  - Runtime ship loading now uses owner-scoped contracts directly.

### Other ownership-sensitive endpoints

- `/socket/ship-transfer`
  - Explicit ownership transfer semantics.
- `/socket/ship-upsert`
  - Strict ownership mutation checks.

## Validation Snapshot

- Focused specs for migrated surfaces passed (including character setup and ship-exterior bootstrap slices).
- `npm run test:ci` passed: 1586/1586.
- `npm run build` passed.
- `npx playwright test e2e/tests/repair-retrofit.spec.ts e2e/tests/print-queue.spec.ts --reporter=line` passed: 4/4.
- Expanded Playwright closeout coverage passed: `character-add`, `character-ship-badge`, `ship-exterior-flight-mode`, `ship-exterior-hangar-resume` (9/9).

## Phase 4 Closeout Implementation

1. Completed: Expanded Playwright coverage to character and ship-exterior routes after wrapper retirement.
2. Completed: Added cross-repo owner-only API coordination checklist and handoff template in `docs/planning/ship-ownership-owner-only-handoff-checklist.md`.

## Residual Risk

- External repositories or tooling outside this workspace may still assume legacy `listShips(...)` wrappers.
- Use the owner-only handoff checklist to validate and sign off any external consumers before enforcing stricter CI gates.