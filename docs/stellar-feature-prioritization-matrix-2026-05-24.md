# Stellar Feature Prioritization Matrix

Date: 2026-05-24
Companion to: docs/stellar-brainstorming-findings-2026-05-24.md
Scope: Horizon 1 first, with explicit Horizon 2 motivation tracking

## How to Read This Matrix

Scoring scale:
- Impact: 1 (low) to 5 (high)
- Effort: 1 (small) to 5 (large)
- Risk: 1 (low) to 5 (high)
- Dependency complexity: 1 (few dependencies) to 5 (many dependencies)
- North-star fit: 1 (weak) to 5 (strong)

Weighted priority score:
Priority Score = (Impact x 0.35) + (North-star fit x 0.30) + ((6 - Effort) x 0.15) + ((6 - Risk) x 0.10) + ((6 - Dependency complexity) x 0.10)

Interpretation:
- 4.2 to 5.0: Execute now (strong candidate)
- 3.5 to 4.1: Execute soon (good candidate)
- 2.8 to 3.4: Keep in backlog with dependency notes
- Below 2.8: Re-scope before planning

## Small Wins Matrix (1-2 Sprints)

| ID | Feature | Horizon Fit | Impact | Effort | Risk | Dependency Complexity | North-star Fit | Priority Score | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SW-01 | Mission Board Status Lanes | H1 | 4 | 2 | 1 | 2 | 5 | 4.50 | High clarity gain, low implementation risk |
| SW-02 | Market Opportunity Pings | H1/H2 bridge | 4 | 2 | 2 | 3 | 5 | 4.25 | Gives economy excitement before full dynamic events |
| SW-03 | Quick Dock to Trade Flow | H1 | 4 | 2 | 2 | 2 | 4 | 4.15 | Strong short-session loop completion |
| SW-04 | Fabrication Queue Timeline (UI-first) | H1/H2 bridge | 4 | 3 | 2 | 3 | 4 | 3.85 | Visible progression, can later attach persistence |
| SW-05 | Ship Condition Badges in Hangar | H1 | 3 | 1 | 1 | 2 | 4 | 4.05 | Easy consequence readability win |
| SW-06 | Discovery Log v1 | H1/H2 bridge | 4 | 3 | 2 | 3 | 5 | 4.00 | Reinforces wonder and continuity pillars |
| SW-07 | Spatial Clarity Pack | H1 | 4 | 3 | 3 | 3 | 5 | 3.85 | Valuable but should avoid monolith coupling |
| SW-08 | Contract Safety Gate in CI | H1 | 5 | 2 | 1 | 2 | 5 | 4.65 | Highest foundation multiplier across all future work |
| SW-09 | NPC Presence v0 (Belt Pirate Runtime) | H1/H2 bridge | 4 | 3 | 3 | 4 | 5 | 3.75 | Adds living-world simulation baseline using single-ship NPC archetypes |
| SW-10 | Technology Progress Tree Viewer v0 | H1/H2 bridge | 4 | 3 | 2 | 3 | 5 | 4.00 | Makes item progression and gating legible to players |
| SW-11 | Skill Gating Scaffold (Mining First) | H1/H2 bridge | 4 | 3 | 3 | 4 | 5 | 3.75 | Adds first activity-driven skill gate for higher-tier mining tools |
| SW-12 | Minimal Ship-to-Ship Encounter v0 | H1/H2 bridge | 4 | 3 | 3 | 3 | 5 | 3.85 | Enables piracy, cargo theft, and sacrificial drone interactions without full combat depth |
| SW-13 | External Object Presentation Expansion | H1/H2 bridge | 4 | 3 | 3 | 4 | 5 | 3.75 | Improves debris, ship, gate, and station readability in ship-external view |
| SW-14 | In-System Short-Hop Drive | H1/H2 bridge | 5 | 3 | 3 | 4 | 5 | 4.00 | Makes in-system travel practical without removing fuel and route pressure |

## Ranked Small-Win Order

Revised canonical ranking (descending by score):
1. SW-08 Contract Safety Gate in CI (4.65)
2. SW-01 Mission Board Status Lanes (4.50)
3. SW-02 Market Opportunity Pings (4.25)
4. SW-03 Quick Dock to Trade Flow (4.15)
5. SW-05 Ship Condition Badges in Hangar (4.05)
6. SW-06 Discovery Log v1 (4.00)
7. SW-10 Technology Progress Tree Viewer v0 (4.00)
8. SW-14 In-System Short-Hop Drive (4.00)
9. SW-04 Fabrication Queue Timeline (3.85)
10. SW-07 Spatial Clarity Pack (3.85)
11. SW-12 Minimal Ship-to-Ship Encounter v0 (3.85)
12. SW-09 NPC Presence v0 (Belt Pirate Runtime) (3.75)
13. SW-11 Skill Gating Scaffold (Mining First) (3.75)
14. SW-13 External Object Presentation Expansion (3.75)

