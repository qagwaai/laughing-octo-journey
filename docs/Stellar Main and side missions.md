# 

Stellar: Main and Side Missions

This document outlines the linear mission progression and optional side quests following the "Cold Boot" tutorial sequence. The player begins with a functional but vulnerable pod in an asteroid field rich with common and uncommon materials.

## **Act 1: The Scavenger's Rise (Main Storyline)**

The primary objective of Act 1 is to establish a foothold, interact with the local economy, and build the first permanent mining fleet.

| Mission ID | Title | Objective / Mechanics | Rewards   |
| :---- | :---- | :---- | :---- |
| **M-01** | The Local Hub | Detect a faint beacon leading to a neutral trading outpost. Introduce the Market interface. Sell excess Iron to purchase basic fuel. | Market Access, 500 Credits |
| **M-02** | Basic Economics | A friendly miner (NPC: "Jax") gives you a Basic Mining Laser (Tier 1\) blueprint. Harvest 50 Carbon and 30 Copper from nearby Rocky Planetoid fragments to craft it. | Basic Mining Laser (Installed) |
| **M-03** | The Replacement | With the laser active, mine enough Silicon and Nickel from local Moons to fabricate a "Permanent Borer Drone" to replace your expended Dart. | Permanent Borer Drone |
| **M-04** | Turf War | While mining Magnesium, a hostile scavenger targets your new drone. Flee to the market or use the Borer's laser as an improvised weapon to survive. | Combat UI Unlocked, Damaged Hull Plating (Loot) |
| **M-05** | Stepping Stone | Use the Market to purchase a Pulse Drill (Tier 2\) blueprint. Gather Lithium and Mercury to power it, preparing to leave the starting sector. | Sector Map Unlocked, Pulse Drill |

## **Sector 1: Side Quests**

These optional missions provide extra credits, rare materials, and world-building opportunities.

| Quest ID | Title | Objective / Mechanics | Rewards   |
| :---- | :---- | :---- | :---- |
| **SQ-01** | The Lithium Rush | Jax the miner tips you off to a dense pocket of Lithium in a hazardous Brine Flat asteroid. Navigate around environmental hazards to mine it before hostile factions arrive. | 100x Lithium, Blueprint: High-Density Battery |
| **SQ-02** | Scavenger's Bounty | A distress beacon leads to an abandoned pod. You must carefully extract its remaining Chromium without triggering a critical reactor meltdown. | 50x Chromium, Damaged Reactor Core (Sellable) |
| **SQ-03** | Market Fluctuation | The Market is experiencing a shortage of Tungsten. If the player can venture near a High-Gravity Planet and return with Tungsten within a time limit, they earn triple the market value. | High Credit Payout, Faction Reputation (+) |
| **SQ-04** | Tracker Tag | A hostile miner has been stealing from new arrivals. Tag their ship with a tracker made of Copper and Silicon so the local enforcers can hunt them down. | Bounty Payout, Safe Mining Zone Unlocked |

## **Implementation Notes**

* **Economy:** The Market needs dynamic pricing. When SQ-03 triggers, the value of Tungsten should temporarily spike.  
* **Enemies:** Hostile miners in M-04 and SQ-04 should use low-tier equipment (Tier 1 lasers) so the player can outmaneuver or outlast them with the recent hull patch.  
* **Progression:** M-05 acts as the gateway to Tier 2 mining and pushes the player to explore Brine Flats, Metallic Asteroids, and Liquid Pockets.

`// Example Mission Tracking Logic`  
`MissionTracker = {`  
    `"M-01": { status: "LOCKED", prerequisites: ["Cold Boot Completed"] },`  
    `"M-02": { status: "LOCKED", prerequisites: ["M-01"] },`  
    `"SQ-01": { status: "LOCKED", prerequisites: ["M-02"] }`  
`};`  
    