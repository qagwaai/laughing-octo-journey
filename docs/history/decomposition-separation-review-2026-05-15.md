# Decomposition and Separation of Concerns Review (2026-05-15)

## Scope

Focused architecture review on:

- decomposition quality (component/service size and responsibility slicing)
- separation of concerns (UI vs orchestration vs domain workflow boundaries)

## Verification Snapshot

- Build: `npm run build` -> pass
- Unit/CI: `npm run test:ci` -> pass (`1248` passed, `0` failed)
- Playwright:
  - `npx playwright test --list` -> `116` tests discovered in `26` files
  - direct run `npx playwright test --reporter=line .` reported a phantom failure referencing `e2e/example.spec.ts` (file not present in workspace)
  - canonical `npm run e2e -- --reporter=line` produced a partial stream in this session and showed multiple real failures related to join-flow assumptions (see "Playwright Triage")

## Findings (Ordered by Severity)

### 1) High: `ShipExteriorViewScene` is still a god-component

`src/app/scene/ship-exterior-view.ts` remains the main maintainability hotspot:

- scene/UI state ownership
- mission progression orchestration
- socket lifecycle + async queueing
- timer lifecycle and long-running flow control

Representative anchors:

- class root: `src/app/scene/ship-exterior-view.ts:163`
- service injections: `src/app/scene/ship-exterior-view.ts:177`-`182`
- queue orchestration: `src/app/scene/ship-exterior-view.ts:219`-`223`
- timers: `src/app/scene/ship-exterior-view.ts:486`, `1218`, `1558`
- upsert processors: `src/app/scene/ship-exterior-view.ts:1483`, `1651`

Context size: `1791` LOC.

### 2) Medium-High: `ViewerScenePage` mixes view concerns with domain workflow repair logic

`src/app/page/game/viewer-scene.ts` currently combines:

- page view state and navigation
- data loading and hydration policy
- ship spatial repair/upsert behavior

Representative anchors:

- class root: `src/app/page/game/viewer-scene.ts:53`
- injected dependencies: `src/app/page/game/viewer-scene.ts:57`-`61`, `88`
- hydration and repair policy methods: `127`, `215`, `251`

Context size: `412` LOC.

### 3) Medium: `SolarSystemDetailsPage` operates as an orchestration layer

`src/app/page/game/solar-system-details.ts` handles:

- route/session context
- body list loading
- market hydration fallback
- ship loading
- viewer target updates

Representative anchors:

- class root: `src/app/page/game/solar-system-details.ts:74`
- injected dependencies: `78`-`82`
- orchestrator methods: `146`, `197`, `244`

Context size: `318` LOC.

### 4) Medium: socket connection lifecycle still leaks into page components

There is ongoing architectural drift where pages directly manage `SocketService.connect/once` instead of delegating lifecycle concerns to domain services.

Representative anchors:

- `src/app/page/game/mission-board.ts:44`, `126`, `131`
- `src/app/page/game/repair-retrofit.ts:48`, `67`, `76`

### 5) Medium-Low: duplicated navigation-state hydration pattern

The pattern below is repeated broadly:

- `router.getCurrentNavigation()?.extras.state ?? history.state`

This increases drift risk and should be centralized as a typed helper/factory.

Representative anchors:

- `src/app/page/game/mission-board.ts:49`-`50`
- `src/app/page/game/market-hub.ts:73`-`74`
- `src/app/page/game/item-view-specs.ts:50`-`51`
- `src/app/page/game/game-join.ts:49`-`50`
- `src/app/page/game/character-profile.ts:28`-`29`

## Playwright Triage (Current Session)

Observed failures in a partial `npm run e2e -- --reporter=line` stream were concentrated in started/in-progress join paths where tests remained on `left:character-list`.

Primary cause pattern:

- started/in-progress join now fetches ship list before routing from character-list
- tests that did not mock `ship-list-request` never progressed to `left:game-main`

Files needing updates were identified and patched in this session:

