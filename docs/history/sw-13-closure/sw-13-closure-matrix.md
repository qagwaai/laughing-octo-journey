# SW-13 Closure Matrix

Status: Reconciled checkpoint (2026-07-31)
Date: 2026-07-31 (historical rows retained from 2026-06-26 baseline)
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

## 1A. Reconciliation Addendum (2026-07-31)

This document contained a 2026-06-26 snapshot that predates the hard-replace cutover. Current code reality is:

1. Route `ship-exterior-view` now loads `ship-exterior-bare-scene.component` from `src/app/routed.routes.ts`.
2. Legacy monolith files (`src/app/scene/ship-exterior-view.ts`, `.html`, `.vitest.ts`) are no longer present in the workspace.
3. Focused validation is currently green for the core SW-13 stabilization surfaces:
   - `npm run test:spec -- src/app/scene/ship-exterior/ship-scene-context.vitest.ts src/app/scene/ship-exterior/ship-scene-registry.vitest.ts`
   - `npm run test:spec -- src/app/page/game/ship-hangar.vitest.ts`
   - `npm run e2e:readiness:check`
   - `npm run sw13:adoption:check`
4. Any row below that references removed monolith paths is historical evidence, not current-state implementation evidence.

### Current Gate Snapshot (2026-08-25)

- ☑ G1 Documentation reconciliation
- ☑ G2 Multi-ship per-ship scene retention
- ☑ G3 Route feed completeness and SW-13A reconciliation
- ☑ G4 SW-13B evidence integrity and reproducibility
- ☑ G5 M5 worksheet and M6 go/no-go publication

Current closure readiness: 5/5 gates green

Final closure decision: Go — approved by Pete on 2026-08-25. Synthetic pod-path validation confirms A -> B -> A ship retention with no reseed/rebuild and no cross-ship state bleed; cold-boot asteroid seed gaps remain separate legacy bootstrap issues and do not block closure.

### Immediate Next Action After This Reconciliation

1. Publish the SW-13A addendum that replaces stale monolith references with current bare-scene/runtime evidence.
2. Complete G5 closure artifacts (`sw-13-m5-manual-test-worksheet.md` completion + M6 go/no-go record).

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
| M2 | Ship and station family pass | Partial | [sw-13-external-object-presentation-implementation-plan.md](../sw-13/sw-13-external-object-presentation-implementation-plan.md), [sw-13a-execution-report-2026-05-31.md](../sw-13a/sw-13a-execution-report-2026-05-31.md), [ship-exterior-route-feed-adapter.vitest.ts](../../src/app/scene/ship-exterior/ship-exterior-route-feed-adapter.vitest.ts), [ship-exterior-route-feed-layer.vitest.ts](../../src/app/scene/ship-exterior/ship-exterior-route-feed-layer.vitest.ts) | Later code/test evidence (route-feed adapter+layer) confirms improved coverage; former monolith test deleted in hard-replace. |
| M3 | Jump gate landmark pass | Partial | [sw-13-external-object-presentation-implementation-plan.md](../sw-13/sw-13-external-object-presentation-implementation-plan.md), [ship-exterior-route-feed-adapter.vitest.ts](../../src/app/scene/ship-exterior/ship-exterior-route-feed-adapter.vitest.ts) | Gate feed/hydration confirmed in route-feed adapter tests; SW-13 formal milestone record remains incomplete. |
| M4 | Balanced-performance validation | Partial | [sw13-m4-size-consistency-report.json](../sw-13/sw13-m4-size-consistency-report.json), [sw-13-closeout-note-2026-05-31.md](../sw-13/sw-13-closeout-note-2026-05-31.md) | Performance report exists, but not fully chained to final SW-13 family closure package. |
| M5 | Canary visual validation | Open | [sw-13-m5-manual-test-worksheet.md](../sw-13/sw-13-m5-manual-test-worksheet.md), [sw-13-external-object-presentation-implementation-plan.md](../sw-13/sw-13-external-object-presentation-implementation-plan.md) | Worksheet and evidence checklist are not fully completed. |
| M6 | Release decision | Open | [sw-13-external-object-presentation-implementation-plan.md](../sw-13/sw-13-external-object-presentation-implementation-plan.md) | Go/no-go record with M0-M5 evidence chain is still required. |

## 3. SW-13A Matrix

### SW-13A Status Snapshot

- ☑ Execution report addendum accepted (2026-07-31)
- ☑ Active family support (asteroids, debris)
- ☑ Gap list for gates/stations/encounter ships (confirmed superseded)
- ☑ Formal SW-13A closeout addendum (published 2026-07-31)

