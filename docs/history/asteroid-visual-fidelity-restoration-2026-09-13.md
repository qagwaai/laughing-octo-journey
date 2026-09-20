# Asteroid Visual Fidelity Restoration Plan

Date: 2026-09-13

Status: Complete - all six phases validated by the user (build, lint, TypeScript, unit tests, full E2E suite, and manual visual validation)

Owner: Gameplay + Scene Rendering

Validation owner: User

## 1. Purpose

Restore player-visible parity between the historical asteroid visual-fidelity
work and the currently active ship-exterior renderer.

The repository already contains substantial fidelity foundations:

- Catalog PBR profiles.
- Deterministic mesh-profile generation and persistence.
- Deterministic SW-13B visual artifacts and gates.
- Scan-reveal geometry helpers.
- Asteroid render-tier and frame-pressure policy helpers.

The active ship-exterior route currently renders through the imperative
Three.js path in `src/app/scene/ship-exterior/ship-scene-context.ts`. The
primary objective is therefore to integrate and reconcile the existing
foundation with that renderer rather than reimplement the feature in a second
isolated path.

## 2. Validation and handoff policy

The user will perform all validation:

1. Builds.
2. Unit tests.
3. End-to-end tests.
4. Manual visual validation.

There is an npm development server already running and watching for changes.
The implementation agent must not start or stop another server and must not
run builds or tests unless the user explicitly requests it.

At each phase boundary, implementation work stops and a handoff is provided.
The handoff must include:

- What changed.
- Files and behavior affected.
- Focused validation recommendations.
- Known limitations or expected failures.
- The exact point at which the user can validate.

The next phase begins only after the user reports validation results or
explicitly asks to continue without validation.

## 3. Current-state baseline

| Area | Current state | Restoration implication |
|---|---|---|
| Material profiles | `roughness`, `metalness`, and emissive boosts exist in the catalog | Reuse the catalog in the active renderer |
| Angular asteroid component | Contains scan reveal, displaced rock geometry, PBR resolution, and tier inputs | Treat as reference behavior or extract shared pure helpers |
| Active asteroid renderer | `ShipSceneContext` uses a simpler imperative Icosahedron path | Main integration target |
| Mesh profile persistence | Generated, upserted, resumed, and tested | Pass the persisted key into active mesh construction |
| Tier policy | Hero/near/background helper and caps exist | Wire policy into active render synchronization |
| Environment reflections | No active ship-exterior environment setup found | Add scene-level environment support |
| Diameter scale | Diameter is persisted and displayed, but not used for mesh scale | Implement as a separate phase |
| Deterministic SW-13B artifacts | Generators, metrics, manifests, and tests exist | Preserve deterministic inputs and use them for geometry identity |
| Validation coverage | Helper-level tests exist; active renderer parity assertions are limited | Add targeted renderer tests only where needed |

## 4. Implementation principles

1. Keep one authoritative active rendering path.
2. Reuse existing catalog, mesh-profile, deterministic-seed, and tier helpers.
3. Preserve pre-scan readability and current mission behavior.
4. Keep targeted and actively scanned asteroids highest priority.
5. Prefer pure functions for scale, material, tier, and profile resolution.
6. Avoid backend contract changes unless an existing field is insufficient.
7. Preserve fallback behavior for old persisted asteroid records.
8. Dispose generated geometries, materials, and environment resources correctly.
9. Do not make visual fidelity dependent on a successful network round trip.
10. Keep each phase independently reviewable and reversible.

## 5. Phase status table

Update this table after each phase handoff.

