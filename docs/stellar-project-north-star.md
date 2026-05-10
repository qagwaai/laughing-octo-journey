# Stellar Project North Star

Status: Revision 2 (May 10, 2026)

## Why This Exists

Stellar is the long-horizon realization of a lifelong exploration game vision inspired by Traveller and expanded-world traditions like Spinward Marches. The core aim is not only to simulate space, but to let players build identity, make consequential choices, and discover believable stories across a living galaxy.

This document defines the project north star so design, engineering, and content decisions remain aligned over time.

## North Star Statement

Build a persistent, exploration-first space RPG where players navigate a scientifically grounded but dramatically playable galaxy, uncover emergent stories through mission and market systems, and feel ownership over their journey through clear progression, meaningful risk, and world-state consequences.

## Core Fantasy

The player is not a traditional heroic commander at the start. They begin as a vulnerable scavenger operator in a damaged pod, surviving by deploying expendable tools, learning local economics, and slowly building a durable fleet and industrial capability.

This creates a specific emotional arc:

1. Fragility and improvisation
2. Competence through systems mastery
3. Agency through strategic mobility and production
4. Long-term identity inside a living, persistent world

## Experience Pillars

1. Wonder Through Discovery
- New systems, worlds, stations, and anomalies should consistently create curiosity.
- Navigation and scanning should reveal layered information over time.
- Exploration should reward attention, not only grind.

2. Plausible Spatial Reality, Playable UX
- Orbital and spatial behavior should feel coherent and trustworthy.
- Visualizations must remain readable at game scale, even when physics detail is high.
- Use selective emphasis and contextual detail over always-on clutter.

3. Asynchronous Friendly Operations
- Core loops should support short active sessions and background progression patterns.
- Players should be able to set meaningful tasks (for example scan or salvage routines) and return to interpretable outcomes.
- Away-time should create opportunity, not confusion.

4. Consequence-Driven Progression
- Player choices should alter mission availability, economics, and tactical options.
- Risk-taking should create both opportunity and recoverable setbacks.
- Progression should unlock new capability bands, not only larger numbers.

5. Systemic Economy and Logistics
- Markets, travel, and cargo decisions should produce meaningful route planning.
- Distance, drive capability, and infrastructure access should shape strategy.
- Trade should be legible for newcomers and deep for dedicated players.

6. Identity and Continuity
- Character, ship, and mission history should feel like an unfolding personal chronicle.
- Session continuity should be reliable across reconnects and long-running campaigns.
- Locale and UI support should preserve immersion across languages.

## Canon Baseline

The opening experience and early arc are now canonized as the baseline onboarding fiction:

- Cold boot starts in darkness with failing life support diagnostics.
- Player awakens in a cracked scavenger pod in a debris graveyard.
- An unstable onboard AI authorizes deployment of the last expendable unit.
- First objective uses a Dart maneuver on a low-tier asteroid to secure survival materials.
- Early fabrication unlock marks the shift from passive survivor to active builder.

This baseline must remain mechanically meaningful, not purely cinematic.

## Product Direction

## Core Player Loop

1. Select objective: mission, trade, scouting, mining, or salvage.
2. Plan route and loadout: evaluate distance, drive limits, hazards, and extraction tools.
3. Travel and observe: update understanding of system state and opportunity windows.
4. Act: scan, dock, trade, mine, craft, complete mission steps, or adapt plan.
5. Resolve outcomes: gain resources, credits, unlocks, reputation, and narrative state.
6. Reinvest: improve ship, drones, fabrication capacity, and strategic reach.

## Progression Model (Economy + Crafting)

The progression spine is a drone-logic industrial ladder from raw extraction to high-end fabrication.

1. Resource ladder
- Common materials enable early survival and basic tooling.
- Uncommon materials unlock better drills, fuel systems, and mobility.
- Rare and exotic materials unlock precision, autonomy, and late-game systems.

2. Capability ladder
- Expendable units support risky, high-turnover operations.
- Permanent units support reliability, throughput, and strategic control.
- Infrastructure modules convert local gains into compounding production.

3. Gating philosophy
- Tooling and mobility upgrades gate where and how players can extract value.
- New biomes and hazard zones become meaningful once prerequisites are met.
- Recipes should function as decision points, not checklist friction.

## Mission Arc Baseline

Main storyline and side quests define the first dependable pacing model:

1. Main arc (M-01 to M-05)
- Introduce market access and basic fuel economy.
- Establish craft-and-mine loop for first durable capability.
- Introduce conflict pressure and defensive improvisation.
- Unlock sector mobility and tier transition.

2. Side arc (SQ-01 to SQ-04)
- Deliver optional risk/reward spikes and world texture.
- Introduce timed opportunities, hazard-heavy extraction, and faction consequences.
- Reward credits, rare materials, and safer local operating conditions.

3. Narrative and systems coupling
- Missions must introduce mechanics in a player-comprehensible sequence.
- Side content should reinforce economy and exploration depth, not distract from it.

## World Simulation Rules

