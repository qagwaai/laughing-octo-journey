# Rebuilding the Sol texture pilot

This is a local, explicit-source pipeline, not a Viewer catalog loader. It
reconstructs the approved October 2026 Earth/Luna/Mars candidates; Mercury is
excluded. Originals, environments, working rasters and diagnostic output must
stay outside Git and deployed assets in the configured external artifact store.
Prepared selected maps belong in
`assets/sol-textures/<new-version>` until separate deployment/integration approval.

Python creates `__pycache__` folders containing compiled `.pyc` files when
scripts/tests run. They are disposable local caches and are ignored by Git,
along with `.pyo` files and conventional `.venv`/`venv` environment folders.
Keep `.py` scripts, `requirements.txt`, source manifests and selected derivative
maps in Git. Virtual environments, originals and intermediate/evidence outputs
still belong in the external artifact store; ignore rules are not a replacement
for that storage policy.

See the [source audit and decisions](../../docs/sol-textures-2026-10-08.md) and
the per-version manifests in [assets/sol-textures](../../assets/sol-textures).
The manifests include rights, attribution, coverage, interpretation, actual
bytes and SHA-256; registry identity does not itself approve imagery.

**Current selected versions (2026-10-08):** Earth `earth-july-v2`,
Luna `luna-v3`, Mars `mars-v2`. The user accepted the current geodesic polar
normal appearance and authorized promotion for both Luna/Mars tiers. These
remain non-deployed sets; fine registration and final Stellar Viewer acceptance
are separate pending gates. Prior `luna-v2`/`mars-v1` sets are retained.

## What is repeatable

- [pipeline.py](pipeline.py): explicit acquisition, source-hash verification,
  all three approved processing recipes, full output decoding/hash/budget
  verification, and optional byte-identical comparison.
- [source-manifests](source-manifests): retained acquisition evidence,
  including exact URLs, original sizes, hashes and retrieval dates. The
  additional signed LOLA reference IMG is pinned in the pipeline.
- [requirements.txt](requirements.txt): direct Python dependencies pinned to
  the versions used. `affine` is explicitly pinned because the code imports it.
- [diagnostic](diagnostic): landmark crops and an isolated, loopback-only
  Three.js harness, plus a Playwright GPU-check/screenshot runner. JavaScript
  tooling comes from the repository's existing locked npm dependencies.
- [test_pipeline.py](test_pipeline.py): Python raster-tool unit tests, separate
  from the application's Vitest tests; neither tool uses Jest.

All **15 selected images were reproduced byte-for-byte** from the retained
originals with the repository pipeline on Windows, Python 3.14.5,
rasterio 1.5.2/GDAL 3.12.2 and NumPy 2.5.3. Metadata/script hashes can differ;
the comparison checks image hashes, not manifest equality.

This is not a promise of identical JPEG bytes under a different GDAL build,
operating system or encoder. Preserve the known environment/wheel installers
externally if bit-for-bit reproduction is critical. A future source URL may
disappear or return changed bytes: the tool fails instead of silently accepting
different science products. The audited originals/notices and selected evidence
have now been copied to the approved external artifact store, independently of
session storage. That local store still needs a separate backup for disk loss.

## Set up external working storage

Approved local layout:

```text
D:\at-template\artifacts\laughing-octo-journey\sol-textures\
  artifact-inventory.json        archived-file bytes and SHA-256
  sources\earth\                 originals, NASA/NOAA notices and headers
  sources\luna\                  originals, signed LOLA reference and notices
  sources\mars\                  originals, PDS labels and notices
  evidence\2026-10-08\            source audits and selected diagnostics
  work\<body>\                   regenerable processing files
  rebuilds\<new-version>\        optional external comparison outputs
  environments\                 recreate locally; never copy a venv between machines
```

This project-specific Sol store does not define or migrate unrelated artifact
types. The October archive contains **147 files / 1,289,624,563 bytes**.
Copies were verified against audited source hashes and a complete archive
inventory; retained session copies were not deleted. Excluded: Python venv/
bytecode, superseded/failed derivatives, incomplete or duplicate diagnostic
runs, Forge contract artifacts and unrelated files.

The migrated store was then used to rebuild all 15 candidate images
byte-identically and regenerate nine landmark sets without reading session
source paths. Seventeen tool tests passed, including restore to a different
root and explicit corruption/overwrite rejection. A fresh environment on
another machine was not installed/tested; follow the pinned setup below.

Example PowerShell configuration; on another environment choose a different
dedicated external root with the same logical layout:

