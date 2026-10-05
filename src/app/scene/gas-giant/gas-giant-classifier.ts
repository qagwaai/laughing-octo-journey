/**
 * Decides whether a body renders as a gas giant.
 *
 * The OpenAPI contract has no planet-class field, so the client infers giants
 * from catalogued size. Anything larger than a generous super-Earth threshold
 * is treated as a gas or ice giant. A dev override can force every planet to
 * one kind so the renderer can be previewed against any fixture.
 */

/** Neptune is ~24,600 km and the largest plausible rocky worlds sit well below 15,000 km. */
export const GAS_GIANT_MIN_RADIUS_KM = 15_000;

export type GasGiantClassificationMode = 'auto' | 'all' | 'none';

export const GAS_GIANT_QUERY_PARAM = 'gasGiants';

export interface GasGiantClassifiableBody {
  id: string;
  bodyType?: string;
  surfaceArchetype?: string | null;
  physicalCatalog?: { radiusKm?: number | null; estimatedDiameterM?: number | null } | null;
}

function positive(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

export function resolveCatalogRadiusKm(body: GasGiantClassifiableBody | null | undefined): number | null {
  const radiusKm = positive(body?.physicalCatalog?.radiusKm);
  if (radiusKm !== null) return radiusKm;
  const diameterM = positive(body?.physicalCatalog?.estimatedDiameterM);
  return diameterM === null ? null : diameterM / 2000;
}

/** Only planets can be giants; moons, stars and stations never are. */
export function isGasGiantBody(
  body: GasGiantClassifiableBody | null | undefined,
  mode: GasGiantClassificationMode = 'auto',
): boolean {
  void mode;
  return (
    body?.bodyType?.trim().toLowerCase() === 'planet' &&
    (body.surfaceArchetype === 'gas-giant' || body.surfaceArchetype === 'ice-giant')
  );
}

export function parseGasGiantClassificationMode(search: string): GasGiantClassificationMode {
  const value = new URLSearchParams(search).get(GAS_GIANT_QUERY_PARAM)?.trim().toLowerCase();
  return value === 'all' || value === 'none' ? value : 'auto';
}
