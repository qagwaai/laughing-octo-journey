import { Group, Mesh, PlaneGeometry, Quaternion, ShaderMaterial } from 'three';
import { describe, expect, it, vi } from 'vitest';
import {
  ASTRONOMICAL_UNIT_KM,
  CYGNUS_X1,
  CYGNUS_X1_SCHWARZSCHILD_RADIUS_KM,
  SOLAR_RADIUS_KM,
} from '../../model/black-hole/cygnus-x1';
import { SCHWARZSCHILD_CRITICAL_IMPACT_RS, traceSchwarzschildRay } from '../../model/black-hole/schwarzschild';
import { createBlackHole } from './black-hole';
import { createSplashBlackHole } from './splash-black-hole';

describe('Schwarzschild reference', () => {
  it('captures below and escapes above the analytical photon critical impact parameter', () => {
    expect(SCHWARZSCHILD_CRITICAL_IMPACT_RS).toBeCloseTo(2.598076, 5);
    expect(traceSchwarzschildRay(SCHWARZSCHILD_CRITICAL_IMPACT_RS * 0.99).captured).toBe(true);
    expect(traceSchwarzschildRay(SCHWARZSCHILD_CRITICAL_IMPACT_RS * 1.01).escaped).toBe(true);
    expect(traceSchwarzschildRay(0).captured).toBe(true);
  });

  it('converges under step refinement and tends toward 2 Rs/b in the weak field', () => {
    const normal = traceSchwarzschildRay(15);
    const refined = traceSchwarzschildRay(15, 0.0225);
    expect(normal.escaped).toBe(true);
    expect(Math.abs(normal.deflectionRad - refined.deflectionRad)).toBeLessThan(0.002);
    expect(normal.deflectionRad).toBeGreaterThan(2 / 15);
    expect(normal.deflectionRad).toBeLessThan(0.17);
  });

  it.each([-1, NaN, Infinity])('rejects invalid impact %s explicitly', (impact) => {
    expect(() => traceSchwarzschildRay(impact)).toThrow();
  });
});

describe('Cygnus X-1 source and presentation separation', () => {
  it('retains the sourced binary separation and stellar radius, not HYG distance or demo scaling', () => {
    expect(CYGNUS_X1.separationAu * ASTRONOMICAL_UNIT_KM).toBeCloseTo(36_501_880.45, 0);
    expect(CYGNUS_X1.companionRadiusSolar * SOLAR_RADIUS_KM).toBe(15_514_110);
    expect(CYGNUS_X1_SCHWARZSCHILD_RADIUS_KM).toBeCloseTo(62.61, 2);
    expect(CYGNUS_X1.distanceParsec).toBe(2220);
  });
});

describe('Black-hole resource ownership', () => {
  it.each(['low', 'standard'] as const)('keeps %s wind optional, local, bounded and disposable', (quality) => {
    const hole = createSplashBlackHole(quality);
    const wind = hole.group.getObjectByName('cygnus-x1-stellar-wind');
    const companion = hole.group.getObjectByName('cygnus-x1-companion');
    if (
      !(wind instanceof Mesh) ||
      !(wind.geometry instanceof PlaneGeometry) ||
      !(wind.material instanceof ShaderMaterial) ||
      !companion
    )
      throw new Error('Companion wind resources missing.');
    expect(wind.visible).toBe(false);
    expect(wind.position.equals(companion.position)).toBe(true);
    expect(wind.geometry.parameters.width).toBe(2.2);
    expect(wind.material.defines['WISP_COUNT']).toBe(quality === 'low' ? 7 : 12);
    hole.setWindEnabled(true);
    expect(wind.visible).toBe(true);
    hole.advance(0);
    expect(wind.material.uniforms['uTime'].value).toBe(0);
    hole.advance(10);
    expect(wind.material.uniforms['uTime'].value).toBe(0.05);
    expect(() => hole.advance(-1)).toThrow();
    hole.setWindEnabled(false);
    expect(wind.visible).toBe(false);
    const geometryDispose = vi.spyOn(wind.geometry, 'dispose');
    const materialDispose = vi.spyOn(wind.material, 'dispose');
    hole.dispose();
    hole.dispose();
    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(materialDispose).toHaveBeenCalledOnce();
  });

  it.each(['low', 'standard'] as const)('bounds the %s ray pass and disposes all owned resources once', (quality) => {
    const hole = createSplashBlackHole(quality);
    expect(hole.target.width).toBe(quality === 'low' ? 320 : 640);
    expect(hole.group.userData['blackHole']).toMatchObject({ mode: 'cinematic', metric: 'Schwarzschild' });
    const slot = new Group();
    slot.add(hole.group);
    const display = hole.group.children[0];
    const photosphere = hole.group.getObjectByName('star-photosphere');
    if (!(photosphere instanceof Mesh) || !(photosphere.material instanceof ShaderMaterial))
      throw new Error('Companion photosphere missing.');
    expect(photosphere.material.transparent).toBe(true);
    expect(photosphere.material.depthTest).toBe(false);
    expect(photosphere.material.depthWrite).toBe(false);
    expect(photosphere.renderOrder).toBeGreaterThan(display.renderOrder);
    expect(display).toBeInstanceOf(Mesh);
    if (!(display instanceof Mesh)) throw new Error('Black-hole display mesh missing.');
    const targetDispose = vi.spyOn(hole.target, 'dispose');
    const geometryDispose = vi.spyOn(display.geometry, 'dispose');
    const materialDispose = vi.spyOn(display.material, 'dispose');
    hole.advance(0);
    expect(() => hole.advance(NaN)).toThrow();
    hole.dispose();
    hole.dispose();
    expect(slot.children).toHaveLength(0);
    expect(targetDispose).toHaveBeenCalledOnce();
    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(materialDispose).toHaveBeenCalledOnce();
  });

  it('rejects invalid render budgets', () => {
    expect(() => createBlackHole({ resolution: 0, traceSteps: 256, viewRotation: new Quaternion() })).toThrow();
    expect(() => createBlackHole({ resolution: 320, traceSteps: 0, viewRotation: new Quaternion() })).toThrow();
  });
});