Tie-break rule used for equal scores: prefer lower risk and fewer dependencies for H1.

## Recommended Top 3 for Next Sprint

1. SW-08 Contract Safety Gate in CI
- Why now: Prevents drift while feature throughput increases.
- Success signal: contract mismatch is caught before merge at least once in dry-run validation.
- Validation path: CI job + failing test fixture for intentional mismatch.

2. SW-01 Mission Board Status Lanes
- Why now: Directly improves mission comprehension and progression clarity.
- Success signal: users can identify next actionable mission in under 10 seconds.
- Validation path: unit/component tests for tab grouping + one e2e filter flow.

3. SW-03 Quick Dock to Trade Flow
- Why now: Immediate loop acceleration from spatial scene to economy action.
- Success signal: reduced clicks/time from target market selection to first trade action.
- Validation path: e2e path from exterior context to market transaction intent.

## Alternate Top 3 (If Economy Excitement Is Preferred)

1. SW-08 Contract Safety Gate in CI
2. SW-02 Market Opportunity Pings
3. SW-03 Quick Dock to Trade Flow

Reason: better visible momentum in economy systems while preserving one hardening item.

## Big Bets Matrix (Track for H2/H3)

| ID | Big Bet | Horizon Fit | Impact | Effort | Risk | Dependency Complexity | North-star Fit | Priority Score | Dependency Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| BB-01 | Mission scripting framework | H2/H3 | 5 | 5 | 4 | 5 | 5 | 3.55 | Requires mission DSL, state transitions, authoring tooling |
| BB-02 | Jump-gate route UX and planning | H2 | 5 | 4 | 4 | 4 | 5 | 3.80 | Needs backend route contracts and client visualization layer |
| BB-03 | Persistent fabrication jobs + async summaries | H2 | 4 | 4 | 3 | 4 | 5 | 3.70 | Needs job persistence model, completion events, resume UX |
| BB-04 | NPC-driven market dynamics | H2/H3 | 5 | 5 | 5 | 5 | 5 | 3.35 | Requires balancing model and anti-exploit controls |
| BB-05 | Frontend/backend hotspot decomposition | H1/H2 enabler | 5 | 5 | 4 | 5 | 4 | 3.25 | Enables safer scaling but should be staged by seam extraction |
| BB-06 | Autonomous NPC hierarchy (pirates to kingpins) | H2/H3 | 5 | 5 | 5 | 5 | 5 | 3.35 | Requires actor runtime, fleet doctrine, event contracts, and deterministic simulation tests |
| BB-07 | Skill Mastery Economy and Tech-Tree Coupling | H2/H3 | 5 | 4 | 4 | 5 | 5 | 3.70 | Requires skill progression model, unlock contracts, balance tuning, and anti-grind guardrails |
| BB-08 | Asymmetric Combat and Piracy Pressure System | H2/H3 | 5 | 5 | 4 | 5 | 5 | 3.55 | Requires encounter design, cargo theft rules, drone lethality rules, and careful identity protection |
| BB-09 | External Scene Identity and Landmark System | H2 | 5 | 4 | 4 | 4 | 5 | 3.90 | Requires object families, LOD/mesh rules, landmark clarity, and scene loading discipline |
| BB-10 | In-System Short-Hop Travel Network | H2 | 5 | 4 | 4 | 4 | 5 | 3.90 | Requires drive model, fuel economy balancing, route constraints, and mission/market integration |

## Big Bet Sequencing Recommendation

1. BB-02 Jump-gate route UX and planning
2. BB-03 Persistent fabrication jobs + async summaries
3. BB-01 Mission scripting framework
4. BB-05 Hotspot decomposition (continuous parallel track)
5. BB-04 NPC-driven market dynamics
6. BB-06 Autonomous NPC hierarchy (pirates to kingpins)
7. BB-07 Skill Mastery Economy and Tech-Tree Coupling
8. BB-08 Asymmetric Combat and Piracy Pressure System
9. BB-09 External Scene Identity and Landmark System
10. BB-10 In-System Short-Hop Travel Network

