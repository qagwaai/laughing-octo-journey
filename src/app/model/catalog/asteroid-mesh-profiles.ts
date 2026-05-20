export type AsteroidMeshGeometryKind = 'dodecahedron' | 'icosahedron' | 'octahedron' | 'rock';

export interface AsteroidMeshProfile {
  meshProfileKey: string;
  geometry: Exclude<AsteroidMeshGeometryKind, 'rock'>;
  detail: number;
  revealGeometry: 'rock';
  revealDetail: number;
  scale: [number, number, number];
}

function clampDetail(value: number): number {
  return Math.max(0, Math.min(2, Math.floor(value)));
}

function encodeScale(scale: [number, number, number]): string {
  return scale.map((value) => value.toFixed(2)).join(',');
}

function parseScale(rawValue: string | undefined): [number, number, number] | null {
  if (!rawValue) {
    return null;
  }

  const parts = rawValue.split(',').map((value) => Number(value));
  if (parts.length !== 3 || parts.some((value) => !Number.isFinite(value) || value <= 0)) {
    return null;
  }

  return [Number(parts[0].toFixed(2)), Number(parts[1].toFixed(2)), Number(parts[2].toFixed(2))];
}

function resolvePreviewGeometry(random: () => number): Exclude<AsteroidMeshGeometryKind, 'rock'> {
  const pool: Exclude<AsteroidMeshGeometryKind, 'rock'>[] = ['dodecahedron', 'icosahedron', 'octahedron'];
  return pool[Math.floor(random() * pool.length)] ?? 'dodecahedron';
}

function buildProfileKey(profile: Omit<AsteroidMeshProfile, 'meshProfileKey'>): string {
  return [
    'v1',
    `pv=${profile.geometry}:${profile.detail}`,
    `rv=${profile.revealGeometry}:${profile.revealDetail}`,
    `s=${encodeScale(profile.scale)}`,
  ].join('|');
}

export function generateRandomAsteroidMeshProfile(random: () => number = Math.random): AsteroidMeshProfile {
  const geometry = resolvePreviewGeometry(random);
  const detail = geometry === 'octahedron' ? 0 : clampDetail(random() > 0.65 ? 1 : 0);
  const revealGeometry: 'rock' = 'rock';
  const revealDetail = 2;

  const scaleX = 0.86 + random() * 0.42;
  const scaleY = 0.78 + random() * 0.58;
  const scaleZ = 0.84 + random() * 0.44;

  const profile = {
    geometry,
    detail,
    revealGeometry,
    revealDetail,
    scale: [Number(scaleX.toFixed(2)), Number(scaleY.toFixed(2)), Number(scaleZ.toFixed(2))] as [number, number, number],
  };

  return {
    ...profile,
    meshProfileKey: buildProfileKey(profile),
  };
}

export function parseAsteroidMeshProfileKey(key: string | null | undefined): AsteroidMeshProfile | null {
  const trimmed = key?.trim() ?? '';
  if (!trimmed) {
    return null;
  }

  const segments = trimmed.split('|');
  if (segments[0] !== 'v1') {
    return null;
  }

  const previewSegment = segments.find((segment) => segment.startsWith('pv='));
  const revealSegment = segments.find((segment) => segment.startsWith('rv='));
  const scaleSegment = segments.find((segment) => segment.startsWith('s='));
  if (!previewSegment || !revealSegment || !scaleSegment) {
    return null;
  }

  const [previewGeometryRaw, previewDetailRaw] = previewSegment.slice(3).split(':');
  const [revealGeometryRaw, revealDetailRaw] = revealSegment.slice(3).split(':');
  const scale = parseScale(scaleSegment.slice(2));
  if (!scale) {
    return null;
  }

  if (previewGeometryRaw !== 'dodecahedron' && previewGeometryRaw !== 'icosahedron' && previewGeometryRaw !== 'octahedron') {
    return null;
  }

  if (revealGeometryRaw !== 'dodecahedron' && revealGeometryRaw !== 'icosahedron' && revealGeometryRaw !== 'octahedron' && revealGeometryRaw !== 'rock') {
    return null;
  }

  const detail = clampDetail(Number(previewDetailRaw));
  const revealDetail = clampDetail(Number(revealDetailRaw));

  return {
    meshProfileKey: trimmed,
    geometry: previewGeometryRaw,
    detail,
    revealGeometry: 'rock',
    revealDetail: Math.max(2, revealDetail),
    scale,
  };
}

export function resolveAsteroidMeshProfile(
  meshProfileKey: string | null | undefined,
  fallback: AsteroidMeshProfile,
): AsteroidMeshProfile {
  return parseAsteroidMeshProfileKey(meshProfileKey) ?? fallback;
}