| Phase | Scope | Status | Implementation complete | User validation | Handoff |
|---|---|---|---|---|---|
| 0 | Renderer contract and baseline reconciliation | Validated | Scene sample contract preserves `meshProfileKey` and `estimatedDiameterM`; layout signatures include persisted visual inputs; bare-scene component unchanged | User completed Phase 0 validation; two unrelated navigation E2E follow-ups remain tracked separately | Complete |
| 1 | Active scan-reveal geometry parity | Validated with follow-up | Active imperative renderer switches from low-detail preview geometry to deterministic displaced rock geometry after scan; persisted mesh-profile scale is applied; bare-scene component unchanged | User confirmed build, lint, TypeScript, unit tests, E2E suite except the known navigation timeout, and manual visual validation | Complete; unrelated navigation follow-up remains |
| 2 | Active material/PBR parity | Validated with follow-up | Active renderer resolves scanned materials from the canonical catalog, applies catalog color/roughness/metalness/emissive boost, and preserves hover/target overrides; bare-scene component unchanged | User confirmed build, lint, TypeScript, unit tests, E2E suite except the known navigation timeout, and manual visual validation | Complete; unrelated navigation follow-up remains |
| 3 | Tier caps, environment, and frame-pressure integration | Validated with follow-up | Active synchronization assigns hero/near/background tiers with throttled recomputation; frame-pressure near-cap degradation; `scene.environment` provides PBR reflections to all current and future scene materials (ship, stations, gates, asteroids) via three.js's standard pipeline, with no per-object envMap wiring or per-frame shader-recompile logic; bare-scene component unchanged | User confirmed build, lint, TypeScript, unit tests, E2E suite except the single known navigation timeout, and manual visual validation | Complete; unrelated navigation follow-up remains |
| 4 | Diameter-driven scale reveal | Validated with follow-up | Added `resolveAsteroidDiameterRadius()`: a pure, clamped logarithmic mapping from `estimatedDiameterM` (real generated range 40m-9,400m) directly to a 0.16-0.62 scene-unit base radius, making diameter the dominant, primary driver of a scanned asteroid's rendered size; the pre-existing rarity/random jitter is reduced to a small ±10% secondary variation layered on top instead of competing with (and previously inverting) the diameter-based size ordering; applied only after scan completion (unscanned asteroids keep the legacy jitter-only radius so no physical data leaks pre-scan); target/hover/scan-state scale multipliers preserved unchanged; focused unit tests cover missing/invalid input, lower/upper boundaries, typical values, determinism, diameter dominating over rarity, and the pre/post-scan gating; bare-scene component unchanged. Corrected mid-phase after user visual feedback showed a 294m asteroid rendering larger than a 5.25km one under the initial (too-weak, scale-only) multiplier approach | User confirmed build, lint, TypeScript, unit tests, E2E suite except the known navigation timeout, and manual visual validation. User separately observed a closer 294m asteroid appearing larger on screen than a farther 5.24km asteroid; verified the underlying modeled radius is correctly diameter-driven (5.24km resolves to ~1.74x the radius of 294m) and the apparent-size inversion is expected camera-perspective behavior from independently randomized depth placement (up to ~2.19x distance variance), not a sizing defect. User accepted this as intended, physically-modeled behavior rather than adding distance compensation | Complete; unrelated navigation follow-up remains |
| 5 | Persistence/resume and deterministic parity closure | Validated | **Significant finding**: investigation revealed `ShipSceneAsteroidSample.estimatedDiameterM` (the field Phase 0 added and Phase 4's `resolveAsteroidDiameterRadius()` reads) was never actually populated for real gameplay samples - only in unit test fixtures. `AsteroidScanSample` (mission/model layer) had no top-level `estimatedDiameterM`; diameter only lived nested inside `capturedKinematics`/`revealedKinematics`. Because `AsteroidScanSample[]` is passed directly into `setAsteroidSamples()` (typed for `ShipSceneAsteroidSample[]`), TypeScript's structural typing silently allowed the mismatch since the field is optional, so at runtime it was always `undefined` - meaning Phase 4's diameter-driven sizing was never actually live in production; the user's earlier Phase 4 visual validation was unknowingly validating legacy jitter-based sizing, not diameter-driven sizing. Fix: added `estimatedDiameterM?: number \| null` to `AsteroidScanSample`; populated it in `generateAsteroidSamples()` (fresh samples, from `capturedKinematics.estimatedDiameterM`) and `createResumedAsteroidSamples()` (resumed samples, from the already-resolved `resolvedKinematics.estimatedDiameterM`, preferring the persisted server value) in `first-target-ship-exterior-mission.ts` (also covers `generic-exploration-ship-exterior-mission.ts`, which delegates to it); added `estimatedDiameterM` to `AsteroidScanRevealSample` and refreshed it from the authoritative revealed kinematics in `AsteroidScanRevealController.revealScannedAsteroid()` so scan completion keeps it in sync. `ship-exterior-cold-boot-asteroid-seed.ts` and the bare-scene component's `setAsteroidSamples()` call sites needed no changes (pure passthrough). Focused unit tests added for fresh-generation top-level diameter, resumed-sample persisted-diameter preference, and scan-reveal diameter refresh. Bare-scene component unchanged | User observed a screenshot pair (978m in front, 3.02km behind) where the closer, smaller asteroid appeared larger on screen. Verified the modeled radii are correctly ordered (978m -> ~0.429 units, 3.02km -> ~0.524 units, ~1.22x difference, compressed by the log-scale mapping across the 40m-9,400m range) and confirmed the apparent-size inversion is expected camera-perspective behavior from independently randomized depth placement, consistent with the same finding accepted during Phase 4. User confirmed this is now genuinely diameter-driven (not coincidental legacy jitter, per the Phase 5 wiring fix) and accepted it as-is; no change to the log curve or the camera-distance jitter range. User confirmed build, lint, TypeScript, unit tests, **full E2E suite fully green (including the previously-tracked navigation-timeout flake, which did not reproduce this run)**, and manual visual validation | Complete |
| 6 | Final validation readiness and documentation closeout | Validated | Recorded final constants table (diameter range, radius bounds, jitter spans, tier caps/distances, tier recompute cadence, frame-pressure sampling window/threshold, environment intensity) sourced directly from the shipped code; documented the Phase 3 PMREM/per-frame-shader-recompilation design decision explicitly (single `scene.environment` texture assigned once at scene init, no per-object envMap wiring, no per-frame recompilation); expanded deferred/out-of-scope list to record the two user-accepted design decisions (camera-distance perspective behavior, log-curve mid-range compression) so they are not mistakenly revisited as bugs; updated top-of-document status line | User confirmed no further changes are needed; restoration effort closed | Complete |

Status values should be one of:

- `Not started`
- `In progress`
- `Blocked`
- `Implementation complete - awaiting user validation`
- `Validated`
- `Validated with follow-up`

## 6. Phase 0 - Renderer contract and baseline reconciliation

### Objective

Establish the exact data and lifecycle boundary used by the active imperative
renderer before changing visual behavior.

### Planned work

1. Trace `ShipSceneAsteroidSample` from mission hydration through
   `ShipSceneContext`.
2. Add only missing render-facing fields required by the existing contracts,
   especially:
   - `meshProfileKey`.
   - Full material information or a safe catalog lookup path.
   - Estimated diameter.
   - Any scan-reveal metadata needed by the renderer.
3. Confirm how camera position, target state, hover state, and scan state reach
   `syncAsteroidVisuals`.
4. Identify shared pure helpers that can be reused without duplicating
   Angular-only component behavior.
5. Preserve the current fallback rendering path while the new path is built.

### Acceptance criteria

- The active renderer can receive all data needed for visual parity.
- Existing records without new optional fields still render.
- No mission or persistence behavior changes are introduced.
- The intended ownership of geometry creation, material resolution, and tier
  assignment is explicit.

### User handoff

Stop after the contract and wiring changes are complete. The user can inspect
the diff, run the watcher-driven build/type diagnostics, and run the focused
mission/persistence tests before geometry changes begin.

### Completion record

Phase 0 is complete. It introduced no intentional visual behavior changes and
preserved the clean orchestration boundary of
`src/app/scene/ship-exterior/ship-exterior-bare-scene.component.ts`.

The E2E navigation failures reported during validation remain separate
follow-up items because they involve hangar/menu navigation and the Phase 0
files do not participate in those flows. They should not block the start of
Phase 1 unless they become reproducible as a Phase 1 regression.

## 7. Phase 1 - Active scan-reveal geometry parity

### Objective

Make the active renderer visibly change asteroid geometry when scanning
completes, matching the established deterministic reveal behavior.

### Planned work

1. Keep pre-scan asteroids low-detail and readable.
2. Resolve preview geometry from the persisted mesh profile where available.
3. Resolve a deterministic revealed geometry from:
   - `meshProfileKey`, or
   - the stable asteroid ID fallback.
4. Reuse or extract the deterministic rock-generation behavior currently
   represented in `src/app/component/asteroid.ts`.
5. Retain scan pulse, hover rings, target rings, orbit, and spin behavior.
6. Ensure generated geometry is cached safely and disposed with the scene.
7. Keep geometry detail bounded by the active tier.

### Acceptance criteria

- An unscanned asteroid remains low-detail.
- A scanned asteroid changes geometry deterministically.
- The same asteroid/profile produces the same revealed geometry after resume.
- Targeting and scan overlays remain functional.
- Geometry does not leak when asteroid layouts are rebuilt or scenes are
  disposed.

### User handoff

Stop after active geometry reveal is integrated. The user can validate the
scan transition, repeated scans/resume behavior, geometry readability, and
focused component/mission tests.

### Completion record

Phase 1 is complete. The user confirmed:

- Build passes.
- Lint passes.
- TypeScript validation passes.
- Unit tests pass.
- Manual visual validation passes.
- E2E validation passes except for the known
  `ship-exterior-flight-position-persistence.spec.ts` navigation timeout in
  `GameShellPage.openNav()`.

The remaining timeout occurs while scrolling a visible Mission Board menu
button into a stable position and does not exercise asteroid geometry. It is
tracked as an unrelated navigation/test-stability follow-up and does not block
Phase 1 completion.

### Phase 1 implementation preparation

Before editing, establish these boundaries:

1. Keep orchestration in `ShipSceneContext`; do not add geometry-generation
   policy to the bare-scene component.
2. Extend `ShipExteriorAsteroidVisual` or introduce a focused geometry
   descriptor so geometry decisions remain testable without a WebGL context.
3. Reuse the canonical mesh-profile parser/resolver and deterministic
   displacement behavior from `src/app/component/asteroid.ts` or extract only
   the pure portions needed by the imperative renderer.
4. Preserve the current low-detail pre-scan path as the fallback for missing
   or legacy profile keys.
5. Identify the existing asteroid mesh ownership and disposal points in
   `ship-scene-context.ts` before adding cached geometry or materials.
6. Add focused Vitest coverage for preview-versus-revealed geometry identity,
   deterministic profile resolution, legacy fallback, and layout rebuild
   disposal behavior.

The Phase 1 implementation handoff will occur before any material catalog or
environment-reflection changes are introduced.

## 8. Phase 2 - Active material and PBR parity

### Objective

Use the material catalog in the active renderer so scan completion reveals
material-specific surface response.

### Planned work

1. Resolve the catalog material by the sample's revealed material name.
2. Apply catalog `roughness`, `metalness`, and `emissiveBoost`.
3. Preserve intentionally low-information pre-scan color and material values.
4. Preserve targeted, targeting, and hover presentation overrides.
5. Keep safe defaults for incomplete or legacy material records.
6. Ensure material instances are updated or replaced without leaking old
   resources.

### Acceptance criteria

- Pre-scan asteroids do not reveal their material.
- Scanned metallic and rocky materials have visibly different PBR response.
- Uranium and Unobtainium emissive boosts remain bounded and readable.
- Target and hover states continue to override presentation appropriately.
- Material resolution is deterministic for the same sample data.

### User handoff

Stop after active PBR material integration. The user can validate representative
material appearances, hover/target readability, and focused catalog/rendering
tests.

### Completion record

Phase 2 is complete. The user confirmed:

- Build passes.
- Lint passes.
- TypeScript validation passes.
- Unit tests pass.
- Manual visual validation passes.
- E2E validation passes except for the known
  `ship-exterior-flight-position-persistence.spec.ts` navigation timeout.

The remaining failure occurs in `GameShellPage.openNav()` while the navigation
button is detached during `scrollIntoViewIfNeeded()`. It remains a
navigation/test-stability follow-up and does not exercise active asteroid
material or PBR behavior.

## 9. Phase 3 - Tier caps, environment, and frame-pressure integration

### Objective

Bring the documented scene-wide quality policy into the active renderer.

### Planned work

1. Call `assignAsteroidRenderTiers` from the active scene synchronization path.
2. Supply:
   - Current camera position.
   - Targeted asteroid ID.
   - Active scan asteroid ID.
   - Scan eligibility policy.
3. Enforce the existing hero and near caps.
4. Map tier decisions to active geometry detail and secondary effects.
5. Integrate the existing frame-pressure quality scaler or equivalent helper.
6. Degrade background and near quality before hero quality.
7. Add a lightweight scene environment for PBR reflections.
8. Keep the starfield visual background independent from `scene.environment`.
9. Dispose environment textures, PMREM resources, and generated materials on
   scene teardown.

### Acceptance criteria

- Hero count never exceeds its configured cap.
- Near count never exceeds its configured cap.
- Targeted and actively scanned asteroids receive hero priority within policy.
- Frame pressure reduces lower tiers first and does not remove hero priority.
- Metallic materials receive environment reflections.
- Existing starfield and camera behavior remain intact.

### User handoff

Stop after live tiering, environment lighting, and frame-pressure behavior are
integrated. The user can validate scene responsiveness, tier transitions,
reflection quality, and focused tier/environment tests.

### Completion record

Phase 3 is complete. The user confirmed build, lint, TypeScript, unit tests,
manual visual validation, and a full E2E run with a single failure: the
previously-documented full-suite-only navigation timeout in
`GameShellPage.openNav()`.

Design decision recorded during this phase: `scene.environment` (rather than
per-object `envMap` assignment) is the intended mechanism for PBR reflections,
so all current and future PBR-capable scene materials — ship, stations, gates,
and asteroids — receive reflections automatically through three.js's standard
material pipeline as those object types grow in complexity, without per-object
wiring. An initial attempt to scope environment reflections to asteroid
materials only (to investigate a since-superseded regression) was reverted in
favor of this scene-wide approach once the actual regression cause (per-frame
tier recomputation cost, not `scene.environment` itself) was identified and
fixed separately via throttled tier recomputation.

## 10. Phase 4 - Diameter-driven scale reveal

### Objective

Make physical size differences legible after scan without allowing extreme
values to destabilize the scene.

### Planned work

1. Add a pure, clamped logarithmic mapping from `estimatedDiameterM` to a
   scene-scale multiplier.
2. Apply diameter scaling only after scan completion.
3. Preserve deterministic mesh-profile scale as secondary variation.
4. Preserve target, hover, and reveal-pulse scale multipliers.
5. Define safe lower and upper bounds for camera readability and clipping.
6. Add focused tests for:
   - Missing/invalid diameter.
   - Lower boundary.
   - Typical values.
   - Upper boundary.
   - Deterministic repeated resolution.

### Acceptance criteria

- Small and large scanned asteroids are visibly distinguishable.
- Pre-scan scale does not expose hidden physical data.
- Extreme diameter values remain within safe scene bounds.
- Existing targeting and scan effects remain legible.

### User handoff

Stop after diameter scaling is integrated. The user can validate relative size
readability, close-pass clipping, far-field composition, and scale boundary
tests.

## 11. Phase 5 - Persistence, resume, and deterministic parity closure

### Objective

Confirm that the active renderer consumes the same visual identity across new,
resumed, and legacy asteroid records.

### Planned work

1. Confirm new samples pass mesh profile and visual metadata into the active
   renderer.
2. Confirm resumed records prefer stored `meshProfileKey`.
3. Confirm records without a stored key use deterministic local fallback.
4. Confirm material and diameter values survive the upsert/resume path.
5. Compare active-renderer output inputs for:
   - Fresh deterministic generation.
   - Resume with stored profile.
   - Resume without stored profile.
6. Add or update focused tests for the active renderer state and persistence
   boundary.
7. Remove obsolete duplicate paths only if the active behavior is proven
   equivalent and the removal is low risk.

### Acceptance criteria

- New and resumed asteroids retain stable visual identity.
- Legacy records remain renderable.
- No backend schema migration is required for the restored behavior.
- Deterministic generation remains unchanged unless intentionally documented.
- Active rendering no longer silently ignores persisted visual profile data.

### User handoff

Stop after persistence and deterministic parity closure. The user can validate
new-session and resume flows, backend mock/socket payload behavior, and the
focused regression suite.

## 12. Phase 6 - Final validation readiness and documentation closeout

### Objective

Prepare the feature for the user's complete validation sequence and record the
final implementation decisions.

### Planned work

1. Update this status table with implementation and handoff results.
2. Record final constants:
   - Geometry detail limits.
   - Hero and near caps.
   - Tier distances.
   - Frame-pressure thresholds.
   - Diameter scale bounds.
   - Environment intensity.
3. Update the historical plan only where links or current architecture need
   correction; do not rewrite historical records.
4. Document known visual limitations and any intentionally deferred work:
   - Normal maps.
   - Space-specific HDR content.
   - Shader displacement.
   - Cross-entity shared budgeting beyond asteroids.
5. Provide the final user validation checklist.

### Final implementation constants (as of Phase 6 closeout)

| Constant | Value | Source |
|---|---|---|
| Diameter input range | 40m - 9,400m | Real range produced by `generateRandomAsteroidKinematics()`; matches `ASTEROID_DIAMETER_MIN_M`/`ASTEROID_DIAMETER_MAX_M` in [ship-exterior-asteroid-visuals.ts](/c:/Development/Projects/Github/laughing-octo-journey/src/app/scene/ship-exterior/ship-exterior-asteroid-visuals.ts) |
| Diameter-driven base radius bounds | 0.16 - 0.62 scene units | `ASTEROID_DIAMETER_RADIUS_MIN`/`ASTEROID_DIAMETER_RADIUS_MAX`, mapped via a clamped logarithmic curve in `resolveAsteroidDiameterRadius()` |
| Secondary (post-scan) rarity/random jitter | ±10% (span 0.2) around the diameter-driven radius | `ASTEROID_RADIUS_SECONDARY_JITTER_SPAN` |
| Pre-scan (unscanned) radius | Legacy rarity/random jitter only, no diameter influence | `deriveAsteroidVisuals()` gating on `sample.scanned` |
| Targeted-asteroid radius boost | +8% (`* 1.08`) | `deriveAsteroidVisuals()` |
| Geometry detail levels | 0 (pre-scan/background) to 2 (targeted/legendary-tier) icosahedron subdivisions | Rarity-tier table in `deriveAsteroidVisuals()` (legendary=2, epic=2, rare=1, uncommon=1, common=0; targeted forces >= 2) |
| Hero tier cap | 3 concurrent hero-tier asteroids | `DEFAULT_ASTEROID_TIER_CAPS.heroMax` in [asteroid-tier-selection.ts](/c:/Development/Projects/Github/laughing-octo-journey/src/app/scene/ship-exterior/asteroid-tier-selection.ts) |
| Near tier cap | 8 concurrent near-tier asteroids | `DEFAULT_ASTEROID_TIER_CAPS.nearMax` |
| Hero tier max distance | 6 scene units from camera | `DEFAULT_ASTEROID_TIER_DISTANCES.heroMaxDistance` |
| Near tier max distance | 14 scene units from camera | `DEFAULT_ASTEROID_TIER_DISTANCES.nearMaxDistance` |
| Tier recompute cadence | Every 6 frames (or on layout change) | `ASTEROID_TIER_RECOMPUTE_INTERVAL_FRAMES` in [ship-scene-context.ts](/c:/Development/Projects/Github/laughing-octo-journey/src/app/scene/ship-exterior/ship-scene-context.ts) |
| Frame-pressure sampling window | 30 frame samples | `FramePressureSampler` default `windowSize` in [frame-pressure-sampler.ts](/c:/Development/Projects/Github/laughing-octo-journey/src/app/scene/ship-exterior/frame-pressure-sampler.ts) |
| Frame-pressure degradation threshold | Average frame time > 24ms (~<42fps) triggers `capMultiplier: 0.5` on near/background tiers (hero never degraded) | `ship-scene-context.ts` tier recompute call site |
| Scene environment intensity | Per-material `envMapIntensity: 0.6`, applied via `scene.environment` (a small procedural gradient `CanvasTexture` with `EquirectangularReflectionMapping`), not per-object PMREM/HDR content | `createAsteroidEnvironmentTexture()` and material construction in `ship-scene-context.ts` |

### Known design decision: no per-frame shader recompilation

During Phase 3 the user raised a concern about a "PMREM environment processing
for every item in the scene" design ambiguity and questioned whether
per-frame shader recompilation was occurring. Confirmed: the implementation
uses a single `scene.environment` texture assigned once at scene
initialization (not PMREM-processed; not reprocessed per object or per
frame). Three.js's standard material pipeline consumes `scene.environment`
directly for all current and future PBR-capable materials (ship, stations,
gates, asteroids) without per-object `envMap` wiring and without triggering
shader recompilation on a per-frame basis. If a future iteration introduces
true PMREM-prefiltered HDR environment maps (e.g. for more physically
accurate roughness-based reflections), that content should still be
processed once (at load or scene-init time) and assigned via
`scene.environment`, not recomputed per frame or per object.

### User validation sequence

The user owns and performs the complete final sequence:

1. Let the existing npm watcher report compile/type/template results.
2. Run the relevant unit tests.
3. Run focused end-to-end tests.
4. Run the broader end-to-end suite as appropriate.
5. Perform manual visual validation:
   - Pre-scan readability.
   - Scan reveal transition.
   - Material response.
   - Target and hover states.
   - Tier behavior under multiple asteroids.
   - Resume consistency.
   - Small/large diameter readability.
   - Scene responsiveness and cleanup.

### Final handoff

Provide a concise completion report containing the updated status table,
validation results supplied by the user, deferred issues, and any recommended
follow-up work. Do not claim builds, tests, E2E checks, or manual validation
were performed by the implementation agent.

## 13. Deferred or explicitly out of scope

Unless validation identifies a blocking need, defer:

1. Backend schema changes beyond already-supported `meshProfileKey`.
2. Normal-map asset production.
3. Custom shader pipelines.
4. High-cost runtime vertex displacement.
5. A complete shared LOD scheduler for every future scene entity.
6. Replacing the existing starfield with an HDR background (or full
   PMREM-prefiltered environment maps in place of the current procedural
   gradient `scene.environment`).
7. Broad renderer refactoring unrelated to asteroid parity.
8. Reducing the independently-randomized asteroid camera-distance jitter
   range to make diameter-driven radius the sole visible size cue - the
   user explicitly reviewed and accepted the current perspective behavior
   (a closer, physically-smaller asteroid can appear larger on screen than
   a farther, physically-larger one) as intended and realistic, on two
   separate occasions (Phase 4 and Phase 5 validation).
9. Adjusting the logarithmic diameter-to-radius curve to reduce mid-range
   compression - the user reviewed the compression (e.g. a 3x real
   diameter difference producing only a ~1.22x radius difference) and
   chose to accept it as-is rather than widen the curve's sensitivity.

## 14. Restart definition of done

The restoration is complete when:

1. The active ship-exterior renderer, not only dormant helper/component code,
   implements scan-triggered geometry reveal.
2. The active renderer uses catalog-driven PBR profiles.
3. Persisted mesh profiles affect resumed asteroid visuals.
4. Hero/near/background tiering and frame-pressure degradation are live.
5. Environment reflections are active without replacing the starfield.
6. Diameter-driven scale variation is implemented and bounded.
7. New, resumed, and legacy asteroid records retain deterministic fallback
   behavior.
8. The user has completed the requested build, unit, E2E, and manual visual
   validation sequence.
9. This document's phase status table is updated with the final outcomes.
