export const FIRST_TARGET_MISSION_ID = 'first-target';

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
