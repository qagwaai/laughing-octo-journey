/**
 * Star colour and light placement for the viewer scenes.
 *
 * Planet surfaces became physically based when the roughness/metalness map
 * landed, so the colour of the light hitting them now genuinely changes how a
 * world reads. Both viewer scenes previously lit every system with a single
 * untinted white point light pinned at the origin, which meant a red dwarf and
 * a blue giant produced identical planets and a binary companion contributed
 * no light at all.
 *
 * Star colour tints **lighting only, never the baked texture**. A bake is the
 * body's intrinsic albedo and is cached per body and shared across views, so
 * baking a star tint into it would poison that cache and be wrong the moment
 * the same body were seen under different light.
 */
import type { ViewerBody } from '../../model/solar-system-get';
import { resolveCelestialAppearance } from '../../model/celestial-appearance';
import { spectralClassLetter } from '../../model/star/spectral-class';
import { STAR_CLASS_TRAITS } from '../../model/star/star-class-traits';
import { deriveStarProfile, type StarProfile } from '../../model/star/star-profile';

/** Sol is a G-class star, so this keeps an unclassified body looking sunlike. */
export const DEFAULT_STAR_COLOR = '#fff4e8';

/**
 * How far the cast light keeps its true colour, where 1 is fully saturated.
 *
 * A physically accurate M-dwarf renders an Earth-like world muddy red and makes
 * the continents hard to read, which fights the legibility the viewer needs. The
 * star's own mesh and glow keep their full colour so it stays identifiable; only
 * the light it casts is pulled back toward neutral.
 */
export const STAR_TINT_STRENGTH = 0.55;

/** Fill light stands in for scattered light, so it is pulled further to neutral. */
export const STAR_FILL_TINT_STRENGTH = 0.3;

/**
 * Total point-light budget for each scene, split across a system's stars.
 *
 * These are calibrated for `decay = 0` lights. The scenes originally used the
 * physically correct inverse-square falloff, but a solar system compressed into
 * roughly thirty scene units puts every star far enough away that its light
 * arrived at about half a percent of nominal: the star contributed nothing and
 * the fills lit everything. Distance falloff is meaningless at this scale, so
 * the star lights radiate evenly from the star's position and keep only their
 * direction, which is the part that actually reads.
 */
export const VIEWER_SCENE_STAR_LIGHT_INTENSITY = 1.3;
export const PLANET_VIEW_STAR_LIGHT_INTENSITY = 1.5;

/**
 * Falloff for star lights, shared by both scenes.
 *
 * `0` distance means no cutoff and `0` decay means no inverse-square falloff.
 * Both are deliberate: see the intensity note above. These live here rather
 * than in the templates so the two scenes cannot drift apart.
 */
export const STAR_LIGHT_DISTANCE = 0;
export const STAR_LIGHT_DECAY = 0;

export interface StarLightSource {
  id: string;
  color: string;
  position: [number, number, number];
  intensity: number;
}

export interface StarLightInput {
  id: string;
  position: [number, number, number];
  body: ViewerBody;
}

function parseHex(hex: string): [number, number, number] | null {
  const value = hex.trim().replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return null;
  return [
    parseInt(value.substring(0, 2), 16),
    parseInt(value.substring(2, 4), 16),
    parseInt(value.substring(4, 6), 16),
  ];
}

function toHex(channels: readonly [number, number, number]): string {
  return `#${channels.map((c) => Math.round(Math.max(0, Math.min(255, c)))
    .toString(16)
    .padStart(2, '0')).join('')}`;
}

/** Blends a colour toward white; `strength` 1 keeps it, 0 makes it neutral. */
export function temperColor(hex: string, strength: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return '#ffffff';
  const amount = Math.max(0, Math.min(1, strength));
  return toHex([
    255 + (rgb[0] - 255) * amount,
    255 + (rgb[1] - 255) * amount,
    255 + (rgb[2] - 255) * amount,
  ]);
}

/**
 * Maps a spectral class such as `G2V`, `sdM3` or `DA2` to its representative colour.
 *
 * The contract exposes a precise B-V colour index, but only on the system-level
 * `primaryStarSummary`, not per body, so the scenes fall back to the class
 * every star body carries.
 */
