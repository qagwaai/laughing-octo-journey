import { Color, Mesh, PointLight, ShaderMaterial } from 'three';
import { describe, expect, it } from 'vitest';
import { STELLAR_CLASS_LETTERS } from '../../model/star/spectral-class';
import { deriveStarProfile } from '../../model/star/star-profile';
import { createSplashStar, SPLASH_STAR_RADIUS } from './splash-star';
import { createStar, STAR_TIME_WRAP_SECONDS } from './star';

describe('createStar', () => {
  it('names the group and exposes the class for scene inspection', () => {
    const star = createStar(deriveStarProfile('sol', 'G2V'));
    expect(star.group.name).toBe('star');
    expect(star.group.userData['star']).toEqual({
      bodyId: 'sol',
      letter: 'G',
      subtype: 2,
      luminosityClass: 'V',
      spectralClass: 'G2V',
    });
    expect(star.photosphere.material).toBeInstanceOf(ShaderMaterial);
    expect(star.corona.mesh.material).toBeInstanceOf(ShaderMaterial);
    star.dispose();
  });

  it('builds for every spectral class', () => {
    for (const letter of STELLAR_CLASS_LETTERS) {
      const star = createStar(deriveStarProfile(`star-${letter}`, letter));
      star.advance(0.016);
      expect(star.group.userData['star'].letter).toBe(letter);
      star.dispose();
    }
  });

  it('clamps large frame steps and wraps shader time', () => {
    const star = createStar(deriveStarProfile('sol', 'G2V'));
    const uniforms = star.photosphere.material.uniforms;
    star.advance(10);
    expect(uniforms['uTime'].value).toBeCloseTo(0.05);
    uniforms['uTime'].value = STAR_TIME_WRAP_SECONDS - 0.01;
    star.advance(0.05);
    expect(uniforms['uTime'].value).toBeLessThan(1);
    expect(star.corona.uniforms.uTime.value).toBe(uniforms['uTime'].value);
    star.dispose();
  });

  it('raises prominences while flares are active', () => {
    const star = createStar(deriveStarProfile('active-m', 'M4V'), { flareActivity: 100 });
    let sawLoop = false;
    for (let frame = 0; frame < 2400 && !sawLoop; frame++) {
      star.advance(0.05);
      sawLoop = star.prominences.loops.some((loop) => loop.visible);
    }
    expect(sawLoop).toBe(true);
    star.dispose();
  });

  it('applies and clears a highlight tint', () => {
    const star = createStar(deriveStarProfile('sol', 'G2V'));
    const uniforms = star.photosphere.material.uniforms;
    star.setHighlight('#ff3b30');
    expect(uniforms['uHighlightAmount'].value).toBeGreaterThan(0);
    expect((uniforms['uHighlightColor'].value as Color).r).toBeGreaterThan(0.9);
    star.setHighlight(null);
    expect(uniforms['uHighlightAmount'].value).toBe(0);
    star.dispose();
  });

  it('keeps internal meshes out of picking', () => {
    const star = createStar(deriveStarProfile('sol', 'G2V'));
    const hits: unknown[] = [];
    star.group.traverse((object) => {
      if (object instanceof Mesh) object.raycast({} as never, hits as never);
    });
    expect(hits).toHaveLength(0);
    star.dispose();
  });
});

describe('createSplashStar', () => {
  it('builds a splash-sized star with a coloured light', () => {
    const star = createSplashStar({ bodyId: 'nova-splash-star-m', spectralClass: 'M4V', quality: 'low', flareActivity: 60 });
    expect(star.photosphere.geometry.parameters.radius).toBe(SPLASH_STAR_RADIUS);
    const light = star.group.getObjectByName('star-light');
    expect(light).toBeInstanceOf(PointLight);
    star.dispose();
  });
});
