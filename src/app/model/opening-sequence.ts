import {
	OPENING_SEQUENCE_LIBRARY,
	type OpeningSequenceContent,
	type OpeningSequenceLocaleBundle,
} from './opening-sequence.locale';

export const OPENING_STAGE_TIMINGS_MS = {
	blackoutReveal: 700,
	firstViewReveal: 2300,
	aiReveal: 4200,
} as const;

export type { OpeningSequenceContent } from './opening-sequence.locale';

function resolveOpeningLocaleBundle(localeId?: string): OpeningSequenceLocaleBundle {
	const baseLocale = (localeId ?? 'en').toLowerCase().split('-')[0];
	return OPENING_SEQUENCE_LIBRARY[baseLocale] ?? OPENING_SEQUENCE_LIBRARY['en'];
}

export function resolveOpeningSequenceContent(localeId?: string, variant?: string): OpeningSequenceContent {
	const localeBundle = resolveOpeningLocaleBundle(localeId);
	const requestedVariant = (variant ?? 'cold-boot').toLowerCase();

	return localeBundle.variants[requestedVariant] ?? localeBundle.variants['cold-boot'];
}
