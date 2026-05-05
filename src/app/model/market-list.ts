import { Triple } from './triple';

export const MARKET_LIST_REQUEST_EVENT = 'market-list-request';
export const MARKET_LIST_RESPONSE_EVENT = 'market-list-response';

export interface MarketListRequest {
	playerName: string;
	sessionKey: string;
	solarSystemId?: string;
}

export interface MarketSummary {
	marketId: string;
	solarSystemId: string;
	marketName: string;
	locationType: string;
	locationName: string;
	priceMultiplier: number;
	driftPercentPerHour: number;
	restockIntervalMinutes: number;
}

export interface MarketListResponse {
	success: boolean;
	message: string;
	playerName?: string;
	solarSystemId?: string;
	markets: MarketSummary[];
}

export function computeDistanceKm(a: Triple, b: Triple): number {
	const dx = a.x - b.x;
	const dy = a.y - b.y;
	const dz = a.z - b.z;
	return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
