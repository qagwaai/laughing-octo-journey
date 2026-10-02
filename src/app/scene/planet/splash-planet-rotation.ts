/**
 * Which procedural planet the mining splash shows.
 *
 * Each visit picks one entry from `SPLASH_PLANET_ROTATION`; the generator
 * derives the whole surface from that id, so editing the list is all it takes
 * to add, drop or reorder splash planets. Entries are not curated for looks.
 *
 * `?splashPlanet=<id>` pins the planet for screenshots, e2e tests and previews.
 * Any id is accepted, so unlisted seeds can be previewed before adding them.
 */

/** The original fixed splash planet; also the pinned default for tests. */
export const SPLASH_PLANET_BODY_ID = 'nova-splash-homeworld';

export const SPLASH_PLANET_QUERY_PARAM = 'splashPlanet';
export const SPLASH_KIND_QUERY_PARAM = 'splashKind';

export type SplashPlanetKind = 'terran' | 'gas-giant';

export interface SplashPlanetEntry {
  id: string;
  kind: SplashPlanetKind;
}

const MAX_PINNED_ID_LENGTH = 64;

const TERRAN_IDS = [
  SPLASH_PLANET_BODY_ID,
  ...Array.from({ length: 24 }, (_, index) => `nova-splash-world-${String(index + 2).padStart(2, '0')}`),
];

const GAS_GIANT_IDS = Array.from(
  { length: 10 },
  (_, index) => `nova-splash-giant-${String(index + 1).padStart(2, '0')}`,
);

export const SPLASH_PLANET_ROTATION: readonly SplashPlanetEntry[] = [
  ...TERRAN_IDS.map((id) => ({ id, kind: 'terran' as const })),
  ...GAS_GIANT_IDS.map((id) => ({ id, kind: 'gas-giant' as const })),
];

function readPinnedBodyId(params: URLSearchParams): string | null {
  const pinned = params.get(SPLASH_PLANET_QUERY_PARAM)?.trim();
  return pinned && pinned.length <= MAX_PINNED_ID_LENGTH ? pinned : null;
}

export function selectSplashPlanet(
  search: string,
  random: () => number = Math.random,
  rotation: readonly SplashPlanetEntry[] = SPLASH_PLANET_ROTATION,
): SplashPlanetEntry {
  const params = new URLSearchParams(search);
  const pinned = readPinnedBodyId(params);
  if (pinned) {
    const listed = rotation.find((entry) => entry.id === pinned);
    if (listed) return listed;
    const kind = params.get(SPLASH_KIND_QUERY_PARAM)?.trim().toLowerCase() === 'gas-giant' ? 'gas-giant' : 'terran';
    return { id: pinned, kind };
  }
  if (rotation.length === 0) return { id: SPLASH_PLANET_BODY_ID, kind: 'terran' };

  const index = Math.min(rotation.length - 1, Math.floor(random() * rotation.length));
  return rotation[index];
}

export function selectSplashPlanetBodyId(
  search: string,
  random: () => number = Math.random,
  rotation: readonly SplashPlanetEntry[] = SPLASH_PLANET_ROTATION,
): string {
  return selectSplashPlanet(search, random, rotation).id;
}
