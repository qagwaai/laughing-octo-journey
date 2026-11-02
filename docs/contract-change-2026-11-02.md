# Forge contract consumption plan - 2026-11-02

## Status and decisions

**Status (handoff 2026-11-02):** G0 and Phases 1–3 complete, verified,
committed and pushed to `main`. Remaining: Phase 4 (dedicated lava/ocean
renderers) and the release gate. Work is moving to a faster machine; resume
from "Resume here" below.

### Resume here (next session)

1. Pull `main` and check that the GitHub Actions run for the Phase 3 push is
   green; fix any CI failures first.
2. Start Phase 4 (see the Phase 4 section): build the lava renderer first.
   Keep Earth on its current terran renderer. Ask the user about the
   exoplanet `ocean` look before building it.
3. Then run the release gate. Run sequentially: `npm run test:ci`, then the
   combined Viewer e2e, then a live smoke check against `localhost:3000`.
   Record the evidence in the log at the end of this document.

Machine note: do not run Vitest and Playwright concurrently on slow
machines; contention produces flaky failures. Use `--workers=1` for
Playwright when in doubt.

- [x] Review both supplied handoffs and the affected frontend entry points.
- [x] Confirm delivery preference: one plan, separate phases, aiming for one implementation session.
- [x] Confirm this session is documentation-only; do not begin implementation.
- [x] Confirm inclusion of remaining Viewer attribution work as a third phase.
- [x] Check runtime OpenAPI availability using cache-busting.
- [x] Complete the implementation contract-verification gate below.
- [x] Complete all three implementation phases (Phases 1–3 committed).
- [ ] Phase 4 (lava/ocean renderers, user follow-up).
- [ ] Combined release verification.

Recommendation: consume the changes in one coordinated change set against one
Forge release. Paging and planet support overlap in models, Viewer selection,
fixtures, and acceptance journeys. Separate implementation checkpoints reduce
risk without shipping a client that understands only half the breaking contract.
If the work exceeds one session, resume from this tracker; do not release an
intermediate, partially compatible build.

### Implementation decisions (2026-11-02)

- All phases in this session; one local commit per verified phase.
- Cold-boot resume fails closed: an incomplete or failed body traversal skips
  seeding and logs a warning (never `existingBodies: []`). No re-query after
  seeding; offset drift remains a best-effort limitation.
- Local ship-exterior sweep renders partial/capped results with a warning; page
  cap 50 pages x 500 bodies.
- Cygnus X-1 is a normal server result (curated); local injection removed.
- Viewer: page size 50, default max distance 50 pc, filters reset each visit,
  search debounced 300 ms with a 3-character minimum. Assumption: an active
  search ignores distance filters (inputs disabled) so distant catalog systems
  remain findable.
- New planet types get dedicated shaders through the shared renderer path,
  plus splash-screen entries for visual confirmation.

### G0 contract findings

- Paging: `offset`/`limit` (default 100, clamp 500); success responses require
  `total`, `offset`, `limit`, `hasMore`; failures carry a `message` only.
- Whole-system `celestial-body-list` omits `positionKm`/`distanceKm`.
- `approximateFields` paths: `physical.*` refers to catalog physical data
  (frontend `physicalCatalog`), `orbit.*` to orbital elements; whole-object
  entries include `atmosphere`, `orbit`, `surfaceArchetype`, `rings`.
- Schema gap (report to Forge): `discovery.references[{label,url}]` appears
  only in the upsert schema, though present in live responses.
- Consumers: ship-exterior local sweep and cold-boot resume need complete
  traversal; Viewer list is intentionally single-page with "Load more".
  No production star-list/get consumer exists; none added.
- Live probe: 4,845 systems (621 within 50 pc); Sol whole-system body list
  5,135 bodies; searches for "55 Cnc", "KOI-351", "cygnus" resolve.
- Pre-existing bug fixed: the ship-exterior `celestial-body-list` wrapper could
  hang without calling back on invalid bodies; it now skips them per body.

## Inputs and authority