- `e2e/tests/first-target-to-m01-transition.spec.ts`
- `e2e/tests/locale-opening-mission-flow.spec.ts`
- `e2e/tests/character-ship-badge.spec.ts`
- `e2e/tests/planet-view-zoom.spec.ts`
- `e2e/tests/viewer.spec.ts`
- `e2e/tests/viewer-interactions.spec.ts`
- `e2e/tests/viewer-list.spec.ts`
- `e2e/tests/viewer-scene-rendering.spec.ts`

Patched-spec verification results:

- `character-ship-badge.spec.ts`: pass (`2/2`)
- `first-target-to-m01-transition.spec.ts`: pass (`6/6`)
- `locale-opening-mission-flow.spec.ts`: pass (`2/2`)
- `planet-view-zoom.spec.ts`: pass (`2/2`)
- `viewer.spec.ts`: pass (`2/2`)
- `viewer-interactions.spec.ts`: pass (`9/9`)
- `viewer-list.spec.ts`: pass (`6/6`)
- `viewer-scene-rendering.spec.ts`: pass (`9/9`)

Additional candidate files for started/in-progress join-path audit (heuristic):

- `e2e/tests/character-list.spec.ts`

## Recommended Refactor Sequence (Post Playwright Stabilization)

1. Extract a `ShipExteriorSessionController` from `ship-exterior-view.ts` (socket/timers/queues).
2. Move viewer hydration/repair policies into a `ViewerDataFacade`.
3. Move solar-system-details data orchestration into a dedicated facade/service.
4. Introduce a shared typed navigation-state reader utility to remove repeated boilerplate.
5. Continue reducing direct `SocketService` lifecycle handling in page components.

## Completion Update (2026-05-16)

This review task has been completed end-to-end in the current workspace session. The items above are retained as the original review baseline; final implementation status is tracked below.

### Final Status vs Recommended Sequence

1. Completed: extracted ship-exterior orchestration into dedicated controllers and reduced god-component pressure in `ship-exterior-view.ts`.
2. Completed: moved viewer hydration/repair policy into `ViewerDataFacade` and simplified page orchestration.
3. Completed: moved solar-system-details data orchestration into `SolarSystemDetailsFacade`.
4. Completed: introduced shared typed helper `src/app/page/navigation-state.ts` and migrated page consumers to it.
5. Completed: introduced `SocketLifecycleService` and removed page-level direct socket lifecycle wiring.

### Architecture Artifacts Added

- `src/app/scene/ship-exterior/ship-exterior-session-controller.ts`
- `src/app/scene/ship-exterior/ship-exterior-mission-progress-controller.ts`
- `src/app/scene/ship-exterior/ship-exterior-celestial-body-controller.ts`
- `src/app/scene/ship-exterior/ship-exterior-launch-controller.ts`
- `src/app/scene/ship-exterior/ship-exterior-bootstrap-controller.ts`
- `src/app/page/game/viewer-data-facade.ts`
- `src/app/page/game/solar-system-details-facade.ts`
- `src/app/page/navigation-state.ts`
- `src/app/services/socket-lifecycle.service.ts`

### Test and Validation Summary

- Full Playwright suite reached green baseline in-session (`116/116`) after viewer-focused fixes.
- Multiple focused Angular/Jasmine spec slices were run during each refactor wave (mission-board, repair-retrofit, market-hub, print-queue, ship-hangar, game-join, character-list, ship-view-inventory, repair-retrofit detail pages, viewer and related game pages, public/character/opening pages).
- New helper regression tests were added and passed:
  - `src/app/services/socket-lifecycle.service.spec.ts` (`3/3`)
  - `src/app/page/navigation-state.spec.ts` (`3/3`)

### Residual Checks

- Page-level direct socket lifecycle pattern is eliminated (`SocketService.connect/getIsConnected/once('connect')` no longer appears under `src/app/page/**/*.ts`).
- Navigation-state hydration duplication is eliminated at page call sites; only the helper implementation itself contains the fallback expression.
