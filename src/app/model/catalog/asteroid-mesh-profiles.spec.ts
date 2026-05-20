import {
  generateRandomAsteroidMeshProfile,
  parseAsteroidMeshProfileKey,
  resolveAsteroidMeshProfile,
} from './asteroid-mesh-profiles';

describe('asteroid mesh profile helpers', () => {
  it('round-trips a generated mesh profile key', () => {
    const fixed = [0.11, 0.72, 0.34, 0.91, 0.25, 0.63, 0.48];
    let cursor = 0;

    const profile = generateRandomAsteroidMeshProfile(() => {
      const value = fixed[cursor] ?? 0.5;
      cursor += 1;
      return value;
    });

    const parsed = parseAsteroidMeshProfileKey(profile.meshProfileKey);

    expect(parsed).toEqual(profile);
  });

  it('returns null for malformed keys', () => {
    expect(parseAsteroidMeshProfileKey('')).toBeNull();
    expect(parseAsteroidMeshProfileKey('v2|pv=foo|rv=bar|s=1,1,1')).toBeNull();
    expect(parseAsteroidMeshProfileKey('v1|pv=dodecahedron:1|rv=rock:2|s=bad')).toBeNull();
  });

  it('normalizes the reveal family to rock when parsing a key', () => {
    const parsed = parseAsteroidMeshProfileKey('v1|pv=icosahedron:1|rv=dodecahedron:2|s=1.00,1.10,0.95');

    expect(parsed).toEqual({
      meshProfileKey: 'v1|pv=icosahedron:1|rv=dodecahedron:2|s=1.00,1.10,0.95',
      geometry: 'icosahedron',
      detail: 1,
      revealGeometry: 'rock',
      revealDetail: 2,
      scale: [1, 1.1, 0.95],
    });
  });

  it('falls back to the supplied local profile when no key is present', () => {
    const fallback = generateRandomAsteroidMeshProfile(() => 0.6);

    expect(resolveAsteroidMeshProfile(null, fallback)).toEqual(fallback);
  });
});