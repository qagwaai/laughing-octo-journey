# Station models with Meshy.ai (2026-10-23)

## Why we are replacing the ring station

The current Mars orbit station ([station-model-assets.ts](../src/app/scene/station/station-model-assets.ts)) is a classic ring-and-hub design. Its docking concepts are still right: any arriving ship is treated as an unstoppable projectile, so ships stop outside the station and tugs tow them into external gantry slips protected by Whipple shielding.

What the ring design ignores is **heat**. Stellar stations in ~2126 are compute hubs, and in vacuum the only way to reject heat is infrared radiation. Source: [The 15-Minute Space TPU: Why Orbital Data Centers Are a Radiator Problem](https://vocal.media/01/the-15-minute-space-tpu-why-orbital-data-centers-are-a-radiator-problem).

- Rejection follows Stefan-Boltzmann: `P = ε·σ·A·T⁴`. At 20 °C, a panel rejects ~600 W/m² net (both sides). One 100 kW rack needs ~170 m² of radiator.
- Hotter radiators are better: raising the temperature from 20 °C to 60 °C adds ~70 % rejection.
- Duty-cycling adds no long-run compute. Average compute is set by radiator area and temperature.
- Radiators must see open space. They cannot face each other or the hull, and they cannot be armored.

Illustrative sizing for a 100 MW compute station (ε = 0.9, two-sided, ideal view factor):

| Radiator temperature |               Rejection |        Area |      Approx. square |
| -------------------- | ----------------------: | ----------: | ------------------: |
| 293 K (20 °C)        | ~600 W/m² (article net) | ~170,000 m² |              ~410 m |
| 600 K (327 °C)       |            ~13,200 W/m² |   ~7,600 m² |               ~87 m |
| 900 K (627 °C)       |            ~67,000 W/m² |   ~1,500 m² | ~39 m (visibly red) |

### Design direction

- **Non-rotating truss spine.** Coolant loops and very large panels do not belong on a spinning ring.
- **Modules along the spine**, front to back: armored docking head → small rotating habitat ring → compute core → radiator wings.
- **Two thermal loops.** A hot loop (~600–900 K) serves compute and uses dark ceramic panels with a dull red glow. A cool loop (~300 K) serves the habitat and uses pale silver panels.
- **Sun-shade disc.** The radiator wings sit edge-on to the Sun behind a circular sun-shade.
- **Traffic stays clear of the radiators.** Approach corridors and tug exhaust are kept away from the radiator field. Radiator segments are replaceable, and damaged segments throttle compute. This is a possible future gameplay stat.

### Harbor (Mars is a major early Sol hub)

The station must handle many ships at once, and every arriving ship is treated as a possible unstoppable projectile. Docking therefore works like a harbor:

- **Outer mooring field (12 slips).** Free-floating slip frames sit ahead of the docking head in **two staggered rings of six**. Each frame has its own station-keeping thrusters and Whipple plates on its outward faces. Arriving ships brake and moor here under their own power, never pointed at the station.
- **Clear tug lane.** The centre of both rings stays open as the approach corridor to the docking head.
- **Inner berths (6).** Tug-only berths on the docking head. Tugs tow ships from the outer slips to the berths; ships never fly into a berth under their own power. Cargo and crew can also be shuttled from the outer slips without moving the ship.
- **Keep-out zone.** No traffic aft of the docking head. The habitat ring, compute core, and radiator wings are only reachable by maintenance drones.
- **Compressed visual distance.** Realistic stand-off would be kilometres, which would make the slips invisible on screen. The rings sit about 1–3 station lengths ahead of the docking head for readability.
- **Capacity:** 8 inner + 12 outer = **20 ships** at once.

## Decisions

| Topic            | Decision                                                                                                                                        |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Station scope    | Replace the current Mars orbit station model (`sol-mars-orbit`).                                                                                |
| Meshy MCP config | VS Code **user-level** `mcp.json` only. Nothing is committed to the repo.                                                                       |
| Generation mode  | Hybrid: **Meshy 7.1 + refine** for hero modules, **Smart Topology `meshy-t2.5`** for repeatable kit parts.                                      |
| Triangle budget  | Match the current tiers: **150k standard / 75k low**.                                                                                           |
| Source storage   | Outside the repo at `C:\Development\Assets\laughing-octo-journey\station-mars`. Only final optimized GLBs and the poster go to `public/models`. |
| Harbor layout    | Hybrid: 6 tug-only inner berths on the docking head + 12 detached outer slips in two staggered rings of six.                                    |
| Runtime delivery | A **composed set of GLBs** (station core, harbor slips, traffic) that together form one scene, shared by the splash and the Stellar viewer.     |

## Step 1 — Set up the Meshy MCP server in VS Code

Follows [meshy-dev/meshy-mcp-server](https://github.com/meshy-dev/meshy-mcp-server). Prerequisites: Node.js ≥ 18 and a Meshy API key (`msy_…`, Pro plan or higher).

Status: **configured and authenticated 2026-10-23.** The server smoke test passed (stdio start, 28 tools registered, no key and no credits used). The initial `${input:...}` configuration was rejected by the Copilot harness, which does not support input or command variables. It has been replaced with Meshy's local `.env` loading. A local stdio MCP call to `meshy_check_balance` succeeded: 1,081 credits (981 monthly, 100 permanent); monthly reset is 2026-10-27T18:20:56Z. No generation was requested. Discovery in this chat's Copilot harness is not yet verified.

User-level config at `%APPDATA%\Code\User\mcp.json`:

```json
{
  "servers": {
    "meshy": {
      "type": "stdio",
      "command": "cmd",
      "args": [
        "/d",
        "/s",
        "/c",
        "cd /d C:\\Development\\Assets\\laughing-octo-journey\\station-mars && npx -y @meshy-ai/meshy-mcp-server@0.6.5"
      ],
      "env": {
        "TRANSPORT": "stdio"
      }
    }
  }
}
```

Notes:

- **Windows launch:** `cmd /c npx` avoids `spawn npx ENOENT`.
- **Version pinning:** the package is pinned to `0.6.5`. Bump it deliberately after reading the upstream CHANGELOG.
- **Output location:** the Copilot harness cannot migrate a `cwd` property, so the command runs `cd /d` into the external assets folder before starting. The `.env` key file and `meshy_output/` therefore stay outside the repo. Do not move `.env` into this repo; `.gitignore` does not exclude it.
- **Use stdio, not HTTP:** stdio is required here. HTTP mode defaults to port 3000, which collides with the game backend (`http://localhost:3000`).
- **API key handling:** Meshy loads `.env` from its working directory. Edit `C:\Development\Assets\laughing-octo-journey\station-mars\.env` locally and replace the placeholder with `MESHY_API_KEY=msy_YOUR_REAL_KEY`. This is plaintext on disk, not VS Code secret storage; restrict access to your Windows account and never commit or share it. Do not paste the key into chat. No input-variable substitution is used.

Activate the server:

1. Replace the placeholder in the external `.env` file, save it, then run **MCP: List Servers** → `meshy` → **Start** (or **Restart** if already running). Reload the VS Code window if it still shows the old input-variable configuration.
2. In chat, ask: _"List the meshy tools available"_. Expect 28 `meshy_*` tools.
3. Run `meshy_check_balance` before generating anything.

## Step 2 — Generate the modules through the MCP server

Generate one module at a time. Review each module before spending credits on the next. The Meshy text-to-3D `prompt` limit is 600 characters, and negative prompts are not supported, so every prompt below is self-contained. Character counts were verified.

Shared style for all modules: grey-white industrial plating, amber hazard stripes, hard-surface PBR.

### 2.0 Style-lock concept image (optional, recommended)

- Tool: `meshy_text_to_image` (`nano-banana-pro`).
- Use: the result is the style reference for `meshy_retexture` on kit parts, and later the basis for the poster composition.

First concept generated on 2026-10-23: task `01a16adc-130e-74e7-a5b0-85837276ad4c`, Nano Banana Pro, 16:9, **9 credits consumed**. Saved outside the repo as `C:\Development\Assets\laughing-octo-journey\station-mars\concept-v01.png`, with its prompt and review in the adjacent `generation-log.md`. Accepted as a style study only: the axial silhouette works, but the radiator planes overlap and face each other, the sun-shade does not cover the radiator span, and the docking head has no readable slips. It also predates the harbor decision.

v01 prompt (superseded):

> Wide-angle concept art of a hard-sci-fi deep-space compute station in Mars orbit, year 2126. Long non-rotating truss spine: armored forward docking head with gantry slips and Whipple shielding, compact rotating habitation ring, dense compute core, and enormous flat double-sided radiator wings many times larger than the hull, held edge-on behind a circular sun-shade. Inner radiators glow dull cherry red, outer ones pale silver. A tug drone tows a cargo ship into a forward slip. Industrial PBR game asset style, grey white and amber hazard paint, black starfield.

v02 prompt (harbor layout + radiator fixes, 578 characters):

> Wide-angle concept art of a large hard-sci-fi harbor station in Mars orbit, year 2126. Ahead of an armored docking head with six open tug berths, two staggered rings of six free-floating mooring slip frames hold parked freighters around a clear central tug lane. Behind the head: rotating habitat ring, long truss spine, compute core, then wide coplanar radiator wings, edge-on and not overlapping, in the shadow of a large sun-shade disc. Inner panels glow dull red, outer ones silver. Tugs tow ships inward. Grey white plating, amber hazard paint, Mars below, black starfield.

v02 generated on 2026-10-23: task `01a16ae4-75b3-7735-8cf2-c8839927ad9c`, **9 credits**, saved as `concept-v02.png`. It fixes the radiator overlap (one coplanar wing with a hot-to-silver gradient), shows open berth bays on the docking head, and gets the module order right. Remaining gaps: the style drifted to an inked illustration, the harbor is drawn as two continuous truss arcs beside the head rather than 12 discrete slips ahead of it, and the sun-shade is still smaller than the radiator span. Since the 3D modules are generated separately from text, these gaps matter mainly for the poster and as an assembly reference; the Blender layout table below is the authority for slip placement.

v03 (edit of v02 via `meshy_image_to_image`, `nano-banana-pro`, input task `01a16ae4-…`): task `01a16ae6-9bbf-770a-8fff-8610399f1b7a`, **9 credits**, saved as `concept-v03.png`. The harbor is now 12 discrete free-floating slip frames with corner thrusters and amber lights, a good visual reference for module I; ink outlines are gone and the sun-shade is larger. Still off: the slip groups flank the docking head instead of sitting ahead of its nose, berths remain on one hull face, the radiator wings still extend past the shade, and the tugs were dropped. The full edit prompt is in `generation-log.md`.

v04 (edit of v03, `nano-banana-pro`): task `01a16ae8-3e23-76b4-bbf4-296cfceda4c8`, **9 credits**, saved as `concept-v04.png`. Restores the tugs (one towing a freighter by tethers), adds a berth bay on the docking head's top face, and shortens the radiator wings to sit within the sun-shade. The slip groups still flank the docking head: image-to-image preserves the source composition, so forward placement of the harbor is left to the Blender layout. Concept spend so far: **36 credits** (v01–v04).

### Hero modules — Meshy 7.1 (`meshy_text_to_3d` → `meshy_text_to_3d_refine`)

Use `ai_model: "meshy-7.1"` and `texture_resolution: "2k"`. Only use `geometry_resolution: "2k"` if the standard pass loses the slip or manifold detail. If a hero module comes back over its triangle allocation, run `meshy_remesh` with a `target_polycount`, or decimate it in Blender.

**A — Docking head with 6 inner berths** (allocation 35k triangles)

> Armored forward docking head module for a hard-sci-fi harbor space station, standalone game asset. Blunt hexagonal hull with angled deflector prow, multi-layered Kevlar Whipple shielding and honeycomb sacrificial plates on the front faces. Six open external gantry berths, one on each hull face, with cradle clamps, tow-cable winches and amber guide lights. Flat circular rear mounting flange with a central truss socket. Grey white industrial plating, amber hazard stripes, numbered berth markings. Clean hard-surface geometry, PBR materials.

**Module A result (2026-10-23).** Built via the image route:

1. A reference image from concept v04 (task `01a16aef-…`, 9 credits, `modules\A-docking-head-reference-v01.png`).
2. `meshy_image_to_3d` with Meshy 7.1, remeshed to 35k, textured with PBR at 2k, plus a no-lettering texture prompt (task `01a16af1-…`, 30 credits, `modules\A-docking-head-v01.glb`).

The result is about 34.2k triangles, with base color, metallic-roughness and normal maps (2048²). It validates with no errors and one warning about missing tangents. It is **accepted**.

It has 2×2 berth bays on both broad side faces (8 bays), and all eight get `Berth_Inner_01..08` empties (changed from six after the layout v03 review). The nose is blunt and honeycomb-armored rather than a wedge prow. Its long axis is X, so rotate it onto the station axis during assembly.

**B — Compute core** (allocation 20k triangles)

> Compute core module for a hard-sci-fi space station, standalone game asset. Long octagonal block of stacked armored server racks with recessed access hatches. Thick insulated coolant manifold trunks run along its length and branch outward to four flat flange plates where radiator wings attach. Circular truss sockets at both ends. Small maintenance drone rails and status light strips. Dark gunmetal and white industrial plating with amber hazard markings. Clean hard-surface geometry, PBR materials.

**Module B result (2026-10-23).** Built via the image route:

1. A reference image from concept v04 (task `01a16af4-…`, 9 credits).
2. `meshy_image_to_3d` with Meshy 7.1, remeshed to 20k, PBR at 2k (task `01a16af5-…`, 30 credits, `modules\B-compute-core-v01.glb`).

The result is 20,060 triangles with base color, metallic-roughness and normal maps. It validates with no errors and one tangent warning, and is **accepted**.

The four radiator flange discs sit on very thin stalks and read as nearly detached. In assembly, mount the radiator wing roots over them, or replace them with simple Blender flange blocks. Its long axis is X.

**C — Habitat ring** (allocation 25k triangles; must stay a separate node so it can spin)

> Compact rotating habitation ring module for a hard-sci-fi space station, standalone game asset. Thick segmented torus with small windows and cargo hatches, connected by four short radial spokes to a central cylindrical bearing hub with a through-hole for a truss spine. Two small pale silver radiator fins mounted on the hub. Grey white industrial plating with amber hazard stripes and lit windows. Clean hard-surface geometry, PBR materials.

**Module C result (2026-10-23).** Built via the image route:

1. A reference image from concept v04 (task `01a16af8-…`, 9 credits).
2. `meshy_image_to_3d` with Meshy 7.1, remeshed to 25k, PBR at 2k, plus a cool-grey texture prompt (task `01a16af9-…`, 30 credits, `modules\C-habitat-ring-v01.glb`).

The result is 24,949 triangles with full PBR maps and validates with no errors. It is **accepted**.

- The plating is still slightly warmer than A and B, and the back face is darker. Color-match it in Blender.
- The spin axis is Y. Align it to the station axis and keep it a separate rotating node.

### Kit parts — Smart Topology (`meshy_text_to_3d`, `model_type: "smart-topology"`, `ai_model: "meshy-t2.5"`)

Smart Topology on text-to-3D is preview-only (mesh, no texture). Texture each part with `meshy_retexture` (`ai_model: "meshy-7"`) using the 2.0 concept image or a `text_style_prompt`. Smart Topology outputs clean, part-separated triangle meshes at the requested `target_polycount`.

**D — Hot radiator panel segment** (`target_polycount: 1200`, tiled ×8 in assembly)

> Single flat rectangular spacecraft radiator panel segment, standalone modular game asset. Very thin double-sided plate with evenly spaced raised heat-pipe ribs running its full length, a thick coolant header pipe along one long edge with flanged connectors at both ends, and a narrow service rail along the opposite edge. Plain, tileable, symmetric, no hull or body attached. Dark ceramic plating with faint red heat glow. Clean hard-surface geometry.

Retexture style for the hot variant: _"dark charcoal ceramic radiator plating, heat-pipe ribs, faint cherry red heat glow, scorched edges"_.

**E — Cool habitat radiator panel**: no new geometry. Run `meshy_retexture` on D's mesh with _"pale silver white radiator coating, bright aluminium heat-pipe ribs, clean"_. This yields two materials on one shared mesh.

**Modules D and E result (2026-10-23).** D was built via the image route:

1. A panel reference from concept v04 (task `01a16afd-…`, 9 credits).
2. `meshy_image_to_3d` with Smart Topology `meshy-t2.5` at 1,200, textured (task `01a16afe-…`, 15 credits, `modules\D-radiator-hot-v01.glb`).

The result is 1,220 triangles: a thin plate with a flanged header pipe, a service rail, and a red glow between the ribs. It is **accepted**. The panel is about 1.3:1 with ribs running from the header, so tile it along the header axis.

E is a `meshy_retexture` of D (task `01a16aff-…`, 10 credits, `modules\E-radiator-cool-v01.glb`). It has the same mesh and UVs with a pale silver coating and is **accepted**. Use one shared mesh with two materials in assembly, and add an emissive map to D's glow in Blender.

**F — Spine truss segment** (`target_polycount: 1600`, chained ×3)

> Straight square space truss segment, standalone modular game asset. Open lattice of tubular struts with cross bracing, four corner longerons, a pair of insulated coolant pipes and a cable tray running through the center, and identical circular docking flanges at both ends so segments chain together. Grey metal with amber hazard bands at the flanges. Clean hard-surface geometry.

**Module F result (2026-10-23).** Built **procedurally in Blender** (0 credits) instead of through Meshy, because a regular lattice of thin struts suits a script better. The segment runs along X with a length of 1.0 and a square section of 0.14. It has:

- 4 longerons and 4 braced bays.
- 2 white coolant pipes passing through the flange holes, plus an open cable tray.
- End flanges with amber/black hazard bands.

Output is `modules\F-spine-truss-blender-v01.glb`, with the source at `modules\blender\F-spine-truss-v01.blend`. It has 1,060 triangles, is 56 KB, and validates clean. **Accepted**, and three chained segments use about 3.2k triangles.

**G — Sun-shade disc** (`target_polycount: 3000`)

> Large circular sun-shade disc for a hard-sci-fi space station, standalone game asset. Thin multi-layer insulation membrane stretched over a radial spoke frame like an umbrella, gold and silver foil surface, reinforced outer rim, and a central hub collar with a through-hole for a truss spine. Clean hard-surface geometry.

**Module G result (2026-10-23).** The image route gave an accepted reference image (task `01a16b02-…`, 9 credits, `modules\G-sun-shade-reference-v01.png`). The Smart Topology 3D pass (task `01a16b03-…`, 15 credits) failed, though: it dropped almost all of the thin membrane, leaving a see-through spoke wheel, and the output had six `ACCESSOR_VECTOR3_NON_UNIT` validation errors. Meshy cannot reliably build thin membranes, so G was **built procedurally in Blender** (0 credits) instead, using the reference as a guide:

- A concave annulus membrane (sagging toward the hull) with planar UVs and a double-sided material. Its texture is a procedural 1024² gold/silver foil with 12 gores.
- A grey frame: 48 rim segments, 12 spokes that follow the sag, and a hub collar with a through-hole for the spine.
- Output is `modules\G-sun-shade-blender-v01.glb`, with the editable source at `modules\blender\G-sun-shade-v01.blend`. It has 2,416 triangles, is 1.1 MB, and validates clean. **Accepted.**
- **v02 (after the layout v04 review):** the rim's gaps showed at station scale. v02 has a continuous 192-segment rim, a 192-segment membrane and a 2048² foil texture. Output is `modules\G-sun-shade-blender-v02.glb`: 4,528 triangles, 3.3 MB, no validation errors. The layout now uses v02.

**H — Tug and cargo ship** (`target_polycount: 12000`; traffic dressing for the splash, poster, and viewer)

> Small boxy utility tug drone towing a long cargo freighter by tether cables, standalone hard-sci-fi game asset. The tug has four thruster quads, grapple arms and amber beacons. The freighter is a long modular container hauler with engines dark, being pulled nose first. Grey white industrial plating with amber hazard stripes. Clean hard-surface geometry, PBR materials.

**Module H result (2026-10-23).** Made by the image route. The reference image came from concept v04 (task `01a16b0c-…`, 9 credits, `modules\H-tug-cargo-reference-v01.png`). It was then converted with Meshy 7.1 standard: remeshed to 12k triangles, PBR enabled, and a no-lettering texture prompt (task `01a16b0e-…`, 30 credits, `modules\H-tug-cargo-v01.glb`).

The result has 12,093 triangles, with the long axis along X. The thin tether cables survived as geometry. It validates with no errors and the usual tangent-space warning. It is **accepted**. The 12.3 MB file size comes mostly from 2k PBR textures, which will be resized and encoded to KTX2 in Step 4.

**I — Outer mooring slip frame** (`target_polycount: 2000`, placed ×12 in two staggered rings of six)

> Free-floating orbital mooring slip frame, standalone hard-sci-fi game asset. Open rectangular gantry cradle sized for one freighter, with padded clamp arms, tow-cable winches and amber docking guide lights. A small station-keeping thruster pod on each corner, Whipple shield plates on the outward faces, and a hazard-striped number placard. Empty, no ship inside. Grey white industrial plating with amber hazard stripes. Clean hard-surface geometry.

Slip numbers are added in Blender (decal or per-instance material), not baked into the Meshy texture, so one mesh serves all 12 slips.

**Module I result (2026-10-23).** The text prompt above (preview task `01a16ae9-…`, 5 credits) produced a solid box base under a gantry arch. That reads as a gravity-bound hangar cradle, not an open frame, so it was rejected. What worked was the **image route**:

1. `meshy_image_to_image` from concept v04 isolated one empty, floor-less slip frame as a studio product shot (task `01a16aec-…`, 9 credits, `modules\I-slip-frame-reference-v01.png`).
2. `meshy_image_to_3d` used Smart Topology `meshy-t2.5`, `target_polycount` 2000, textured, `image_enhancement: false`, plus a no-lettering texture prompt (task `01a16aed-…`, 15 credits, `modules\I-slip-frame-v02.glb`).

The result has 1,761 triangles, UVs and normals, and one 2048² JPEG base-color texture, and validates clean. It is **accepted**. Follow-ups for Blender:

- Paint out the baked "SLIP-03" lettering, which the texture prompt did not suppress.
- Add an emissive mask for the amber rim lights.
- Resize the texture to 512–1024 and encode it as KTX2.

Use the same image route for the other kit parts when a text prompt misreads the shape.

### Download and bookkeeping

- Download each accepted result with `meshy_download_model` as **GLB** into `station-mars\modules\…`.
- Record the task ID, prompt, model, and credits in a `station-mars\generation-log.md` file. It stays outside the repo.
- Use `meshy_resize` only if real-world scale is needed for printing. Game scale is set in Blender.

### Estimated credits (first pass, before re-rolls)

| Item                                                               |  Credits |
| ------------------------------------------------------------------ | -------: |
| 2.0 concept images v01–v04 (nano-banana-pro, actual)               |       36 |
| I: text preview 5 + reference image 9 + img-to-3D 15               |       29 |
| A, B, C: reference image 9 + img-to-3D 7.1 PBR 30 (×3)             |      117 |
| D: reference image 9 + img-to-3D 15; E: retexture 10 (actual)      |       34 |
| G: reference image 9 + failed img-to-3D 15; Blender build (actual) |       24 |
| F: Blender procedural build (actual)                               |        0 |
| H: reference image 9 + img-to-3D 7.1 PBR 30 (actual)               |       39 |
| **Total**                                                          | **~279** |

Optional extra charges: +5 per hero module for 2k geometry, and +5 per `meshy_remesh`. Prices follow the server README as of v0.6.5.

## Step 3 — Assemble in Blender 5.2

Blender 5.2.2 LTS is installed at `C:\Program Files\Blender Foundation\Blender 5.2\blender.exe`. Combining the modules is feasible. Work in a `station-mars\assembly\station-mars.blend` file outside the repo.

Layout (Blender Z-up, spine along +Y, forward = +Y). The glTF export converts to Y-up.

| Node                  | Source                | Placement                                                                                                                                                                                 |
| --------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DockingHead`         | A                     | Spine front (+Y). Carries eight named empties `Berth_Inner_01..08` (one per bay) marking where towed ships attach.                                                                        |
| `HabitatRing`         | C                     | Behind the docking head. Its origin is on the spine axis so it can rotate about Y at runtime.                                                                                             |
| `SpineTruss_01..03`   | F (linked duplicates) | Chained flange to flange                                                                                                                                                                  |
| `SpineTruss_04..05`   | F (linked duplicates) | Aft stubs between the compute core and the sun-shade, so the shade sits behind the radiator wings' aft edge                                                                               |
| `ComputeCore`         | B                     | Midship                                                                                                                                                                                   |
| `RadiatorHot_01..12`  | D (linked duplicates) | Two wings of 3 outward × 2 along the spine off the compute core flanges, coplanar and edge-on to the sun-shade normal                                                                     |
| `RadiatorCool_01..02` | D mesh + E material   | Vertical (±Z) off the spine just aft of the habitat ring, edge-on to the Sun and to the hot wings                                                                                         |
| `SunShade`            | G                     | Sun side, sized to shadow the full radiator span                                                                                                                                          |
| `TugCargo`            | H                     | Traffic file. Placed in the central tug lane, never aft of the docking head.                                                                                                              |
| `Slip_Outer_01..12`   | I (linked duplicates) | Harbor file. Two staggered rings of six ahead of the docking head (+Y), the second ring rotated 30° and further forward, leaving a clear central lane. Each slip's cradle faces the lane. |

Assembly rules:

- **Repeated parts:** use **linked duplicates** (Alt+D) for D, F, and I. glTF stores a linked duplicate as another node pointing at the same mesh, so the bytes are shared and each node keeps its name. Do **not** enable `export_gpu_instances` for the harbor slips: it collapses them into one instanced node and loses the `Slip_Outer_NN` names that gameplay needs. It is fine for the unnamed radiator and truss tiles.
- **Shared origin:** all GLBs in the set are exported from the same `.blend` with the station origin at (0, 0, 0), so the runtime places every file at the same transform with no per-file offsets.
- **Node names:** keep each module as its own named node. Do not join the habitat ring into the hull, because it must stay animatable.
- **Hot panel glow:** add the glow in Blender. Meshy does not output emissive maps, so set a low-strength dull red Emission on the hot material (exported as `emissiveFactor` / `KHR_materials_emissive_strength`). Painted red alone will not glow.
- **Panel orientation:** radiator panels must not face each other or the hull. Check this from the sun-shade's point of view.
- **Budget check:** the full composed scene (all three files) must stay ≤150k triangles in the standard tier.

**Layout v05 result (2026-10-23).** The scripted assembly (`station-mars\assembly\assemble_station.py`, 0 credits) builds `station-mars-v05.blend` and saves review renders to `assembly\review\`. Earlier versions are kept. v04 applied the v03 review: all 8 bays became named berths, and the radiator wings grew much larger. v05 applies the v04 review: it uses the smoothed sun-shade v02 and doubles the harbor scale.

Placement:

- The compute core is at the origin and the Sun is at −Y.
- The hot radiators form two wings of 3×2 panels at scale 3.5, about 16 units across and many times wider than the hull. They are edge-on to the Sun and fully hidden behind the sun-shade (radius 8.49, covering a radiator half-span of 8.09).
- Two aft truss stubs carry the shade behind the wings.
- The cool radiators stand vertically beside the habitat ring.
- Slip frames and the tug/cargo are at scale 2.0. The slip rings sit at nose +5.0 (radius 5.0) and nose +9.0 (radius 6.8, offset 30°). The inbound tug/cargo stands off at nose +3.5.

The triangle count is 139k: core 106k, harbor 21k, traffic 12k. That is within the 150k budget.

Two layout lessons:

- glTF-imported objects use quaternion rotation, so set `matrix_world`, not `rotation_euler`.
- The radiator wings overran the shade until the aft truss stubs were added. The script now asserts this, and it also asserts that inbound traffic stays clear of the nose.

Open questions:

- At scale 2.0 the freighter is larger than the docking-head bays. Inner berths therefore read as small-craft berths, and large freighters use the outer slips.
- The review renders use extra key and fill lights. They do not show game lighting.

### Composed GLB set

One `.blend`, exported as three GLBs per quality tier. Each file is exported with **Limit to → Selected Objects** (or a per-collection export) from the shared origin:

| File (per tier)                           | Blender collection | Contents                                                                                                |
| ----------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------- |
| `sol-mars-station-core-{150k,75k}.glb`    | `Core`             | Docking head with `Berth_Inner_01..08` empties, habitat ring, spine, compute core, radiators, sun-shade |
| `sol-mars-station-harbor-{150k,75k}.glb`  | `Harbor`           | `Slip_Outer_01..12` sharing one slip mesh                                                               |
| `sol-mars-station-traffic-{150k,75k}.glb` | `Traffic`          | Tug and cargo ship (optional per scene)                                                                 |

The splash and the Stellar viewer load the same files, so both show the same station. A scene can skip `traffic` if it wants a quieter view, or animate it independently.

Headless import/export skeleton (run with Blender's bundled Python, not the repo's Python):

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background `
  'C:\Development\Assets\laughing-octo-journey\station-mars\assembly\station-mars.blend' `
  --python-expr "import bpy; bpy.ops.export_scene.gltf(filepath=r'C:\Development\Assets\laughing-octo-journey\station-mars\assembly\station-mars-150k.glb', export_format='GLB', export_gpu_instances=True, export_apply=True)"
```

Module import inside Blender: `bpy.ops.import_scene.gltf(filepath=...)`. A scripted assembly is optional. Placing the modules by hand once and then saving the `.blend` is usually faster for a single station.

**Texture cleanup result (2026-10-23).** All edits were local (Blender Python and numpy, 0 credits), wrote new versioned modules, and validate with 0 errors. The scripts live in `station-mars\modules\blender\`.

- **I v03:** the four baked "SLIP-03" labels are masked and diffusion-filled from the surrounding panel. All 12 slips share one texture, so slip numbers belong in runtime UI, not the texture. I has no painted lights, so it stays non-emissive.
- **C v02:** the habitat ring's warm cast is neutralized. Hull R−B went from +0.020 to −0.004, matching the docking head; saturated amber is untouched.
- **D v03, hot radiators:** dull-red emissive (strength 1.0) over the fin faces. A geometry-based gradient makes each panel brightest at the header pipe (coolant inlet) and fades to 4% at the far rail. Glow that varies across the wing is a runtime task (see Step 5).
- **A v02, B v02, C v03, H v02:** the painted warm window and indicator lights are masked as emissive (0.05–0.10% of texels, strength 2.0). Amber hazard stripes do not glow.
- **Layout v07** (`assembly\station-mars-v07.blend`, 139k triangles) uses all of the above. E (cool radiators) has no emissive.

## Step 4 — Optimize the runtime tiers

Follow the [prepare-web-3d-assets skill](../.github/skills/prepare-web-3d-assets/SKILL.md) and the proven recipe in [splash1-2026-09-27.md](splash1-2026-09-27.md):

1. `gltf-transform inspect` and `validate` the assembled source. Record bytes, SHA-256, triangles, and textures.
2. **Standard tier (~150k):** resize to 2K, run ETC1S on base color, run UASTC on metallic/roughness (and normals if present), then meshopt and validate.
3. **Low tier (~75k):** export a decimated variant from Blender (prefer decimating hero modules, not the tiled panels), then repeat the pipeline at 1K.
4. **Poster:** render a WebP poster in Blender using the same camera conventions as the existing station poster.
5. Compare the renders. Confirm the thin radiator panels and truss struts survive quantization and decimation.

Budget allocation (standard):

| Module                                      |    Triangles |
| ------------------------------------------- | -----------: |
| Docking head with 6 berths (A)              |       35,000 |
| Habitat ring (C)                            |       25,000 |
| Compute core (B)                            |       20,000 |
| Hot + cool radiators (D/E ×14, shared mesh) |       17,000 |
| Spine truss (F ×5)                          |        5,300 |
| Sun-shade (G v02)                           |        4,600 |
| Outer slips (I ×12, shared mesh)            |       24,000 |
| Tug + cargo (H)                             |       12,000 |
| Headroom                                    |      ~14,200 |
| **Total**                                   | **≤150,000** |

Low tier (~75k): halve the hero modules (A, B, C) and the tug, reduce the slip mesh to ~1,000 triangles, and keep the radiator and truss tiles as they are, because they are already cheap and their thin edges carry the silhouette.

**Step 4 result (2026-10-23).** Packaging decision: **one merged GLB per tier** instead of core/harbor/traffic files. The existing single-URL loader is unchanged, and named nodes (`RadiatorHot_01..12`, `Slip_Outer_01..12`, `Berth_Inner_01..08`, `HabitatRing`, `TugCargo`) stay addressable for runtime effects. Each linked panel and slip mesh is stored once and reused 12 times.

Texture recipe C, chosen after measuring alternatives:

- Base color and emissive: ETC1S at quality 200.
- Normal and metallic/roughness: UASTC level 2 with Zstandard 18.
- Geometry: meshopt.

Measured standard-tier alternatives:

| Variant                      |        Size |
| ---------------------------- | ----------: |
| 2K                           |     41.6 MB |
| 2K + RDO                     |     36.1 MB |
| **1K (C)**                   | **13.1 MB** |
| 1K, ETC1S metallic/roughness |      9.4 MB |
| 1K + 512 normals             |      5.7 MB |

The low tier comes from `assembly\decimate_low_tier.py`, which decimates each shared mesh once:

| Part |            Triangles |
| ---- | -------------------: |
| A    |          34.2k → 13k |
| C    |          24.9k → 10k |
| B    |           20.1k → 9k |
| H    |           12.1k → 5k |
| I    | 1,761 → 899 per slip |

Radiators, truss and shade are kept. The low tier is encoded at 512.

| Output                                                |      Bytes | Triangles | SHA-256 (prefix) |
| ----------------------------------------------------- | ---------: | --------: | ---------------- |
| `sol-mars-station-150k.glb`                           | 13,091,176 |   139,330 | `0a9ed223`       |
| `sol-mars-station-75k.glb`                            |  4,174,152 |    74,695 | `8f0a0e9c`       |
| `sol-mars-station-poster.webp` (720×900, transparent) |     36,690 |         — | `772cfae6`       |

Validation:

- Both GLBs validate with 0 errors and require `EXT_meshopt_compression`, `KHR_mesh_quantization` and `KHR_texture_basisu`.
- The 150k and 75k sources render nearly identically at station distance (`assembly\review\tier-*.png`).
- In the app, the 150k tier was 3D-ready in 2.9 s on a desktop dev server, with no visible ETC1S banding on the radiator glow.

Tools: glTF Transform 4.5.0, toktx 4.4.2, Blender 5.2.

Scripts:

- `optimize_tier.ps1` (session copy)
- `assembly\decimate_low_tier.py`
- `assembly\render_glb_compare.py`
- `assembly\render_poster.py`

Runtime copies are in `station-mars\runtime\`.

## Step 5 — Integrate into the game

- Copy the final GLBs and poster to `public/models` (`sol-mars-station-150k.glb`, `sol-mars-station-75k.glb` and `sol-mars-station-poster.webp`). Do not delete the current `sol-mars-orbit-station-*` files until the new set is accepted.
- Update `MARS_STATION_ASSETS` and `MARS_STATION_POSTER_URL` in [station-model-assets.ts](../src/app/scene/station/station-model-assets.ts) (single URL per tier, `?v=` = SHA-256 prefix). Both the splash and the Stellar viewer resolve through this one definition.
- Update the expectations in `station-splash-assets.vitest.ts`, `splash-state.vitest.ts`, `station-model.vitest.ts`, `e2e/tests/splash.spec.ts` and `e2e/tests/viewer-station-model.spec.ts`.
- **Splash framing (2026-10-24):** the station splash uses a docking-end camera angle so the sun-shade sits behind the compute core, and increases camera distance by 25% to keep the full station in view. The GLB is unchanged. A browser review confirmed that the docking head, core, radiator wings, sun-shade, and all outer slip frames are visible. The slip frames are intentionally detached from the station; this preserves the original safe, tow-in harbor concept. Review capture: `C:\Development\Assets\laughing-octo-journey\station-mars\runtime\review-app-station-docking-view.png`. The screenshot used `/splash?market=sol-mars-orbit`, which has no left outlet content; it does not represent the full intro layout.
- **Planet framing correction (2026-10-24):** the docking-end camera exposed a world-space placement assumption: Mars remained positioned for the original mining-rig camera and was outside the station view. Celestial-body placement now maps the original composition into the reference camera's coordinate frame before applying depth separation. This restores Mars behind the station without moving the station, changing its lighting, or making the planet follow manual orbit controls. The original mining-rig view is preserved. Projection regression tests cover portrait and wide aspect ratios; the station Playwright test checks that Mars is in view and its surface is behind the station. A browser screenshot confirmed Mars is visibly rendered.
- **Habitat rotation (2026-10-24):** the `HabitatRing` node rotates once every 60 seconds in both the station viewer (including close-up) and station splash. Only the ring rotates, about its exported local Y axle through the spine; the GLBs remain unchanged. Rotation pauses for reduced motion, hidden documents, and hidden scene objects; the splash also pauses behind right-outlet overlays. Viewer canvases belong to the right outlet, so they are not gated by the shared background-scene visibility flag. Rotation uses elapsed frame time even at low frame rates, but skips the first frame after loading or resuming so suspended time cannot cause a jump. Static artwork stays unchanged.
- Runtime radiator heat: clone the hot-radiator material per `RadiatorHot_NN` node and drive its emissive intensity from gameplay (compute load, coolant-loop failure, damage). By default, inner panels near the core run hotter than outer panels. The baked in-panel gradient stays as the base pattern.
- Validation for the framing change:
  - `npm run test:spec -- src/app/scene/splash.vitest.ts` — passed, 22 tests
  - `npx playwright test e2e/tests/splash.spec.ts -g "loads the market-specific station pair" --reporter=line` — passed, 2 tests including setup
  - `npm run typecheck` — passed
  - `npm run build` — passed
  - Cold-cache load timing on the iPad tier remains to be measured per [testing-policy.md](testing-policy.md).
- Validation for habitat rotation:
  - `npm run test:spec -- src/app/app.component.vitest.ts src/app/scene/station/station-habitat-rotation.vitest.ts src/app/scene/station/station-model.vitest.ts src/app/scene/splash.vitest.ts` — passed, 55 tests. Includes 60-second revolutions at 1–120 fps, axis/pivot preservation, pause/resume, tier replacement, cleanup, and shared-canvas idle policy.
  - `npx playwright test splash.spec.ts viewer-station-model.spec.ts -g "loads the market-specific station pair|Station-specific viewer models|Touch-accessible station close-ups" --workers=1 --reporter=line` — passed, 8 tests including setup. Real GLBs in both tiers render and rotate in the system viewer and close-up; the station splash also rotates. Browser checks compare angular movement with elapsed time, verify stationary station parts, and exercise reduced motion and document visibility.
  - An initial parallel Playwright run failed the anchored-market camera-zoom assertion; that test passed in isolation and in the final single-worker run. Camera behavior was not changed in this implementation.
  - `npm run build` and `npm run typecheck` — passed.
  - Changed-file ESLint and Prettier checks — passed.
- Validation for the planet framing correction:
  - `npm run test:spec -- src/app/scene/splash.vitest.ts` — passed, 25 tests.
  - `npx playwright test splash.spec.ts -g "loads the market-specific station pair" --workers=1 --reporter=line` — passed, 2 tests including setup.
  - `npm run build` — passed; changed-file ESLint and Prettier checks — passed.

## Checklist

- [x] Step 1: Meshy MCP configured (user-level, stdio, pinned 0.6.5, external `.env` key file) and smoke-tested
- [x] Step 1: Server started in VS Code, key loaded, `meshy_check_balance` OK
- [x] Step 2: Concept v01 generated (style study only)
- [x] Step 2: Concepts v02–v04 (harbor layout); v04 accepted as style and module reference
- [x] Step 2: Hero modules A (docking head), B (compute core), and C (habitat ring) generated via image route and downloaded
- [x] Step 2: Kit part I (outer slip frame) generated via image route, textured, and downloaded
- [x] Step 2: Kit parts D (hot radiator) and E (cool radiator retexture) generated and downloaded
- [x] Step 2: Kit part G (sun-shade) built procedurally in Blender after the Meshy attempt failed
- [x] Step 2: Kit part F (spine truss) built procedurally in Blender
- [x] Step 2: Kit part H (tug and cargo ship) generated via image route and downloaded
- [x] Step 3: Rough layout v05 assembled by script (8 berths, 12 hot radiators, smoothed shade, 2× harbor), 139k triangles, ring and slips kept as named nodes. **Accepted.**
- [x] Step 3: Texture cleanup done: I lettering removed, C color matched, emissive on D (header-hot gradient) and on the A/B/C/H lights. Layout v07.
- [x] Step 4: Single merged GLB per tier (150k at 13.1 MB, 75k at 4.2 MB) and poster optimized and validated
- [x] Step 5: Integrated into `station-model-assets.ts`, tests updated and passing; station splash framing adjusted to show the full station from its docking end
