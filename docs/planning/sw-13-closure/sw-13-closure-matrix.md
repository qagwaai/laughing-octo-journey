# SW-13 Closure Matrix

Status: Draft
Date: 2026-06-26
Owner model: Nova + Forge
Reviewer: Pete
Policy: No legacy support

## Visual Indicators

| Marker | Meaning |
| --- | --- |
| ☐ | Not started / Open |
| ◧ | In progress / Partial |
| ☑ | Done / Complete |
| ⚠ | Blocked / needs decision |
| ◧ | Superseded (tracked as reconciled/in progress) |

## 1. Matrix Legend

- Complete: Implemented and evidenced.
- Partial: Implemented in part or evidenced incompletely.
- Blocked: Cannot close without prerequisite.
- Open: Planned but not yet executed to closure quality.
- Superseded: Replaced by later implementation or decision.

## 2. SW-13 Milestone Matrix (M0-M6)

### SW-13 Status Snapshot

- ☑ M0 Descriptor baseline lock
- ☑ M1 Debris and asteroid identity pass
- ◧ M2 Ship and station family pass
- ◧ M3 Jump gate landmark pass
- ◧ M4 Balanced-performance validation
- ☐ M5 Canary visual validation
- ☐ M6 Release decision

| Milestone | Scope | Current Status | Evidence | Closure Notes |
| --- | --- | --- | --- | --- |
| M0 | Descriptor baseline lock | Complete | [sw-13-external-object-presentation-implementation-plan.md](../sw-13/sw-13-external-object-presentation-implementation-plan.md), [sw-13-closeout-note-2026-05-31.md](../sw-13/sw-13-closeout-note-2026-05-31.md) | Baseline descriptor-first slice accepted for current scope. |
| M1 | Debris and asteroid identity pass | Complete | [sw-13-closeout-note-2026-05-31.md](../sw-13/sw-13-closeout-note-2026-05-31.md), [sw-13a-execution-report-2026-05-31.md](../sw-13a/sw-13a-execution-report-2026-05-31.md) | Active route families delivered for constrained scope. |
| M2 | Ship and station family pass | Partial | [sw-13-external-object-presentation-implementation-plan.md](../sw-13/sw-13-external-object-presentation-implementation-plan.md), [sw-13a-execution-report-2026-05-31.md](../sw-13a/sw-13a-execution-report-2026-05-31.md), [ship-exterior-view.vitest.ts](../../src/app/scene/ship-exterior-view.vitest.ts) | Later code/test evidence indicates improved coverage; closure docs not fully reconciled. |
| M3 | Jump gate landmark pass | Partial | [sw-13-external-object-presentation-implementation-plan.md](../sw-13/sw-13-external-object-presentation-implementation-plan.md), [ship-exterior-view.vitest.ts](../../src/app/scene/ship-exterior-view.vitest.ts) | Gate feed/hydration exists in tests, but SW-13 formal milestone record remains incomplete. |
| M4 | Balanced-performance validation | Partial | [sw13-m4-size-consistency-report.json](../sw-13/sw13-m4-size-consistency-report.json), [sw-13-closeout-note-2026-05-31.md](../sw-13/sw-13-closeout-note-2026-05-31.md) | Performance report exists, but not fully chained to final SW-13 family closure package. |
| M5 | Canary visual validation | Open | [sw-13-m5-manual-test-worksheet.md](../sw-13/sw-13-m5-manual-test-worksheet.md), [sw-13-external-object-presentation-implementation-plan.md](../sw-13/sw-13-external-object-presentation-implementation-plan.md) | Worksheet and evidence checklist are not fully completed. |
| M6 | Release decision | Open | [sw-13-external-object-presentation-implementation-plan.md](../sw-13/sw-13-external-object-presentation-implementation-plan.md) | Go/no-go record with M0-M5 evidence chain is still required. |

## 3. SW-13A Matrix

### SW-13A Status Snapshot

- ◧ Execution report status
- ☑ Active family support (asteroids, debris)
- ◧ Gap list for gates/stations/encounter ships
- ☐ Formal SW-13A closeout addendum

| Area | Current Status | Evidence | Closure Notes |
| --- | --- | --- | --- |
| Execution report status | Partial | [sw-13a-execution-report-2026-05-31.md](../sw-13a/sw-13a-execution-report-2026-05-31.md) | Document still marks in-progress Nova-only scope. |
| Active family support (asteroids, debris) | Complete | [sw-13a-execution-report-2026-05-31.md](../sw-13a/sw-13a-execution-report-2026-05-31.md) | Delivered and evidenced in report. |
| Gap list for gates/stations/encounter ships | Superseded (likely) | [sw-13a-execution-report-2026-05-31.md](../sw-13a/sw-13a-execution-report-2026-05-31.md), [market-list.ts](../../src/app/model/market-list.ts), [ship-exterior-route-feed-adapter.ts](../../src/app/scene/ship-exterior/ship-exterior-route-feed-adapter.ts), [ship-exterior-view.ts](../../src/app/scene/ship-exterior-view.ts), [ship-exterior-view.vitest.ts](../../src/app/scene/ship-exterior-view.vitest.ts) | Runtime and tests now include contract-backed route feeds; report needs reconciliation/update. |
| Formal SW-13A closeout addendum | Open | [sw-13a-execution-report-2026-05-31.md](../sw-13a/sw-13a-execution-report-2026-05-31.md) | Addendum needed to align status with current implementation evidence. |

## 4. SW-13B Matrix

### SW-13B Status Snapshot

- ☑ Visual and determinism closure for M1B and M2B
- ◧ Multi-ship per-ship retained scene behavior
- ◧ No-legacy policy continuity closure evidence

