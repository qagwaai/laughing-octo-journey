/**
 * Single mapping from a server body to gas-giant profile overrides, shared by the
 * system scene, the planet view and the splash so every view of a body agrees.
 *
 * Server `rings` are authoritative: radii are measured from the planet centre in
 * km and converted to planet radii, and `tiltDeg` (equal to the axial tilt) drives
 * both the spin axis and the ring plane. Catalog exoplanets without `rings` have
 * none; curated/procedural giants keep their seeded rings.
 */
import {
  deriveGasGiantProfile,
  type GasGiantProfile,
  type GasGiantProfileOverrides,
  type GasGiantSurfaceArchetype,
  isGasGiantTypeVariant,
} from '../../model/planet/gas-giant-profile';
import { resolveCatalogRadiusKm } from '../../model/physical-catalog';
import type { ViewerBodyPhysicalCatalog, ViewerBodyRings } from '../../model/solar-system-get';
import type { PhysicalState } from '../../model/spatial';

export const EXOPLANET_CATALOG_SOURCE = 'exoplanet-catalog';

export interface GasGiantSourceBody {
  id: string;
  surfaceArchetype?: string | null;
  catalogSource?: string | null;
  rings?: ViewerBodyRings | null;
  physicalCatalog?: ViewerBodyPhysicalCatalog | null;
  physical?: PhysicalState | null;
}

export function isGasGiantSurfaceArchetype(value: unknown): value is GasGiantSurfaceArchetype {
  return value === 'gas-giant' || value === 'ice-giant' || isGasGiantTypeVariant(value);
}

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function parseHexColor(hex: string | null | undefined): readonly [number, number, number] | null {
  if (typeof hex !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(hex)) return null;
  const value = Number.parseInt(hex.slice(1), 16);
  return [((value >> 16) & 0xff) / 255, ((value >> 8) & 0xff) / 255, (value & 0xff) / 255];
}

/**
 * Builds overrides for a body. `devOverrides` (splash/planet-view dev controls)
 * apply first; body data from the server wins where it exists.
 */
export function resolveBodyGasGiantOverrides(
  body: GasGiantSourceBody,
  devOverrides: GasGiantProfileOverrides = {},
): GasGiantProfileOverrides {
  const surfaceArchetype = isGasGiantSurfaceArchetype(body.surfaceArchetype) ? body.surfaceArchetype : 'gas-giant';
  const overrides: GasGiantProfileOverrides = { ...devOverrides, surfaceArchetype };
  if (surfaceArchetype === 'ice-giant') overrides.palette = 'ice';

  const temperature = finite(body.physicalCatalog?.meanTemperatureK);
  if (temperature !== null) overrides.meanTemperatureK = temperature;

  const rings = body.rings;
  const planetRadiusKm = resolveCatalogRadiusKm(body.physicalCatalog, body.physical);
  const inner = finite(rings?.innerRadiusKm);
  const outer = finite(rings?.outerRadiusKm);
  const color = parseHexColor(rings?.colorHex);
  if (rings && planetRadiusKm && inner && outer && outer > inner && color) {
    overrides.rings = true;
    overrides.ringGeometry = {
      innerRadius: inner / planetRadiusKm,
      outerRadius: outer / planetRadiusKm,
      color,
      opacity: finite(rings.opacity) ?? 0.5,
    };
    const tilt = finite(rings.tiltDeg);
    if (tilt !== null) overrides.axialTiltDeg = tilt;
  } else if (body.catalogSource === EXOPLANET_CATALOG_SOURCE) {
    overrides.rings = false;
  }
  if (overrides.axialTiltDeg === undefined && body.catalogSource === EXOPLANET_CATALOG_SOURCE) {
    const tilt = finite(body.physicalCatalog?.axialTiltDeg);
    if (tilt !== null) overrides.axialTiltDeg = tilt;
  }
  return overrides;
}

export function deriveBodyGasGiantProfile(
  body: GasGiantSourceBody,
  devOverrides: GasGiantProfileOverrides = {},
): GasGiantProfile {
  return deriveGasGiantProfile(body.id, resolveBodyGasGiantOverrides(body, devOverrides));
}
