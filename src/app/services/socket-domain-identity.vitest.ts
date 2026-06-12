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

  it('falls back to unknown defaults when item upsert fields are absent', () => {
    const identity = buildDefaultItemUpsertRequestIdentity({} as any);
    expect(identity.entityType).toBe('unknown-item-type');
    expect(identity.containerId).toBe('unknown-container');
  });

  it('falls back to unknown-ship-id when ship upsert id is absent', () => {
    const identity = buildDefaultShipUpsertRequestIdentity({} as any);
    expect(identity.containerId).toBe('unknown-ship-id');
  });

  it('falls back to unknown defaults when launch item fields are absent', () => {
    const identity = buildDefaultLaunchItemRequestIdentity({} as any);
    expect(identity.entityType).toBe('unknown-item-type');
    expect(identity.containerId).toBe('unknown-container');
    expect(identity.itemId).toBeUndefined();
    expect(identity.targetCelestialBodyId).toBeUndefined();
    expect(identity.characterId).toBeUndefined();
  });

  it('falls back to unknown-celestial-body when upsert id is absent', () => {
    const identity = buildDefaultCelestialBodyUpsertRequestIdentity({} as any);
    expect(identity.containerId).toBe('unknown-celestial-body');
  });

  it('falls back to unknown-solar-system when list solar system id is absent', () => {
    const identity = buildDefaultCelestialBodyListRequestIdentity({} as any);
    expect(identity.containerId).toBe('unknown-solar-system');
  });

  it('builds list key with empty string placeholders when position is absent', () => {
    const key = buildCelestialBodyListRequestKey({ playerName: 'Pioneer', solarSystemId: 'sol' });
    // distanceKm absent -> '', positionKm absent -> '' each axis
    expect(key.startsWith('pioneer|sol')).toBe(true);
  });

  it('builds pipeline key with empty segments for missing fields', () => {
    const key = buildDomainPipelineKey({});
    expect(key).toBe('|||');
  });
});
