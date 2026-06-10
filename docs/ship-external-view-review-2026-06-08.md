# Ship External View Architecture Review (2026-06-08)

## Implementation Status (Updated 2026-06-08)
- Validation checkpoint refreshed on 2026-06-09 (latest run): all unit tests and full e2e are green.
- Validation checkpoint refreshed after Phase 4 hero-tier test API conversion on 2026-06-09: all unit tests and full e2e are green.
- Validation checkpoint refreshed after mission-completion e2e stabilization on 2026-06-09: all unit tests and full e2e are green.
- Validation checkpoint refreshed for current change set on 2026-06-09: all unit tests and full e2e are green.
- Validation checkpoint refreshed for current Phase 3 slice: all unit tests and full e2e are green.
- Additional manual validation pass complete: extra manual tests are green for the current baseline.
- Validation checkpoint complete: all unit tests and full e2e are green after Phase 0 facade changes.
- Validation checkpoint refreshed: all unit tests and full e2e are green after Phase 1 input-adapter extraction.
- Validation checkpoint refreshed again: all unit tests and full e2e are green after Phase 2 route-feed extraction slice.
- Manual validation pass complete: extra manual tests are green on top of the automated baseline.
- Targeted e2e stabilization landed for `character-profile` join bootstrap race (`e2e/tests/character-profile.spec.ts`) and targeted spec is green.
- Phase 1 completed:
  - Added `ship-exterior-input-adapter.ts` to encapsulate window/document listener attach/detach lifecycle.
  - Integrated adapter into `ship-exterior-view.ts` (`ngOnInit` now calls adapter `attach()`, `ngOnDestroy` calls `detach()`).
  - Added unit coverage in `ship-exterior-input-adapter.spec.ts` for attach, detach, idempotent attach, and no-op detach guards.
  - Reworked the remaining input-behavior assertions in `ship-exterior-view.spec.ts` to use public events/signals instead of private handler reads.
- Phase 2 started and first slice completed:
  - Extracted route feed render layer from `ship-exterior-view.html` into `ship-exterior-route-feed-layer.ts`.
  - Integrated new layer component into scene template and component imports.
  - Added unit coverage in `ship-exterior-route-feed-layer.spec.ts` for encounter ship rendering counts.
- Phase 3 started and first slice completed:
  - Added `ship-exterior-state-facade.ts` to consolidate navigation/session inventory mutation paths.
  - Routed ship-list synchronization, launch-consume updates, and launch-reward updates through the new facade.
  - Added focused unit coverage in `ship-exterior-state-facade.spec.ts` for sync, consume, and reward mutation flows.
- Phase 4 started and first slice completed:
  - Expanded `ship-exterior-route-feed-layer.spec.ts` with integration-style render-domain assertions for gates and stations.
  - Added input-update behavior coverage to ensure render counts track public input changes.
- Phase 4 second slice completed:
  - Reworked early `ship-exterior-view.spec.ts` assertions from private-member reads (`component['...']`) to public computed behavior checks (`shipSunDistanceKm`, `sunScenePosition`, `missionObjectiveText`).
  - Continued shifting test strategy toward public behavior and integration-friendly assertions.
- Phase 4 third slice completed:
  - Reworked additional `ship-exterior-view.spec.ts` solar behavior checks to direct public computed access (`sunConfig`, `sunScenePosition`, `solarDirectionalLightIntensity`) instead of bracket member access.
  - Reduced private-style assertion usage in a second test cluster while keeping behavior coverage unchanged.
- Phase 4 fourth slice completed:
  - Reworked the first targeting-capability assertion in `ship-exterior-view.spec.ts` to use the public `__shipExteriorTestUtils.forceTargetAsteroid(...)` behavior hook instead of the protected `canTargetAsteroids()` signal.
  - Kept the capability test aligned with the public scene behavior path while preserving the same coverage intent.
- Phase 4 fifth slice completed:
  - Reworked the remaining two negative targeting-capability assertions in `ship-exterior-view.spec.ts` to use the public `__shipExteriorTestUtils.forceTargetAsteroid(...)` behavior path.
  - Removed direct protected `canTargetAsteroids()` reads for the targeted capability cluster while preserving disabled-targeting expectations.
- Phase 4 sixth slice completed:
  - Reworked two hero-tier scan tests in `ship-exterior-view.spec.ts` to read asteroid sample results through the public `__shipExteriorTestUtils.getAsteroidSamples()` behavior path.
  - Removed direct private asteroid-signal result assertions in that cluster while preserving hero-tier and scan-completion coverage intent.

