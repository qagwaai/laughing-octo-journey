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

  it('should map and store valid ship items', () => {
    service.upsertFromShipItems([createShipItem()]);

    expect(service.getAll()).toEqual([
      {
        id: 'item-1',
        itemType: 'debris_scrap',
        displayName: 'Debris Scrap',
        positionKm: { x: 10, y: 20, z: 30 },
        velocityKmPerSec: { x: 0.1, y: 0.2, z: 0.3 },
      },
    ]);
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

    expect(service.getAll()).toEqual([
      {
        id: 'item-1',
        itemType: 'debris_scrap',
        displayName: 'Updated Debris',
        positionKm: { x: 100, y: 200, z: 300 },
        velocityKmPerSec: { x: 0.1, y: 0.2, z: 0.3 },
      },
    ]);
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
});
