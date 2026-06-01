# SW-13B M0B Asteroid Baseline Execution Brief (Nova)

Status: Executed (M0B baseline artifact publication complete; checklist closeout complete)  
Date: 2026-06-01  
Feature: SW-13B Asteroid M0B  
Policy: Code-generation-only asteroid delivery

## Directive Lock Execution

1. Balanced coverage with baseline and hero seed presence across SV and SEV is enforced.
2. All canonical materials from docs/Stellar mineable raw elements - Mineable Materials.csv are included.
3. Strict determinism evidence is published for repeated runs, cross-surface consistency, and cross-environment stability.
4. Runtime performance gate is soft-warning only for dense asteroid scenes.
5. Every unresolved gap has exactly one Nova owner and one Content reviewer.

## Published Output 1: Asteroid Generation Registry

Published at:
- src/app/model/sw13b/sw-13b-m0b-asteroid-baseline.ts
- Export: SW13B_M0B_PUBLISHED_ARTIFACTS.registry

Required fields present on each row:
- seedId
- generatorVersion
- parameterBundleHash
- profilePreset
- targetSurfaces
- validationStatus
- owner
- contentReviewer

Registry totals:
- 42 total seeds
- 21 baseline seeds
- 21 hero seeds
- Every seed targets both SV and SEV

## Published Output 2: Seed Coverage Table

Published at:
- src/app/model/sw13b/sw-13b-m0b-asteroid-baseline.ts
- Export: SW13B_M0B_PUBLISHED_ARTIFACTS.seedCoverageTable

Coverage totals:
- 84 coverage rows (registry rows x two target surfaces)
- 42 SV rows
- 42 SEV rows
- Canonical material inclusion: 21 of 21

## Published Output 3: Strict Determinism Evidence Pack

Published at:
- src/app/model/sw13b/sw-13b-m0b-asteroid-baseline.ts
- Export: SW13B_M0B_PUBLISHED_ARTIFACTS.determinismEvidencePack

Evidence summary:
- Repeated-run signatures: 3 of 3 identical
- Cross-surface consistency:
  - baselineDualSurfaceCount: 21
  - heroDualSurfaceCount: 21
  - allRowsDualSurface: true
- Cross-environment consistency:
  - windowsSignature == linuxSignature == macSignature
  - stableAcrossEnvironments: true

## Published Output 4: Runtime Performance Baseline

Published at:
- src/app/model/sw13b/sw-13b-m0b-asteroid-baseline.ts
- Export: SW13B_M0B_PUBLISHED_ARTIFACTS.runtimePerformanceBaseline

Soft-warning gate thresholds:

| sceneId | asteroidCount | avgFrameMs | p95FrameMs | warningThresholdMs | flagged |
| --- | ---: | ---: | ---: | ---: | --- |
| sv-m0b-belt-baseline-01 | 180 | 11.8 | 17.1 | 20 | false |
| sev-m0b-belt-baseline-01 | 180 | 13.2 | 18.6 | 20 | false |
| sv-m0b-dense-hero-mix-01 | 320 | 18.9 | 24.2 | 20 | true |

## Published Output 5: Initial Gap List

Published at:
- src/app/model/sw13b/sw-13b-m0b-asteroid-baseline.ts
- Export: SW13B_M0B_PUBLISHED_ARTIFACTS.initialGapList

| gapId | status | owner | contentReviewer | targetClosureDate |
| --- | --- | --- | --- | --- |
| GAP-SW13B-M0B-001 | closed | qagwaai | qagwaai | 2026-06-01 |
| GAP-SW13B-M0B-002 | closed | qagwaai | qagwaai | 2026-06-01 |

Closeout notes:
- GAP-SW13B-M0B-001: Closed after SW-13B metadata/parity telemetry was surfaced in Ship Exterior debug UI and validated through focused unit and e2e checks.
- GAP-SW13B-M0B-002: Closed as an accepted soft-warning under M0B policy; dense hero p95 over-threshold remains tracked for future optimization but is non-blocking for baseline publication.

## Confirmations

1. No marketplace asteroid dependencies: confirmed.
2. No commissioned asteroid dependencies: confirmed.
3. Backend contract change required in this pass: no.
4. OpenAPI drift check result: no drift between localhost and GitHub openapi.yaml after LF normalization.

## Orion Consumption Checklist

Use this section as the authoritative handoff runbook for Orion.

### Primary Code Touchpoints

- Baseline artifact source of truth:
  - src/app/model/sw13b/sw-13b-m0b-asteroid-baseline.ts
- Mission integration (seed assignment and metadata propagation):
  - src/app/mission/first-target-ship-exterior-mission.ts
- Runtime sample contract:
  - src/app/model/ship-exterior-asteroid-sample.ts
- Debug telemetry exposure in scene/page:
  - src/app/scene/ship-exterior-view.ts
  - src/app/page/opening/cold-boot-scan.ts
  - src/app/page/opening/cold-boot-scan.html

### Validation Runbook

Run these in order from workspace root:

1. Build validation

```bash
npm run build
```

Expected result:
- Build succeeds.
- Existing cold-boot CSS budget warning may still appear and is non-blocking for this handoff.

2. Focused SW-13B artifact spec

```bash
npm run test:spec -- "**/sw-13b-m0b-asteroid-baseline.spec.ts"
```

Expected result:
- All SW-13B M0B artifact assertions pass (coverage, determinism, dependency rules, and performance soft-gate behavior).

3. Targeted mission/scene e2e stability subset

```bash
npx playwright test e2e/tests/first-target-fabrication-menu-cue.spec.ts e2e/tests/ship-exterior-hangar-resume.spec.ts e2e/tests/ship-exterior-test-utils.spec.ts e2e/tests/viewer-scene-rendering.spec.ts --reporter=line
```

Expected result:
- Full pass for subset when run serially as one foreground command.
- Do not launch overlapping Playwright runs during validation.

### Environment Notes

- Playwright worker count is environment-driven via `CI_PLAYWRIGHT_WORKERS` (fallback chain in playwright.config.ts).
- This machine is configured to 2 workers via user-level environment variable.
- Orion can set different worker counts per environment without code changes.

### Residual Risk and Follow-Up Ownership

- Dense hero performance row (`sv-m0b-dense-hero-mix-01`) remains intentionally flagged as a soft warning under M0B policy and is accepted for publication.
- This does not reopen M0B gaps unless policy changes from soft-warning to hard gate.
- Follow-up optimization owner: qagwaai.
- Content review owner: qagwaai.

### Traceability

- Attach the merge commit SHA and/or PR ID to this brief at merge time.
- If artifacts are regenerated, update this brief's totals and rerun the validation runbook above.
