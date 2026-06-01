# SW-13 Follow-Up Passes Backlog

Status: Planned  
Date: 2026-05-31  
Context: Post-closeout work intentionally deferred from the SW-13 current slice.

## Pass A: Ship-Exterior-View Fidelity Expansion

Goal: Bring ship-exterior-view visual presentation to the next fidelity tier while preserving deterministic behavior and testability.

### Scope

1. Expand object-family presentation richness in ship-exterior-view path.
2. Improve asteroid and celestial readability/variety in ship-exterior interactions.
3. Align ship-exterior family cues with viewer descriptor taxonomy where practical.
4. Preserve current interaction stability and performance characteristics.

### Deliverables

1. Ship-exterior-view fidelity design notes and implementation plan.
2. Targeted renderer/component updates for ship-exterior object families.
3. Unit/component tests for family selection and deterministic fallback behavior.
4. Manual-test checklist updates specific to ship-exterior-view.

### Acceptance Criteria

1. Family identities are visibly distinguishable in ship-exterior-view at gameplay distances.
2. No regression in interaction stability (navigation, input, selection flows).
3. Deterministic fallback behavior remains test-covered.
4. Build + impacted tests pass.

### Risks

1. Visual complexity can increase scene-controller coupling if not isolated.
2. Fidelity increases can regress frame-time stability without bounded budgets.

## Pass B: High-Poly Asset Pipeline and Runtime Substitution

Goal: Add high-poly asset support for selected external object families (starting with stations/celestial landmarks) with policy-driven substitution and fallback.

### Scope

1. Define high-poly asset catalog ownership and naming conventions.
2. Extend object contracts/view models to carry model asset references where required.
3. Implement runtime mesh substitution path (high-poly vs procedural fallback).
4. Add performance policy and LOD/fallback gates for balanced runtime behavior.

### Deliverables

1. Asset catalog entries and source-of-truth mapping documentation.
2. Renderer integration for model loading/substitution in targeted paths.
3. Contract and selector tests covering model-path and fallback-path behavior.
4. Manual and automated performance validation report.

### Acceptance Criteria

1. Targeted station/celestial families can render high-poly assets when policy allows.
2. Missing/invalid assets reliably fall back to deterministic procedural geometry.
3. No blocking regressions in scene load reliability.
4. Build + impacted tests pass; performance budget checks are documented.

### Risks

1. Asset payload and draw-call growth can exceed balanced-performance thresholds.
2. Contract drift risk increases if asset references are not OpenAPI-governed.

## Suggested Execution Order

1. Pass A first (ship-exterior fidelity parity and decomposition-safe changes).
2. Pass B second (asset pipeline and substitution once path boundaries are stable).

## Tracking Template

Use this per pass:

- Owner: ____________________
- Branch: ____________________
- Start Date: ____________________
- Target Date: ____________________
- Status: Not Started | In Progress | Blocked | Done
- Scope Notes: ____________________
- Test Evidence: ____________________
- Performance Notes: ____________________
- Contract/OpenAPI Changes: Yes/No (if Yes, list files)
