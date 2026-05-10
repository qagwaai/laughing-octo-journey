import type { ViewerBody } from '../../model/solar-system-get';
import { mapBodiesToRendered } from './viewer-system-scene';

const star: ViewerBody = {
  id: 'star-1',
  bodyType: 'star',
  displayName: 'Sol',
  spatial: { solarSystemId: 'sol', frame: 'icrs', positionKm: { x: 0, y: 0, z: 0 }, epochMs: 0 },
  visualization: { colorHex: '#fff5b6' },
  spectralClass: 'G2V',
  luminositySolar: 1,
};
const planet: ViewerBody = {
  id: 'planet-1',
  bodyType: 'planet',
  displayName: 'Earth',
  spatial: { solarSystemId: 'sol', frame: 'icrs', positionKm: { x: 149_597_870, y: 0, z: 0 }, epochMs: 0 },
  visualization: { colorHex: '#3399ff' },
  physicalCatalog: { estimatedDiameterM: 12_742_000 },
};

describe('ViewerSystemScene mapBodiesToRendered', () => {
  it('partitions stars and non-stars and assigns colors/positions', () => {
    const rendered = mapBodiesToRendered([star, planet]);
    expect(rendered.length).toBe(2);

    const renderedStar = rendered.find((b) => b.id === 'star-1');
    const renderedPlanet = rendered.find((b) => b.id === 'planet-1');

    expect(renderedStar?.isStar).toBeTrue();
    expect(renderedStar?.color).toBe('#fff5b6');
    expect(renderedStar?.position).toEqual([0, 0, 0]);
    expect(renderedPlanet?.isStar).toBeFalse();
    expect(renderedPlanet?.color).toBe('#3399ff');
    expect(renderedPlanet?.position[0]).toBeGreaterThan(0);
  });

  it('returns an empty array when no bodies are provided', () => {
    expect(mapBodiesToRendered([])).toEqual([]);
  });
});
