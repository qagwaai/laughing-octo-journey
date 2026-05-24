# Stellar Brainstorming Findings

Date: 2026-05-24
Session Type: Overarching brainstorming (foundation-first, momentum-aware)
Scope: laughing-octo-journey + solid-train
Primary source: docs/stellar-project-north-star.md

## Session Intent and Constraints

The session goal was to identify feature opportunities for Stellar while keeping Horizon 1 foundation hardening as the priority.

User direction captured:
- Foundation quality and architecture stability are first priority.
- Keep visible gameplay progress and motivating features in the near term.
- Treat this as open-world direction (including future NPC/system interactions).
- Identify small wins now and note longer-term big bets.
- Add autonomous backend NPC actors as a core direction, from small asteroid-belt pirates with single ships to kingpins commanding fleets.

## North Star Alignment Summary

The north-star document defines Stellar as a persistent exploration-first space RPG with:
- Meaningful decisions in exploration, economy, missions, and logistics.
- Scientifically grounded but readable spatial behavior.
- Asynchronous-friendly operations with interpretable return outcomes.
- Consequence-driven progression and continuity over long campaigns.

Most relevant filters used in this brainstorming:
1. Increases meaningful exploration or operations decisions.
2. Preserves or improves spatial/system clarity.
3. Deepens consequence, continuity, or strategic depth.
4. Is contract- and test-validatable in current architecture.
5. Moves a horizon goal forward.

## Cross-Repo Snapshot

### laughing-octo-journey (frontend)

Strengths:
- Broad playable surface area and route/page coverage for game loops.
- Solid domain-service direction around socket interactions.
- Existing mission plugin shape for extending scene behavior.

Primary risks/gaps:
- Testing quality risk from shadow-spec patterns (coverage confidence issue).
- Large complexity hotspot in scene file decomposition needs.
- Spatial UX readability can be improved for clarity under complexity.

Practical implication:
- Prioritize visible player-facing wins that can be implemented without destabilizing scene architecture.
- Pair each feature sprint with at least one testing/contract hardening action.

### solid-train (backend)

Strengths:
- Strong economy and market mechanics with deterministic behavior.
- Good handler/service structure and mature automated test base.
- Existing data/logic primitives for routing and location-aware operations.

Primary risks/gaps:
- Centralized context file carries high coordination and change risk.
- Mission progression exists but dynamic/branching mission behavior is still limited.
- Some persistence and lifecycle features (for long-running operations) are still partial.

Practical implication:
- Leverage current stable backend primitives for small wins first.
- Stage larger systemic expansions behind explicit dependency chains.

## Prioritized Feature Opportunities (Small Wins, 1-2 Sprints)

1. Mission Board Status Lanes
- Add Available / Active / Completed filtering and clearer progression visibility.
- Value: Better mission comprehension and agency with low architecture risk.

2. Market Opportunity Pings
- Surface meaningful market shifts/restocks as lightweight opportunities.
- Value: Immediate economy excitement and better route/timing behavior.

3. Quick Dock to Trade Flow
- Reduce friction between spatial context and market action.
- Value: Strong short-session loop completion and player momentum.

4. Fabrication Queue Timeline (UI-first)
- Show queued/active/completed fabrication jobs with timestamps.
- Value: Tangible industrial progression and continuity feel.

5. Ship Condition Badges in Hangar
- Surface damage/condition state prominently in fleet UX.
- Value: Improves consequence readability and repair decision quality.

6. Discovery Log v1
- Record first-seen bodies, scan milestones, and key discoveries.
- Value: Reinforces wonder-through-discovery and continuity pillars.

7. Spatial Clarity Pack
- Add contextual overlays (distance bands, focus emphasis, legend/help) in key scenes.
- Value: Improves readability without reducing simulation depth.

8. Contract Safety Gate in CI
- Add a pre-merge guard to detect frontend-backend contract drift early.
- Value: Foundation resilience while feature throughput increases.

9. NPC Presence v0 (Backend Runtime Skeleton)
- Introduce a server-side NPC runtime loop with minimal actor archetypes and heartbeat ticks.
- Start with low-complexity pirates (single ship, belt-local behavior) and reserve fleet orchestration for later phases.
- Value: Establishes living-world continuity and enables future risk/economy event hooks.

10. Technology Progress Tree Viewer v0
- Add a player-facing progression tree for item unlock paths with explicit gating criteria.
- Start with mining and fabrication item paths so players can plan upgrade goals.
- Value: Improves progression readability and reduces opaque recipe/tool gating confusion.

11. Character Skills Foundation (Gating-Ready)
- Introduce skill tracks that advance through activity usage (for example mining actions increase Mining skill).
- Use skill level thresholds to gate higher-tier tools (for example Tier 2 drill requires Mining level N).
- Value: Adds consequence-driven mastery and long-term identity continuity.

## Long-Term Big Bets (Track, Sequence, and De-risk)

