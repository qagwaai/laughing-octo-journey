# SW-13B M1B/M2B Visual Implementation Plan (Nova)

Status: In Progress (Phase C complete for M1B/M2B; Phase D hardening in progress)
Date: 2026-06-02
Owner: Nova
Feature: SW-13B Asteroids
Scope: Visual implementation and validation for Stellar Viewer (M1B) and ship-external-view (M2B)
Spec authority: https://github.com/qagwaai/miniature-octo-waffle/blob/main/docs/planning/sw-13b/sw-13b-asteroid-generator-spec.md
Policy lock: Code-generated asteroids only; no marketplace or commissioned assets; no legacy support

## Acceptance Checkpoint (2026-06-02, M1B)

1. Outcome: M1B Stellar Viewer visual tuning accepted.
2. Finalized visual direction:
   - Deterministic rocky silhouette deformation with macro/meso breakup, dents/craters, and facet-plane cuts.
   - Flat-shaded rock-deformed rendering path to improve rocky readability at gameplay distance.
   - Lighting refinement pass to improve detail legibility without additional geometry changes.
3. Updated runtime files:
   - src/app/scene/viewer/viewer-system-scene.ts
   - src/app/scene/viewer/viewer-system-scene.html
4. Verification at acceptance checkpoint:
   - `npm run test:spec -- "**/viewer-system-scene.spec.ts"` -> 23 passed.
   - `npm run build` -> passed.
   - Existing known warning unchanged: `cold-boot-scan.css` budget +483 bytes.
5. Scope note:
   - This checkpoint records M1B visual acceptance.
   - M2B cross-surface parity closure is completed; Phase D hardening remains tracked by this plan.

## 1) Purpose

Close the M1B/M2B visual gap by implementing deterministic, code-generated asteroid geometry that reads as rocky at gameplay distance and remains distinguishable across baseline and hero tiers in both surfaces.

## 2) Inputs Confirmed Before Planning

1. Plan depth: execution-ready.
2. Mandatory visual evidence:
   - Deterministic screenshot sets by seed/profile/tier.
   - Numeric shape metrics (roughness/sphericity proxies).
3. Priority mode: visual fidelity first, then optimization.
4. Non-negotiable: no legacy support.

## 3) Gap Statement (Current State)

1. Current rock reveal path is visually smooth and can collapse to sphere-like readability.
2. Existing M1B/M2B acceptance is data-centric (metadata/tier/determinism) and does not enforce silhouette quality.
3. Baseline vs hero visual differentiation is not currently fail-gated by objective visual checks.

## 4) Implementation Direction

Implement one shared deterministic asteroid geometry pipeline used by both Stellar Viewer and ship-external-view, then layer surface-specific runtime budgets and camera-distance validation.

### 4.1 Shared Visual Pipeline (Both Surfaces)

1. Seed and profile mapping:
   - Parse tier/profile/material/ordinal from existing seed metadata.
   - Map to stable parameter bundle derived from spec ranges.
2. Base primitive:
   - Start from an icosphere-like vertex distribution (subdividable geometry).
3. Macro displacement pass:
   - Low-frequency 3D noise for silhouette breakup.
   - Axis stretch and lobe controls per profile.
4. Meso ridge pass:
   - Medium-frequency signed displacement for ridge/shelf forms.
5. Crater pass:
   - Deterministic crater centers/radii/depth/rim values from seeded RNG.
6. Fracture and erosion pass:
   - Directional attenuation and edge breakup for rocky irregularity.
7. Material bias pass (visual-only metadata alignment):
   - Roughness/metalness/albedo bias by canonical material family.
8. LOD derivation:
   - Produce mesh detail tiers preserving silhouette class identity.

### 4.2 Determinism Rules

1. Same seed + profile + revision must produce byte-stable metric signature.
2. RNG stream order must be fixed by pass sequence.
3. Any generator behavior change increments generator version and invalidates old signatures.

## 5) Architecture and Code Changes

## 5.1 New/Updated Modules

1. Add shared generator module:
   - src/app/model/sw13b/asteroid-visual-generator.ts
   - Exports deterministic parameter expansion and geometry build functions.
2. Add geometry metrics module:
   - src/app/model/sw13b/asteroid-visual-metrics.ts
   - Exports rocky-shape metrics and thresholds.
3. Update mesh profile model integration:
   - src/app/model/catalog/asteroid-mesh-profiles.ts
   - Replace revealGeometry fallback assumptions with generated geometry contract.
4. Update asteroid component rendering path:
   - src/app/component/asteroid.ts
   - src/app/component/asteroid.html
   - Replace smooth sphere reveal branch with generated rocky geometry binding.

## 5.2 Surface Integration

1. Stellar Viewer (M1B):
   - Use shared generator with SV budget profile.
   - Validate near/mid/far readability against tier expectations.
2. ship-external-view (M2B):
   - Use same shared generator with SEV budget profile.
   - Validate parity with SV for identity semantics and fallback behavior.

## 6) Visual Acceptance Gates (Fail/Pass)

All gates are mandatory. A data pass cannot override a visual fail.

1. Rocky silhouette gate:
   - Output must not classify as near-spherical by threshold.
2. Baseline/hero differentiation gate:
   - Hero set must exceed baseline in silhouette complexity and landmark readability.
3. Fallback identity gate:
   - Fallback transitions must preserve family identity and not collapse hero into baseline look.
4. Cross-surface parity gate:
   - Same seed/profile appears as same identity class in SV and SEV.
5. Determinism gate:
   - Repeated runs produce identical visual metric signatures.

## 7) Numeric Metrics (Required)

Per generated sample, compute and store:

