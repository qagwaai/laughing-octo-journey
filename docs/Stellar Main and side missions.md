# Stellar: Main and Side Missions

This document tracks the canonical mission progression and optional side quests after the `first-target` tutorial.

## Current Resume Behavior (Implemented)

Join routing now depends on the player's `first-target` status:

- `started` / `in-progress` / `paused` -> route to `left:game-main` + `right:opening-cold-boot-scan`
- `completed` / `turned-in` -> route to `left:game-main` + `right:mission-board`
- all other values (including missing) -> route to cold boot onboarding

This prevents replaying the cold boot scenario after tutorial completion.

## Act 1: The Scavenger's Rise (Main Storyline)

The primary objective of Act 1 is to establish a foothold, interact with the local economy, and build the first permanent mining fleet.

| Mission ID | Title | Objective / Mechanics | Rewards |
| :---- | :---- | :---- | :---- |
| **M-01** | The Local Hub | Detect a faint beacon leading to a neutral trading outpost. Introduce the Market interface. Sell excess Iron to purchase basic fuel. | Market Access, 500 Credits |
| **M-02** | Basic Economics | A friendly miner (NPC: "Jax") gives you a Basic Mining Laser (Tier 1) blueprint. Harvest 50 Carbon and 30 Copper from nearby Rocky Planetoid fragments to craft it. | Basic Mining Laser (Installed) |
| **M-03** | The Replacement | With the laser active, mine enough Silicon and Nickel from local Moons to fabricate a "Permanent Borer Drone" to replace your expended Dart. | Permanent Borer Drone |
| **M-04** | Turf War | While mining Magnesium, a hostile scavenger targets your new drone. Flee to the market or use the Borer's laser as an improvised weapon to survive. | Combat UI Unlocked, Damaged Hull Plating (Loot) |
| **M-05** | Stepping Stone | Use the Market to purchase a Pulse Drill (Tier 2) blueprint. Gather Lithium and Mercury to power it, preparing to leave the starting sector. | Sector Map Unlocked, Pulse Drill |

## Sector 1: Side Quests

These optional missions provide extra credits, rare materials, and world-building opportunities.

| Quest ID | Title | Objective / Mechanics | Rewards |
| :---- | :---- | :---- | :---- |
| **SQ-system-survey-01** | Local Survey Contract | Post-tutorial telemetry contract: scan three distinct bodies, reach one market/outpost, and upload system telemetry. Unlocks in parallel with M-01 after `first-target` completion. | 350 Credits, Blueprint: Survey Scanner Tuning Kit |
| **SQ-01** | The Lithium Rush | Jax the miner tips you off to a dense pocket of Lithium in a hazardous Brine Flat asteroid. Navigate around environmental hazards to mine it before hostile factions arrive. | 100x Lithium, Blueprint: High-Density Battery |
| **SQ-02** | Scavenger's Bounty | A distress beacon leads to an abandoned pod. You must carefully extract its remaining Chromium without triggering a critical reactor meltdown. | 50x Chromium, Damaged Reactor Core (Sellable) |
| **SQ-03** | Market Fluctuation | The Market is experiencing a shortage of Tungsten. If the player can venture near a High-Gravity Planet and return with Tungsten within a time limit, they earn triple the market value. | High Credit Payout, Faction Reputation (+) |
| **SQ-04** | Tracker Tag | A hostile miner has been stealing from new arrivals. Tag their ship with a tracker made of Copper and Silicon so the local enforcers can hunt them down. | Bounty Payout, Safe Mining Zone Unlocked |

## Unlock Graph (Current)

- `first-target` -> `m-01`, `sq-02`, `sq-03`, `sq-system-survey-01`
- `m-01` -> `m-02`
- `m-02` -> `m-03`, `sq-01`
- `m-03` -> `m-04`
- `m-04` -> `m-05`, `sq-04`

## Implementation Notes

- Economy: The Market uses dynamic pricing. When SQ-03 triggers, the value of Tungsten should temporarily spike.
- Enemies: Hostile miners in M-04 and SQ-04 should use low-tier equipment (Tier 1 lasers) so players can outmaneuver or outlast them with recent hull repairs.
- Progression: M-05 acts as the gateway to Tier 2 mining and pushes players toward Brine Flats, Metallic Asteroids, and Liquid Pockets.

## Regression Coverage Added

- Dedicated e2e coverage for the completed tutorial resume path:
    - `e2e/tests/login-after-first-target-completed.spec.ts`
    