export const FIRST_TARGET_MISSION_ID = 'first-target';

// Re-export from mission-catalog for backwards-compat callers that imported IDs from this file.
export {
	MISSION_IDS,
	type KnownMissionId,
} from './mission-catalog';

export interface MissionLocaleContent {
	title: string;
	briefing: string[];
	gameplayLoopTitle: string;
	gameplayLoopSteps: string[];
}

export interface MissionLocaleBundle {
	missions: Record<string, MissionLocaleContent>;
}

export const MISSION_LIBRARY: Record<string, MissionLocaleBundle> = {
	en: {
		missions: {
			[FIRST_TARGET_MISSION_ID]: {
				title: 'The First Mission: Your First Target',
				briefing: [
					'Yes, the player starts by targeting an asteroid, but with a twist: The Dart Maneuver.',
					'Instead of a mining laser, you are given a single Expendable "Dart" Ship. Since you have no "Permanent" ships yet, you must use your own ship\'s HUD to manually lock onto a nearby Level 1 Silicate Asteroid.',
				],
				gameplayLoopTitle: 'The Gameplay Loop of the Tutorial',
				gameplayLoopSteps: [
					'Scanning: You move your crosshair over a cluster of rocks. The HUD identifies a "High-Iron Trace."',
					'Launching: You press the ignition. The Expendable "Dart" (like the one you saw in the hangar) screams out of your launch tube.',
					'The Impact: The Dart does not mine - it impacts. It slams into the asteroid, shattering it into three manageable chunks.',
					'The Manual Retrieval: Without a Tug Ship, you must manually pilot your Scavenger Pod to "catch" the floating debris in your gravity scoop.',
				],
			},
			'm-01': {
				title: 'The Local Hub',
				briefing: [
					'A faint beacon cuts through the static of your newly repaired comms array. It is weak, but unmistakably artificial.',
					'Follow it to the nearest neutral trading outpost, access the Market interface, and sell your excess Iron to purchase basic fuel.',
				],
				gameplayLoopTitle: 'Mission Objectives',
				gameplayLoopSteps: [
					'Beacon Detection: Follow the beacon signal to the trading outpost.',
					'Market Access: Dock and access the Market interface for the first time.',
					'First Trade: Sell excess Iron to earn at least 500 Credits.',
				],
			},
			'm-02': {
				title: 'Basic Economics',
				briefing: [
					'A grizzled miner docked at the outpost — who goes by Jax — hands you a battered data chip.',
					'On it: the blueprint for a Basic Mining Laser (Tier 1). Harvest Carbon and Copper from the Rocky Planetoid fragments in the nearby belt to craft it.',
				],
				gameplayLoopTitle: 'Mission Objectives',
				gameplayLoopSteps: [
					'Blueprint: Receive the Basic Mining Laser (Tier 1) blueprint from Jax.',
					'Harvest Carbon: Collect 50 Carbon from Rocky Planetoid fragments.',
					'Harvest Copper: Collect 30 Copper from Rocky Planetoid fragments.',
					'Fabricate: Craft and install the Basic Mining Laser.',
				],
			},
			'm-03': {
				title: 'The Replacement',
				briefing: [
					'Your Dart is gone — expended on the first target. You need a permanent replacement before you can mine at scale.',
					'Use your new laser to extract Silicon and Nickel from the local Moons, then fabricate a Permanent Borer Drone.',
				],
				gameplayLoopTitle: 'Mission Objectives',
				gameplayLoopSteps: [
					'Mine Silicon: Extract Silicon ore from local Moon surfaces.',
					'Mine Nickel: Extract Nickel ore from local Moon surfaces.',
					'Fabricate: Build and deploy the Permanent Borer Drone.',
				],
			},
			'm-04': {
				title: 'Turf War',
				briefing: [
					'The Magnesium seam you found is rich — too rich to go unnoticed. A hostile scavenger locks onto your new Borer Drone.',
					'Flee to the outpost or use the Borer\'s improvised laser to drive them off. Either way, you will come out with loot.',
				],
				gameplayLoopTitle: 'Mission Objectives',
				gameplayLoopSteps: [
					'Mine Magnesium: Gather Magnesium from the asteroid field.',
					'Survive: Outlast or escape the hostile scavenger encounter.',
				],
			},
			'm-05': {
				title: 'Stepping Stone',
				briefing: [
					'The starting sector is tapped out. A Pulse Drill (Tier 2) blueprint is available at the Market — but it needs Lithium and Mercury to power it.',
					'Gather the materials, build the drill, and prepare to push into the next sector.',
				],
				gameplayLoopTitle: 'Mission Objectives',
				gameplayLoopSteps: [
					'Purchase: Buy the Pulse Drill (Tier 2) blueprint from the Market.',
					'Gather Lithium: Collect Lithium from the local belt.',
					'Gather Mercury: Collect Mercury from the local belt.',
					'Activate: Build and activate the Pulse Drill.',
				],
			},
			'sq-01': {
				title: 'The Lithium Rush',
				briefing: [
					'Jax slides you a coordinate on a napkin. "Dense Lithium pocket. Brine Flat asteroid — dangerous, but worth it. Go before the Rattlers do."',
					'Navigate the environmental hazards and mine the cache before the hostile faction arrives.',
				],
				gameplayLoopTitle: 'Side Quest Objectives',
				gameplayLoopSteps: [
					'Navigate: Reach the Brine Flat asteroid.',
					'Mine: Collect 100 Lithium while avoiding environmental hazards.',
					'Escape: Return before hostile factions close in.',
				],
			},
			'sq-02': {
				title: "Scavenger's Bounty",
				briefing: [
					'Your sensors catch a distress beacon from what looks like an abandoned pod drifting in the debris field.',
					'The pod\'s reactor is unstable. Extract its Chromium carefully — one wrong move and the whole thing goes critical.',
				],
				gameplayLoopTitle: 'Side Quest Objectives',
				gameplayLoopSteps: [
					'Locate: Follow the distress beacon to the abandoned pod.',
					'Extract: Carefully remove 50 Chromium without triggering a reactor meltdown.',
				],
			},
			'sq-03': {
				title: 'Market Fluctuation',
				briefing: [
					'A shortage alert blinks on the Market board: Tungsten prices have tripled and the window is short.',
					'Venture near the High-Gravity Planet, gather Tungsten under the intense pull, and return to sell before the price stabilizes.',
				],
				gameplayLoopTitle: 'Side Quest Objectives',
				gameplayLoopSteps: [
					'Source: Gather Tungsten from near the High-Gravity Planet.',
					'Return: Get back to the Market before the timer expires.',
					'Sell: Sell your Tungsten at the inflated triple value.',
				],
			},
			'sq-04': {
				title: 'Tracker Tag',
				briefing: [
					'Someone has been skimming cargo from new arrivals — miners like you. The local enforcer collective can act, but they need a tag on the ship first.',
					'Craft a tracker from Copper and Silicon, plant it on the hostile miner\'s hull, and let the enforcers do the rest.',
				],
				gameplayLoopTitle: 'Side Quest Objectives',
				gameplayLoopSteps: [
					'Gather Materials: Collect Copper and Silicon for the tracker device.',
					'Craft: Build the tracker from the gathered materials.',
					'Tag: Attach the tracker to the hostile miner\'s ship.',
				],
			},
		},
	},
	it: {
		missions: {
			[FIRST_TARGET_MISSION_ID]: {
				title: 'La prima missione: il tuo primo bersaglio',
				briefing: [
					"Si, il giocatore inizia prendendo di mira un asteroide, ma con una variante: la manovra Dart.",
					'Invece di un laser minerario, ti viene assegnata una singola nave Expendable "Dart". Poiche non possiedi ancora navi "permanenti", devi usare manualmente l\'HUD della tua nave per agganciare un vicino asteroide silicatico di livello 1.',
				],
				gameplayLoopTitle: 'Il ciclo di gioco del tutorial',
				gameplayLoopSteps: [
					'Scansione: sposti il mirino sopra un gruppo di rocce. L\'HUD identifica una "traccia ad alto contenuto di ferro".',
					'Lancio: premi l\'accensione. La Dart Expendable, come quella vista nell\'hangar, schizza fuori dal tubo di lancio.',
					'L\'impatto: la Dart non estrae, colpisce. Si schianta contro l\'asteroide, frantumandolo in tre blocchi gestibili.',
					'Recupero manuale: senza una Tug Ship, devi pilotare manualmente lo Scavenger Pod per "catturare" i detriti fluttuanti nel tuo raccoglitore gravitazionale.',
				],
			},
		},
	},
};

function resolveMissionLocaleBundle(localeId?: string): MissionLocaleBundle {
	const baseLocale = (localeId ?? 'en').toLowerCase().split('-')[0];
	return MISSION_LIBRARY[baseLocale] ?? MISSION_LIBRARY['en'];
}

export function resolveMissionLocaleContent(missionId: string, localeId?: string): MissionLocaleContent {
	const localeBundle = resolveMissionLocaleBundle(localeId);
	return localeBundle.missions[missionId] ?? localeBundle.missions[FIRST_TARGET_MISSION_ID];
}
