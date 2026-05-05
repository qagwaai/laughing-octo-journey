import { Triple } from './triple';
import { SpatialState } from './spatial';

export const MARKET_LIST_REQUEST_EVENT = 'market-list-request';
export const MARKET_LIST_RESPONSE_EVENT = 'market-list-response';
export const MARKET_LIST_BY_LOCATION_REQUEST_EVENT = 'market-list-by-location-request';
export const MARKET_LIST_BY_LOCATION_RESPONSE_EVENT = 'market-list-by-location-response';

export interface MarketListRequest {
	playerName: string;
	sessionKey: string;
	solarSystemId?: string;
}

export interface MarketSummary {
	marketId: string;
	solarSystemId: string;
	marketName: string;
	siteType: string;
	siteName: string;
	isStarterMarket?: boolean;
	spatial: SpatialState;
	trajectory?: {
		kind: 'static' | 'orbital-elements';
		orbit?: {
			anchorBodyId: string;
			semiMajorAxisKm: number;
			eccentricity: number;
			inclinationDeg: number;
			longitudeOfAscendingNodeDeg: number;
			argumentOfPeriapsisDeg: number;
			meanAnomalyAtEpochDeg: number;
			orbitalPeriodSec: number;
			epoch: string;
		};
	};
	distanceKm?: number;
	isDocked?: boolean;
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

export interface MarketListByLocationRequest {
	playerName: string;
	sessionKey: string;
	solarSystemId: string;
	positionKm: Triple;
	distanceKm: number;
	limit?: number;
	locationTypes?: string[];
	characterId?: string;
	shipId?: string;
}

export interface MarketListByLocationResponse {
	success: boolean;
	message: string;
	playerName?: string;
	solarSystemId?: string;
	positionKm?: Triple;
	distanceKm?: number;
	locationTypes?: string[];
	isDocked?: boolean;
	dockedMarketId?: string | null;
	markets: MarketSummary[];
}

export function computeDistanceKm(a: Triple, b: Triple): number {
	const dx = a.x - b.x;
	const dy = a.y - b.y;
	const dz = a.z - b.z;
	return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