| Area | Current Status | Evidence | Closure Notes |
| --- | --- | --- | --- |
| Visual/determinism closure for M1B and M2B | Complete | [sw-13b-m1b-m2b-visual-implementation-plan-2026-06-02.md](../sw-13b/sw-13b-m1b-m2b-visual-implementation-plan-2026-06-02.md), [sw-13b-m2b-ship-external-view-execution-brief-2026-06-02.md](../sw-13b/sw-13b-m2b-ship-external-view-execution-brief-2026-06-02.md), [sw-13b-m1b-m2b-evidence-pack-2026-06-04.md](../sw-13b/sw-13b-m1b-m2b-evidence-pack-2026-06-04.md) | Asteroid-focused M1B/M2B evidence chain is present. |
| Multi-ship per-ship retained scene behavior | Partial | [ship-exterior-view.ts](../../src/app/scene/ship-exterior-view.ts), [ship-exterior-view.vitest.ts](../../src/app/scene/ship-exterior-view.vitest.ts), [sw-13-multi-ship-scene-retention-note.md](./sw-13-multi-ship-scene-retention-note.md), [sw-13-closure.md](./sw-13-closure.md) | Milestone 3 baseline delivered capture/restore retention, but reviewer validation marked semantic mismatch versus keep-alive active-scene switching. Milestone 4 required. |
| No-legacy policy continuity | Partial | [sw-13b-m1b-m2b-visual-implementation-plan-2026-06-02.md](../sw-13b/sw-13b-m1b-m2b-visual-implementation-plan-2026-06-02.md) | Policy is documented; enforce through final closure checklist and code review. |

## 5. Cross-Stream Hard Gates (From Closure Plan)

### Gate Rollup

- ☐ G1 Documentation reconciliation
- ⚠ G2 Multi-ship per-ship scene retention
- ◧ G3 Route feed completeness and SW-13A reconciliation
- ◧ G4 SW-13B evidence integrity and reproducibility
- ☐ G5 M5 worksheet and M6 go/no-go publication

Current closure readiness: 0/5 gates green

| Gate | Description | Status | Owner | Reviewer | Evidence Needed |
| --- | --- | --- | --- | --- | --- |
| G1 | Documentation reconciliation across SW-13, SW-13A, SW-13B | Open | Nova | Pete | Updated reports and consistent status language across streams. |
| G2 | Multi-ship per-ship scene retention in ship-external view | Blocked | Nova | Pete | Implement true per-ship scene instances (keyed by playerName+characterId+shipId), lazy init for uninitialized scenes, inactive-scene pause, resident-until-logout lifecycle, strict async routing, and validate no cross-context bleed. |
| G3 | Route feed completeness and SW-13A contract-backed family coverage | Partial | Forge + Nova | Pete | Confirmed contract authority plus reconciled SW-13A gap closure record. |
| G4 | SW-13B evidence integrity and reproducibility | Partial | Nova | Pete | Re-run or verify reproducibility links and update closure package references. |
| G5 | M5 worksheet completion and M6 go/no-go publication | Open | Nova | Pete | Completed worksheet artifacts and signed go/no-go record. |

## 6. Immediate Next Actions

0. Execute the lifecycle-first readiness sequence in [sw-13-visual-testing-readiness-plan.md](./sw-13-visual-testing-readiness-plan.md) and do not start visual validation until its gate criteria pass.
1. Update SW-13A with a reconciliation addendum that retires superseded gap items.
2. Execute G2 in architecture-replacement mode (not incremental patch mode) using the documented communication contract.
3. Complete SW-13 M5 worksheet evidence fields and checklist.
4. Publish SW-13 M6 go/no-go record with explicit blocker disposition.
5. Update this matrix from Draft to Accepted when G1-G5 are all pass.

## 7. Milestone 4 Traceability (G2)

| Milestone 4 Item | Status | Evidence | Reviewer Note |
| --- | --- | --- | --- |
| Keep-alive per-ship scene instances implemented | Blocked | [ship-exterior-view.ts](../../src/app/scene/ship-exterior-view.ts) | Current runtime remains snapshot/restore-oriented; true per-ship concurrent scene instances are not implemented |
| Active-only scene display on ship switch | Partial | [ship-exterior-view.vitest.ts](../../src/app/scene/ship-exterior-view.vitest.ts) (`M4: should enforce active-only scene data on ship switch with no cross-ship residue`) | Unit signal exists; manual cross-context regressions still reported |
| No restore/reseed dependency for initialized-scene switch continuity | Blocked | [ship-exterior-view.ts](../../src/app/scene/ship-exterior-view.ts), [sw-13-multi-ship-scene-retention-note.md](./sw-13-multi-ship-scene-retention-note.md) | Reviewer-confirmed architecture requires activation-switch semantics only |
| Non-bleed guarantees under active switching | Blocked | [ship-exterior-view.vitest.ts](../../src/app/scene/ship-exterior-view.vitest.ts), [ship-exterior-multi-ship-keepalive.spec.ts](../../e2e/tests/ship-exterior-multi-ship-keepalive.spec.ts) | Manual validation reports rotation and scan-tier cross-context bleed |
| Lifecycle/memory bounds documented and accepted | Partial | [sw-13-multi-ship-scene-retention-note.md](./sw-13-multi-ship-scene-retention-note.md) | Lifecycle policy clarified; acceptance blocked pending implementation proof |
| Patch-vs-replacement communication contract documented | Complete | [sw-13-closure.md](./sw-13-closure.md), [sw-13-multi-ship-scene-retention-note.md](./sw-13-multi-ship-scene-retention-note.md) | G2 execution now requires explicit "architecture replacement" declaration and stop conditions |