## Scope
Reviewed files:
- src/app/scene/ship-exterior-view.ts
- src/app/scene/ship-exterior-view.spec.ts
- src/app/scene/ship-exterior-view.html
- src/app/scene/hud/cold-boot-hud-scene.ts
- src/app/page/opening/cold-boot-scan.ts
- src/app/routed.routes.ts

Priority focus applied:
- Testability
- Maintainability
- Supportability
- Angular best practices

## Executive Summary
`ship-exterior-view.ts` is currently a high-complexity orchestration component that still carries too many responsibilities in one class (scene rendering state, mission progression, launch pipeline, socket synchronization, persistence, debug HUD, and input handling). The code has good guardrails in places (proper listener cleanup in `ngOnDestroy`, extracted controller classes), but it is still architecturally over-coupled and expensive to evolve safely.

The suspected `cold-boot-hud-scene.ts` linkage is **not a direct code-level coupling**. The real coupling path is route composition and wrapper usage:
- `opening-cold-boot` -> `cold-boot-hud-scene` (primary scene route) at `src/app/routed.routes.ts:49`
- `ship-exterior-view` -> `page/opening/cold-boot-scan` (right outlet wrapper that hosts `ShipExteriorViewScene`) at `src/app/routed.routes.ts:200-202`
- `cold-boot-scan` imports and proxies `ShipExteriorViewScene` at `src/app/page/opening/cold-boot-scan.ts:4`, `:25`, `:34`

This route/wrapper relationship appears intentional and consistent with repo memory note about `NgtStore` provisioning via wrapper page.

## Confirmed Cold Boot Relationship
### Finding
No direct import or direct API dependency was found between:
- `src/app/scene/ship-exterior-view.ts`
- `src/app/scene/hud/cold-boot-hud-scene.ts`

### What does exist
- Parallel route entries in `src/app/routed.routes.ts`:
  - Cold boot HUD route: `opening-cold-boot` -> `./scene/hud/cold-boot-hud-scene` (`:49`)
  - Ship exterior route: `ship-exterior-view` -> `./page/opening/cold-boot-scan` (`:200-202`)
- Wrapper page coupling:
  - `cold-boot-scan.ts` imports `ShipExteriorViewScene` and proxies many properties/methods.

### Conclusion
The strange link is **not** between ship-exterior-view and cold-boot-hud-scene. The notable coupling is between ship-exterior-view and the `cold-boot-scan` host wrapper plus route mapping.

## Findings (Ordered by Severity)

## 1) High: Orchestrator remains too large (supportability + maintainability)
Evidence:
- `ship-exterior-view.ts` size: 3402 lines.
- Large reactive surface: 68 `computed(...)`, 12 `signal(...)`, ~88 method-like declarations.
- Multiple domain controllers constructed in one class (`session`, `flight`, `mission`, `launch`, `debris`, etc.) around `src/app/scene/ship-exterior-view.ts:277-400`.

Why this is a gap:
- This class is still the central integration point for many concerns, making defect isolation and safe refactors harder.
- Changes to launch, mission, input, or rendering can create broad regression risk.

## 2) High: Test suite is tightly coupled to internals (testability)
Evidence:
- Widespread private member/method access via bracket notation in spec (`component['...']`) throughout `src/app/scene/ship-exterior-view.spec.ts` (many occurrences from `:136` onward).
- Test setup strips template/imports with `TestBed.overrideComponent(... { imports: [], template: '' })` at `src/app/scene/ship-exterior-view.spec.ts:115`.
- Global test bridge usage via `window.__shipExteriorTestUtils` (`src/app/scene/ship-exterior-view.ts:2710`, unregister at `:2739`, and used heavily in spec).

Why this is a gap:
- Internal refactors will break tests even when behavior stays correct.
- Heavy white-box tests reduce confidence in template-level and Angular integration behavior.
- Global window hook is effective but increases cross-test contamination risk.

## 3) Medium: Input/event handling is manually managed in component (Angular best practices + supportability)
Evidence:
- Global listeners attached in `ngOnInit`: `src/app/scene/ship-exterior-view.ts:1244-1251`.
- Global listeners removed in `ngOnDestroy`: `src/app/scene/ship-exterior-view.ts:1628-1635`.

Why this is a gap:
- Cleanup exists (good), but manual global listener bookkeeping in the main component still adds cognitive load and is easy to regress.
- Angular-native patterns (`DestroyRef`, RxJS `fromEvent`, `takeUntilDestroyed`, or a dedicated input adapter service/directive) would reduce lifecycle risk and improve testability.

## 4) Medium: Wrapper page has large proxy API surface (maintainability)
Evidence:
- `cold-boot-scan.ts` contains many `computed(() => this.shipExteriorView()?.X() ?? fallback)` proxies and command pass-throughs, starting at `src/app/page/opening/cold-boot-scan.ts:37` and continuing across most of the file.