```powershell
$repository = (Get-Location).Path
$artifactRoot = 'D:\at-template\artifacts\laughing-octo-journey\sol-textures'
$env:SOL_TEXTURE_ARTIFACT_ROOT = $artifactRoot
$sourceRoot = Join-Path $artifactRoot 'sources'
$workRoot = Join-Path $artifactRoot 'work'
$env:PYTHONDONTWRITEBYTECODE = '1'

# Python 3.14.5 was validated; use a compatible binary-wheel environment.
python -m venv (Join-Path $artifactRoot 'environments\python-3.14')
$python = Join-Path $artifactRoot 'environments\python-3.14\Scripts\python.exe'
& $python -m pip install --only-binary=:all: -r tools\sol-textures\requirements.txt
```

`--artifact-root` overrides `SOL_TEXTURE_ARTIFACT_ROOT`. There is no
machine-specific path default in code. Preparation resolves sources to
`sources\<body>` and working files to `work\<body>`; legacy explicit
`--source-dir`/`--work-dir` remain supported. Landmark preparation accepts the
same root. No originals, local environments or archive inventory enter Git.

Reuse an existing compatible environment instead of reinstalling it. If binary
wheels are unavailable, stop and document the environment difference rather
than falling back to an unreviewed GDAL source build. No Python packages are
required by the Angular application.

## Restore the store on another development environment

Preferred: transfer the verified archive/backup intact (including
`artifact-inventory.json`), then run the inventory check. If the backup is
available as a local or mounted folder, the tool can copy it into a new root:

```powershell
# Use paths appropriate to the other environment. Destination must not exist.
& $python tools\sol-textures\artifact_store.py restore `
  --from-root 'E:\backups\laughing-octo-journey\sol-textures' `
  --artifact-root $artifactRoot
& $python tools\sol-textures\artifact_store.py verify --artifact-root $artifactRoot
```

Create the Python environment outside the restore destination first, or use
an already available compatible Python; the restore command is standard-library
only and does not need raster packages. After restore, create the local
environment under `environments` if desired. Verification checks immutable
archived files, not regenerable work/environment additions.

If no archive is available, explicit acquisition below restores the approved
rasters from pinned URLs. `--include-notices` additionally attempts historical
labels/rights pages using their pinned hashes. Live HTML may have changed, so
this can fail even if raster downloads succeed; do not silently replace historic
evidence. Obtain a backup or conduct a new source/rights review. Historic audit
reports/screenshots cannot be fetched from providers: regenerate current
diagnostics and keep newly dated evidence. Source acquisition is not a complete
restoration of the 2026 archive inventory.

The session-to-store migration used:

```powershell
& $python tools\sol-textures\artifact_store.py archive-session `
  --session-files $retainedSessionFiles --artifact-root $artifactRoot
```

It copies only the documented Sol scope, refuses an existing destination,
hash-verifies each copied file and never deletes session originals.

## Acquire or restore approved originals

Arrange source files in `$sourceRoot\earth`, `\luna` and `\mars`. You may restore
the audited originals there instead of downloading. Acquisition is never
triggered implicitly by preparation:

```powershell
& $python tools\sol-textures\pipeline.py fetch earth --artifact-root $artifactRoot
& $python tools\sol-textures\pipeline.py fetch luna --artifact-root $artifactRoot
& $python tools\sol-textures\pipeline.py fetch mars --artifact-root $artifactRoot
# Optional pinned historical notices/labels, not automatically current-rights review:
& $python tools\sol-textures\pipeline.py fetch mars --artifact-root $artifactRoot --include-notices
```

These commands download only required hash-pinned rasters (including the signed
LOLA reference), not every notice page in the acquisition records. Existing
originals are verified, never overwritten. Each new acquisition is first written
to a distinct `.partial` file, then checked and renamed; failed/incomplete or
changed downloads stay explicitly partial. Inspect any failed partial before
targeted removal/retry. Core original rasters total approximately 1.3 GB;
Mars processing needs additional space for a roughly 3.2 GB float working raster.

For a refreshed **2027** product, first re-review current source pages, rights,
credits, coverage, color interpretation, frame/georeferencing and available
labels. Keep that evidence and obtain approval before changing pinned records,
recipes or caps. Do not simply replace a hash after a mismatch. This workflow
does not crawl the Forge contract; a later integration review still uses fresh
cache-busted OpenAPI.

## Rebuild to new versioned paths

```powershell
& $python -m unittest discover -s tools\sol-textures -p 'test_*.py' -v

& $python tools\sol-textures\pipeline.py prepare earth `
  --artifact-root $artifactRoot `
  --output (Join-Path $artifactRoot 'rebuilds\earth-july-rebuild-2027')

& $python tools\sol-textures\pipeline.py prepare luna `
  --artifact-root $artifactRoot `
  --output (Join-Path $artifactRoot 'rebuilds\luna-rebuild-2027')

& $python tools\sol-textures\pipeline.py prepare mars `
  --artifact-root $artifactRoot `
  --output (Join-Path $artifactRoot 'rebuilds\mars-rebuild-2027')

