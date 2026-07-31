# SW-13A Reconciliation Addendum (2026-07-31)

Status: Accepted — supersedes open gaps in the 2026-05-31 execution report  
Date: 2026-07-31  
Owner: Nova  
Reviewer: Pete  
Base document: `docs/planning/sw-13a/sw-13a-execution-report-2026-05-31.md`

## 1. Purpose

The original SW-13A execution report was written against the legacy monolith
(`src/app/scene/ship-exterior-view.ts`), which has since been replaced in full
by the hard-replace Option A architecture (Milestone 1–3C). This addendum
retires the three open contract-gap items and updates evidence references to
match the current codebase.

## 2. Architecture Change Since Original Report

| Item | 2026-05-31 state | Current state |
| --- | --- | --- |
| Primary implementation file | `src/app/scene/ship-exterior-view.ts` | Deleted — replaced by `src/app/scene/ship-exterior/ship-exterior-bare-scene.component.ts` |
| Route wiring | Legacy route component | `src/app/routed.routes.ts` loads bare-scene component via `ship-exterior-view` path |
| Test file | `src/app/scene/ship-exterior-view.vitest.ts` | Deleted — new tests in `ship-scene-context.vitest.ts`, `ship-scene-registry.vitest.ts`, and route-feed-adapter/layer specs |
| Route-feed support for gates/stations/encounter ships | Blocked (contract gaps GAP-SW13A-001/002/003) | **Delivered** via market contract route |

## 3. Gap Retirement

### GAP-SW13A-001 — Gate landmark feed

Status: **Superseded (closed)**

Evidence:
- `src/app/scene/ship-exterior/ship-exterior-route-feed-adapter.ts` — `collectShipExteriorRouteFeeds()` extracts `route.gates` from market payloads into a deduped `gates[]` array.
- `src/app/scene/ship-exterior/ship-exterior-route-feed-layer.ts` — renders each gate as a torus mesh with descriptor color and emissive values.
- `src/app/scene/ship-exterior/ship-exterior-route-feed-adapter.vitest.ts` — deterministic tests for gate collection from market payloads.
- `src/app/scene/ship-exterior/ship-exterior-route-feed-layer.vitest.ts` — render coverage for gate mesh output.

Resolution path used: market-list contract (`MarketRouteFeedGate` via `src/app/model/market-list.ts`) served as the contract-backed entity feed called for in the original gap.

### GAP-SW13A-002 — Station landmark feed

Status: **Superseded (closed)**

Evidence:
- `src/app/scene/ship-exterior/ship-exterior-route-feed-adapter.ts` — `collectShipExteriorRouteFeeds()` extracts `route.stations` from market payloads into a deduped `stations[]` array.
- `src/app/scene/ship-exterior/ship-exterior-route-feed-layer.ts` — renders each station as an octahedron mesh with descriptor color and emissive values.
- Same adapter and layer test files as GAP-SW13A-001.

### GAP-SW13A-003 — Encounter ship feed

Status: **Superseded (closed)**

Evidence:
- `src/app/scene/ship-exterior/ship-exterior-route-feed-adapter.ts` — `collectShipExteriorRouteFeeds()` extracts `route.encounterShips` from market payloads into a deduped `encounterShips[]` array.
- `src/app/scene/ship-exterior/ship-exterior-route-feed-layer.ts` — renders each encounter ship via `app-viewer-ship-mesh` with model and color from payload.
- `src/app/scene/ship-exterior/ship-exterior-route-feed-layer.vitest.ts` — explicit test: "renders one viewer mesh per encounter ship".

## 4. Active Family Coverage (Unchanged from Original Report)

The original report correctly closed asteroids and debris for the active in-route families. That status is unchanged:

| Family | Status |
| --- | --- |
| Asteroids | ☑ Complete — descriptor-driven, evidenced in original report |
| Floating debris | ☑ Complete — descriptor-driven, evidenced in original report |
| Gates | ☑ Superseded-closed — route-feed adapter + layer now present |
| Stations | ☑ Superseded-closed — route-feed adapter + layer now present |
| Encounter ships | ☑ Superseded-closed — route-feed adapter + layer now present |

## 5. Monolith Artifact References in Original Report

M1A in the original report lists these files as implementation artifacts:

- `src/app/scene/ship-exterior-view.ts` — **deleted** (hard-replace Option A)
- `src/app/scene/ship-exterior-view.html` — **deleted** (hard-replace Option A)

These files were intentionally removed as part of the SW-13 Option A milestone-1
hard-replace commit. Their deletion is expected and is not a regression. Evidence
previously embedded in them is now carried by the bare-scene stack.

## 6. Updated SW-13A Readiness Statement

SW-13A is ready to close. All contract-gap items are superseded by the current
bare-scene route-feed implementation. No open gaps remain for the ship-external-view
family coverage in this addendum scope.

Formal SW-13A closure is gated only by the SW-13 family closure gates (G1–G5) in
`docs/planning/sw-13-closure/sw-13-closure.md`, not by any further SW-13A-specific
implementation work.

## 7. Closure Matrix Update Required

`docs/planning/sw-13-closure/sw-13-closure-matrix.md` section 3 should have the
following rows updated after Pete reviews this addendum:

| Area | Prior status | Updated status |
| --- | --- | --- |
| Execution report status | Partial | Addendum accepted — gaps retired |
| Gap list for gates/stations/encounter ships | Superseded (likely) | Superseded (confirmed) |
| Formal SW-13A closeout addendum | Open | **This document** |
