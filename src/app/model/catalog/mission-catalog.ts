export type MissionType = 'main' | 'side';
export type MissionAct = 'tutorial' | 'act-1';

export interface MissionRewards {
	credits?: number;
	items?: string[];
	blueprints?: string[];
	unlocks?: string[];
}

/**
 * Canonical mission definition. All missions in the game are registered here.
 * Prerequisites are mission IDs that must carry status 'completed' or 'turned-in'
 * before this mission becomes visible to the player.
 */
export interface MissionDefinition {
	readonly id: string;
	readonly type: MissionType;
	readonly act: MissionAct;
	readonly title: string;
	readonly briefing: string;
	readonly objectives: readonly string[];
	/** IDs of missions that must be completed before this one is visible. */
	readonly prerequisites: readonly string[];
	readonly rewards: MissionRewards;
}

// -- Mission ID constants -----------------------------------------------------

export const MISSION_IDS = {
	firstTarget: 'first-target',
	m01: 'm-01',
	m02: 'm-02',
	m03: 'm-03',
	m04: 'm-04',
	m05: 'm-05',
	sq01: 'sq-01',
	sq02: 'sq-02',
	sq03: 'sq-03',
	sq04: 'sq-04',
} as const;

export type KnownMissionId = (typeof MISSION_IDS)[keyof typeof MISSION_IDS];

// -- Catalog ------------------------------------------------------------------

export const MISSION_CATALOG: readonly MissionDefinition[] = [
	{
		id: MISSION_IDS.firstTarget,
		type: 'main',
		act: 'tutorial',
		title: 'The First Mission: Your First Target',
		briefing:
			'Target a high-iron asteroid using the Dart Maneuver, then recover and repair your Scavenger Pod to complete the tutorial.',
		objectives: [
			'Identify an Iron asteroid via full scan.',
			'Neutralize the identified asteroid using a launchable payload.',
			'Manufacture a Hull Patch Kit.',
			'Repair the Scavenger Pod using the Hull Patch Kit.',
		],
		prerequisites: [],
		rewards: { unlocks: [MISSION_IDS.m01] },
	},
	{
		id: MISSION_IDS.m01,
		type: 'main',
		act: 'act-1',
		title: 'The Local Hub',
		briefing:
			'Detect a faint beacon leading to a neutral trading outpost. Access the Market and sell excess Iron to purchase basic fuel.',
		objectives: [
			'Follow the beacon signal to the trading outpost.',
			'Access the Market interface.',
			'Sell excess Iron to earn at least 500 Credits.',
		],
		prerequisites: [MISSION_IDS.firstTarget],
		rewards: { credits: 500, unlocks: [MISSION_IDS.m02] },
	},
	{
		id: MISSION_IDS.m02,
		type: 'main',
		act: 'act-1',
		title: 'Basic Economics',
		briefing:
			'A friendly miner named Jax hands you a Basic Mining Laser (Tier 1) blueprint. Harvest Carbon and Copper from nearby Rocky Planetoid fragments to craft it.',
		objectives: [
			'Receive the Basic Mining Laser blueprint from Jax.',
			'Harvest 50 Carbon from Rocky Planetoid fragments.',
			'Harvest 30 Copper from Rocky Planetoid fragments.',
			'Craft the Basic Mining Laser (Tier 1).',
		],
		prerequisites: [MISSION_IDS.m01],
		rewards: { items: ['Basic Mining Laser (Installed)'], unlocks: [MISSION_IDS.m03, MISSION_IDS.sq01] },
	},
	{
		id: MISSION_IDS.m03,
		type: 'main',
		act: 'act-1',
		title: 'The Replacement',
		briefing:
			'With the laser active, mine Silicon and Nickel from local Moons to fabricate a Permanent Borer Drone to replace your expended Dart.',
		objectives: [
			'Mine Silicon from local Moons.',
			'Mine Nickel from local Moons.',
			'Fabricate a Permanent Borer Drone.',
		],
		prerequisites: [MISSION_IDS.m02],
		rewards: { items: ['Permanent Borer Drone'], unlocks: [MISSION_IDS.m04] },
	},
	{
		id: MISSION_IDS.m04,
		type: 'main',
		act: 'act-1',
		title: 'Turf War',
		briefing:
			"While mining Magnesium, a hostile scavenger targets your new drone. Flee to the market or use the Borer's laser to survive.",
		objectives: [
			'Mine Magnesium from the asteroid field.',
			'Survive the hostile scavenger encounter.',
		],
		prerequisites: [MISSION_IDS.m03],
		rewards: { items: ['Damaged Hull Plating (Loot)'], unlocks: [MISSION_IDS.m05, MISSION_IDS.sq04] },
	},
	{
		id: MISSION_IDS.m05,
		type: 'main',
		act: 'act-1',
		title: 'Stepping Stone',
		briefing:
			'Use the Market to purchase a Pulse Drill (Tier 2) blueprint. Gather Lithium and Mercury to power it, preparing to leave the starting sector.',
		objectives: [
			'Purchase the Pulse Drill (Tier 2) blueprint from the Market.',
			'Gather Lithium.',
			'Gather Mercury.',
			'Activate the Pulse Drill.',
		],
		prerequisites: [MISSION_IDS.m04],
		rewards: { items: ['Pulse Drill'] },
	},
	{
		id: MISSION_IDS.sq01,
		type: 'side',
		act: 'act-1',
		title: 'The Lithium Rush',
		briefing:
			'Jax tips you off to a dense Lithium pocket in a hazardous Brine Flat asteroid. Mine it before hostile factions arrive.',
		objectives: [
			'Navigate to the Brine Flat asteroid.',
			'Mine 100 Lithium while avoiding environmental hazards.',
			'Return before hostile factions arrive.',
		],
		prerequisites: [MISSION_IDS.m02],
		rewards: { items: ['100x Lithium', 'Blueprint: High-Density Battery'] },
	},
	{
		id: MISSION_IDS.sq02,
		type: 'side',
		act: 'act-1',
		title: "Scavenger's Bounty",
		briefing:
			'A distress beacon leads to an abandoned pod. Extract its Chromium carefully without triggering a reactor meltdown.',
		objectives: [
			'Follow the distress beacon to the abandoned pod.',
			'Extract 50 Chromium without triggering a reactor meltdown.',
		],
		prerequisites: [MISSION_IDS.firstTarget],
		rewards: { items: ['50x Chromium', 'Damaged Reactor Core (Sellable)'] },
	},
	{
		id: MISSION_IDS.sq03,
		type: 'side',
		act: 'act-1',
		title: 'Market Fluctuation',
		briefing:
			'A Tungsten shortage is spiking prices. Venture near a High-Gravity Planet, gather Tungsten, and return within the time limit to earn triple market value.',
		objectives: [
			'Gather Tungsten from near a High-Gravity Planet.',
			'Return to the Market within the time limit.',
			'Sell Tungsten at triple value.',
		],
		prerequisites: [MISSION_IDS.firstTarget],
		rewards: { credits: 0 },
	},
	{
		id: MISSION_IDS.sq04,
		type: 'side',
		act: 'act-1',
		title: 'Tracker Tag',
		briefing:
			'A hostile miner has been stealing from new arrivals. Craft a tracker from Copper and Silicon and tag their ship for local enforcers.',
		objectives: [
			'Gather Copper and Silicon for the tracker.',
			'Craft the tracker device.',
			"Tag the hostile miner's ship.",
		],
		prerequisites: [MISSION_IDS.m04],
		rewards: { credits: 0 },
	},
];

