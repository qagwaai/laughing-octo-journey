# SW-13 Closure Plan

Status: Draft (Execution Ready)
Date: 2026-06-26
Owner model: Nova + Forge + reviewer roles
Primary reviewer: Pete
Policy: No legacy support paths

## Visual Indicators

| Marker | Meaning |
| --- | --- |
| ☐ | Not started / Open |
| ◧ | In progress / Partial |
| ☑ | Done / Complete |
| ⚠ | Blocked / needs decision |

## Closure Snapshot

- ☐ G1 Documentation reconciliation
- ⚠ G2 Multi-ship retained scene architecture
- ◧ G3 Route-feed completeness reconciliation
- ◧ G4 SW-13B evidence integrity verification
- ☐ G5 M5 and M6 closeout records

Overall readiness: 0/5 gates green

## 1. Purpose

Close SW-13, SW-13A, and SW-13B with one unified plan that:

1. Reconciles what is complete vs what is still open.
2. Defines strict closure evidence.
3. Blocks closure until multi-ship ship-external-view scene retention is implemented.

## 2. Planning Inputs (Confirmed)

1. Closure mode: Hybrid (audit plus execution checklist).
2. Ownership style: Nova and Forge with reviewer roles.
3. Evidence policy: Strict.
4. Multi-ship gate: Required for closure.
5. Reviewer: Pete.
6. Constraint: No legacy support.

## 3. Current State Audit

### 3.1 SW-13

Current-state summary:

1. Closed for a constrained slice only.
2. Ship-external fidelity expansion was deferred by design.
3. M5 worksheet and M6 go/no-go evidence chain are still open in planning records.

Primary references:

1. [SW-13 closeout note](../sw-13/sw-13-closeout-note-2026-05-31.md)
2. [SW-13 follow-up backlog](../sw-13/sw-13-follow-up-passes-backlog-2026-05-31.md)
3. [SW-13 implementation plan](../sw-13/sw-13-external-object-presentation-implementation-plan.md)
4. [SW-13 M5 worksheet](../sw-13/sw-13-m5-manual-test-worksheet.md)

### 3.2 SW-13A

Current-state summary:

1. Documented as in progress for Nova-only scope.
2. Original gap list flagged gate/station/encounter ship feed dependencies.
3. Runtime code now includes contract-backed route feeds and scene hydration tests for gates, stations, and encounter ships.
4. Closure documentation has not been reconciled to this newer implementation evidence.

Primary references:

1. [SW-13A execution report](../sw-13a/sw-13a-execution-report-2026-05-31.md)
2. [Market route feed model](../../src/app/model/market-list.ts)
3. [Ship-exterior route feed adapter](../../src/app/scene/ship-exterior/ship-exterior-route-feed-adapter.ts)
4. [Ship-exterior scene route feed hydration](../../src/app/scene/ship-exterior-view.ts)
5. [Ship-exterior route feed hydration test](../../src/app/scene/ship-exterior-view.vitest.ts)

### 3.3 SW-13B

Current-state summary:

1. Visual/determinism closure evidence exists for M1B and M2B.
2. Documents are scoped to asteroid visual/determinism validation.
3. Multi-ship persistent per-ship scene retention is not a completed SW-13B gate.

Primary references:

1. [SW-13B visual implementation plan](../sw-13b/sw-13b-m1b-m2b-visual-implementation-plan-2026-06-02.md)
2. [SW-13B M2B execution brief](../sw-13b/sw-13b-m2b-ship-external-view-execution-brief-2026-06-02.md)
3. [SW-13B evidence pack](../sw-13b/sw-13b-m1b-m2b-evidence-pack-2026-06-04.md)

## 4. Closure Decision Model

Global closure rule:

1. SW-13 family is not closed until all gates in Section 5 are green.
2. Any red gate blocks go/no-go regardless of partial stream completion.
3. No legacy fallback/remap path may be introduced to satisfy a gate.

## 5. Required Gates (Strict)

### Gate G1: Documentation Reconciliation

Indicator: ☐ Open

Pass criteria:

1. SW-13, SW-13A, and SW-13B status docs are aligned to current code reality.
2. Deferred, complete, and blocked items are explicitly separated.
3. One canonical closure matrix is published in this folder.

Owner: Nova
Reviewer: Pete

