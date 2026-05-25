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
- Periodically revisit decomposition of ship-external-view and stellar-viewer, since both remain recurring hotspot candidates.

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

0. High-Priority Regression: Cold Boot Dart Launch Availability
- Symptom: cold boot sequence no longer starts with Expendable Dart Drone available to launch, even though it appears in inventory.
- Expected: cold boot opening flow should allow immediate Dart launch when starting inventory contains expendable dart drone.
- Priority: critical regression fix, schedule ahead of net-new feature work in the same area.
- Validation: add focused tests for inventory-to-launch availability in opening sequence and ship-external launch entry path.

0.1. Continuity Issue: Ship-External Target Persistence on Re-Entry
- Symptom: re-entering ship-external-view does not keep the currently targeted item.
- Expected: when returning to ship-external-view in the same active context, previously selected target should persist if still valid.
- Priority: high continuity fix for interaction flow and player orientation.
- Validation: add tests for target persistence across view exit/re-entry and fallback behavior when prior target is no longer valid.

0.2. Confirmed Regression: Missing Starter Ship Inventory Components
- Symptom: ship inventory is missing expected starter components.
- Missing items: Expendable Dart Drone, Sensor Array, Tractor Beam.
- Expected: starter ship inventory should include canonical opening components so cold-boot and early ship-external actions function.
- Priority: critical opening-loop regression fix; schedule with top onboarding regressions.
- Validation: add startup inventory tests asserting presence of required starter components and downstream availability in launch/scan/tractor flows.

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

12. Minimal Ship-to-Ship Encounter v0
- Add a constrained combat surface focused on interdiction, escape, and cargo theft instead of full ship destruction.
- Keep shields minimal and outcomes harsh so the game communicates that space is hard and unforgiving.
- Allow pirates to threaten cargo holds without killing the pilot, while making dart drone impacts decisively lethal to the drone.
- Value: Introduces survival pressure and piracy interactions without turning Stellar into a combat-first game.

13. External Object Presentation Expansion
- Extend ship-external-view to render detailed debris meshes, jump gates, other ship silhouettes, and space stations with clearer identity and scale.
- Use progressive detail so important objects read well at game distance without flooding the scene with clutter.
- Value: Makes external space feel populated and legible, and supports future encounter and travel systems.

14. In-System Short-Hop Drive
- Introduce a low-level drive that enables practical travel between planets and major bodies inside a solar system.
- Charge fuel for each hop so movement remains strategic instead of free, and so route planning still matters.
- Value: Prevents in-system travel from becoming a long-duration blocker while preserving logistics and resource pressure.

15. Minimal Character Bust Builder v0 (Separate Track)
- Add a browser-friendly character builder focused on bust-level identity, not full-body customization.
- Prioritize high-value controls: facial structure presets, skin tone variation, tattoos, and scars.
- Keep this as a separate implementation track because of its higher 3D asset/runtime budget.
- Value: Strengthens identity and continuity, and can be reused for NPC portrait/bust presentation.

## Long-Term Big Bets (Track, Sequence, and De-risk)

1. Mission scripting framework for branching outcomes and authored depth.
2. Jump-gate route visualization and cross-system planning UX.
3. Persistent fabrication jobs and async operation summaries.
4. NPC-driven market dynamics and scarcity windows.
5. Decomposition of major frontend/backend complexity hotspots for scaling teams.
6. Autonomous NPC hierarchy and doctrine simulation (pirates to kingpins).
7. Full skill-based progression model with technology tree coupling.
8. Asymmetric combat and piracy pressure system.
9. External scene object variety and identity rendering.
10. Practical in-system short-hop travel with fuel cost.
11. Character identity pipeline for player and NPC bust presentation.
12. Dynamic faction ecology with persistent world consequences.
13. Run specialization plus campaign-level legacy progression.

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

Combat and piracy principle:
- Encounters should typically resolve as evade, disable, steal, or salvage rather than prolonged duels.
- Pirates should be able to extract cargo from a hold without requiring pilot death.
- Expendable dart drones should be nearly destroyed on impact with hostile targets, leaving only parts or wreckage.
- Minimal shields may buy time, but they should not erase the consequences of hostile contact.

Early combat-adjacent rules:
1. If cargo is taken, the loss should be visible and understandable in the outcome summary.
2. If a drone is spent against a pirate, the result should be a strong one-way sacrifice.
3. If a ship is caught, the system should favor damage and loss over elimination unless the player chooses escalation.

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

## External Scene and Travel Concept (New)

Objective:
- Make the ship-external view capable of showing more of the living system: debris, ships, jump gates, and stations, while also supporting fast enough in-system movement to make planetary-scale play practical.

External object requirements:
1. Item debris should show a detailed mesh or convincing mesh variant, not just a generic marker.
2. Ships should be distinguishable by style/mesh family so factions and roles read at a glance.
3. Jump gates should be visually clear as navigation landmarks.
4. Stations should feel like durable persistent infrastructure, not merely background decoration.

