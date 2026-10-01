# Procedural planetary textures: options, decisions, and implementation plan

Date: 2026-09-28
Status: Stages 1-3 implemented and validated. Stage 4 outstanding; a Sol-specific decision is pending (see Stage 3).

## Goal

Stop hot-linking third-party planetary imagery and generate planetary surfaces locally, so that procedurally seeded solar systems can be rendered without a curated per-body asset catalog.

Two goals motivated this work and they are separable:

1. Remove the runtime dependency on `raw.githubusercontent.com/nartc/threejs-earth`.
2. Be able to texture arbitrary, server-seeded bodies that no artist has ever seen.

Only the second requires procedural generation. Both are addressed here.

## Current state

This section records the situation that motivated the work; the files named here were removed in Stage 2.

- `src/app/component/earth-textures.ts` exported two remote URLs (`Albedo.jpg`, `Bump.jpg`) pointing at a third-party GitHub repository.
- `src/app/component/earth.ts` consumed both through an injected `TEXTURE_RESOURCE_FN`, which `src/app/component/earth.vitest.ts` already replaced in tests. This indirection was a usable seam for swapping in a generated source.
- [knot.ts](../src/app/scene/knot.ts) loads the albedo separately with a bare `TextureLoader`, then downsizes the 8192 x 4096 source to 2048 x 1024 (standard) or 1024 x 512 (low) on a canvas before GPU upload, and passes the result to [createMiningBackdrop](../src/app/scene/mining-splash-composition.ts). The splash uses albedo only; it does not request the bump map.
- [mining-splash.vitest.ts](../src/app/scene/mining-splash.vitest.ts) asserts the albedo URL ends in `/Albedo.jpg`. This assertion encodes the remote dependency and must change.
- [solar-system-get.ts](../src/app/model/solar-system-get.ts) already carries `ViewerBodyVisualization.textureKey` and `ViewerBody.planetType`. Both are currently inert: `textureKey` is written as `null` at every producer, and `planetType` is only rendered as text in the viewer detail pane.

Prior context on the splash asset policy, including the outstanding provenance and attribution concern for the borrowed imagery, is recorded in [splash1-2026-09-27.md](./splash1-2026-09-27.md).

## Options considered