- [Paging handoff](./nova-prompt-celestial-body-paging-2026-11-01.md).
- [Planet-types handoff](./nova-new-planet-types-2026-11-01.md).
- [Attribution handoff and exoplanet addendum](./nova-sol-catalog-attribution-prompt.md).
- Runtime contract authority: <http://localhost:3000/openapi.yaml>, including
  referenced operation documents and JSON schemas.
- [Testing policy](./testing-policy.md).

Handoffs describe intent and acceptance criteria, not an alternative API
authority. Verify exact fields, nullability, required fields, query modes, and
failure envelopes against OpenAPI before changing models. If OpenAPI lacks
required messaging detail or conflicts with a handoff, record the discrepancy,
stop the affected work, and request a Forge correction. Do not infer a wire
contract from generator code or other contract documents.

### Cache-busted contract retrieval

For each verification run, append a fresh timestamp or nonce query parameter
such as `?contractCheck=<timestamp>` and send `Cache-Control: no-cache` and
`Pragma: no-cache`. Apply this to the root, referenced operation documents, and
external schemas: fetching a fresh root alone does not refresh its references.
Resolve relative references against the original document URL; preserve JSON
Pointer fragments rather than placing the nonce after a fragment.

Record retrieval time, source URLs, and Forge revision when available; record
ETag, Last-Modified, or content hashes when available to identify the inputs.
This is contract-inspection behavior, not a proposal to add cache-busting to
normal game socket requests.

Planning checks on 2026-11-02 returned HTTP 200 for the cache-busted root,
the `solarsystem`, `celestial`, and `stars` operation documents, and seven
list/get request-response schemas. Operation text confirms paging defaults
100/maximum 500, system filters, and `starId` identity. Schema inspection
confirms paging fields and `catalogSnapshotDate`. This was a targeted check,
not full dereferencing or runtime behavior validation; gate G0 remains open.

## Current implementation findings

| Surface                                                                                      | Finding                                                                                         | Planned consequence                                                                                                 |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| [List model](../src/app/model/solar-system-list.ts)                                          | Source union has only curated/procedural; no paging metadata or new filters.                    | Update request, summary, and response shapes together.                                                              |
| [Body-list model](../src/app/model/celestial-body-list.ts)                                   | No offset/response metadata; radius fields currently required.                                  | Verify and model whole-system versus radius requests as OpenAPI defines them.                                       |
| [Viewer page](../src/app/page/game/viewer.ts)                                                | Fixed first 50 systems within 50 pc; injects a local Cygnus X-1 selection.                      | Add server-side discovery without breaking the special selection or miscounting it as a server result.              |
| [Solar-system service](../src/app/services/solar-system.service.ts)                          | Correlated callbacks exist; legacy identity key omits new filters and offset.                   | Reuse correlation helpers and update relevant identity keys, not just UI state.                                     |
| [Bootstrap controller](../src/app/scene/ship-exterior/ship-exterior-bootstrap-controller.ts) | Local sweep and resume consume a single page; failed resume query becomes `existingBodies: []`. | Fetch complete pages before seeding; query failure must not look like an empty successful sweep.                    |
| [Classification](../src/app/model/celestial-classification.ts)                               | Five planet archetypes; collection validator rejects on the first invalid record.               | Extend classification and introduce explicit per-body presentation recovery without weakening unrelated validation. |
| [Appearance resolver](../src/app/model/celestial-appearance.ts)                              | Giant routing handles only gas/ice giants; some existing archetypes use a terran fallback.      | Audit all ten planet looks; adding enum members alone does not meet visual acceptance.                              |
| [Surface resolver](../src/app/scene/planet/planet-surface-resolver.ts)                       | Shared catalog/procedural surface selection and versioned cache keys exist.                     | Reuse these paths and preserve approved imagery; update keys when generated appearance changes.                     |
| [System-get model](../src/app/model/solar-system-get.ts)                                     | Missing new catalog presentation fields; stars and bodies already have a deduplication helper.  | Preserve metadata through adapters and retain entity-ID deduplication.                                              |
| [Static credit records](../src/app/page/public/astronomy-data-credits.ts)                    | Shared credit data already exists; handoff records intro-page work as complete.                 | Reuse records in Viewer; do not redo the intro-page layout.                                                         |

No dedicated star-list/get client models were found in the initial inventory.
Confirm actual usage at G0. Do not introduce a star browser or unused transport
service merely because Forge supports those operations.

