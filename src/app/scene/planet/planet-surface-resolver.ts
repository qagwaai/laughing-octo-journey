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
import { PLANET_GENERATOR_VERSION } from '../../model/planet/planet-seed';
import type { PlanetLodTier } from '../../model/planet/planet-texture';

/**
 * Structural subset of `ViewerBody`. Declared locally so the planet generator
 * does not depend on the viewer module.
 */
export interface ResolvablePlanetBody {
  id: string;
  bodyType?: string;
  displayName?: string;
}

export interface PlanetSurfaceRequest {
  /** Cache key. Distinct generator versions, archetypes and tiers never collide. */
  key: string;
  bodyId: string;
  archetype: PlanetArchetype;
  tier: PlanetLodTier;
}

function normalizeToken(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? '';
}

/**
 * Only planets and moons get generated surfaces. Stars are self-lit sprites,
 * asteroids already have their own deformed-rock treatment, and stations,
 * gates and debris are built geometry rather than worlds.
 */
export function isTexturableBody(body: ResolvablePlanetBody | null | undefined): boolean {
  const bodyType = normalizeToken(body?.bodyType);
  return bodyType === 'planet' || bodyType === 'moon';
}

/**
 * Picks the generator archetype for a body.
 *
 * Only `terran` exists today, so every world currently derives from the same
 * model and varies by seed alone. Gas giants, ice worlds and barren rock are
 * the planned next archetypes, and Sol needs them before it can look correct;
 * both land here.
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

  const archetype = resolvePlanetArchetype(body);

  return {
    key: `${PLANET_GENERATOR_VERSION}|${archetype}|${tier}|${body.id}`,
    bodyId: body.id,
    archetype,
    tier,
  };
}