& $python tools\sol-textures\pipeline.py verify `
  --output (Join-Path $artifactRoot 'rebuilds\earth-july-rebuild-2027') `
  --compare assets\sol-textures\earth-july-v2
```

Use the corresponding `luna-v3`/`mars-v2` comparison paths for those bodies.
Output directories must not already exist. Run bodies serially if sharing the
same working folder. Errors are explicit, not success-shaped fallback outputs.
After successful review, copy selected maps/manifests into a new repository
asset version; do not promote every test rebuild into Git.
Do not use a folder containing originals as output. On failure, partial derivative
directories remain for inspection and must not be promoted; successful directories
contain five maps and a manifest. Working files are deleted only after successful
color encoding. Only selected reviewed versions should be kept in Git.

Recipes preserve the approved decisions:

- Earth: July BMNG; sRGB display assumption; linear-light averaging; JPEG98;
  20x20 GLOBE reduction with land-fraction weighting; only `-500` is ocean;
  derived documented tile bounds including the D-header discrepancy; neutral
  ocean/coastal-gradient cells; 1K/2K normals.
- Luna: December 2025 RGB16 with verified sRGB; LOLA
  `(uint16-20000)*0.5` metres; exact reference correspondence; no second roll of
  the rendering TIFF; JPEG98 preview/low, JPEG95 standard; 1K normals for both
  tiers after the original standard-set budget failure.
- Mars: actual Viking transform converted at its source sphere radius, not an
  Earth-datum or MDIM-to-IAU2000 transformation; neighbor-only missing-edge fill;
  signed big-endian MOLA with valid zero/negative heights; half-globe roll;
  JPEG98 and 1K/2K normals; no Earth water mask.
- All normals: physical-scale slopes at the body's reference radius, no
  exaggeration; periodic longitude derivatives and neutral outermost pole rows.
  Luna v3/Mars v2 additionally use the accepted geodesic treatment from
  [polar_normals.py](polar_normals.py): original-DEM spherical equal-distance
  neighbors, step pi / normal height, bilinear pixel-center sampling,
  smoothstep slope blend from 85 to 87 degrees, unchanged baseline bytes
  at latitudes <=85 degrees in magnitude. Geodesic PNGs retain the trial's
  default PNG compression to reproduce the accepted bytes.
  Acceptance is a visual choice, **not proof of artifact-free poles**.
- Budgets: selected tier plus one preview, <=2/4 MiB transfer and <=32/96 MiB
  estimated RGBA8 mipmapped residency. This is not total application GPU memory.

The existing manifests are used as audited attribution/interpretation templates.
Keep them available. Any genuinely changed recipe/source needs updated provenance,
fresh comparisons and visual review, not an “exact rebuild” label.

## Paired landmark and renderer diagnostics

Generate external, new crop/evidence directories:

```powershell
& $python tools\sol-textures\diagnostic\prepare_landmarks.py `
  --artifact-root $artifactRoot `
  --output (Join-Path $workRoot 'landmarks-2027')

node tools\sol-textures\diagnostic\server.mjs `
  --landmarks (Join-Path $workRoot 'landmarks-2027') --port 43187
```

In another shell, while the foreground server is running:

```powershell
node tools\sol-textures\diagnostic\run-checks.mjs `
  --url http://127.0.0.1:43187 `
  --output (Join-Path $workRoot 'renderer-evidence-2027')
```

The screenshot output folder must be new and its parent must exist.
Use the installed Playwright browser; if it is missing, use the repository's
documented browser-install command. Stop the foreground server when finished.
It serves only explicitly enumerated candidate maps, landmarks and installed
Three.js modules on `127.0.0.1`, never the original-source directory.

For a new asset version, explicitly update the diagnostic version lists in
[server.mjs](diagnostic/server.mjs) and [diagnostic.js](diagnostic/diagnostic.js)
to the selected candidates; no automatic “latest folder” substitution.

GPU checks cover full Three.js upload conventions, linear-vs-sRGB samples,
default TextureLoader flipY, normal-channel light response, neutral Earth water
samples, supported dimensions, 36 body/tier/view render cases and repeated owned
texture disposal. The runner records the actual browser/GPU, requests software
SwiftShader for deterministic correctness checks, and captures 39 images.
It measures **neither hardware performance nor actual Angular Viewer behavior**.

Landmark panels share a geographic grid: color, display-only 8x hillshade, and
color with contours. Upsampled panels do not create new source detail. Earth
yellow coast boundaries and cyan elevation contours are inspection aids,
not automated displacement fits. Review source-vs-source morphology, then
candidate-vs-source and sphere appearance before accepting fine co-registration.
Do not infer registration from unrelated albedo/topography correlation, nor
apply arbitrary global shifts to compensate for local source-frame differences.

Current diagnostics show qualitative landmark agreement but no quantified
sub-texel co-registration guarantee, and a visible Luna north-pole radial
pinching pattern. Corrective treatment requires a separate approved version.
Final Stellar Viewer acceptance remains on hold.

### Polar root-cause controls

Keep the same loopback server running for the browser controls:

```powershell
& $python tools\sol-textures\diagnostic\probe_poles.py `
  --artifact-root $artifactRoot `
  --output (Join-Path $workRoot 'polar-source-review-2027')

