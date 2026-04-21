export interface OpeningSequenceContent {
	sequenceTitle: string;
	eyebrow: string;
	phaseOneTitle: string;
	phaseOneDescription: string;
	phaseTwoTitle: string;
	phaseTwoDescription: string;
	phaseThreeTitle: string;
	systemChecks: string[];
	aiTransmission: string;
	hudTitle: string;
	aiLabel: string;
}

export const OPENING_STAGE_TIMINGS_MS = {
	blackoutReveal: 700,
	firstViewReveal: 2300,
	aiReveal: 4200,
} as const;

const OPENING_SEQUENCE_LIBRARY: Record<string, Record<string, OpeningSequenceContent>> = {
	en: {
		'cold-boot': {
			sequenceTitle: 'Opening Sequence: Cold Boot',
			eyebrow: 'Mission Bootstrap',
			phaseOneTitle: '1. The Blackout Phase',
			phaseOneDescription:
				'The screen is pitch black. The life-support pumps thrum in a rigid rhythm while heavy breathing cuts through the cabin noise.',
			phaseTwoTitle: '2. The First View',
			phaseTwoDescription:
				'The HUD sputters online. Through a cracked Tier 1 Scavenger Pod canopy, the Graveyard drifts by: fragmented hulls, severed spars, and cold wreckage crossing the silhouette of a dying blue sun.',
			phaseThreeTitle: '3. The AI Awakening',
			systemChecks: [
				'BIOS CHECK... OK',
				'OXYGEN LEVELS... 18% (CRITICAL)',
				'NEURAL LINK... ESTABLISHED',
			],
			aiTransmission:
				'Pilot, the Reactor Drone has been lost. We are drifting on residual battery. To survive, we must secure high-density matter for the Fabrication Unit. Deployment of the last Expendable unit is authorized.',
			hudTitle: 'COLD BOOT // TIER 1 SCAVENGER POD',
			aiLabel: 'AI LINK // DEGRADED CHANNEL',
		},
		'cold-boot-distress': {
			sequenceTitle: 'Opening Sequence: Cold Boot',
			eyebrow: 'Distress Bootstrap',
			phaseOneTitle: '1. The Blackout Phase',
			phaseOneDescription:
				'The cockpit remains black. Vent fans pulse in a failing cadence while your breathing is amplified through a damaged filter stack.',
			phaseTwoTitle: '2. The First View',
			phaseTwoDescription:
				'The HUD crawls online through static. The Graveyard hangs outside your cracked canopy while a pale blue sun silhouettes drifting ship carcasses.',
			phaseThreeTitle: '3. The AI Awakening',
			systemChecks: [
				'BIOS CHECK... DEGRADED MODE',
				'OXYGEN LEVELS... 14% (CRITICAL)',
				'NEURAL LINK... ESTABLISHED',
			],
			aiTransmission:
				'Pilot, telemetry confirms Reactor Drone destruction. Residual battery is collapsing. Prioritize high-density matter acquisition for Fabrication Unit continuity. Final Expendable authorization granted.',
			hudTitle: 'COLD BOOT // DISTRESS PROFILE',
			aiLabel: 'AI LINK // EMERGENCY CHANNEL',
		},
	},
};

export function resolveOpeningSequenceContent(locale?: string, variant?: string): OpeningSequenceContent {
	const baseLocale = (locale ?? 'en').toLowerCase().split('-')[0];
	const requestedVariant = (variant ?? 'cold-boot').toLowerCase();

	const localeCatalog = OPENING_SEQUENCE_LIBRARY[baseLocale] ?? OPENING_SEQUENCE_LIBRARY['en'];
	return localeCatalog[requestedVariant] ?? localeCatalog['cold-boot'];
}
