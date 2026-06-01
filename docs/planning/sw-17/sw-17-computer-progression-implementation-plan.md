# SW-17 Computer Progression Implementation Plan (Nova + Forge)

Status: Draft (Execution Ready)
Date: 2026-05-30
Repo: laughing-octo-journey (Nova)
Related repo: solid-train (Forge)
Feature ID: SW-17
Priority Score Reference: 4.20 (Top-5 active net-new)

## 1. Objective

Deliver a per-ship Computer Progression system with 10 installable tiers that expands intelligence support from basic scan assistance to coordinated advisory guidance.

This feature is skill and level gated, advisory-first, and limited to light automation with explicit player confirmation.

## 2. Planning Inputs (Captured via Intake)

1. Tier count: 10 tiers with granular progression.
2. Unlock model: combined skill + level gating.
3. Mandatory features: prescan asteroids, identify pirates, identify market opportunities, route risk estimation, auto-target suggestion, mission suitability scoring.
4. Additional features: solar weather prediction, humor setting.
5. Automation policy: light automation only.
6. Priority target: top 5.

## 3. Scope

In scope (SW-17 v1):
1. Per-ship computer installation model with immutable installed tier per ship until upgrade action.
2. Computer Systems Installation skill track and level thresholds for tier unlocks.
3. 10-tier capability ladder with deterministic feature unlock mapping.
4. Advisory UI surfaces for scan, threat, route, mission, and market guidance.
5. Explicit confirmation flow for any light automation action.
6. Cross-repo contract alignment for computer capability and recommendation payloads.

Out of scope (defer):
1. Full autonomous execution of trade/combat/mission actions.
2. Fleet-wide shared computer tier state.
3. Non-deterministic recommendation models that cannot be tested with fixed fixtures.

## 4. Core Rules

1. Computer hardware is installed per ship.
2. Installing or upgrading tier N requires:
- Computer Systems Installation skill >= threshold(N)
- Character level >= threshold(N)
3. Feature unlock is tier-driven and deterministic.
4. Light automation actions always require user confirmation.
5. No fallback to hidden automation behavior.

## 5. Proposed Tier Capability Ladder

1. Tier 1: Basic scanner signal cleanup and confidence indicator.
2. Tier 2: Prescan asteroids (composition and rough yield confidence).
3. Tier 3: Pirate signature hints (weak/strong threat bands).
4. Tier 4: Market opportunity highlights (spread and restock hints).
5. Tier 5: Route risk estimation (hazard score by route segment).
6. Tier 6: Auto-target suggestion (objective-aware shortlist).
7. Tier 7: Mission suitability scoring (cargo, ship state, location fit).
8. Tier 8: Solar weather forecast (localized interference window).
9. Tier 9: Humor and comms tone presets for assistant callouts.
10. Tier 10: Coordinated advisory mode (combined threat/route/market stack).

## 6. Workstreams

1. Forge contract and persistence updates
- Add ship computer install schema and tier capability descriptors.
- Add install/upgrade validation paths for skill and level thresholds.
- Persist per-ship installed tier state.

2. Nova UX and interaction updates
- Add ship computer panel with tier visibility and unlock reasons.
- Render advisory outputs for unlocked capabilities.
- Add explicit confirmation modal for light automation actions.

3. Skill progression and gating
- Add Computer Systems Installation progression model.
- Define deterministic level thresholds for tier upgrades.
- Ensure unlock reason strings are exposed for blocked installs.

4. Verification and release guardrails
- Contract checks for tier payload integrity and enum constraints.
- Component and route smoke tests for advisory surfaces.
- Canary-only rollout with recommendation quality and error monitoring.

## 7. Verification Milestones

M0: Contract and capability baseline lock
- Deliverables:
1. SW-17 capability contract draft reviewed and accepted.
2. Per-ship tier persistence model approved.
- Verification:
1. Intentional contract mismatch fixture fails.
2. Baseline capability fixture passes.

M1: Tier model and persistence
- Deliverables:
1. Tier install and upgrade APIs/events defined.
2. Per-ship tier persistence wired and tested.
- Verification:
1. Integration tests for install/upgrade lifecycle pass.
2. Invalid persistence shape fails strict checks.

M2: Skill + level gate enforcement
- Deliverables:
1. Computer Systems Installation skill progression enabled.
2. Tier upgrades blocked unless both gates pass.
- Verification:
1. Unit tests for gate threshold boundaries pass.
2. Negative tests for insufficient skill/level fail correctly.

M3: Advisory feature surfacing
- Deliverables:
1. Tier unlock map drives UI advisory availability.
2. Mandatory features visible at their designated tiers.
- Verification:
1. Component tests for unlock visibility and reasons pass.
2. Route-level smoke tests for computer panel pass.

M4: Light automation confirmation safety
- Deliverables:
1. Confirmation flow required before assist action execution.
2. No silent action execution path remains.
- Verification:
1. Negative tests assert no execution without confirm.
2. Interaction tests assert execution only after confirm.

M5: Canary validation
- Deliverables:
1. SW-17 enabled in canary only.
2. Recommendation quality and incident thresholds monitored.
- Verification:
1. Canary checklist passes.
2. No unresolved P1/P2 incidents during agreed soak window.

M6: Release decision
- Deliverables:
1. Go/no-go record with evidence chain M0-M5.
2. Closure checklist complete with cross-role sign-off.
- Verification:
1. Cross-repo index updated.
2. SW-17 marked complete in planning records.

## 8. Risks and Mitigations

1. Risk: over-automation erodes player agency.
- Mitigation: advisory-first model and mandatory confirmation.

2. Risk: recommendation noise reduces trust.
- Mitigation: confidence labels and deterministic fixture validation.

3. Risk: gate complexity causes progression confusion.
- Mitigation: explicit unlock reason text for every blocked tier.

## 9. Exit Criteria

1. All milestones M0-M6 closed with evidence.
2. Skill and level gate behavior validated with strict negative tests.
3. Per-ship installation persistence validated across ship swaps.
4. Cross-repo contracts and UI behaviors are aligned and drift-safe.
