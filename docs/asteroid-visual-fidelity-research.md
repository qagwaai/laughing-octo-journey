# Asteroid Visual Fidelity — Research Options

_Research document: May 2026_

## Current Baseline

Understanding the existing system is the foundation for every option below.

| Concern | Current State |
|---|---|
| **Geometry** | 3 primitive kinds: `dodecahedron`, `icosahedron`, `octahedron`. Detail 0 or 1. Max ~80 triangles (icosahedron detail 1). |
| **Material** | `MeshStandardMaterial` with flat `color` (the `textureColor` hex from the catalog) + `emissive` + `emissiveIntensity`. No roughness, no metalness, no normal map, no env map. |
| **Identity** | Each sample already has `serverCelestialBodyId`, and the upsert contract already carries `visualization.textureKey: null` and `composition`. The backend scaffold is ready. |
| **Field size** | 5–20 asteroids per session. Low enough that individual-mesh rendering is fine today. |
| **Seeding** | Fully deterministic from player+character+location+launchSeedHint. Any per-asteroid cosmetic can be derived from the same RNG at no extra cost. |

## Decision Update (May 2026)

After follow-up design review, two conclusions now guide implementation priority:

1. **Scan-triggered detail reveal is the primary UX mechanic**. Asteroids should begin as simple low-poly silhouettes and reveal higher geometry fidelity only when scanning completes.
2. **Performance policy must be scene-wide, not asteroid-only**. Future entity mix (ship parts, pirate ships, stations, mission props) means asteroid detail decisions must be made inside a shared frame budget.

---

## Area 1 — Mesh Level of Detail

### What it would achieve
Rounder, more irregular-looking asteroid shapes. At current detail-0/1 the rocks look obviously like primitive polyhedra. Increasing detail and/or mixing geometry subdivision makes them read as real rocky bodies.

### Option 1-A — Raise the geometry detail parameter (lowest effort)
The `IcosahedronGeometry` and `DodecahedronGeometry` constructors accept a `detail` integer that recursively subdivides each face:

| Geometry | Detail 0 | Detail 1 | Detail 2 | Detail 3 |
|---|---|---|---|---|
| Icosahedron | 20 tris | 80 tris | 320 tris | 1 280 tris |
| Dodecahedron | 36 tris | ~144 tris | ~576 tris | ~2 300 tris |

A detail value of **2** is a practical sweet spot: visually much rounder than detail 1, still cheap. Detail 3 is mostly imperceptible at game scale but measurable on frame time for 20 asteroids simultaneously.

`generateRandomAsteroidRevealProfile` already runs on the seeded RNG, so bumping the pool to include `detail: 2` is a one-line change. The profile is already persisted-by-derived-seed — no server change needed.

**Effort**: Minimal (1–2 lines). **Risk**: None.

### Option 1-B — Three.js `LOD` object (distance-based switching)
Three.js has a first-class `LOD` object. You register multiple mesh objects at distance thresholds and Three switches between them each frame:

```
< 4 scene units  → detail 2 geometry (close pass, scanning)
4–12 units       → detail 1 geometry (normal flight)
> 12 units       → detail 0 geometry (background density)
```

In Angular Three this means wrapping the `<ngt-mesh>` in a custom `<ngt-lod>` element or managing the `LOD` object imperatively via a `viewChild` ref.

This is no longer only a future optimization. Even with 5–20 asteroids, upcoming scene complexity from ships, stations, and parts means LOD should be introduced now as a shared policy.

**Effort**: Medium (new component or ref-based imperative setup). **Risk**: Low. **Recommended now.**

### Option 1-C — Displacement / noise on the geometry (vertex shader)
Real asteroid surfaces have craters and rough topology. You can simulate this by displacing vertices along their normals with a noise function in a custom vertex shader or by using Three.js `BufferGeometry.setAttribute` with vertex offsets computed on the CPU using seeded noise (e.g., Simplex noise).

This produces the most realistic-looking rocks but adds complexity. A pragmatic middle ground: apply a one-time, seeded random per-vertex displacement on the CPU when the scan completes (when the mesh "reveals"), and freeze it. The displacement can be parameterized by material — iron might have flatter, more angular ridges; carbon might be rounder and pitted.

