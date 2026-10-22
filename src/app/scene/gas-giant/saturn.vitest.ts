import { Mesh, Vector3 } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { deriveGasGiantProfile } from '../../model/planet/gas-giant-profile';
import { SATURN_EQUATORIAL_RADIUS_KM, SATURN_POLAR_RADIUS_KM } from '../../model/planet/saturn-profile';
import { resolveSplashAppearance, selectSplashPlanet, SPLASH_PLANET_ROTATION } from '../planet/splash-planet-rotation';
import { createGasGiant } from './gas-giant';
import { rasterizeGasGiantBands, saturnPolarWeight } from './gas-giant-bands';
import { computeRingDensity, createGasGiantRingTexture } from './gas-giant-rings';
import { createSplashGasGiant } from './splash-gas-giant';

describe('canonical sol-saturn', () => {
  const profile = deriveGasGiantProfile('sol-saturn');

  it('uses a canonical profile immune to generic controls and applies only to the exact ID', () => {
    expect(profile.canonical).toBe('saturn');
    expect(profile.palette).toBe('saturnian');
    expect((profile.axialTilt * 180) / Math.PI).toBeCloseTo(26.73, 8);
    expect(profile.polarRadiusRatio).toBeCloseTo(SATURN_POLAR_RADIUS_KM / SATURN_EQUATORIAL_RADIUS_KM, 10);
    expect(profile.anticyclone).toBeNull();
    expect(profile.ovals).toEqual([]);
    expect(profile.swirls).toEqual([]);
    expect(deriveGasGiantProfile('sol-saturn', { palette: 'ice', rings: false, surfaceArchetype: 'ice-giant' })).toBe(
      profile,
    );
    for (const id of ['saturn', 'SOL-SATURN', 'sol-saturn-moon', 'nova-splash-giant-05']) {
      expect(deriveGasGiantProfile(id).canonical).toBeUndefined();
      expect(deriveGasGiantProfile(id, { rings: false }).rings).toBeNull();
    }
  });

  it('resolves measured ring boundaries, contrasting optical depth, and fine gaps', () => {
    const ring = profile.rings!;
    expect(ring.innerRadius * SATURN_EQUATORIAL_RADIUS_KM).toBeCloseTo(66_900, 6);
    expect(ring.outerRadius * SATURN_EQUATORIAL_RADIUS_KM).toBeCloseTo(140_612, 6);
    const density = computeRingDensity(ring);
    expect(density).toHaveLength(8192);
    const atKm = (km: number) => density[Math.floor(((km - 66_900) / (140_612 - 66_900)) * density.length)];
    expect(atKm(100_000)).toBeGreaterThan(0.7);
    expect(atKm(80_000)).toBeLessThan(0.25);
    expect(atKm(120_000)).toBeLessThan(0.1);
    expect(atKm(130_000)).toBeGreaterThan(0.35);
    expect(atKm(133_580)).toBeLessThan(0.01);
    expect(atKm(136_505)).toBeLessThan(0.01);
    expect(atKm(138_000)).toBeLessThan(0.001);
    const texture = createGasGiantRingTexture(ring);
    expect(texture.image.width).toBe(1024);
    expect(texture.image.height).toBe(8);
    expect(texture.image.data?.length).toBe(8192 * 4);
    texture.dispose();
  });

  it('has a seam-continuous, sixfold north-polar jet, not a southern hexagon', () => {
    const latitude = (78 * Math.PI) / 180;
    expect(saturnPolarWeight(latitude, 0)).toBeCloseTo(saturnPolarWeight(latitude, Math.PI / 3), 10);
    expect(saturnPolarWeight(latitude, -Math.PI)).toBeCloseTo(saturnPolarWeight(latitude, Math.PI), 10);
    expect(saturnPolarWeight(latitude, 0)).toBeGreaterThan(saturnPolarWeight(latitude, Math.PI / 6));
    expect(saturnPolarWeight(-latitude, 0)).toBe(0);
    const size = { width: 64, height: 32 };
    expect(rasterizeGasGiantBands(profile, size)).toEqual(rasterizeGasGiantBands(profile, size));
  });

  it('builds an oblate planet and aligned rings, and releases owned resources', () => {
    const giant = createGasGiant(profile, { radius: 2, textureSize: { width: 64, height: 32 } });
    expect(giant.planet.scale.y).toBeCloseTo(profile.polarRadiusRatio!, 10);
    expect(giant.planet.parent?.rotation.x).toBe(profile.axialTilt);
    expect(giant.rings?.parent).toBe(giant.planet.parent);
    expect(giant.rings?.rotation.x).toBe(-Math.PI / 2);
    const before = giant.planet.rotation.y;
    giant.advance(1 / 30);
    expect(giant.planet.rotation.y).toBeGreaterThan(before);
    giant.setLightDirection(new Vector3(1, 2, 3));
    const geometryDisposal = vi.spyOn(giant.planet.geometry, 'dispose');
    const ringDisposal = vi.spyOn(giant.rings!.geometry, 'dispose');
    giant.dispose();
    expect(geometryDisposal).toHaveBeenCalledOnce();
    expect(ringDisposal).toHaveBeenCalledOnce();
  });

  it('registers in Sol selection, random startup, and resolves the correct archetype', () => {
    const entry = selectSplashPlanet('?splashPlanet=sol-saturn&splashKind=star');
    expect(entry).toEqual({ id: 'sol-saturn', kind: 'sol', solKey: 'saturn' });
    expect(SPLASH_PLANET_ROTATION).toContainEqual(entry);
    expect(resolveSplashAppearance(entry)).toMatchObject({
      valid: true,
      input: { surfaceArchetype: 'gas-giant', renderer: 'gas-giant' },
    });
  });

  it.each(['low', 'standard'] as const)('frames the full ring system at splash %s quality', (quality) => {
    const giant = createSplashGasGiant({
      bodyId: 'sol-saturn',
      quality,
      palette: 'jovian',
      rings: 'off',
      stormActivity: 100,
    });
    expect(giant.group.userData['gasGiant']).toEqual({ bodyId: 'sol-saturn', palette: 'saturnian', rings: true });
    const rings = giant.rings as Mesh;
    rings.geometry.computeBoundingSphere();
    expect(rings.geometry.boundingSphere!.radius).toBeCloseTo(4, 5);
    giant.dispose();
  });
});