export function spectralClassColor(spectralClass: string | null | undefined): string | null {
  const letter = spectralClassLetter(spectralClass);
  return letter ? STAR_CLASS_TRAITS[letter].representativeColor : null;
}

/** The spectral class a star body renders as: art direction first, then the catalogue class. */
export function resolveStarSpectralClass(body: ViewerBody): string | null {
  return body.spectralClass?.trim() || null;
}

/** Procedural star look for a viewer body, keeping any explicit art-directed colour. */
export function deriveViewerStarProfile(body: ViewerBody): StarProfile {
  const appearance = resolveCelestialAppearance({
    source: 'canonical',
    bodyId: body.id,
    bodyType: body.bodyType,
    surfaceArchetype: body.surfaceArchetype,
  });
  if (!appearance.valid || appearance.input.renderer !== 'star') {
    throw new Error(`Invalid stellar appearance contract for body ${body.id}: ${appearance.valid ? 'not a star renderer' : appearance.reason}`);
  }
  const explicit = body.visualization?.colorHex?.trim();
  return deriveStarProfile(body.id, resolveStarSpectralClass(body), {
    colorHex: explicit && parseHex(explicit) ? explicit : null,
    surfaceArchetype: 'star',
  });
}

/**
 * The star's true colour: explicit art direction wins, then its spectral class.
 *
 * This is the colour the star itself should appear, before any tempering.
 */
export function resolveStarColor(body: ViewerBody): string {
  const explicit = body.visualization?.colorHex?.trim();
  if (explicit && parseHex(explicit)) return explicit;

  return (
    spectralClassColor(body.spectralClass) ??
    DEFAULT_STAR_COLOR
  );
}

/** The colour a star casts onto planets, tempered so surfaces stay readable. */
export function resolveStarLightColor(body: ViewerBody, strength: number = STAR_TINT_STRENGTH): string {
  return temperColor(resolveStarColor(body), strength);
}

/**
 * Relative brightness weight for splitting a fixed intensity budget.
 *
 * Luminosity is the honest measure and the scenes already use it for star
 * radius. Square-rooting it keeps a very bright primary from reducing its
 * companion to nothing, which matters because the companion is the only thing
 * that makes a system read as binary.
 */
function luminosityWeight(body: ViewerBody): number {
  const luminosity = body.luminositySolar;
  if (typeof luminosity !== 'number' || !Number.isFinite(luminosity)) return 1;
  if (luminosity === 0) return 0;
  return Math.sqrt(luminosity);
}

/**
 * Places one light per star and splits a fixed intensity budget between them.
 *
 * The budget is fixed rather than per-star so that adding a companion
 * redistributes light instead of doubling it: a binary system should look
 * differently lit, not twice as bright.
 */
export function resolveStarLights(stars: readonly StarLightInput[], totalIntensity: number): StarLightSource[] {
  if (stars.length === 0) return [];

  const weights = stars.map((star) => luminosityWeight(star.body));
  const total = weights.reduce((sum, weight) => sum + weight, 0);

  return stars.map((star, index) => ({
    id: star.id,
    color: resolveStarLightColor(star.body),
    position: star.position,
    intensity: total > 0 ? (totalIntensity * weights[index]) / total : 0,
  }));
}

/**
 * A single fill colour representing starlight scattered around the system.
 *
 * Without this the scenes' hardcoded cool fills would wash the star tint out:
 * a red dwarf system still rendered blue-grey because the fills outweighed the
 * key light.
 */
export function resolveStarFillColor(
  stars: readonly StarLightInput[],
  strength: number = STAR_FILL_TINT_STRENGTH,
): string {
  if (stars.length === 0) return temperColor(DEFAULT_STAR_COLOR, strength);

  const weights = stars.map((star) => luminosityWeight(star.body));
  const total = weights.reduce((sum, weight) => sum + weight, 0);

  const blended = stars.reduce(
    (accumulator, star, index) => {
      const rgb = parseHex(resolveStarColor(star.body)) ?? [255, 255, 255];
      const share = total > 0 ? weights[index] / total : 1 / stars.length;
      return [
        accumulator[0] + rgb[0] * share,
        accumulator[1] + rgb[1] * share,
        accumulator[2] + rgb[2] * share,
      ] as [number, number, number];
    },
    [0, 0, 0] as [number, number, number],
  );

  return temperColor(toHex(blended), strength);
}
