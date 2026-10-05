import type { PhysicalState } from './spatial';

export interface PhysicalCatalogValues {
  meanRadiusKm?: number | null;
  equatorialRadiusKm?: number | null;
  radiusKm?: number | null;
  estimatedDiameterM?: number | null;
  estimatedMassKg?: number | null;
  massKg?: number | null;
}

function positiveFinite(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

export function resolveCatalogRadiusKm(
  catalog: PhysicalCatalogValues | null | undefined,
  physical?: Pick<PhysicalState, 'estimatedDiameterM'> | null,
): number | null {
  const candidates = [
    catalog?.meanRadiusKm,
    catalog?.equatorialRadiusKm,
    catalog?.radiusKm,
    catalog?.estimatedDiameterM === null || catalog?.estimatedDiameterM === undefined
      ? null
      : catalog.estimatedDiameterM / 2000,
    physical?.estimatedDiameterM === null || physical?.estimatedDiameterM === undefined
      ? null
      : physical.estimatedDiameterM / 2000,
  ];
  return candidates.map(positiveFinite).find((value) => value !== null) ?? null;
}

export function resolveCatalogMassKg(
  catalog: PhysicalCatalogValues | null | undefined,
  physical?: Pick<PhysicalState, 'estimatedMassKg'> | null,
): number | null {
  return (
    [
      catalog?.massKg,
      catalog?.estimatedMassKg,
      physical?.estimatedMassKg,
    ]
      .map(positiveFinite)
      .find((value) => value !== null) ?? null
  );
}
