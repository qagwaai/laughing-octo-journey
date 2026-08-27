# SW-13B M1B/M2B Evidence Pack (Phase C Baseline)

Status: Published (Phase C complete baseline; Phase D hardening in progress)
Date: 2026-06-04
Owner: Nova
Feature: SW-13B Asteroids
Scope: Cross-surface evidence baseline for Stellar Viewer (M1B) and ship-external-view (M2B)

## 1) Baseline Validation Snapshot

1. Unit/integration baseline:
   - `npm run test:ci`
   - Result: 1726 tests passed
2. Build gate baseline:
   - `npm run build`
   - Result: passed
   - Known unchanged warning: `src/app/page/opening/cold-boot-scan.css` budget +483 bytes
3. Full e2e baseline:
   - `npx playwright test --reporter=line`
   - Result: 141/141 passed in 3.3m
   - Log artifact: `.tmp/e2e-clean-2026-06-04.log`

## 2) Deterministic Screenshot and Runtime Artifacts

1. Playwright HTML report entry:
   - `playwright-report/index.html`
2. Playwright report data bundle:
   - `playwright-report/data/`
3. Relevant focused e2e suites included in baseline:
   - `e2e/tests/viewer-scene-rendering.spec.ts`
   - `e2e/tests/ship-exterior-hangar-resume.spec.ts`
   - `e2e/tests/ship-exterior-test-utils.spec.ts`

## 3) Numeric Metrics Baseline (Project-Level)

From latest `npm run test:ci` coverage summary:

1. Statements: 77.51% (8232/10620)
2. Branches: 65.46% (3889/5941)
3. Functions: 78.99% (1677/2123)
4. Lines: 77.75% (7943/10215)
5. Notable improvement in this cycle:
   - `src/app/page/game/viewer-scene.ts` branch coverage improved from 57.14% to 76.62%

## 4) Determinism and Readability Artifact Sources

1. M1B artifact source:
   - `src/app/model/sw13b/sw-13b-m1b-stellar-viewer-validation.ts`
   - Export: `SW13B_M1B_STELLAR_VIEWER_VALIDATION`
2. M2B artifact source:
   - `src/app/model/sw13b/sw-13b-m2b-ship-external-view-validation.ts`
   - Export: `SW13B_M2B_SHIP_EXTERNAL_VIEW_VALIDATION`
3. M0B baseline registry/evidence source:
   - `src/app/model/sw13b/sw-13b-m0b-asteroid-baseline.ts`
   - Export: `SW13B_M0B_PUBLISHED_ARTIFACTS`

## 5) Delta Notes

1. Phase C closure confidence increased via full cross-repo Playwright baseline pass (141/141).
2. Unit and branch coverage improved in this cycle, with largest tracked gain in `viewer-scene.ts` branch coverage.
3. Remaining optimization and hardening is tracked under Phase D and does not block Phase C closeout.

## 6) Follow-On (Phase D)

1. Continue branch hardening in:
   - `src/app/page/game/ship-view-inventory.ts`
   - `src/app/page/game/ship-view-specs.ts`
   - `src/app/page/game/viewer-data-facade.ts`
2. Expand visual metric reporting granularity (seed-level metric table and drift-focused deltas) as hardening artifacts.

## 7) Finalization Decision

1. This evidence pack satisfies the Phase C publication baseline for SW-13B M1B/M2B.
2. Phase C closure is accepted with current deterministic/runtime/coverage evidence.
3. Any additional optimization or reporting refinement proceeds under Phase D hardening and does not reopen Phase C.