Reasoning:
- BB-02 and BB-03 produce visible gameplay depth with manageable risk compared to full mission scripting.
- BB-01 should start after route and persistence contracts are stable enough to avoid rework.
- BB-05 should run continuously in narrow slices to reduce architecture risk accumulation.
- BB-05 should explicitly revisit ship-external-view and stellar-viewer on a recurring cadence because both are hot points.
- BB-04 should start only after telemetry and balancing controls improve.
- BB-06 should begin with a narrow runtime scaffold (single-ship pirates) before fleet-level behavior.
- BB-07 should start with one proven skill track (Mining) before introducing multi-skill compound gates.
- BB-08 should begin with a narrow piracy encounter model before adding ship-to-ship escalation paths.
- BB-09 should start with debris and landmark families before full ship/station visual taxonomy.
- BB-10 should start with a single low-tier short-hop drive before adding broader system transit options.

## Technology Tree and Skills Addendum (New)

Scope statement:
- Provide a visible technology progress tree with explicit item-gating criteria and a character-skill system that advances through activity usage.

Initial gating example:
1. Mining Drill Tier 2 unlock requires Mining level threshold + materials + prior tier completion.

2. Mining Drill Tier 3 unlock requires higher Mining level + rare materials + hazard-zone progression requirement.

Seed skill catalog for planning:
1. Mining
2. Salvage
3. Fabrication
4. Repair and Retrofit
5. Piloting
6. Navigation and Astrogation
7. Scanning and Surveying
8. Negotiation
9. Trading and Logistics
10. Drone Operations
11. Security and Defense
12. Command and Fleet Coordination

Validation expectations:
- Unit tests for skill XP accumulation and level threshold checks.
- Contract tests for unlock-state payloads and tree-node gate reasons.
- Integration tests ensuring progression remains achievable and non-stalling for early tiers.

## NPC Simulation Breakdown (New)

Scope statement:
- NPCs run continuously in backend simulation, from single-ship pirates in asteroid belts to kingpins controlling fleets.

Phased implementation slices:
1. Slice A: Runtime scaffold (H1/H2 bridge)
- Tick scheduler, actor state model, and deterministic seed controls.
- One archetype: Belt Pirate with local patrol/intercept behavior.

2. Slice B: Coordinated groups (H2)
- Raider Cell behavior with shared target selection and route pressure events.

3. Slice C: Fleet command (H2/H3)
- Kingpin doctrine with regional influence and economic disruption hooks.

Validation expectations:
- Unit tests for actor state transitions and deterministic tick replay.
- Contract tests for NPC event payloads consumed by frontend.
- Integration tests to verify NPC activity does not break market/mission invariants.

## Combat and Piracy Addendum (New)

Scope statement:
- Ship-to-ship combat stays intentionally minimal at first, centered on piracy, cargo theft, escape, and sacrificial drones.

Core constraints:
1. Minimal shields only; they should soften danger, not erase it.
2. Pirates may steal cargo without killing the pilot.
3. Dart drone impact against pirates should usually end in drone loss and parts-level salvage.
4. The encounter model should communicate that space is hard and unforgiving.

Validation expectations:
- Unit tests for theft, escape, damage, and drone-destruction outcomes.
- Contract tests for encounter summary payloads and loss reporting.
- Integration tests ensuring combat resolution does not corrupt cargo/ship state.

## External Objects and Travel Addendum (New)

Scope statement:
- Improve ship-external view so debris, ships, jump gates, and stations have clearer identity, and add a low-tier short-hop drive so in-system travel remains practical.

Core constraints:
1. Debris should render as detailed enough meshes to communicate item identity and salvage value.
2. Ships and stations should use recognizable visual families.
3. Jump gates should be unmistakable navigational landmarks.
4. Short-hop travel must preserve fuel cost and route choice.

Validation expectations:
- Unit tests for drive cost and route eligibility.
- Contract tests for external object descriptors and identity fields.
- Integration tests for travel action outcomes and scene object selection.

Recurring decomposition reminder:
- ship-external-view and stellar-viewer should be reviewed periodically even when they are not the primary focus of a sprint, because they remain structural hot points.

## Dependency and Guardrail Checklist (Use During Sprint Planning)

Before committing a feature to sprint:
- Confirm at least 3 out of 5 north-star decision filter answers are yes.
- Define one user-visible success signal.
- Define one test or contract validation path.
- Confirm no new tight coupling to known hotspots.
- Record at least one rollback or fallback plan for release safety.

## Suggested Planning Cadence

Week 1:
- Implement SW-08 + test fixtures.
- Start SW-01 core UI and tests.

Week 2:
- Complete SW-01 and SW-03.
- Add telemetry hooks to prepare BB-02/BB-03 prioritization for next cycle.

## Ownership Template (Optional)

Use this section to assign owners during planning:

| Item | Frontend Owner | Backend Owner | QA Owner | Notes |
| --- | --- | --- | --- | --- |
| SW-08 | TBD | TBD | TBD | |
| SW-01 | TBD | TBD | TBD | |
| SW-03 | TBD | TBD | TBD | |
