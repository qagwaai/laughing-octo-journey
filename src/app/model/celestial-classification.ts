export const SURFACE_ARCHETYPES = [
  'rocky',
  'lava',
  'ocean',
  'gas-giant',
  'ice-giant',
  'super-earth',
  'sub-neptune',
  'hot-neptune',
  'hot-jupiter',
  'super-jupiter',
  'star',
  'rocky-moon',
  'icy-moon',
  'asteroid',
  'black-hole',
] as const;

export type SurfaceArchetype = (typeof SURFACE_ARCHETYPES)[number];

export const CELESTIAL_BODY_TYPES = [
  'star',
  'planet',
  'dwarf-planet',
  'moon',
  'asteroid',
  'tno',
  'comet',
  'black-hole',
] as const;

export type CanonicalBodyType = (typeof CELESTIAL_BODY_TYPES)[number];

const COMPATIBLE_ARCHETYPES: Readonly<Record<CanonicalBodyType, readonly SurfaceArchetype[]>> = {
  star: ['star'],
  planet: [
    'rocky',
    'lava',
    'ocean',
    'gas-giant',
    'ice-giant',
    'super-earth',
    'sub-neptune',
    'hot-neptune',
    'hot-jupiter',
    'super-jupiter',
  ],
  'dwarf-planet': ['rocky', 'icy-moon'],
  moon: ['rocky-moon', 'icy-moon', 'lava'],
  asteroid: ['asteroid'],
  'black-hole': ['black-hole'],
  tno: ['icy-moon'],
  comet: ['asteroid'],
};

export function isSurfaceArchetype(value: unknown): value is SurfaceArchetype {
  return typeof value === 'string' && SURFACE_ARCHETYPES.includes(value as SurfaceArchetype);
}

export function isCanonicalBodyType(value: unknown): value is CanonicalBodyType {
  return typeof value === 'string' && CELESTIAL_BODY_TYPES.includes(value as CanonicalBodyType);
}

export function isCompatibleBodyClassification(bodyType: unknown, surfaceArchetype: unknown): boolean {
  return (
    isCanonicalBodyType(bodyType) &&
    isSurfaceArchetype(surfaceArchetype) &&
    COMPATIBLE_ARCHETYPES[bodyType].includes(surfaceArchetype)
  );
}

export function validateCanonicalBodyClassification(body: unknown): string | null {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return 'celestial body must be an object';
  }
  const record = body as Record<string, unknown>;
  if (typeof record['id'] !== 'string' || record['id'].trim().length === 0) {
    return 'celestial body id is required';
  }
  if (
    record['bodyType'] === 'station' ||
    record['bodyType'] === 'debris' ||
    record['bodyType'] === 'gate' ||
    record['bodyType'] === 'jump-gate' ||
    record['bodyType'] === 'jumpgate'
  ) {
    return null;
  }
  if (!isCanonicalBodyType(record['bodyType'])) {
    return `unknown or missing bodyType for ${record['id']}`;
  }
  if (!isSurfaceArchetype(record['surfaceArchetype'])) {
    return `unknown or missing surfaceArchetype for ${record['id']}`;
  }
  if (!isCompatibleBodyClassification(record['bodyType'], record['surfaceArchetype'])) {
    return `incompatible bodyType/surfaceArchetype for ${record['id']}: ${record['bodyType']}/${record['surfaceArchetype']}`;
  }
  if (record['state'] !== 'unscanned' && record['state'] !== 'active' && record['state'] !== 'destroyed') {
    return `unknown or missing state for ${record['id']}`;
  }
  const spatial = record['spatial'];
  if (spatial === null || typeof spatial !== 'object' || Array.isArray(spatial)) {
    return `missing spatial snapshot for ${record['id']}`;
  }
  const position = (spatial as Record<string, unknown>)['positionKm'];
  if (position === null || typeof position !== 'object' || Array.isArray(position)) {
    return `missing spatial.positionKm for ${record['id']}`;
  }
  const point = position as Record<string, unknown>;
  if (!['x', 'y', 'z'].every((axis) => typeof point[axis] === 'number' && Number.isFinite(point[axis]))) {
    return `invalid spatial.positionKm for ${record['id']}`;
  }
  const orbital = record['orbitalElements'];
  if (orbital !== undefined && orbital !== null) {
    if (typeof orbital !== 'object' || Array.isArray(orbital)) {
      return `invalid orbitalElements for ${record['id']}`;
    }
    const elements = orbital as Record<string, unknown>;
    if (
      ![
        'semiMajorAxisKm',
        'eccentricity',
        'inclinationDeg',
        'longitudeOfAscendingNodeDeg',
        'argumentOfPeriapsisDeg',
        'meanAnomalyAtEpochDeg',
        'orbitalPeriodSec',
      ].every((key) => typeof elements[key] === 'number' && Number.isFinite(elements[key])) ||
      typeof elements['epoch'] !== 'string' ||
      (elements['anchorBodyId'] !== undefined &&
        elements['anchorBodyId'] !== null &&
        typeof elements['anchorBodyId'] !== 'string')
    ) {
      return `incomplete or invalid orbitalElements for ${record['id']}`;
    }
  }
  if (record['state'] === 'active' || record['state'] === 'destroyed') {
    const composition = record['composition'];
    if (composition === null || typeof composition !== 'object' || Array.isArray(composition)) {
      return `missing required composition for ${record['id']} in ${record['state']} state`;
    }
    const profile = composition as Record<string, unknown>;
    if (
      typeof profile['material'] !== 'string' ||
      !profile['material'].trim() ||
      typeof profile['textureColor'] !== 'string' ||
      !profile['textureColor'].trim() ||
      !['Common', 'Uncommon', 'Rare', 'Exotic'].includes(String(profile['rarity']))
    ) {
      return `invalid composition for ${record['id']}`;
    }
  }
  for (const field of ['spectralClass', 'luminositySolar']) {
    if (!(field in record) || record[field] === undefined || record[field] === null) continue;
    if (field === 'spectralClass' && typeof record[field] !== 'string') {
      return `invalid spectralClass for ${record['id']}`;
    }
    if (
      field === 'luminositySolar' &&
      (typeof record[field] !== 'number' || !Number.isFinite(record[field]) || record[field] < 0)
    ) {
      return `invalid luminositySolar for ${record['id']}`;
    }
  }
  return null;
}

