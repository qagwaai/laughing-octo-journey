# Asteroid Visual Fidelity Implementation Plan

Status: Draft implementation plan (May 2026)
Owner: Gameplay + Scene Rendering
Scope: First-target ship-exterior asteroid presentation, scan-reveal fidelity, and scene-wide performance policy

## 1. Goals

1. Make asteroid scanning feel like a meaningful reveal moment.
2. Increase immersion via material realism and reflective response.
3. Keep performance stable as scene complexity grows (asteroids + ship parts + pirate ships + stations + props).
4. Preserve deterministic behavior and existing mission progression.

## 2. Non-Goals (for this plan)

1. No full backend schema overhaul in initial implementation.
2. No custom shader pipeline in the first pass.
3. No high-cost procedural mesh displacement in the first pass.

## 3. Current Constraints and Assumptions

1. Current asteroid field count is 5-20 active asteroids.
2. Future mixed scene entities are expected and will compete for frame budget.
3. Asteroid identity already includes deterministic seed behavior and serverCelestialBodyId mapping.
4. Existing scan reveal pulse/animation is available for transition timing.

## 4. Architecture Decision Summary

1. Scan-complete is the trigger for high-fidelity reveal.
2. Pre-scan asteroids stay intentionally low-detail for readability and budget safety.
3. High-detail rendering is capped and prioritized to interaction-relevant asteroids.
4. Scene-wide tiering policy governs quality levels (Hero, Active Nearby, Background).

## 5. Phased Delivery Plan

## Phase 1 - Scan-Reveal Geometry and Material Profiles

Objective:
Ship scan-triggered visual reveal with minimal code risk and no backend contract changes.

Planned code changes:

1. Expand asteroid material catalog with PBR fields.
File: [src/app/model/catalog/asteroid-materials.ts](src/app/model/catalog/asteroid-materials.ts)
Changes:
- Add roughness and metalness fields to AsteroidMaterialProfile.
- Optionally add emissiveBoost for special materials.
- Populate values for all materials.

2. Add reveal-state material resolution in asteroid component.
File: [src/app/component/asteroid.ts](src/app/component/asteroid.ts)
Changes:
- Add computed values for pbrRoughness and pbrMetalness.
- Keep pre-scan visual as current low-information style.
- Switch to revealed PBR profile when scanned.

3. Bind PBR fields in asteroid template material.
File: [src/app/component/asteroid.html](src/app/component/asteroid.html)
Changes:
- Bind roughness and metalness to ngt-mesh-standard-material.
- Keep existing emissive behavior; layer optional emissiveBoost.

4. Make scan-complete geometry reveal explicit.
File: [src/app/component/asteroid.ts](src/app/component/asteroid.ts)
Changes:
- Pre-scan geometry detail: low (0 or 1).
- Post-scan geometry detail: high (target detail 2 for supported shapes).
- Keep octahedron lower-detail to preserve silhouette style unless tested otherwise.

Acceptance criteria:

1. Before scan, asteroids remain low-detail and gameplay-readable.
2. On scan completion, geometry visibly upgrades and material fidelity increases.
3. No mission logic regressions in scan/target/launch flow.
4. Deterministic session behavior preserved for same seed inputs.

Validation:

1. Focused unit tests for asteroid component behavior:
- Add or update tests in [src/app/component/asteroid.spec.ts](src/app/component/asteroid.spec.ts) if present.
- If no spec exists, add one for pre-scan vs post-scan property resolution.
2. Mission deterministic behavior tests remain green in [src/app/mission/first-target-ship-exterior-mission.spec.ts](src/app/mission/first-target-ship-exterior-mission.spec.ts).
3. Run focused impacted tests first, then broader suite as needed.

## Phase 2 - Scene Environment Reflection and Tiered LOD Policy

Objective:
Add high-impact reflection quality and introduce immediate quality tiering to protect mixed-scene performance.

Planned code changes:

1. Add scene environment map setup.
File: [src/app/scene/ship-exterior-view.ts](src/app/scene/ship-exterior-view.ts)
Changes:
- Configure scene.environment using a lightweight HDR path.
- Keep BackgroundStars as visual backdrop (do not replace scene background).
- Tune environment intensity for subtle realism.

2. Introduce tiering logic for asteroid detail assignment.
Files:
- [src/app/scene/ship-exterior-view.ts](src/app/scene/ship-exterior-view.ts)
- [src/app/component/asteroid.ts](src/app/component/asteroid.ts)
Changes:
- Define rendering tiers: Hero, Active Nearby, Background.
- Prioritize targeted asteroid and actively scanned asteroid for high detail.
- Promote nearest 1-3 scanned asteroids to high detail.
- Cap mid detail to nearest 4-8.
- All others fallback to low detail.

3. Add frame-pressure fallback behavior.
File: [src/app/scene/ship-exterior-view.ts](src/app/scene/ship-exterior-view.ts)
Changes:
- Implement simple quality scaler hook for future telemetry-based tuning.
- Degrade order: Background first, then Active Nearby, keep Hero stable.

Acceptance criteria:

1. Reflection quality visibly improves metals after scan.
2. High-detail asteroid count never exceeds configured cap.
3. Targeted/scanned asteroids always remain in top quality tier.
4. Scene remains responsive under mixed entity load simulations.

Validation:

1. Add tier assignment unit tests near scene helpers (new spec file if needed).
2. Add deterministic priority tests for nearest/capped selection behavior.
3. Run focused tests for ship-exterior and first-target mission flows.

## Phase 3 - Diameter-Driven Scale Reveal

Objective:
Make asteroid size variation physically legible using existing estimated diameter data.

Planned code changes:

1. Map estimatedDiameterM to reveal-time visual scale.
File: [src/app/component/asteroid.ts](src/app/component/asteroid.ts)
Changes:
- Introduce clamped log-scale mapping for diameter -> mesh scale multiplier.
- Apply after scan for consistency with reveal model.
- Preserve existing artistic scale jitter as secondary variation.

Acceptance criteria:

1. Small and large asteroids are visually distinguishable post-scan.
2. Extremes do not break camera interaction or clipping expectations.
3. Scale remains deterministic for same sample input.

Validation:

1. Unit tests for scale mapping function boundaries.
2. Manual scene checks for close-pass and far-range readability.

## Phase 4 - Optional Backend Mesh Profile Persistence

Objective:
Persist visual identity across clients/sessions when required.

Planned code changes:

1. Add mesh profile key support in celestial body upsert flow.
File: [src/app/scene/ship-exterior/ship-exterior-celestial-body-controller.ts](src/app/scene/ship-exterior/ship-exterior-celestial-body-controller.ts)
Changes:
- Include a stable meshProfileKey in visualization payload (or dedicated field when contract is ready).

2. Consume persisted profile on resume.
Files:
- [src/app/mission/first-target-ship-exterior-mission.ts](src/app/mission/first-target-ship-exterior-mission.ts)
- [src/app/scene/ship-exterior-view.ts](src/app/scene/ship-exterior-view.ts)
Changes:
- Prefer server profile key when present.
- Fallback to deterministic local derivation when absent.

Acceptance criteria:

1. Visual profile survives resume and cross-client observation (where supported).
2. Fallback behavior is backward compatible for old records.

Validation:

1. Contract tests against socket payload shape.
2. Resume-flow tests for mixed old/new records.

## 6. Task Breakdown (Engineering Checklist)

## Foundation Tasks

1. Add/confirm asteroid component test coverage for reveal-state properties.
2. Add helper functions for material PBR resolution and geometry detail resolution.
3. Keep new logic isolated in pure functions where possible for deterministic tests.

## Performance Guardrail Tasks

1. Introduce constants for caps and tier distances in one place.
2. Add debug toggles for quality tier visualization (dev-only).
3. Add lightweight timing instrumentation hook for frame budget review.

## Content and UX Tasks

1. Tune PBR values per material class with one review pass.
2. Tune reveal transition timing to match scan completion feedback.
3. Validate readability under both idle and high-motion flight.

## 7. Test Strategy

Unit/component:

1. Asteroid pre-scan vs post-scan geometry/material assertions.
2. Tier assignment and cap enforcement logic tests.
3. Diameter-to-scale mapping boundary tests.

Integration/mission:

1. Deterministic asteroid generation remains stable.
2. Scan completion still advances mission gate and UI state.
3. Targeting/launch flow unaffected by visual layer changes.

E2E (focused):

1. First-target flow: scan asteroid and verify reveal occurs.
2. Dismiss/rejoin stability unaffected.
3. Mixed-entity performance smoke scenario (non-flaky, coarse threshold).

Recommended commands:

1. npm test -- --include="**/first-target-ship-exterior-mission.spec.ts"
2. npm test -- --include="**/ship-exterior-view*.spec.ts"
3. npm run test:ci (before merge)

## 8. Rollout and Risk Management

Risk areas:

1. Geometry reveal may introduce visual popping if transition timing is abrupt.
2. Added material realism may conflict with current scan readability if applied too early.
3. Tier selection logic can accidentally starve important entities if priority rules are wrong.

Mitigations:

1. Tie reveal switch precisely to existing scan completion pulse.
2. Keep pre-scan style unchanged.
3. Hard-priority targeted and actively scanned asteroid before distance sorting.
4. Add feature flags for staged rollout if needed.

Rollback strategy:

1. Keep reveal and tiering behind isolated helpers so each feature can be disabled independently.
2. Preserve fallback low-detail rendering path in all cases.

## 9. Definition of Done

1. Scan-triggered reveal is implemented and tested.
2. Material PBR profiles are active post-scan.
3. Scene environment reflections are integrated and tuned.
4. Tiered detail caps are enforced and verified.
5. No regressions in first-target mission progression/tests.
6. Documentation updated with final tuned constants and decisions.

## 10. Suggested Implementation Order (Execution Sequence)

1. Phase 1 core reveal behavior and tests.
2. Phase 2 environment map and tier caps.
3. Phase 3 diameter scaling.
4. Performance smoke validation with mixed-entity simulation.
5. Optional Phase 4 only when product requires persistent cross-client visual identity.