Why this is a gap:
- `ShipExteriorViewScene` public shape changes force edits in wrapper page.
- This creates a brittle mirror layer and duplicated fallback semantics.

## 5) Medium: Scene template is dense and mixes multiple render domains (maintainability + testability)
Evidence:
- Single template includes route feeds, asteroids, debris, tractor beam visuals, and target overlays in one file: `src/app/scene/ship-exterior-view.html`.

Why this is a gap:
- Harder to test template behavior by domain.
- Harder to reason about rendering ownership boundaries and future additions.

## 6) Medium: Mixed state mutation paths increase reasoning cost (supportability)
Evidence:
- Component updates both navigation state copy and session state in launch/refresh flows (for example inventory consumption/rewards and active ship sync around `src/app/scene/ship-exterior-view.ts:1900+` and `:2400+`).

Why this is a gap:
- Multiple sources of truth can drift during asynchronous socket updates.
- Makes incident triage and debugging state races more difficult.

## 7) Low: Side-effect mission registration import in top-level scene (maintainability)
Evidence:
- Side-effect import for mission registration in `src/app/scene/ship-exterior-view.ts` (`../mission/generic-exploration-ship-exterior-mission`).

Why this is a gap:
- Import-order/side-effect registration is less explicit than token-based provider wiring.
- Can surprise future maintainers and complicate test bootstrapping.

## Strengths Observed
- Event listener cleanup is present and symmetrical (`ngOnInit`/`ngOnDestroy`).
- Many concerns already extracted into controller classes, creating a solid foundation for further decomposition.
- `OnPush` and signals/computed patterns are used consistently.

## Decomposition Plan (Implementation Roadmap)

## Phase 0: Stabilize Public Contract (1-2 days)
1. Define a narrow facade interface for scene interactions used by wrapper page.
2. Replace direct broad proxying with grouped view-model selectors and command methods.
3. Keep existing behavior unchanged.

Deliverables:
- `ShipExteriorViewFacade` interface (or similar)
- Wrapper page consumes facade, not broad scene internals

## Phase 1: Extract Input/Interaction Adapter (2-3 days)
1. Move window/document pointer/keyboard listener logic from component into dedicated adapter service/class.
2. Keep attach/detach lifecycle but encapsulate all DOM event wiring.
3. Add focused unit tests for attach/detach + key interaction behavior.

Deliverables:
- `ship-exterior-input-adapter.ts`
- Reduced event code in component

## Phase 2: Split Render Domains in Template (3-5 days)
1. Extract template blocks into focused presentational scene components:
   - route feed layer
   - asteroid layer
   - debris layer
   - targeting overlay layer
   - tractor beam visual layer
2. Pass only needed inputs/outputs per layer.

Deliverables:
- Smaller HTML templates and clearer render ownership
- Easier targeted template tests

## Phase 3: Consolidate State Ownership (4-6 days)
1. Introduce a single state facade/store for ship exterior domain orchestration.
2. Remove direct mutation of duplicated state paths where possible.
3. Convert async launch/mission updates to explicit action methods with deterministic state transitions.

Deliverables:
- `ship-exterior-state-facade` (or equivalent)
- Clear read/write boundaries for session/navigation-derived state

## Phase 4: Rebalance Tests Toward Public Behavior (4-6 days, incremental)
1. Replace private-member assertions with public API or facade assertions.
2. Keep a small number of white-box tests only where absolutely necessary.
3. Add targeted integration tests for extracted render-domain components.

Deliverables:
- Lower brittle `component['...']` usage
- Better confidence for refactors

## Test Plan to Support Refactor
1. Keep existing high-value behavior tests running while introducing facade adapters.
2. Add unit tests per extracted adapter/component before removing old paths.
3. Add one integration test per extracted scene layer to validate signal flow and event outputs.
4. Preserve launch/mission critical regression tests first (highest gameplay risk area).

## Suggested Initial Decomposition Targets (Smallest Safe Cuts)
1. Input handling adapter (`onWindowPointerDown`, `onWindowKeyDown`, `onPointerLockChange`, etc.).
2. Properties/debug projection model (move many computed label lines behind a cohesive view-model).
3. Template render subcomponents (asteroids/debris/route feed).

## Architectural Decision Notes
- Keep `ship-exterior-view` routed through `cold-boot-scan` wrapper unless/until an alternative `NgtStore` provisioning strategy is introduced.
- Do not couple ship-exterior scene directly to cold-boot HUD scene; current separation is good and should remain.

## Open Questions
1. Should `cold-boot-scan` continue as the canonical right-outlet host for all ship-exterior entry points, or should a more generic reusable host page be introduced?
2. Do we want to formalize a stable public scene facade now to unblock test cleanup and wrapper simplification?