### Gate G2: Multi-Ship Ship-External Scene Retention (Hard Blocker)

Indicator: ⚠ Blocked

Pass criteria:

1. Each ship owns its own ship-external-view scene instance keyed by playerName + characterId + shipId.
2. Ship switching is activation-switch only (no restore/reseed for initialized scenes).
3. Scene hydration is lazy (first View Exterior for uninitialized ships only), using seed-first then backend reconcile.
4. Inactive scenes are fully paused and remain resident until logout.
5. Async payloads are routed only to owning ship scene context.
6. No cross-ship state bleed is present, and lifecycle/memory bounds are documented and validated.
7. Execution mode is explicitly declared as architecture replacement (not patching) before implementation starts.

Owner: Nova
Reviewer: Pete

Current evidence (Slice 1, 2026-06-29):

1. Milestone 3 delivered ship-keyed state capture/restore baseline, but reviewer validation marked a semantic mismatch against keep-alive scene expectations.
2. Canonical G2 semantic authority is documented in `docs/planning/sw-13-closure/sw-13-multi-ship-scene-retention-note.md`.
3. Milestone 4 remains blocked until true per-ship scene-instance architecture is implemented.
4. Existing Milestone 4 unit-validation evidence in `src/app/scene/ship-exterior-view.vitest.ts` is non-blocking and non-sufficient:
	- `M4: should preserve ship-scene context identity across A -> B -> A without reconstruction`
	- `M4: should enforce active-only scene data on ship switch with no cross-ship residue`
	- `M4: should not invoke reseed/reload path when switching between already-initialized ship scenes`
5. Reviewer manual validation reports architecture failures (rotation and scan-tier cross-context bleed).
6. Targeted e2e coverage exists in `e2e/tests/ship-exterior-multi-ship-keepalive.spec.ts` but does not yet prove true concurrent per-ship scene-instance behavior:
	- `preserves per-ship scene marker across active-ship switches`

### Gate G3: Route Feed Completeness for SW-13A Family Coverage

Indicator: ◧ In progress

Pass criteria:

1. Gates, stations, and encounter ships are contract-fed and rendered in ship-external view.
2. Tests verify hydration and deterministic rendering decisions for these families.
3. Any remaining contract constraints are explicitly marked with owning team and due date.

Owner: Forge for contract authority, Nova for runtime integration verification
Reviewer: Pete

### Gate G4: SW-13B Visual and Determinism Evidence Integrity

Indicator: ◧ In progress

Pass criteria:

1. Existing SW-13B evidence links remain valid and reproducible.
2. No regressions in deterministic fallback semantics for ship-external asteroid presentation.
3. Evidence references are tied into this closure package.

Owner: Nova
Reviewer: Pete

### Gate G5: M5 and M6 Closeout Records

Indicator: ☐ Open

Pass criteria:

1. SW-13 M5 worksheet is completed with evidence artifacts.
2. SW-13 M6 go/no-go record is published with M0-M5 evidence chain.
3. Final closure note references this package and records reviewer decision.

Owner: Nova
Reviewer: Pete

## 6. Execution Work Packages

### WP0: Replacement-Mode Communication Contract

Tasks:

1. Require an explicit pre-implementation declaration: "architecture replacement, not bug-fix patching".
2. Require deletion intent to be listed before coding: old paths/components to remove.
3. Require stop-and-replan when proposed changes preserve restore-first behavior.
4. Reject compatibility shims/fallback paths for G2 unless reviewer-approved as temporary diagnostics only.

Trigger language (user/reviewer -> execution owner):

1. "Replace architecture, do not patch behavior."
2. "Remove and replace this subsystem."
3. "No incremental fixes, no compatibility layer, no restore choreography."
4. "If your plan preserves current structure, stop and redesign."

Output:

1. Pre-implementation note in PR/plan comment listing:
	- old pattern being removed
	- new runtime ownership model
	- fallback paths explicitly removed

### WP1: Build Canonical Closure Matrix

Tasks:

1. Create a matrix table mapping each milestone item to status: complete, partial, blocked, or superseded.
2. Attach source references for every status row.
3. Flag contradictions between plan docs and runtime implementation.

Output:

1. docs/planning/sw-13-closure/sw-13-closure-matrix.md

### WP2: Implement Multi-Ship Retained Scene Architecture