**Effort**: High (custom shader or CPU-side geometry mutation). **Risk**: Medium (need to handle re-use of a mutated geometry across multiple instances). **Recommended as a later-stage polish pass.**

---

## Area 2 — Material-Based Reflection Characteristics

### What it would achieve
Each material type would have a visually distinct surface character. A metallic nickel asteroid should look different from a dull carbon rock or a bright platinum body. Currently the only visual difference is the flat color hex.

`MeshStandardMaterial` already supports the PBR parameters we need — they just aren't being set.

### PBR Profile Design Per Material Class

The following profiles map real-world material physics to Three.js PBR:

| Material Class | Examples | `roughness` | `metalness` | `emissiveIntensity` note |
|---|---|---|---|---|
| **Ferrous metal** | Iron, Nickel, Chromium, Cobalt | 0.55–0.70 | 0.65–0.80 | Baseline emissive (existing) |
| **High-value metal** | Gold, Platinum, Rhodium, Iridium | 0.20–0.40 | 0.85–0.95 | Slight extra emissive warmth |
| **Silicate / rocky** | Silicon, Magnesium, Carbon | 0.82–0.92 | 0.0–0.10 | Low emissive |
| **Light/soft metal** | Lithium, Copper | 0.55–0.65 | 0.60–0.75 | Warm tint in emissive |
| **Radioactive** | Uranium | 0.70 | 0.30 | Elevated green emissive glow |
| **Exotic** | Unobtainium, Antimony | 0.25–0.45 | 0.50–0.70 | Vivid emissive pulse |

### Option 2-A — Extend `AsteroidMaterialProfile` with PBR fields (pure client, no backend)

Add `roughness`, `metalness`, and optional `emissiveBoost` to the catalog entry:

```typescript
export interface AsteroidMaterialProfile {
  rarity: AsteroidMaterialRarity;
  material: string;
  textureColor: string;
  // New PBR fields
  roughness: number;       // 0 = mirror, 1 = fully diffuse
  metalness: number;       // 0 = dielectric, 1 = full conductor
  emissiveBoost?: number;  // multiplier on the base emissive intensity
}
```

Then in `asteroid.html` bind them:

```html
<ngt-mesh-standard-material
  [color]="materialColor()"
  [roughness]="pbrRoughness()"
  [metalness]="pbrMetalness()"
  [emissive]="..."
  [emissiveIntensity]="resolvedEmissiveIntensity()"
/>
```

This is **entirely client-side**. The catalog is client-owned. No backend change, no socket contract change. Pre-scan state continues to use the grey `#5f6d7b` flat color so gameplay information isn't leaked early. PBR properties only activate on the revealed material (post-scan).

**Effort**: Small–medium (catalog update + 2–3 computed signals in `Asteroid`). **Risk**: None. **Highest immersion-to-effort ratio.**

### Option 2-B — Scene-level environment map (reflection cube)
A `MeshStandardMaterial` with `metalness > 0` looks flat without an environment map — the metal just appears darker. The fix is a single **equirectangular HDR environment texture** loaded once by the scene and applied to the `scene.environment` property in Three.js.

In Angular Three:

```typescript
// In ship-exterior-view, after canvas ready:
const pmremGenerator = new THREE.PMREMGenerator(renderer);
const envTexture = pmremGenerator.fromScene(new RoomEnvironment()).texture;
scene.environment = envTexture;
```

Or load a space-appropriate HDR (a panoramic nebula/star-field image, which fits the game fiction perfectly) using `RGBELoader`. With `scene.background` left untouched (we already have `BackgroundStars`), `scene.environment` only drives material reflections without replacing the visual background.

This single scene-level change affects **all** asteroid materials simultaneously and is the single biggest visual upgrade per line of code.

**Effort**: Small (3–5 lines of scene setup; one HDR asset). **Risk**: Low. Need to pick or generate a suitable space HDR. Could use one of Three.js's built-in `RoomEnvironment` as a neutral fallback while sourcing a space-appropriate one.

### Option 2-C — Normal maps per material class (texture-based surface detail)
A normal map fakes surface topology (craters, ridges) without adding geometry. You'd need 4–6 texture files (one per material class), loaded once and shared across all asteroids of that class.