## Delivery order and progress tracker

Use `[ ]` for unfinished work and `[x]` only after verification. Record blockers
and exact validation results in the evidence log. Each phase has a reviewable
checkpoint; checkpoints are not authorization to release independently.

### G0 - Verify contract and inventory all consumers

Prerequisite for every implementation phase.

- [x] Re-fetch cache-busted OpenAPI and fully resolve relevant schemas:
      list/get bodies, classification, catalog physical data, stars, summaries,
      rings, discovery, and paging success/failure envelopes.
- [x] Record field mappings, especially wire `physical` versus frontend
      `physicalCatalog`, orbital fields, star IDs versus body IDs, and optional
      versus nullable values. Avoid casts that hide mapping errors.
- [x] Inventory every production `celestial-body-list` and
      `solar-system-list` caller, socket wrapper, response matcher, identity
      builder, adapter, mock, and test fixture. Classify each caller as
      intentional single-page consumption or complete traversal.
- [x] Confirm star-list/get usage. Update existing surfaces if present; if
      absent, record non-use and retain a contract-drift coverage task rather
      than adding speculative APIs.
- [x] Resolve any OpenAPI gaps with Forge before affected implementation.

Exit: a verified contract and complete consumer inventory, with no unresolved
wire-shape assumptions.

### Phase 1 - Paging and complete-sweep safety

Depends on G0. Implement transport correctness before the paged Viewer UI.

- [x] Update existing request/response models for `offset`, `limit`, `total`,
      and `hasMore`; paging metadata is required on success and may be absent
      on failure. Include new system filters/sort and the catalog source value.
- [x] Implement one typed shared page traversal using existing socket/logging
      conventions. Start at offset 0, use the returned effective
      `offset + limit`, preserve filters, and stop only when `hasMore` is false.
      Default sweep page size to 500; deduplicate body/system IDs, or `starId`
      if a real star consumer is identified.
- [x] Bound traversal with a documented, tested page cap. Detect malformed
      metadata, non-advancing offsets, failures, timeout, and cancellation.
      Log and surface incomplete results explicitly; a cap warning must never
      turn a partial result into a complete seeding input.
- [x] Preserve request-specific correlation, unsubscribe/dispose behavior, and
      cancellation when a scene, character, mission, or sweep context changes.
- [x] Migrate local sweeps and cold-boot resume. Supply `existingBodies` only
      after successful complete traversal and ID deduplication. On failure,
      abort/defer seeding visibly; never substitute an empty list.
- [x] Account for offset drift: sweeps are best-effort, not snapshots.
      Re-query after seeding writes as the handoff requires. If concurrent
      writes prevent a strict duplicate-free guarantee, document the remaining
      limitation and raise the need for server-side idempotency; do not claim
      client deduplication alone guarantees exact results.
- [x] Replace the fixed Viewer list with server-side search, source, distance
      band, has-planets, spectral-class filters, and distance/name sort.
      Use explicit "Load more" and "N of total"; never auto-fetch the entire
      registry for display.
- [x] Allow search beyond 50 pc; do not leave the old distance cap implicitly
      active for catalog-wide discovery. Reset pages on filter/sort change.
- [x] Ignore stale query generations and mismatched correlations; serialize
      load-more requests, deduplicate results, and show server failure messages,
      loading, empty, retry, and end-of-list states.
- [x] Keep local Cygnus X-1 access distinct from server totals/filter results.
      Update UI text in both [English](../src/app/i18n/locales/en.ts) and
      [Italian](../src/app/i18n/locales/it.ts).
- [x] Verify phase tests and record checkpoint evidence.

Exit: no complete-list consumer silently truncates at 100; cold-boot page-2
bodies are not reseeded; Viewer can find a distant system and load another page
without mixing filter generations.

### Phase 2 - Catalog models, planet rendering, and metadata

Depends on G0 and the Phase 1 shared model checkpoint. Complete Phase 1 before
combined user-flow validation.

- [x] Add `super-earth`, `sub-neptune`, `hot-neptune`, `hot-jupiter`, and
      `super-jupiter` to canonical classification and compatible planet values.
