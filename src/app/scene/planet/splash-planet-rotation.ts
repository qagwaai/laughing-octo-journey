/**
 * Which procedural planet the splash shows.
 *
 * Each visit picks one entry from `SPLASH_PLANET_ROTATION`; the generator
 * derives the whole surface from that id, so editing the list is all it takes
 * to add, drop or reorder splash planets. Entries are not curated for looks.
 *
 * `?splashPlanet=<id>` pins the planet for screenshots, e2e tests and previews.
 * Any id is accepted, so unlisted seeds can be previewed before adding them.
 * ?splashKind=gas-giant|star|icy-moon|rocky-moon picks the kind for an unlisted id, and
 * ?splashSpectralClass=<class> sets an unlisted star's class.
 *
 * Sol bodies (`sol-earth`, `sol-mars`, ...) render approved catalog imagery and
 * are part of the rotation. The overlay can also swap the body at runtime; that
 * choice lasts for the session only.
 */
import { resolveCelestialAppearance } from '../../model/celestial-appearance';
import type { SurfaceArchetype } from '../../model/celestial-classification';
import { fnv1a32 } from '../../model/planet/planet-seed';
import { STELLAR_CLASS_LETTERS } from '../../model/star/spectral-class';

/** The original fixed splash planet; also the pinned default for tests. */
export const SPLASH_PLANET_BODY_ID = 'nova-splash-homeworld';

export const SPLASH_PLANET_QUERY_PARAM = 'splashPlanet';
export const SPLASH_KIND_QUERY_PARAM = 'splashKind';
export const SPLASH_SPECTRAL_CLASS_QUERY_PARAM = 'splashSpectralClass';

export type SplashPlanetKind = 'terran' | 'icy-moon' | 'rocky-moon' | 'gas-giant' | 'star' | 'sol';

/** Sol bodies with approved catalog imagery (surface maps or dedicated atmosphere shells). */
export const SPLASH_SOL_KEYS = ['earth', 'luna', 'mars', 'io', 'venus', 'titan', 'saturn'] as const;
export type SplashSolKey = (typeof SPLASH_SOL_KEYS)[number];

/** Sol bodies with a terran-style cloud shell; Earth's catalog albedo is cloud-free. */
export function solBodyHasClouds(key: SplashSolKey | undefined): boolean {
  return key === 'earth';
}

export interface SplashPlanetEntry {
  id: string;
  kind: SplashPlanetKind;
  /** Stars only; the generator reads the class from here. */
  spectralClass?: string;
  /** Sol bodies only; selects the catalog imagery. */
  solKey?: SplashSolKey;
}

export function resolveSplashAppearance(entry: SplashPlanetEntry) {
  const isMoon = entry.kind === 'icy-moon' || entry.kind === 'rocky-moon';
  const bodyType = entry.kind === 'star' ? 'star' : isMoon ? 'moon' : 'planet';
  const surfaceArchetype: SurfaceArchetype =
    entry.kind === 'star'
      ? 'star'
      : entry.kind === 'gas-giant' || entry.id === 'sol-saturn'
        ? 'gas-giant'
        : entry.kind === 'icy-moon' || entry.kind === 'rocky-moon'
          ? entry.kind
          : 'rocky';
  return resolveCelestialAppearance({
    source: 'demo',
    bodyId: entry.id,
    bodyType,
    surfaceArchetype,
  });
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

export function splashSolId(key: SplashSolKey): string {
  return `sol-${key}`;
}

export const SPLASH_PLANET_ROTATION: readonly SplashPlanetEntry[] = [
  ...TERRAN_IDS.map((id) => ({ id, kind: 'terran' as const })),
  ...GAS_GIANT_IDS.map((id) => ({ id, kind: 'gas-giant' as const })),
  ...SPLASH_STAR_CLASSES.map((spectralClass) => ({
    id: splashStarId(spectralClass),
    kind: 'star' as const,
    spectralClass,
  })),
  ...SPLASH_SOL_KEYS.map((solKey) => ({ id: splashSolId(solKey), kind: 'sol' as const, solKey })),
];

/** Opt-in demos do not change the existing random startup pool. */
export const SPLASH_ICY_MOONS: readonly SplashPlanetEntry[] = Array.from({ length: 6 }, (_, index) => ({
  id: `nova-splash-icy-moon-${String(index + 1).padStart(2, '0')}`,
  kind: 'icy-moon',
}));
export const SPLASH_ROCKY_MOONS: readonly SplashPlanetEntry[] = Array.from({ length: 6 }, (_, index) => ({
  id: `nova-splash-rocky-moon-${String(index + 1).padStart(2, '0')}`,
  kind: 'rocky-moon',
}));
export const SPLASH_SELECTABLE_BODIES: readonly SplashPlanetEntry[] = [
  ...SPLASH_PLANET_ROTATION,
  ...SPLASH_ICY_MOONS,
  ...SPLASH_ROCKY_MOONS,
];

/** 'random' retains the original rotation; procedural moons are explicitly selectable. */
export const SPLASH_PICKER_CATEGORIES = [
  'random',
  'terran',
  'icy-moon',
  'rocky-moon',
  'gas-giant',
  'star',
  'sol',
] as const;
export type SplashPickerCategory = (typeof SPLASH_PICKER_CATEGORIES)[number];

export function isSplashPickerCategory(value: string): value is SplashPickerCategory {
  return (SPLASH_PICKER_CATEGORIES as readonly string[]).includes(value);
}

export function splashEntriesForCategory(
  category: SplashPickerCategory,
  rotation: readonly SplashPlanetEntry[] = SPLASH_PLANET_ROTATION,
): readonly SplashPlanetEntry[] {
  if (category === 'icy-moon' && rotation === SPLASH_PLANET_ROTATION) return SPLASH_ICY_MOONS;
  if (category === 'rocky-moon' && rotation === SPLASH_PLANET_ROTATION) return SPLASH_ROCKY_MOONS;
  return category === 'random' ? rotation : rotation.filter((entry) => entry.kind === category);
}

/**
 * Picks a random entry from a category, avoiding `currentId` when there is an
 * alternative so a manual re-roll always visibly changes the body.
 */
export function pickRandomSplashPlanet(
  category: SplashPickerCategory,
  currentId: string | null = null,
  random: () => number = Math.random,
  rotation: readonly SplashPlanetEntry[] = SPLASH_PLANET_ROTATION,
): SplashPlanetEntry | null {
  const entries = splashEntriesForCategory(category, rotation);
  const pool = entries.length > 1 ? entries.filter((entry) => entry.id !== currentId) : entries;
  if (pool.length === 0) return null;
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
}

function readPinnedKind(params: URLSearchParams): SplashPlanetKind {
  const kind = params.get(SPLASH_KIND_QUERY_PARAM)?.trim().toLowerCase();
  return kind === 'gas-giant' || kind === 'star' || kind === 'icy-moon' || kind === 'rocky-moon' ? kind : 'terran';
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
    const listed =
      rotation.find((entry) => entry.id === pinned) ??
      SPLASH_ICY_MOONS.find((entry) => entry.id === pinned) ??
      SPLASH_ROCKY_MOONS.find((entry) => entry.id === pinned);
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
