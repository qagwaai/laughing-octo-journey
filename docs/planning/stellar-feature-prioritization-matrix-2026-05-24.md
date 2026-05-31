# Stellar Feature Prioritization Matrix

Date: 2026-05-24
Companion to: docs/planning/stellar-brainstorming-findings-2026-05-24.md
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
| ~~SW-R01~~ | Regression Fix: Cold Boot Dart Launch Availability | H1 critical | 5 | 2 | 1 | 2 | 5 | 4.65 | Completed 2026-05-25. Restored opening flow so Expendable Dart Drone is available at cold boot launch.|
| ~~SW-R02~~ | Regression Fix: Missing Starter Ship Inventory Components | H1 critical | 5 | 2 | 1 | 2 | 5 | 4.65 | Completed 2026-05-25. Restored canonical starter inventory: Expendable Dart Drone, Sensor Array, Tractor Beam. |
| ~~SW-R03~~ | Regression Fix: Expendable Dart Drone Fire Action from Scavenger Inventory | H1 critical | 5 | 2 | 2 | 2 | 5 | 4.55 | New regression (2026-05-25): inventory item is visible in ship inventory view, but firing Expendable Dart Drone from Scavenger's inventory is unavailable. |
| ~~SW-01~~ | Mission Board Status Lanes | H1 | 4 | 2 | 1 | 2 | 5 | 4.50 | High clarity gain, low implementation risk |
| SW-02 | Market Opportunity Pings | H1/H2 bridge | 4 | 2 | 2 | 3 | 5 | 4.25 | Gives economy excitement before full dynamic events |
| SW-03 | Quick Dock to Trade Flow | H1 | 4 | 2 | 2 | 2 | 4 | 4.15 | Strong short-session loop completion |
| SW-04 | Fabrication Queue Timeline (UI-first) | H1/H2 bridge | 4 | 3 | 2 | 3 | 4 | 3.85 | Visible progression, can later attach persistence |
| SW-05 | Ship Condition Badges in Hangar | H1 | 3 | 1 | 1 | 2 | 4 | 4.05 | Easy consequence readability win |
| SW-06 | Discovery Log v1 | H1/H2 bridge | 4 | 3 | 2 | 3 | 5 | 4.00 | Reinforces wonder and continuity pillars |
| SW-07 | Spatial Clarity Pack | H1 | 4 | 3 | 3 | 3 | 5 | 3.85 | Valuable but should avoid monolith coupling |
| ~~SW-08~~ | Contract Safety Gate in CI | H1 | 5 | 2 | 1 | 2 | 5 | 4.65 | Highest foundation multiplier across all future work |
| SW-09 | NPC Presence v0 (Belt Pirate Runtime) | H1/H2 bridge | 4 | 3 | 3 | 4 | 5 | 3.75 | Adds living-world simulation baseline using single-ship NPC archetypes |
| SW-10 | Technology Progress Tree Viewer v0 | H1/H2 bridge | 4 | 3 | 2 | 3 | 5 | 4.00 | Makes item progression and gating legible to players |
| SW-11 | Skill Gating Scaffold (Mining First) | H1/H2 bridge | 4 | 3 | 3 | 4 | 5 | 3.75 | Adds first activity-driven skill gate for higher-tier mining tools |
| SW-12 | Minimal Ship-to-Ship Encounter v0 | H1/H2 bridge | 4 | 3 | 3 | 3 | 5 | 3.85 | Enables piracy, cargo theft, and sacrificial drone interactions without full combat depth |
| SW-13 | External Object Presentation Expansion | H1/H2 bridge | 4 | 3 | 3 | 4 | 5 | 3.75 | Improves debris, ship, gate, and station readability in ship-external view |
| SW-14 | In-System Short-Hop Drive | H1/H2 bridge | 5 | 3 | 3 | 4 | 5 | 4.00 | Makes in-system travel practical without removing fuel and route pressure |
| SW-15 | Minimal Character Bust Builder v0 | H1/H2 bridge | 4 | 4 | 3 | 4 | 5 | 3.60 | Browser-friendly bust customization for player identity and NPC reuse |
| SW-16 | Ship-External Target Persistence on Re-Entry | H1 | 4 | 2 | 2 | 2 | 5 | 4.30 | Preserve current target when re-entering ship-external-view if target remains valid |
| SW-17 | Computer Progression (Per-Ship Intelligence Tiers) | H1/H2 bridge | 5 | 3 | 2 | 3 | 5 | 4.20 | 10-tier per-ship computer installation; skill+level-gated tier installs; includes asteroid prescan, pirate identification, market opportunities, route risk, mission scoring, solar weather, and optional light automation |
| SW-COR | Socket Correlation Contract Hardening | H1 foundation | 5 | 2 | 1 | 2 | 5 | 4.65 | Enforce correlationId echo on all socket request/response pairs; prevent concurrent-request state corruption; SW-08 amendment |

