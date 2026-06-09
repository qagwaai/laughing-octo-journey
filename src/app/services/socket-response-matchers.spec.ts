import {
  isCelestialBodyListResponseForRequest,
  isCelestialBodyUpsertResponseForRequest,
  isItemUpsertResponseForRequest,
  isLaunchItemResponseForRequest,
  isShipUpsertResponseForRequest,
} from './socket-response-matchers';

describe('socket-response-matchers', () => {
  it('matches item upsert responses only when correlation and identity match', () => {
    const expectedIdentity = {
      operation: 'item-upsert',
      entityType: 'hull-patch-kit',
      containerId: 'ship-1',
    };

    const good = isItemUpsertResponseForRequest(
      {
        correlationId: 'corr-1',
        requestIdentity: { ...expectedIdentity },
      } as any,
      'corr-1',
      expectedIdentity as any,
    );

    const bad = isItemUpsertResponseForRequest(
      {
        correlationId: 'corr-2',
        requestIdentity: { ...expectedIdentity },
      } as any,
      'corr-1',
      expectedIdentity as any,
    );

    expect(good).toBeTrue();
    expect(bad).toBeFalse();
  });

  it('matches ship upsert responses only when canonical identity fields match', () => {
    const expectedIdentity = {
      operation: 'ship-upsert',
      entityType: 'ship',
      containerId: 'ship-1',
    };

    const good = isShipUpsertResponseForRequest(
      {
        correlationId: 'corr-1',
        requestIdentity: { ...expectedIdentity },
      } as any,
      'corr-1',
      expectedIdentity as any,
      {} as any,
    );

    const bad = isShipUpsertResponseForRequest(
      {
        correlationId: 'corr-1',
        requestIdentity: { ...expectedIdentity, containerId: 'ship-2' },
      } as any,
      'corr-1',
      expectedIdentity as any,
      {} as any,
    );

    expect(good).toBeTrue();
    expect(bad).toBeFalse();
  });

  it('matches launch responses only when optional identity fields align', () => {
    const expectedIdentity = {
      operation: 'launch-item',
      entityType: 'expendable-dart-drone',
      containerId: 'ship-1',
      itemId: 'item-1',
      hotkey: 1,
      targetCelestialBodyId: 'cb-1',
      characterId: 'char-1',
    };

    const good = isLaunchItemResponseForRequest(
      {
        correlationId: 'corr-1',
        requestIdentity: { ...expectedIdentity },
      } as any,
      'corr-1',
      expectedIdentity as any,
      {} as any,
    );

    const bad = isLaunchItemResponseForRequest(
      {
        correlationId: 'corr-1',
        requestIdentity: { ...expectedIdentity, hotkey: 2 },
      } as any,
      'corr-1',
      expectedIdentity as any,
      {} as any,
    );

    expect(good).toBeTrue();
    expect(bad).toBeFalse();
  });

  it('matches celestial-body upsert/list responses only when expected identity matches', () => {
    const upsertIdentity = {
      operation: 'celestial-body-upsert',
      entityType: 'celestial-body',
      containerId: 'cb-1',
    };
    const listIdentity = {
      operation: 'celestial-body-list',
      entityType: 'celestial-body',
      containerId: 'sol',
    };

    expect(
      isCelestialBodyUpsertResponseForRequest(
        {
          correlationId: 'corr-upsert',
          requestIdentity: { ...upsertIdentity },
        } as any,
        'corr-upsert',
        upsertIdentity as any,
        {} as any,
      ),
    ).toBeTrue();

    expect(
      isCelestialBodyUpsertResponseForRequest(
        {
          correlationId: 'corr-upsert',
          requestIdentity: { ...upsertIdentity, containerId: 'cb-2' },
        } as any,
        'corr-upsert',
        upsertIdentity as any,
        {} as any,
      ),
    ).toBeFalse();

    expect(
      isCelestialBodyListResponseForRequest(
        {
          correlationId: 'corr-list',
          requestIdentity: { ...listIdentity },
        } as any,
        'corr-list',
        listIdentity as any,
        {} as any,
      ),
    ).toBeTrue();

    expect(
      isCelestialBodyListResponseForRequest(
        {
          correlationId: 'corr-list',
          requestIdentity: { ...listIdentity, operation: 'wrong-op' },
        } as any,
        'corr-list',
        listIdentity as any,
        {} as any,
      ),
    ).toBeFalse();
  });
});
