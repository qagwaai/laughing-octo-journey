# Sol planetary textures: implementation and validation plan

Date: 2026-10-08  
Status: Stages 0 and 1 complete for the active Earth/Luna/Mars pilot. Stage 0 includes user visual validation on 2026-10-08; Stage 1 includes the approved Forge catalog identity contract and source-clearance gates. Stage 2 is in progress: Earth, Luna and Mars candidates have passed offline preparation checks and are stored in the repository; originals/notices and selected evidence are now archived outside Git in the configured external artifact store. Fine color/relief alignment and renderer checks remain pending. Mercury observed imagery is explicitly deferred and remains procedural. No catalog assets are wired into the Viewer. Final Stellar Viewer visual acceptance remains on hold at the user's request.

## Goal and approved decisions

**Current selected texture sets (2026-10-08):** Earth `earth-july-v2`,
Luna `luna-v3`, Mars `mars-v2`. The user gave final acceptance of the current
geodesic polar normal appearance for Luna/Mars and explicitly authorized
promotion of both tiers, keeping albedo unchanged and prior versions retained.
This supersedes the earlier leading-candidate-only decision. It does not
complete fine registration or release the final Stellar Viewer acceptance hold.

**Current storage decision (supersedes session-only original storage):**
use `D:\at-template\artifacts\laughing-octo-journey\sol-textures` on this
development environment. Other environments configure their own external root
with `--artifact-root` or `SOL_TEXTURE_ARTIFACT_ROOT`; no session directory or
machine-specific root is hardcoded into the pipeline. Historical references to
session storage below describe acquisition/preparation at that time; they are
not the ongoing archival policy. Selected derivative maps and portable code
remain in Git. Source originals/notices and useful evidence are copied to the
external store, with retained session copies untouched.

Render recognizable, high-quality observed terrain for well-known Sol rocky
planets, dwarf planets, and major rocky/icy moons where suitable imagery exists.
Keep procedural generation as the default for arbitrary solar systems.

- Scope: Stellar Viewer system scene and body detail view only.
- Splash screens, splash planets, and mining backdrops remain unchanged.
- Stars, gas giants, and ice giants retain their existing renderers.
- Prefer NASA/JPL/USGS sources with verified commercial-use rights. Self-host
  approved runtime derivatives; do not restore GitHub texture hot-linking.
- Include source attribution using the existing external-anchor component.
- Include observed terrain on incompletely mapped bodies, clearly label
  low-resolution or reconstructed regions, and do not invent detailed geography.
- Quality target: 4096 x 2048 desktop detail, 2048 x 1024 constrained-device
  detail, and small system-view previews. These are proposed runtime tiers,
  not claims that every source contains that much detail.
- Permanently reduce the current Stellar Viewer station meshes to **5% of their
  current linear size**. This is not a temporary validation toggle. A future
  station mesh replacement is outside this plan.
- The user performs visual validation and final appearance sign-off using the
  Stellar Viewer. Automated tests support, but do not replace, that sign-off.

## Current implementation and integration seams

- [Surface resolver](../src/app/scene/planet/planet-surface-resolver.ts):
  central selection seam; currently routes eligible solid bodies to the terran
  generator and explicitly anticipates Sol-specific surfaces.
- [Texture cache](../src/app/scene/planet/planet-texture-cache.ts):
  shared overview/detail scheduling, LRU eviction, and GPU renderer ownership.
- [LOD presets](../src/app/model/planet/planet-texture.ts):
  current procedural overview is 256 x 128; detail is 2048 x 1024.
- [Bake result](../src/app/scene/planet/planet-bake.ts):
  requires procedural climate and CPU/GPU source metadata. Downloaded textures
  must not masquerade as procedural bakes.
- [System scene](../src/app/scene/viewer/viewer-system-scene.ts) and
  [template](../src/app/scene/viewer/viewer-system-scene.html):
  overview currently consumes albedo only.
- [Body detail scene](../src/app/scene/viewer/planet-view-scene.ts) and
  [template](../src/app/scene/viewer/planet-view-scene.html):
  focused bodies consume albedo, normal, and material maps; companion moons
  remain at overview quality.
- [External anchors](../src/app/component/external-anchors.ts):
  supports custom links and accessible labels, with safe external-link defaults.

Both viewer templates currently attach procedural clouds when a surface is
available. Catalog integration needs explicit atmosphere eligibility so airless
bodies do not inherit terrestrial clouds.

### Contract authority

The user approved Forge's new backward-compatible astronomical catalog identity
contract on 2026-10-08 after review of freshly served OpenAPI and live Sol reads.
The review fetched `http://localhost:3000/openapi.yaml?t=<current-epoch-milliseconds>`
and its reference graph (140 total documents), using a fresh timestamp query and
`Cache-Control: no-cache, no-store` / `Pragma: no-cache` headers on every fetch.
No document fetch failed and no checked JSON-schema pointer was unresolved.

The authority is root `x-catalog-identity` (rules, registry, dataDelivery and
responseProjections), `components.schemas.CatalogIdentity`, and the referenced
identity, solar-system-get, celestial-body-list and celestial-body-upsert schemas.
The approved optional field is `catalogIdentity: { namespace, key }`, or null.
Use the exact pair for frontend-owned approved imagery lookup. Unknown valid
pairs are allowed; missing/null/unsupported identity or no approved imagery
retains procedural rendering. Do not trim, case-fold, convert aliases, or match
display names, entity-ID prefixes or `visualization.textureKey`.

Astronomical identity is independent of game entity IDs, catalogId, game system
IDs, classification and parent/anchor relationships. Distinct entities may share
the same astronomical identity without merging navigation or selection.
On existing upserts, omission preserves stored identity and explicit null clears
it. Database recreation supplies fresh curated assignments; no migration,
backfill or read-time repair is required. Forge supplies no texture assets or
rights metadata. Splash behavior remains unchanged.

## Progress tracker

Use `Not started`, `In progress`, `Blocked`, `Awaiting visual review`, or `Done`.
Mark a stage done only when its acceptance evidence is recorded. A source found
in a catalog is not yet a cleared, downloaded, or visually accepted asset.

| Stage | Work                                                           | Prerequisites                          | Status      | Evidence / blocker                                                                                                                                                  |
| ----- | -------------------------------------------------------------- | -------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | Minimize station meshes to 5% linear size                      | None                                   | Done        | Automated verification passed; user confirmed Stellar Viewer visual validation complete on 2026-10-08                                                               |
| 1     | Confirm identities, source rights, and asset budgets           | None                                   | Done        | Active Earth/Luna/Mars source records, interpretation, coverage, policies and budgets consolidated; Forge identity approved; Mercury explicitly deferred            |
| 2     | Prepare active pilot assets: Earth, Luna, Mars                 | Stage 1                                | In progress | Earth v2, Luna v2 and Mars v1 candidates prepared and measured offline; fine co-registration and renderer checks pending; Mercury excluded until separately cleared |
| 3     | Implement catalog resolution, loading, and ownership           | Stages 1-2                             | Not started | Shared surface interface pending                                                                                                                                    |
| 4     | Wire viewer materials, atmospheres, attribution, and status UI | Stage 3                                | Not started | Both viewer surfaces must agree                                                                                                                                     |
| 5     | Automated pilot verification                                   | Stages 0 and 4                         | Not started | Commands and outcomes to be recorded                                                                                                                                |
| 6     | User visual pilot acceptance in Stellar Viewer                 | Stages 0 and 4                         | Not started | Explicitly on hold at the user's request; offline preparation is not appearance sign-off                                                                            |
| 7     | Expand approved moon/dwarf-planet catalog                      | Stages 5-6; per-body Stage 1 clearance | Not started | Per-body acceptance required                                                                                                                                        |
| 8     | Release verification and documentation                         | Stages 5-7                             | Not started | Production assets and regression evidence pending                                                                                                                   |

### Stage 0: unblock visual validation

- [x] Capture existing rendered dimensions for representative station fixtures,
      including descriptor-based and legacy station representations.
- [x] Apply a viewer-only uniform mesh scale factor of `0.05`, once, after
      existing shape sizing. Each rendered linear dimension must be 5% of its
      previous value, preserving aspect ratio and rotation.
- [x] Include all station mesh representations, not only market trade hubs.
      Verify canonical station classification and descriptor-based station paths.
- [x] Keep station positions, orbital data, physical catalog values, orbit
      lines, identity, navigation, and non-station rendering unchanged.
- [x] Preserve station selection and targeting. If the smaller mesh makes
      pointer selection impractical, validate existing list-based selection and
      explicitly resolve any interaction change; do not add a planet-obscuring
      invisible hit shell without review.
- [x] Confirm all station geometry types shrink correctly, including any
      minimum-size clamps. Do not also shrink a geometry radius if uniform mesh
      scaling already applies the factor.
- [x] Test exact dimension ratios across representative zoom levels and
      distance modes; verify non-station dimensions remain unchanged.
- [x] User confirms the station no longer blocks host-terrain validation at
      the chosen Stellar Viewer framing.

Implementation seam: [mapBodiesToRendered and station geometry selection](../src/app/scene/viewer/viewer-system-scene.ts).
Prefer a scoped visual mesh scale rather than changing physical radii or shared
camera/framing calculations. The 5% change persists in normal viewer use.

#### Stage 0 implementation evidence (2026-10-08)

[Station classification](../src/app/scene/viewer/viewer-formatters.ts) recognizes
legacy station body types and station descriptors, excluding gates even when
their legacy body type is `station`.
[Rendered-body mapping](../src/app/scene/viewer/viewer-system-scene.ts) multiplies
each existing geometry scale axis by `0.05` exactly once. Radius, geometry
parameters (including torus minimum tube size), rotation, positions, source data,
and target positioning are unchanged.

[Unit regression tests](../src/app/scene/viewer/viewer-system-scene.vitest.ts)
record baseline scales for legacy market/non-market stations and descriptor
trade hubs, refineries, naval outposts, and research platforms. Scale ratios are
verified at zoom 0/50/100 in compressed and proportional modes. Descriptor
stations with a different body type are covered; stars, planets, asteroids,
debris, and gates retain their existing scales.

[Focused browser regression](../e2e/tests/viewer-interactions.spec.ts) verified
the actual rendered trade-hub scale `[0.0825, 0.041, 0.0825]` (baseline
`[1.65, 0.82, 1.65]`), list selection, target-button state, and camera centering.
Pointer hit area naturally shrinks with the visible mesh; no enlarged invisible
hit shell was introduced.

#### Stage 0 user visual validation (2026-10-08)

The user confirmed that Stage 0 visual validation in the Stellar Viewer is
complete. Stage 0 is accepted and no longer blocks the texture pilot. No device,
viewport, screenshots, or separate pointer-usability measurements were supplied;
this records user sign-off, not additional measured performance evidence.

### Stage 1: identities, rights, and budgets

Quality-policy inspection found an existing pure
[selectMiningQuality selector](../src/app/scene/mining-splash-state.ts):
it chooses `low` when viewport width is below 768 CSS pixels, reported CPU cores
are at most 4, or data saving is enabled; otherwise it chooses `standard`.
The splash caller uses 4 cores when hardware concurrency is unavailable.
This selects prebuilt geometry tiers rather than measuring GPU capacity.

Approved reuse: the pure policy is now extracted into the shared
[render-quality module](../src/app/scene/render-quality.ts), retaining the existing splash API/behavior and tests. The planned Viewer integration will map
`standard` to 4K catalog detail and `low` to 2K catalog detail in the Viewer.
Do not inject `MiningSplashState` into the Viewer: constructing it also selects
a splash body, registers listeners, and probes WebGL. Texture memory budgets
and actual renderer texture-size support remain separate requirements.

The user approved this shared-helper approach on 2026-10-08.
[Quality-policy regression tests](../src/app/scene/render-quality.vitest.ts)
cover threshold boundaries, data saving, and splash API identity. The combined
quality-policy and existing mining-splash suite passed (29 tests); targeted lint
passed. No splash asset, appearance, tier threshold, or lifecycle changed, and
the Viewer does not consume catalog quality tiers yet.

The approved contract supersedes the initial incomplete identity inspection.
Both live read endpoints returned exactly 24 registered identities. Pilot
assignments are `sol/earth`, `sol/luna`, `sol/mars` and `sol/mercury`; registry
support does not imply approved imagery. Checked classifications and
parent/anchor relationships match the served projections, including Luna
remaining a moon of Earth and Pluto/Charon remaining dwarf-planet/moon.
The solar-system-get response contained 125 bodies and one star; the
celestial-body-list response contained 125 bodies. These are endpoint counts,
not the Viewer's larger collection with frontend additions.

Identity schema checks accepted valid/null/unknown pairs and rejected malformed
objects, extra fields, uppercase, whitespace, empty and overlength tokens.
The current procedural resolver remained unchanged for missing/null/unknown
identity, known identity without integrated imagery, and display-name changes.
Frontend identity DTOs, runtime validation and catalog wiring are still pending.
Upsert mutation semantics were reviewed from the contract, not exercised against
the world. Forge's reported tests and served-to-workspace equality were not
independently verified. Exact asset rights and source checksums remain pending.

#### Approved initial catalog budgets

The user approved these targets on 2026-10-08. They are acceptance targets, not
measured results:

| Budget                                                              | Standard       | Low            |
| ------------------------------------------------------------------- | -------------- | -------------- |
| Selected-body map-set transfer                                      | At most 4 MiB  | At most 2 MiB  |
| Estimated resident catalog textures, including mipmaps and previews | At most 96 MiB | At most 32 MiB |
| Detail albedo target                                                | 4096 x 2048    | 2048 x 1024    |

These residency caps cover catalog textures, not total application GPU memory.
Count optional relief/material maps against both budgets. Flag any source that
cannot meet the targets without visible quality loss rather than silently
lowering quality. Actual measurements and renderer maximum texture-size checks
remain required. Default tier selection uses the existing full-window width,
core-count fallback of 4, and save-data policy; do not silently substitute
split-panel width or treat core count as measured GPU capability.

#### Stage 1 source-policy review

