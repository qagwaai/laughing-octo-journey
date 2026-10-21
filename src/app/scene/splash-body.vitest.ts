import { DataTexture, Group, type Mesh } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createIoVolcanicCueGroup, createSplashBody, type SplashBodySettings } from './splash-body';
import { SPLASH_PLANET_ROTATION } from './planet/splash-planet-rotation';

const release = vi.fn();
const loadCatalogSurface = vi.fn(async () => ({
  albedo: new DataTexture(),
  normal: null,
  dispose: release,
}));
vi.mock('./planet/catalog-surface-loader', () => ({
  loadCatalogSurface: (...args: unknown[]) => loadCatalogSurface(...(args as [])),
}));

const settings: SplashBodySettings = {
  cloudsEnabled: true,
  cloudStyle: 'thin',
  cloudCoverage: 50,
  stormActivity: 40,
  giantPalette: 'seeded',
  giantRings: 'seeded',
  starClass: 'G2V',
  flareActivity: 30,
};
const entry = (id: string) => SPLASH_PLANET_ROTATION.find((candidate) => candidate.id === id)!;

describe('createSplashBody', () => {
  it.each(['icy-moon', 'rocky-moon'] as const)(
    'builds %s without clouds and releases its mesh and baked maps',
    async (kind) => {
      const body = await createSplashBody({ id: `nova-splash-${kind}-01`, kind }, { quality: 'low', settings });
      const slot = new Group();
      slot.add(body.object);
      expect(body.object.name).toBe(`nova-splash-${kind}-01`);
      expect(body.cloudMesh).toBeUndefined();
      expect(body.object.children).toHaveLength(0);
      const mesh = body.object as Mesh;
      const disposed = vi.spyOn(mesh.geometry, 'dispose');
      body.dispose();
      expect(slot.children).toHaveLength(0);
      expect(disposed).toHaveBeenCalledOnce();
    },
  );

  it('builds catalog Sol bodies from the low variant and releases them on dispose', async () => {
    const slot = new Group();
    const body = await createSplashBody(entry('sol-mars'), { quality: 'low', settings });
    slot.add(body.object);
    expect(loadCatalogSurface).toHaveBeenCalledWith(expect.objectContaining({ variant: 'low', bodyId: 'sol-mars' }));
    expect(body.object.name).toBe('sol-mars');
    expect(body.cloudMesh).toBeUndefined();
    body.dispose();
    expect(slot.children).toHaveLength(0);
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('adds a cloud shell to Earth only', async () => {
    const earth = await createSplashBody(entry('sol-earth'), { quality: 'low', settings });
    expect(earth.cloudMesh?.visible).toBe(true);
    expect(earth.cloudStyle).toBe('thin');
    earth.dispose();
  });

  it('adds volcanic cues to Io', async () => {
    const io = await createSplashBody(entry('sol-io'), { quality: 'low', settings });
    expect(io.object.getObjectByName('Io volcanic cues')).toBeDefined();
    io.dispose();
  });

  it('builds stars and giants with the provided overrides', async () => {
    const star = await createSplashBody(entry('nova-splash-star-m'), { quality: 'low', settings });
    expect(star.star).toBeDefined();
    expect(star.starClass).toBe('G2V');
    star.dispose();
    const giant = await createSplashBody(entry('nova-splash-giant-01'), { quality: 'low', settings });
    expect(giant.giant).toBeDefined();
    expect(giant.giantLook).toBe('seeded|seeded');
    giant.dispose();
  });
});

describe('createIoVolcanicCueGroup', () => {
  it('builds a halo, hotspot and plume per cue', () => {
    const group = createIoVolcanicCueGroup('standard');
    expect(group.children.length).toBeGreaterThan(0);
    for (const cue of group.children) {
      expect(cue.children).toHaveLength(3);
      expect((cue.children[0] as Mesh).renderOrder).toBe(3);
    }
  });
});