| #   | Approach                                                                                              | Verdict                                                                        |
| --- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 1   | Runtime procedural shader evaluated every frame                                                       | Rejected as the primary path; see aliasing analysis below                      |
| 2   | Procedural shader baked once into a render target                                                     | **Chosen**                                                                     |
| 3   | Offline generation pipeline producing committed or CDN-hosted textures                                | Rejected: reintroduces the asset catalog the effort is meant to avoid          |
| 4   | Hybrid offline archetypes with runtime per-seed perturbation                                          | Deferred; viable later if art direction demands it                             |
| 5   | External terrain toolkits such as [synthterrain](https://github.com/NeoGeographyToolkit/synthterrain) | Rejected; see below                                                            |
| 6   | Real NASA/USGS imagery                                                                                | Rejected for general bodies; does not generalize past the handful of real ones |

### Why not synthterrain

synthterrain generates lunar-regolith crater-field digital elevation models for rover and lander simulation. Its output is a heightfield over a small surface patch, not a whole-globe map, and it produces no albedo. The scale and the output format are both wrong for texturing a planet viewed from orbital distance. If crater realism is wanted later, the thing worth borrowing is the crater size-frequency distribution mathematics, not the toolkit.

### Why baking beats a live shader

The decisive factor is filtering, not detail.

A sampled texture receives hardware mipmapping and anisotropic filtering. A procedural shader receives neither, so every high-frequency noise octave that falls below a pixel produces crawling and sparkling as the body rotates. Bodies in this project rotate continuously, so a live shader would shimmer persistently. Mitigations exist (`fwidth`-driven octave fade, analytic-derivative noise) but they are genuine shader work, and baking obtains correct filtering for free.

Secondary reasons:

- Cost scales with screen coverage every frame, forever, for an object that is visually static.
- Surface relief at the terminator is what sells a planet, and that needs normals; deriving them by finite differencing multiplies the noise evaluations per fragment.

Baking keeps the same shader code and the same seed-driven generation while removing all three problems. The costs it introduces are a spawn-time bake hitch and VRAM per distinct body, both of which are managed below.

Detail resolution is explicitly _not_ a concern. Evaluating 3D noise in object space means there are no UV seams and no polar pinching, and [planet-view-scene.ts](../src/app/scene/viewer/planet-view-scene.ts) clamps the camera to roughly 3.2 to 4.2 times body radius, so no surface-level view exists.

## Decisions

### Technique

One GLSL planet shader, evaluated as 3D noise in object space, rendered into a `WebGLRenderTarget` and consumed as an ordinary material map. three.js is on `^0.182.0`, so multi-target render passes are available if albedo and normal are produced in a single pass.

### Dual path: CPU canonical, GPU for speed

An earlier draft of this document treated "bakes need a WebGL context that Vitest cannot provide" as an accepted risk. That was reconsidered, because [mining-splash.spec.ts](../e2e/tests/mining-splash.spec.ts) proves Playwright already exercises real WebGL2 in CI: it waits for `data-state="ready"`, which requires an actual render, and diffs canvas screenshots. CI has no GPU, so Chromium falls back to SwiftShader software rendering, which still provides WebGL2.

The testability question is therefore not GPU versus CPU, but which test tier covers which path:

| Path          | Tier                                   | Covers                                                                              |
| ------------- | -------------------------------------- | ----------------------------------------------------------------------------------- |
| CPU reference | Vitest, no GPU, runs in GitHub Actions | Seeding, climate scalars, noise contract, surface model, rasterisation, determinism |
| GLSL mirror   | Playwright, real WebGL2                | Parity against the CPU reference, determinism, per-seed variation                   |

Rules that follow from this split:

- **The CPU implementation is canonical.** GPU float precision varies by driver, so the GPU path cannot carry an exact-match signature test. The CPU reference defines correct output; the GPU is asserted only within tolerance.
- **The parity test is the anti-drift mechanism.** Two implementations of the same noise math is a real maintenance cost, and the parity test is what makes that cost safe. Most shared logic (hashing, climate scalars, LOD budgets) lives in TypeScript and is written once; only the inner noise and shading loop is duplicated.
- **Lattice values use only the top 16 bits of the hash.** A 16-bit integer divided by 65536 is exactly representable in both float32 and float64, so the noise lattice is bit-identical on both paths and only interpolation and trigonometry can drift.

Measured parity at 128x64, comparing the GLSL mirror against the CPU reference: mean absolute channel error **0.056 / 255**, with **2 outlier pixels out of 8192**. Outliers occur where a texel sits on a hard threshold such as the sea-level boundary, and a tiny elevation difference flips it to a very different colour. Test limits are set roughly an order of magnitude above the observed values to tolerate driver differences while still catching genuine algorithmic drift, which would produce errors in the tens.

The CPU path is not merely a test oracle. It is the runtime fallback for environments without WebGL2, which the splash already supports.

### Two-tier LOD

The dominant consumer is the stellar viewer system scene, which shows a whole solar system at once. This drives the budget, not the detail view.

- [viewer-performance-guardrails.ts](../src/app/scene/viewer/viewer-performance-guardrails.ts) locks a balanced envelope of 16 descriptor entries plus 3 gates.
- [viewer-system-scene.ts](../src/app/scene/viewer/viewer-system-scene.ts) places the camera between 42 and 180 units for the system view.

At those distances a body of roughly 0.5 unit radius subtends on the order of 7 to 20 pixels, and perhaps 60 pixels at closest system zoom. Texturing every body at full resolution would therefore spend most of its memory on detail that is never resolved.

| Tier | Consumer                              | Size        | Maps            | Estimated VRAM                             |
| ---- | ------------------------------------- | ----------- | --------------- | ------------------------------------------ |
| L0   | System view, all bodies               | 256 x 128   | albedo          | ~0.17 MiB per body; ~2.7 MiB for 16 bodies |
| L1   | Planet detail view, focused body only | 2048 x 1024 | albedo + normal | ~10.7 MiB per map with mipmaps             |

VRAM arithmetic, stated explicitly because an earlier figure in discussion was wrong: 2048 x 1024 at RGBA8 is 8 MiB, about 10.7 MiB once mipmaps are included. Albedo plus a full-resolution normal is therefore about 21.3 MiB per body, and an LRU of three would reach roughly 64 MiB rather than the ~36 MiB quoted during the discussion. Storing the normal at half resolution (1024 x 512, about 2.7 MiB) brings a body to about 13.4 MiB and an LRU of three to about 40 MiB. Half-resolution normals are the intended starting point; this is an estimate to be confirmed by measurement.

The same quality tiering already present in the splash (standard 2048, low 1024) should drive bake size rather than a second parallel notion of quality.

### Seeding and the Forge contract

Forge will seed the bodies in a solar system, so there is a contract question about who decides what a planet looks like. That contract is **deliberately deferred**. Nova will derive planet appearance locally, from a deterministic hash of the body `id`, producing climate scalars such as water fraction, ice latitude, surface roughness, and hue bias.

`planetType` and `visualization.textureKey` remain untouched placeholders until the visuals are proven. The contract will then be negotiated from evidence about which parameters actually matter, rather than guessed in advance. The expected eventual split is that Forge owns the seed and coarse classification while Nova owns everything from those numbers to pixels, which keeps the OpenAPI surface small and allows the renderer to change without server changes.

Per repository policy, `openapi.yaml` remains the only contract authority; nothing here changes the contract yet.

### Splash screen

The splash becomes fully procedural and accepts an Earth-like planet rather than a recognizable Earth. No procedural generator will place real continents, and the user accepted that tradeoff in exchange for carrying zero committed assets.

Self-hosting public-domain NASA imagery was considered and set aside. It would resolve the provenance concern raised in [splash1-2026-09-27.md](./splash1-2026-09-27.md) but would not generalize to seeded bodies.

### Archetypes

Stage 1 ships **terran only**. The generator is structured around a `PlanetArchetype` union so further archetypes can be added without reworking the seeding or bake plumbing.

Planned additions, in rough priority order:

| Archetype   | Approach                                                                                                   | Notes                                                         |
| ----------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Barren rock | Reuses the terran elevation model with water disabled and a grey/brown ramp                                | Cheapest addition; also covers most moons in the viewer       |
| Ice         | Terran model with a high-albedo ramp and fracture noise                                                    | Needs a ridged fracture layer rather than mountains           |
| Desert      | Terran model with no ocean and wind-banded striation                                                       | Mostly a colour ramp plus anisotropic noise                   |
| Volcanic    | Terran model plus emissive fissures keyed to the ridged layer                                              | First archetype needing an emissive output                    |
| Gas giant   | **Separate algorithm.** Banded flow with latitude-driven advection and vortices; no elevation model at all | Not a parameter tweak; do not force it into the terran shader |

Each new archetype must extend both the CPU reference and the GLSL mirror, and the parity test should be extended to cover it.

## Implementation plan

Chosen starting point: the splash screen, end to end, as a vertical slice, then generalize to the viewer.

### Stage 1 — Generation core (implemented)

| File                                                           | Role                                                                                      |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| [planet-seed.ts](../src/app/model/planet/planet-seed.ts)       | FNV-1a hash, seeded LCG, and `derivePlanetClimate` producing the terran scalar bundle     |
| [planet-noise.ts](../src/app/model/planet/planet-noise.ts)     | Canonical integer-hash value noise, fBm, and ridged noise                                 |
| [planet-surface.ts](../src/app/model/planet/planet-surface.ts) | Canonical elevation and albedo model, plus equirectangular direction mapping              |
| [planet-texture.ts](../src/app/model/planet/planet-texture.ts) | LOD presets, equirectangular rasteriser, and the decimated drift signature                |
| [planet-shader.ts](../src/app/scene/planet/planet-shader.ts)   | GLSL ES 3.00 mirror and uniform builder                                                   |
| [planet-bake.ts](../src/app/scene/planet/planet-bake.ts)       | GPU render-target bake, WebGL2 capability detection, CPU `DataTexture` fallback, disposal |

Implementation notes worth carrying forward:

- The vertex shader emits clip-space coordinates directly and needs no camera matrices. That lets the parity test drive the exact production shader through raw WebGL2 without three.js.
- The seed reaches the shader as two 16-bit halves rather than an unsigned-integer uniform, so it stays exact regardless of how uniforms are introspected.
- Elevation is evaluated once per texel and reused for both albedo and normal, halving the noise work versus independent passes.
- `renderPlanetPass` saves and restores the previous render target, so baking cannot disturb an in-progress scene render.
- `RawShaderMaterial` bypasses the three.js colour-space and tone-mapping fragment includes, so the bytes written by the GPU match the CPU reference directly. Both paths tag albedo as sRGB and normals as linear.
- `bakePlanetTextures` accepts an optional `preset` that overrides the tier lookup. Unit tests use a tiny preset so they exercise the normal-map path without paying the multi-second L1 raster, which otherwise exceeded the default Vitest timeout under parallel load. The real LOD sizes stay asserted cheaply in the model suite.

Validation performed: 35 Vitest tests across [planet-generation.vitest.ts](../src/app/model/planet/planet-generation.vitest.ts) and [planet-bake.vitest.ts](../src/app/scene/planet/planet-bake.vitest.ts), 5 Playwright tests in [planet-bake-parity.spec.ts](../e2e/tests/planet-bake-parity.spec.ts), plus `npm run build`, `npm run lint`, and `npm run typecheck`. Visual confirmation was done with a throwaway preview harness that rendered lit spheres from several seeds; it produced recognisable continents, continental-shelf gradients, inland lakes, and polar ice caps, with clear variation between seeds.

New e2e specs must be assigned a partition in [check-e2e-partitions.mjs](../scripts/check-e2e-partitions.mjs) or `npm run build` fails its prebuild gate. The parity spec is assigned to `viewer-3d`.

#### Tuning item, since resolved: `waterFraction` was a threshold, not an area fraction

As first shipped, `waterFraction` was compared directly against fBm output. fBm sums several noise octaves, so its output concentrates near 0.5 rather than spreading uniformly. The configured 0.45 to 0.75 range therefore spanned the densest part of that distribution, and small parameter changes swung the land/ocean balance far more than the name suggested. Observed seeds ranged from ocean-dominated worlds to roughly nine-tenths land.

This mattered beyond aesthetics: the name implied an area fraction, and `waterFraction` is a natural candidate for the eventual Forge contract, where that mismatch would mislead. **This was subsequently fixed** — see "Ocean coverage calibration (implemented)" below, which calibrates a per-body `seaLevel` so the parameter means what it says.

### Stage 2 — Splash vertical slice (implemented)

The splash now renders a fully generated world and reaches no third-party host.

- `earth-textures.ts`, `earth.ts`, and `earth.vitest.ts` were deleted. Investigation found the `Earth` component was dead code: no template anywhere referenced `<app-earth>`, and only its own spec imported it. Rather than retrofit a dead component, its useful shape was rebuilt as the reusable [planet.ts](../src/app/component/planet.ts) (`app-planet`), covered by [planet.vitest.ts](../src/app/component/planet.vitest.ts).
- [splash-planet.ts](../src/app/scene/planet/splash-planet.ts) holds the splash body id and per-quality presets. `SPLASH_PLANET_CPU_PRESET` is deliberately only 256x128: a bake with no renderer available runs on the main thread, so the fallback drops to a cheap size rather than blocking first paint for seconds.
- [knot.ts](../src/app/scene/knot.ts) no longer constructs a `TextureLoader` or downsizes through a canvas; it awaits the GLB and calls `bakeSplashPlanet(quality, gl)`. `planet?.dispose()` appears in both the failure and cleanup paths because `disposeMiningObject` releases the texture but not the render target.
- [createMiningBackdrop](../src/app/scene/mining-splash-composition.ts) now also accepts an optional `normalMap`, which the standard quality tier supplies.
- [mining-splash.spec.ts](../e2e/tests/mining-splash.spec.ts) dropped its `**/Albedo.jpg` route and now asserts the splash issues zero cross-origin requests, plus a test that loads the scene with every third-party host aborted.
- The splash planet now rotates. [splash-planet-rotation.ts](../src/app/scene/planet/splash-planet-rotation.ts) holds `SPLASH_PLANET_ROTATION`, a plain list of 25 body ids (not curated for looks; edit freely). `MiningSplashState.planetBodyId` picks one per page load, so retries keep the same world, and the overlay exposes it as `data-planet`. `?splashPlanet=<id>` pins any id, listed or not; the splash e2e specs pin `nova-splash-homeworld` for repeatability. Future archetypes can extend the entries into `{ bodyId, archetype }` pairs.

Terran clouds are now a separate, slowly rotating cloud shell above each generated globe in the splash, system viewer, and planet detail view. [planet-clouds.ts](../src/app/scene/planet/planet-clouds.ts) generates a deterministic mask from the body id and updates coverage without regenerating the noise or the planet surface. The shared visual drift rate is approximately one revolution per ten minutes of rendered time, independent of planet diameter; this is a visual choice rather than a physical atmospheric model. The splash overlay exposes a clouds checkbox and a 0-100% coverage slider; the shared in-memory settings follow the user between views but are not a Forge contract or persisted server data. Use `?splashPlanet=<id>` to pin the world while comparing settings. Reduced-motion mode stops cloud drift.

The splash overlay also offers a mutually exclusive thin/high or thick/obscuring cloud style. Thick clouds use a separately seeded, pale, swirled mask over the same shell, with near-total coverage (98%) by default; changing styles retains each style's own coverage setting. Both use the same ten-minute drift rate, and the selection applies to generated worlds in all three views. This is a Nova visual experiment, not a Venus archetype or Forge parameter.

The splash canvas remains on its active render loop while clouds are enabled and visible, even when orbit controls pause cinematic camera drift. The cloud shell therefore continues moving during manual orbit; reduced motion, a hidden scene, disabled clouds, and zero coverage still allow demand rendering.

Local storm prototype: [planet-cloud-storms.ts](../src/app/scene/planet/planet-cloud-storms.ts) gives each world two deterministic, oppositely rotating vortices on its existing cloud shell. Thin storms are small; thick-deck vortices are broad. The material samples the same baked cloud texture at a rotated UV inside each storm, adds a restrained spiral shading cue, and blends to the unmodified sample at its edge, so the cloud pattern moves without rebuilding textures or adding meshes/draw calls. The shell retains its ten-minute drift; storm cores turn in roughly 110 seconds (thin) or 150 seconds (thick). Reduced-motion preference stops both. The shader adds two distance checks per cloud fragment and an extra filtered texture sample plus trigonometry per affected storm fragment; GPU impact, particularly with many visible system bodies, still needs hardware measurements before choosing a production storm count.

A separate storm-activity slider (0-100%, default 60%) scales vortex size independently of cloud coverage and of spin rate, and is shared by both styles and all three views. It updates a shader uniform, so changes neither recompile the material nor regenerate the cloud texture; at 0% each fragment skips the storm sampling entirely. 80% matches the original prototype size; 100% is 25% wider. Like the rest of the cloud settings, it is an in-memory Nova visual control, not a Forge contract.

This stage removed a roughly 4.4 MB network transfer, the transient CPU decode of an 8192 x 4096 JPEG, an entire network failure mode that previously forced the poster-and-retry path, and the unresolved third-party attribution question.

#### Lesson: the parity test could not see a three.js-level failure

The first live run of the splash showed a dark, featureless sphere even though every unit test, the parity spec, lint, and the build were green. three.js prepends its own preamble to `RawShaderMaterial` sources:

```text
#define SHADER_TYPE RawShaderMaterial
#define SHADER_NAME
#version 300 es        <- no longer line 1, so compilation fails
```

Both shaders failed to compile, `drawElements` was a no-op, and the bake returned the cleared render target. The parity spec did not catch it because it compiles the shader sources through raw WebGL2 by design — that is what lets it drive the exact production shader without three.js, but it also means it validates the GLSL and not the way three.js delivers it.

The fix: the sources no longer carry a `#version` directive. The material sets `glslVersion: GLSL3` and lets three emit it, while the parity spec prepends `PLANET_SHADER_VERSION_DIRECTIVE` itself. The guard against recurrence is a new test in [mining-splash.spec.ts](../e2e/tests/mining-splash.spec.ts) that drives the real bake path and fails on any shader-compile or `INVALID_OPERATION` console output. That guard was confirmed to fail when the defect is reintroduced.

The generalizable point: a test that isolates a component for determinism cannot also be the test that proves integration. Both are needed.

### Stage 3 — Viewer generalization (implemented)

Both viewer surfaces now render generated planets: the system view textures every body at L0, and the detail view bakes L1 for the focused body while its moons stay at L0.

New files:

- [planet-surface-resolver.ts](../src/app/scene/planet/planet-surface-resolver.ts) — decides whether a body gets a surface, which archetype it uses, and what its cache key is.
- [planet-texture-cache.ts](../src/app/scene/planet/planet-texture-cache.ts) — the shared cache, the time-sliced bake queue, and the progress signals.
- [planet-surface-progress.ts](../src/app/scene/planet/planet-surface-progress.ts) — the progress readout, used by both views.

Decisions taken during implementation:

- **Progressive swap-in.** The scene appears immediately with flat material colours and each body's texture is swapped in as its bake lands. Nothing blocks on generation.
- **Tier assignment.** System view L0 for everything; detail view L1 for the focused body only, L0 for its moons. The arithmetic is in the two-tier section above: a five-moon system at L1 would cost roughly 128 MiB.
- **One cache across both views** so a body baked in the system view is still warm in the detail view — subject to the renderer caveat below.
- **`createProceduralTexture` deleted.** The detail view previously had its own 2D-canvas banded-gradient generator, which was a second, competing answer to this document's question. Bodies now fall back to a CPU L0 bake when WebGL2 is unavailable, so there is exactly one generator.
- **Incidental fix:** the old `textures` computed created `CanvasTexture` objects and never disposed them. The remaining star glow is now cached per colour and disposed in `ngOnDestroy`.

#### The resolver seam, and Sol

`resolvePlanetArchetype()` currently returns `terran` for every body, but it exists as a named seam so that special-casing is a data change rather than a refactor.

This matters because of a requirement raised mid-stage: **Sol's planets are well known and should stay close to real.** That collides with the archetype deferral, because a convincing Sol needs at least barren rock, ice and gas giant. Two routes remain open and the seam supports either:

1. Hand-tuned procedural parameters per Sol body, which depends on the archetype work landing first.
2. Bundling NASA/JPL public-domain imagery for Sol specifically. This would _not_ reintroduce the provenance problem that motivated this work, because the assets would be committed and public domain rather than hot-linked.

Deciding between these is a prerequisite for Sol, and is best settled before Stage 4 fixes the Forge contract.

#### Defect found by live inspection: textures do not survive a renderer change

Every automated check passed while the detail view rendered its moons **pure black**.

Each `<ngt-canvas>` owns its own `WebGLRenderer` and therefore its own WebGL context. The system view baked L0 textures into its context and cached them; the detail view, a different canvas with a different context, then reused those cached textures as dead handles. The focused planet looked correct throughout because its L1 texture was baked fresh in the detail view's own context — which is exactly why the failure was easy to miss.

The fix is `adoptRenderer()` in the cache: when a different renderer appears, GPU-baked entries are disposed and re-queued, while CPU-baked `DataTexture`s are kept because they are context-independent.

This is the second consecutive stage where a defect was invisible to a green test suite and visible immediately in a browser, and in both cases the automated tests were not wrong so much as scoped to a single component. A regression test now covers it at the unit level (`discards GPU textures when a different renderer takes over`), and it was verified to fail with the fix reverted.

### Ocean surface fix (implemented)

A splash screenshot showed the oceans rendering bumpy and streaked with fine directional filaments, which is wrong: an ocean is an equipotential surface and should read as smooth. Three separate causes were stacked.

1. **The normal map did not stop at sea level.** `encodeNormal` and the GLSL `NORMAL` branch both took the gradient of `planetElevation` over the whole sphere with no knowledge of water, so seafloor relief was embossed onto the water surface and then amplified by `NORMAL_RELIEF_SCALE`. This was the dominant cause. Both paths now clamp elevation up to `seaLevel` before differencing.
2. **The ridged mountain layer tinted the water.** Ocean colour is a ramp over the same elevation value that carries the ridged term, so underwater mountain ridges were being colour-mapped into the blue. `planetElevation` now attenuates the ridged contribution below sea level with a smoothstep gated on the **continents** value rather than the final elevation — gating on the final elevation would be circular. This also smooths the bathymetry, so it helps cause 1 as well, though the clamp is still needed for a genuinely flat ocean.

   Constants `RELIEF_FADE_BELOW` / `RELIEF_FADE_ABOVE` are exported from `planet-surface.ts` and interpolated into the GLSL so the two paths cannot drift apart silently. The accepted tradeoff is that coastal mountains get partly flattened, which reads as coastal plains and is arguably more realistic.

3. **Uniform roughness.** Water and land shared one roughness value, so water was as matte as dirt. Fixed below.

The parity test does not cover the normal path, so the flat-ocean behaviour is pinned by a unit test (`encodes a flat normal over open water`) that finds texels whose own elevation and all four neighbours are submerged and asserts an exactly flat encoded normal. It asserts a non-zero sample count so it cannot pass vacuously, and it was verified to fail with the clamp reverted.

### Ocean coverage calibration (implemented)

Fixing the first two causes made a second defect obvious: the planets were almost all land. `waterFraction` was being compared directly against the continent field, but that field is a 6-octave fBm and so is roughly **Gaussian around 0.5, not uniform**. A threshold against a Gaussian is not an area fraction, and the measured result bore little relation to the request: one body asked for 0.468 water and rendered 0.288, another asked for 0.684 and rendered 0.935. The parameter barely controlled anything.

`calibrateContinents` now measures each body instead of assuming a distribution. It samples the field on a **Fibonacci sphere** — equal-area sampling matters here, because an equirectangular grid would over-weight the poles and bias every measurement — and derives three scalars: `seaLevel` (the `waterFraction` quantile of the field), `oceanSpan`, and `landSpan`. These replace `waterFraction` in both the CPU model and the shader uniforms.

Three scalars were chosen over a 33-entry CDF lookup table: far less plumbing to mirror into GLSL, and more physically sensible, since ocean coverage is an _area_ fraction while the snow and rock bands are _altitude_ bands.

The measurement is **circular** — `planetElevation` gates its relief fade on the very landmarks being measured — so it is resolved by **fixed-point iteration**. Starting from the continent field alone and then rebuilding the finished elevation and re-taking its quantile converges in three rounds. Skipping the iteration biased coverage low by about five points, because coastal relief lifts near-shore points above the waterline. Final accuracy is within about 0.02 of the requested fraction.

Two consequences worth recording:

- `derivePlanetClimate` now samples noise, so it is **memoized** in a module-level map keyed on `archetype|bodyId`. This is safe because the derivation is pure. `planet-seed.ts` value-imports `calibrateContinents` from `planet-surface.ts`, which only `import type`s back, so there is no runtime cycle.
- The land colour ramp was rescaled from `(e - waterFraction) / (1 - waterFraction)` to `(e - seaLevel) / landSpan`. The old denominator was too large, so `land` peaked near 0.75 and the snow band at 0.78–0.94 was **never reached** — which is why land had been rendering pale and cream.

The sample budget is **1024 points**, chosen by measurement rather than by intuition. Checked against true coverage on a dense grid, 1024 samples land within 0.015 of the request and 4096 only reach 0.013: the residual error comes from the fixed-point iteration, not from sampling noise, so the larger budget bought nothing. That matters because this runs once per body on the main thread before a system view can draw — the budget cut took derivation from 7.1 ms to 2.1 ms per body.

### Water material map (implemented)

The third cause needed a third bake output. `planetMaterial` returns an ORM-style triple — ambient occlusion in red, roughness in green, metalness in blue, matching what three.js reads from `aoMap` / `roughnessMap` / `metalnessMap` — and is mirrored in GLSL behind `PLANET_BAKE_MODE_MATERIAL`. Water is smooth and slightly reflective (roughness 0.2, metalness 0.02), land is matte (0.92, 0), and ice sits between them (0.55). The transition to land completes right at the shoreline so beaches are already dry.

The map is baked only at L1 (`includeMaterial`), since the system view renders bodies too small for a specular highlight to matter. It shares the normal map's half-resolution grid and its elevation evaluation, so it costs no extra noise work.

Two wiring notes:

- Material scalars **multiply** their maps in three.js, so `roughness` and `metalness` must both be 1 for the texture to drive the result. With no map present that would render the body fully metallic and black, so every binding guards with an explicit fallback.
- The splash planet is built imperatively in `mining-splash-composition.ts`, not through the `Planet` component, and had `roughness: 1, metalness: 0` hard-coded. Wiring the map through the component alone changed nothing on screen; this is exactly the class of defect that a green test suite hides and a browser reveals in seconds.

Coverage: the GLSL material path is now parity-tested against the CPU reference in `planet-bake-parity.spec.ts`, `planetMaterial` has unit tests for water-versus-land roughness and channel clamping, and a unit test pins the splash backdrop's map wiring so it cannot silently revert.

### Star colour lighting (implemented)

Once surfaces became physically based, the colour of the light hitting them started to matter. Four problems were found, all of them invisible to the test suite:

1. **Star colour was computed but never lit anything.** Both scenes already resolved a star colour for the glow sprite and the star mesh, but the point light carried no `color` binding, so it was pure white. A red dwarf and a blue giant lit their planets identically.
2. **Secondary stars cast no light at all.** The scenes already rendered a _list_ of star meshes at their own positions, but there was exactly one point light, hard-coded at the origin — so the primary's light did not even come from where the primary was.
3. **Fill lights fought the tint.** The hard-coded cool fills (`#9ec8ff`, `#6f87ad`) outweighed the key light, so tinting the key light alone would not have read.
4. **Distance falloff made the star light inert.** This was the one that mattered most, and only a scene-graph dump found it. The star lights used physically correct falloff (`distance=220, decay=1.7`) while a system is compressed into roughly thirty scene units. A star 38 units out therefore delivered `3 / 38^1.7 ≈ 0.6%` of its nominal intensity. The fills were lighting everything; the star contributed nothing. Correct colour maths over a light that does not reach the planet produces an identical image.

Decisions:

- **Star colour tints lighting only, never the baked texture.** A bake is the body's intrinsic albedo and is cached per body and shared across views, so baking a star tint into it would poison that cache and be wrong the moment the same body were seen under different light.
- **The star's own mesh and glow keep full saturation**; only the _cast_ light is tempered toward neutral (`STAR_TINT_STRENGTH = 0.55`, fills `0.3`). A physically accurate M-dwarf renders an Earth-like world muddy red and makes continents unreadable, which fights the legibility the viewer needs.
- **Fixed intensity budget split across stars**, weighted by `sqrt(luminositySolar)`. Fixed rather than per-star so a binary looks _differently_ lit rather than twice as bright; square-rooted so a bright primary does not crush its companion to invisibility, since the companion is the only thing that makes a system read as binary.
- **No distance falloff** (`STAR_LIGHT_DISTANCE = 0`, `STAR_LIGHT_DECAY = 0`). Inverse-square is meaningless at this scene scale, so star lights radiate evenly and keep only their direction, which is the part that actually reads. Both constants live in `star-lighting.ts` and are bound from there by both templates so the scenes cannot drift.

Contract note: `visualization.colorHex`, `visualization.spectralClass`, `spectralClass` and `luminositySolar` are all contract-backed per body. The precise B−V index `colorIndexBv` exists **only on the system-level `primaryStarSummary`**, not per body, hence the fallback to the Morgan-Keenan class letter. `ViewerBodyVisualization.spectralClass` was missing from the model and was added.

Two wiring notes worth keeping:

- **`[args]` on an angular-three light is constructor-only and not reactive.** `ngt-hemisphere-light [args]="[starFillColor(), ...]"` silently applied nothing — the scene graph showed the three.js defaults (white, intensity 1) rather than the authored values. Reactive colour must use property bindings (`[color]`, `[groundColor]`, `[intensity]`).
- **Dumping the three.js scene graph is the only reliable check here.** Unit tests cannot see three.js, and screenshots of Sol versus an M-dwarf were pixel-identical while the bug was live. Walking `ng.getComponent(document.querySelector('ngt-canvas'))` to the scene and traversing for `isLight` gave the colour, intensity and position of every light, which is what located findings 1 and 4. `STAR_LIGHT_DECAY`/`STAR_LIGHT_DISTANCE` are pinned by a unit test carrying that rationale.

### Stage 4 — Contract

Only after the visuals are proven: propose the Forge parameter contract, driven by which scalars demonstrably changed the result, and update `openapi.yaml` and the models together.

## Risks

- **Bake scheduling.** Sixteen L0 bakes on system load must be spread across frames.
- **Implementation drift.** Two implementations of the same noise math must stay in step. The Playwright parity test is the enforcement mechanism, and any change to the CPU reference must be mirrored in the GLSL and re-validated. Note its blind spot, recorded under Stage 2: it validates the GLSL, not three.js's delivery of it.
- **CPU fallback cost at L1.** A 2048x1024 CPU bake with its half-resolution normal map took roughly six seconds inside the Vitest environment. That is acceptable for a one-off fallback on hardware without WebGL2, but it confirms the CPU path must not run synchronously on the main thread for the detail tier. Web Worker offload is the planned mitigation and is not yet implemented.
- **Context loss under memory pressure.** The two-tier budget exists mainly to avoid this on low-end and integrated GPUs; it needs real measurement, not just the arithmetic above.
- **Cache thrash between views.** Because GPU entries are dropped when the renderer changes, moving repeatedly between the system view and the detail view re-bakes. L0 is cheap enough that this is acceptable today, but a body that is baked, dropped and re-baked on every navigation is worth watching if the system grows.
- **Art direction.** Tuning a parameter space is slower than editing an image. If the generated planets read as unconvincing, option 4's hybrid archetype approach is the fallback, and it reuses the same shader.
- **No persistent preview harness.** Look tuning currently requires writing a throwaway render script. A dev-only preview page would make archetype work substantially faster.

## Validation

Stage 1 and 2 commands:

```bash
npm run test:spec -- src/app/model/planet/planet-generation.vitest.ts src/app/scene/planet/planet-bake.vitest.ts src/app/component/planet.vitest.ts
npx playwright test e2e/tests/planet-bake-parity.spec.ts e2e/tests/mining-splash.spec.ts --reporter=line
npm run build
npm run test:ci
```

Stage 3 commands:

```bash
npm run test:spec -- src/app/scene/planet/planet-texture-cache.vitest.ts
npx playwright test e2e/tests/viewer-planet-surfaces.spec.ts e2e/tests/planet-view-zoom.spec.ts --reporter=line
npm run lint && npm run typecheck && npm run build
npm run test:ci
```

All of the above pass as of this writing: 2231 Vitest tests across 172 files, 20 Playwright tests across the four planet-related specs, and coverage at 80.91 statements / 70.51 branches / 81.89 functions / 80.92 lines against thresholds of 80 / 68 / 80 / 80.

For later stages, per repository policy: focused Vitest specs for the touched units, `npm run build` for template and type checking given the component edits, and the relevant Playwright specs for the affected flows. Because the bake runs on the GPU, a live browser check of the rendered result remains part of the definition of done — the Stage 2 and Stage 3 defects above were both invisible to every automated check that existed at the time.

#### Writing tests that can actually fail here

Two Stage 3 tests initially passed for the wrong reason, and the pattern is worth naming. Asserting that the progress indicator is hidden looks like a completion check, but immediately after the scene loads the bake queue has not been filled yet, so the indicator is legitimately hidden and the assertion passes without a single texture having been generated.

The tests now poll the cache itself and assert a specific surface count, and the indicator's appearance is recorded with a `MutationObserver` rather than raced. When adding tests to this area, prefer asserting on generated output over asserting on the absence of an error.

## Session handoff — 2026-09-28

### Where this stands

Stages 1, 2 and 3 are implemented and validated, along with three unplanned fixes that live inspection turned up after Stage 3: the ocean surface fix, the water material map, and star-colour lighting. Stage 4 has not started.

**The working tree is not committed.** Everything described in this document from Stage 1 onward exists only as uncommitted local changes, including several new untracked directories (`src/app/model/planet/`, `src/app/scene/planet/`), new files (`star-lighting.ts`, `planet.ts`, the two new e2e specs) and this document itself. Committing is the first thing to do next session, before any new work.

### Validation status at handoff

Full sweep run after the star-lighting work, all green:

```bash
npm run build          # clean; only the pre-existing cold-boot-scan.css budget warning
npm run lint           # clean
npm run typecheck      # clean
npm run test:ci        # 2255 tests / 173 files; coverage 80.96 / 70.68 / 81.76 / 80.97
npx playwright test e2e/tests/viewer-planet-surfaces.spec.ts e2e/tests/planet-view-zoom.spec.ts \
  e2e/tests/viewer-scene-rendering.spec.ts e2e/tests/planet-bake-parity.spec.ts \
  e2e/tests/mining-splash.spec.ts --reporter=line   # 40 passed
```

Two pre-existing issues are unrelated to this work and were deliberately left alone: a Prettier warning on `asteroid-scan-detail-panel.html`, and the `cold-boot-scan.css` budget warning.

### Remaining work, in the order it probably wants doing

1. **Commit the working tree.** See above.
2. **Build a dev-only preview harness.** Look tuning currently needs a throwaway render script each time. This is the main drag on the archetype work below, which is the bulk of what remains.
3. **Decide Sol: hand-tuned archetypes versus committed NASA/JPL public-domain imagery.** The plan names this a prerequisite for Stage 4. Note the options are not symmetric: archetypes are needed either way for seeded non-Sol systems, so this decision only settles whether Sol _specifically_ gets committed imagery as a shortcut.
4. **Add archetypes.** `resolvePlanetArchetype()` still returns `'terran'` unconditionally. Planned order: barren rock (also covers most viewer moons), ice, desert, volcanic, then gas giant — which is a separate banded-flow algorithm with no elevation model, not a parameter tweak. Each archetype must extend the CPU reference, the GLSL mirror **and** the parity spec.
5. **Stage 4 — the Forge contract.** Blocked on item 3.

### Smaller open items

- **The star mesh colour still ignores `spectralClass`.** `resolveBodyColor` was left unchanged, so a B-class star casts blue light while the sphere itself may not look blue. Inconsistent, and a small fix.
- **Web Worker offload for the L1 CPU fallback.** A 2048x1024 CPU bake measured roughly six seconds and currently runs on the main thread.
- **Context-loss headroom is still only arithmetic.** The two-tier budget has never been measured on a low-end or integrated GPU.
- **The parity spec has never run on CI or SwiftShader.** Its tolerances were set against one developer GPU, so the first CI run may need them revisited — the failure mode to expect is tolerance calibration, not algorithmic drift.
- **The user has not yet reviewed the Stage 3 or star-lighting changes**; they asked to do that themselves.

### The one lesson that keeps repeating

Four separate defects in this work were invisible to a fully green test suite and obvious within seconds in a browser: the three.js shader preamble breaking `#version`, cached textures dying across renderer changes, the splash planet being built by imperative code rather than the component that was correctly wired, and star lights whose distance falloff delivered 0.6% of their intensity. In every case the automated tests were not wrong, only scoped to a single unit.

Two practices came out of it and are worth keeping:

- **A live browser check is part of the definition of done** for anything that renders.
- **Dump the three.js scene graph rather than compare screenshots.** Walking `ng.getComponent(document.querySelector('ngt-canvas'))` to the scene and traversing for `isLight` gives colour, intensity and position for every light. Screenshots of a G-class and an M-class system were pixel-identical while the star lighting was completely inert; the scene-graph dump found the cause immediately.
