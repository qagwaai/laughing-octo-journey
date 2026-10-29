import { describe, expect, it } from 'vitest';
import type { ViewerBody } from '../../model/solar-system-get';
import {
  CYGNUS_X1_PRESENTATION_POSITIONS,
  isCygnusX1BlackHole,
  isCygnusX1Companion,
  resolveCygnusX1PresentationLayout,
} from './cygnus-x1-viewer-profile';

const blackHole: ViewerBody = {
  id: 'entity-1',
  catalogIdentity: { namespace: 'cygnus-x1', key: 'black-hole' },
  bodyType: 'black-hole',
  surfaceArchetype: 'black-hole',
  displayName: 'Some display label',
  spatial: { solarSystemId: 'cygnus-x1', frame: 'barycentric', positionKm: { x: 0, y: 0, z: 0 }, epochMs: 1234 },
  orbitalElements: null,
  blackHoleProperties: {
    massSolar: 21.2,
    massUncertaintySolar: 2.2,
    distanceParsec: 2220,
    distanceUncertaintyParsec: 180,
    orbitalPeriodDays: 5.599829,
    relativeBinarySemimajorAxisAU: 0.244,
    eccentricity: 0.0189,
    inclinationDeg: 27.51,
    schwarzschildReferenceRadiusKm: 62.6,
    eventHorizonRadiusKm: null,
    visualAccretionDiskOuterRadiusKm: null,
    sourceReferences: ['Miller-Jones et al. 2021'],
  },
};

const companion: ViewerBody = {
  id: 'entity-2',
  catalogIdentity: { namespace: 'cygnus-x1', key: 'hd226868' },
  bodyType: 'star',
  surfaceArchetype: 'star',
  displayName: 'Unrelated name',
  spatial: { solarSystemId: 'cygnus-x1', frame: 'barycentric', positionKm: { x: 0, y: 0, z: 0 }, epochMs: 1234 },
  orbitalElements: null,
  physicalCatalog: {
    massSolar: 40.6,
    massUncertaintySolar: 7.7,
    meanRadiusKm: 15_514_110,
    meanTemperatureK: 31_138,
  },
};

describe('Cygnus X-1 viewer profile', () => {
  it('selects the black-hole profile only for the exact catalog identity and compatible classification', () => {
    expect(isCygnusX1BlackHole(blackHole)).toBe(true);
    for (const body of [
      { ...blackHole, catalogIdentity: null },
      { ...blackHole, catalogIdentity: { namespace: 'cygnus-x1', key: 'hd226868' } },
      { ...blackHole, catalogIdentity: { namespace: 'Cygnus-X1', key: 'black-hole' } },
      { ...blackHole, catalogIdentity: { namespace: 'cygnus-x1', key: 'black-hole-alias' } },
      { ...blackHole, bodyType: 'star' },
      { ...blackHole, surfaceArchetype: 'rocky' },
      { ...blackHole, id: 'cygnus-x1-black-hole', catalogIdentity: null },
      { ...blackHole, displayName: 'Cygnus X-1', catalogIdentity: null },
      { ...blackHole, visualization: { textureKey: 'cygnus-x1/black-hole' }, catalogIdentity: null },
    ] as ViewerBody[]) {
      expect(isCygnusX1BlackHole(body)).toBe(false);
    }
  });

  it('recognizes the companion only by its exact identity, not HYG/entity/name aliases', () => {
    expect(isCygnusX1Companion(companion)).toBe(true);
    expect(isCygnusX1Companion({ ...companion, catalogIdentity: null, id: '97987', displayName: 'HD 226868' })).toBe(
      false,
    );
    expect(isCygnusX1Companion({ ...companion, catalogIdentity: { namespace: 'cygnus-x1', key: 'black-hole' } })).toBe(
      false,
    );
  });

  it('stages only the authored zero-position pair in a separate presentation layout', () => {
    const layout = resolveCygnusX1PresentationLayout([blackHole, companion]);
    expect(layout.get(blackHole)).toEqual(CYGNUS_X1_PRESENTATION_POSITIONS.blackHole);
    expect(layout.get(companion)).toEqual(CYGNUS_X1_PRESENTATION_POSITIONS.companion);
    expect(blackHole.spatial.positionKm).toEqual({ x: 0, y: 0, z: 0 });
    expect(companion.spatial.positionKm).toEqual({ x: 0, y: 0, z: 0 });
    expect(blackHole.orbitalElements).toBeNull();
    expect(companion.orbitalElements).toBeNull();
    expect(resolveCygnusX1PresentationLayout([blackHole])).toEqual(new Map());
    expect(
      resolveCygnusX1PresentationLayout([
        blackHole,
        { ...companion, spatial: { ...companion.spatial, positionKm: { x: 1, y: 0, z: 0 } } },
      ]),
    ).toEqual(new Map());
  });

  it('preserves unknown horizon and disk sizes as null, distinct from a measured zero', () => {
    expect(blackHole.blackHoleProperties?.eventHorizonRadiusKm).toBeNull();
    expect(blackHole.blackHoleProperties?.visualAccretionDiskOuterRadiusKm).toBeNull();
    expect(companion.physicalCatalog?.meanRadiusKm).toBe(15_514_110);
  });
});