Rechecked the linked NASA/USGS reuse policies and Earth/Luna source descriptions
on 2026-10-08. NASA guidance explicitly includes texture maps, requires source
acknowledgment and no implied endorsement, and excludes third-party works from
blanket permission. USGS-produced material is generally U.S. public domain;
third-party contributions still require review.

Earth BMNG is a monthly composite, not a single photograph; its documentation
notes coastal/deep-water blending and possible residual cloud/snow artifacts.
Luna's updated CGI Moon Kit uses visible-band color adapted for human vision,
small inpainted dropouts, and lower-resolution monochrome polar substitution
outside the source mosaic's 70 degrees north/south coverage. These disclosures
must accompany accepted derivatives. Neither policy review nor source-page
inspection is final clearance for a specific downloaded file.

#### Earth decisions (approved 2026-10-08)

- Fixed **July** NASA Blue Marble Next Generation baseline; no live weather
  or automatic seasonal switching. Use an unshaded, cloud-removed base-color
  product, not color with baked topography/bathymetry shading.
- The user accepts disclosed synthetic deep-ocean blue, coastal blending
  artifacts, possible residual clouds and snow/cloud ambiguity. Keep these
  limitations in the asset record and eventual viewer disclosure.
- Prepare subtle **land-only relief** from verified elevation, not from color
  brightness. Keep oceans flat; verify coastline masking and map alignment.
  All relief maps count against the approved transfer and residency budgets.
- Approved elevation candidate: **NOAA unrestricted GLOBE v1.0**, not its
  restricted edition. NOAA describes the unrestricted edition as full global
  coverage without copyright or security distribution restrictions. Exact
  The subsequent source audit below selects the unrestricted tiles and records
  documented encoding and notices; binary file validation remains pending.
- Store large originals and processing intermediates in current session
  artifact storage for the pilot, outside the repository and deployed assets.
  The user revised derivative storage on 2026-10-08: selected prepared outputs
  and source/rights records enter the repository now, before final visual
  acceptance, under `assets\sol-textures\<asset-version>`. This non-deployed
  location is outside the build's `public` asset input. Originals, tooling,
  intermediate files and superseded experiments remain in session storage.
  Repository storage does not imply imagery activation or visual approval.
- On approved Earth asset load failure, retain any valid Earth preview/lower
  tier, expose error/retry, and use a clearly marked loading/error placeholder
  if no Earth imagery has loaded. Do not silently replace Earth geography with
  random terrain. Missing identity or no approved catalog imagery still uses
  the existing procedural path.

