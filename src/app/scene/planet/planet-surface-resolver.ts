/**
 * Decides how a celestial body gets its surface.
 *
 * Approved catalog identities select shared imagery; other texturable bodies
 * retain deterministic procedural surfaces. Stars and giants stay outside this
 * path. See docs/procedural-planets-2026-09-28.md.
 */
import type { CatalogIdentity } from '../../model/catalog-identity';
import { resolveCelestialAppearance } from '../../model/celestial-appearance';
import type { SurfaceArchetype } from '../../model/celestial-classification';
import type { PlanetArchetype } from '../../model/planet/planet-seed';
import type { PlanetLodTier } from '../../model/planet/planet-texture';
import { resolveCatalogPlanetSurfaceAsset, type CatalogPlanetSurfaceAsset } from './planet-surface-catalog';

/**
 * Structural subset of `ViewerBody`. Declared locally so the planet generator
 * does not depend on the viewer module.
 */
export interface ResolvablePlanetBody {
  id: string;
  bodyType?: string;
  surfaceArchetype?: SurfaceArchetype | null;
  catalogIdentity?: CatalogIdentity | null;
  displayName?: string;
}

export interface PlanetSurfaceRequest {
  /** Cache key. Distinct generator versions, archetypes and tiers never collide. */
  key: string;
  bodyId: string;
  archetype: PlanetArchetype;
  surfaceArchetype: SurfaceArchetype;
  generatorVersion: string;
  tier: PlanetLodTier;
  fallbackReason?: string;
}

export interface CatalogPlanetSurfaceRequest {
  key: string;
  bodyId: string;
  identity: CatalogIdentity;
  asset: CatalogPlanetSurfaceAsset;
  tier: PlanetLodTier;
}

export type PlanetSurfaceSourceRequest =
  { kind: 'catalog'; request: CatalogPlanetSurfaceRequest } | { kind: 'procedural'; request: PlanetSurfaceRequest };

/**
 * Only planets and moons get generated surfaces. Stars are self-lit sprites,
 * asteroids already have their own deformed-rock treatment, and stations,
 * gates and debris are built geometry rather than worlds.
 */
export function isTexturableBody(body: ResolvablePlanetBody | null | undefined): boolean {
  if (!body?.surfaceArchetype) return false;
  const resolution = resolveCelestialAppearance({
    source: 'canonical',
    bodyId: body.id,
    bodyType: body.bodyType,
    surfaceArchetype: body.surfaceArchetype,
  });
  return (
    resolution.valid &&
    (resolution.input.renderer === 'terran' ||
      resolution.input.renderer === 'icy-moon' ||
      resolution.input.renderer === 'rocky-moon')
  );
}

/**
 * Picks the implemented solid-surface generator. Canonical surface
 * classification is preserved separately on the request; unsupported solid
 * archetypes use this terran renderer only through the explicit fallback.
 */
export function resolvePlanetArchetype(body: ResolvablePlanetBody): PlanetArchetype {
  return body.surfaceArchetype === 'icy-moon' || body.surfaceArchetype === 'rocky-moon'
    ? body.surfaceArchetype
    : 'terran';
}

export function resolvePlanetSurface(
  body: ResolvablePlanetBody | null | undefined,
  tier: PlanetLodTier,
): PlanetSurfaceRequest | null {
  if (!body || !body.id || !isTexturableBody(body)) {
    return null;
  }

  if (!body.surfaceArchetype) return null;
  const resolved = resolveCelestialAppearance({
    source: 'canonical',
    bodyId: body.id,
    bodyType: body.bodyType,
    surfaceArchetype: body.surfaceArchetype,
  });
  if (
    !resolved.valid ||
    (resolved.input.renderer !== 'terran' &&
      resolved.input.renderer !== 'icy-moon' &&
      resolved.input.renderer !== 'rocky-moon')
  )
    return null;

  return {
    key: `${resolved.input.generatorVersion}|${resolved.input.surfaceArchetype}|${tier}|${body.id}`,
    bodyId: body.id,
    archetype: resolvePlanetArchetype(body),
    surfaceArchetype: resolved.input.surfaceArchetype,
    generatorVersion: resolved.input.generatorVersion,
    tier,
    fallbackReason: resolved.input.fallbackReason,
  };
}

/**
 * Selects approved imagery only from the exact astronomical identity pair.
 * Unknown or absent identities retain the existing procedural request.
 */
export function resolvePlanetSurfaceSource(
  body: ResolvablePlanetBody | null | undefined,
  tier: PlanetLodTier,
): PlanetSurfaceSourceRequest | null {
  const proceduralRequest = resolvePlanetSurface(body, tier);
  if (!proceduralRequest || !body) return null;

  const asset = resolveCatalogPlanetSurfaceAsset(body.catalogIdentity);
  if (!asset) {
    return { kind: 'procedural', request: proceduralRequest };
  }

  return {
    kind: 'catalog',
    request: {
      key: `catalog|${asset.assetVersion}|${tier}|${body.id}`,
      bodyId: body.id,
      identity: asset.identity,
      asset,
      tier,
    },
  };
}
