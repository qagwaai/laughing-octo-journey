import type { Triple } from '../../model/triple';
import { EXTERNAL_OBJECT_SCHEMA_VERSION, type ExternalObjectDescriptor } from '../../model/external-object-descriptor';
import type { MarketRouteFeedGate, MarketRouteFeedStation } from '../../model/market-list';
import type { ShipExteriorRouteFeeds } from './ship-exterior-route-feed-adapter';

export interface ShipExteriorDevStationSeedContext {
  shipId: string;
  solarSystemId: string;
  positionKm: Triple;
}

const DEV_STATION_OFFSET_KM: Triple = {
  x: 30,
  y: 6,
  z: -8,
};

const DEV_GATE_OFFSET_KM: Triple = {
  x: -28,
  y: 10,
  z: 12,
};

function buildDevStationDescriptor(shipId: string): ExternalObjectDescriptor {
  return {
    descriptorId: `dev-station-${shipId}`,
    schemaVersion: EXTERNAL_OBJECT_SCHEMA_VERSION,
    domain: 'stations',
    objectFamily: 'research-platform',
    roleCue: 'validation-anchor',
    factionCue: 'neutral',
    fallbackTier: 'standard',
    displayLabel: 'Dev Station',
    silhouetteProfile: 'station',
    materialProfile: 'industrial',
    emissiveProfile: 'readability',
  };
}

function buildDevGateDescriptor(shipId: string): ExternalObjectDescriptor {
  return {
    descriptorId: `dev-gate-${shipId}`,
    schemaVersion: EXTERNAL_OBJECT_SCHEMA_VERSION,
    domain: 'gates',
    objectFamily: 'ring-gate',
    roleCue: 'validation-anchor',
    factionCue: 'neutral',
    fallbackTier: 'standard',
    displayLabel: 'Dev Gate',
    silhouetteProfile: 'gate-ring',
    materialProfile: 'infrastructure',
    emissiveProfile: 'readability',
  };
}

export function createDevStationSeed(context: ShipExteriorDevStationSeedContext): MarketRouteFeedStation {
  return {
    marketId: `dev-station-${context.shipId}`,
    solarSystemId: context.solarSystemId,
    marketName: 'Dev Readability Station',
    siteType: 'station',
    siteName: 'Dev Readability Station',
    spatial: {
      solarSystemId: context.solarSystemId,
      frame: 'barycentric',
      positionKm: {
        x: context.positionKm.x + DEV_STATION_OFFSET_KM.x,
        y: context.positionKm.y + DEV_STATION_OFFSET_KM.y,
        z: context.positionKm.z + DEV_STATION_OFFSET_KM.z,
      },
      epochMs: 1,
    },
    descriptor: buildDevStationDescriptor(context.shipId),
  };
}

export function createDevGateSeed(context: ShipExteriorDevStationSeedContext): MarketRouteFeedGate {
  return {
    gateId: `dev-gate-${context.shipId}`,
    sourceSystemId: context.solarSystemId,
    destSystemId: `${context.solarSystemId}-dev`,
    traversalCostAu: 0.25,
    traversalTimeHours: 0.1,
    spatial: {
      solarSystemId: context.solarSystemId,
      frame: 'barycentric',
      positionKm: {
        x: context.positionKm.x + DEV_GATE_OFFSET_KM.x,
        y: context.positionKm.y + DEV_GATE_OFFSET_KM.y,
        z: context.positionKm.z + DEV_GATE_OFFSET_KM.z,
      },
      epochMs: 1,
    },
    descriptor: buildDevGateDescriptor(context.shipId),
    approachMetadata: {
      approachCue: 'direct-centerline',
      landmarkFraming: 'full-ring',
      navBeaconCue: 'continuous',
      hazardCue: 'low',
      warningEscalation: 'none',
      recommendedStandOffKm: 1400,
      approachWindowKm: { min: 1000, max: 2200 },
    },
  };
}

export function seedRouteFeedsWithDevStation(
  routeFeeds: ShipExteriorRouteFeeds,
  context: ShipExteriorDevStationSeedContext,
): ShipExteriorRouteFeeds {
  return {
    ...routeFeeds,
    gates: routeFeeds.gates.length > 0 ? [...routeFeeds.gates] : [createDevGateSeed(context)],
    stations: routeFeeds.stations.length > 0 ? [...routeFeeds.stations] : [createDevStationSeed(context)],
  };
}