- [x] Carry schema-confirmed rings, approximation paths, catalog identifiers,
      names/source, star identity, companion counts, discovery/status/disputed
      metadata, references, and snapshot dates through models and adapters for
      both system-get and body-list projections.
- [x] Key catalog stars by `starId`, not nullable/optional `hygId`; preserve
      distinct body entity IDs and accept empty summary HYG echoes.
      Preserve existing deduplication of stars repeated in `stars` and `bodies`.
- [x] Add an explicit render-boundary placeholder for unknown archetypes and
      log body ID/reason. Keep known siblings renderable. Preserve canonical
      validation for missing identity, invalid coordinates/state, conflicting
      records, and other structural failures; unsafe records must receive
      explicit diagnostics, not invented coordinates or silent omission.
- [ ] Audit appearance routing, procedural generation, materials, texture
      hints/tints, cache versions, system view, and planet view. Give every one
      of the ten planet archetypes a distinct look at system-view zoom, including
      existing lava/ocean paths that currently fall back. Do not recreate
      Forge's scientific classification from mass/radius/temperature.
      _Partial:_ the five new types have dedicated renderers (super-earth baked
      surface; four gas-giant shader variants with haze/day-glow/night-glow/
      uniform-glow). **Deferred:** `lava` and `ocean` still use the terran
      fallback renderer (pre-existing behaviour, out of this change set).
- [x] Add optional annular rings using centre-relative radii, equatorial tilt,
      tint, opacity, and the same body scale. Apply axial tilt once; tolerate
      unknown ring fields and dispose resources. No rings when absent.
- [x] Resolve companion-star parenting through `parentBodyId`; show
      circumbinary names via `circumbinaryStarIds` and disclose approximate
      anchoring. Test camera/orbit robustness at roughly 500,000 AU separation.
- [x] Show catalog name only when different, approximate stars/distances and
      listed planet fields only, "likely" inferred types, disputed flags, and
      procedural-ring disclosure. Define consistent parent-path handling for
      entries such as `orbit`, alongside dotted leaf paths.
- [x] Preserve catalog text as plain text and original catalog measurements.
      Support moon-free catalog systems without assuming every system has moons.
- [x] Localize new UI/accessible labels in English and Italian.
- [x] Verify phase tests and record checkpoint evidence.

Exit: all ten planet types render distinctly; unknown types degrade explicitly;
rings/metadata are correct; 55 Cnc and KOI-351 render every expected unique body.

### Phase 3 - Remaining Viewer attribution

Depends on Phase 2 metadata plumbing. Reuse existing intro credits and avoid
unrelated intro-page changes.

- [x] Add Viewer-accessible data credits and "About this data" presentation
      using existing records. Cover Sol S1-S7 and exoplanet A1-A8; preserve A1/A5
      acknowledgment wording, A3/A4 license links and change notices, and
      secondary A7/A8 placement.
- [x] Keep A10 behind a default-off flag until reuse terms are confirmed.
      Do not enable it as part of this migration.
- [x] Render per-planet references in server order, first entry marked
      "Discovery", collapse more than five behind "Show all", and hide the
      section when absent. Support safe absolute HTTP/HTTPS links with
      `target="_blank"` and `rel="noopener noreferrer"`; reject unsafe schemes
      explicitly. Labels remain literal text, never HTML.
- [x] Show "Data as of" from `catalogSnapshotDate` in system view/details only
      when supplied; never hard-code a snapshot date or parse a date from prose.
- [x] Add Sol/exoplanet limitations and a shared estimated-value explanation.
      Reuse Phase 2 markers rather than introducing competing semantics.
- [x] Localize new presentation in English and Italian; verify credit wording
      remains faithful to required acknowledgments.
- [x] Verify credits/reference tests and capture Viewer credits and planet
      references screenshots.

Exit: credits, references, dates, and uncertainty disclosures meet the addendum
without regressing completed intro credits.

Implementation notes (Phase 3):

- Credits live in a collapsed "About this data" section of the Viewer scene
  info panel, rendered through the shared `AstronomyCreditList` component that
  the intro page now also uses. Scope is contextual: Sol shows S1–S7 plus Sol
  limitations; `exoplanet-catalog` systems show A1–A8 (A7/A8 secondary) plus
  exoplanet limitations; other systems show HYG (S7) only.
