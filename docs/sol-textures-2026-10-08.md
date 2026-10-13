# Sol planetary textures: implementation and validation plan

Date: 2026-10-08  
Status: Stages 0-3 are complete for the Earth/Luna/Mars pilot; the user has now approved and requested a specific Stage 4 Io expansion. The Io source, derivative, catalog integration, and static overview/detail volcanism cues are implemented; automated verification and live visual review are tracked below. Stage 2 closed on 2026-10-12 at the accepted, documented scope. Its sampled fine registration, Luna/Mars polar boundary/detail-loss, seam/orientation, and Tycho/Olympus Mons source-shadow reviews retain caveats. WebP is active in the Viewer; earlier JPEG versions remain non-runtime baselines. Representative hardware/network performance and final Stellar Viewer visual acceptance remain pending; final visual acceptance is still on hold. Active versions are earth-july-v3, luna-v4, mars-v3, and io-v1. Originals/notices remain outside the deployed runtime assets. Mercury and unsupported identities remain procedural.

## Goal and approved decisions

### Restart handoff (2026-10-12)

- Accepted limited reviews: sampled fine registration; Luna/Mars polar
  boundary/detail-loss; Tycho/Olympus Mons source-shadow assessment at both tiers.
  Acceptance scope, exclusions, verbal clarifications and limitations are
  recorded in the Stage 2 history below; none implies globe-wide scientific
  validation or final Viewer sign-off.
- The user accepted the limited WebP seam/orientation screening with its
  stated caveats and accepted matched WebP/JPEG albedo appearance comparisons
  for Earth, Luna, and Mars on 2026-10-12. Runtime checks are complete;
  representative hardware/network performance and final Viewer acceptance
  remain open. Stage 2 is Done for the active pilot at the documented scope;
  Stage 3 is Done. KTX2 is not a Stage 2 gate.
  Final Stellar Viewer visual acceptance remains explicitly on hold.
- Active runtime versions are Earth `earth-july-v3`, Luna `luna-v4`, and Mars
  `mars-v3`, plus the new Io `io-v1` albedo; the prior Earth/Luna/Mars JPEG
  versions remain as non-runtime baselines. Io has no normal/material map.
  The selected Earth/Luna/Mars source maps and relief were not corrected, and
  production lighting was not changed.
- The user approved an Io Stage 4 expansion: USGS color-merged surface imagery
  and subtle static project-authored hotspot/plume cues in overview and focused
  detail. These cues are illustrative, not claims of current activity or
  geolocated observations. Io's live Stellar Viewer appearance remains to be
  reviewed; broader moon-catalog expansion and final pilot sign-off remain
  separate gates.
- All eight submitted review JSON files were copied byte-for-byte into external
  `work/reviewer-submissions-2026-10-12-v1`; originals remain untouched.
  The approved external store is
  `D:\at-template\artifacts\laughing-octo-journey\sol-textures`.
  Diagnostic evidence directories referenced below are retained, not deleted.
- All five session-owned diagnostic/review servers were stopped for restart.
  No listeners remained on ports 43187 or 43189-43194 after cleanup.
  They do not need to be running to resume encoding/seam evidence review.
  To reopen a retained form, use the loopback HTTP command in the
  [tool guide](../tools/sol-textures/README.md) against its existing evidence
  directory; do not regenerate into or overwrite it.
- No commit or push was performed by the assistant during this review work.
  Inspect the worktree after restart and preserve any user commits/changes.

**Accepted source/relief texture sets (2026-10-08):** Earth `earth-july-v2`,
Luna `luna-v3`, Mars `mars-v2`. The user gave final acceptance of the current
geodesic polar normal appearance for Luna/Mars and explicitly authorized
promotion of both tiers, keeping albedo unchanged and prior versions retained.
The later WebP versions change albedo encoding only, preserve these accepted
normal maps, and retain these JPEG versions as non-runtime baselines. This
supersedes the earlier leading-candidate-only decision. It does not
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
  central selection seam; exact supported `sol/earth`, `sol/luna`, `sol/mars`,
  and `sol/io` identities select catalog assets; other eligible solid bodies
  retain the terran generator.
- [Texture cache](../src/app/scene/planet/planet-texture-cache.ts):
  shared overview/detail facade for procedural scheduling and
  [catalog texture ownership](../src/app/scene/planet/catalog-surface-cache.ts).
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

Both Viewer templates now apply explicit catalog cloud eligibility: Earth
retains its cloud layer; Luna and Mars do not acquire terrestrial clouds.
Io does not acquire terrestrial clouds and adds a project-authored static
volcanism overlay. Procedural cloud behavior and splash paths remain unchanged.

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

| Stage | Work                                                           | Prerequisites                          | Status      | Evidence / blocker                                                                                                                                                                                                |
| ----- | -------------------------------------------------------------- | -------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | Minimize station meshes to 5% linear size                      | None                                   | Done        | Automated verification passed; user confirmed Stellar Viewer visual validation complete on 2026-10-08                                                                                                             |
| 1     | Confirm identities, source rights, and asset budgets           | None                                   | Done        | Active Earth/Luna/Mars source records, interpretation, coverage, policies and budgets consolidated; Forge identity approved; Mercury explicitly deferred                                                          |
| 2     | Prepare active pilot assets: Earth, Luna, Mars                 | Stage 1                                | Done        | All Stage 2 checklist items accepted at documented scope; limited registration, polar, source-shadow and seam/orientation reviews retain caveats; user accepted matched WebP/JPEG albedo appearance for all three; KTX2 not required; final Viewer presentation/performance and final visual sign-off remain separate open gates; Mercury excluded until separately cleared |
| 3     | Implement catalog resolution, loading, and ownership           | Stages 1-2; user authorized overlap    | Done        | Exact typed selection, loader and leased byte-budgeted cache implemented; 127 unit tests and 31 headless regression tests passed; production allowlist/hash evidence recorded                                     |
| 4     | Wire viewer materials, atmospheres, attribution, and status UI | Stage 3                                | In progress | Venus/Titan atmospheres visually accepted in overview and detail on 2026-10-12. Io source, albedo, and static illustrative hotspot/plume integration are in progress; live Io review pending. Earlier tint/highlight and host-child overlap reviews were accepted; radar/infrared reveal mode deferred; exact-direction sibling overlaps may remain |
| 5     | Automated pilot verification                                   | Stages 0 and 4                         | In progress | Focused unit/browser regressions and production artifact checks passed; Actions/Linux execution and remaining acceptance evidence pending                                                                         |
| 6     | User visual pilot acceptance in Stellar Viewer                 | Stages 0 and 4                         | Not started | Explicitly on hold at the user's request; offline preparation is not appearance sign-off                                                                                                                          |
| 7     | Expand approved moon/dwarf-planet catalog                      | Stages 5-6; per-body Stage 1 clearance | Not started | Per-body acceptance required                                                                                                                                                                                      |
| 8     | Release verification and documentation                         | Stages 5-7                             | Not started | Production assets and regression evidence pending                                                                                                                                                                 |

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
ocean/coastal-transition cells. The checklist below records completion at the
accepted pilot scope; review caveats and separate release gates remain explicit.

- [x] Preserve approved originals outside deployed runtime assets; generate
      derivatives to distinct paths using existing local tooling.
- [x] Produce preview, 2K, and 4K variants only where source detail warrants them.
- [x] Normalize suitable whole-globe products to the renderer's equirectangular
      UV convention; verify orientation, seams, and poles. The limited active-
      WebP seam/orientation and polar reviews were accepted with documented
      caveats; this is not globe-wide scientific validation.
- [x] Use sRGB for albedo and linear semantics for normal/material data.
- [x] Use actual elevation for relief where available. A grayscale bump image
      is not a normal map; image brightness is not terrain elevation.
- [x] Avoid colored elevation/shaded-relief maps as natural albedo and assess
      baked source shadows before applying runtime lighting. The limited
      Tycho/Olympus Mons source-shadow review was accepted; source reflectance
      ambiguities and sample scope remain documented.
- [x] Record exact processing commands, tool versions, dimensions, bytes,
      hashes, and source-to-derivative changes.
- [x] Review active WebP albedo appearance against the retained JPEG baselines.
      On 2026-10-12 the user accepted matched full-map and close-up comparisons
      for Earth, Luna, and Mars; results and caveats are recorded below. This
      accepts albedo encoding appearance only, not Earth Viewer lighting/cloud
      presentation, representative hardware/network performance, or final
      Stellar Viewer sign-off. KTX2 evaluation is not a Stage 2 closure
      prerequisite; reconsider only if future measured requirements justify it.

#### JPEG/WebP encoding suitability (2026-10-12)

The user first selected an offline JPEG-versus-WebP comparison. The pinned
Python 3.14.5 / rasterio 1.5.2 / GDAL 3.12.2 / NumPy 2.5.3 environment's
existing GDAL WebP driver encoded six lossy quality settings (75, 80, 85, 90,
95, 98) for each preview/low/standard albedo. All 54 WebP outputs decoded as
RGB at the expected dimensions. Original source hashes were rechecked, and the
source-grid RGB references were reconstructed with the approved pipeline
recipes; the selected JPEG PSNR measurements matched their manifests within
0.01 dB.

