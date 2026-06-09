import {
  buildCelestialBodyListRequestKey,
  buildDefaultCelestialBodyListRequestIdentity,
  buildDefaultCelestialBodyUpsertRequestIdentity,
  buildDefaultItemUpsertRequestIdentity,
  buildDefaultLaunchItemRequestIdentity,
  buildDefaultShipUpsertRequestIdentity,
  buildDomainPipelineKey,
} from './socket-domain-identity';

describe('socket-domain-identity helpers', () => {
  it('builds normalized domain pipeline keys', () => {
    const key = buildDomainPipelineKey({
      operation: '  ITEM-UPSERT ',
      entityType: ' Hull-Patch-Kit ',
      containerId: ' Ship-1 ',
      characterId: ' Char-1 ',
    });

    expect(key).toBe('item-upsert|hull-patch-kit|ship-1|char-1');
  });

  it('uses expected defaults for item upsert identity', () => {
    const identity = buildDefaultItemUpsertRequestIdentity({
      item: {
        itemType: ' hull-patch-kit ',
        container: { containerId: ' ship-1 ' },
      },
    } as any);

    expect(identity).toEqual({
      operation: 'item-upsert',
      entityType: 'hull-patch-kit',
      containerId: 'ship-1',
    });
  });

  it('uses expected defaults for ship upsert identity', () => {
    const identity = buildDefaultShipUpsertRequestIdentity({
      ship: { id: ' ship-1 ' },
    } as any);

    expect(identity).toEqual({
      operation: 'ship-upsert',
      entityType: 'ship',
      containerId: 'ship-1',
    });
  });

  it('uses expected defaults for launch identity', () => {
    const identity = buildDefaultLaunchItemRequestIdentity({
      itemType: ' expendable-dart-drone ',
      shipId: ' ship-1 ',
      itemId: ' item-1 ',
      hotkey: 1,
      targetCelestialBodyId: ' cb-1 ',
      characterId: ' char-1 ',
    } as any);

    expect(identity).toEqual({
      operation: 'launch-item',
      entityType: 'expendable-dart-drone',
      containerId: 'ship-1',
      itemId: 'item-1',
      hotkey: 1,
      targetCelestialBodyId: 'cb-1',
      characterId: 'char-1',
    });
  });

  it('uses expected defaults for celestial-body upsert/list identities and list key', () => {
    const upsertIdentity = buildDefaultCelestialBodyUpsertRequestIdentity({
      celestialBody: { id: ' cb-1 ' },
    } as any);
    const listIdentity = buildDefaultCelestialBodyListRequestIdentity({
      solarSystemId: ' Sol ',
    } as any);
    const listKey = buildCelestialBodyListRequestKey({
      playerName: ' Pioneer ',
      solarSystemId: ' Sol ',
      distanceKm: 900000,
      positionKm: { x: 1, y: 2, z: 3 },
    });

    expect(upsertIdentity).toEqual({
      operation: 'celestial-body-upsert',
      entityType: 'celestial-body',
      containerId: 'cb-1',
    });
    expect(listIdentity).toEqual({
      operation: 'celestial-body-list',
      entityType: 'celestial-body',
      containerId: 'Sol',
    });
    expect(listKey).toBe('pioneer|sol|900000|1|2|3');
  });
});
