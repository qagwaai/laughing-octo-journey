# Solar System Viewer — Architecture Decision

## Status

Accepted (initial MVP).

### Cygnus X-1 black-hole rendering: accepted 2026-10-25

The user accepted the Stellar Viewer result after removal of the splash-specific
rectangular sky backdrop. The user will commit and push the session changes.

#### Identity, discovery and grouping

- Renderer selection requires exact `catalogIdentity` pairs and compatible
  canonical classification: `cygnus-x1/black-hole` with black-hole body type and
  surface archetype; `cygnus-x1/hd226868` with star type and archetype.
  Entity IDs, display names, texture hints and HYG/HIP/HD numbers are not aliases.
- Forge system ID is `cygnus-x1`; entity IDs are `cygnus-x1-black-hole` and
  `cygnus-x1-hd226868`. HYG 97987 / HIP 98298 / HD 226868 refer to the companion,
  not a separate black-hole catalog record.
- A local catalog entry keeps the system selectable without enlarging the
  distance-limited list request. The existing authenticated system-get flow
  requests it; Forge owns on-demand availability/seeding.
- Group by Type adds localized **Black holes** when bodies of that type exist.
  The order is Star, Planet, Dwarf Planet, Moon, Asteroid, Black holes,
  Trans-Neptunian object, Comet, Station and Ships.
- Viewer and details deduplicate shared `stars`/`bodies` entries by entity ID.
  This supersedes the earlier decision below to defer duplicate Sun handling.
  It does not introduce a general conflicting-record reconciliation policy.

#### Rendering, coordinates and physical meaning

- [Identity and layout selection](../src/app/scene/viewer/cygnus-x1-viewer-profile.ts)
  and the [Angular renderer](../src/app/scene/viewer/viewer-black-hole-renderer.ts)
  reuse the shared bounded ray core, not the splash companion composition.
- The viewer uses a 320 x 267 HDR pass with 256 integration steps. Lifecycle
  ownership includes disposal and renderer-state restoration; reduced motion
  freezes animation. Unsupported HDR produces a logged, visible notice.
- Escaped rays are transparent in the viewer; disk emission and the opaque
  shadow composite into the host scene without a rectangular procedural sky.
  The splash retains its procedural sky. This does not lens other viewer
  objects, and the Schwarzschild approximation omits the actual system's spin.
- Both live canonical positions are authored zero-origin barycentric snapshots.
  Only when both exact identity matches have those placeholders does the viewer
  stage them at separate display positions. Canonical spatial data stays intact,
  and a visible notice states that spacing is not measured or an orbital phase.
  Parent hierarchy and inclination alone do not establish an orbit.
- The 62.6 km Schwarzschild reference is not a measured horizon or disk radius.
  Unknown horizon/disk radii and system coordinates stay unknown; source distance
  remains distinct from system registry distance. Display size is authored.
- All black-hole classifications bypass planetary terrain generation/cache
  retention. Unsupported identities remain selectable generic geometry rather
  than receiving Cygnus imagery or a terran bake.
- No new travel routes, gates, close-up page or physical binary simulation.

#### Validation and remaining handoff

Production build, app/spec typecheck, targeted lint/format, focused unit suites
and mocked Chromium Viewer flows passed. The final shared-core regression ran:

- `npm run test:spec -- src\app\scene\black-hole\black-hole.vitest.ts`:
  **passed, 11 tests**.
- `npx playwright test viewer-list.spec.ts splash.spec.ts --grep 'on-demand Cygnus|renders the opt-in Cygnus' --project=chromium --no-deps --reporter=line --workers=1`:
  **passed, 2 tests**. Contrasting-background pixels verify transparent
  surroundings and an opaque shadow; the splash renderer still works.
- `npm run build` and `npm run typecheck`: **passed**.

Authenticated live reads confirmed both canonical bodies, companion-only
`stars`, exact identities/classifications, stable repeat-read snapshots, and
celestial list limits 1/2 returning one/two bodies respectively. Live UI re-entry
after the terrain-cache correction had no false terran warning or renderer error.
First-time insertion was not proven, and no backend records were reset.