For comparison, the smallest of the six tested candidates at or above the
pipeline's existing 40 dB offline PSNR floor was chosen independently for each
albedo map. The floor and transfer budgets are offline compression checks,
not perceptual acceptance. Transfer totals below include the shared preview,
selected tier albedo, and unchanged tier normal PNG; caps remain 2 MiB low /
4 MiB standard.

| Body / asset version  | WebP preview / low / standard choice (quality, PSNR) | Low total: JPEG -> WebP (saved)      | Standard total: JPEG -> WebP (saved)   |
| --------------------- | ---------------------------------------------------- | ------------------------------------ | -------------------------------------- |
| Earth / earth-july-v2 | q90 / 40.23 dB; q85 / 40.67 dB; q80 / 40.56 dB      | 632,321 -> 228,871 B (403,450 B)     | 2,040,763 -> 633,765 B (1,406,998 B)   |
| Luna / luna-v3        | q90 / 40.80 dB; q90 / 40.69 dB; q90 / 40.74 dB      | 1,702,240 -> 1,090,250 B (611,990 B) | 3,405,555 -> 2,327,118 B (1,078,437 B) |
| Mars / mars-v2        | q95 / 40.51 dB; q90 / 40.55 dB; q85 / 40.31 dB      | 1,140,522 -> 595,938 B (544,584 B)   | 4,026,793 -> 1,881,189 B (2,145,604 B) |

All tested bodies/tiers remain within the approved transfer caps. WebP is
promising for transfer reduction, but this does not measure network time or
reduce decoded RGBA8/GPU residency. The selected JPEG assets, manifests,
application loader, Angular allowlist, and production output were unchanged.
KTX2 was not evaluated. The user then selected integration of WebP as the
active Viewer format, preserving the JPEG versions outside the runtime
allowlist and requiring the existing explicit load-error/retry behavior rather
than JPEG fallback. Selected albedo candidates were staged as new asset
versions; accepted normal PNGs were copied byte-for-byte. This is the current
format/transfer decision, not user visual appearance acceptance. Final Stellar
Viewer visual acceptance remains on hold.

Evidence and all candidate encodes are retained outside Git under
`work/encoding-suitability-2026-10-12-v1` in the approved artifact store.
`encoding-comparison.json` records per-file dimensions, bytes, SHA-256,
quality, source-reference PSNR, selected-tier totals, and tool versions;
`compare_encoding.py` records the reproducible procedure (SHA-256
`A354802E8E15B16FA893D65E37ABB61928D901606261187FCA819B7E9573D0E3`).
The comparison JSON SHA-256 is
`6563D1B5C7B4BFA661C177837C0D760EC1A6FDBA3B48A2FC842D0EB8E2869BDE`.
The selected albedo/normal files and manifests are in
[`earth-july-v3`](../assets/sol-textures/earth-july-v3),
[`luna-v4`](../assets/sol-textures/luna-v4), and
[`mars-v3`](../assets/sol-textures/mars-v3). Their previous JPEG versions
remain in Git but are excluded from the Angular runtime allowlist. The
reproducible `pipeline.py` now regenerates the selected WebP versions; fresh
external rebuilds were compared byte-for-byte with all 15 active image files.

#### WebP runtime loading and visual-review gate

The central surface catalog selects the new WebP asset versions. The existing
Three `TextureLoader` handles their same-origin image requests without a new
decoder package or JPEG fallback. Angular's asset allowlist includes only the
three active WebP/PNG directories; the JPEG baselines and manifests are not
runtime assets. Failure continues through the existing catalog error/retry
UI.

Automated checks verify browser WebP decoding through the Viewer, the
`image/webp` response type, same-origin requests, selected preview/detail
tiers, and no JPEG request after an initial WebP failure. The isolated Three
diagnostic harness now loads the active WebP albedos so the remaining seam,
orientation, and filter review exercises the deployed encoding. These are
runtime correctness checks, not a user judgment of compression artifacts or
final Viewer appearance. The existing WebP visual comparison and final
Stellar Viewer appearance acceptance remain open/on hold.

#### Active-WebP seam/orientation diagnostic (2026-10-12)

The isolated Three.js harness rendered 36 active-WebP cases and saved 39
screenshots to
`D:\at-template\artifacts\laughing-octo-journey\sol-textures\work\webp-active-gpu-2026-10-12-v1`.
The report records WebGL 2 / Three.js r182, a 768x512 viewport at DPR 1, and
SwiftShader software rendering. All 15 GPU texture samples had zero
linear-sample byte error; normal-channel direction checks passed, and three
repeated load/dispose cycles returned to the same texture-count baseline.
The report status is `passed`.

The 39-image set was screened for body identity, seam/front views, both poles,
albedo and gray relief. No obvious globe-scale albedo orientation reversal or
abrupt seam is apparent at this diagnostic scale. The user accepted this
limited screening on 2026-10-12 with these caveats; it is not fine-detail
appearance acceptance. The harness is not the Angular Viewer, uses a software
rasterizer, makes no hardware-performance claim, and does not establish fine
source alignment. Detailed appearance and final Stellar Viewer acceptance
remain pending. `gpu-checks.json` is the machine-readable result; no screenshot
or report was added to the repository.

Integration validation:

- `python -m unittest discover -s tools\sol-textures -p 'test_*.py' -v`
  (pinned artifact-store Python): 31 tests passed.
- `npm run test:spec -- src\app\scene\planet\catalog-surface-loader.vitest.ts src\app\scene\planet\catalog-surface-cache.vitest.ts src\app\scene\planet\planet-texture-cache.vitest.ts`:
  44 tests passed across three files.
- `npm run typecheck` and `npm run build`: passed. The production output
  contains exactly 15 catalog images (9 WebP, 6 PNG; no JPEG).
- `npm run e2e:spec -- e2e\tests\viewer-planet-surfaces.spec.ts --workers=1`:
  11 tests passed, including WebP MIME/loading and no-fallback behavior.
- Fresh external rebuilds matched all 15 active image hashes byte-for-byte;
  the diagnostic harness passed 36 render cases. `git diff --check` passed.

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

#### Fine registration audit started (2026-10-09; Stage 2 gate)

The user approved a read-only audit of Earth/Luna/Mars and a local paired
homologous-feature review. The selected images remain unchanged. Acceptance
tolerance is **one delivered normal texel at each tier**, with ambiguous regions
explicitly excluded rather than fitted to unrelated color patterns. The review
uses a conservative bound including both per-click uncertainty radii; this
threshold is an approved criterion, not an achieved registration result.

All original hashes and selected output hashes/dimensions/budgets were checked.
Each of the six delivered normal maps was reconstructed in memory from its
source-grid recipe and every decoded sample matched. This proves recipe/grid
correspondence, **not source albedo/elevation co-registration**. The existing
qualitative panels do not supply measured homologous points.

Fresh nine-region paired evidence and a selectable annotation form are generated
by [registration_review.py](../tools/sol-textures/diagnostic/registration_review.py);
see the [local review guide](../tools/sol-textures/README.md). Each pair compares
actual low/standard albedo with fresh common-grid source-elevation hillshade.
Display-only 8x relief exaggeration does not alter runtime normal strength.
East/north angular offsets are converted to delivered normal texels:

| Body  | Low normal texel  | Standard normal texel |
| ----- | ----------------- | --------------------- |
| Earth | 0.3515625 degrees | 0.17578125 degrees    |
| Luna  | 0.3515625 degrees | 0.3515625 degrees     |
| Mars  | 0.3515625 degrees | 0.17578125 degrees    |

Mars's archived Viking metadata reports MDIM/MOLA local RMS differences of
3.15 km easting / 4.33 km northing, and warns against interpreting the historical
0.11-degree comparison as a universal MDIM 1 correction. Those source-level
figures cannot certify the selected landmarks; hazy Hellas remains a candidate
for explicit exclusion. Earth coastline masking and lunar color rays likewise
must not be confused with height displacements.

**Registration remains open pending saved feature annotations, coverage review
and explicit acceptance.** No residual numbers are inferred from brightness
correlation or from the fact that grids match. Polar boundary/detail-loss review
and final Stellar Viewer visual acceptance remain separate open/on-hold gates.

Local preparation on 2026-10-09 used Python 3.14.5 with the pinned
NumPy 2.5.3 / rasterio 1.5.2 / GDAL 3.12.2 dependencies, restored into an external
environment after the available Python lacked NumPy. No original downloads,
source replacement or application changes were required.

The 2026-10-11 reviewer submission contains 19 records: 18 paired points and a
Hellas Standard exclusion. Sixteen recorded bounds are within tolerance; the
Copernicus Low and Valles Marineris Standard points are outside it. These are
**preliminary annotations, not validated source defects or scientific passes**:
the reviewer reported difficulty identifying precise features at the original
display size, labels are sometimes broad, and click uncertainty was left at the
default. Tycho Low and Hellas Low have no records.