Primary references checked:
[NASA BMNG source description](https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/),
[NASA media usage guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/),
[NOAA GLOBE overview and edition restrictions](https://www.ncei.noaa.gov/products/etopo-global-relief-model),
and [GLOBE v1.0 citation](https://www.ngdc.noaa.gov/mgg/topo/globe.html).
The NOAA overview URL served GLOBE content during this review; this is not an
ETOPO source selection. These decisions do not establish measured performance
or replace the subsequent file-level validation.

#### Earth exact-source audit (2026-10-08)

The user authorized source/documentation and small text-header inspection only,
not raster downloads or processing, and selected the following acquisition set.

**Color:** July 2004 global **5400 x 2700 GeoTIFF**, selected from NASA's
[BMNG Base Map page](https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/):
[world.200407.3x5400x2700_geo.tif](https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-base/july/world.200407.3x5400x2700_geo.tif).
This is the Base Map product, not Base Map + Topography or Bathymetry.
An HTTP HEAD request returned 200 with `image/tiff`; no content length was
provided. Dimensions are source-page claims, not measurements of the file.
The selected source exceeds the 4096 x 2048 target without needing the
21600 x 10800 archival alternative.

NASA's source article credits **Reto Stöckli, NASA Earth Observatory
(NASA Goddard Space Flight Center)**. Preserve that credit and link the product
page and [NASA media guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/).
Those guidelines generally permit factual imagery use without implying
endorsement, but exclude third-party copyrighted material from blanket
permission. No product-specific third-party restriction was identified in the
inspected HTML; this is not unconditional legal clearance. The article links
[BMNG's technical report and acknowledgments](https://assets.science.nasa.gov/content/dam/science/esd/eo/content-feature/bluemarble/bmng.pdf);
its full acknowledgments remain to be reviewed. The raster's channel count,
sample type, color profile, GeoTIFF CRS/transform and row/longitude orientation
remain unverified until authorized file inspection. Do not assume sRGB or
orientation solely from its filename.

**Elevation:** all 16 unrestricted GLOBE v1.0 tiles, selected from
[NOAA's tile index](https://www.ngdc.noaa.gov/mgg/topo/gltiles.html).
Each exact acquisition URL is below; all returned HTTP 200 to HEAD requests
with gzip content type. Exclude the restricted Australian alternative `l10b.gz`.

| Latitude bounds | Longitude -180 to -90                                                | Longitude -90 to 0                                                   | Longitude 0 to 90                                                    | Longitude 90 to 180                                                  |
| --------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 50 to 90        | [a10g.gz](https://www.ngdc.noaa.gov/mgg/topo/DATATILES/elev/a10g.gz) | [b10g.gz](https://www.ngdc.noaa.gov/mgg/topo/DATATILES/elev/b10g.gz) | [c10g.gz](https://www.ngdc.noaa.gov/mgg/topo/DATATILES/elev/c10g.gz) | [d10g.gz](https://www.ngdc.noaa.gov/mgg/topo/DATATILES/elev/d10g.gz) |
| 0 to 50         | [e10g.gz](https://www.ngdc.noaa.gov/mgg/topo/DATATILES/elev/e10g.gz) | [f10g.gz](https://www.ngdc.noaa.gov/mgg/topo/DATATILES/elev/f10g.gz) | [g10g.gz](https://www.ngdc.noaa.gov/mgg/topo/DATATILES/elev/g10g.gz) | [h10g.gz](https://www.ngdc.noaa.gov/mgg/topo/DATATILES/elev/h10g.gz) |
| -50 to 0        | [i10g.gz](https://www.ngdc.noaa.gov/mgg/topo/DATATILES/elev/i10g.gz) | [j10g.gz](https://www.ngdc.noaa.gov/mgg/topo/DATATILES/elev/j10g.gz) | [k10g.gz](https://www.ngdc.noaa.gov/mgg/topo/DATATILES/elev/k10g.gz) | [l10g.gz](https://www.ngdc.noaa.gov/mgg/topo/DATATILES/elev/l10g.gz) |
| -90 to -50      | [m10g.gz](https://www.ngdc.noaa.gov/mgg/topo/DATATILES/elev/m10g.gz) | [n10g.gz](https://www.ngdc.noaa.gov/mgg/topo/DATATILES/elev/n10g.gz) | [o10g.gz](https://www.ngdc.noaa.gov/mgg/topo/DATATILES/elev/o10g.gz) | [p10g.gz](https://www.ngdc.noaa.gov/mgg/topo/DATATILES/elev/p10g.gz) |

Verified from NOAA documentation and all 16 served ESRI text headers:

- Gzip-compressed, headerless **signed 16-bit little-endian** elevation rasters,
  row-major, 10800 columns; 4800 rows for A-D/M-P and 6000 for E-L.
- Geographic latitude/longitude, **WGS84**, 30 arc-second spacing; elevations
  in metres above mean sea level. West longitudes are negative, east positive.
  Upper-left cell centres and tile bounds establish north-to-south rows and
  west-to-east columns. Treat cell centres versus edges consistently.
- Ocean marker is **-500**, not bathymetry. Mask it before resampling/relief;
  do not discard all negative values, since real land can lie below sea level.
- **Alignment gate:** the served `d10g.hdr` lists `ULYMAP 89.995333333333`,
  while documented 50-to-90-degree bounds and 30-arc-second cell spacing imply
  `89.995833333333`. Investigate and record an explicit resolution before
  mosaicking; do not silently normalize the discrepancy.
- Compressed HEAD lengths for some tiles differ from the historical table.
  Record actual downloaded byte counts and hashes rather than treating
  documentation sizes as checksums.

Evidence:
[tile extents](https://www.ngdc.noaa.gov/mgg/topo/report/s11/s11C.html),
[binary encoding](https://www.ngdc.noaa.gov/mgg/topo/report/s11/s11D.html),
[projection](https://www.ngdc.noaa.gov/mgg/topo/report/s11/s11H.html),
[cell referencing](https://www.ngdc.noaa.gov/mgg/topo/report/s5/s5Biii.html),
and [ESRI header convention](https://www.ngdc.noaa.gov/mgg/topo/report/s11/s11Fiv.html).
Served headers use the tile stem at
`https://www.ngdc.noaa.gov/mgg/topo/DATATILES/elev/esri/hdr/<tile>.hdr`.

NOAA's [copyright and redistribution section](https://www.ngdc.noaa.gov/mgg/topo/report/s3/s3B.html)
explicitly identifies the G.O.O.D. files as unrestricted and requests scientific
citation. Preserve the [full GLOBE citation](https://www.ngdc.noaa.gov/mgg/topo/report/s3/s3A.html):
GLOBE Task Team and others, eds., 1999, _The Global Land One-kilometer Base
Elevation (GLOBE) Digital Elevation Model, Version 1.0_, NOAA/NGDC.
The user approved retaining upstream notices in the source record and linked
attribution details, including the [Chapter 12 disclaimers](https://www.ngdc.noaa.gov/mgg/topo/report/s12/s12.html),
DTED Level 0/NIMA credit and no-endorsement language, and accuracy/as-is notices.
This global product is for visual relief, not mission-critical terrain use.

**Gates remaining after the documentation-only audit:** full BMNG acknowledgments/file notices; actual raster
encoding/georeferencing and hashes; the D-tile header discrepancy; coastline
alignment, below-sea-level land handling and flat-ocean relief; measured
derivative budgets and user visual acceptance. No raster was downloaded.

#### Earth source-clearance acceptance (2026-10-08)

The user subsequently authorized downloads and local inspection, approved an
isolated inspection environment, and accepted Earth's source-clearance gate for
local derivative preparation. This supersedes the documentation-only gates
above; it is project acceptance based on recorded evidence, not a legal opinion
or visual/performance acceptance. Derivative generation is a subsequent step.

Downloaded the selected NASA color GeoTIFF, BMNG report, all 16 unrestricted
NOAA elevation tiles, 16 ESRI headers and nine source/policy pages into session
artifact storage. The 43 acquisitions total **315,448,153 bytes**.
No originals were added to Git or deployed assets. The session's
`files/earth-source-audit/` contains `acquisition-manifest.json` (URLs, UTC
retrieval date, bytes and SHA-256), `inspection-results.json`, the extracted
report text, originals, inspection script and isolated tools.

**NASA report and notices:** reviewed all 13 pages, including citation and
acknowledgments. The report identifies MODIS science/data support contributions
and NASA-funded production; no additional redistribution restriction was
identified in the inspected report, source HTML or TIFF metadata. Preserve
NASA's general media policy caveats and no-endorsement requirements. Full
report citation: R. Stöckli, E. Vermote, N. Saleous, R. Simmon and D. Herring
(2005), _The Blue Marble Next Generation - A true color earth dataset including
seasonal dynamics from MODIS_, NASA Earth Observatory.
The report confirms `world` is non-shaded, unlike `world.topo` and
`world.topo.bathy`; it also documents contrast enhancement and gap filling.
Keep those disclosures with the existing cloud/ocean limitations.

**Actual color raster:** 12,175,080 bytes, 5400 x 2700, three unsigned 8-bit
RGB bands, DEFLATE compression, pixel interleaving, area-referenced EPSG:4326.
All **43,740,000 samples** decoded successfully. The GeoTIFF transform places
the upper-left edge approximately at (-180, 90), with positive eastward
longitude steps and negative southward latitude steps of 1/15 degree.
Bounds are global within floating-point rounding. This establishes north-up,
west-to-east orientation, not final Three.js UV alignment.

No embedded ICC profile was found. NASA describes display-oriented,
contrast-enhanced RGB, not linear reflectance or a verified sRGB profile.
The user explicitly approved preserving RGB appearance and treating runtime
derivatives as **sRGB under a documented display-color assumption**, subject to
Stellar Viewer visual review. Do not report this as verified source encoding.

Color SHA-256:
`a6d0df740db7eea2d8e274ecffcc1181df60c5329a7c16e637db6046b77b94c2`.
BMNG report SHA-256:
`487f3e3c84f862f6053eda3e0213b17ebb923133adbdb75d574a28b678b56949`.

**Actual elevation payloads:** 301,254,887 compressed bytes total. All 16 gzip
streams fully decoded and passed trailer integrity checks; decoded lengths
match documented rows x 10800 columns x 2 bytes (1,866,240,000 bytes total,
streamed without writing uncompressed originals). Signed little-endian land
minima/maxima match NOAA's table. There are **1,185,187 below-sea-level land
cells** distinct from the -500 ocean marker; preserve them during masking.
Compressed and decoded payload hashes are recorded in session manifests.

| Tile file | Downloaded bytes | Compressed SHA-256                                                 |
| --------- | ---------------- | ------------------------------------------------------------------ |
| a10g.gz   | 20396907         | `bc8e2e0d612999c9f8fbd54b22b5b201a102df1e661e7198eb1e648af32f6a78` |
| b10g.gz   | 18015073         | `d01ed81c59423ee30f7bc7550601707848c673210e0ba41db7a7a8b1ad8128d2` |
| c10g.gz   | 24828988         | `294096d7e1c35cd126d412072c3d95a47313e024f8888d54facb3b88ad6ec1e9` |
| d10g.gz   | 32135119         | `5ce64b45a8cd54b296f232767583f6f39f3698ca54992590b469816336122365` |
| e10g.gz   | 17228609         | `09422b1d5d1ca69b6e98eeb758f3c83b02d7871348a1f1850fd77ad3d7be86e6` |
| f10g.gz   | 19023189         | `222b13cfd079da87d4ae851284c181ceea84945d5d121cb91039c2dfbbf8fd09` |
| g10g.gz   | 59501587         | `36296e0fe9e7ee9ffe41c9e4b7b74a4bf8d2254b25ca7c9bdade2b6cede0f5c3` |
| h10g.gz   | 27900726         | `6ba2d4acc0a6debf5e6d2be76b9e21501a5e1f90f18486f27f099bfdc9c23738` |
| i10g.gz   | 165338           | `766b40c4ee25566fb6e370a0eb2d4fd5f843da4475d007f2852857d1082d3259` |
| j10g.gz   | 21249443         | `655a84859f6d73d147f5650a0593c48c178279445afa68e9c71cfde67be3d620` |
| k10g.gz   | 16203482         | `1df600a166503afc328dcdebca759751478a80adca14d3347e6cfcc9d942c8bc` |
| l10g.gz   | 11620467         | `f448ccafe7a891bb65bdb6641c645d4f2a3895d593ac83705b9c3c3f7d15cd10` |
| m10g.gz   | 6145507          | `04407e4f3b37acd66db72f765452690a5852118c04ce838076f8186b82838739` |
| n10g.gz   | 8521834          | `6be2f38f7ac076d0e36ad2199ad2647ecaa9701866fbe84d271b53b699f845ec` |
| o10g.gz   | 9071477          | `fb12cd9963703f7234f52437a36e491d58ac434e0bc0ea6290c3156550f91819` |
| p10g.gz   | 9247141          | `87a07cce4270cdd5d4cefeb5d53a00b76eae5c8ea277e1dbabe9fd08aa1a88ff` |

**D-tile resolution:** the downloaded header retains the latitude mismatch.
The user approved deriving georeferencing from NOAA's documented 50-to-90 N,
90-to-180 E bounds and exact 30-arc-second spacing, giving upper-left cell
centre (90.004166666667, 89.995833333333). Preserve the original header unchanged
and record this explicit correction in derivative provenance. This is a local
processing convention, **not a NOAA-confirmed erratum**. Do not shift the raw
samples or apply a second pixel-centre offset.

Validation command: session-local `venv\Scripts\python.exe inspect_sources.py`
passed after obsolete optional Idrisi header URLs returned 404 and were removed
from acquisition scope. All live ESRI headers and canonical documentation were
retained. Tools: Python 3.14.5, rasterio 1.5.2 / GDAL 3.12.2, NumPy 2.5.3,
pypdf 5.9.0. Initial rasterio 1.4.3 installation failed for lack of a compatible
wheel; approved tooling was installed with pinned compatible wheels instead.
No project dependencies or system-wide packages changed.

**Remaining Earth work (Stage 2 onward):** generate preview/2K/4K color and
subtle land-only relief derivatives; verify actual mask/coastline/UV alignment,
seams and poles; measure transfer/residency budgets; retain accurate attribution
and notices; obtain user visual acceptance. No derivatives have been produced.

#### Luna source decisions and clearance (2026-10-08)

The user selected the updated NASA CGI Moon Kit color maps with disclosed
coverage limitations, subtle relief from verified LOLA elevation, and a single
4K 16-bit sRGB color original for both 4K/2K runtime derivatives. Apply Earth's
approved session-storage and load-failure policies: preserve valid preview/lower
tier imagery, expose error/retry and use a marked placeholder when no approved
image has loaded. No approved catalog imagery still uses procedural rendering.
Luna is airless and must not inherit procedural terrestrial clouds.

The user authorized source downloads and inspection, then an additional original
LOLA reference download to verify the transformation numerically. Source-clearance
acceptance was approved after those checks; derivative preparation is a
subsequent step. This is documented project acceptance, not a legal opinion or
final visual/performance acceptance.

| Source                                                                                                                                                  | Actual bytes | SHA-256                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------ |
| [2025 color, lroc_color_16bit_srgb_4k.tif](https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_16bit_srgb_4k.tif)                          | 61891324     | `9731fa8af425b6c2f88f277ecca82bf8c603f3743894f64ed7b25c5bfefa22ff` |
| [Elevation, ldem_16_uint.tif](https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/ldem_16_uint.tif)                                                   | 33201026     | `45a2b32d56e81ed30db07fead8abc842b249b6511219d9ca2c53f81bc2dc5d62` |
| [Original LOLA reference, ldem_16.img](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/img/ldem_16.img) | 33177600     | `a511e40d7a3ea3275945b4da2a1df377133264fab0be94b7434b1cf8907254cb` |

Color is **4096 x 2048, three unsigned 16-bit RGB bands**, with embedded
**sRGB IEC61966-2.1 ICC profile**, TIFF top-left orientation and full successful
decode (25,165,824 samples). Internal creation timestamp is 2025-12-02 and HTTP
Last-Modified is 2025-12-03, consistent with the
[Moon Kit's documented December 2025 revision](https://svs.gsfc.nasa.gov/4720/).
The source page was updated January 2026. Do not mix in the 2019 color variant
or the separate 2K JPEG without a new revision-consistency review.

Elevation is **5760 x 2880, one unsigned 16-bit band**, TIFF top-left orientation,
with full successful decode (16,588,800 samples), no zero cells and no tagged
nodata value. It is the 2019 elevation product, not a newly measured 2025 DEM.
Decode height relative to the 1737.4 km reference sphere as
`(unsignedValue - 20000) * 0.5` metres. Actual heights range from **-8981.5 to
10685.5 metres**. Do not interpret the unsigned offset as actual lunar altitude,
normalize each tier independently, or use image brightness as height.

Neither TIFF has embedded geographic georeferencing; the identity transform
reported by GDAL is not a geographic transform. NASA documents both rendering
maps as centred on 0 degrees longitude. The
[original LOLA label](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/img/ldem_16.lbl)
specifies simple cylindrical, east-positive 0-to-360 longitude, north-to-south
pixel registration, 16 pixels/degree and the mean Earth/polar-axis DE421 frame.
**Every elevation sample matched exactly** after rolling the original signed
LOLA array by half its width (2880 columns) and adding 20000. This verifies
the rendering DEM's -180-to-180 longitude reordering without a vertical flip.
The page documents matching colour-map centring, but final colour/relief
landmark alignment and Three.js UV orientation remain Stage 2/visual gates.

Retain the exact requested credit **"NASA's Scientific Visualization Studio"**,
visualizer **Ernie Wright (USRA)**, scientist **Noah Petro (NASA/GSFC)** and
LROC/LOLA instrument-team data contributions. The
[WAC source readme](https://pds.lroc.asu.edu/data/LRO-L-LROC-5-RDR-V1.0/LROLRC_2001/DATA/MDR/WAC_HAPKE/WAC_HAPKE_README.TXT)
requests the product citation: Sato et al. (2017), _Lunar Mare TiO2 Abundances
Estimated from UV/Vis Reflectance_, Icarus 296, 216-238,
[doi:10.1016/j.icarus.2017.06.013](https://doi.org/10.1016/j.icarus.2017.06.013).
Preserve the original readme citation rather than silently changing its author
list. No additional imagery redistribution restriction was identified in the
inspected source page/readme/labels/TIFF notices. NASA's
[general media policy](https://www.nasa.gov/nasa-brand-center/images-and-media/)
and third-party/no-endorsement caveats remain applicable. The ICC profile's
copyright notice concerns the profile, not proof of a lunar-image restriction;
retain the unmodified original and avoid copying profile metadata into credits.

Coverage/interpretation disclosures:

- Rendering-oriented, aesthetically adjusted 643/566/415 nm colour, not a
  scientific reflectance product. The source readme's separate three-band
  browse product uses different wavelengths; do not substitute it.
- LROC source colour covers 70 N to 70 S; polar regions use lower-resolution
  monochromatic LOLA albedo, covering approximately 6% of lunar surface area.
  Small high-latitude dropouts were inpainted.
- LOLA's label documents possible 45-degree latitude-band edge artifacts and
  interpolation for incomplete coverage. Rendering relief must not imply
  invented high-resolution crater detail.

Session `files/luna-source-audit/` retains originals, source/policy HTML,
readme/label, acquisition manifest, inspection results and numerical reference
comparison. The initial six acquisitions total 95,473,933 bytes; the additional
reference IMG is 33,177,600 bytes. Reused Earth's isolated rasterio 1.5.2 /
GDAL 3.12.2 and NumPy 2.5.3 tools; no new project dependencies. The inspection
script and original-reference comparison passed. GDAL's missing-georeferencing
warning was investigated as above, not ignored.

**Remaining Luna work:** derive preview/2K/4K colour and subtle relief within
approved budgets; verify colour/elevation landmarks, poles, seams and UVs;
preserve source limitations/credits and airless appearance; obtain user visual
acceptance. Luna v2 candidates are now prepared as recorded in Stage 2 below;
they are not deployed, Viewer-integrated or visually accepted.

#### Mars source decisions and clearance (2026-10-08)

The user selected USGS Viking global colour with disclosed synthetic-green,
coverage and residual-haze limitations, plus subtle relief from a separate MOLA
topography product. Earth/Luna storage and failure policies apply: originals
remain in session storage; preserve valid Mars imagery on failure, expose
error/retry and use a marked placeholder when no approved image has loaded.
Missing identity or no approved imagery remains procedural.

The user authorized downloads/inspection and accepted the source-clearance gate
for subsequent derivative preparation. **Final Stellar Viewer visual acceptance
is on hold**, as explicitly requested. At source clearance, no derivative processing or rendering
integration had been performed; Mars v1 preparation is recorded in Stage 2 below.
Source clearance is project acceptance, not a legal
opinion or a claim that colour and relief are already precisely co-registered.

| Source                                                                                                                                     | Actual bytes | SHA-256                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ------------ | ------------------------------------------------------------------ |
| [Viking colour GeoTIFF](https://planetarymaps.usgs.gov/mosaic/Mars_Viking_ClrMosaic_global_925m.tif)                                       | 797888177    | `5b3c6bea36cec0ec65b9ce5927db6b1c555c5fae60a227c774f9fcaecdf5bb33` |
| [MOLA MEGT90N000EB topography IMG](https://pds-geosciences.wustl.edu/mgs/urn-nasa-pds-mgs_mola_topography_derived/meg016/megt90n000eb.img) | 33177600     | `d18d9b9ab8c5516d02e157dd2cde0f1d0d160c21940e953ba22391269a545e7b` |

**Colour verification:** 23059 x 11530, three unsigned 8-bit RGB bands,
Simple Cylindrical/equirectangular, 925.406-metre pixels, north-up and eastward
columns, central meridian 0 and source sphere radius 3396190 metres.
All **797,610,810 samples** decoded successfully. The raster has zero nodata
and exactly **11,530 all-zero pixels**, all in its first/western column.
Its projected extent slightly exceeds nominal latitude bounds, and is not an
exact 2:1 pixel rectangle. Normalize from its actual transform, not solely
from filename or nominal global bounds.

No embedded colour profile was found. The user approved preserving its RGB
appearance with an explicit **sRGB display assumption**, not a verified source
profile or scientifically exact natural colour. The
[product metadata](https://astrogeology.usgs.gov/search/map/mars_viking_global_color_mosaic_925m.xml)
describes approximately 98% red and 95% violet coverage, synthesized green,
Minnaert photometric normalization and conservative haze subtraction. These
coverage figures describe the observations, not the remaining TIFF nodata count.
Do not infer that nearly complete valid pixels mean all geography is observed
in every channel or that the product is shadow-free.

**Elevation verification:** selected maintained PDS4 bundle's global
16-pixels/degree product, 5760 x 2880, signed **16-bit big-endian** integer
metres, north-to-south rows and east-positive 0-to-360-degree columns.
All **16,588,800 samples** were read; actual range is **-8177 to 21171 metres**,
matching its label, with no -32768 sentinel cells.
This is topography (planetary radius minus areoid), not the separate radius,
areoid, count or shaded-relief product. The canonical label specifies
planetocentric IAU2000 coordinates and the GMM3 areoid. Preserve below-areoid
negative heights; Mars has no Earth-style flat-ocean mask.

Evidence:
[PDS4 label](https://pds-geosciences.wustl.edu/mgs/urn-nasa-pds-mgs_mola_topography_derived/meg016/megt90n000eb.xml),
[retained original label](https://pds-geosciences.wustl.edu/mgs/urn-nasa-pds-mgs_mola_topography_derived/meg016/megt90n000eb.lbl),
and [maintained bundle overview](https://pds-geosciences.wustl.edu/missions/mgs/megdr.html).
Product version is 2.0, created in April 2003; its 2026 PDS4 migration is not a
new acquisition or higher-resolution DEM.
Unobserved bins are interpolated; the label notes low equatorial sampling and
profile gaps up to 12 km. Do not invent crater detail finer than the source.

**Approved processing policies:** normalize both maps to a common east-positive
-180-to-180-degree grid and record resampling/longitude reordering explicitly.
Treat Viking's nodata edge as missing data, not black terrain; any seam-edge
fill must use neighbouring valid source pixels and be recorded, not invent
geography. MOLA's convenience ENVI header says `data ignore value = 0`, but
canonical PDS labels define ordinary heights without a zero missing constant.
The raster contains **2128 zero-metre cells**; the user approved retaining
these as valid elevation. Record this discrepancy instead of silently inheriting
the convenience header's nodata setting.

The Viking mosaic is tied to the MDIM image control network, whereas MOLA
uses IAU2000 coordinates. Matching longitude ranges alone does not prove
landmark alignment. Co-registration checks at recognizable terrain features,
polar/seam treatment and restrained relief remain Stage 2 gates.

**Rights/credits:** USGS product metadata explicitly states `public domain`
and use constraints `None`. Retain NASA/Viking/PDS and USGS Astrogeology
credits, source links and [USGS reuse policy caveats](https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits),
including third-party exclusions and no implied endorsement. The Viking
metadata references Eliason, Batson and Manley (2001), Mars Mosaicked Digital
Image Model and Digital Terrain Model, NASA PDS. MOLA's
[dataset catalog](https://pds-geosciences.wustl.edu/mgs/urn-nasa-pds-mgs_mola_topography_derived/catalog/megdrds.cat)
requests: Smith, D.E., M.T. Zuber, G.A. Neumann, E.A. Guinness and S. Slavney,
_Mars Global Surveyor Laser Altimeter Mission Experiment Gridded Data Record_,
MGS-M-MOLA-5-MEGDR-L3-V1.0, NASA PDS, 2003.
No additional imagery restriction was identified in inspected product notices;
retain NASA's general media-policy caveats.

Session `files/mars-source-audit/` contains 10 acquisitions totalling
**831,525,138 bytes**, original labels/notices, hashes and inspection results.
The local inspection script passed after the nonexistent `catalog/dataset.cat`
URL was replaced with the listed `catalog/megdrds.cat`. Reused the existing
isolated rasterio/GDAL/NumPy tools; no project dependencies changed.
Originals remain outside Git/deployment and no partial acquisitions remain.

**Remaining Mars work:** fine colour/relief landmark alignment, runtime
nodata/seam/pole appearance and observed transfer/residency measurements,
and eventual user visual review. Mars v1 candidates passed offline preparation
and file-budget checks below. Source acceptance does not waive runtime gates.

#### Mercury decisions and explicit deferral (2026-10-08)

The user requested a verified natural-looking global colour source rather than
the enhanced-colour candidate, and selected subtle relief from a separately
verified global elevation product if observed imagery becomes approved.
Earth/Luna/Mars session-storage and failure policies would apply.

Primary-source research did **not establish an approved natural-colour global
texture**. This is a bounded research result, not a claim that no such product
exists. USGS's
[MD3 metadata](https://astrogeology.usgs.gov/search/map/mercury_messenger_mdis_basemap_md3_color_global_mosaic_665m.xml)
explicitly states that 1000/750/430 nm RGB is not Mercury's human-eye appearance.
Its [enhanced-colour metadata](https://astrogeology.usgs.gov/search/map/mercury_messenger_mdis_basemap_enhanced_color_global_mosaic_665m.xml)
also explicitly rejects human-eye interpretation and uses principal components
and a band ratio. Do not relabel either product as natural colour or simply
desaturate it and claim observed true colour.
[NASA's Mercury facts](https://science.nasa.gov/mercury/facts/) describe a
greyish-brown human-eye appearance but do not provide a verified global texture.
[Solar System Scope's texture notes](https://www.solarsystemscope.com/textures/)
disclose fictional gap filling and saturation adjustment, so that pack was not
approved under this plan's terrain policy.

The user explicitly selected:

- **Defer Mercury observed imagery and retain procedural rendering** until a
  verified natural-looking global source is selected and cleared.
- **Defer DEM acquisition too**; no colour or elevation raster downloads and
  no derivatives for Mercury in the active pilot.
- Do not substitute monochrome, enhanced colour, artist-tinted terrain or
  invented geography without a new explicit decision.
- Keep authoritative `sol/mercury` identity, entity IDs, classification and
  navigation unchanged. Identity alone does not activate catalog imagery.
- Final Stellar Viewer visual acceptance remains on hold.

Record, but do not clear or acquire, the
[USGS MESSENGER Global DEM 665m v02 candidate](https://astrogeology.usgs.gov/search/map/mercury_messenger_global_dem_665m).
Its [metadata](https://astrogeology.usgs.gov/search/map/mercury_messenger_global_dem_665m.xml)
describes a camera-derived global terrain model from overlapping NAC/WAC-G
observations and a least-squares bundle adjustment, with a one-sigma point-cloud
filter in version 2. It is not a globally laser-measured elevation product.
File encoding, gaps, rights/credits, alignment and derivative suitability would
require a separate audit if Mercury is reactivated.

Mercury's deferral does not block preparation of cleared Earth/Luna/Mars assets.
No Mercury source-clearance or visual-acceptance claim is made.

#### Pilot asset audit: product-level evidence

| Body    | Provider / authors and rights evidence                                                                                                        | Candidate acquisition                                                                  | Projection / interpretation                                                                                                            | Remaining gate                                                                             |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Earth   | NASA BMNG acknowledgments reviewed; full author citation and NASA policy retained; NOAA G.O.O.D. files unrestricted with citation/disclaimers | Selected July GeoTIFF and a10g-p10g downloaded/hashed; source-clearance gate accepted  | RGB8/EPSG:4326 color with approved sRGB display assumption; signed little-endian elevation; explicit D-header correction               | Stage 2 derivative masking/UV alignment, measured budgets and visual acceptance            |
| Luna    | NASA SVS/Ernie Wright/Noah Petro and LROC/LOLA credits retained; source-clearance gate accepted                                               | 2025 4K sRGB TIFF and 2019 LOLA elevation downloaded/hashed; original LOLA IMG checked | RGB16 with verified sRGB ICC; elevation half-metre offset and longitude roll exactly matched; polar substitutions/inpainting disclosed | Stage 2 colour/relief alignment, budgets and visual acceptance                             |
| Mars    | USGS Viking public-domain metadata; NASA/Viking/PDS and MOLA citations retained; source-clearance gate accepted                               | Viking RGB TIFF and global 16-pixel/degree MOLA topography downloaded/hashed           | RGB8 with sRGB assumption and nodata edge; MOLA signed big-endian metres; explicit normalization policies approved                     | Stage 2 landmark alignment, seam/nodata handling, budgets; final visual acceptance on hold |
| Mercury | No observed-imagery source accepted; primary product descriptions reviewed                                                                    | Colour and global stereo DEM acquisition explicitly deferred                           | Inspected colour candidates are not human-eye colour; identity remains authoritative but imagery inactive                              | Procedural until verified natural-looking global source and separate clearance             |

Mars metadata describes photometric normalization and conservative haze removal,
not a guarantee of shadow-free albedo. Mercury's title/filename says 665 m while
its abstract also mentions 250 m; treat this as a metadata inconsistency and
verify actual raster dimensions/georeferencing before reporting effective
resolution. The Mercury TIFF remains an acquisition candidate, not a verified working
download. Earth, Luna and Mars source inspection is recorded above. Page-listed sizes are not downloaded byte counts or checksums.
Large originals must remain outside deployed assets and ordinary Git blobs.
Earth, Luna and Mars sources have been downloaded and inspected. Selected Earth runtime-format
candidates now exist in non-deployed repository storage; no pilot asset has been integrated
or marked visually accepted.

The identity-contract blocker is resolved. Earth/Luna/Mars source, rights/credits
and storage decisions are accepted; Mercury is explicitly deferred, not an
unresolved prerequisite for those active bodies. Stage 1 is Done for the active
Earth/Luna/Mars scope: accepted acquisition manifests, source audits and the
decisions above supply the completed checklist. This does not clear Mercury
or any expansion body, implement the contract, or accept derivative appearance.
Stage 2 will produce and measure derivatives; approval of budgets is not proof
that assets meet them.

- [x] Re-fetch cache-busted OpenAPI and verify exact canonical Sol identities.
- [x] Define frontend-owned approved catalog selection by exact astronomical
      namespace/key, independent of game system/entity IDs; reject name, prefix
      and textureKey matching. Implementation remains in Stage 3.
- [x] Record each active source's provider, authors, mission/instrument, source page,
      download URL, rights evidence, exact credit, retrieval date, and checksum.
- [x] Inspect projection, longitude direction/range, prime meridian, polar
      coverage, color interpretation, and residual illumination.
- [x] Record incomplete coverage and any source reconstruction/inpainting.
- [x] Agree desktop/constrained-device selection rules, transfer targets and
      resident-memory limits.
- [x] Finalize load/retry behavior before processing; distinguish no approved
      imagery (procedural) from approved asset load failure (explicit error/retry
      and retention of a valid lower tier where available).
- [x] Select one Earth baseline month initially: July; seasonal switching is deferred.

### Stage 2: local asset preparation

Work proceeds one body at a time, starting with Earth. The user initially approved
session-only preparation, then revised the output-storage decision to repository
storage while retaining originals in session storage. There is still no
Viewer/catalog integration in this step. The approved
following dimensions: 512 x 256 color preview; 2048 x 1024 low and 4096 x 2048
standard albedo; 1024 x 512 low and 2048 x 1024 standard normal maps.
The user subsequently selected JPEG quality 98 after measured quality 90/95/98
comparisons, and approved physical-scale, unexaggerated relief with neutral
ocean/coastal-transition cells. The aggregate checklist below remains open
until Luna/Mars and relevant renderer checks are complete.

- [x] Preserve approved originals outside deployed runtime assets; generate
      derivatives to distinct paths using existing local tooling.
- [x] Produce preview, 2K, and 4K variants only where source detail warrants them.
- [ ] Normalize suitable whole-globe products to the renderer's equirectangular
      UV convention; verify orientation, seams, and poles.
- [x] Use sRGB for albedo and linear semantics for normal/material data.
- [x] Use actual elevation for relief where available. A grayscale bump image
      is not a normal map; image brightness is not terrain elevation.
- [ ] Avoid colored elevation/shaded-relief maps as natural albedo and assess
      baked source shadows before applying runtime lighting.
- [x] Record exact processing commands, tool versions, dimensions, bytes,
      hashes, and source-to-derivative changes.
- [ ] Evaluate JPEG/WebP first using existing loaders. Evaluate KTX2 only if
      measured memory/transfer requirements justify it; verify existing decoder
      assets and loader wiring before adding tooling.

#### Earth v2: offline derivative evidence

Selected candidates are now in
[`assets/sol-textures/earth-july-v2`](../assets/sol-textures/earth-july-v2),
with a repository-local
[`derivative-manifest.json`](../assets/sol-textures/earth-july-v2/derivative-manifest.json)
recording dimensions, bytes, hashes, interpretation, credits and source-audit
links. The directory is outside Angular's `public` asset input: these files are
not included in builds or loaded by the Viewer. This supersedes session-only
output storage, not the pending appearance acceptance.

The session retains the originals and preparation copy at
`earth-source-audit\derivatives\earth-july-v2`.
`prepare_derivatives.py`, `validate_derivatives.py`, the original
`derivative-manifest.json` and `offline-validation.json` remain in session storage
with processing steps, versions and measurements.
The earlier quality-95 v1 experiment remains separate; originals were not changed
or downloaded again. Generation refuses existing output directories/files.

| Map             | Dimensions  | Encoding                     | Actual bytes | SHA-256                                                            |
| --------------- | ----------- | ---------------------------- | ------------ | ------------------------------------------------------------------ |
| Preview albedo  | 512 x 256   | Progressive JPEG, quality 98 | 48,719       | `2ddab02867d835dc8553225fa28f6a0e3b7800b0677b63873c0262a33cb7ddfd` |
| Low albedo      | 2048 x 1024 | Progressive JPEG, quality 98 | 517,397      | `bfc18f14cc21c784893cf7cb4f8136bdc7db8682c959c6a0d1b4320ea9cabe7b` |
| Standard albedo | 4096 x 2048 | Progressive JPEG, quality 98 | 1,720,257    | `90e6aa8d2bf9c981b0be9a9872ae556fad10519e8d47b5a5189f3d96ed4b46ca` |
| Low normal      | 1024 x 512  | Lossless RGB8 PNG            | 66,205       | `6be1e8f3d7314b2697cbd677ae5554287d503edf2c4fd7551c11a072a0749b71` |
| Standard normal | 2048 x 1024 | Lossless RGB8 PNG            | 271,787      | `b11f177c4d08bbb9a51803f4bcebe0db9f12581d75294bfb930294d48e1ac893` |

| Selected set, including one preview | Transfer bytes / MiB | Transfer cap | Estimated RGBA8 residency with full mip chains | Residency cap | Offline result |
| ----------------------------------- | -------------------- | ------------ | ---------------------------------------------- | ------------- | -------------- |
| Low                                 | 632,321 / 0.60 MiB   | 2 MiB        | Approximately 14 MiB                           | 32 MiB        | Pass           |
| Standard                            | 2,040,763 / 1.95 MiB | 4 MiB        | Approximately 54 MiB                           | 96 MiB        | Pass           |

These are file-byte totals and allocation estimates, not cold-network timings,
observed GPU allocations or application-wide/cache budgets. JPEG reduces transfer,
not decoded texture size. Multiple resident bodies, overlapping tiers, additional
previews and other material maps still require runtime accounting.

Processing and interpretation:

- Tools: Python 3.14.5, rasterio 1.5.2 / GDAL 3.12.2, NumPy 2.5.3 in the
  existing isolated source-audit environment; no project dependency changes.
- Color: decode July BMNG, apply the approved sRGB display assumption,
  area-average in linear light, re-encode to sRGB RGB8 and progressive JPEG98.
  This does not establish a source ICC profile or true linear reflectance.
- Elevation: stream all 16 unrestricted GLOBE tiles into aligned 20 x 20
  block averages on a 2160 x 1080 global grid, then area-resample height sums
  and land fractions to each normal-map grid. Use documented bounds/spacing,
  including the approved D-tile interpretation, without rewriting headers.
  Only `-500` is ocean; below-sea-level land remains valid.
- Relief: use physical east/north slopes with Earth radius 6,371,000 metres
  and latitude-dependent east spacing, with no height exaggeration. Mixed
  ocean/land cells and cells needing gradients across them are neutral.
  Both pole rows are neutral and longitude derivatives wrap periodically.
  This deliberately sacrifices coastal/island relief rather than generating
  coastline cliffs or invented seafloor.
- Normal encoding: lossless RGB8 PNG, no sRGB/gAMA/ICC chunks, intended
  `NoColorSpace`; red is minus east slope and green is plus south-image-row
  slope (minus north slope). Quantized neutral is `(128, 128, 255)`.
  Normal-vector length error after decode is at most 0.00413.
- Orientation: north-up, west-to-east, -180 to +180 longitude. Inspection and
  a 25-sample test of the installed Three sphere verify north at texture-v=1
  and a positive east/north tangent frame; ordinary Texture/TextureLoader
  `flipY=true` is the intended upload convention. ImageBitmap requires its
  own flip configuration. This is not proof of future Viewer loader/material
  correctness; do not copy the procedural render-target channel convention.
- All output dimensions, bytes, SHA-256 and complete decodes passed.
  Synthetic tests passed normal signs, longitude-roll invariance, flat
  negative-height terrain, neutral ocean/transition cells and sRGB round-trip.
  Coordinate sanity checks found Himalayan plateau 5,144 m, central Andes
  2,559 m, Sahara 757 m, Dead Sea lowland -405 m, and Pacific/Atlantic `-500`
  markers at expected coordinates. These do not prove fine co-registration.
- Compression comparison: standard JPEG90/95/98 measured
  823,545 / 1,187,023 / 1,720,257 bytes and
  42.79 / 44.75 / 47.05 dB PSNR against the uncompressed resampled RGB reference.
  Selected JPEG98 preview/low/standard scored 42.67 / 45.61 / 47.05 dB, passing
  the pipeline's 40 dB offline compression check. PSNR is not visual acceptance.

Executed locally, where `$audit` was the session files' `earth-source-audit`
directory:

```powershell
$python = Join-Path $audit 'venv\Scripts\python.exe'
& $python (Join-Path $audit 'prepare_derivatives.py') --test
& $python (Join-Path $audit 'prepare_derivatives.py')
& $python (Join-Path $audit 'validate_derivatives.py')
```

Results: math tests passed; both quality-95 v1 and selected quality-98 v2
generation passed; final v2 full validation passed. The processing script
SHA-256 for v2 is
`e65d8a2fd7bc672059e8f1335382f57f0fef42dc7085a091182d7b9efd17bf0f`.
To reproduce without overwriting a candidate, choose a fresh version directory.

Still pending: fine color/relief coastline and landmark alignment, actual
Viewer texture/material upload and lighting, runtime mip/filter seam/pole
behavior and ocean neutrality, observed cache/network/performance budgets,
and user visual acceptance. Physical 1x relief can be restrained by RGB8
quantization and globe-scale mipmapping; any strength revision needs a
subsequent decision. No water/specular/material/cloud map was fabricated.
Luna and Mars preparation are recorded below. Mercury and final Viewer
sign-off stay deferred.

#### Luna v2: offline derivative evidence

The user approved Earth-sized initial candidates, JPEG98 and physical-scale,
unexaggerated LOLA relief at the Moon's 1,737,400-metre reference radius.
The initial standard set failed the unchanged 4 MiB transfer gate:
3,850,397-byte JPEG98 albedo + 2,634,758-byte 2K normal +
65,269-byte preview = **6,550,424 bytes (6.25 MiB)**.
Even JPEG90 standard albedo with that 2K normal exceeded the cap.
The failed v1 experiment was moved to session storage, not retained in Git.

After the measured comparison, the user explicitly approved **JPEG95 standard
albedo and a 1024 x 512 standard normal**, preserving JPEG98 preview/low albedo
and the 1024 x 512 low normal. No transfer cap was raised, and no quality change
was silently applied.

Selected outputs and their provenance manifest are in
[`assets/sol-textures/luna-v2`](../assets/sol-textures/luna-v2),
outside the build's `public` input. Originals, isolated tools, the reproducible
`luna-source-audit\prepare_derivatives.py`, detailed
`derivative-validation.json` and failed experiment stay in session storage.

| Map             | Dimensions  | Encoding           | Actual bytes | SHA-256                                                            |
| --------------- | ----------- | ------------------ | ------------ | ------------------------------------------------------------------ |
| Preview albedo  | 512 x 256   | Progressive JPEG98 | 65,269       | `3f02e739feb92c246fe14f74dc3dbe96cbdaa760417c3b2d7164ef6f2b276afa` |
| Low albedo      | 2048 x 1024 | Progressive JPEG98 | 1,000,953    | `56fff6fc290dc5aa6a5ef6464f11ea8c82c12fb2df0fe73a9090a2af45cb9bd8` |
| Standard albedo | 4096 x 2048 | Progressive JPEG95 | 2,704,268    | `848690809d5be84b92f2a583030b240a35d8a50f84935c9349b93e9089fd6f73` |
| Low normal      | 1024 x 512  | Lossless RGB8 PNG  | 635,291      | `25cb3d5e92997731db143efaa67347f63a906d3796c9a05aa2517ec9db3ee507` |
| Standard normal | 1024 x 512  | Lossless RGB8 PNG  | 635,291      | `25cb3d5e92997731db143efaa67347f63a906d3796c9a05aa2517ec9db3ee507` |

The two tier-labeled normals are byte-identical. Future cache integration should
reuse identical content rather than allocating/loading both; these measurements
include only the selected tier's normal.

| Selected set including one preview | Actual transfer            | Cap   | Estimated RGBA8 full-mip residency | Cap    | Offline result |
| ---------------------------------- | -------------------------- | ----- | ---------------------------------- | ------ | -------------- |
| Low                                | 1,701,513 bytes / 1.62 MiB | 2 MiB | Approximately 14 MiB               | 32 MiB | Pass           |
| Standard                           | 3,404,828 bytes / 3.25 MiB | 4 MiB | Approximately 46 MiB               | 96 MiB | Pass           |

Processing and verification:

- Existing Python 3.14.5, rasterio 1.5.2/GDAL 3.12.2 and NumPy 2.5.3,
  without new project dependencies. Source bytes/SHA-256 were rechecked.
- Decode verified sRGB RGB16 color as values/65535; area-average in linear
  light and convert to sRGB RGB8. Standard keeps original 4096 x 2048 size;
  no extra source detail is invented.
- Decode elevation as `(uint16 - 20000) * 0.5` metres before area averaging.
  Source range remains -8981.5 to 10685.5 metres. All 16,588,800 samples
  again exactly matched the original signed LOLA IMG after the documented
  half-width roll and offset. The rendering TIFF already contains that roll:
  do not roll it again. Negative elevations are valid terrain, not ocean;
  no Earth coastline/water mask is applied.
- Generate physical slopes with latitude-adjusted east spacing, periodic
  longitude derivatives and neutral pole rows. Red=-eastSlope,
  green=+southImageRowSlope, matching the intended north-positive texture-v
  convention. Use linear `NoColorSpace` normals, sRGB albedo, intended
  TextureLoader `flipY=true`, repeat S and clamp T as documented for Earth.
- PNG full decode is lossless and has no sRGB/gAMA/ICC chunks. Maximum
  decoded normal-vector length error is 0.00505 (below the 1% check).
  Synthetic direction, longitude-roll, constant negative-terrain and
  sRGB-round-trip assertions passed.
- All persisted images passed full decode, dimensions, bytes and SHA-256
  checks; selected-set transfer and estimated residency assertions passed.
  Source-audit link in the repository manifest resolves.
- Measured standard JPEG90/95/98 PSNR:
  39.30 / 42.14 / 45.30 dB versus resampled RGB; respective bytes:
  1,825,151 / 2,704,268 / 3,850,397.
  Selected preview/low JPEG98 PSNR: 45.85 / 45.58 dB.
  These compare compression only, not visual acceptance or scientific accuracy.

Command, using the existing source-audit Python executable and session script:

```powershell
& $python $lunaPreparationScript (Join-Path $repository 'assets\sol-textures\luna-v2')
```

Result: final v2 generation and persisted-output verification passed.
The initial v1 standard-budget failure remains recorded above.
The repository manifest includes source URLs/hashes, exact NASA SVS credit,
Ernie Wright/Noah Petro/LROC/LOLA contributions, Sato et al. citation and NASA
rights caveats. Polar monochrome substitution, inpainting, DEM interpolation
and possible latitude-band artifacts remain disclosed.

Pending: fine color/relief landmark co-registration; actual Viewer upload,
lighting, seams/poles/mip filters and airless atmosphere behavior; observed
network/cache/GPU performance; and user visual acceptance (still on hold).
The approved 1K normal trades relief resolution for the transfer cap.
No cloud, atmosphere, material or invented crater map was added.

#### Mars v1: offline derivative evidence

The user approved a 512 x 256 JPEG98 preview, 2048 x 1024 low and
4096 x 2048 standard JPEG98 albedo, 1024 x 512 low and 2048 x 1024 standard
lossless normals, and physical-scale unexaggerated relief at the documented
3,396,000-metre MOLA reference radius. Existing budgets remain unchanged;
no compression or resolution reduction was needed.

Selected candidates and source/rights manifest are in
[`assets/sol-textures/mars-v1`](../assets/sol-textures/mars-v1), outside
Angular's `public` input. Originals, isolated tools, reproducible session
`mars-source-audit\prepare_derivatives.py` and detailed
`derivative-validation.json` remain in session storage. The script reuses the
existing Luna resampling/color/encoding helpers; both script hashes are
recorded in the repository manifest. No project dependencies changed.

| Map             | Dimensions  | Encoding           | Actual bytes | SHA-256                                                            |
| --------------- | ----------- | ------------------ | ------------ | ------------------------------------------------------------------ |
| Preview albedo  | 512 x 256   | Progressive JPEG98 | 61,043       | `fd031dc8624adcaadbc9d2d7f7c95a88a28f21923bb4a1d472acd9da224dfd06` |
| Low albedo      | 2048 x 1024 | Progressive JPEG98 | 750,187      | `f9803ba377933fffd7ed7ed8e8153a4c0153c11670c6f273f342113768548f40` |
| Standard albedo | 4096 x 2048 | Progressive JPEG98 | 2,560,415    | `75ecee71299bd0ac5b0df017b5210b8701ce3068e489b71cc57645cf4502df78` |
| Low normal      | 1024 x 512  | Lossless RGB8 PNG  | 310,237      | `9b3a088af43f441a175659f7200bbce340690a22705b6707a2a0cbda28480dc4` |
| Standard normal | 2048 x 1024 | Lossless RGB8 PNG  | 1,337,213    | `0dd2d6db13468c94e30b70b4ced0bebfe7131d0ec5da0b28d0f581c04f19db7d` |

| Selected set including one preview | Actual transfer            | Cap   | Estimated RGBA8 full-mip residency | Cap    | Offline result |
| ---------------------------------- | -------------------------- | ----- | ---------------------------------- | ------ | -------------- |
| Low                                | 1,121,467 bytes / 1.07 MiB | 2 MiB | Approximately 14 MiB               | 32 MiB | Pass           |
| Standard                           | 3,958,671 bytes / 3.78 MiB | 4 MiB | Approximately 54 MiB               | 96 MiB | Pass           |

Standard has only 235,633 bytes of transfer headroom. These totals include one
preview and the selected albedo/normal, not metadata/protocol overhead or future
additional maps. No actual network latency or total cache/GPU allocation was
measured. JPEG reduces transfer, not decoded texture residency.

Processing and verification:

- Source SHA-256/bytes verified; existing Python 3.14.5, rasterio 1.5.2 /
  GDAL 3.12.2 and NumPy 2.5.3 were reused.
- Color normalization uses the actual Viking affine transform. Simple
  cylindrical metre coordinates are converted analytically to longitude /
  latitude degrees at the source's 3,396,190-metre sphere radius, then
  area-resampled onto exact north-up -180..180 / -90..90 target bounds.
  This is not an Earth-datum reprojection or an MDIM-to-IAU2000 correction.
- All 11,530 missing western-column RGB pixels were replaced in the working
  derivative by the immediately adjacent valid source column, per the
  approved source-neighbor-only policy. Original TIFF unchanged. Valid
  source regions were checked for zero pixels; all target cells were checked
  for finite, nonzero linear color after resampling. This verifies population,
  not visual seam continuity.
- Under the approved unprofiled-source sRGB display assumption, convert
  source RGB to linear light before area averaging, then encode RGB8
  progressive JPEG98. Source strips are decoded into a session-only float
  working raster to avoid a full multi-gigabyte in-memory linear color array.
  That temporary raster was removed after encoding.
- Decode MOLA directly as signed big-endian metre heights rather than using
  the convenience header's erroneous zero-nodata setting. Verified range
  -8177..21171, all 2128 zero-height cells and absence of -32768 sentinel.
  Roll by 2880 columns from 0..360 to -180..180; exact reverse-roll check passed.
  Preserve negative terrain and apply no Earth ocean mask.
- Area-average heights and derive physical east/north slopes at the approved
  MOLA radius, with latitude-adjusted east spacing, periodic longitude
  gradients, neutral pole rows and no exaggeration. Linear RGB8 PNG normals
  use red=-eastSlope and green=+southImageRowSlope. Intended loader convention
  remains TextureLoader `flipY=true`, repeat S, clamp T and `NoColorSpace`.
- Lossless PNG re-decode and absent sRGB/gAMA/ICC chunks verified. Normal
  length errors are below 0.00438 low and 0.00499 standard (1% check passed).
  Synthetic channel-direction, constant zero/negative-height and longitude
  shift-invariance tests passed. All persisted files passed full decode,
  dimensions, byte counts and SHA-256 checks.
- Coordinate sanity samples: Olympus Mons (-133.8 E, 18.65 N) 20,046 m;
  Hellas (70 E, -42 N) -6,041 m; Valles Marineris (-70 E, -12 N) -4,654 m.
  These support DEM orientation, not fine color/relief co-registration.
- JPEG98 preview/low/standard PSNR versus resampled RGB:
  41.34 / 43.00 / 44.08 dB. This is compression evidence only,
  not a source-accuracy or visual-acceptance claim.
- Repository provenance retains NASA/Viking/PDS, USGS Astrogeology and
  NASA/MGS/MOLA credits; Eliason/Batson/Manley and Smith/Zuber/Neumann/
  Guinness/Slavney citations; source URLs/hashes and reuse caveats.

Command, using the existing isolated Python executable and session script:

```powershell
& $python $marsPreparationScript (Join-Path $repository 'assets\sol-textures\mars-v1')
```

Result: generation and persisted-output validation passed; file transfers and
estimated selected-tier residency meet the approved caps.
Synthetic green, incomplete original red/violet coverage, residual
haze/illumination, interpolated MOLA gaps and different image/DEM control
networks remain disclosed. No material, water, cloud or invented crater map
was added.

**Stage 2 remains In progress:** all active-body candidates are prepared, but
fine color/relief landmark alignment and renderer seam/pole/filter checks are
still open. Actual Viewer loading, appearance, atmosphere policy, network/cache/
GPU measurements and user acceptance require later integration and validation.
Final Viewer visual acceptance stays on hold; Stage 3 is not implemented.

#### Repeatable repository pipeline and isolated renderer review

The user requested a workflow that can be rebuilt next year and approved moving
processing/diagnostic code into the repository, not just keeping session scripts.
[`tools/sol-textures`](../tools/sol-textures) now contains a configurable
shared [pipeline](../tools/sol-textures/pipeline.py), pinned Python dependency
manifest, source acquisition records, unit tests, paired landmark preparation,
loopback-only Three.js harness and an automated Playwright evidence runner.
The [rebuild guide](../tools/sol-textures/README.md) documents exact commands,
external source/working paths, storage rules, source-update review and limitations.
No machine-specific session path is required by the repository tools.

**Reproducibility verified:** all 15 selected Earth/Luna/Mars image files were
rebuilt with the repository pipeline into fresh external folders and compared
against repository candidate SHA-256: byte-identical for every image.
Metadata/script hashes may differ. The pipeline refuses existing output folders,
verifies original hashes before preparation and has no implicit downloads;
its explicit `fetch` command acquires only pinned rasters and rejects changed
bytes. Source notices/rights require fresh review for a new year's products.
The subsequent external-storage decision below archives these originals and
selected evidence independently of session lifetime. A separate backup is still
needed for disk loss. Bit-identical encoder output is
not guaranteed under a different OS/GDAL build.

Commands executed using the retained isolated Python:

```powershell
& $python -m unittest discover -s tools\sol-textures -p test_pipeline.py -v
# Each body used its retained external source directory and a fresh external output:
& $python tools\sol-textures\pipeline.py prepare $body `
  --source-dir $sources --output $rebuild --work-dir $externalWork
& $python tools\sol-textures\pipeline.py verify `
  --output $rebuild --compare $repositoryCandidate

& $python tools\sol-textures\diagnostic\prepare_landmarks.py `
  --earth-sources $earthSources --luna-sources $lunaSources `
  --mars-sources $marsSources --output $externalLandmarks
node tools\sol-textures\diagnostic\server.mjs --landmarks $externalLandmarks
node tools\sol-textures\diagnostic\run-checks.mjs --output $externalEvidence
```

Initial failures were explicit and resolved: rounded crop windows omitted some
edge cells (fixed by including a full bilinear footprint); cross-drive relative
audit links failed for external rebuild output (fixed with an explicit
repository-base audit link). Neither failure changed originals or candidate maps.
Incomplete first-run artifacts remain outside Git, not accepted versions.

Renderer results:

- Three.js revision 182, WebGL2, 768 x 512 canvas at DPR 1, 72 x 72 detail
  sphere and `MeshStandardMaterial` with roughness 0.72, metalness 0,
  default normalScale, controlled white camera-relative lighting, no clouds.
- Playwright Chromium software SwiftShader correctness run passed all 36
  body/tier/front/seam/north/south cases without collected console/page errors.
  Maximum supported texture size was 8192, above every candidate dimension.
  This is not representative device or hardware-performance validation.
- All 15 map variants sampled correctly after GPU upload: three texel-center
  samples per map matched CPU-decoded bytes in linear space (0-byte maximum
  error in the recorded software run; interactive browser run <=1 byte).
  Albedo uses sRGB decoding; normals remain linear; north-up
  TextureLoader flipY mapping passed.
  Ray intersections also verified the camera-to-sphere longitude/latitude UV
  convention in all 36 render cases; this is an orientation smoke test,
  not a fine source-registration metric.
- MeshStandardMaterial channel-response checks passed red/east and green/north
  directional-light tests. Quantized flat `(128,128,255)` lighting differed
  by one output byte under symmetric lights. Six Earth ocean samples
  (three coordinates per detail tier) remained neutral after upload/filtering.
- Three explicit load/dispose cycles returned to the same texture count
  baseline (1 internal renderer texture). This is a scoped ownership/count
  smoke test, not an application cache-byte or long-lived leak proof.
- The runner preserves a GPU/browser report and 39 screenshots externally:
  all standard-tier front/seam/pole albedo and gray-relief views,
  72-vs-288-segment north-pole comparisons, and nine landmark panels.
  Final session evidence is under `sol-texture-diagnostics\renderer-evidence-v3`.

Landmark and appearance findings (qualitative, no fitted corrective shifts):

| Body  | Examined source landmarks                        | Evidence / limitation                                                                                                                                                      | Status                                                                                                       |
| ----- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Earth | California coast, Andes coast, Himalayan plateau | Coast boundaries broadly follow color coastlines; mountain belt is in the corresponding terrain region; BMNG coastal blending and source resolution limit sub-pixel claims | No gross displacement observed; fine residual offsets not quantified                                         |
| Luna  | Tycho, Copernicus, Mare Crisium                  | Crater centers/rims and basin region visually coincide with relief contours; color rays/reflectance need not follow elevation contours exactly                             | Qualitative agreement; no sub-texel registration guarantee                                                   |
| Mars  | Olympus Mons, Valles Marineris, Hellas           | Olympus caldera/edifice and canyon system correspond in paired panels; hazy Hellas albedo is insufficient for a reliable fine fit                                          | Olympus/Valles qualitative agreement; Hellas fine alignment inconclusive; MDIM/IAU2000 difference unresolved |

At this diagnostic viewport, the inspected albedo date-line views show no obvious
hard seam or black fill stripe. This is not proof at every zoom/mip level.
The Luna north-pole albedo and gray-relief views show a small radial
pinching/fan pattern; Mars north gray relief also has a subtler radial pattern.
The Luna north pattern persists with both 72- and 288-segment spheres:
increasing tessellation alone did not resolve it. These need investigation of polar source sampling, UV/tangent degeneration and
filtering before declaring poles accepted. No corrective map shift, polar
inpainting, extra smoothing or asset replacement was applied.

**Stage 2 remains In progress.** GPU upload/channel/dimension smoke checks and
qualitative landmark review are complete; precise residual registration and
polar artifact acceptance are not. Fine source-vs-source crops are not proof
of all candidate/source co-registration. The harness is not Angular Viewer,
and its `viewer-tint` diagnostic mode does not reproduce Forge star lighting,
selection/highlight or atmosphere behavior. Actual integration, device/network/
cache measurements and the user's final Stellar Viewer acceptance remain
pending/on hold. Production Viewer, contract and splash code were not changed.

#### Polar investigation: controls before correction (2026-10-08)

The user selected investigation/reporting only: no selected map replacement,
smoothing, polar blending or production renderer change. Final Viewer visual
acceptance remains on hold.

- Verified original Luna/Mars source hashes and generated direct CPU
  original/candidate polar color projections, without Three sphere geometry.
  Radial structure is already visible in the original north-pole color strips;
  therefore it is not solely introduced by JPEG derivative encoding or sphere
  tessellation. Mars projection here uses nominal geographic extent, not its
  small affine extent corrections; this is not a fine-registration test.
- Lit original-resolution DEM-derived normals and selected normals on CPU with
  explicit geographic east/north/radial axes. Radial structure is present
  without Three's derivative tangent reconstruction. This rules out a Three
  tangent bug as the sole cause, not all possible tangent contributions.
  The original-resolution control still uses our physical-slope normal recipe,
  including RGB8 encoding and neutral outer rows; it cannot by itself prove
  that every visible source feature is natural terrain.
- First original DEM rows vary with longitude: Luna north -80..65 m,
  Luna south 341.5..1431 m, Mars north -2112..-1918 m and Mars south
  3801..3932 m. These are finite-width latitude cells, not measurements of
  one exact physical pole. Their variation is not itself a source error.
- Selected normal row 1 reaches maximum tilts of 20.74/20.44 degrees
  (Luna north/south) and 38.63/20.43 degrees (Mars north/south); row 0 is
  deliberately neutral. The latitude/longitude recipe divides east differences
  by physical distance proportional to cos(latitude). Polar sampling,
  averaging and transition to the neutral row can therefore affect appearance;
  no arbitrary slope clipping or wider neutral cap was applied.
- Captured 32 closeup controls at both exact poles using a 288-segment sphere
  and 4-degree camera field of view. No-normal and flat-normal controls are
  visually smooth, differing by at most one output byte. Albedo-only and
  relief retain radial patterns. Disabling mip/linear/anisotropic filtering
  does not eliminate them; nearest exposes angular/ring-shaped sample cells.
  Thus filtering changes presentation but is not the sole cause.

**Finding:** this is a multi-stage polar sampling problem, with source-side
radial structure and candidate/filtering contributions, rather than a simple
mesh-resolution failure. Exact attribution among provider interpolation,
normal resampling/encoding and tangent-frame filtering remains unresolved.
Do not treat all polar streaks as artificial or erase recognizable terrain.
Next approval should authorize separate comparison experiments, not promotion:
polar-aware physical normal reconstruction versus a restrained normal-only
polar transition, retaining original albedo and existing selected assets.

Evidence is outside Git under the configured artifact root:
`work\polar-source-investigation-v2` (16 CPU images and source/statistics report),
`work\polar-render-investigation-v1` (32 browser images and case report), and
`work\polar-regression-renderer-v1` (existing 36-case/39-image regression run).
The initial color/statistics-only `polar-source-investigation-v1` is retained
as preliminary evidence, not the final CPU investigation.
These new work outputs are not part of the earlier immutable 147-file archive
inventory. They must be included separately in any future evidence backup.

Polar investigation validation passed: `python -m unittest discover -s
tools\sol-textures -p 'test_*.py' -v` (21 tests), both diagnostic runners
(32 polar controls and the existing 36 GPU cases/39 screenshots), JavaScript
syntax checks and formatting. No app build was run: only standalone tooling,
diagnostic HTML and documentation changed; no Angular templates changed.
All three selected asset sets also passed `pipeline.py verify` (full decodes,
recorded hashes and budgets), and `artifact_store.py verify` passed for all
147 immutable archived files. Selected assets and originals remain unchanged.

#### Normal-only polar comparison experiments (2026-10-08)

User approved the recommended separate experiments, not promotion. Added
portable `diagnostic\experiment_poles.py` and synthetic regression tests.
Generated eight lossless PNG trials plus 16 CPU cap images outside Git under
`work\polar-normal-experiments-v1`; hashes, selected-albedo references,
parameters and budget results are in `experiment-manifest.json`.

Trial parameters (experimental, not a new production policy):

- Changes restricted to latitude cells beyond +/-85 degrees (approximately
  0.38% of spherical surface area across both caps). All other selected normal
  bytes remain identical; albedo, DEM originals and chosen derivative versions
  are unchanged.
- Geodesic reconstruction samples the original DEM at equal physical-distance
  east/north neighbors on the sphere. Step is pi / target normal height radians,
  including spherical pole crossings, bilinear pixel-center sampling with
  longitude wrap and latitude edge clamp. Physical slopes blend from existing
  baseline at 85 degrees to full reconstruction at 87 degrees.
- Restrained transition attenuates existing physical slopes with smoothstep
  from 85 degrees to zero at 90 degrees. It suppresses real relief too and is
  not claimed scientifically neutral.
- Both retain RGB8 normals and neutral outermost rows. No new polar color
  fill, invented pole elevation, slope exaggeration or arbitrary source shift.

| Body | Trial      | Low transfer | Standard transfer | Result           |
| ---- | ---------- | ------------ | ----------------- | ---------------- |
| Luna | Geodesic   | 1,702,240 B  | 3,405,555 B       | Both caps passed |
| Luna | Transition | 1,704,192 B  | 3,407,507 B       | Both caps passed |
| Mars | Geodesic   | 1,140,522 B  | 4,026,793 B       | Both caps passed |
| Mars | Transition | 1,143,747 B  | 4,039,712 B       | Both caps passed |

Totals include unchanged selected albedo and one preview, not both experiments
at runtime. Dimensions/residency estimates are unchanged. Mars standard remains
below 4 MiB, with 167,511 B / 154,592 B headroom respectively.

Captured 144 isolated browser comparison cases under
`work\polar-normal-render-comparison-v1`: low/standard, baseline/two trials,
north/south closeups, front/seam overviews, gray/albedo relief and polar
nearest/mipmapped filters. All completed without page/console errors.
`pixel-deltas.json` records comparisons, not quality scores: gray-relief
front/seam differences are at most one output byte, while polar changes are
visible. Normal bytes outside the cap are independently checked exactly.

Qualitative result: geodesic reconstruction reduces conspicuous Mars polar
spoking in the examined standard closeups and is the more promising follow-up.
Luna retains radial structure; the transition softens central relief but does
not fully remove the fan and knowingly attenuates terrain. Neither normal-only
trial removes inherited albedo pinching. Original-source interpolation,
remaining tangent/filter effects, cap blend-boundary behavior and detail loss
still require assessment; this is not proof of a complete correction.
**User decision (2026-10-08):** retain geodesic reconstruction as the leading
candidate for further boundary/detail-loss review for Luna and Mars. This
selects the review direction, not an accepted replacement or permission to
promote assets. Retain transition as comparison evidence, not the leading
candidate; do not erase polar color detail.

Follow-up review gates:

- [ ] Inspect continuity across the 85-to-87-degree blend band at both poles,
      in both tiers and under multiple lighting directions/zoom levels.
- [ ] Compare source-derived and baseline relief with geodesic relief for
      legitimate detail loss, softened features and new sampling artifacts.
- [ ] Assess residual pole behavior with nearest/mipmapped filters and the
      neutral outer-row transition; keep albedo pinching separately tracked.
- [ ] Record evidence and request an explicit promotion decision after review;
      leave selected versions unchanged until then.
      The geodesic trial uses point-neighbor bilinear samples, not integrated
      equal-area pixel footprints or a new polar DEM projection; it is not a complete
      antialiasing solution. Trial angles have not been optimized or visually accepted.

Validation passed: `python -m unittest discover -s tools\sol-textures -p
'test_*.py' -v` (25 tests); `run-pole-checks.mjs <external-output>
--experiments` (144 comparison cases); existing `run-checks.mjs` (36 GPU cases,
39 screenshots under `work\polar-experiments-gpu-regression-v1`); all three
`pipeline.py verify` selected-set runs; `artifact_store.py verify` (147 files);
JavaScript syntax, related Prettier formatting and `git diff --check`.
No Angular build was run because production app code/templates were unchanged.

**Stage 2 remains In progress.** No experimental PNG was copied into Git
or wired into production Viewer. Final Stellar Viewer visual acceptance
remains on hold. New external work evidence is not included in the immutable
147-file historical archive inventory and needs separate backup.

#### Accepted geodesic texture promotion (2026-10-08)

The user selected the explicit promotion option: accept current low/standard
geodesic normal appearance and create new Luna/Mars versions. Boundary/detail-
loss review was not completed before this acceptance; those earlier unchecked
review gates remain limitations, not completed verification.

- Created `assets\sol-textures\luna-v3` and `assets\sol-textures\mars-v2`, each
  containing three unchanged albedo JPEGs, two accepted normal PNGs and updated
  source/rights/recipe/acceptance provenance.
- Reconstructed directly from hash-verified originals using the shared
  `tools\sol-textures\polar_normals.py` recipe. The generated normal bytes
  exactly match the accepted external geodesic trials; all three albedo hashes
  per body match the prior sets. Normal pixels outside +/-85 degrees are
  byte-identical to baseline.
- Prior Luna v2/Mars v1 remain intact. Earth v2 is unchanged. Source originals,
  transition experiments and historical evidence are not replaced.
- Portable preparation now targets these accepted versions; diagnostic default
  renders/GPU checks use them, while explicit experiment baseline comparisons
  retain the old normal maps.
- Transfer remains Luna 1,702,240 / 3,405,555 B and Mars
  1,140,522 / 4,026,793 B (low/standard, including one preview).
  Estimated residency is unchanged; both tiers meet the approved budgets.

Acceptance is for this texture treatment, not a scientific assertion that all
remaining polar structure is artificial or removed. Residual albedo pinching,
unquantified registration and unfinished boundary/detail-loss review remain
disclosed. These asset versions are stored in Git-visible, non-deployed storage;
no application catalog/Viewer integration, commit or push is implied.
**Stage 2 remains In progress; final Stellar Viewer acceptance remains on hold.**

Promotion validation passed:

- `python -m unittest discover -s tools\sol-textures -p 'test_*.py' -v`:
  26 tests, including accepted-version albedo/nonpolar-byte preservation.
  The initial run before generating new manifests failed on their absence;
  after generation the full suite passed.
- `pipeline.py prepare luna|mars` and `pipeline.py verify --compare`:
  all ten selected images independently rebuilt byte-identically under
  `rebuilds\accepted-geodesic-luna-v3` and
  `rebuilds\accepted-geodesic-mars-v2`.
- Exact hash comparison to accepted external geodesic trials passed for all
  four normals; old/new albedo hashes matched for all six JPEGs.
- `run-checks.mjs`: 36 accepted-version GPU cases and 39 screenshots passed
  under `work\accepted-geodesic-gpu-v1`; scoped disposal checks passed.
- `artifact_store.py verify`: all 147 archived files unchanged; JavaScript
  syntax, related formatting and `git diff --check` passed.

No app build was run: changes are asset preparation/diagnostic tooling and
documentation, not Angular app code/templates. New external rebuilds/evidence
are outside the historical immutable inventory and need separate backup.

Prior isolated-diagnostic validation commands passed: 12 Python tool tests, three byte-identical
image rebuild/comparison runs and the final Playwright renderer run.
JavaScript syntax checks, documentation/tool formatting and
`git diff --check` passed. The explicit acquisition command was not exercised
over the network because the audited originals were already present.

#### External artifact-store definition and migration

User-approved store on this machine:
`D:\at-template\artifacts\laughing-octo-journey\sol-textures`.
This is a project-specific subdirectory of the shared external artifacts root,
outside the repository and build inputs. It does not migrate unrelated artifact
types, Forge contracts or other sessions.

Layout and portable operations are documented in the
[rebuild guide](../tools/sol-textures/README.md).
[artifact_store.py](../tools/sol-textures/artifact_store.py) provides
explicit copy-only session archival, complete inventory verification, and
verified restoration to a different external root. It needs only Python's
standard library. Restore refuses an existing destination; source/destination
roots must be separate. Inventory paths cannot escape the configured store.

- `sources\earth`, `sources\luna`, `sources\mars`: exact audited original
  rasters, rights/credit notices, labels and headers, including signed LOLA IMG.
- `evidence\2026-10-08`: source inspections, acquisition manifests, historical
  preparation scripts, numerical comparisons and selected final landmark/
  renderer evidence. Historical scripts are preserved as records, not portable
  executables; repository tooling is the supported workflow.
- `artifact-inventory.json`: relative file paths, actual bytes, SHA-256 and
  explicit archival scope. It verifies the immutable archive, not new local
  work directories or environments.
- `work\<body>`, `rebuilds\<version>` and optional `environments`: regenerable
  processing files, comparison outputs and a locally recreated environment.
  Do not transfer a Python venv between development machines.

Migration copied **147 files / 1,289,624,563 bytes** and verified every destination
against original bytes/SHA-256, plus pre-copy audited original hashes.
Session files were not removed. Python venv/bytecode, failed/superseded
derivatives, incomplete/duplicate diagnostic runs and unrelated artifacts
were excluded. Selected repository image bytes did not change.

Executed using the retained compatible Python:

```powershell
$artifactRoot = 'D:\at-template\artifacts\laughing-octo-journey\sol-textures'
$env:SOL_TEXTURE_ARTIFACT_ROOT = $artifactRoot
& $python tools\sol-textures\artifact_store.py archive-session `
  --session-files $retainedSessionFiles --artifact-root $artifactRoot
& $python tools\sol-textures\artifact_store.py verify --artifact-root $artifactRoot
```

Results: archival and verification passed. Another development environment can
restore an intact backup using `artifact_store.py restore --from-root ...`,
verify its inventory, and rebuild with its own configured root. Without a
backup, `pipeline.py fetch <body> --artifact-root ...` explicitly reacquires
hash-pinned originals; `--include-notices` attempts the pinned historical
notice/label files too. Changed/disappeared provider pages fail explicitly and
require a backup or a fresh review, not a silent hash update. Historic local
reports/screenshots are preserved by archive transfer; they cannot be fetched
from providers and must otherwise be regenerated as newly dated evidence.

The preparation and landmark CLIs now accept the external artifact root;
existing explicit source/work arguments remain supported. CLI root overrides
environment configuration. Sources resolve to `sources\<body>` and preparation
work to `work\<body>`. No automatic downloads or global environment changes
are introduced. The external-store test suite verifies alternate-root restore,
corruption detection, overwrite refusal and path containment.

This local external store survives session cleanup, but is not itself a remote
or redundant backup. Back up the store separately before a disk/environment is
lost. Existing fine-registration and polar-rendering gates remain unchanged;
this storage change does not imply appearance acceptance.

Validation after migration: all three bodies rebuilt from the external store
using `SOL_TEXTURE_ARTIFACT_ROOT` (without session source paths) into
`rebuilds\archive-validation-2026-10-08\<body>`. All 15 image hashes again matched
the repository candidates byte-for-byte. Nine landmark sets regenerated using
`--artifact-root` under the store's `work` directory. The full 147-file archive
inventory still passed verification afterward. Seventeen Python tests passed,
including alternate-root restoration, corruption/overwrite/path guards and
the existing raster regressions. Formatting and `git diff --check` passed.
No network downloads or environment relocation were needed for this validation.

### Stage 3: catalog and shared surface loading

- [ ] Introduce explicit catalog/procedural request variants and a shared
      surface result with source-specific metadata.
- [ ] Include catalog version, asset variant, and tier in cache keys.
- [ ] Preserve deterministic procedural output for uncataloged bodies,
      including non-Sol bodies with familiar display names.
- [ ] Keep stars and giant renderers outside the catalog surface path.
- [ ] Load only the selected detail tier and applicable overview previews,
      rather than every quality variant or the entire Sol catalog.
- [ ] Add byte-aware residency budgeting. An RGBA8 4096 x 2048 albedo with a
      full mip chain is approximately 42.7 MiB before other maps; compressed
      downloads do not generally imply compressed GPU allocation.
- [ ] Define shared texture ownership, renderer-context behavior, eviction,
      late-load cancellation/disposal, and safe route re-entry.
- [ ] Retain a valid lower-resolution catalog texture on detail-load failure
      and expose a logged, localized warning and retry.
- [ ] For initial catalog-load failure, show an explicit failure state; do not
      silently replace recognizable terrain with random procedural geography.
- [ ] Make loading progress cover both downloads and procedural work honestly,
      without representing asset-count progress as byte progress.

### Stage 4: viewer presentation and attribution

- [ ] Integrate catalog surfaces consistently in system view and body detail,
      including selected moons and companion-moon previews.
- [ ] Keep normal/material maps optional; do not fabricate unsupported channels.
- [ ] Add explicit per-body atmosphere policy: Earth cloud layer, no terrestrial
      clouds on airless worlds, and dedicated Venus/Titan treatment.
- [ ] Treat Venus/Titan radar or infrared terrain as a separately labeled
      surface-reveal mode, not ordinary visible-light appearance. Such a mode
      needs separate approval before implementation.
- [ ] Verify material tint/emissive/highlight behavior does not permanently
      recolor the familiar terrain.
- [ ] Generate selected-body source links through
      [ExternalAnchorsComponent](../src/app/component/external-anchors.ts).
- [ ] Add fuller provenance, color interpretation, and coverage notes in a
      "Surface sources" section. Preserve exact team credits.
- [ ] Localize new labels, loading/errors, and coverage notes in both
      [English](../src/app/i18n/locales/en.ts) and
      [Italian](../src/app/i18n/locales/it.ts).
- [ ] Leave splash code, splash asset selection, and splash behavior unchanged.

## Candidate source register

All entries below are research candidates, not commercial-use clearance or
visual sign-off. USGS catalog search and browser inspection identified these
products; some product pages require browser-rendered content.

| Body                                             | Source                                                                                                                                     | Qualification                                                                                                   | Priority         |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- | ---------------- |
| Earth                                            | [NASA Blue Marble: Next Generation](https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/)                         | Cloud-removed monthly composites; choose one baseline month                                                     | Pilot            |
| Luna                                             | [NASA CGI Moon Kit](https://svs.gsfc.nasa.gov/4720/)                                                                                       | Color/elevation designed for rendering; updated color includes documented polar substitutions and inpainting    | Pilot            |
| Mars                                             | [USGS Viking global color mosaic](https://astrogeology.usgs.gov/search/map/mars_viking_global_color_mosaic_925m)                           | Inspect seams and residual illumination                                                                         | Pilot            |
| Mercury                                          | [USGS MESSENGER color mosaic](https://astrogeology.usgs.gov/search/map/mercury_messenger_mdis_global_color_mosaic_665m)                    | Infrared-containing filter combination is not ordinary natural color; select/document a natural-looking variant | Pilot            |
| Io                                               | [USGS Galileo/Voyager color-merged mosaic](https://astrogeology.usgs.gov/search/map/io_galileo_ssi_voyager_color_merged_global_mosaic_1km) | Verify selected color interpretation and merged-image illumination                                              | Expansion        |
| Europa                                           | [USGS Voyager/Galileo mosaic](https://astrogeology.usgs.gov/search/map/europa_voyager_galileo_ssi_global_mosaic_500m)                      | Verify color availability, coverage, and illumination                                                           | Expansion        |
| Ganymede                                         | [USGS color global mosaic](https://astrogeology.usgs.gov/search/map/ganymede_voyager_galileo_ssi_color_global_mosaic_1_4km)                | Mixed source resolution                                                                                         | Expansion        |
| Callisto                                         | [USGS Galileo/Voyager mosaic](https://astrogeology.usgs.gov/search/map/callisto_galileo_voyager_global_mosaic_1km)                         | Confirm color treatment                                                                                         | Expansion        |
| Enceladus                                        | [USGS Cassini mosaic, 2024](https://astrogeology.usgs.gov/search/map/enceladus-cassini-global-mosaic-100m-schenk)                          | Grayscale; matching elevation cataloged; avoid invented colored terrain                                         | Expansion        |
| Tethys                                           | [USGS Cassini mosaic](https://astrogeology.usgs.gov/search/map/tethys_cassini_global_mosaic_293m)                                          | Simple-cylindrical map; inspect coverage and quality                                                            | Expansion        |
| Pluto                                            | [USGS New Horizons mosaic](https://astrogeology.usgs.gov/search/map/pluto_new_horizons_lorri_mvic_global_mosaic_300m)                      | Uneven observed resolution/coverage; verify color separately                                                    | Expansion        |
| Charon                                           | [USGS New Horizons mosaic](https://astrogeology.usgs.gov/search/map/charon_new_horizons_lorri_mvic_global_mosaic_300m)                     | Uneven observed resolution/coverage; verify color separately                                                    | Expansion        |
| Triton                                           | [USGS Voyager 2 color mosaic](https://astrogeology.usgs.gov/search/map/triton_voyager_2_global_color_mosaic_600m)                          | Synthesized color and incomplete observations require labels                                                    | Expansion        |
| Venus / Titan                                    | Source selection pending                                                                                                                   | Atmosphere-covered appearance first; radar/infrared surface is a distinct presentation                          | Special case     |
| Mimas, Dione, Rhea, Iapetus, major Uranian moons | Individual products not yet verified                                                                                                       | Include only after source, rights, coverage, and quality review                                                 | Further research |

### Rights gate

Consult [NASA media usage guidance](https://www.nasa.gov/nasa-brand-center/images-and-media/)
and [USGS copyrights and credits](https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits).
Both warn that hosted material can include third-party works. Verify the rights
of each selected product, including mission-team/university contributions, and
record any needed permission. Government hosting alone is not clearance.
Attribution does not substitute for permission. Do not imply agency endorsement
or use agency logos as product branding.

## Validation and acceptance

### Automated checks

- [ ] Station dimensions are exactly 0.05 times baseline dimensions, with
      unchanged non-station sizing, orbits, positions, and navigation.
- [ ] Resolver tests cover approved Sol identities, familiar names outside Sol,
      unknown keys, and excluded body classes.
- [ ] Loader/cache tests cover tier selection, deduplication, eviction, failures,
      retries, late completions, ownership, and renderer transitions.
- [ ] Attribution/coverage labels reflect the active catalog entry and locale.
- [ ] Deterministic Playwright tests verify same-origin texture requests,
      readiness, overview/detail transitions, and no legacy texture hot-links.
- [ ] Existing procedural parity and viewer behavior remain intact.
- [ ] Run Angular build after changing templates or template-bound types.

Relevant existing tests:
[system-scene unit tests](../src/app/scene/viewer/viewer-system-scene.vitest.ts),
[cache unit tests](../src/app/scene/planet/planet-texture-cache.vitest.ts),
[viewer surface e2e](../e2e/tests/viewer-planet-surfaces.spec.ts),
[viewer interaction e2e](../e2e/tests/viewer-interactions.spec.ts),
[scene-rendering e2e](../e2e/tests/viewer-scene-rendering.spec.ts),
and [procedural parity e2e](../e2e/tests/planet-bake-parity.spec.ts).

Suggested focused commands, adjusted to include new tests when created:

```powershell
npm run test:spec -- src\app\scene\viewer\viewer-system-scene.vitest.ts src\app\scene\planet\planet-texture-cache.vitest.ts
npm run e2e:spec -- e2e\tests\viewer-planet-surfaces.spec.ts e2e\tests\viewer-interactions.spec.ts e2e\tests\viewer-scene-rendering.spec.ts
npm run build
```

Record actual commands and outcomes below. Stage 0 results are recorded in the
execution log; texture-specific validation remains pending.

### User visual review in Stellar Viewer

For each body, record catalog version, device/GPU, viewport, DPR, selected tier,
route/framing, and whether the cache was cold. Review overview and close-up.

- [ ] Station reduction makes the selected terrain visible without obstruction
      at the agreed framing; station selection/navigation still works.
- [ ] Familiar landmarks and overall color read as the intended body.
- [ ] Longitude orientation, seams, poles, and map/relief alignment are correct.
- [ ] Relief is plausible under changing light and does not emboss oceans.
- [ ] No terrestrial clouds appear on airless bodies.
- [ ] Rotation/zoom does not produce distracting shimmer or source-shadow artifacts.
- [ ] Coverage limitations and reconstructed areas are clearly disclosed,
      without invented high-detail geography.
- [ ] Attribution is readable, accurate, and links to the selected sources.
- [ ] Loading, constrained-device tier, failure/retry, and route re-entry remain usable.
- [ ] User records accept, revise, or defer with screenshot/evidence reference.

| Body             | Asset version / tier                          | Automated result                                                                   | User visual decision | Evidence / requested revision                                            |
| ---------------- | --------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------ |
| Earth            | Repository-stored earth-july-v2, low/standard | Offline decode, hashes, normal/UV convention and size checks passed                | On hold              | Not deployed or Viewer-integrated; runtime alignment/performance pending |
| Luna             | Repository-stored luna-v2, low/standard       | Offline decode, hashes, exact LOLA correspondence, normal and budget checks passed | On hold              | Not deployed or Viewer-integrated; fine alignment/performance pending    |
| Mars             | Repository-stored mars-v1, low/standard       | Offline decode, hashes, signed heights, normal direction and budget checks passed  | On hold              | Not deployed or Viewer-integrated; fine alignment/performance pending    |
| Mercury          | Pending                                       | Not run                                                                            | Pending              |                                                                          |
| Expansion bodies | Add one row per approved body                 | Not run                                                                            | Pending              |                                                                          |

### Performance and release gates

- [ ] Measure cold-cache transfer and first usable surface time with documented
      network conditions; compare with Stage 1 targets.
- [ ] Record frame intervals, draw calls, and estimated texture residency on the
      selected desktop and constrained device. Do not treat texture counts as bytes.
- [ ] Repeated mount/unmount and renderer changes do not grow owned resources
      monotonically.
- [ ] Production output contains only runtime derivatives and required
      decoders/notices, not originals or processing intermediates.
- [ ] Runtime assets and any transcoders are same-origin; deployed paths and CSP work.
- [ ] No ordinary Git blob exceeds GitHub's 100 MiB limit. Obtain approval for
      alternate source storage/LFS if required.
- [ ] Update the existing
      [procedural planet design document](./procedural-planets-2026-09-28.md)
      with implemented Sol behavior, actual budgets, and validation evidence.
- [ ] User signs off accepted bodies; unresolved bodies remain explicitly deferred.

## Execution evidence and decision log

| Date       | Stage / body     | Command or review                                                                                                                                                                                        | Result / evidence                                                                                                                  | Follow-up                                                                                                |
| ---------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 2026-10-08 | Planning         | Repository and primary-source research; cache-busted OpenAPI and referenced schemas                                                                                                                      | Integration seams and candidate products identified; no asset imports or runtime changes                                           | Begin Stage 0 and Stage 1                                                                                |
| 2026-10-08 | Station decision | User selected permanent 5% linear mesh size                                                                                                                                                              | Approved requirement; not implemented                                                                                              | Verify exact scale and user visibility                                                                   |
| 2026-10-08 | Stage 0          | `npm run test:spec -- src\app\scene\viewer\viewer-system-scene.vitest.ts src\app\scene\viewer\viewer-formatters.vitest.ts`                                                                               | Passed: 2 files, 60 tests                                                                                                          | User visual review pending                                                                               |
| 2026-10-08 | Stage 0          | `npm run build`                                                                                                                                                                                          | Passed: production build and Angular template compilation                                                                          | No splash changes                                                                                        |
| 2026-10-08 | Stage 0          | `npx --no-install eslint src\app\scene\viewer\viewer-formatters.ts src\app\scene\viewer\viewer-system-scene.ts src\app\scene\viewer\viewer-system-scene.vitest.ts e2e\tests\viewer-interactions.spec.ts` | Passed                                                                                                                             |                                                                                                          |
| 2026-10-08 | Stage 0          | `npm run e2e:spec -- e2e\tests\viewer-interactions.spec.ts --grep '5% station mesh'`                                                                                                                     | No tests found: Playwright interpreted backslashes as regex syntax                                                                 | Used filename-only selector                                                                              |
| 2026-10-08 | Stage 0          | Initial filename-selected browser runs                                                                                                                                                                   | First failed at pre-existing fixture classification; second revealed descriptor trade-hub baseline rather than legacy box baseline | Reused valid existing fixture and corrected expected descriptor scale; did not change unrelated fixtures |
| 2026-10-08 | Stage 0          | `npm run e2e:spec -- viewer-interactions.spec.ts --grep '5% station mesh'`                                                                                                                               | Passed: setup and station regression (2 tests)                                                                                     | Awaiting user terrain-visibility and pointer-usability review                                            |

| 2026-10-08 | Stage 0 visual acceptance | User confirmed visual validation complete in Stellar Viewer | Accepted; Stage 0 Done | Device/viewport and screenshots not supplied |
| 2026-10-08 | Stage 1 quality policy | User approved shared pure helper; `npm run test:spec -- src\app\scene\render-quality.vitest.ts src\app\scene\mining-splash.vitest.ts` | Passed: 29 tests; splash selector behavior preserved | Viewer tier integration deferred to catalog stages |
| 2026-10-08 | Stage 1 quality policy | `npx --no-install eslint src\app\scene\render-quality.ts src\app\scene\render-quality.vitest.ts src\app\scene\mining-splash-state.ts` | Passed | |
| 2026-10-08 | Stage 1 contract inspection | Cache-busted root OpenAPI and SolarSystem module | HTTP 200; `sol` and `sol-luna` documented; other pilot IDs unresolved | Require authoritative identities before catalog wiring |
| 2026-10-08 | Stage 1 contract approval | Fresh no-cache fetch of root and reference graph; identity schema checks; authenticated solar-system-get and celestial-body-list reads; user approval | Approved new optional catalogIdentity contract; 140 documents fetched; both live reads supplied all 24 identities; checked classifications and parent/anchor links matched | Supersedes initial identity blocker; DTO/validator/catalog implementation pending; exact assets and rights still require clearance |

| 2026-10-08 | Earth source decisions | Selectable user decisions and primary NASA/NOAA policy/product review | July unshaded BMNG color, disclosed limitations, subtle land-only relief using unrestricted GLOBE v1.0 candidate, session source storage and explicit failure/retry policy approved | Verify exact files and rights; no assets downloaded or processed |

| 2026-10-08 | Earth exact-source audit | Primary NASA/NOAA HTML, format/rights documentation, HEAD requests for 17 rasters, and all 16 small elevation headers; selectable user decisions | July 5400 x 2700 GeoTIFF and unrestricted a10g-p10g selected; all raster HEAD requests HTTP 200; elevation encoding and notices documented; d10g header latitude mismatch identified | No raster downloads; investigate alignment mismatch and verify NASA acknowledgments and actual raster metadata before processing |

| 2026-10-08 | Earth source clearance | Downloaded/hashed sources and notices; full NASA PDF review; full RGB decode and streamed validation of 16 elevation payloads; selectable user approvals | Passed local raster inspection; user accepted source-clearance gate, explicit D-tile derived-metadata correction and sRGB display assumption | Prepare derivatives in a subsequent step; verify masks/UV alignment and budgets; visual acceptance pending |

| 2026-10-08 | Luna source clearance | Selectable source/relief/policy approvals; downloaded TIFF metadata/full decode and ICC inspection; original LOLA reference comparison | User accepted source-clearance gate; 2025 sRGB colour verified; all 16,588,800 elevation samples matched original after offset/longitude transformation | Prepare derivatives later; colour/relief UV alignment, budgets and visual acceptance pending |

| 2026-10-08 | Mars source clearance | Selectable source/relief/policy approvals; downloaded/hashed Viking and MOLA rasters, full decode and labels/rights audit | User accepted source gate and documented sRGB/normalization/nodata policies; missing colour edge and conflicting MOLA convenience-header zero setting recorded | Derivative production and co-registration pending; final Stellar Viewer visual acceptance explicitly on hold |

| 2026-10-08 | Mercury deferral | Selectable appearance/relief/policy decisions; primary NASA/USGS product review | No approved natural-looking global colour source established; user deferred all Mercury observed-imagery and DEM acquisition, retaining procedural rendering | Does not block Earth/Luna/Mars preparation; reactivate only after separate source approval; final Viewer visual acceptance on hold |

| 2026-10-08 | Stage 1 closure | Consolidated accepted Earth/Luna/Mars source records, rights, encoding, coverage, quality/budgets, storage and failure policies | Stage 1 Done for active pilot; Forge identity contract approved; Mercury explicitly deferred | Stage 3 contract implementation remains pending |

| 2026-10-08 | Stage 2 Earth | Selectable session-only scope, map-size, physical-relief and JPEG98 decisions; local preparation and validation scripts plus installed Three sphere/texture assertions | Final v2 full decodes/hashes and offline tests passed; low 0.60 MiB / estimated 14 MiB, standard 1.95 MiB / estimated 54 MiB, including one preview | Stage 2 In progress; prepare Luna/Mars next; no Viewer changes or final visual acceptance |

| 2026-10-08 | Derivative storage revision | User requested repository output storage and selected non-deployed assets folder; copied five selected Earth v2 maps and retained a repository-local provenance manifest | Originals, tools and experiments remain in session storage; selected files checked against original output hashes and byte counts | No commit/push requested; no build asset configuration, Viewer or splash changes; final visual acceptance remains on hold |

| 2026-10-08 | Stage 2 Luna | Source hashes/decodes and exact LOLA IMG correspondence; local JPEG comparisons and physical normal generation | Initial standard v1 failed 4 MiB; user approved JPEG95 standard plus 1K normal; final v2 passed at low 1.62 MiB / estimated 14 MiB and standard 3.25 MiB / estimated 46 MiB | Selected outputs in non-deployed repository storage; failed experiment/originals in session; Mars next; final Viewer visual acceptance on hold |

| 2026-10-08 | Stage 2 Mars | Selectable JPEG98/dimension/physical-relief approval; actual-transform color normalization and source-neighbor nodata fill; signed MOLA checks and local generation | Mars v1 passed full offline output tests; low 1.07 MiB / estimated 14 MiB, standard 3.78 MiB / estimated 54 MiB including one preview; no cap or quality change needed | All active-body candidates prepared; Stage 2 alignment/runtime gates remain open; no Viewer integration or final visual acceptance |

| 2026-10-08 | Repeatability | User approved portable repository pipeline; shared recipes, pinned tools, hash-pinned source acquisition, external-original workflow and rebuild guide | All 15 candidate images rebuilt byte-identically; no originals or diagnostic artifacts added to Git | Archive originals externally for next year; changed source/rights or tool environment requires fresh review |

| 2026-10-08 | Stage 2 isolated diagnostics | Nine paired source landmark panels; Three182 GPU upload/channel/water checks, 36 render cases and repeated disposal; Playwright SwiftShader evidence runner | GPU correctness smoke tests passed; qualitative landmark agreement except inconclusive Hellas fine fit; Luna north radial pinching and subtler Mars pole pattern recorded | Stage 2 not closed; no corrective assets or production integration; final Viewer visual acceptance on hold |

| 2026-10-08 | External storage | User approved project-specific Sol store under D:\at-template\artifacts; copy-only archival and per-file hash inventory; portable root and restore/rebuild commands | 147 files / 1,289,624,563 bytes archived and verified outside Git; original session copies untouched; no repository image-byte changes | Other environment chooses its own root; keep independent backup; unrelated artifact types excluded |

Add dated rows for implementation, rights clearance, measurements, automated
results, and user visual decisions. Keep failed checks and deferred assets visible
until their resolution is recorded.