Three.js `MeshStandardMaterial` accepts `normalMap` and `normalScale`. At game scale with procedural geometry the payoff is moderate — normal maps read well on close-up hover but are subtle at the typical field viewing distance.

This also requires choosing whether textures live in `public/images/` (static assets) or are served from the backend (`visualization.textureKey`). The `textureKey` field already exists in the upsert contract and is currently `null` — it is the intended hook for exactly this.

**Effort**: Medium (texture creation/sourcing + `textureKey` use in the client + potentially backend serving). **Risk**: Low–Medium. More of a later-stage polish item than a baseline necessity.

---

## Area 3 — Mesh Association With Celestial Body Identity

### Current state
The `serverCelestialBodyId` already ties each in-scene asteroid sample to a persisted backend celestial body. The upsert payload already carries:
- `visualization.colorHex` — the flat color
- `visualization.textureKey: null` — designed for a future texture/mesh key
- `composition.material` — the raw material name
- `physical.estimatedDiameterM` — drives scale if we choose to use it

So the association infrastructure **already exists**. The question is what additional data to persist.

### Option 3-A — Derive everything from the existing deterministic seed (no backend change)

The seeded RNG already determines material, kinematics, and position. We can extend `generateRandomAsteroidRevealProfile` (called during the asteroid reveal/scan step, driven by the same RNG) to also deterministically produce:
- geometry kind + detail level
- per-axis scale (already done)
- roughness and metalness offsets (small seeded variance within the material's base profile)

A player who scans the same asteroid twice (or returns to the field) gets the identical visual because the seed is stable. No backend round-trip needed.

**Effort**: Minimal extension of existing seeding logic. **Recommended approach for geometry and PBR variance.**

### Option 3-B — Use `visualization.textureKey` to persist a mesh profile key

If we want the server to be authoritative about an asteroid's visual identity (e.g., so it displays consistently across different clients or future 3D viewers), we could set `visualization.textureKey` to a short string like `"iron-ico-2-rough"` when the asteroid is first upserted, and read it back when resuming.

The key encodes:
- geometry kind
- detail level
- PBR profile variant

This is more future-proof (the server becomes the single source of truth for asteroid identity) but adds a round-trip dependency and a small schema concern: `textureKey` was intended for texture file names, not mesh config strings. It would be cleaner to add a dedicated `meshProfileKey` field to the upsert contract.

**Effort**: Medium (contract extension + backend storage + client read-back). **Recommended only if cross-client or persistent viewer consistency matters.**

### Option 3-C — Backend-stored full mesh parameters (heaviest)

The backend stores explicit `roughness`, `metalness`, `geometryDetail` per celestial body. The client reads these and uses them verbatim — no local derivation.

This is the most flexible and cross-platform option but adds significant backend schema work and increases the upsert payload size. The immersion value over Option 3-A is marginal for single-player sessions.

**Effort**: High. **Not recommended for current phase.**

---

## Quality vs. Performance Analysis

| Change | Frame Cost | Immersion Gain | Effort |
|---|---|---|---|
| Geometry detail 0/1 → 1/2 | Low (5–20 asteroids) | Medium — rocks look rounder | Minimal |
| PBR roughness + metalness from catalog | Near zero | High — metals look metallic | Small |
| Scene envMap (HDR) | Low one-time load, near zero per-frame | Very high — reflections make metals dramatic | Small |
| LOD object switching | Slight overhead per asteroid | High once scene has mixed entities | Medium |
| Normal maps (material class) | Texture bind cost (small) | Medium — visible mainly on close approach | Medium |
| Vertex displacement noise | Medium CPU/GPU | High — unique rocky topology | High |
| Backend mesh key persistence | No render cost | Low–none (same result as seeded) | Medium |

**Updated bottom line on performance**: 5–20 asteroids alone are cheap, but this scene is expected to include ship parts (5–20), pirate ships (2–7), stations, and additional interactive objects. That shifts the decision from asteroid-local optimization to scene-wide budget management. Preserve hero fidelity where interaction is happening, and proactively cap background complexity.

## Scene-Wide Budget Policy (Recommended)

Use quality tiers by gameplay importance and distance.

| Tier | Asset examples | Geometry/material policy |
|---|---|---|
| **Hero** | Player ship, targeted asteroid, actively scanned asteroid, nearest pirate ship | Highest detail geometry, full PBR + env reflections, richest fx |
| **Active Nearby** | 1–3 closest scanned asteroids, nearby ship parts, nearby pirate ships | Mid detail, full material profile, reduced secondary fx |
| **Background** | Far asteroids, distant props, stations outside interaction range | Lowest detail, simplified materials/fx, aggressive culling |

Practical caps:

1. High-detail asteroids visible simultaneously: **max 1–3**
2. Mid-detail asteroids: **max 4–8**
3. Remaining asteroids: low-detail fallback
4. If frame time rises, degrade background tier first, then Active Nearby tier, never Hero tier first

---

## Recommended Baseline Path ("Simple but Immersive")

This sequence delivers maximum immersion for minimum architectural change.

### Phase 1 — Scan-Reveal Geometry + PBR Profiles (0 backend changes)

1. **Keep pre-scan asteroids intentionally simple**: start with low-poly dodecahedron/icosahedron/octahedron shapes (detail 0/1) to preserve readability and budget.
2. **On scan completion, reveal higher fidelity**: promote scanned asteroid geometry to detail 2 (or hero profile), synced with the existing reveal pulse so the transition feels deliberate.
3. **Add `roughness` and `metalness` to `AsteroidMaterialProfile`** in `src/app/model/catalog/asteroid-materials.ts` and bind them in `asteroid.html`.
4. **Apply PBR only after scan reveal** so the scan action unlocks both form and surface fidelity at once.
5. **Optional**: Uranium gets pulsing green `emissiveIntensity`; Unobtainium gets vivid cyan pulse.

### Phase 2 — Scene Environment Map + Tiered LOD (0 backend changes)

6. **Load a space HDR** into `ship-exterior-view` and assign `scene.environment` for reflection quality.
7. Since `BackgroundStars` already renders the visual background, set `scene.environmentIntensity` rather than `scene.background`.
8. **Introduce distance tiers now**: close asteroids can use high reveal detail, mid range uses moderate detail, far range remains low detail.
9. **Limit high-detail asteroid count** with a nearest-priority selector (targeted + scanned + nearest 1–3).

### Phase 3 — Diameter-driven scale (uses existing data)

10. **Use `estimatedDiameterM`** (already in `revealedKinematics`) to set a continuous size scale on each asteroid post-scan. A 40m rock should look different from a 9.4km rock. Currently all asteroids render at the same base radius of 0.55 scene units plus the 0.86–1.28 seeded scale. A diameter-to-scale mapping (log scale to keep large ones manageable) would immediately differentiate the field contents visually without any new data.

### Phase 4 — Backend texture key (future, when cross-client consistency matters)

11. Agree on a `meshProfileKey` schema addition to the celestial body upsert contract. Store phase-1 geometry and PBR variant as a short key. Read it back on resume. This closes the loop on true persistent identity.

---

## Design Notes on Immersion Goal

The player's experience goal is: _you are actually piloting inside a real asteroid field_. The key sensory cues that create this:

- **Scale variation**: A mix of small (50m) and large (3 km+) bodies at different distances. Currently all asteroids look similarly sized because scale is only mildly randomized. Diameter-driven scale (Phase 3) solves this.
- **Material character**: Shiny metallic asteroids vs. rough matte carbon vs. glowing exotic ore. PBR profiles (Phase 1) + envMap (Phase 2) together deliver this.
- **Density and depth**: The field should feel dense in the middle distance even when only 5–20 active asteroids are present. This is partly a placement/clustering concern (already good) and partly a fog/depth-cue concern. Adding a subtle scene `fog` (already a Three.js scene property) could reinforce depth perception without performance cost.
- **Motion**: Already well handled (bob + angular velocity animation). No change needed here.

The combination of scan-triggered reveal (Phase 1), reflection + LOD policy (Phase 2), and diameter-driven scale (Phase 3) is the practical inflection point where the scene shifts from "primitive testbed" to "believable operational space." These phases keep backend changes optional while protecting headroom for the broader entity mix.