node tools\sol-textures\diagnostic\run-pole-checks.mjs `
  (Join-Path $workRoot 'polar-render-review-2027')
```

Both outputs must be new external directories. The browser runner uses port
43187 and records 32 standard-tier, 288-segment, exact-pole closeups:
two bodies, two poles, albedo/no-normal/flat-normal/relief, and mipmapped/nearest
filtering. The source probe verifies original hashes, projects original and
candidate color strips, records height-row and encoded-normal statistics, and
lights original-resolution/candidate physical normals using independent CPU
world tangent axes. CPU relief still uses the existing normal recipe and RGB8
quantization; it is not an independent scientific reconstruction.

The October investigation found radial structure before Three normal mapping:
in original color polar projections and original-resolution DEM-derived CPU
relief. Candidate polar sampling and filtering also change its appearance.
No-normal/flat-normal controls are visually smooth (within one output byte).
Thus neither tessellation nor a Three tangent bug alone explains the patterns.
This does not establish which source variations are real terrain versus
provider interpolation, nor isolate every contribution of resampling, tangent
interpolation and mip filtering. No correction or selected asset change is
approved by running these controls.

### Normal-only comparison experiments

These experiments are not selected assets. Generate them to a new external
folder, then start the diagnostic server with explicit experiment access:

```powershell
& $python tools\sol-textures\diagnostic\experiment_poles.py `
  --artifact-root $artifactRoot `
  --output (Join-Path $workRoot 'polar-normal-experiments-2027')

node tools\sol-textures\diagnostic\server.mjs `
  --landmarks (Join-Path $workRoot 'landmarks-2027') `
  --experiments (Join-Path $workRoot 'polar-normal-experiments-2027')

# In another shell:
node tools\sol-textures\diagnostic\run-pole-checks.mjs `
  (Join-Path $workRoot 'polar-normal-comparison-2027') --experiments
```

The recipe writes eight normal PNGs (two bodies/two tiers/two variants), a
hash/budget manifest and 16 CPU cap images. Outside +/-85 degrees, selected
normal bytes are preserved exactly; albedo and originals are never rewritten.
The angles are explicit experimental settings, not accepted production policy.

- `geodesic`: equal physical-distance east/north finite differences on the
  original DEM sphere, with an angular step of pi / target normal height.
  Bilinear source sampling wraps longitude and clamps latitude at pixel centers.
  Blend decoded slopes with baseline from 85 to 87 degrees using smoothstep.
  This changes the sampling footprint and can soften legitimate fine relief.
- `transition`: smoothly reduce baseline slopes from 85 degrees to zero at
  90 degrees. This intentionally attenuates real relief as well as artifacts.
- Both retain the neutral outer-row convention, physical body radius and RGB8
  tangent normal encoding; no scientific pole elevation is invented.

The experiment browser runner captures 144 cases: both tiers, baseline and
two trials, both poles at close range, front/seam overviews, gray and albedo
relief, and nearest/mipmapped polar filters. Compare visual trade-offs; successful
rendering or pixel differences alone do not establish improvement.
October trials suggest geodesic reconstruction is more promising, especially
for Mars, but Luna radial structure and source albedo pinching remain. Neither
trial is promoted or a complete pole correction. Final Viewer acceptance is
still on hold.

User decision on 2026-10-08: retain `geodesic` as the leading candidate for
Luna/Mars boundary and detail-loss review. Review the 85-to-87-degree blend
band, source/baseline feature preservation, both poles/tiers and filtering
before requesting promotion. `transition` remains comparison evidence.
This decision does not accept the experimental angles, replace selected maps
or release the final Viewer acceptance hold.

**Superseding decision:** the user subsequently gave final acceptance of the
current geodesic appearance and explicitly authorized new versioned sets.
`pipeline.py prepare luna|mars` now reconstructs Luna v3/Mars v2 from originals,
including the exact accepted geodesic normals. The boundary/detail-loss review
was unfinished at acceptance and remains a documented limitation, not a hidden
completed test. The transition treatment is not selected.
Historical experiment/probe commands deliberately continue reading the retained
pre-geodesic versions. The browser harness defaults to current selected sets;
explicit `baseline` comparisons use the pre-geodesic normals. Run experimental
comparisons only with the server's `--experiments` folder configured.
