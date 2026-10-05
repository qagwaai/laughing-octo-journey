/**
 * Decides how a celestial body gets its surface.
 *
 * This is deliberately the only place that answers that question. Today every
 * texturable body derives its appearance from its own id through the terran
 * generator, but named systems are expected to diverge: Sol's planets are
 * well known and should read as themselves rather than as generic worlds.
 *
 * Routing every body through here means that divergence is a change to
 * `resolvePlanetArchetype` (or a catalog lookup placed alongside it) rather
 * than a refactor of the viewer scenes. See docs/procedural-planets-2026-09-28.md.
 */
import type { PlanetArchetype } from '../../model/planet/planet-seed';
import type { PlanetLodTier } from '../../model/planet/planet-texture';
import type { SurfaceArchetype } from '../../model/celestial-classification';
import { resolveCelestialAppearance } from '../../model/celestial-appearance';

/**
 * Structural subset of `ViewerBody`. Declared locally so the planet generator
 * does not depend on the viewer module.
 */
export interface ResolvablePlanetBody {
  id: string;
  bodyType?: string;
  surfaceArchetype?: SurfaceArchetype | null;
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
  return resolution.valid && resolution.input.renderer === 'terran';
}

/**
 * Picks the implemented solid-surface generator. Canonical surface
 * classification is preserved separately on the request; unsupported solid
 * archetypes use this terran renderer only through the explicit fallback.
 */
export function resolvePlanetArchetype(_body: ResolvablePlanetBody): PlanetArchetype {
  return 'terran';
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
  if (!resolved.valid || resolved.input.renderer !== 'terran') return null;

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
