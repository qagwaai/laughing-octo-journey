# SW-13 External Object Presentation Expansion Implementation Plan (Nova + Forge)

Status: Draft (Execution Ready)
Date: 2026-05-30
Repo: laughing-octo-journey (Nova)
Related repo: solid-train (Forge)
Feature ID: SW-13
Priority Score Reference: 3.75 (Current score retained)

## 1. Objective

Deliver a visually richer and more legible ship-external experience by expanding object identity for debris, ships, jump gates, stations, and asteroids.

This slice is visual-readability first, balanced-performance, data-driven, and full-cutover with no legacy presentation support.

## 2. Planning Inputs (Captured via Intake)

1. In-scope surfaces:
- Debris mesh identity
- Ship silhouette families
- Jump gate landmark treatment
- Station landmark treatment
- Asteroid style spectrum from rocky irregular forms to cinematic hero-style variants
2. Performance target: balanced (visual richness with strict fallback strategy).
3. Pipeline approach: data-driven descriptors.
4. Priority placement: keep current score and ranking.
5. Constraints:
- No full 3D asset overhaul in SW-13.
- Keep scene architecture close to current shape.
- No legacy support paths; full cutover only.

## 3. Scope

In scope (SW-13 v1):
1. Descriptor-driven external object visual taxonomy.
2. Debris category identity pass with clearer mesh/profile differentiation.
3. Ship silhouette family pass for at-a-glance role/faction readability.
4. Jump gate landmark pass (shape, glow profile, framing cues).
5. Station landmark pass (persistent infrastructure readability).
6. Asteroid variety pass with rocky-to-cinematic style range.
7. Balanced-performance fallback rules validated in runtime.

Out of scope (defer):
1. Full scene renderer rewrite.
2. Full asset pipeline replacement.
3. Legacy presentation compatibility mode.

## 4. Core Rules

1. Data-driven descriptor contracts are source of truth for object presentation categories.
2. Visual identity must remain readable at gameplay distance and motion.
3. Performance fallback behavior must be deterministic and testable.
4. No legacy visual mapping fallback after cutover.
5. Scene architecture changes remain minimal and localized.

## 5. High-Level Feature Set

1. Debris mesh identity
- Distinct debris families by salvage/value category.
- Better silhouette and material contrast for quick recognition.

2. Ship silhouette families
- Readable hull profiles by faction/role archetype.
- Distance-safe silhouettes that remain identifiable under motion.

3. Jump gate landmark treatment
- Strong landmark framing, emissive cues, and approach readability.
- Navigation-first presentation so gates are unmistakable.

4. Station landmark treatment
- Persistent structure silhouettes and scale cues.
- Better long-range recognition and contextual identity.

5. Asteroid style spectrum
- Add irregular rocky variants and cinematic hero variants.
- Avoid over-spherical repetition; enforce distribution mix across fields.

## 6. Workstreams

1. Descriptor contract and content model (Forge + Nova coordination)
- Define external object descriptor schema for families, cues, and fallback tiers.
- Add strict validation for descriptor completeness and enum correctness.
- Remove legacy descriptor mapping paths.

2. Nova external-object rendering integration
- Wire descriptor-driven visual selection in ship-external surfaces.
- Add distance-aware readability cues (silhouette emphasis, label hooks where needed).
- Keep scene decomposition impact narrow and testable.

3. Asset and variant curation (within constrained budget)
- Curate minimal but expressive variant sets for debris, ships, gates, stations, and asteroids.
- Establish asteroid distribution policy (rocky baseline, cinematic accents).
- Avoid full asset overhaul; focus on highest-value visual families.

4. Performance and fallback validation
- Define balanced-profile quality tiers.
- Validate FPS/memory behavior under dense external scenes.
- Confirm deterministic fallback activation with no identity collapse.

## Architecture and Quality Addendum (2026-05-30)

### Separation of concerns requirements

1. Keep descriptor interpretation separate from rendering implementation.
- Descriptor parsing and validation belongs in a dedicated adapter/service layer.
- Visual component logic should consume normalized view models, not raw contract payloads.

2. Isolate visual family selection from scene orchestration.
- Family/style resolution should be a pure, testable selector module.
- Scene lifecycle code should only request resolved presentation outputs.