1. Sphericity proxy (lower is less sphere-like).
2. Radial variance index.
3. Curvature variance index.
4. Crater/ridge feature density.
5. Silhouette complexity score from multi-angle projected outlines.

Initial threshold policy (tunable during execution):

1. Rocky pass: sphericity proxy <= configured rocky upper bound.
2. Baseline/hero separation: hero complexity median >= baseline median + delta.
3. Fallback preservation: fallback metric drift within identity-preserving band.

## 8) Evidence Pack Requirements

1. Deterministic screenshot sets:
   - Fixed camera distances (near/mid/far), fixed seed list, fixed lighting preset.
   - Naming includes seed/profile/tier/surface/run index.
2. Metric report:
   - Table per seed with all five numeric metrics and pass/fail flags.
3. Delta report:
   - Compare current run to prior accepted run for drift detection.

Published evidence pack document:
- `docs/planning/sw-13b/sw-13b-m1b-m2b-evidence-pack-2026-06-04.md`

## 9) Execution Sequence

## Phase A: Foundation (Shared)

1. Implement seeded parameter expansion and deterministic pass ordering.
2. Implement geometry builder and metric computation.
3. Add unit tests for determinism and metric stability.

## Phase B: M1B Visual Closure (Stellar Viewer)

1. Wire generator into asteroid reveal path for SV.
2. Replace sphere-like rock branch with generated rocky geometry.
3. Add M1B visual acceptance artifact with screenshot and metric gates.
4. Run focused tests and update M1B execution brief as revalidated.

## Phase C: M2B Visual Closure (ship-external-view)

1. Wire same generator into SEV path.
2. Add cross-surface parity checks against SV for identical seeds.
3. Add M2B visual acceptance artifact with screenshot and metric gates.
4. Run focused tests and update M2B execution brief as revalidated.

## Phase D: Hardening

1. Tune thresholds for false positives/false negatives.
2. Profile performance and reduce cost without violating visual gates.
3. Promote visual gates to required CI checks for SW-13B.

## 10) Test and Validation Plan

Status checkpoint (2026-06-04): Complete.

1. Unit tests (Jasmine/Karma):
   - Completed: Added targeted SW-13B assertions for post-scan hero deformation stability and viewer QA/force-hero branch behavior.
   - Completed: Updated affected asteroid expectations to align with current visual-state logic.
   - Current full-suite status: `npm run test:ci` passed with 1726 tests completed.
2. Coverage baseline and delta (from latest `test:ci`):
   - Statements: 77.51% (8232/10620).
   - Branches: 65.46% (3889/5941).
   - Functions: 78.99% (1677/2123).
   - Lines: 77.75% (7943/10215).
   - Improvement in this pass: `viewer-scene.ts` branch coverage improved from 57.14% to 76.62%.
3. Integration validation:
   - Completed in this pass: Asteroid component and viewer scene integration paths validated via focused unit/integration specs.
   - Remaining focus: Continue branch coverage expansion in low-coverage game-page modules.
4. Focused e2e (Playwright):
   - Scope: Visual-state smoke coverage for both surfaces (SV and SEV), including scan completion, hover/target state transitions, and hero-detail parity checks.
   - Execution: Run targeted specs first (`npm run e2e:spec -- <spec-path>`), then full suite (`npm run e2e`) before milestone closure.
   - Evidence: Preserve deterministic screenshot/report artifacts from Playwright report for SW-13B acceptance pack.
   - Status (2026-06-04): Initial baseline captured via full run (`npx playwright test --reporter=line`) with 141/141 passed in 3.3m; log artifact saved at `.tmp/e2e-clean-2026-06-04.log`.
5. Post-completion follow-on targets (coverage hardening order):
   - `src/app/page/game/ship-view-inventory.ts`.
   - `src/app/page/game/ship-view-specs.ts`.
   - `src/app/page/game/viewer-data-facade.ts`.
6. Build gate:
   - Required and currently green: `npm run build` passes with no new SW-13B errors (existing known CSS budget warning unchanged).

## 11) Deliverables

1. Shared visual generator and metrics modules.
2. Updated asteroid rendering path to generated rocky geometry.
3. M1B visual validation artifact + spec + updated execution brief.
4. M2B visual validation artifact + spec + updated execution brief.
5. Evidence pack (screenshots + metric reports) for both surfaces.
   - Published baseline package: `docs/planning/sw-13b/sw-13b-m1b-m2b-evidence-pack-2026-06-04.md`

## 12) Exit Criteria for M1B/M2B Visual Re-acceptance

1. All visual acceptance gates pass for both surfaces.
2. Deterministic screenshot and metric evidence is published and reproducible.
3. Baseline and hero tiers are visually distinguishable at gameplay distance.
4. Fallback behavior preserves visual identity semantics.
5. No marketplace/commissioned dependencies; no legacy fallback path retained.

## 13) Finalization Summary (2026-06-04)

Completion decision:
- Phase C (M1B + M2B visual closure): complete.
- Phase D (hardening): in progress and non-blocking for Phase C closure.

Closure checklist:
1. M1B runtime + visual acceptance artifact is published and linked: complete.
2. M2B runtime + visual acceptance artifact is published and linked: complete.
3. Cross-surface baseline e2e run completed (`npx playwright test --reporter=line`): complete (141/141).
4. Evidence pack document published for deterministic screenshots/metrics references: complete.
5. Build and unit/integration gates are green for this baseline: complete.

Remaining tracked work (Phase D):
1. Coverage hardening in selected game-page modules.
2. Additional seed-level metric drift reporting granularity.
3. Performance tuning under existing SW-13B hardening policy.