1. Mission scripting framework for branching outcomes and authored depth.
2. Jump-gate route visualization and cross-system planning UX.
3. Persistent fabrication jobs and async operation summaries.
4. NPC-driven market dynamics and scarcity windows.
5. Decomposition of major frontend/backend complexity hotspots for scaling teams.
6. Autonomous NPC hierarchy and doctrine simulation (pirates to kingpins).
7. Full skill-based progression model with technology tree coupling.

## Technology Tree and Skill Gating Concept (New)

Objective:
- Make item progression legible through a viewable technology tree where each unlock clearly displays required materials, prerequisites, and skill levels.

Core design rules:
1. Every gated item must expose why it is locked.
2. Skill requirements should complement, not replace, material and mission prerequisites.
3. Early tiers should unlock quickly to teach the system, while higher tiers enforce specialization choices.

Example gating path:
1. Mining Drill Tier 1
- Unlock: starter state or early mission reward.

2. Mining Drill Tier 2
- Unlock requires: Mining skill level 3 + materials bundle + prior drill tier.

3. Mining Drill Tier 3
- Unlock requires: Mining skill level 6 + rare components + hazard-zone mission completion.

Suggested skill list for initial design backlog:
1. Mining (yield efficiency, extraction speed)
2. Salvage (recoverable scrap quality and quantity)
3. Fabrication (build speed, recipe efficiency)
4. Repair and Retrofit (repair cost/time reduction)
5. Piloting (maneuver precision, travel efficiency)
6. Navigation and Astrogation (route optimization, anomaly detection)
7. Scanning and Surveying (discovery quality, scan fidelity)
8. Negotiation (market pricing spread, contract terms)
9. Trading and Logistics (cargo efficiency, route profit stability)
10. Drone Operations (expendable/permanent drone effectiveness)
11. Security and Defense (threat response, damage mitigation)
12. Command and Fleet Coordination (multi-ship control at later stages)

Rollout shape:
1. Phase A (H1-compatible)
- Tech tree viewer for existing item progression with static gates.
- Skill model scaffold with one active skill track: Mining.

2. Phase B (H2)
- Add market-facing skill tracks (Negotiation, Trading and Logistics).
- Introduce multi-skill requirements for higher-tier fabrication.

3. Phase C (H2/H3)
- Build specialization branches and fleet-oriented command skills.
- Couple skill milestones to mission branches and faction consequences.

## NPC Simulation Concept (New)

Objective:
- Run NPC actors continuously in backend simulation so world activity exists beyond direct player action.

Initial actor hierarchy:
1. Belt Pirate (single ship)
- Operates in asteroid belt zones.
- Opportunistic interception and salvage behavior.

2. Raider Cell (small coordinated group)
- Limited patrol corridors and simple target prioritization.

3. Kingpin Fleet (multi-ship command)
- Region-level influence, convoy pressure, and market disruption capacity.

Rollout shape:
1. Phase A (H1-compatible)
- NPC runtime scaffold, tick scheduler, actor state model, and deterministic test harness.
- Belt Pirate only; no full economy coupling yet.

2. Phase B (H2)
- Raider Cell coordination and event emission (threat spikes, route pressure).

3. Phase C (H2/H3)
- Kingpin fleet doctrine, territory influence, and economy/logistics consequences.

Guardrails:
- Keep simulation deterministic where possible for replayable tests.
- Expose contracts for NPC events before adding heavy frontend presentation.
- Avoid coupling new runtime logic into existing backend hotspot files without seam extraction.

## Suggested Near-Term Sprint Shape

Recommended packaging for next sprint planning:
- 2 player-visible features from the small-win list.
- 1 foundational hardening item (testing or contract gate).
- 1 explicit dependency note for a future big bet.

Example package:
- Mission Board Status Lanes
- Quick Dock to Trade Flow
- Contract Safety Gate in CI
- Dependency note: mission scripting prerequisites and interface assumptions

## Risks to Monitor During Execution

1. Regressions hidden by weak frontend test patterns.
2. Feature coupling into large scene/context files before decomposition.
3. Contract drift between socket payload assumptions and canonical definitions.
4. Over-scoping H2/H3 mechanics before H1 reliability criteria are stable.
5. NPC runtime complexity introducing nondeterminism and difficult-to-reproduce regressions.
6. Skill gating over-constraining progression and creating early-game friction.

## Definition of Progress for This Brainstorming Track

A candidate feature should be accepted into implementation when:
- It passes at least 3 of 5 decision-filter questions from north-star guidance.
- It has one player-visible success signal.
- It has at least one test/contract validation path defined.
- It does not materially increase architectural fragility in key hotspots.

## Session Outcome

This session produced a balanced, foundation-first feature slate that preserves momentum:
- Immediate small wins are available and aligned to north-star pillars.
- Longer-term bets are identified with sequencing awareness.
- Technical hardening remains explicitly coupled to feature delivery.