Live GET omits the optional separation, eccentricity and inclination fields,
and omits `orbitalElements` instead of explicitly returning null. The client
does not synthesize them. The companion's physical radius/temperature and
black-hole source references were present. See
[full live findings and source references](./splash1-2026-09-27.md#authenticated-live-handoff-verification-2026-10-25).

Visual acceptance is not full-suite regression, representative hardware
performance, leak-profile or physical Safari/iPad certification. The splash
overlay limitation and other deferred scientific work are recorded in the
[session closeout](./splash1-2026-09-27.md#cygnus-x-1-session-closeout-2026-10-25).

### Station models and close-up navigation: accepted 2026-10-18

User visual confirmation is complete for this session's station-viewer and
close-up navigation changes. Final decisions:

- Resolve models by exact station ID and expected system, never by name, host
  planet, or station family. Initially only `sol-mars-orbit` is registered;
  future IDs may explicitly share model assets.
- Reuse the accepted splash station assets (149,944/74,984 triangles), shared
  decoders, and existing viewer quality policy. Do not deploy the source GLB or
  retired 500k/250k station variants.
- Preserve Forge snapshots and trajectories. Model normalization, enlarged-body
  clearance, and target-camera framing are presentation-only adjustments.
- Keep generic stations unchanged. For registered models, show explicit
  loading/error/retry state without substituting generic visible geometry.
- Use model-scale target framing, precise flight settling, host-outward camera
  approach, and unobstructed overlays so targeting reveals the station.
- Use one accessible close-up path: **Target -> Inspect target -> Open close-up**.
  Place the styled button below the inspected body's name in the inspector
  header, for planets, moons, and registered stations. Inspection remains
  independent of subsequent hover or target changes.
- Remove planet right-click entry and the duplicate station overlay action.
  Both close-up pages provide a visible, touch-sized **Back to system viewer**
  button, including loading/error states. Planet right-click exit remains an
  optional desktop shortcut, not a required interaction.
- Keep the full-pane authenticated close-up route pattern, localized English
  and Italian controls, and explicit ownership/disposal of loaded models.

Visual sign-off does not imply measured cold-cache loading or hardware
performance acceptance, or physical iPad/Safari certification. Automated touch
coverage uses Chromium emulation. Forge Lagrange-point station seeding remains
a separate future placement investigation with clearance/stability validation;
no backend placement changes were made in this session.

### Additional Forge body types: accepted 2026-10-22

User visual validation is complete and accepted.

#### Findings and implemented behavior

- Group by Type uses Star -> Planet -> Dwarf Planet -> Moon -> Asteroid ->
  Trans-Neptunian object -> Comet -> Station -> Ships ordering. The three new
  groups remain visible with zero counts, even in an empty system.
- Forge already supplied these bodies: the fixed group allowlist hid them while
  Sort by Distance retained them. The live Sol snapshot contained five dwarf
  planets and three TNOs; no comet was present.
- All three types use the existing Target -> Inspect target -> Open close-up
  flow and existing body renderers, without new rendering effects. Existing
  planet, moon, and registered-station close-up behavior is preserved.
- Group names are localized in English and Italian. Sort by Distance retains
  its existing rows and sorting behavior; empty distance views retain their
  empty-state message.
- Classification comes directly from Forge's `bodyType`; Nova does not infer
  TNO status from names, orbital distances, or a presumed extrasolar Neptune.
- No Forge contract, payload, canonical classification, or renderer changes
  were required.

#### Validation evidence

- `npm run build`: passed, including Angular template compilation and the E2E
  partition gate.
- `npm run typecheck`: passed for application and Vitest TypeScript.
- `npm run test:spec -- src\app\page\game\solar-system-details.vitest.ts src\app\page\game\viewer-scene.vitest.ts`:
  passed, 44 tests. Coverage includes group order, zero-count groups in empty
  systems, group targeting, Italian labels, inspection, and close-up routing.
- `npx playwright test viewer-interactions.spec.ts --grep "groups, inspects, and opens" --project=chromium --reporter=line`:
  passed, three body-type navigation tests plus authentication setup. Each body
  type is selected from its group, inspected, opened in the existing close-up,
  and returned to the system viewer.
- Focused ESLint on changed TypeScript, focused Prettier checks, and
  `git diff --check`: passed.
- Live Sol validation confirmed Dwarf Planet 5, Trans-Neptunian object 3, and
  Comet 0 groups. Pluto opened in close-up with five moons and no page error.
  The user subsequently completed visual validation.

Automated browser checks use Chromium software WebGL. This acceptance does not
establish cold-cache performance, large-population scalability, or physical
mobile-device certification. A missing Playwright Chromium installation was
restored before the successful browser run; no dependency-manifest changes
were made for this feature.

#### Deferred work and classification guidance

- Duplicate Sun counting remains deliberately unchanged. The details list
  concatenates `stars` and `bodies`, so the Sun can appear twice; handle canonical
  ID deduplication and conflicting-record validation separately.
- Physical-fact presentation remains unchanged. Some catalog radius and mass
  values exist but are not displayed by the current field bindings; reuse the
  existing physical-catalog resolution helpers in a separate change.
- All seven current canonical Forge types now have list groups: `star`,
  `planet`, `dwarf-planet`, `moon`, `asteroid`, `tno`, and `comet`. Future contract
  additions still require explicit frontend review.
- "Trans-Neptunian" is Neptune-relative terminology. A general extrasolar
  outer-system population needs an agreed Forge classification, not a Nova
  distance heuristic.
- Keep scientific type, orbital relationships, and surface appearance separate.
  Jupiter remains a `planet` with a `gas-giant` surface archetype, not a brown
  dwarf. Rogue planets, interstellar objects, and nested/binary relationships
  should not automatically become new top-level groups.
- New stellar subtypes, ring/belt populations, and large-system rendering
  optimizations were discussed as future considerations, not implemented or
  accepted scope. Measure performance before introducing LOD or instancing;
  list discoverability should remain independent of rendering detail.

## Context

The game world has historically rendered only the Sol system through hand-crafted
Angular Three components (`scene/ship-exterior-view.ts`, `component/sol.ts`).
We now need a player-facing way to browse the broader HYG star database that the
backend already exposes via socket events.

A new left-pane navigation item ("Viewer") presents a list of solar systems and,
on selection, drives the right pane to a 3D scene that renders the system's
celestial bodies.

Source data: HYG database (https://codeberg.org/astronexus/hyg) served by the
backend via the socket contracts documented in OpenAPI (`openapi.yaml`,
prefer runtime `http://localhost:3000/openapi.yaml`).

## Decision

### Routing & layout

- Add a left-outlet route `viewer` that loads `page/game/viewer.ts`. This page
  hosts `GuardedLeftMenu` and `CharacterShipBadge`, mirroring `mission-board`.
- Add a right-outlet route `viewer-scene` that loads
  `page/game/viewer-scene.ts`. This is a **wrapper page** that owns the
  `<ngt-canvas>` element and projects the inner scene component as canvas
  content. This convention is mandatory: any Angular Three scene that injects
  the `NgtStore` token (via `NgtsOrbitControls`, `NgtArgs`, `injectStore`,
  etc.) must be route-loaded indirectly through such a wrapper. Loading a
  scene component directly produces NG0201.

### Viewer overlays

- A single scrollable bottom-left information panel contains the hovered/targeted
  body summary, focus status, and a compact two-column legend (one column on narrow
  screens). The legend is expanded initially and can be collapsed.
- Distance mode controls, the full illustrative-orbit disclaimer, and terrain/
  atmosphere sources are separate keyboard-accessible disclosures, closed initially.
  The current distance mode remains visible in its disclosure heading.
- Surface generation progress, texture loading failures, and retry actions appear
  in the panel outside the disclosures, so they are not hidden by collapsed notes.
  Scrolling the panel does not zoom the scene.
- The right-hand scale slider remains independent. Development-only Viewer QA
  controls are collapsed inside the panel; their defaults and URL overrides are
  unchanged. Planetary Lens retains its existing surface-status overlay layout.
- Hover shows identity and available radius, diameter, and semi-major-axis facts
  in the compact panel, not a full detail popup. An explicit "Inspect target"
  button opens a persistent inspector for the navigation target. Inspection does
  not change targeting, and subsequent hover/target changes do not replace the
  inspected body until the button is used again.
- The inspector reserves a 20rem column beside the canvas. In scene panes at most
  700px wide it reserves the bottom 40% instead, without overlapping the canvas.
  Physical, Orbit, Position, gate approach, and developer render information use
  expandable sections. Physical, Orbit, and Position are expanded by default.
  The header/close action stays visible while details scroll;
  inspector scrolling does not zoom the scene. Closing preserves the target.
  While inspecting, the compact Viewer panel's height is capped below the canvas
  center so it cannot obscure a centered target; its contents remain scrollable.

### Menu placement & gating

- A short left-click (at most two pixels of pointer travel) on a rendered body
  or ship uses the same shared target state and camera flight as the list's Target
  button. The nearest clicked object's handler stops propagation to bodies behind
  it. Camera drags, non-left clicks, and empty-space clicks do not select or clear
  targets. Clicking the current target is a no-op. Both panes reflect the shared
  selection, and an open inspector retains its inspected body.

- The Viewer entry is inserted in `GuardedLeftMenu.menuItems` immediately
  after the Mission Board entry, with icon code `VW`.
- `ViewerPage.isViewerUnlocked()` is a predicate that always returns `true`
  for the MVP. The predicate exists as the future hook for entitlement checks
  so the menu structure does not need to change when gating is added.

### Data flow

- `SolarSystemService` (in `src/app/services/solar-system.service.ts`) wraps
  two socket request/response pairs:
  - `solar-system-list-request` / `solar-system-list-response`
  - `solar-system-get-request` / `solar-system-get-response`
- The list page issues a `solar-system-list-request` on `ngOnInit` (using the
  active `playerName` + `sessionKey`) with a default limit of 50 systems and a
  default 50-parsec radius. Selecting a system navigates the right outlet with
  the `solarSystemId` and the cached `SolarSystemSummary` payload in the
  navigation state, allowing the scene host to render summary metadata
  immediately while the body list streams in.
- `ViewerScenePage` reads navigation state in its constructor, requests
  `solar-system-get-request`, and feeds the resulting `ViewerBody[]` into
  `<app-viewer-system-scene>` via inputs.

### Scene rendering

#### Station-specific models

[`station-model-assets.ts`](../src/app/scene/station/station-model-assets.ts)
maps exact station IDs to model definitions. Initially only `sol-mars-orbit`
in system `sol` uses the Mars station GLB. Selection requires a station body
and the registered system; names, host planets, and descriptor families do not
select models. Other stations retain the generic renderer. Add future station
IDs explicitly to this registry; entries may reuse the same asset definition.
Market discovery preserves `MarketSummary.marketId` as `ViewerBody.id`, so this
uses the existing OpenAPI contract without adding messaging fields.

The splash and viewer share the accepted 149,944/74,984-triangle asset pair.
The viewer follows its existing `CatalogSurfaceCache` device/Save-Data quality
policy, rather than introducing another quality selector. Only the selected
tier loads, with Meshopt and self-hosted KTX2 decoders. Models are centered and
normalized at runtime, preserving the station's mapped position and existing
5%-scale convention and invisible picking sphere. Hover and target highlights
apply to the loaded model. Loading and failures do not display replacement
generic geometry; localized status and retry remain available in the panel.
Each renderer owns and disposes its model, including late asynchronous results.

Target flights for dedicated station models use a model-scale zoom floor and
near clipping plane, and approach an anchored station from outside its host.
The endpoint uses the final zoom's display-only host clearance and settles
exactly, avoiding frame-dependent residual offsets. Generic station geometry
profiles do not determine GLB bounds or picking clearance. Station hover stops
hits propagating to the planet behind it, and the scrollable information panel
stays below the centered model, including with the inspector open. Canonical
positions, planetary/moon geometry, and generic-body zoom limits are unchanged.

Future Forge placement consideration: automatically seed suitable stations near
host-system Lagrange points rather than on orbits that visually intersect moons.
This requires a backend placement decision and validation of station/moon
clearance; Lagrange-point selection alone should not be assumed to guarantee
separation or stability. The viewer should continue consuming Forge's
authoritative station snapshots and trajectories, not inventing canonical
positions to compensate. This is a follow-up consideration, not part of the
current rendering or targeting changes.

Target-framing follow-up validation:

- `npm run test:spec -- src/app/scene/viewer/viewer-system-scene.vitest.ts src/app/page/game/viewer-scene.vitest.ts`:
  75 tests passed, including station-specific zoom mapping and unchanged generic limits.
- `npm run e2e:spec -- e2e/tests/viewer-station-model.spec.ts e2e/tests/viewer-controls-after-target.spec.ts e2e/tests/viewer-interactions.spec.ts --workers=1`:
  25 passed; one planet-orbit test failed before scene entry when the cold-boot
  route replaced its navigation. All station tests and post-target control tests passed.
- `npm run e2e:spec -- e2e/tests/viewer-interactions.spec.ts --grep "displays planet orbital elements correctly" --workers=1`:
  2 passed, including setup, on the isolated rerun.
- `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check`: passed.

Target a body, then choose **Inspect target**. The inspector header offers a
clearly styled, touch-sized **Open close-up** button for planets, moons, and
registered stations. The action follows the inspected body even when the target
changes; stars, asteroids, and unregistered stations have no close-up action.
The viewer overlay no longer duplicates the station action, and right-clicking
a planet no longer opens a close-up, leaving the desktop orbit/pan controls
available. Both close-up pages have a visible **Back to system viewer** button,
including during loading or failure, so touch devices need no secondary mouse
button to enter or leave. Planet close-ups retain their optional right-click
exit shortcut, but it is not required or promoted as the primary return path.

Inspector-action validation:

- `npm run test:spec -- src/app/page/game/viewer-scene.vitest.ts src/app/scene/viewer/viewer-system-scene.vitest.ts src/app/page/game/station-view.vitest.ts`:
  83 passed, including supported-body eligibility and navigation from the
  inspected body independently of later targeting.
- `npm run e2e:spec -- e2e/tests/planet-view-zoom.spec.ts e2e/tests/viewer-station-model.spec.ts --workers=1`:
  13 passed, including setup, both station tiers, inspector entry, removal of
  planet right-click entry, planet/moon interactions, and touch-emulated
  tap-to-open/tap-to-return flows for planets and stations. This is Chromium
  touch emulation, not physical iPad/Safari certification.
- `npm run e2e:spec -- e2e/tests/viewer-controls-after-target.spec.ts --workers=1`:
  5 passed, including setup, inspector docking, and desktop orbit/zoom/pan.
- `npm run build`, `npm run typecheck`, `npm run lint`, and `git diff --check`:
  passed after the UI changes.

The authenticated
right-outlet route `station-view/:solarSystemId/:bodyId` owns a dedicated canvas
and reuses the same model and quality policy with inspection lighting. Drag to
orbit and scroll to zoom; there is no automatic rotation. **Back to system**
returns to the system viewer. Direct entry discovers stations through the
existing system/market requests and explicitly reports missing or unsupported
station IDs. This full-pane route follows the existing opaque close-up pattern.

Coverage includes exact identity selection, normalization, resource ownership,
late results, market discovery, both real GLB triangle counts, hover/picking,
generic-station preservation, loading/failure/retry, close-up orbit/zoom, and
return navigation. User visual acceptance was confirmed on 2026-10-18;
cold-cache hardware performance profiling remains outstanding and separate
from these correctness tests.

Implementation validation:

- Focused Vitest regression run: 118 tests passed across 8 files (station
  renderer/close-up, shared assets, viewer facade/page/scene, splash state, routes).
- `npm run e2e:spec -- e2e/tests/viewer-station-model.spec.ts e2e/tests/viewer-interactions.spec.ts --grep "Station-specific|station|inspector" --workers=1`:
  7 passed, including authentication setup.
- `npm run e2e:spec -- e2e/tests/splash.spec.ts --grep "station|foreground" --workers=1`:
  3 passed, including authentication setup.
- `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check`:
  passed. Targeted Prettier checks passed.
- Production output contains only the accepted 150k/75k station GLBs and poster,
  not the source or retired station variants.

- Stars: rendered with `MeshBasicMaterial` (self-lit) sized by
  `sqrt(luminositySolar)` and clamped to a small visible band.
- Non-stars: rendered with `MeshStandardMaterial` lit by a single point light
  at the system origin; size is derived from
  `physicalCatalog.estimatedDiameterM` via cube-root scaling relative to
  Earth's diameter.
- Positions: stored `spatial.positionKm` snapshots are projected directly, without
  orbital reconstruction or parent translation. A display-only proper rotation
  `(x, y, z) -> (x, -z, y)` presents Forge's mathematical XY plane in scene XZ.
  The default proportional mode applies one linear scale: 1 AU (149,597,870.7 km)
  equals five scene units, without minimum distances or position rounding.
  The overlay button switches to the retained compressed overview: distance below
  1 Mkm uses linear scaling with a 0.08 scene-unit minimum; other distances use
  `(1 + log(km / 1e6) / log(6)) * 5`, retaining existing rounding.
  The mode is temporary page state, not persisted to Forge or browser storage.
  Body radii remain enlarged independently of distances in both modes; whole-system
  moon/station separations may be smaller than rendered bodies. Detail view retains
  its separate readability scaling. Snapshot directions and orbital phases are not
  replaced with an evenly spaced illustrative arrangement.
  Bodies, ships, local asteroid offsets, targets and star lights share display space.
  Canonical state, API writes, HYG parsec positions, splash composition, and the
  separate ship-exterior flight pipeline do not use this display transform.
- Guides: native XY geometry uses `Qdisplay * Rz(node) * Rx(inclination) *
Rz(periapsis)`. Detail moon guides use the same orientation and existing readable
  circle radii. System guides in proportional mode use the same linear scale
  without anchored compression or minimum radii. Guides remain illustrative:
  centered ellipse styling does not guarantee snapshot coincidence. Compressed
  mode additionally uses radial compression, anchored scale and minimum radii.
  Only explicit `anchorBodyId` centers a guide; hierarchy is not an inferred anchor.
  Missing orbital metadata uses a reference-plane detail guide. Forge does not
  guarantee physically aligned producer frames or a calculated center of mass.
- Close-range mission readability: in compressed mode, when zoomed in (`zoomLevel < 22`) and the
  current target is an asteroid or a ship, nearby asteroids are temporarily
  reprojected in a **local cluster frame** around the target anchor (derived
  from km offsets) before render. This avoids visual collapse of tightly packed
  asteroid fields at belt-scale barycentric distances while preserving the
  global projection model when zoomed out.
- Camera distance limits, far clipping and backdrop bounds accommodate proportional
  system extents, including ships. New scenes start at overview zoom. Switching
  mode preserves target identity and re-centers the same target in the new display
  space; an untargeted scene resets to overview. Camera tween constraints are
  unlocked during target flight, then return to the zoom-slider distance.
- Color: prefers `visualization.colorHex`; falls back to `#fff5b6` for stars
  and `#9bb1c9` for other bodies.
- All scaling helpers are isolated in
  `src/app/scene/viewer/viewer-formatters.ts` and unit-tested.

### Local Cluster Projection Guardrails

- Activation conditions:
  - Compressed distance mode (disabled for proportional distances)
  - `zoomLevel < 22`
  - `targetBodyId` resolves to either:
    - an asteroid body in the current viewer payload, or
    - a ship with valid spatial state.
- Scope limit: only asteroid bodies within `30,000 km` of the target anchor
  participate in local reprojection.
- Transition behavior: the local projection weight is linearly faded by zoom,
  reaching zero at the threshold to reduce visible popping.
- Non-goals for this phase:
  - No route/scene handoff yet (single-scene approach retained).
  - No backend contract dependency; this is a client-side projection strategy.

### Internationalization

- Keys live under `game.viewer` in `src/app/i18n/locales/en.ts` and
  `it.ts`. The Italian locale follows the existing convention of inheriting
  any unspecified strings from English via the deep merge in `locale.ts`.

## Consequences

- The viewer is decoupled from the existing Sol-specific scene assets and can
  evolve independently (e.g. orbital propagation, multi-star rendering) without
  destabilizing the cold-boot flow.
- Adding new system features (search input, time-of-day slider, body-detail
  panel) only requires extending the page or scene wrapper, not the routing or
  service layer.
- Future entitlement gating only needs to update `isViewerUnlocked()` and the
  menu rendering; the route itself is already authenticated via `authGuard`.

## Operational finding: target-fly snap

### Symptom

- During cinematic body targeting, the camera completed the fly-in and then
  visibly snapped back toward the system origin (sun-facing composition).

### Root cause

- The snap did not come from the tween path itself.
- After target-fly finalize, `NgtsOrbitControls` could be temporarily absent
  (target unavailable), which left camera ownership in a brief handoff state.
- In that state, control re-attachment/default target behavior could reorient
  toward origin unless target/pose were explicitly preserved.

### Fix pattern (keep)

- Preserve a persistent look target across frames (`persistentLookTarget`) and
  re-sync OrbitControls target when controls are present again.
- Persist the settled camera position at target-fly finalize and, while
  a target remains active with no running tween, restore that pose if drift is
  introduced by external camera ownership transitions.
- Do not clear/recenter camera pose when `targetBodyId` is cleared; only cancel
  target-flight state.

### Guardrails for future changes

- Any future camera controller integration must treat target-fly finalize as a
  cross-owner handoff point and preserve both camera position and look target.
- If snap behavior reappears, instrument the timeline around finalize and
  post-finalize snapshots to verify whether controls are absent during handoff.

## Alternatives considered

- **Embedding the scene directly in a route component.** Rejected — Angular
  Three's `NgtStore` is provided by `<ngt-canvas>`, so a scene route without a
  wrapper throws NG0201 at runtime. The wrapper convention is also already
  proven by the cold-boot scan flow.
- **Reusing the existing `Sol` component for non-Sol systems.** Rejected — its
  textures and shader assumptions are Sun-specific. A generic, color-driven
  star sphere keeps the MVP focused.
