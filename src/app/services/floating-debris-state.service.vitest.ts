import type { ShipItem } from '../model/ship-item';
import { FloatingDebrisStateService } from './floating-debris-state.service';

function createShipItem(overrides: Partial<ShipItem> = {}): ShipItem {
  const now = new Date().toISOString();
  return {
    id: 'item-1',
    itemType: 'debris_scrap',
    displayName: 'Debris Scrap',
    launchable: false,
    state: 'deployed',
    damageStatus: 'intact',
    container: null,
    owningPlayerId: null,
    owningCharacterId: null,
    spatial: {
      solarSystemId: 'sol',
      frame: 'barycentric',
      positionKm: { x: 10, y: 20, z: 30 },
      epochMs: Date.now(),
    },
    motion: {
      velocityKmPerSec: { x: 0.1, y: 0.2, z: 0.3 },
    },
    destroyedAt: null,
    destroyedReason: null,
    discoveredAt: null,
    discoveredByCharacterId: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('FloatingDebrisStateService', () => {
  let service: FloatingDebrisStateService;

  beforeEach(() => {
    service = new FloatingDebrisStateService();
  });

  it('should start empty', () => {
    expect(service.getAll()).toEqual([]);
  });

  it('should isolate debris by celestial body scope', () => {
    service.setScope('cb-1');
    service.upsertLocal([
      {
        id: 'local-cb-1',
        itemType: 'sensor-array',
        displayName: 'Sensor Array',
        positionKm: { x: 1, y: 2, z: 3 },
      },
    ]);

    service.setScope('cb-2');
    expect(service.getAll()).toEqual([]);

    service.setScope('cb-1');
    expect(service.getAll().map((item) => item.id)).toEqual(['local-cb-1']);
  });

  it('should map and store valid ship items', () => {
    service.upsertFromShipItems([createShipItem()]);

    expect(service.getAll().length).toBe(1);
    expect(service.getAll()[0]).toEqual(
      expect.objectContaining({
        id: 'item-1',
        itemType: 'debris_scrap',
        displayName: 'Debris Scrap',
        positionKm: { x: 10, y: 20, z: 30 },
        velocityKmPerSec: { x: 0.1, y: 0.2, z: 0.3 },
        state: 'deployed',
        damageStatus: 'intact',
        externalObjectDescriptor: expect.objectContaining({
          domain: 'debris',
        }),
      }),
    );
  });

  it('should update existing item when same id is received', () => {
    service.upsertFromShipItems([createShipItem()]);
    service.upsertFromShipItems([
      createShipItem({
        displayName: 'Updated Debris',
        spatial: {
          solarSystemId: 'sol',
          frame: 'barycentric',
          positionKm: { x: 100, y: 200, z: 300 },
          epochMs: Date.now(),
        },
      }),
    ]);

    expect(service.getAll().length).toBe(1);
    expect(service.getAll()[0]).toEqual(
      expect.objectContaining({
        id: 'item-1',
        itemType: 'debris_scrap',
        displayName: 'Updated Debris',
        positionKm: { x: 100, y: 200, z: 300 },
        velocityKmPerSec: { x: 0.1, y: 0.2, z: 0.3 },
        state: 'deployed',
        damageStatus: 'intact',
        externalObjectDescriptor: expect.objectContaining({
          domain: 'debris',
        }),
      }),
    );
  });

  it('should ignore invalid items without spatial position (negative)', () => {
    service.upsertFromShipItems([
      createShipItem({
        id: 'missing-spatial',
        spatial: null,
      }),
    ]);

    expect(service.getAll()).toEqual([]);
  });

  it('should ignore invalid items with missing id (negative)', () => {
    service.upsertFromShipItems([
      createShipItem({
        id: '',
      }),
    ]);

    expect(service.getAll()).toEqual([]);
  });

  it('should clear all cached debris entries', () => {
    service.upsertFromShipItems([createShipItem()]);
    expect(service.getAll().length).toBe(1);

    service.clear();
    expect(service.getAll()).toEqual([]);
  });

  it('should upsert client-synthesised debris via upsertLocal', () => {
    service.upsertLocal([
      {
        id: 'local-1',
        itemType: 'sensor-array',
        displayName: 'Sensor Array',
        positionKm: { x: 1, y: 2, z: 3 },
      },
    ]);

    expect(service.getAll()).toEqual([
      {
        id: 'local-1',
        itemType: 'sensor-array',
        displayName: 'Sensor Array',
        positionKm: { x: 1, y: 2, z: 3 },
      },
    ]);
  });

  it('should ignore invalid local debris missing id or itemType (negative)', () => {
    service.upsertLocal([
      { id: '', itemType: 'sensor-array', displayName: 'X', positionKm: { x: 0, y: 0, z: 0 } },
      {
        id: 'no-type',
        itemType: '' as unknown as string,
        displayName: 'X',
        positionKm: { x: 0, y: 0, z: 0 },
      },
    ]);

    expect(service.getAll()).toEqual([]);
  });

  it('exposes a reactive items() signal that reflects upserts and clears', () => {
    expect(service.items()).toEqual([]);

    service.upsertFromShipItems([createShipItem()]);
    expect(service.items().length).toBe(1);
    expect(service.items()[0].id).toBe('item-1');

    service.upsertLocal([
      { id: 'local-1', itemType: 'sensor-array', displayName: 'Sensor', positionKm: { x: 0, y: 0, z: 0 } },
    ]);
    expect(service.items().length).toBe(2);

    service.clear();
    expect(service.items()).toEqual([]);
  });

  it('should replace stale debris with authoritative ship items', () => {
    service.upsertLocal([
      { id: 'stale-local', itemType: 'sensor-array', displayName: 'Sensor', positionKm: { x: 0, y: 0, z: 0 } },
    ]);

    service.replaceFromShipItems([
      createShipItem({
        id: 'fresh-server',
        displayName: 'Fresh Server Debris',
      }),
    ]);

    expect(service.getAll().map((item) => item.id)).toEqual(['fresh-server']);
  });

  it('removeById deletes the entry and returns true (positive)', () => {
    service.upsertFromShipItems([createShipItem()]);
    expect(service.removeById('item-1')).toBe(true);
    expect(service.getAll()).toEqual([]);
    expect(service.items()).toEqual([]);
  });

  it('removeById returns false when id is unknown (negative)', () => {
    expect(service.removeById('does-not-exist')).toBe(false);
  });
});

