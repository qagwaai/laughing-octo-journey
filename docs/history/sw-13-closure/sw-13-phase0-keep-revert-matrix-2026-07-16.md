# SW-13 Phase-0 Keep/Revert Matrix (2026-07-16)

Status owner: Nova (frontend)
Related plan: sw-13-test-foundation-investment-plan-2026-07-11.md
Purpose: Record explicit keep/revert decisions for the original 15-file mixed change set to maintain track isolation.

## Decision Rules

1. Keep in stabilization track when the file directly supports deterministic readiness, state-machine reliability, or test harness stability.
2. Revert from stabilization track when the file belongs to Milestone-3C visual/scene feature delivery.
3. Keep planning docs in stabilization track as long as they explain test-foundation decisions and review checkpoints.

## File-Level Matrix

| File | Domain | Decision | Target Track | Rationale |
| --- | --- | --- | --- | --- |
| e2e/page-objects/game-shell.page.ts | e2e harness | Keep | Stabilization | Supports intent-level navigation and stable e2e interaction surfaces. |
| e2e/tests/ship-exterior-hangar-resume.spec.ts | e2e critical path | Keep | Stabilization | Core failing flow under SW-13 test-foundation investment. |
| src/app/page/game/ship-hangar.ts | production readiness/state machine | Keep | Stabilization | Contains hangar load state formalization and readiness publication behavior. |
| src/app/services/socket.service.ts | production transport reliability | Keep | Stabilization | Required for correlation/reliability safeguards observed during stabilization. |
| src/app/services/ship.service.ts | production transport reliability | Keep | Stabilization | Supports deterministic ship-list request/response behavior used by hangar lifecycle. |
| src/app/services/ship-exterior-socket.service.ts | production transport reliability | Keep | Stabilization | Supports ship-exterior route stability under e2e state transitions. |
| src/app/services/ship-exterior-view-state.service.ts | production state safety | Keep | Stabilization | Supports stable cross-route state retention for testability. |
| src/app/scene/ship-exterior/ship-exterior-bare-scene.component.ts | Milestone-3C feature | Revert | Milestone-3C Feature | Scene feature delivery scope, not required for readiness foundation. |
| src/app/scene/ship-exterior/ship-exterior-bare-scene.component.html | Milestone-3C feature | Revert | Milestone-3C Feature | Template-level visual feature work should remain isolated from stabilization. |
| src/app/scene/ship-exterior/ship-exterior-bare-scene.component.css | Milestone-3C feature | Revert | Milestone-3C Feature | Visual styling belongs to feature track, not test foundation. |
| src/app/scene/ship-exterior/ship-exterior-bare-scene-test-api.ts | Milestone-3C feature integration | Revert | Milestone-3C Feature | Keep scene-specific test API evolution coupled to feature track ownership. |
| src/app/scene/ship-exterior/ship-scene-context.ts | Milestone-3C feature | Revert | Milestone-3C Feature | Scene lifecycle structure change belongs to architecture/feature lane. |
| src/app/scene/ship-exterior/ship-scene-types.ts | Milestone-3C feature | Revert | Milestone-3C Feature | Type-level scene feature expansion should not ride stabilization scope. |
| docs/planning/sw-13-closure/sw-13-closure-status-2026-07-10.md | program documentation | Keep | Stabilization | Records stabilization status and review evidence for SW-13 closure. |
| docs/planning/sw-13-closure/replacement-design-checkpoint.md | program documentation | Keep | Stabilization | Captures design checkpoint decisions relevant to stabilization governance. |

## Notes

1. This matrix documents track intent and review policy, not git history rewriting.
2. If a file listed as Revert has already been merged in shared branches, treat this as ownership and review-lane guidance for subsequent changes.
3. Any exceptions must be recorded in SW-13 closure docs with explicit reviewer approval.