The approved follow-up adds synchronized zoom/pan, paired hover magnifiers and
non-destructive import/reopen to the annotation form. Imported source/grid
identity is checked, original records and prior evidence metadata are retained,
and displayed residuals are recomputed. A recheck appends a new annotation.
Magnification adds no source detail or independent uncertainty evidence.
Target Copernicus Low, Valles Marineris Standard, near-threshold Olympus Low,
missing Tycho Low and a Hellas Low measurement/exclusion. All selected textures,
the original submission and earlier hash-pinned evidence remain unchanged.
Registration stays open; polar review and final Viewer acceptance are unaffected.

Fresh magnified evidence is retained externally under
`work/registration-review-2026-10-11-v4`; earlier evidence is preserved.
Validation passed: all 30 local raster/registration unit tests, all six
source-recipe normal reconstructions, and
`node tools\sol-textures\diagnostic\test-registration-review.mjs http://127.0.0.1:43190/ D:\at-template\registration-review.json`.
The isolated headless browser checked immutable imports/provenance, rechecks,
zoom/pan invariance, magnifiers, responsive click coordinates, export,
persistence and all 18 image pairs. Synthetic annotations were discarded.
Prettier checks and `git diff --check` passed. These validate the review tool,
not the correctness of the reviewer's homologous-feature identifications.

The second-pass export, `registration-review-v2.json` (evidence ID
`registration-review-2026-10-11-v4`), contains 17 measured points and two
exclusions. All 17 distances and uncertainty bounds were independently
recomputed from the saved coordinates and match the export; all recorded bounds
are within one normal texel. The new Valles Marineris Standard "south peak"
point has a bound of 0.961 texels; Olympus Low remains near the threshold at
0.967 texels. These bounds still use the unverified default 0.15-texel
per-click uncertainty.

Copernicus Low is now excluded. The reviewer clarified that they could not
confidently identify the same terrain feature in both images; the exported
note "left" alone did not describe that limitation. Hellas Standard remains
excluded. Tycho Low and Hellas Low still lack records. Seventeen original
records are unchanged in the second export; the two original outlier records
are absent from that export but remain in the untouched first submission.
Prior evidence metadata is retained. Neither submission was edited.
Registration remains open pending coverage and uncertainty/feature review;
exclusions are not passes and no corrective texture shift is justified by
these annotations.

Following the second-pass review, the user explicitly excluded **Hellas Low**
from fine registration measurement. This is an approved review exclusion, not
a passing measurement or evidence of a texture defect. It is recorded here
without modifying the submitted JSON. Tycho Low coverage and the near-threshold
Valles Standard/Olympus Low feature and uncertainty review remain open.

The user subsequently confirmed the second-pass **Valles Marineris Standard**
and **Olympus Mons Low** measurements, accepting their recorded feature
placements and 0.15-normal-texel per-click uncertainties for this review.
Their conservative bounds are respectively 0.961 and 0.967 normal texels,
within the approved one-texel tolerance. This is reviewer confirmation, not
an independent scientific calibration of uncertainty. No submitted JSON or
selected texture was changed. **Tycho Low is the remaining coverage item**
before the fine-registration gate can be considered for explicit acceptance;
polar review and final Viewer visual acceptance remain separate.

The third-pass export, `registration-review-v3.json`, adds Tycho Low's
"north east rim" point: measured distance 0.189 normal texels, conservative
bound 0.489 with the recorded 0.15-texel per-click uncertainty. All 19
second-pass records remain unchanged. All 18 measured residuals and bounds
were independently recomputed and match the export; none exceeds tolerance.
Together with the documented Hellas Low exclusion, all nine sampled regions
have a measurement or explicit exclusion for both tiers. This completes
sampled coverage, not global registration proof. The submitted files remain
unchanged; explicit acceptance of the limited fine-registration review is
still pending.

**Accepted limited fine-registration review (2026-10-11):** the user explicitly
accepted completion for the sampled landmarks and tiers, retaining Copernicus
Low and both Hellas tiers as exclusions and the recorded uncertainty
limitations. The 18 measured points meet the one-normal-texel conservative
bound; nine sampled regions have measurements or approved exclusions at both
tiers. This closes only this limited Stage 2 fine-registration gate, not global
source co-registration or scientific uncertainty calibration. No corrective
shift, texture change or submitted-file edit was made. Polar boundary/detail-loss
review remains open and final Stellar Viewer visual acceptance remains on hold.
Earlier pending statements in this audit are chronological checkpoints,
superseded by this explicit acceptance.

#### Polar boundary/detail-loss follow-up started (2026-10-11)

The user selected one guided Mars north-pole comparison before expanding to
both bodies and tiers. Read-only preparation uses the existing diagnostic
renderer and [prepare-polar-guide.mjs](../tools/sol-textures/diagnostic/prepare-polar-guide.mjs).
Six pixel-exact images compare prior Mars v1 against selected Mars v2 with
identical light, geometry, framing and mipmapped filtering: gray relief at
12/6-degree fields of view, plus albedo/relief at 12 degrees. Latitude guides
mark 85 degrees (treatment begins) and 87 degrees (blend completes), projected
from the recorded north-pole camera. The baseline is not ground truth.

Final evidence is retained externally under
`work/polar-guided-mars-north-2026-10-11-v2`, including source/output/script hashes
and render settings. The first preparation used CSS screenshots with a
513-pixel height; the final version exports the raw 768 x 512 canvas so guide
coordinates match the rendered pixels exactly. The earlier output is preserved.
All six images rendered without console/page errors. An isolated headless form
check passed image dimensions, guide ordering/visibility, required notes,
observation persistence and export; synthetic observations were discarded.

The form asks for possible boundary changes, detail loss or uncertainty, with
free-text notes; no precision landmark marking is required. This first example
does not close any polar gate: both poles, Luna/Mars low/standard, changing light
and nearest/mipmapped controls remain required. No selected assets were changed;
final Viewer visual acceptance remains on hold.

The initial `mars-polar-observations.json` contains an **unsure** observation:
"do not see any differences - no features whatsoever." The reviewer described
both images as completely white. Pixel inspection found no pure-white clipping,
but the overview's 5th/50th/95th brightness percentiles were 184/211/230 on
the 0-to-255 scale. This is insufficiently readable review presentation,
not a polar pass or evidence that features are absent. The submission is
preserved unchanged.

The user approved darker neutral material and two grazing-light directions,
without normal-strength exaggeration. Revised evidence under
`work/polar-guided-mars-north-2026-10-11-v3` contains ten raw 768 x 512 images.
Gray relief uses `#777777`, ambient 0.08, directional intensity 3 and 82-degree
incidence from left/right; normal scale remains `[1, 1]`. Both overview
directions have brightness percentiles 15/50/95, without pure-black/white
clipping. Crater/ridge shading and baseline central spoking are visibly
discernible; smoother selected central relief remains a comparison question,
not an established loss of legitimate terrain. Dark regions from grazing
illumination must not be interpreted as missing detail.

The original diagnostic defaults are restored on each non-profile render.
Validation passed: the existing `run-checks.mjs` runner (36 GPU cases,
39 screenshots), plus isolated headless checks of all ten images, projected
guides, required notes, observation export/persistence, unchanged normal scale
and restoration of default lighting. Synthetic observations were discarded.
Source/output/script hashes and full light/material settings are retained.
Earlier evidence and textures remain unchanged; polar review remains open.

The reviewer subsequently reported that the darker presentation was much
clearer, that they could complete the guided review, and that selected
**Mars v2 geodesic looked much better**. This is a positive verbal assessment
of the Mars north Standard screening, not acceptance of all polar cases.
The supplied `mars-polar-observations-v2.json` identifies the revised v3
evidence but contains an empty `records` array; no per-comparison observations
were saved in that export. Preserve the file unchanged and distinguish the
verbal assessment from structured evidence. Other poles, bodies, tiers and
filter controls remain unreviewed; the polar gate stays open.

The user then explicitly selected retaining that verbal preference and preparing
the remaining bodies, poles and tiers with the clearer presentation.
Expanded evidence under `work/polar-guided-all-2026-10-11-v1` contains eight
body/pole/tier groups and 80 matched images (five comparison pairs per group).
Mars north Standard is retained as reference; the other seven groups await
review. Each group includes left/right grazing-light gray overviews and
closeups plus albedo/relief under left light, with unchanged normal strength.
Luna compares v2/v3 and Mars compares v1/v2.

The form now records the body/pole/tier with each observation, displays saved
notes and prevents downloading an empty review. Source/output hashes and render
settings remain recorded. An isolated headless check passed all 80 image loads,
group/version labels, latitude guides, required notes, empty-export prevention,
saved summaries, export and persistence; synthetic data was discarded.
This expands preparation, not acceptance: baseline is not ground truth,
nearest-filter controls and source-derived detail validation remain separate
evidence needs, and no polar gate or final Viewer hold is closed.