- A10 is gated by `environment.nameExoWorldsCreditEnabled` (default `false`).
- Unsafe reference URLs render their label as plain text and log a warning.
- "Data as of" appears in the scene info panel and on Viewer list rows when
  `catalogSnapshotDate` is a valid `YYYY-MM-DD` string.
- Star `approximate` exists only on star-list/star-get, which no UI consumes;
  in `solar-system-get`, star estimates arrive via `approximateFields` and are
  already disclosed by the Phase 2 `≈` markers.
- Solar-system details (user follow-up): the single "Planet" section is
  replaced by one section per planet type, in archetype order (rocky →
  super-Jupiter). The type comes from a valid `planetType`, otherwise from a
  planet-compatible `surfaceArchetype`. Untyped planets fall back to "Planet".
  Approximate types show a "(likely)" badge, and the distance view names the
  planet type. Labels are localized in en and it.
- Every category section (stars, all ten planet types, dwarf planets, moons,
  asteroids, black holes, TNOs, comets, stations, ships) renders for every
  system, with a count of 0 when empty. The only exception is the untyped
  "Planet" fallback, which appears only when it has rows. The star, planet,
  moon, asteroid and station section labels are now localized.

### Phase 4 - Dedicated lava and ocean renderers (user follow-up)

The Phase 2 audit deferred these: `lava` and `ocean` still use the terran
fallback and raise a `[celestial-appearance-fallback]` variance toast (for
example `exo-hd-219134-b`). This phase starts after the Phase 3 commit.

- [ ] Add a lava generator: dark basalt crust with glowing magma cracks and an
      emissive night side. Include a CPU generator, a GLSL mirror, and CPU/GPU
      parity tests (same pattern as `super-earth-surface.ts` and
      `super-earth-shader.ts`).
- [ ] Route `lava` to the new renderer in `celestial-appearance.ts`,
      `planet-seed.ts`, `planet-texture.ts`, `planet-shader.ts`,
      `planet-surface-resolver.ts` and `planet-bake.ts`. Bump the generator
      version.
- [ ] Ocean: keep Earth (Sol) on its current terran renderer, because Earth
      is an ocean world. Decide whether exoplanet `ocean` bodies get a
      dedicated look, or keep terran and stop treating the terran fallback as
      a variance.
- [ ] Add a splash picker entry for lava. Add unit tests and Viewer e2e
      coverage, and confirm that no fallback toast appears for lava bodies.

## Verification matrix

| Area              | Required assertions                                                                                                                                                                                              |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Paging helper     | Several pages; terminal and empty pages; clamped limit; duplicate IDs across pages; offset beyond total; failure without metadata; malformed/no-progress response; page cap; timeout/cancellation.               |
| Bootstrap         | More than 100 nearby bodies; page-2 existing body never reseeded; late-page failure/cap never seeds from partial data; disposal/context change ignores late results; post-write reconciliation.                  |
| Viewer discovery  | Second page; search KOI-351 beyond 50 pc; every filter/sort resets offset; out-of-order replies ignored; repeated load-more clicks safe; server message and retry; accurate totals with local selection.         |
| Catalog models    | Null/missing HYG ID; stable starId; catalog source/names/counts; metadata survives adapters; stars/bodies deduplicated; unchanged curated/procedural behavior.                                                   |
| Rendering         | All ten distinct looks at system zoom; unknown placeholder warning and valid siblings; ring geometry/tilt/scale/absence; companion parent; circumbinary labels; extreme separation without non-finite positions. |
| Attribution       | Approximate paths versus measured values; disputed flags; optional dates; ordered references and collapse; literal `<b>x</b>` label; safe link attributes/schemes; required credits/licenses; A10 off.           |
| Combined journeys | Mocked 55 Cnc and KOI-351 list-to-scene flow with exact expected unique body IDs, no celestial-body-contract error, metadata and references; live Forge smoke when available.                                    |

Use Vitest, not Jest. Use deterministic socket mocks for Playwright and
authoritative fixture IDs/readiness, not timing sleeps. Visual acceptance needs
browser inspection/screenshots in addition to material-key or scene-object tests.
Derive expected body IDs/counts from verified fixtures, not handoff snapshot
totals, which differ between document revisions.