// -- Lookup helpers ------------------------------------------------------------

export function resolveMissionById(missionId: string): MissionDefinition | undefined {
	return MISSION_CATALOG.find((m) => m.id === missionId);
}

/**
 * Returns all missions from the catalog whose prerequisites are all satisfied
 * by the given set of completed mission IDs. Includes missions with no prerequisites.
 */
export function resolveVisibleMissions(completedMissionIds: ReadonlySet<string>): readonly MissionDefinition[] {
	return MISSION_CATALOG.filter((mission) =>
		mission.prerequisites.every((prereqId) => completedMissionIds.has(prereqId)),
	);
}

/**
 * Returns the IDs of all missions that become visible when justCompletedMissionId
 * is added to the completed set (i.e. their prerequisites are now fully satisfied).
 */
export function resolveNewlyUnlockedMissionIds(
	justCompletedMissionId: string,
	alreadyCompletedIds: ReadonlySet<string>,
): string[] {
	return MISSION_CATALOG.filter(
		(m) =>
			!alreadyCompletedIds.has(m.id) &&
			m.id !== justCompletedMissionId &&
			m.prerequisites.length > 0 &&
			(m.prerequisites as string[]).includes(justCompletedMissionId) &&
			m.prerequisites.every(
				(prereqId) => prereqId === justCompletedMissionId || alreadyCompletedIds.has(prereqId),
			),
	).map((m) => m.id);
}

/**
 * Returns true if a mission status string represents a completed/turned-in mission.
 */
export function isMissionCompleted(status: string | null | undefined): boolean {
	return status === 'completed' || status === 'turned-in';
}