The submitted `polar-observations.json` contains eight observations covering
all body/pole/tier groups. All four Mars groups are marked acceptable with
"no concerns". Both Luna north tiers are marked as possible boundary concerns
("almost looks pinched" / "looks somewhat pinched"); both Luna south tiers
are marked as possible detail loss ("softened too much"). These are reviewer
findings, not established source or processing defects. Seven records refer
to the left-lit blend overview; Luna south Low refers to the left-lit closeup.
The export does not establish whether other lighting/views were inspected.

Mars has positive screening evidence across both poles and tiers, but the
full polar gate remains open because of the four Luna concerns and outstanding
filter/source-detail controls. Localize north pinching relative to the pole
and 85-to-87-degree blend band, then compare the south features against
source-derived relief before proposing any correction. Preserve the submitted
JSON and selected assets unchanged; final Viewer acceptance remains on hold.

The reviewer clarified that Luna north pinching is **at the central pole**:
terrain appears pulled into a point or spokes, rather than reporting a ring
across the blend band. Track this as residual central polar structure; its
cause is not yet established. The observation was made in gray-relief mode,
so albedo pinching alone cannot explain that particular image. Luna south's
reported excessive softening still needs localized source/baseline comparison.

The user approved proceeding with targeted Luna investigation. Evidence under
`work/luna-polar-controls-2026-10-11-v1` contains four pole/tier groups,
72 matched images and two retained original-DEM CPU relief references.
The closer-view controls add nearest filtering and neutral normals under
left/right grazing lights, retaining dark material and normal scale `[1, 1]`.
No texture was rewritten. Source/output/script hashes and render settings
are retained. The CPU references differ in projection, orientation, light
and sampling and are explicitly not pixel-aligned ground truth.

Inspection of Luna north Standard shows no central spokes in the neutral-normal
control, while the selected nearest-normal view retains radial/block-like
sampling structure. This implicates normal sampling and/or its tangent
interaction rather than sphere geometry/lighting alone in those examined
views; it does not isolate a source-data defect. Nearest filtering introduces
its own aliasing. South softening still requires a specific feature/location
before claiming loss of legitimate terrain or proposing a correction.
An isolated headless check passed all 72 images, both source references,
group/control labels, nonempty exports, saved summaries and persistence;
synthetic data was discarded. The polar gate and final Viewer hold stay open.

**Accepted limited polar boundary/detail-loss visual review (2026-10-11):**
the submitted `polar-observations-v2.json` marks Luna north Standard/Low and
south Standard acceptable. Luna south Low is recorded as "unsure" with
"no concerns"; the user explicitly clarified acceptance of that group and
closure of the limited polar visual review. Together with the four acceptable
Mars records in `polar-observations.json`, this supplies reviewer acceptance
for Luna/Mars, both poles and both tiers. The submitted JSON remains unchanged;
the clarification is recorded here, not silently substituted into its records.

This is acceptance of the current selected geodesic treatment as visually
good enough in the diagnostic review, not proof that residual central pinching,
sampling artifacts or legitimate detail loss are absent. The retained source
references are not pixel-aligned ground truth; recorded observations name
individual cases rather than establishing exhaustive viewing of every control.
Earlier Luna concerns and all evidence remain preserved. No selected texture,
normal strength or production rendering changed. Earlier open statements in
this polar-review history are superseded only for this limited acceptance.
Stage 2 remains in progress for its other checks, and final Stellar Viewer
visual acceptance remains on hold.

#### Source-shadow assessment started (2026-10-11)

The user selected guided Tycho (Luna) and Olympus Mons (Mars) comparisons at
both tiers, expanding only if needed. The source audit already cautions that
photometric normalization is not proof of shadow-free albedo; fixed dark
patches can also be true reflectance. No shadow-removal processing is approved.

[prepare-source-shadow-guide.mjs](../tools/sol-textures/diagnostic/prepare-source-shadow-guide.mjs)
prepares 28 controlled views: unlit selected albedo and left/right lighting
for gray relief, albedo without terrain normals, and combined albedo/relief.
The diagnostic light has 65-degree incidence, ambient 0.15 and directional
intensity 2; physical normal scale remains `[1, 1]`. Cameras, geometry and
mipmapped filtering are fixed within each group. Color tint is white; gray
relief uses `#777777`. This is isolated diagnostic lighting, not a Viewer change.
The form asks for specific source-shading conflicts, contradictory crater-wall
lighting or apparent relief inversion, not arbitrary fixed dark patches.

Final evidence under `work/source-shadow-guide-2026-10-11-v2` contains
source/output/script hashes and full render settings. The earlier v1 preparation
is retained. All 28 images rendered successfully and generation asserts the
exact terrain-normal-enabled/disabled control states. Isolated headless checks
passed all images in both panel selectors, required notes, empty-export
prevention, group-aware summaries/export, persistence and default-light
restoration; synthetic observations were discarded. The existing GPU runner
passed 36 cases and captured 39 screenshots under
`work/source-shadow-default-regression-2026-10-11-v1`.
Source-shadow acceptance remains pending reviewer findings. Selected assets,
prior observations and production rendering are unchanged; final Viewer visual
acceptance remains on hold.

**Accepted limited sampled source-shadow assessment (2026-10-12):**
`source-shadow-observations.json` contains four observations, one for each
Tycho/Olympus Mons low/standard group. Tycho Standard and both Olympus tiers
are marked acceptable; Tycho Low is marked "unsure" with positive notes.
The user explicitly clarified that Tycho Low's "unsure" selection was
accidental and accepted it. The user also confirmed inspecting combined
albedo/terrain relief under both opposite light directions for all four
groups, finding no distracting fixed-shadow or double-lighting conflict,
and explicitly accepted the limited sampled assessment.

The export records only the last panel pairing for each observation, not
viewing history; the opposite-light coverage and Tycho Low acceptance are
reviewer confirmations recorded here. The submitted JSON remains unchanged.
This closes the sampled Tycho/Olympus diagnostic assessment, not proof of
shadow-free albedo across either globe, Earth coverage, or a final Viewer
lighting review. Source-illumination/reflectance ambiguities remain documented.
No source-shadow correction, asset change or production lighting change was
made. Earlier pending statements in this section are superseded for this
limited acceptance only. Stage 2 still needs encoding suitability and
remaining seam/orientation checks; final Viewer acceptance stays on hold.

```powershell
& $python -m unittest discover -s tools\sol-textures -p 'test_*.py' -v
# Passed: 30 local raster/registration tests.
& $python tools\sol-textures\diagnostic\registration_review.py `
  --artifact-root $artifactRoot `
  --output (Join-Path $artifactRoot 'work\registration-review-2026-10-09-v2')
# Passed: all source/output hash checks; all six decoded normals matched;
# nine fresh regions, each with low and standard albedo; no annotations yet.
```

An isolated headless Chromium form check passed all 18 region/tier image loads,
coordinate/texel math, validation, browser persistence, exclusion handling and
JSON export. Its synthetic clicks were discarded with the isolated context and
are **not scientific registration evidence**. Local source crops, selected-albedo
crops, source/hash metadata, template/script hashes and an evidence inventory
are retained under the external `work\registration-review-2026-10-09-v2` folder.
The form is served on loopback only; downloaded reviewer annotations still need
to be retained and assessed before any closure statement.

The user also reported a green full E2E execution on 2026-10-09. This is
user-reported regression evidence (command/environment/count not supplied),
not registration or visual acceptance.

#### Actual-Viewer and matched-baseline WebP appearance review (2026-10-12)

The review used the already-running local Stellar Viewer at
`http://localhost:4200` after the user logged in. The browser viewport was
1568x861 CSS pixels at DPR 1; WebGL reported ANGLE / Intel UHD Graphics
Direct3D11. The active Viewer used the selected standard WebP albedo maps
(4096x2048) with the accepted normal PNGs. No production lighting, texture,
or catalog configuration was changed. The matched WebP/JPEG comparisons
below were image-only; they do not constitute final Viewer acceptance.

- **Luna:** Standard tier inspected at overview and close-up. No obvious
  compression artifacts were noticed at those scales. The matched JPEG
  comparison was also nearly indistinguishable at full-map and 2x crop scales;
  the user accepted the albedo appearance comparison on 2026-10-12.
- **Mars:** Standard tier inspected at overview and close-up. No obvious
  compression artifacts were noticed; the Viewer moon-orbit guide line can
  cross the body and distract from inspection. The matched JPEG comparison was
  also nearly indistinguishable at full-map and 2x crop scales; the user
  accepted the albedo appearance on 2026-10-12.
- **Earth:** Standard tier inspected in the Viewer and compared directly with
  the retained JPEG baseline as an albedo-only image at matched framing. The
  WebP and JPEG look nearly indistinguishable at full-map and 2x crop scales;
  no obvious WebP-specific banding, ringing, blur, or color shift was noticed.
  In the live Viewer, the 18% view remains dark/cloud-dominated and does not
  establish clear daylight framing. At maximum zoom, the separate Earth cloud
  overlay visibly becomes blocky and obscures the underlying albedo. The
  Viewer supplies this layer as a 256x128 cloud texture at opacity 0.7; it is
  not the WebP surface map. The user accepted the albedo-only comparison on
  2026-10-12; this does not accept the separate Viewer lighting/cloud
  presentation.
