import type { ViewerBody } from '../../model/solar-system-get';
import type { RenderQuality } from '../render-quality';

export const MARS_STATION_ID = 'sol-mars-orbit';

export interface StationModelAsset {
  readonly triangleCount: number;
  readonly url: string;
}

export const MARS_STATION_ASSETS: Readonly<Record<RenderQuality, StationModelAsset>> = {
  standard: { triangleCount: 139_330, url: 'models/sol-mars-station-150k.glb?v=0a9ed223' },
  low: { triangleCount: 74_695, url: 'models/sol-mars-station-75k.glb?v=8f0a0e9c' },
};

export const MARS_STATION_POSTER_URL = 'models/sol-mars-station-poster.webp?v=772cfae6';

export interface StationModelDefinition {
  readonly solarSystemId: string;
  readonly assets: Readonly<Record<RenderQuality, StationModelAsset>>;
  readonly posterUrl: string;
}

export const STATION_MODELS: Readonly<Record<string, StationModelDefinition | undefined>> = {
  [MARS_STATION_ID]: {
    solarSystemId: 'sol',
    assets: MARS_STATION_ASSETS,
    posterUrl: MARS_STATION_POSTER_URL,
  },
};

export function resolveStationModel(body: ViewerBody | null | undefined): StationModelDefinition | null {
  if (!body || body.bodyType !== 'station') return null;
  const model = STATION_MODELS[body.id];
  return model && body.spatial.solarSystemId === model.solarSystemId ? model : null;
}

export function hasDedicatedStationModel(body: ViewerBody | null | undefined): boolean {
  return resolveStationModel(body) !== null;
}