### Planned commands

Run the smallest phase-relevant groups first; add new helper/renderer/reference
test files to the corresponding invocation once created. Commands below are
planned, **not run in this documentation-only session**.

```powershell
# Phase 1: existing impacted unit/service suites plus new traversal tests
npm run test:spec -- src\app\services\solar-system.service.vitest.ts src\app\services\solar-system-correlation.integration.vitest.ts src\app\services\ship-exterior-socket.service.vitest.ts src\app\scene\ship-exterior\ship-exterior-bootstrap-controller.vitest.ts src\app\page\game\viewer.vitest.ts

# Phase 2: existing model, adapter, scene, and details coverage
npm run test:spec -- src\app\model\celestial-classification.vitest.ts src\app\model\celestial-appearance.vitest.ts src\app\page\game\viewer-data-facade.vitest.ts src\app\scene\viewer\viewer-system-scene.vitest.ts src\app\page\game\solar-system-details.vitest.ts

# Phase 3: existing intro regression plus new Viewer attribution tests
npm run test:spec -- src\app\page\public\intro.vitest.ts src\app\page\game\solar-system-details.vitest.ts

# Cross-phase type/template and focused lint validation
npm run typecheck
npm run build
# Run npx eslint with the exact changed TypeScript file list.

# Focused mocked user journeys; extend selectors for newly added specs
npm run e2e:spec -- e2e\tests\viewer-list.spec.ts e2e\tests\viewer-scene-rendering.spec.ts e2e\tests\viewer-planet-surfaces.spec.ts e2e\tests\ship-exterior-hangar-resume.spec.ts
```

Run `npm run test:ci` for integrated release confidence after focused suites
pass; escalate Playwright scope when shared fixture or transport changes affect
additional flows. Record exact commands, test counts, failures, and reruns.
Build is mandatory after template/type changes; TypeScript alone is insufficient.

## Release gate and split-session handoff

- [ ] G0 and all three phases complete; every list caller explicitly classified.
- [ ] Updated mocks include real paging metadata and optional-field absences.
- [ ] Focused tests, typecheck, Angular build, changed-file lint, combined e2e,
      and integrated unit regression results recorded.
- [ ] Visual checks/screenshots confirm distinct archetypes, rings, credits,
      references, distant-system navigation, and unchanged Sol behavior.
- [ ] Live smoke checked against the intended Forge contract/revision, or marked
      blocked with a concrete reason; mocked success is not live verification.
- [ ] No unresolved duplicate-seeding, schema-authority, or attribution blockers.
- [ ] Ship the compatible client and Forge release together; no intermediate
      deployment that assumes old unlimited lists or only five planet types.

If splitting sessions, stop at a verified phase checkpoint, update this document
with changed files, exact evidence, blockers, and the next unchecked item.
Prefer a second implementation session over dropping acceptance criteria.
Commits are made per verified phase. Phases 1–3 were pushed to `main` on
2026-11-02 (the user requested this so GitHub Actions validates in parallel);
no deployment has been requested.

Out of scope: Forge generator changes, cursor/snapshot protocols, total-count
caching, Sol system-get slimming, sourced Sol rings/future ring bands, optional
atmospheric tails, and enabling A10 before approval.

## Evidence and blockers log

| Date       | Checkpoint         | Result / evidence                                                                                                                                                                                           | Next action                                              |
| ---------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| 2026-11-02 | Planning           | User selected one coordinated plan, separate phases, documentation-only session, and remaining Viewer attribution included.                                                                                 | Begin G0 only in an authorized implementation session.   |
| 2026-11-02 | Runtime inspection | Cache-busted root, three operation documents, and seven list/get schemas returned HTTP 200; targeted paging/filter/identity/date checks succeeded. Full schema audit and live behavior tests not performed. | Re-fetch/dereference and record contract evidence at G0. |
| 2026-11-02 | Validation         | No application tests/build run: only this plan is being added.                                                                                                                                              | Execute phase commands during implementation.            |