- **Separate Viewer scale/presentation issue:** In proportional system
  overview, Earth and Luna visibly overlap. Runtime measurements showed
  approximate radii 0.1168 and 0.0459 scene units, with center separation
  0.0124; their combined radii are 0.1627. This is a body-scale/presentation
  issue, not a WebP encoding defect, and remains separate from this texture
  appearance review.

Matched standard albedo images were shown at the same 1568x861 viewport and
centered 2x crop:

| Body | WebP / quality / bytes | JPEG / quality / bytes | Transfer reduction | Appearance observation |
| ---- | ---------------------- | ---------------------- | ------------------ | ---------------------- |
| Earth | 4096x2048 / 80 / 341,874 | 4096x2048 / 98 / 1,720,257 | 80.1% | Nearly indistinguishable; no obvious banding, ringing, blur, or color shift |
| Luna | 4096x2048 / 90 / 1,662,886 | 4096x2048 / 95 / 2,704,268 | 38.5% | Nearly indistinguishable at full-map and 2x crop scales |
| Mars | 4096x2048 / 85 / 439,394 | 4096x2048 / 98 / 2,560,415 | 82.8% | Nearly indistinguishable at full-map and 2x crop scales |

The image-only comparisons isolate encoding appearance, not Viewer lighting,
relief, or clouds. No cloud-free production scene was created. The user
accepted the matched Earth, Luna, and Mars albedo-only comparisons on
2026-10-12; this acceptance does not by itself establish final Stellar Viewer
sign-off.

The initial Earth Viewer review found the daylight framing unclear and clouds
obscuring close evaluation. The follow-up below records the accepted camera
change and cloud-layer review. Representative hardware/network performance
and final Stellar Viewer visual sign-off remain separate open items.

#### Overview host/child overlap and picking (2026-10-12)

The proportional and compressed overviews now apply a display-only minimum
clearance to anchored moons and stations when their projected centers would
intersect the host's visible extent. Direction is preserved where available;
compressed projection collisions use canonical relative direction only to
recover that direction. Canonical positions and backend data are unchanged.
Contextual hover/target labels identify rendered bodies, and small station
meshes receive a transparent selection shell while retaining their 5% visible
scale. Sibling bodies with the same direction are intentionally not repositioned.

Automated unit coverage validates proportional/compressed host clearance,
direction, and source-data preservation. The browser regression verifies hover
identity on Earth, Luna, and a small market station, then verifies pointer-out
clears the label. The user reviewed and accepted the live Earth/Luna and
Mars/moon separation in both modes, including the label below the distance-mode
card and clear of the contract warning. Exact-direction sibling overlaps may
remain under the user's chosen policy.

#### Earth star-facing detail review (2026-10-12)

The user approved a default planet-detail camera direction aligned with the
primary star, with the existing lighting intensities unchanged. The camera
snap now uses the primary star's scene-space direction; if no usable star
position exists, it retains the prior default angle. In the running Viewer the
camera/star direction alignment was 1.0, with the star point light still at
intensity 1.5 and zero distance falloff. The view showed substantially more
sunlit Earth terrain. The user accepted this daylight framing and confirmed
the existing cloud layer is acceptable. A clear day/night boundary is not
prominent in the star-facing view and was not a requirement for acceptance.
No light intensity or cloud setting was changed. The focused camera helper
tests, lint, and application/spec typecheck passed; final Stage 6 visual
acceptance remains on hold.

### Stage 3: catalog and shared surface loading

- [x] Introduce typed catalog/procedural request variants with source-specific
      identity and asset metadata.
- [x] Include catalog version and requested tier in source selection keys.
- [x] Include catalog version, selected texture variant, and tier in shared
      cache keys.
- [x] Introduce a shared loaded-surface result and connect source selection to
      the cache and both Viewer scenes.
- [x] Preserve deterministic procedural output for uncataloged bodies,
      including non-Sol bodies with familiar display names.
- [x] Keep stars and giant renderers outside the catalog surface path.
- [x] Load only the selected detail tier and applicable overview previews,
      rather than every quality variant or the entire Sol catalog.
- [x] Add byte-aware residency budgeting. An RGBA8 4096 x 2048 albedo with a
      full mip chain is approximately 42.7 MiB before other maps; compressed
      downloads do not generally imply compressed GPU allocation.
- [x] Define shared texture ownership, renderer-context behavior, eviction,
      late-load cancellation/disposal, and safe route re-entry.
- [x] Retain a valid lower-resolution catalog texture on detail-load failure
      and expose a logged, localized warning and retry.
- [x] For initial catalog-load failure, show an explicit failure state; do not
      silently replace recognizable terrain with random procedural geography.
- [x] Make loading progress cover both downloads and procedural work honestly,
      without representing asset-count progress as byte progress.

#### Stage 3 initial identity and selection slice (2026-10-08)

The authoritative contract was refreshed using cache-busting timestamp query
parameters and `Cache-Control: no-cache, no-store` / `Pragma: no-cache` on every
successful request. The root
`http://localhost:3000/openapi.yaml?t=1791491270729` returned HTTP 200 (29,149
bytes). The relevant solar-system and celestial OpenAPI documents returned
HTTP 200 at
`/openapi/solarsystem/openapi.yaml?t=1791491380514` (17,616 bytes) and
`/openapi/celestial/openapi.yaml?t=1791491380514` (19,856 bytes). The refreshed
catalog identity schema and body response/upsert schemas also returned HTTP 200. The schema specifies an optional nullable object with exactly the required
string fields `namespace` and `key`, no additional properties, and lowercase
token syntax. The root rules confirm that unknown valid pairs are allowed and
must remain procedural.

`CatalogIdentity` is now typed and propagated on solar-system viewer bodies,
celestial-body list items, and upsert entities, preserving both omitted and
explicit-null states. The Viewer surface resolver exposes a discriminated
catalog/procedural selection request. Catalog selection uses only exact
namespace/key equality for `sol/earth`, `sol/luna`, and `sol/mars`, mapped to
`earth-july-v2`, `luna-v3`, and `mars-v2`; versions and requested LOD are part
of the selection key. It does not infer identity from display names, entity
IDs, system IDs, classification, aliases, or `visualization.textureKey`.
Unsupported or absent identities keep the existing procedural request;
ineligible star and giant bodies do not enter this path.

At that initial checkpoint this was selection/type groundwork only. The
following approved implementation connects the cache and both Viewer scenes.
Preparation-time manifest statements describing non-deployed candidates are
historical provenance; their image bytes/hashes have not changed.
Limited sampled fine registration was subsequently accepted on 2026-10-11
with exclusions and uncertainty limitations, as recorded above. Polar
boundary/detail-loss review remains unfinished; final Stellar Viewer visual
acceptance remains on hold.

#### Stage 3 loading and initial Stage 4 integration (2026-10-08)

Before implementation, the user selected Earth-only catalog clouds now and
approved a shared catalog-cache cap of **96 MiB standard / 32 MiB low**.
These are conservative RGBA8/full-mipmap allocation estimates, not measured GPU
bytes, and are separate from the unchanged procedural cache limits.

- [Angular assets](../angular.json) allowlist exactly the five runtime image
  files in each selected version, mapped to `textures/sol/<asset-version>/`.
  Production inspection found exactly 15 images. Manifests, older versions,
  originals, Python tooling and diagnostic evidence are not deployed.
- [Catalog loader](../src/app/scene/planet/catalog-surface-loader.ts) uses the
  existing Three `TextureLoader`: sRGB albedo, linear normals, north-up
  `flipY=true`, periodic longitude and clamped latitude. File dimensions are
  validated before publication. Partial failures dispose owned textures.
  No new dependencies, KTX2 codecs or invented material channels were added.
- System bodies and companion moons request 512 x 256 previews only. Focused
  catalog bodies request a preview plus one low/standard set. The shared
  width/core/save-data policy uses full-window width and the core fallback of 4. Resize re-evaluates it; renderer texture limits can lower 4K to 2K, and
  an insufficient 2K limit is reported explicitly while retaining a valid
  preview. Luna's accepted standard normal stays 1024 x 512, not 2048 x 1024.
- [Catalog cache](../src/app/scene/planet/catalog-surface-cache.ts) keys contain
  exact namespace/key, asset version, variant and requested LOD. Entities with
  the same astronomical identity may share immutable imagery without sharing
  entity IDs, navigation or selection. Incoming loads reserve estimated bytes;
  LRU eviction only disposes unleased entries. Admission failure preserves
  pinned textures and reports an error rather than exceeding the budget.
