/**
 * Which procedural planet the mining splash shows.
 *
 * Each visit picks one body id from `SPLASH_PLANET_ROTATION`; the generator
 * derives the whole surface from that id, so editing the list is all it takes
 * to add, drop or reorder splash planets. Entries are not curated for looks.
 *
 * `?splashPlanet=<id>` pins the planet for screenshots, e2e tests and previews.
 * Any id is accepted, so unlisted seeds can be previewed before adding them.
 */

/** The original fixed splash planet; also the pinned default for tests. */
export const SPLASH_PLANET_BODY_ID = 'nova-splash-homeworld';

export const SPLASH_PLANET_QUERY_PARAM = 'splashPlanet';

const MAX_PINNED_ID_LENGTH = 64;

export const SPLASH_PLANET_ROTATION: readonly string[] = [
  SPLASH_PLANET_BODY_ID,
  'nova-splash-world-02',
  'nova-splash-world-03',
  'nova-splash-world-04',
  'nova-splash-world-05',
  'nova-splash-world-06',
  'nova-splash-world-07',
  'nova-splash-world-08',
  'nova-splash-world-09',
  'nova-splash-world-10',
  'nova-splash-world-11',
  'nova-splash-world-12',
  'nova-splash-world-13',
  'nova-splash-world-14',
  'nova-splash-world-15',
  'nova-splash-world-16',
  'nova-splash-world-17',
  'nova-splash-world-18',
  'nova-splash-world-19',
  'nova-splash-world-20',
  'nova-splash-world-21',
  'nova-splash-world-22',
  'nova-splash-world-23',
  'nova-splash-world-24',
  'nova-splash-world-25',
];

function readPinnedBodyId(search: string): string | null {
  const pinned = new URLSearchParams(search).get(SPLASH_PLANET_QUERY_PARAM)?.trim();
  return pinned && pinned.length <= MAX_PINNED_ID_LENGTH ? pinned : null;
}

export function selectSplashPlanetBodyId(
  search: string,
  random: () => number = Math.random,
  rotation: readonly string[] = SPLASH_PLANET_ROTATION,
): string {
  const pinned = readPinnedBodyId(search);
  if (pinned) return pinned;
  if (rotation.length === 0) return SPLASH_PLANET_BODY_ID;

  const index = Math.min(rotation.length - 1, Math.floor(random() * rotation.length));
  return rotation[index];
}
