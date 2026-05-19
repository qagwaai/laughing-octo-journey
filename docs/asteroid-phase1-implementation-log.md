# Asteroid Phase 1 Implementation Log

Status: In progress
Started: 2026-05-19

## Scope Locked

- Include all Phase 1 items:
  - PBR fields in material catalog
  - Asteroid component reveal logic
  - Asteroid template bindings
  - Phase 1 tests
  - Phase 1 docs tracking
- Tracking format: single running log document
- Reveal rule: detail 2 for dodecahedron/icosahedron, octahedron stays low detail
- PBR preset: class-based defaults from research
- Emissive boost: enabled for Uranium and Unobtainium
- Test level: focused tests plus broader `test:ci`

## Change Set 1 - Code Updates

### Updated [src/app/model/catalog/asteroid-materials.ts](src/app/model/catalog/asteroid-materials.ts)

- Added optional `roughness`, `metalness`, and `emissiveBoost` to `AsteroidMaterialProfile`.
- Added class-aligned PBR values to all catalog materials.
- Added emissive boosts for:
  - Uranium
  - Unobtainium
- Updated fallback `Unknown Composite` return in `pickWeightedAsteroidMaterial` to include PBR defaults.

### Updated [src/app/component/asteroid.ts](src/app/component/asteroid.ts)

- Added helper functions:
  - `resolveAsteroidGeometryDetail`
  - `resolveAsteroidPbrRoughness`
  - `resolveAsteroidPbrMetalness`
  - `resolveAsteroidEmissiveIntensity`
- Set persistent base reveal profile at component init:
  - pre-scan geometry remains low-detail random primitive profile
- Changed active detail behavior:
  - pre-scan: low (0-1)
  - post-scan: promoted (2 for dodecahedron/icosahedron, 0 for octahedron)
- Added computed PBR properties for template binding.
- Removed previous scan-only lazy profile creation effect to avoid pre-scan single-shape behavior.

### Updated [src/app/component/asteroid.html](src/app/component/asteroid.html)

- Bound `roughness` and `metalness` on `ngt-mesh-standard-material`.
- Switched emissive intensity binding to computed `resolvedEmissiveIntensity()`.

### Updated [src/app/component/asteroid.spec.ts](src/app/component/asteroid.spec.ts)

- Added tests for:
  - scan-triggered detail promotion
  - octahedron low-detail preservation
  - pre-scan vs post-scan PBR resolution
  - helper functions for detail, roughness, metalness, emissive intensity
- Updated material fixtures in existing tests to include new optional fields where needed.

## Pending

- Record any follow-up tuning items discovered during visual QA.

## Validation Results

### Focused tests

- Command context: targeted run of impacted specs.
- Result: `51 passed, 0 failed`.
- Specs covered:
  - `src/app/component/asteroid.spec.ts`
  - `src/app/mission/first-target-ship-exterior-mission.spec.ts`

### Broad suite (`test:ci`)

- Command: `npm run test:ci`
- Result: `TOTAL: 1291 SUCCESS`
- Coverage summary:
  - Statements: 71.81% (4941/6880)
  - Branches: 60.15% (1987/3303)
  - Functions: 71.64% (1061/1481)
  - Lines: 72.05% (4747/6588)

### Notes from test output

- Existing WARN/ERROR logs appear in test output from unrelated suites/mocks (for example async queue intentional error-path tests and known renderer disposal warnings), but no test failures were introduced by Phase 1 changes.

## Change Set 2 - Visibility and Debugability Follow-up

### Updated [src/app/scene/ship-exterior-view.ts](src/app/scene/ship-exterior-view.ts)

- Added dev-only asteroid debug computed signals:
  - `showAsteroidDebugTag`
  - `asteroidDebugHeaderText`
  - `asteroidDebugMaterialText`
  - `asteroidDebugPbrText`
  - `asteroidDebugDetailRuleText`
- Debug focus selection prefers hovered asteroid, then targeted asteroid.

### Updated [src/app/page/opening/cold-boot-scan.ts](src/app/page/opening/cold-boot-scan.ts)

- Exposed scene debug signals to host-page template bindings.

### Updated [src/app/page/opening/cold-boot-scan.html](src/app/page/opening/cold-boot-scan.html)

- Added a dev-only HUD debug section that shows active asteroid visual state lines while hovering/targeting.

### Updated [src/app/page/opening/cold-boot-scan.css](src/app/page/opening/cold-boot-scan.css)

- Added styling for the new debug section to keep it readable and non-interactive.

### Updated [src/app/scene/ship-exterior-view.html](src/app/scene/ship-exterior-view.html)

- Rebalanced baseline scene lighting for better form contrast:
  - ambient intensity: `0.50` -> `0.38`
  - point-light intensity: `1.90` -> `1.35`

## Change Set 3 - Phase 2 Environment Map + LOD Tiering

### Added [src/app/scene/ship-exterior/asteroid-tier-selection.ts](src/app/scene/ship-exterior/asteroid-tier-selection.ts)