3. Keep performance fallback policy centralized.
- Fallback thresholds and quality-tier decisions belong in one policy module.
- Object presenters must not embed ad hoc fallback behavior.

### Testability and maintainability requirements

1. Prefer pure functions for descriptor-to-view-model mapping and style selection.
2. Add deterministic fixtures (fixed seeds and explicit descriptor payloads) for all family domains.
3. Keep module boundaries small and composable to avoid scene-level monolith growth.
4. Add ADR notes for any exception to descriptor-first architecture.

### Contract drift prevention controls

1. Hard-fail CI on descriptor enum/domain drift.
2. Hard-fail CI on descriptor shape/type drift.
3. Hard-fail CI on legacy fallback reintroduction.
4. Keep local parity commands equivalent to CI checks.

### Recommended test stack for SW-13

1. Unit tests
- Descriptor normalization, family selection, fallback policy decisions.

2. Contract tests
- Canonical domain pass fixtures.
- Drift fixtures for casing mismatch, unsupported domain/value, and shape mismatch.

3. Component tests
- Render decisions for debris, ships, gates, stations, and asteroid style variants.

4. Route/scene smoke tests
- Object readability at representative gameplay distances and camera states.

5. Performance profile tests
- Balanced-profile thresholds in dense scenes with deterministic fallback assertions.

6. Canary checks
- Telemetry watch for descriptor violations, identity ambiguity reports, and performance regressions.

## 7. Verification Milestones

M0: Descriptor baseline lock
- Deliverables:
1. Descriptor schema and family taxonomy accepted.
2. Legacy mapping removal plan approved.
- Verification:
1. Intentional schema mismatch fixture fails hard.
2. Baseline descriptor fixture passes.

M1: Debris and asteroid identity pass
- Deliverables:
1. Debris family differentiation active.
2. Asteroid rocky-to-cinematic variant spectrum active.
- Verification:
1. Visual snapshot tests pass for key families.
2. Over-spherical asteroid regression fixture fails.

M2: Ship and station family pass
- Deliverables:
1. Ship silhouette families integrated.
2. Station landmark readability integrated.
- Verification:
1. Route-level scene smoke tests pass.
2. Recognition-distance checks meet threshold.

M3: Jump gate landmark pass
- Deliverables:
1. Gate visual treatment integrated with unmistakable cues.
2. Navigation readability behavior verified.
- Verification:
1. Gate approach/selection flow tests pass.
2. Ambiguity regression tests fail on weak-cue fixtures.

M4: Balanced-performance validation
- Deliverables:
1. Quality/fallback tiers validated in dense scenes.
2. No major identity loss under fallback.
- Verification:
1. Performance profile checks pass at agreed target.
2. Deterministic fallback tests pass.

M5: Canary visual validation
- Deliverables:
1. SW-13 enabled in canary-only path.
2. Visual readability telemetry and issue intake active.
- Verification:
1. Canary checklist passes.
2. No unresolved P1/P2 visual blockers in soak window.

M6: Release decision
- Deliverables:
1. Go/no-go record with M0-M5 evidence chain.
2. Cross-role sign-off and closure checklist completion.
- Verification:
1. Planning records updated to complete state.
2. No open legacy fallback references remain.

## 8. Risks and Mitigations

1. Risk: visual upgrades reduce performance in dense scenes.
- Mitigation: balanced-profile targets, deterministic fallback tiers, and canary soak metrics.

2. Risk: object identity remains ambiguous at distance.
- Mitigation: silhouette-first design rules and recognition-distance validation.

3. Risk: scope drifts into architecture rewrite.
- Mitigation: strict boundary on localized integrations and explicit no-rewrite guardrail.

4. Risk: coupling regressions reduce long-term maintainability.
- Mitigation: enforce adapter boundaries, pure selector modules, and code-review checks for separation of concerns.

## 9. Exit Criteria

1. SW-13 milestones M0-M6 closed with evidence.
2. External object families are visually distinct and readable in target contexts.
3. Asteroid fields show intentional rocky-to-cinematic variation, not spherical monotony.
4. Balanced-performance targets hold with deterministic fallback behavior.
5. Full cutover complete with no legacy presentation fallback path.