- Both scenes retain their requested catalog textures with effect-lifetime
  leases, including preview/lower-tier fallbacks. Leaving the final consumer
  logically cancels pending work; stale completions are disposed and cannot
  repopulate the cache or supersede a fresh route-entry request. Three's image
  transport may finish after navigation: it is not a network-abort promise.
  Regular image textures can upload into a new renderer; unlike procedural GPU
  render targets, they do not contain dead cross-context render-target handles.
  Repeated renderer uploads can have driver-specific allocations; the estimates
  are not measured aggregate GPU memory across simultaneously live contexts.
- Detail failure retains a valid preview/low surface, logs the failure and
  exposes localized retry. Initial imagery failure shows a neutral gray
  placeholder and an explicit warning, never random procedural geography.
  Unsupported identities and excluded body classes retain existing behavior.
- Catalog loading reports pending **texture sets**, not byte percentages.
  The existing determinate progress bar remains specific to procedural work.
- Base terrain tint is white and non-hover catalog emissive is neutral; existing
  transient emissive highlights remain. Earth retains procedural clouds;
  Luna/Mars have none. Source/team credits, citations, safe external links,
  coverage/color interpretation and the outstanding review limitations appear
  in a collapsible localized sources panel in both views.

Focused browser checks exercise actual material maps, low/standard selection,
same-origin requests, clouds, detail failures/retry, neutral placeholders,
full-window resize and route re-entry. They establish integration correctness,
not landmark registration, final appearance or representative hardware
performance. All Stage 2 limitations and the Stage 6 acceptance hold remain.

#### Portable headless correctness baseline

The user approved explicit SwiftShader software WebGL for local and Actions
Playwright runs, with one default worker and existing environment overrides
retained. The shared Playwright configuration applies this renderer even to
headed/debug runs, so reproducing a test does not silently switch GPU paths.
The application runtime renderer and splash behavior are unchanged.

A catalog browser test fails explicitly if WebGL2, SwiftShader or 4096-pixel
texture capacity is unavailable. Scene assertions wait for actual albedo/normal
dimensions and control device core count where tier selection matters; they do
not rely on fixed frame delays or the initial absence of a loading indicator.
The existing Actions workflow installs lockfile-selected Chromium and consumes
this configuration; no new browser engine or CI-only configuration is needed.
See [testing policy](testing-policy.md) for flags, worker overrides and scope.

This is a portable correctness baseline, not proof of Linux runner success,
real-GPU appearance, cold-network behavior or achieved frame-rate/memory budgets.
GitHub Actions execution and real-device measurements must be recorded separately.

An additional local run, `npm run e2e:spec -- viewer-planet-surfaces.spec.ts
--workers=1 --repeat-each=2 --retries=0`, passed **21 tests**: setup once and
all 10 surface scenarios twice, with no retries. This confirms the one-worker
baseline in the current Windows environment; it does not establish a long-term
flake rate or replace the pending Actions/Linux execution.

### Stage 4: viewer presentation and attribution

- [x] Integrate catalog surfaces consistently in system view and body detail,
      including selected moons and companion-moon previews.
- [x] Keep normal/material maps optional; do not fabricate unsupported channels.
- [x] Add active-pilot atmosphere policy: Earth cloud layer, no terrestrial
      clouds on Luna/Mars. Unsupported bodies retain their existing behavior.
- [x] Approve dedicated Venus/Titan atmosphere expansion. The user selected
      both bodies and approved the static, source-faithful atmosphere-only
      treatment on 2026-10-12; implementation and final visual review remain
      tracked below.
- [x] Approve an Io surface/volcanism expansion. The user selected a visible
      surface, subtle static hotspots and short plumes, and both system overview
      and focused Io detail on 2026-10-12.
- [x] Verify and approve the USGS Galileo/Voyager color-merged mosaic as the Io
      source, contingent on meeting the existing visual and transfer budgets.
      The user approved this exact candidate on 2026-10-12 after its mixed-era
      imagery, interpolated polar gaps, and USGS attribution policy were
      disclosed.
- [ ] Complete automated Io texture/runtime checks and live visual review in
      overview and focused detail. Static project-authored cues are illustrative
      only; they are not geolocated observations or claims of current activity.
- [ ] Treat Venus/Titan radar or infrared terrain as a separately labeled
      surface-reveal mode, not ordinary visible-light appearance. Such a mode
      needs separate approval before implementation.
- [x] Implement the approved Venus/Titan atmosphere-only expansion; the user
      selected both bodies, separate atmosphere layers over neutral or obscured
      ground, both overview and focused-detail presentation with detail-scaled
      fidelity, and per-product scientific/public-source rights verification
      on 2026-10-12. Venus's CC BY 4.0 source (served as q75 WebP) and the
      original static Titan haze (retargeted to the Cassini PIA06230 tan) are
      wired in both views. Automated checks pass, and the user visually
      accepted both bodies in overview and focused detail on 2026-10-12.
      Hidden-surface reveal modes remain deferred.
- [x] Verify material tint/emissive/highlight behavior does not permanently
      recolor the familiar terrain. Catalog tint is white and idle emissive is
      neutral; overview target highlighting returns to neutral when cleared.
      Focused-detail base values are covered for Earth/Luna/Mars, and the user
      confirmed the transient hover highlight clears to the same accepted,
      cloud-covered appearance on 2026-10-12.
- [x] Prevent visible host-child overlap for anchored moons and stations in
      proportional and compressed overviews without changing canonical
      positions. Preserve orbital direction, provide contextual hover/target
      identity, and keep small station meshes selectable. Automated coverage
      passes and the user accepted the live overview presentation on
      2026-10-12; exact-direction sibling overlaps can remain.
- [x] Generate selected-body source links through
      [ExternalAnchorsComponent](../src/app/component/external-anchors.ts).
- [x] Add fuller provenance, color interpretation, and coverage notes in a
      "Surface sources" section. Preserve exact team credits.
- [x] Localize new labels, loading/errors, and coverage notes in both
      [English](../src/app/i18n/locales/en.ts) and
      [Italian](../src/app/i18n/locales/it.ts).
- [x] Leave splash code, splash asset selection, and splash behavior unchanged.

#### Venus/Titan expansion decisions (2026-10-12)

Approved scope:

- Include both Venus and Titan, beginning with atmosphere-covered presentation.
- Render atmosphere as a separate layer over neutral or obscured ground.
- Cover system overview and focused body detail, scaling fidelity as needed.
- Use a source-faithful visible-light target: dense pale cream/yellow Venus
  clouds and Titan's muted butterscotch-tan haze, with the ground hidden; begin with static
  layers and no animation or user controls.
- Research scientific/public sources and verify rights for each selected
  product before recommending or using it. Public-domain or clearly reusable
  sources with required attribution are acceptable; do not use uncleared assets.
- Defer Venus radar and Titan infrared surface-reveal modes; do not implement
  them as part of this atmosphere-only work.

Source research found a map-suitable Venus atmosphere texture from Solar
System Scope, offered under CC BY 4.0 with attribution. The user approved its
use on 2026-10-12; its page describes a stylized derivative from NASA
elevation/imagery without a file-by-file provenance chain. Attribute the asset
to Solar System Scope, not NASA, and retain the provenance caveat.
Research did not find a rights-cleared, map-suitable visible-light Titan haze
texture. A Cassini ISS true-color Titan image is a single-disk photograph, not
a globe map; NASA Photojournal's Titan mapping example is explicitly
false-color infrared surface data and is out of scope. Do not use either as a
wrapped Titan haze map.

On 2026-10-12 the user approved proceeding with the Venus Solar System Scope
CC BY 4.0 candidate and a project-authored static Titan haze rather than
wrapping a non-map photograph or using hidden-surface infrared data. Record
Solar System Scope attribution and the CC BY 4.0 license with the Venus asset;
the Titan haze is original project artwork. Acceptance requires automated
tests plus the user's live review of overview and focused detail for both
bodies. This source approval is not final visual acceptance.

During live review on 2026-10-12 the user flagged the first Titan haze as too
orange next to the Cassini ISS true-color disk
[PIA06230](https://assets.science.nasa.gov/dynamicimage/assets/science/psd/solar/2023/09/PIA06230.jpg).
Sampling that image's lit disk gave a median near `rgb(155, 129, 68)` (hue
about 40 degrees), while the first palette's midpoint was about
`rgb(211, 107, 44)` (hue about 22 degrees). The haze was retargeted to a muted
butterscotch-tan ramp from `rgb(124, 96, 40)` to `rgb(200, 166, 80)`, with
lower procedural contrast and a gentle darker northern hemisphere. PIA06230 is
used only as a color reference; no NASA pixels are wrapped or shipped. A unit
test bounds the mean green/red and blue/red ratios to that reference.

Per the project's WebP decision for catalog maps, the Venus runtime files are
lossy WebP re-encodes of the Solar System Scope JPEGs (sharp 0.34.5 / libwebp
1.6.0, effort 6). The smallest of q75/80/85/90/95/98 meeting the 40 dB PSNR
floor was q75 for both tiers: 2K 229,696 -> 23,660 B (44.22 dB) and 4K
1,546,146 -> 67,858 B (43.69 dB). The original JPEGs, encoding report, and
script are retained outside the runtime folder in the session artifact store;
source URLs, byte counts, and hashes for both originals and WebPs are in the
asset record. PSNR is an offline check, not visual acceptance.