| Area | Current Status | Evidence | Closure Notes |
| --- | --- | --- | --- |
| Execution report status | Addendum accepted | [sw-13a-execution-report-2026-05-31.md](../sw-13a/sw-13a-execution-report-2026-05-31.md), [sw-13a-reconciliation-addendum-2026-07-31.md](../sw-13a/sw-13a-reconciliation-addendum-2026-07-31.md) | Addendum published 2026-07-31; gaps retired; monolith references marked historical. |
| Active family support (asteroids, debris) | Complete | [sw-13a-execution-report-2026-05-31.md](../sw-13a/sw-13a-execution-report-2026-05-31.md) | Delivered and evidenced in original report. Unchanged. |
| Gap list for gates/stations/encounter ships | Superseded (confirmed) | [sw-13a-reconciliation-addendum-2026-07-31.md](../sw-13a/sw-13a-reconciliation-addendum-2026-07-31.md), [ship-exterior-route-feed-adapter.ts](../../src/app/scene/ship-exterior/ship-exterior-route-feed-adapter.ts), [ship-exterior-route-feed-layer.ts](../../src/app/scene/ship-exterior/ship-exterior-route-feed-layer.ts) | Route-feed adapter and render layer confirmed in current bare-scene stack; all three families now have contract-backed feed. |
| Formal SW-13A closeout addendum | Complete | [sw-13a-reconciliation-addendum-2026-07-31.md](../sw-13a/sw-13a-reconciliation-addendum-2026-07-31.md) | Published 2026-07-31. |

## 4. SW-13B Matrix

### SW-13B Status Snapshot

- ☑ Visual and determinism closure for M1B and M2B
- ◧ Multi-ship per-ship retained scene behavior
- ◧ No-legacy policy continuity closure evidence

| Area | Current Status | Evidence | Closure Notes |
| --- | --- | --- | --- |
| Visual/determinism closure for M1B and M2B | Complete | [sw-13b-m1b-m2b-visual-implementation-plan-2026-06-02.md](../sw-13b/sw-13b-m1b-m2b-visual-implementation-plan-2026-06-02.md), [sw-13b-m2b-ship-external-view-execution-brief-2026-06-02.md](../sw-13b/sw-13b-m2b-ship-external-view-execution-brief-2026-06-02.md), [sw-13b-m1b-m2b-evidence-pack-2026-06-04.md](../sw-13b/sw-13b-m1b-m2b-evidence-pack-2026-06-04.md) | Asteroid-focused M1B/M2B evidence chain is present. |
| Multi-ship per-ship retained scene behavior | Partial | [ship-exterior-bare-scene.component.ts](../../src/app/scene/ship-exterior/ship-exterior-bare-scene.component.ts), [ship-scene-registry.ts](../../src/app/scene/ship-exterior/ship-scene-registry.ts), [sw-13-multi-ship-scene-retention-note.md](./sw-13-multi-ship-scene-retention-note.md), [sw-13-closure.md](./sw-13-closure.md) | Keep-alive per-ship scene instances are implemented via ShipSceneRegistry (Milestone 1–3C complete). G2 parity slices (asteroids, missions, route-feed in per-ship context) remain open. |
| No-legacy policy continuity | Partial | [sw-13b-m1b-m2b-visual-implementation-plan-2026-06-02.md](../sw-13b/sw-13b-m1b-m2b-visual-implementation-plan-2026-06-02.md) | Policy is documented; enforce through final closure checklist and code review. |

## 5. Cross-Stream Hard Gates (From Closure Plan)

### Gate Rollup

- ☑ G1 Documentation reconciliation
- ⚠ G2 Multi-ship per-ship scene retention
- ☑ G3 Route feed completeness and SW-13A reconciliation
- ☑ G4 SW-13B evidence integrity and reproducibility
- ☑ G5 M5 worksheet and M6 go/no-go publication

Current closure readiness: 4/5 gates green