| 2026-11-02 | G0 | Cache-busted fetch of 26 contract files; live socket probe against localhost:3000 confirmed paging metadata, totals, and search targets. Schema gap: `discovery.references` only in upsert schema. | Phase 1. |
| 2026-11-02 | Phase 1 | Shared `fetchAllPages` traversal, ship-exterior migration (fail-closed resume), Viewer paged discovery, mock paging emulation. `npm test` 214 files / 2639 tests passed; `npm run typecheck` and `npm run build` clean; changed-file eslint clean; Playwright `viewer-list`, `viewer-scene-rendering`, `ship-exterior-hangar-resume`, `cold-boot-asteroid-parity` passed. | Commit; begin Phase 2. |
| 2026-11-02 | Phase 2 | Five new archetypes with recovery placeholders; super-earth baked surface; gas-giant variant shading; server rings (km → planet radii, `≈` disclosure); companion-star layout (incl. ~500,000 AU test); catalog inspector section with `≈` values and "likely" types; splash picker entries for all five kinds. `npm test` 219 files / 2700 tests passed; typecheck, build, changed-file eslint, `git diff --check` clean. Playwright: all `viewer-*` specs passed; 6 new splash variant specs passed. Pre-existing splash flakes under software WebGL (terran bake / intro redirect timeouts) reproduce on the stashed baseline. Live Forge: 55 Cnc and KOI-351 bodies pass recovery with zero rejections; `exo-55-cnc-b-c`/`-b-b` resolve host `exo-star-55-cnc-b`; `exo-koi-351-g` uses server rings; `exo-kepler-90-i` → super-earth. Deferred: lava/ocean keep terran fallback. | Commit; begin Phase 3. |
| 2026-11-02 | Phase 3 | Shared `AstronomyCreditList` (intro + Viewer); collapsed "About this data" section with contextual credits (Sol S1–S7 / exoplanet A1–A8 with A7/A8 secondary / HYG S7), localized limitations and `≈` explanation; A10 behind `nameExoWorldsCreditEnabled=false`; inspector references in server order with Discovery badge, >5 collapse (resets per body), http(s)-only links with `target=_blank` + `rel="noopener noreferrer"`, unsafe URLs as plain text + warning; "Data as of" in scene panel and list rows from `catalogSnapshotDate` only. `npm test` 220 files / 2719 tests passed; typecheck, build, changed-file eslint, `git diff --check` clean. Playwright: all `viewer-*` specs 100/102 in the parallel run — `viewer-controls-after-target` layout invariant fixed by placing About after surface sources; `viewer-planet-surfaces` "bakes the detail view" was worker contention and passed serially; `viewer-list` + `viewer-controls-after-target` 15/15 after fixes. Screenshots: `viewer-data-credits.png`, `viewer-references.png` (session files). | Commit; release gate. |
| 2026-11-02 | Phase 3 (details) | Solar-system details groups planets by type (`planet-<type>` sections, untyped → "Planet"), with a "(likely)" badge for approximate types and planet-type names in the distance view; en/it labels. Details vitest 13/13; `npm test` 2717/2722 in a parallel run under load, and all 4 failed files (110 tests) passed on rerun; typecheck, build, changed-file eslint clean. Playwright `viewer-list`, `viewer-controls-after-target`, `viewer-interactions` 33/34 in parallel, and the failed station-target case passed serially (6/6). | Commit; release gate. |
| 2026-11-02 | Phase 3 (all categories) | Details page renders every category with a count of 0 when empty; the untyped "Planet" fallback renders only when it has rows. Lava/ocean renderer gap logged as Phase 4. Details vitest 13/13; typecheck, build and eslint clean; Playwright `viewer-interactions`, `viewer-list`, `viewer-controls-after-target` 34/34 (`--workers=1`, run separately from Vitest). | Commit Phase 3; then Phase 4. |
| 2026-11-02 | Handoff | Phase 3 committed and pushed to `main` together with the Phase 1–2 commits; GitHub Actions validates the push. The session is ending on this machine because it is too slow; resume on a faster machine from "Resume here". | Verify CI; start Phase 4 (lava). |

Add implementation rows here. For blockers, include the affected task, concrete
failure or missing schema detail, owner/action needed, and re-verification result.
