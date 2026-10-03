/**
 * Which procedural planet the mining splash shows.
 *
 * Each visit picks one entry from `SPLASH_PLANET_ROTATION`; the generator
 * derives the whole surface from that id, so editing the list is all it takes
 * to add, drop or reorder splash planets. Entries are not curated for looks.
 *
 * `?splashPlanet=<id>` pins the planet for screenshots, e2e tests and previews.
 * Any id is accepted, so unlisted seeds can be previewed before adding them.
 * ?splashKind=gas-giant|star picks the kind for an unlisted id, and
 * ?splashSpectralClass=<class> sets an unlisted star's class.
 */
import { fnv1a32 } from '../../model/planet/planet-seed';
import { STELLAR_CLASS_LETTERS } from '../../model/star/spectral-class';

/** The original fixed splash planet; also the pinned default for tests. */
export const SPLASH_PLANET_BODY_ID = 'nova-splash-homeworld';

export const SPLASH_PLANET_QUERY_PARAM = 'splashPlanet';
export const SPLASH_KIND_QUERY_PARAM = 'splashKind';
export const SPLASH_SPECTRAL_CLASS_QUERY_PARAM = 'splashSpectralClass';

export type SplashPlanetKind = 'terran' | 'gas-giant' | 'star';

export interface SplashPlanetEntry {
  id: string;
  kind: SplashPlanetKind;
  /** Stars only; the generator reads the class from here. */
  spectralClass?: string;
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

/** One star per spectral class, at a representative subtype and luminosity. */
export const SPLASH_STAR_CLASSES = [
  'O6V',
  'B2III',
  'A1V',
  'F5IV',
  'G2V',
  'K1III',
  'M4V',
  'L3',
  'T6',
  'Y1',
  'DA2',
  'WC8',
  'C-N5',
  'S4/2',
] as const;

export function splashStarId(spectralClass: string): string {
  return `nova-splash-star-${spectralClass.charAt(0).toLowerCase()}`;
}

export const SPLASH_PLANET_ROTATION: readonly SplashPlanetEntry[] = [
  ...TERRAN_IDS.map((id) => ({ id, kind: 'terran' as const })),
  ...GAS_GIANT_IDS.map((id) => ({ id, kind: 'gas-giant' as const })),
  ...SPLASH_STAR_CLASSES.map((spectralClass) => ({
    id: splashStarId(spectralClass),
    kind: 'star' as const,
    spectralClass,
  })),
];

function readPinnedKind(params: URLSearchParams): SplashPlanetKind {
  const kind = params.get(SPLASH_KIND_QUERY_PARAM)?.trim().toLowerCase();
  return kind === 'gas-giant' || kind === 'star' ? kind : 'terran';
}

/** An unlisted star uses ?splashSpectralClass, or a class seeded from its id. */
function readPinnedSpectralClass(params: URLSearchParams, id: string): string {
  const requested = params.get(SPLASH_SPECTRAL_CLASS_QUERY_PARAM)?.trim();
  if (requested && requested.length <= 16) return requested;
  return STELLAR_CLASS_LETTERS[fnv1a32(`star-class|${id}`) % STELLAR_CLASS_LETTERS.length];
}

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
    const kind = readPinnedKind(params);
    if (kind === 'star') return { id: pinned, kind, spectralClass: readPinnedSpectralClass(params, pinned) };
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