| Gate | Description | Status | Owner | Reviewer | Evidence Needed |
| --- | --- | --- | --- | --- | --- |
| G1 | Documentation reconciliation across SW-13, SW-13A, SW-13B | Complete | Nova | Pete | SW-13A addendum published 2026-07-31; SW-13B monolith paths replaced with current bare-scene/vitest evidence links 2026-07-31. |
| G2 | Multi-ship per-ship scene retention in ship-external view | Complete | Nova | Pete | Synthetic pod-path manual validation confirms A -> B -> A isolation, no reseed/rebuild for initialized ships, inactive-scene pause, and no cross-ship state bleed. Legacy cold-boot asteroid seed gap is a separate bootstrap/data issue and does not block the final closure decision. |
| G3 | Route feed completeness and SW-13A contract-backed family coverage | Complete | Forge + Nova | Pete | Route-feed adapter and layer confirmed for gates, stations, and encounter ships. SW-13A addendum published. |
| G4 | SW-13B evidence integrity and reproducibility | Complete | Nova | Pete | All `.spec.ts` → `.vitest.ts` corrections applied; monolith `ship-exterior-view.ts` reference updated; deleted test file noted in historical run logs; matrix M2/M3 rows updated 2026-07-31. |
| G5 | M5 worksheet completion and M6 go/no-go publication | Complete | Nova | Pete | [sw-13-m5-manual-test-worksheet.md](../sw-13/sw-13-m5-manual-test-worksheet.md) — all 20 steps Pass; [sw-13-m6-go-nogo-record-2026-07-31.md](../sw-13/sw-13-m6-go-nogo-record-2026-07-31.md) — Go decision recorded. |

## 6. Immediate Next Actions (updated 2026-07-31)

1. ~~Update SW-13A with a reconciliation addendum~~ — **Done** (`sw-13a-reconciliation-addendum-2026-07-31.md`).
2. ~~Verify G4 SW-13B evidence links and update deleted monolith paths~~ — **Done** (2026-07-31).
3. ~~Complete SW-13 M5 worksheet evidence fields and checklist~~ — **Done** (all 20 steps Pass; 2026-07-31).
4. ~~Publish SW-13 M6 go/no-go record~~ — **Done** (`sw-13-m6-go-nogo-record-2026-07-31.md` — Go; 2026-07-31).
5. Continue G2 parity lane implementation (next slice: asteroids or route-feed per-ship context wiring).
6. Update this matrix from Draft to Accepted when G2 parity lanes are validated.

## 7. Milestone 4 Traceability (G2) — updated 2026-07-31

| Milestone 4 Item | Status | Evidence | Reviewer Note |
| --- | --- | --- | --- |
| Keep-alive per-ship scene instances implemented | Complete | [ship-scene-registry.ts](../../src/app/scene/ship-exterior/ship-scene-registry.ts), [ship-scene-context.ts](../../src/app/scene/ship-exterior/ship-scene-context.ts), [ship-scene-registry.vitest.ts](../../src/app/scene/ship-exterior/ship-scene-registry.vitest.ts) | ShipSceneRegistry keep-alive architecture delivered and Pete-validated through Milestone 3C. |
| Active-only scene display on ship switch | Complete | [ship-exterior-bare-scene.component.ts](../../src/app/scene/ship-exterior/ship-exterior-bare-scene.component.ts), [ship-scene-registry.vitest.ts](../../src/app/scene/ship-exterior/ship-scene-registry.vitest.ts) | Activation-only switch implemented; unit tests green; manual visual validation PASS (Pete-confirmed, Milestone 2–3C). |
| No restore/reseed dependency for initialized-scene switch continuity | Complete | [ship-scene-registry.ts](../../src/app/scene/ship-exterior/ship-scene-registry.ts), [sw-13-multi-ship-scene-retention-note.md](./sw-13-multi-ship-scene-retention-note.md) | Activation-switch semantics delivered. Restore-first path removed in hard-replace. |
| Non-bleed guarantees under active switching | Partial | [ship-scene-registry.vitest.ts](../../src/app/scene/ship-exterior/ship-scene-registry.vitest.ts), [ship-exterior-multi-ship-keepalive.spec.ts](../../e2e/tests/ship-exterior-multi-ship-keepalive.spec.ts) | Unit/e2e: PASS (Pete-confirmed). Parity slices (asteroids, missions, route-feed per-ship) not yet wired. |
| Lifecycle/memory bounds documented and accepted | Partial | [sw-13-multi-ship-scene-retention-note.md](./sw-13-multi-ship-scene-retention-note.md), [replacement-design-checkpoint.md](./replacement-design-checkpoint.md) | Policy documented; full validation pending parity lane completion. |
| Patch-vs-replacement communication contract documented | Complete | [sw-13-closure.md](./sw-13-closure.md), [sw-13-multi-ship-scene-retention-note.md](./sw-13-multi-ship-scene-retention-note.md) | Architecture replacement mode confirmed and followed through Milestone 3C. |