Tasks:

1. Implement true per-ship scene instances for ship-external runtime, keyed by playerName + characterId + shipId.
2. Keep lazy scene initialization for uninitialized scenes and seed first with backend reconcile.
3. Ensure ship switching activates only the selected scene and does not run restore/reseed for initialized scenes.
4. Keep inactive scenes fully paused while resident until logout.
5. Route async responses to owning scene only and prevent active-scene cross writes.
6. Add unit/integration/manual tests for active-only switching, non-bleed guarantees, and bounded lifecycle behavior.
7. Document lifecycle behavior, cleanup policy, and memory bounds.

Output:

1. Code changes under src/app/scene and src/app/services
2. Test evidence in vitest and targeted e2e where applicable
3. Design note in docs/planning/sw-13-closure/sw-13-multi-ship-scene-retention-note.md

Execution update (2026-06-29):

1. Milestone 3 baseline implementation landed for ship-swap retained-state capture/restore.
2. Reviewer validation failed Milestone 3 due to semantic mismatch with keep-alive scene expectations.
3. Milestone 4 is the next execution slice to implement true keep-alive active-scene switching semantics.
4. Milestone 4 Step 2 implementation landed in `src/app/scene/ship-exterior-view.ts` and acceptance-gate tests were enabled in `src/app/scene/ship-exterior-view.vitest.ts`.
5. Reviewer-reported unit validation is green for the updated ship-exterior test suite.

Milestone 4 scope (G2 semantic-correction slice):

1. Implement keep-alive per-ship scene contexts as primary runtime behavior.
2. Enforce active-only scene display when switching ships.
3. Remove restore-first continuity assumptions from G2 acceptance path.
4. Add focused validation evidence proving no reconstruction dependency on swap.
5. Link Milestone 4 evidence to `docs/planning/sw-13-closure/sw-13-closure-matrix.md` and `docs/planning/sw-13-closure/sw-13-multi-ship-scene-retention-note.md`.

Milestone 4 validation disposition (current):

1. Unit validation: Informative only.
2. Manual/e2e validation: Not passing G2 architecture criteria.

### WP3: Reconcile SW-13A Report to Current Implementation

Tasks:

1. Update SW-13A report status and gap sections to reflect implemented route feed support.
2. Retain any true open constraints with owner and target date.
3. Link updated report to closure matrix.

Output:

1. Updated SW-13A report or addendum in docs/planning/sw-13a

### WP4: Complete SW-13 M5 and M6 Records

Tasks:

1. Execute and fill remaining M5 manual worksheet fields and evidence checklist.
2. Publish M6 go/no-go decision record with blocker disposition.
3. Add closure sign-off block.

Output:

1. Updated SW-13 M5 worksheet
2. New SW-13 M6 go-no-go document in docs/planning/sw-13

## 7. Evidence Requirements (Strict)

Required evidence set:

1. Doc evidence: updated status docs and closure matrix.
2. Code evidence: links to implementation files for multi-ship retention and route-feed coverage.
3. Test evidence: targeted tests for ship swap retention, family feed hydration, and fallback determinism.
4. Manual evidence: completed M5 worksheet assets.
5. Release evidence: M6 go/no-go record signed by reviewer Pete.

## 8. Risks and Controls

1. Risk: Closure drift between docs and code.
Control: Closure matrix as single source of truth.

2. Risk: Multi-ship retention introduces memory/state leaks.
Control: explicit cleanup policy, bounded cache policy, and lifecycle tests.

3. Risk: Contract ambiguity between feeds and renderer expectations.
Control: Forge-owned contract checks with Nova fixture tests.

4. Risk: Reintroduction of legacy fallback behavior.
Control: enforce no-legacy rule in code review and closure checklist.

## 9. Exit Criteria

SW-13, SW-13A, and SW-13B are considered closed only when:

1. Gates G1 through G5 are all pass.
2. Reviewer Pete records final go decision.
3. No unresolved blocker remains in multi-ship ship-external scene retention.

## 10. Closure Sign-Off

Decision: Pending

Sign-off indicator: [ ] OPEN
Sign-off indicator: ☐ Open

1. Nova owner sign-off: ____________________
2. Forge owner sign-off: ____________________
3. Reviewer Pete sign-off: ____________________
4. Date: ____________________