#### Io expansion decisions and derivative (2026-10-12)

Approved scope:

- Add Io's visible-light surface in system overview and focused detail.
- Add small, static, project-authored hotspot/plume cues. They have no labels or
  animation and are illustrative, not a geologic site dataset or report of
  current activity.
- Use the USGS Astrogeology Science Center's _Io Galileo SSI / Voyager Color
  Merged Global Mosaic 1km_, with USGS attribution. The user approved this
  candidate after the source's mixed-era imagery and coverage limitations were
  disclosed.
- Do not invent Io relief, normal, or material maps. The selected source
  supplies color imagery only.

The official USGS product page identifies USGS Astrogeology Science Center as
primary author and provides the 1 km merged GeoTIFF. USGS's copyrights-and-
credits guidance says USGS-produced data are generally U.S. public domain and
requests appropriate credit; no product-page third-party copyright notice was
found. The mosaic applies Galileo SSI color ratios to higher-resolution
monochrome Galileo/Voyager imagery. Resolution, illumination, and coverage
vary; the color mosaic lacks coverage within about 5 degrees of each pole,
with polar fill/interpolation in the merged product. These limitations are
included in Viewer attribution. The original 196,637,696-byte GeoTIFF and its
SHA-256 remain in session artifact storage, not the repository or deployed
assets; the pinned source record is
[`io.json`](../tools/sol-textures/source-manifests/io.json).

The source's single all-zero north-edge scanline was filled from its adjacent
row before filtering, consistent with the source page's polar interpolation
disclosure. Three sRGB-display-assumption WebP albedos were generated at
512x256, 2048x1024, and 4096x2048 using Python 3.15.0, rasterio 1.5.2 /
GDAL 3.12.2, and NumPy 2.5.3. The smallest-byte tested quality meeting the
existing 40 dB PSNR floor was q95 preview (46,222 B / 40.73 dB), q90 low
(256,776 B / 41.11 dB), and q80 standard (364,298 B / 40.32 dB). Selected
preview-plus-tier transfer is 302,998 B low and 410,520 B standard; estimated
RGBA8 mipmapped residency is 11,883,862 B low and 45,438,294 B standard.
These meet the existing 2/4 MiB transfer and 32/96 MiB residency targets.
Quality/budget checks are not perceptual or hardware acceptance.

The derivative manifest records per-file hashes, quality candidates, source
details, and exact tool versions in
[`io-v1`](../assets/sol-textures/io-v1). Runtime inclusion is allowlisted to
the three WebP files; the manifest, original GeoTIFF, and working rasters are
not deployed. The runtime loader intentionally requests no Io normal map.

Verification:

- `npm run typecheck`, `npm run build`, and `npm run lint` passed.
- Focused Vitest coverage passed: 49 tests across the catalog loader, cache,
  texture cache, and volcanism layer.
- `python -m unittest discover -s . -p test_pipeline.py -v` passed all 15
  pipeline tests.
- The focused Io Playwright flow passed, including preview and detail texture
  loads, static cue counts, attribution, and the no-normal-map assertion.
- Production output contains exactly the three Io WebP runtime textures; the
  manifest and source GeoTIFF are not included.
- Full Python discovery ran 33 tests; the 2 failures were in
  `test_artifact_store.py` path validation, outside the Io pipeline changes.

## Candidate source register

Io is now a per-body Stage 4 addition, with live visual acceptance pending.
The remaining entries are research candidates, not commercial-use clearance
or visual sign-off. Some USGS product pages require browser-rendered content.