## Ranked Small-Win Order

Revised canonical ranking (descending by score):
1. ~~SW-R01 Regression Fix: Cold Boot Dart Launch Availability (4.65, Completed 2026-05-25)~~
2. ~~SW-R02 Regression Fix: Missing Starter Ship Inventory Components (4.65, Completed 2026-05-25)~~
3. ~~SW-08 Contract Safety Gate in CI (4.65)~~
4. ~~SW-COR Socket Correlation Contract Hardening (4.65)~~
5. ~~SW-R03 Regression Fix: Expendable Dart Drone Fire Action from Scavenger Inventory (4.55)~~
6. ~~SW-01~~ Mission Board Status Lanes (4.50)
7. SW-16 Ship-External Target Persistence on Re-Entry (4.30)
8. SW-02 Market Opportunity Pings (4.25)
9. SW-17 Computer Progression (Per-Ship Intelligence Tiers) (4.20)
10. SW-03 Quick Dock to Trade Flow (4.15)
11. SW-05 Ship Condition Badges in Hangar (4.05)
12. SW-06 Discovery Log v1 (4.00)
13. SW-10 Technology Progress Tree Viewer v0 (4.00)
14. SW-14 In-System Short-Hop Drive (4.00)
15. SW-04 Fabrication Queue Timeline (3.85)
16. SW-07 Spatial Clarity Pack (3.85)
17. SW-12 Minimal Ship-to-Ship Encounter v0 (3.85)
18. SW-09 NPC Presence v0 (Belt Pirate Runtime) (3.75)
19. SW-11 Skill Gating Scaffold (Mining First) (3.75)
20. SW-13 External Object Presentation Expansion (3.75)
21. SW-15 Minimal Character Bust Builder v0 (3.60)

Tie-break rule used for equal scores: prefer lower risk and fewer dependencies for H1.

Correlation contract override rule:
- Any socket event pair missing correlationId echo is a foundation-layer vulnerability. SW-COR must execute before any new socket event pair is merged.

Regression override rule:
- Any opening-loop regression that blocks expected first-action gameplay (for example initial Dart launch availability) should execute before same-scope net-new work.
- Any regression that removes canonical starter inventory components should execute before same-scope net-new work.
- Any regression that removes a previously available fire/launch action for canonical starter equipment should execute before same-scope net-new work.

Computer progression policy note:
- SW-17 is planned as top-5 among active net-new features.
- Per-ship installation is mandatory; higher computer tiers unlock through combined Computer Systems Installation skill rank and character level gating.
- Automation remains light-assist only with player confirmation for any action execution.

## SW-17 Planning Artifacts (2026-05-30)

1. [SW-17 Computer Progression Implementation Plan](sw-17/sw-17-computer-progression-implementation-plan.md)
2. [SW-17 Computer Progression Closure Checklist](sw-17/sw-17-computer-progression-closure-checklist.md)

## Active Top-5 Net-New Features (Post SW-01 Closure)

1. SW-16 Ship-External Target Persistence on Re-Entry (4.30)
2. SW-02 Market Opportunity Pings (4.25)
3. SW-17 Computer Progression (Per-Ship Intelligence Tiers) (4.20)
4. SW-03 Quick Dock to Trade Flow (4.15)
5. SW-05 Ship Condition Badges in Hangar (4.05)

## Closure Update (2026-05-25)

- SW-R01 closed: Cold boot launch availability restored for Expendable Dart Drone.
- SW-R02 closed: Starter ship inventory restored with Expendable Dart Drone, Sensor Array, and Tractor Beam.
- Both items remain in the matrix as completed historical reliability work.

## SW-08 Post-Implementation Review (2026-05-25)

Effort re-rating:
- Original estimate for SW-08: 2 (small)
- Retrospective rating for delivered scope: 4 (medium-high)

Why the realized effort was higher:
- Scope expansion from shape validation to communication semantics: SW-COR correlation guarantees were required to make drift detection reliable under concurrency.
- Cross-repo coordination overhead: Nova and Forge changes were both required across contracts, handlers, listeners, tests, and documentation.
- Hidden routing defects surfaced under stricter checks: foreign-operation-on-channel issues required additional backend channel-operation hardening.
- Reliability regressions consumed planned capacity: SW-R01, SW-R02, and SW-R03 required opening-loop remediation in parallel with gate work.

What still rates as effort 2:
- A narrow SW-08 implementation that only adds baseline shape checks without semantics enforcement, recurrence controls, or cross-channel routing hardening.