1. Server-managed discovery state
- Known celestial body state is authoritative on the server.
- Client scan requests can reveal unknown environment state through canonical payloads.

2. Spatial contract fidelity
- Canonical spatial and trajectory contracts remain the source of truth across systems.
- Anchor relationships (for example moon-to-planet) are required for coherent scene rendering.

3. Dynamic economy hooks
- Market fluctuations, scarcity windows, and route constraints should produce meaningful trade timing decisions.

## Design Principles and Guardrails

1. Clarity Before Density
- Complex simulation should surface through progressive disclosure.
- Hover, focus, and context modes are preferred over global visual noise.

2. Contracts as Foundations
- Frontend and backend evolve through explicit message contracts.
- Canonical data shape consistency is non-negotiable for stability.

3. Narrative-Compatible Systems
- Mechanics should support story potential, not fight it.
- Mission arcs should leverage economy, travel, and discovery systems.

4. Asynchronous Respect
- Background or deferred play must remain readable and fair on return.
- Outcome summaries should always answer what changed and why.

5. Internationalization as Product Quality
- New player-facing text is complete only when locale coverage is complete.

## Technical North Star (Current Architecture Alignment)

1. Service-centered game flows for socket contracts and one-response listeners
2. Wrapper-page plus canvas-host discipline for Angular Three route scenes
3. Isolated and unit-tested formatter/scaling logic for spatial readability
4. Contract-first model evolution with canonical spatial consistency
5. Deterministic, layered testing with focused e2e coverage for user-critical paths

## 18-Month Outcome Goals

1. Exploration depth
- Multi-system exploration feels rich, with distinct local identities and encounter signatures.

2. Economic strategy
- Route planning, market behavior, and logistics produce repeatable strategic gameplay.

3. Mission arc density
- Mainline and side arcs provide branching outcomes tied to player capability and choices.

4. Industrial mastery
- Players progress from expendable micro-operations to durable, automated production chains.

5. Operational maturity
- Release cadence supports safe iteration without destabilizing core loops.

## Execution Horizons

## Horizon 1: Foundation Hardening (Now to 3 months)

- Complete validation gates for viewer and associated flows.
- Finalize early mission arc implementation quality (M-01 to M-05 plus first side quests).
- Normalize resource and recipe metadata into canonical game models.
- Stabilize spatial rendering behavior, interaction affordances, and contract conformity.

## Horizon 2: Systems Depth (3 to 9 months)

- Expand route and drive progression UX tied to market opportunities.
- Implement dynamic market events and scarcity windows.
- Introduce stronger risk loops: hostile interference, cargo protection, repair pressure.
- Add robust async operation summaries for scan/salvage/mining loops.

## Horizon 3: Galaxy Identity (9 to 18 months)

- Establish region-level identities with distinct economy and hazard signatures.
- Expand mission branches that produce visible world-state deltas.
- Deliver long-form continuity mechanics for campaign-scale play.

## Milestone Mapping

| Epic | Horizon | Success Signal |
| --- | --- | --- |
| First-target narrative and survival loop hardening | H1 | New players reach first fabrication unlock with high comprehension |
| Tiered mining and crafting ladder implementation | H1-H2 | Players consistently unlock mid-tier tools without dead-end recipes |
| Dynamic market and route pressure systems | H2 | Route choice and timing materially affect earnings |
| Drone fleet doctrine (expendable vs permanent) | H2 | Players adopt mixed-fleet strategies instead of single-optimal builds |
| Regional identity and long-arc mission branching | H3 | Destination choice is meaningfully driven by faction/economy/narrative differences |

## Decision Filter

When evaluating a feature, ask:

1. Does it increase meaningful exploration or operations decisions?
2. Does it preserve or improve spatial and systems clarity?
3. Does it deepen consequence, continuity, or strategic depth?
4. Can it be validated by current contract and test strategy?
5. Does it move at least one horizon goal forward?

If fewer than three answers are yes, re-scope or defer.

## Metrics That Matter

1. Exploration engagement
- Systems visited per active player
- Repeat visits to previously discovered regions

2. Strategic play
- Share of sessions using route comparison or market-distance tradeoffs
- Progression milestones reached without tutorial intervention

3. Operations and economy health
- Mission completion rate by tier
- Crafting completion rate by tier band
- Time to first durable unit from new save

4. Continuity and retention
- Return rate after first successful mission completion
- Session resume success without support intervention

5. Quality and stability
- Flake rate and regression escape count
- Mean time to diagnose contract drift issues

## What This Is Not

- Not a pure orbital sandbox with no progression pressure.
- Not an arcade loop disconnected from world-state consequences.
- Not a content treadmill that ignores simulation readability.

## Source Inputs (Revision 2)

- Conversation context and project origin details
- Existing architecture and policy documents in this repository
- Mission and narrative inputs from:
	- docs/First Target.md
	- docs/Stellar Main and side missions.md
	- docs/Stellar notes.md
- Resource and crafting inputs from:
	- docs/Stellar mineable raw elements - Mineable Materials.csv
	- docs/Stellar craftable items - Craftable Items.csv
