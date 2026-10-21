import type { ViewerBody } from '../../model/solar-system-get';
import type { RenderQuality } from '../render-quality';

export const MARS_STATION_ID = 'sol-mars-orbit';

export interface StationModelAsset {
  readonly triangleCount: number;
  readonly url: string;
}

export const MARS_STATION_ASSETS: Readonly<Record<RenderQuality, StationModelAsset>> = {
  standard: { triangleCount: 149_944, url: 'models/sol-mars-orbit-station-150k.glb?v=ffbe3535' },
  low: { triangleCount: 74_984, url: 'models/sol-mars-orbit-station-75k.glb?v=e6a443e4' },
};

export const MARS_STATION_POSTER_URL = 'models/sol-mars-orbit-station-poster.webp?v=dd98a30d';

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