- Pure helper `assignAsteroidRenderTiers` assigns each asteroid one of `'hero' | 'near' | 'background'` based on:
  - Forced hero for `targetedAsteroidId` and `activeScanAsteroidId` (respecting `scannedOnlyHero`).
  - Distance to camera (Hero <= 6 scene units, Near <= 14 scene units).
  - Hard caps: hero max 3, near max 8 (`DEFAULT_ASTEROID_TIER_CAPS`).
- Pure helper `resolveAsteroidTierDetailOverride` returns a per-tier detail override:
  - hero: `null` (use default scanned detail)
  - near: `1`
  - background: `0`
  - unscanned: `null` (pre-scan low geometry preserved)

### Added [src/app/scene/ship-exterior/asteroid-tier-selection.spec.ts](src/app/scene/ship-exterior/asteroid-tier-selection.spec.ts)

- 10 focused tests covering hero forcing, scanned-only constraint, hero/near caps, distance thresholds, and detail-override rules.

### Updated [src/app/component/asteroid.ts](src/app/component/asteroid.ts)

- Added inputs `renderTier` (`AsteroidRenderTier`, default `'near'`) and `detailOverride` (`number | null`).
- `resolveAsteroidGeometryDetail` now accepts an optional `detailOverride` and clamps it within `[0, scannedDefault]`; octahedron remains capped at 0.
- `activeDetail` computed passes the override through.

### Updated [src/app/scene/ship-exterior-view.ts](src/app/scene/ship-exterior-view.ts)

- Imported `PMREMGenerator` from three and `RoomEnvironment` from `three/examples/jsm/environments/RoomEnvironment.js`.
- Added `installSceneEnvironment` / `disposeSceneEnvironment` that build a PMREM environment from `RoomEnvironment`, assign it to `scene.environment`, and set `scene.environmentIntensity = 0.35`. `scene.background` is left untouched so `BackgroundStars` continues to render.
- Install is attempted in `ngOnInit` and retried lazily in `tickScene` until renderer/scene are available; cleanup in `ngOnDestroy` disposes PMREM + texture.
- Added `asteroidRenderTiers` computed signal driven by camera position + targeted/active-scan IDs.
- Added `resolveAsteroidRenderTier(id)` and `resolveAsteroidDetailOverride(sample)` helpers consumed by the template.
- Added `asteroidDebugTierText` computed for the dev HUD.

### Updated [src/app/scene/ship-exterior-view.html](src/app/scene/ship-exterior-view.html)

- `<app-asteroid>` now binds `[renderTier]="resolveAsteroidRenderTier(sample.id)"` and `[detailOverride]="resolveAsteroidDetailOverride(sample)"`.

### Updated [src/app/page/opening/cold-boot-scan.ts](src/app/page/opening/cold-boot-scan.ts)

- Exposed `asteroidDebugTierText` from the scene view.

### Updated [src/app/page/opening/cold-boot-scan.html](src/app/page/opening/cold-boot-scan.html)

- Added a `TIER //` debug line under the existing asteroid debug HUD section.

### Updated [angular.json](angular.json)

- Bumped `anyComponentStyle` budgets from 7kB/8kB to 10kB/12kB to accommodate the dev-only debug HUD styling introduced in Change Set 2 (the previous limit caused the production budget check to fail even though no production-visible CSS grew in Phase 2).

### Validation

- `npm test -- --include="**/asteroid-tier-selection.spec.ts"`: 10 SUCCESS, 0 FAILURES.
- `npm run test:ci`: 1301 SUCCESS, 0 FAILURES.
- `get_errors` clean on all touched files.

## Handoff - Next Session Entry Point

State at handoff: Phase 1 + Phase 2 (env map + LOD tiering + dev debug HUD) merged, `npm run test:ci` green (1301 SUCCESS), template typecheck via `npm run build` clean (only ran into a CSS budget cap which has been raised).

Recommended next actions (Phase 3 - frame-pressure & polish):

1. Add a lightweight frame-pressure sampler in `ShipExteriorViewScene` (rolling avg of `delta` from `beforeRender`) and a `qualityScaler` signal in `[0, 1]`.
2. When `qualityScaler` drops below a threshold, downgrade in order: background -> near -> hero never. Plumb through `assignAsteroidRenderTiers` via a new optional cap multiplier.
3. Optional: swap `RoomEnvironment` for a procedural starfield panorama or a small HDR equirect asset under `public/` if reflections look too neutral against the deep-space background.
4. Wire the same tier system into upcoming scene props (ship parts, pirate ships, stations) so the scene-wide budget policy in `docs/asteroid-visual-fidelity-research.md` actually holds at 5-20 asteroids + 5-20 ship parts + 2-7 pirate ships.

Files most relevant to continue from:

- [src/app/scene/ship-exterior/asteroid-tier-selection.ts](src/app/scene/ship-exterior/asteroid-tier-selection.ts) - tier math, extend with cap multiplier for frame-pressure.
- [src/app/scene/ship-exterior-view.ts](src/app/scene/ship-exterior-view.ts) - env map install + per-frame hook would live here.
- [src/app/component/asteroid.ts](src/app/component/asteroid.ts) - `renderTier` / `detailOverride` inputs already in place.
- [docs/asteroid-visual-fidelity-research.md](docs/asteroid-visual-fidelity-research.md) - scene-wide budget policy reference.
