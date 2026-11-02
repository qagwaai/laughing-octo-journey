/**
 * Presentation helpers for catalog metadata on Viewer bodies (D40): Forge lists
 * every estimated value in `approximateFields`; Nova marks those values with "≈".
 */
import type { ViewerBody } from '../../model/solar-system-get';

export const APPROXIMATE_PREFIX = '≈ ';

type MetadataBody = Pick<
  ViewerBody,
  'displayName' | 'catalogName' | 'approximateFields' | 'controversial' | 'circumbinary' | 'catalogSource' | 'rings'
>;

/**
 * True when `path` (for example `physical.meanRadiusKm`) or any of its parents
 * (`physical`) is listed as approximate.
 */
export function isApproximateField(body: Pick<ViewerBody, 'approximateFields'>, path: string): boolean {
  const fields = body.approximateFields;
  if (!fields?.length) return false;
  return fields.some((field) => field === path || path.startsWith(`${field}.`));
}

export function approximatePrefix(body: Pick<ViewerBody, 'approximateFields'>, path: string): string {
  return isApproximateField(body, path) ? APPROXIMATE_PREFIX : '';
}

/** The type is "likely" when Forge inferred the archetype rather than reading it from the catalog. */
export function isLikelyBodyType(body: Pick<ViewerBody, 'approximateFields'>): boolean {
  return isApproximateField(body, 'surfaceArchetype') || isApproximateField(body, 'planetType');
}

/** Catalog designation shown as a secondary label only when it adds information. */
export function secondaryCatalogName(body: Pick<MetadataBody, 'displayName' | 'catalogName'>): string | null {
  const name = body.catalogName?.trim();
  return name && name !== body.displayName?.trim() ? name : null;
}

/** Server rings are procedural estimates when flagged on the ring itself or listed in `approximateFields`. */
export function areRingsApproximate(body: Pick<ViewerBody, 'approximateFields' | 'rings'>): boolean {
  return Boolean(body.rings && (body.rings.approximate || isApproximateField(body, 'rings')));
}

export function hasCatalogMetadata(body: MetadataBody): boolean {
  return Boolean(
    body.catalogSource ||
      secondaryCatalogName(body) ||
      body.controversial ||
      body.circumbinary ||
      body.rings ||
      body.approximateFields?.length,
  );
}