| Body                                             | Source                                                                                                                                     | Qualification                                                                                                                                                                                                                                            | Priority         |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| Earth                                            | [NASA Blue Marble: Next Generation](https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/)                         | Cloud-removed monthly composites; choose one baseline month                                                                                                                                                                                              | Pilot            |
| Luna                                             | [NASA CGI Moon Kit](https://svs.gsfc.nasa.gov/4720/)                                                                                       | Color/elevation designed for rendering; updated color includes documented polar substitutions and inpainting                                                                                                                                             | Pilot            |
| Mars                                             | [USGS Viking global color mosaic](https://astrogeology.usgs.gov/search/map/mars_viking_global_color_mosaic_925m)                           | Inspect seams and residual illumination                                                                                                                                                                                                                  | Pilot            |
| Mercury                                          | [USGS MESSENGER color mosaic](https://astrogeology.usgs.gov/search/map/mercury_messenger_mdis_global_color_mosaic_665m)                    | Infrared-containing filter combination is not ordinary natural color; select/document a natural-looking variant                                                                                                                                          | Pilot            |
| Io                                               | [USGS Galileo/Voyager color-merged mosaic](https://astrogeology.usgs.gov/search/map/io_galileo_ssi_voyager_color_merged_global_mosaic_1km) | Approved for `io-v1`; verify color interpretation, mixed-era imagery and merged-image illumination; final live Viewer review pending                                                                                                                      | Stage 4 approved |
| Europa                                           | [USGS Voyager/Galileo mosaic](https://astrogeology.usgs.gov/search/map/europa_voyager_galileo_ssi_global_mosaic_500m)                      | Verify color availability, coverage, and illumination                                                                                                                                                                                                    | Expansion        |
| Ganymede                                         | [USGS color global mosaic](https://astrogeology.usgs.gov/search/map/ganymede_voyager_galileo_ssi_color_global_mosaic_1_4km)                | Mixed source resolution                                                                                                                                                                                                                                  | Expansion        |
| Callisto                                         | [USGS Galileo/Voyager mosaic](https://astrogeology.usgs.gov/search/map/callisto_galileo_voyager_global_mosaic_1km)                         | Confirm color treatment                                                                                                                                                                                                                                  | Expansion        |
| Enceladus                                        | [USGS Cassini mosaic, 2024](https://astrogeology.usgs.gov/search/map/enceladus-cassini-global-mosaic-100m-schenk)                          | Grayscale; matching elevation cataloged; avoid invented colored terrain                                                                                                                                                                                  | Expansion        |
| Tethys                                           | [USGS Cassini mosaic](https://astrogeology.usgs.gov/search/map/tethys_cassini_global_mosaic_293m)                                          | Simple-cylindrical map; inspect coverage and quality                                                                                                                                                                                                     | Expansion        |
| Pluto                                            | [USGS New Horizons mosaic](https://astrogeology.usgs.gov/search/map/pluto_new_horizons_lorri_mvic_global_mosaic_300m)                      | Uneven observed resolution/coverage; verify color separately                                                                                                                                                                                             | Expansion        |
| Charon                                           | [USGS New Horizons mosaic](https://astrogeology.usgs.gov/search/map/charon_new_horizons_lorri_mvic_global_mosaic_300m)                     | Uneven observed resolution/coverage; verify color separately                                                                                                                                                                                             | Expansion        |
| Triton                                           | [USGS Voyager 2 color mosaic](https://astrogeology.usgs.gov/search/map/triton_voyager_2_global_color_mosaic_600m)                          | Synthesized color and incomplete observations require labels                                                                                                                                                                                             | Expansion        |
| Venus                                            | [Solar System Scope planet textures](https://www.solarsystemscope.com/textures/)                                                           | User approved 2K/4K equirectangular atmosphere map under CC BY 4.0; served as q75 WebP re-encodes; source page notes NASA-derived inputs but no file-specific provenance; attribution, source and runtime hashes recorded in `public/textures/sol/atmospheres/venus-scope-v1/asset-record.json` | Special case     |
| Titan                                            | Original project-generated static haze                                                                                                    | Illustrative butterscotch-tan haze color-matched to Cassini ISS PIA06230; not a NASA or Cassini texture, and not surface data                                                                                                                            | Special case     |
| Mimas, Dione, Rhea, Iapetus, major Uranian moons | Individual products not yet verified                                                                                                       | Include only after source, rights, coverage, and quality review                                                                                                                                                                                          | Further research |

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

- [x] Station dimensions are exactly 0.05 times baseline dimensions, with
      unchanged non-station sizing, orbits, positions, and navigation.
- [x] Resolver tests cover approved Sol identities, familiar names outside Sol,
      unknown keys, and excluded body classes.
- [x] Loader/cache tests cover tier selection, deduplication, eviction, failures,
      retries, late completions, ownership, and renderer transitions.
- [ ] Attribution/coverage labels reflect the active catalog entry and locale.
- [x] Deterministic Playwright tests verify same-origin texture requests,
      readiness, overview/detail transitions, and no legacy texture hot-links.
- [x] Existing procedural parity and viewer behavior remain intact.
- [x] Run Angular build after changing templates or template-bound types.

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

Record actual commands and outcomes below. Focused texture integration evidence
is recorded in the execution log; real-device performance and final appearance
acceptance remain pending.

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
| Luna             | Repository-stored luna-v3, low/standard       | Offline decode, hashes, exact LOLA correspondence, normal and budget checks passed | On hold              | Not deployed or Viewer-integrated; fine alignment/performance pending    |
| Mars             | Repository-stored mars-v2, low/standard       | Offline decode, hashes, signed heights, normal direction and budget checks passed  | On hold              | Not deployed or Viewer-integrated; fine alignment/performance pending    |
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
| 2026-10-08 | Stage 1 contract approval | Fresh no-cache fetch of root and reference graph; identity schema checks; authenticated solar-system-get and celestial-body-list reads; user approval | Approved new optional catalogIdentity contract; 140 documents fetched; both live reads supplied all 24 identities; checked classifications and parent/anchor links matched | Supersedes initial identity blocker; Stage 3 DTO and exact selector now implemented |

| 2026-10-08 | Stage 3 contract refresh | `curl.exe` no-cache fetches of cache-busted root OpenAPI, solar-system/celestial OpenAPI modules, CatalogIdentity and body response/upsert schemas | All seven relevant documents returned HTTP 200; root 29,149 bytes; namespace/key are optional nullable exact tokens; unknown valid pairs remain procedural | Contract refreshed before implementation; cache/loader and runtime material integration remain pending |
| 2026-10-08 | Stage 3 resolver tests | `npm run test:spec -- src\app\scene\planet\planet-texture-cache.vitest.ts` | Passed: 1 file, 23 tests; exact `sol/earth`, `sol/luna`, `sol/mars` selection maps to earth-july-v2, luna-v3 and mars-v2; unknown/missing/non-exact pairs procedural; stars/gas/ice giants excluded | Integrate loading and ownership next |
| 2026-10-08 | Stage 3 typecheck | `npm run typecheck` | Passed: application and Vitest spec TypeScript checks | |
| 2026-10-08 | Stage 3 lint | `npx --no-install eslint src\app\model\catalog-identity.ts src\app\model\solar-system-get.ts src\app\model\celestial-body-list.ts src\app\model\celestial-body-upsert.ts src\app\scene\planet\planet-surface-catalog.ts src\app\scene\planet\planet-surface-resolver.ts src\app\scene\planet\planet-texture-cache.vitest.ts` | Passed | |
| 2026-10-08 | Stage 3 file paths | PowerShell `Test-Path` over all registered preview/albedo/normal files | Passed: all 15 catalog file paths exist | |
| 2026-10-08 | Stage 3 build | `npm run build` | Passed: E2E partition gate and Angular production/template build | |

| 2026-10-08 | Stage 3/4 implementation decisions | Selectable user approval: Earth-only catalog clouds; 96 MiB standard / 32 MiB low shared catalog-cache estimates | Approved and implemented; procedural limits and splash behavior preserved | Estimates are not measured aggregate GPU allocations |
| 2026-10-08 | Stage 3/4 browser stabilization | Earlier focused `npm run e2e:spec -- viewer-planet-surfaces.spec.ts --workers=1` runs | Initial retry click blocked by detail panel; corrected notice layout. Route re-entry expectation corrected because moon focus does not create browser history. Final run passed 10 tests including setup | No forced clicks or fixed waits added; portable software baseline added subsequently |
| 2026-10-08 | Stage 3/4 final unit regression | `npm run test:spec -- src\app\scene\planet\catalog-surface-loader.vitest.ts src\app\scene\planet\catalog-surface-cache.vitest.ts src\app\scene\planet\planet-texture-cache.vitest.ts src\app\scene\viewer\viewer-system-scene.vitest.ts src\app\scene\viewer\planet-view-scene.zoom.vitest.ts src\app\scene\render-quality.vitest.ts src\app\scene\mining-splash.vitest.ts` | Passed: 7 files, 127 tests | Loader/cache ownership, exact identity selection, scene behavior, quality and unchanged splash covered |
| 2026-10-08 | Stage 3/4 final typecheck | `npm run typecheck` | Passed: application and Vitest spec TypeScript | |
| 2026-10-08 | Stage 3/4 final lint | `npx --no-install eslint` with all changed/untracked TypeScript paths from `git diff --name-only` and `git ls-files --others --exclude-standard`, converted to Windows separators | Passed | Includes shared Playwright configuration and catalog browser tests |
| 2026-10-08 | Stage 3/4 final build | `npm run build` | Passed: partition gate and production Angular/template compilation | No missing dependency installs required |
| 2026-10-08 | Stage 3/4 deployed images | PowerShell `Get-ChildItem` count and `Get-FileHash -Algorithm SHA256` comparison of built `textures\sol` files against selected `assets\sol-textures` files | Passed: exactly 15 files; every deployed hash matches the selected image | Originals, superseded candidates, manifests and tools excluded |
| 2026-10-08 | Portable test policy | Selectable user approval: explicit software WebGL and one default worker everywhere | Implemented in shared Playwright configuration; existing override precedence retained | Software correctness is separate from hardware/performance and visual acceptance |
| 2026-10-08 | Portable headless regression | `npm run e2e:spec -- viewer-planet-surfaces.spec.ts planet-bake-parity.spec.ts viewer-interactions.spec.ts planet-view-zoom.spec.ts --retries=0` | Passed: 31 tests including setup, no retries; explicit SwiftShader verified. Existing session environment override selected 2 workers | Local Windows headless evidence only; GitHub Actions/Linux not executed here |

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

| 2026-10-12 | Stage 2 encoding suitability | Offline JPEG/WebP comparison for all Earth/Luna/Mars preview, low, and standard albedos using the pinned GDAL WebP driver and source-grid RGB references | 54 WebP variants encoded/decoded; selected test candidates all meet the existing 40 dB PSNR floor; all low/standard transfer totals meet caps, with 403,450-2,145,604 bytes saved per body/tier | Offline evidence only; selected JPEGs and application unchanged; actual TextureLoader/deployment and visual acceptance plus seam/orientation evidence remain pending |

| 2026-10-12 | Stage 2 closure | User accepted limited registration, polar, seam/orientation and sampled source-shadow reviews with recorded caveats; accepted matched WebP/JPEG albedo appearance for Earth, Luna and Mars; no KTX2 evaluation required | Stage 2 checklist complete and Stage 2 marked Done for the active pilot at the approved scope; no asset or production rendering changes | Earth lighting/cloud presentation, Earth/Luna overview overlap, material tint/emissive review, representative performance and final Viewer acceptance remain separate open gates |

| 2026-10-12 | Stage 4 material tint/emissive/highlight review | `npm run e2e:spec -- e2e/tests/viewer-planet-surfaces.spec.ts -g "keeps catalog albedo tint neutral"` passed; `npm run typecheck` passed; user inspected focused Earth hover and confirmed the highlight clears | Catalog tint remains white; overview target emissive returns to neutral after clearing; focused-detail Earth/Luna/Mars retain neutral base material values. User accepted the current cloud-covered Earth appearance and confirmed hover restoration in the live Viewer | This Stage 4 checklist item is closed; Earth/Luna overview overlap, representative performance, and final Viewer visual acceptance remain separate open gates |

| 2026-10-12 | Stage 4 overview overlap implementation and visual review | Focused Viewer scene unit tests passed; `npm run e2e:spec -- e2e/tests/viewer-planet-surfaces.spec.ts -g "shows identity on hover"` passed (2 tests); `npm run typecheck` passed; user accepted the live layout | Display-only host clearance in both distance modes; distinct Earth, Luna, and station hover identities plus pointer-out clearing verified; canonical body positions unchanged; live Earth/Luna and Mars/moon separations visually accepted in both modes | Exact-direction sibling overlap remains possible by design; representative performance and final Viewer sign-off are still separate gates |

| 2026-10-12 | Stage 4 Venus/Titan atmosphere implementation | Solar System Scope product page and CC BY 4.0 reviewed; Titan NASA Photojournal infrared surface imagery excluded; focused unit/build/typecheck/E2E checks passed | Venus 2K/4K atmosphere maps downloaded with SHA-256 records; static original Titan haze generated at view-appropriate detail; ground mesh hidden; both overview and focused detail covered; source/license disclosure wired into Viewer and localized | User must visually review both bodies in both views; texture provenance is credited to Solar System Scope, not NASA; Titan haze is illustrative and project-authored |

| 2026-10-12 | Stage 4 Titan color retarget and Venus WebP | PIA06230 lit-disk color sampled; Venus WebP quality sweep q75-q98 with PSNR vs decoded source | Titan palette retargeted from red-orange to reference-matched tan with a ratio-bounded unit test; Venus runtime switched to q75 WebP (2K 23,660 B / 44.22 dB; 4K 67,858 B / 43.69 dB), JPEG originals archived outside runtime | User visually accepted Titan and Venus in overview and focused detail; Stage 4 atmosphere implementation item closed. Radar/infrared surface-reveal mode remains deferred |

Add dated rows for implementation, rights clearance, measurements, automated
results, and user visual decisions. Keep failed checks and deferred assets visible
until their resolution is recorded.