Travel principle:
- In-system travel should be meaningfully faster than raw orbital drift, but should still cost fuel and involve a planning choice.

Suggested short-hop drive behavior:
1. Available at a relatively low progression level.
2. Moves between major planets, stations, or other named bodies inside the same system.
3. Consumes fuel proportional to distance and mass/drive tier.
4. Does not replace long-range interstellar travel; it only makes local travel practical.

Rollout shape:
1. Phase A (H1-compatible)
- Add external object representation improvements for debris and major landmarks.
- Add a basic short-hop drive prototype with fuel cost and route validation.

2. Phase B (H2)
- Add style families for ship meshes and station types.
- Integrate travel choices with mission, market, and encounter state.

3. Phase C (H2/H3)
- Expand to richer travel windows, lane/orbit constraints, and system-scale route pressure.

## Character Bust Builder Concept (New)

Objective:
- Deliver a minimal but high-value character builder in the browser that supports face-first identity and can be reused for NPCs and in-ship communication views.

Scope boundaries:
1. Bust-level only (head/upper torso), no full-body variability in the first phase.
2. High-value customization first: skin tone, facial variants, tattoos, scars.
3. Separate implementation track from core scene changes due to 3D budget risk.

Expected use cases:
1. Player character identity setup and updates.
2. NPC bust generation and variation for world population.
3. Ship-to-ship communication portraits where both participants display bust visuals.

Rollout shape:
1. Phase A (H1-compatible)
- Preset-driven bust builder with limited sliders and deterministic save format.

2. Phase B (H2)
- Add richer tattoos/scars layering and NPC reuse pipeline.

3. Phase C (H2/H3)
- Integrate communication scenes and faction style packs.

## Replayability Roundout Concepts (New)

1. Dynamic faction ecology with persistent consequence memory
- Build a living multi-faction simulation where pirate cells, market syndicates, station authorities, and frontier operators compete over routes and resources.
- Let player choices alter regional control, mission supply, route risk, and market behavior over time.
- Replayability value: each campaign evolves differently, creating new strategic and narrative conditions.

2. Run specialization with campaign-level legacy progression
- Force meaningful per-run specialization so players cannot optimize every path in one campaign.
- Add a constrained legacy layer that carries account-level unlocks between campaigns without invalidating progression challenge.
- Replayability value: each new run supports different builds and goals while preserving long-horizon continuity.

Suggested guardrails:
1. Legacy unlocks should widen options, not trivialize core loops.
2. Faction simulation should emit readable changes so players understand consequences.
3. Specialization choices should be reversible only at meaningful cost.

## Combat and Piracy Concept (New)

Objective:
- Support a minimal ship-to-ship combat layer that enables pirate pressure, cargo theft, defensive responses, and sacrificial drone attacks while keeping the game identity exploration-first.

Core behavior rules:
1. Space should feel hard and unforgiving; routine combat should be dangerous, not heroic.
2. Pirates can steal from cargo holds without needing to kill the pilot.
3. Dart drone strikes against pirates should usually leave only salvageable parts.
4. Shields, if present, should be minimal and temporary.
5. Noncombat outcomes such as fleeing, disabling, and loss should be common and readable.

Suggested early implementation slices:
1. Interdiction resolution
- Pirate pressure, cargo demand, escape attempt, theft outcome.

2. Damage and disable state
- Ship damage, partial cargo loss, salvage fragments, nonlethal defeat state.

3. Expendable drone strike rule
- Drone impact resolves to destruction with limited salvage and no persistent recovery.

4. Minimal defense layer
- Small shield/evade values that reduce but do not negate danger.

Rollout shape:
1. Phase A (H1-compatible)
- One pirate encounter flow with theft, escape, and damage outcomes.

2. Phase B (H2)
- Add drone-vs-pirate interaction and aftermath salvage.

3. Phase C (H2/H3)
- Expand into faction pressure, patrols, and loadout tradeoffs.

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
7. Combat tuning drifting Stellar toward a combat-first identity.
8. External scene richness creating asset/LOD and readability complexity.
9. Short-hop travel making fuel economy and route balance fragile if tuned too aggressively.
10. Deferred decomposition work on ship-external-view and stellar-viewer accumulating technical debt.
11. Character customization features over-consuming browser 3D budget and harming scene performance.
12. Legacy progression overpowering run identity and reducing replay diversity.
13. Faction dynamics becoming opaque if consequence signals are not visible in UI and mission context.

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
- Ship-external-view and stellar-viewer should be revisited on a recurring basis for decomposition opportunities.
- Critical gameplay regressions in opening flow (such as missing initial Dart launch availability) should preempt adjacent feature implementation.
- Ship-external interaction continuity issues (such as target loss on re-entry) should be treated as near-term reliability fixes.
- Regression of canonical starter inventory loadout should be treated as critical opening-loop reliability work.