export function validateCanonicalBodyCollection(bodies: readonly unknown[]): string | null {
  const seen = new Map<string, Record<string, unknown>>();
  for (const body of bodies) {
    const invalid = validateCanonicalBodyClassification(body);
    if (invalid) return invalid;
    const conflict = recordCanonicalBody(seen, body as Record<string, unknown>);
    if (conflict) return conflict;
  }
  return null;
}

export interface CanonicalBodyRejection {
  id: string | null;
  reason: string;
}

export interface CanonicalBodyRecovery<T> {
  /** Valid bodies plus neutral placeholders (flagged `placeholder: true`) for invalid ones. */
  bodies: T[];
  rejected: CanonicalBodyRejection[];
  /** Conflicting duplicate IDs remain fatal: the data source is inconsistent. */
  conflict: string | null;
}

export const PLACEHOLDER_BODY_COLOR = '#8a8f98';

/**
 * Per-body variant of {@link validateCanonicalBodyCollection}: a single unknown or
 * invalid body no longer fails the whole system. Bodies with a usable id and
 * position are kept as neutral placeholders; the rest are dropped.
 */
export function recoverCanonicalBodyCollection<T extends { id: string }>(
  bodies: readonly unknown[],
): CanonicalBodyRecovery<T> {
  const seen = new Map<string, Record<string, unknown>>();
  const result: T[] = [];
  const rejected: CanonicalBodyRejection[] = [];
  for (const body of bodies) {
    const invalid = validateCanonicalBodyClassification(body);
    if (!invalid) {
      const conflict = recordCanonicalBody(seen, body as Record<string, unknown>);
      if (conflict) return { bodies: [], rejected, conflict };
      result.push(body as T);
      continue;
    }
    const placeholder = toPlaceholderBody(body);
    rejected.push({ id: placeholder?.id ?? readBodyId(body), reason: invalid });
    if (placeholder && !result.some((existing) => existing.id === placeholder.id)) {
      result.push(placeholder as unknown as T);
    }
  }
  return { bodies: result, rejected, conflict: null };
}

function readBodyId(body: unknown): string | null {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return null;
  const id = (body as Record<string, unknown>)['id'];
  return typeof id === 'string' && id.trim().length > 0 ? id : null;
}

function toPlaceholderBody(body: unknown): (Record<string, unknown> & { id: string }) | null {
  const id = readBodyId(body);
  if (!id) return null;
  const record = body as Record<string, unknown>;
  const spatial = record['spatial'] as Record<string, unknown> | null | undefined;
  const point = spatial && typeof spatial === 'object' ? (spatial['positionKm'] as Record<string, unknown>) : null;
  if (
    !point ||
    typeof point !== 'object' ||
    !['x', 'y', 'z'].every((axis) => typeof point[axis] === 'number' && Number.isFinite(point[axis]))
  ) {
    return null;
  }
  const bodyType = typeof record['bodyType'] === 'string' && record['bodyType'] !== 'star' ? record['bodyType'] : 'planet';
  const displayName = typeof record['displayName'] === 'string' && record['displayName'] ? record['displayName'] : id;
  return {
    id,
    bodyType,
    displayName,
    parentBodyId: typeof record['parentBodyId'] === 'string' ? record['parentBodyId'] : null,
    spatial: { ...spatial, positionKm: { x: point['x'], y: point['y'], z: point['z'] } },
    physicalCatalog: record['physicalCatalog'] ?? null,
    physical: record['physical'] ?? null,
    surfaceArchetype: null,
    state: 'active',
    visualization: { colorHex: PLACEHOLDER_BODY_COLOR },
    placeholder: true,
  };
}

function recordCanonicalBody(seen: Map<string, Record<string, unknown>>, record: Record<string, unknown>): string | null {
  const id = record['id'] as string;
  const previous = seen.get(id);
  if (!previous) {
    seen.set(id, record);
    return null;
  }
  const position = (value: Record<string, unknown>) => {
    const spatial = value['spatial'] as Record<string, unknown> | undefined;
    const point = spatial?.['positionKm'] as Record<string, unknown> | undefined;
    return [point?.['x'], point?.['y'], point?.['z']];
  };
  if (
    previous['bodyType'] !== record['bodyType'] ||
    previous['surfaceArchetype'] !== record['surfaceArchetype'] ||
    (previous['spectralClass'] ?? null) !== (record['spectralClass'] ?? null) ||
    (previous['luminositySolar'] ?? null) !== (record['luminositySolar'] ?? null) ||
    JSON.stringify(position(previous)) !== JSON.stringify(position(record))
  ) {
    return `conflicting canonical records share body ID ${id}`;
  }
  return null;
}