Estimation guardrails going forward:
- If contract work touches both producer and consumer semantics, baseline effort should start at 3.
- If strict correlation/routing assertions are added, baseline effort should start at 4.
- If opening-loop regressions are already active in adjacent surfaces, add +1 contingency tier to schedule/risk planning.

## New Regression Intake (2026-05-25)

- SW-R03 opened: Expendable Dart Drone visible in ship inventory, but fire action from Scavenger's inventory is unavailable.
- Expected behavior: if Expendable Dart Drone exists in Scavenger's inventory, fire action must be available from ship inventory flow.
- Validation target: add launch-action tests covering inventory visibility + action availability parity.

## Recommended Top 3 for Next Sprint (Post-Closure)

1. SW-R03 Regression Fix: Expendable Dart Drone Fire Action from Scavenger Inventory
- Why now: Opening-loop regression reappeared in action semantics; player can see inventory item but cannot perform previously available fire behavior.
- Success signal: Expendable Dart Drone can be fired from Scavenger's inventory when present.
- Validation path: inventory-visibility and fire-action parity tests from ship inventory flow.

2. SW-16 Ship-External Target Persistence on Re-Entry
- Why now: Reliability/continuity issue remains open and directly affects player orientation.
- Success signal: target persists across ship-external view re-entry when still valid.
- Validation path: exit/re-entry target persistence tests with invalid-target fallback checks.

3. SW-01 Mission Board Status Lanes
- Why now: High-value clarity improvement with low implementation risk.
- Success signal: available/active/completed mission separation is visible and filterable.
- Validation path: mission board UX tests and route-level smoke coverage.

Recently closed reliability items:
- SW-R01 Cold Boot Dart Launch Availability (closed 2026-05-25).
- SW-R02 Missing Starter Ship Inventory Components (closed 2026-05-25).

Open regression intake:
- SW-R03 Expendable Dart Drone fire action unavailable from Scavenger's inventory (opened 2026-05-25).

## Alternate Top 3 (If Economy Excitement Is Preferred)

1. SW-R03 Regression Fix: Expendable Dart Drone Fire Action from Scavenger Inventory
2. SW-02 Market Opportunity Pings
3. SW-08 Contract Safety Gate in CI

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
| BB-11 | Character Identity and Communication Bust Pipeline | H2/H3 | 5 | 5 | 4 | 5 | 5 | 3.55 | Requires browser-safe mesh/material pipeline, customization persistence, NPC reuse, and comms scene integration |
| BB-12 | Dynamic Faction Ecology and Consequence Memory | H2/H3 | 5 | 4 | 4 | 4 | 5 | 3.90 | Requires faction state model, control-pressure simulation, and readable consequence outputs |
| BB-13 | Run Specialization and Legacy Progression Layer | H2/H3 | 5 | 4 | 4 | 4 | 5 | 3.90 | Requires specialization constraints, legacy unlock governance, and anti-power-creep balancing |

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
11. BB-11 Character Identity and Communication Bust Pipeline
12. BB-12 Dynamic Faction Ecology and Consequence Memory
13. BB-13 Run Specialization and Legacy Progression Layer

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
- BB-11 should start with preset-driven busts and deterministic asset constraints before deeper customization.
- BB-12 should begin with a small faction set and explicit consequence telemetry before large simulation breadth.
- BB-13 should begin with one specialization branch and one constrained legacy unlock band.

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

## Character Bust Builder Addendum (New)

Scope statement:
- Build a minimal browser-based character builder focused on bust-level face identity, with reuse for NPCs and ship-to-ship communication views.

Core constraints:
1. Treat as a separate high-3D-budget implementation track.
2. Limit v0 to bust-level controls: face variants, skin tones, tattoos, scars.
3. Preserve runtime performance and avoid degrading existing scene responsiveness.
4. Save/load format should be deterministic and reusable by NPC generation.

Validation expectations:
- Unit tests for serialization/deserialization of bust customization state.
- Contract tests for identity payload fields used by player/NPC views.
- Integration tests for rendering busts in communication contexts.

## Replayability Roundout Addendum (New)

Scope statement:
- Improve long-term replayability through (a) dynamic faction ecology with persistent world consequences and (b) per-run specialization paired with constrained campaign-level legacy progression.

Core constraints:
1. Faction outcomes must be visible and interpretable in missions, routes, and markets.
2. Legacy progression should expand options, not collapse challenge.
3. Specialization choices should materially differentiate runs.
4. Replayability systems must avoid power creep that invalidates early/mid-game loops.

Validation expectations:
- Simulation tests for faction state transitions and territorial/economic deltas.
- Contract tests for consequence summary payloads and legacy progression state.
- Integration tests confirming that distinct builds produce distinct viable play patterns.

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
