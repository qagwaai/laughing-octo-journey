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
| Multi-ship per-ship retained scene behavior | Partial | [ship-exterior-bare-scene.component.ts](../../src/app/scene/ship-exterior/ship-exterior-bare-scene.component.ts), [ship-scene-context.ts](../../src/app/scene/ship-exterior/ship-scene-context.ts), [ship-scene-registry.ts](../../src/app/scene/ship-exterior/ship-scene-registry.ts), [sw-13-multi-ship-scene-retention-note.md](./sw-13-multi-ship-scene-retention-note.md), [replacement-design-checkpoint.md](./replacement-design-checkpoint.md) | Hard architecture replacement (M1–3C) delivered: true per-ship scene instances, activation-switch semantics, no restore paths, lazy init, inactive-pause, Pete-confirmed M1/2/3A/3B/3C. Old monolith artifacts deleted. Remaining: Cold Boot, Asteroid, Mission/route-feed parity lanes. |
| No-legacy policy continuity | Partial | [sw-13b-m1b-m2b-visual-implementation-plan-2026-06-02.md](../sw-13b/sw-13b-m1b-m2b-visual-implementation-plan-2026-06-02.md) | Policy is documented; enforce through final closure checklist and code review. |

## 5. Cross-Stream Hard Gates (From Closure Plan)

### Gate Rollup

- ☐ G1 Documentation reconciliation
- ◧ G2 Multi-ship per-ship scene retention
- ◧ G3 Route feed completeness and SW-13A reconciliation
- ◧ G4 SW-13B evidence integrity and reproducibility
- ☐ G5 M5 worksheet and M6 go/no-go publication

Current closure readiness: 0/5 gates green (G2 architecture unblocked; parity lanes remaining)

| Gate | Description | Status | Owner | Reviewer | Evidence Needed |
| --- | --- | --- | --- | --- | --- |
| G1 | Documentation reconciliation across SW-13, SW-13A, SW-13B | Open | Nova | Pete | Updated reports and consistent status language across streams. |
| G2 | Multi-ship per-ship scene retention in ship-external view | Partial | Nova | Pete | Architecture replacement (M1–3C) delivered and Pete-confirmed. Remaining: Cold Boot lane, Asteroid gameplay lane, Mission/route-feed lane parity recovery. |
| G3 | Route feed completeness and SW-13A contract-backed family coverage | Partial | Forge + Nova | Pete | Confirmed contract authority plus reconciled SW-13A gap closure record. |
| G4 | SW-13B evidence integrity and reproducibility | Partial | Nova | Pete | Re-run or verify reproducibility links and update closure package references. |
| G5 | M5 worksheet completion and M6 go/no-go publication | Open | Nova | Pete | Completed worksheet artifacts and signed go/no-go record. |

## 6. Immediate Next Actions

0. ~~Execute the lifecycle-first readiness sequence in sw-13-visual-testing-readiness-plan.md~~ — superseded; architecture replacement (M1–3C) satisfies the lifecycle-first intent.
1. Update SW-13A with a reconciliation addendum that retires superseded gap items (G3, WP3).
2. Execute remaining G2 parity lanes in replacement-design-checkpoint.md order: Cold Boot sequence → Asteroid gameplay → Mission/route-feed.
3. Complete SW-13 M5 worksheet evidence fields and checklist (G5, WP4).
4. Publish SW-13 M6 go/no-go record with explicit blocker disposition (G5, WP4).
5. Re-verify SW-13B M1B/M2B evidence reproducibility (G4).
6. Update G1 documentation reconciliation across SW-13, SW-13A, SW-13B status docs once G2–G4 evidence is current.
7. Update this matrix from Draft to Accepted when G1–G5 are all pass.

## 7. Architecture Replacement Traceability (G2)

Milestone 4 semantic-correction intent was superseded by the Option A hard replace (2026-07-10 through 2026-07-11). Evidence below reflects the replacement milestone chain.

| Milestone | Status | Evidence | Reviewer Note |
| --- | --- | --- | --- |
| M1 – Route cutover + per-ship ownership model | Complete | [ship-exterior-bare-scene.component.ts](../../src/app/scene/ship-exterior/ship-exterior-bare-scene.component.ts), [ship-scene-context.ts](../../src/app/scene/ship-exterior/ship-scene-context.ts), [ship-scene-registry.ts](../../src/app/scene/ship-exterior/ship-scene-registry.ts), [replacement-design-checkpoint.md](./replacement-design-checkpoint.md) §9 | Pete-confirmed. Old monolith deleted. Per-ship isolation baseline and deterministic A→B→A unit assertion in place. |
| M2 – Camera/pause hardening + context lifecycle | Complete | [ship-scene-context.vitest.ts](../../src/app/scene/ship-exterior/ship-scene-context.vitest.ts), [ship-scene-registry.vitest.ts](../../src/app/scene/ship-exterior/ship-scene-registry.vitest.ts), [replacement-design-checkpoint.md](./replacement-design-checkpoint.md) §11 | Pete-confirmed. A→B→C→A continuity PASS, no cross-bleed PASS, active-only animation PASS, session teardown PASS. |
| M3A – Starfield visual parity | Complete | [replacement-design-checkpoint.md](./replacement-design-checkpoint.md) §12.5 | Pete-confirmed. Per-ship starfield seed stable across switching; isolated per-context. |
| M3B – Orbit controls lane | Complete | [replacement-design-checkpoint.md](./replacement-design-checkpoint.md) §12.7 | Pete-confirmed. Active-context camera orbit/pan/zoom; inactive contexts paused; no cross-context camera mutation. |
| M3C – Flight lane | Complete | [replacement-design-checkpoint.md](./replacement-design-checkpoint.md) §12.15, [sw-13-closure-status-2026-07-10.md](./sw-13-closure-status-2026-07-10.md) | Pete-confirmed. Active-only flight toggle/WASD; inactive pause during flight; A→B→A flight state per ship. |
| Cold Boot sequence lane | Open | — | Not yet started. Next parity lane in replacement-design-checkpoint.md ordering. |
| Asteroid gameplay lane | Open | — | Not yet started. Follows Cold Boot lane. |
| Mission/route-feed lane | Open | — | Not yet started. Highest async/contract complexity; last in parity lane order. |
