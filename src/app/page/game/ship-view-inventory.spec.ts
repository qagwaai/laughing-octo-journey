import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import {
  createMockSessionService,
  createMockSocketService,
  type MockSessionService,
  type MockSocketService,
} from '../../../testing';
import { SessionService } from '../../services/session.service';
import { ConsumedItemShadowService } from '../../services/consumed-item-shadow.service';
import { ShipService } from '../../services/ship.service';
import { SocketLifecycleService } from '../../services/socket-lifecycle.service';
import { SocketService } from '../../services/socket.service';
import ShipViewInventoryPage from './ship-view-inventory';

interface ItemStub {
  id: string;
  itemType: string;
  displayName: string;
  state?: 'contained' | 'deployed' | 'destroyed';
  damageStatus?: 'intact' | 'damaged' | 'disabled' | 'destroyed';
  destroyedAt?: string | null;
  destroyedReason?: string | null;
}

interface NavigationState {
  playerName?: string;
  joinCharacter?: { id: string; characterName: string };
  joinShip?: {
    id: string;
    name: string;
    model?: string;
    tier?: number;
    inventory?: ItemStub[];
    damageProfile?: {
      overallStatus: 'intact' | 'damaged' | 'disabled' | 'destroyed';
      summary: string;
      origin: 'cold-boot-scripted' | 'combat' | 'wear' | 'unknown';
      updatedAt: string;
      systems: Array<{
        code: string;
        label: string;
        severity: 'minor' | 'major' | 'critical';
        summary: string;
        repairPriority: number;
      }>;
    };
  };
}

interface InventoryGroup {
  itemType: string;
  name: string;
  quantity: number;
  item: ItemStub;
}

function makeItem(overrides?: Partial<ItemStub>): ItemStub {
  return {
    id: overrides?.id ?? 'item-1',
    itemType: overrides?.itemType ?? 'expendable-dart-drone',
    displayName: overrides?.displayName ?? 'Expendable Dart Drone',
    state: overrides?.state,
    damageStatus: overrides?.damageStatus,
  };
}

function setup(options: {
  socketService: MockSocketService;
  sessionService: MockSessionService;
  navigationState?: NavigationState;
}) {
  const mockShipService = {
    listShips: jasmine.createSpy('listShips'),
  };
  const mockSocketLifecycle = {
    runWhenConnected: jasmine.createSpy('runWhenConnected').and.callFake((callback: () => void) => callback()),
  };
  const mockConsumedItemShadowService = {
    filterInventory: jasmine
      .createSpy('filterInventory')
      .and.callFake((_playerName: string, _characterId: string, inventory: any[]) => inventory ?? []),
  };

  const mockRouter = {
    getCurrentNavigation: () => (options.navigationState ? { extras: { state: options.navigationState } } : null),
    navigate: jasmine.createSpy('navigate'),
  };

  TestBed.configureTestingModule({
    imports: [ShipViewInventoryPage],
    providers: [
      { provide: SocketService, useValue: options.socketService },
      { provide: SessionService, useValue: options.sessionService },
      { provide: ShipService, useValue: mockShipService },
      { provide: SocketLifecycleService, useValue: mockSocketLifecycle },
      { provide: ConsumedItemShadowService, useValue: mockConsumedItemShadowService },
      { provide: Router, useValue: mockRouter },
    ],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
  });

  const fixture = TestBed.createComponent(ShipViewInventoryPage);
  fixture.detectChanges();
  return {
    component: fixture.componentInstance,
    fixture,
    mockRouter,
    mockShipService,
    mockSocketLifecycle,
    mockConsumedItemShadowService,
  };
}

describe('ShipViewInventoryPage', () => {
  let socketService: MockSocketService;
  let sessionService: MockSessionService;

  beforeEach(() => {
    socketService = createMockSocketService();
    sessionService = createMockSessionService('test-session-key');
  });

  it('should initialize context from navigation state', () => {
    const { component } = setup({
      socketService,
      sessionService,
      navigationState: {
        playerName: 'Pioneer',
        joinCharacter: { id: 'c-1', characterName: 'Nova' },
        joinShip: { id: 's-1', name: 'Scavenger I', model: 'Scavenger Pod', tier: 1, inventory: [makeItem()] },
      },
    });

    expect(component['playerName']()).toBe('Pioneer');
    expect(component['joinCharacter']()).toEqual({ id: 'c-1', characterName: 'Nova' });
    expect(component['joinShip']()?.id).toBe('s-1');
  });

  it('should group inventory items by item type with quantity counts', () => {
    const { component } = setup({
      socketService,
      sessionService,
      navigationState: {
        joinShip: {
          id: 's-1',
          name: 'Scavenger I',
          inventory: [
            makeItem({ id: 'item-1', itemType: 'expendable-dart-drone', displayName: 'Expendable Dart Drone' }),
            makeItem({ id: 'item-2', itemType: 'expendable-dart-drone', displayName: 'Expendable Dart Drone Mk II' }),
            makeItem({ id: 'item-3', itemType: 'basic-mining-laser', displayName: 'Basic Mining Laser' }),
          ],
        },
      },
    });

    const groups = component['inventoryGroups']() as InventoryGroup[];

    expect(groups.length).toBe(2);
    expect(groups[0].itemType).toBe('expendable-dart-drone');
    expect(groups[0].name).toBe('Expendable Dart Drone');
    expect(groups[0].quantity).toBe(2);
    expect(groups[1].itemType).toBe('basic-mining-laser');
    expect(groups[1].quantity).toBe(1);
  });

  it('should navigate to item-view-specs with grouped item context', () => {
    const character = { id: 'c-1', characterName: 'Nova' };
    const groupedItem = makeItem({ id: 'item-1', itemType: 'basic-mining-laser', displayName: 'Basic Mining Laser' });
    const { component, mockRouter } = setup({
      socketService,
      sessionService,
      navigationState: {
        playerName: 'Pioneer',
        joinCharacter: character,
      },
    });

    component.navigateToItemSpecs({
      itemType: groupedItem.itemType,
      name: groupedItem.displayName,
      quantity: 3,
      item: groupedItem as any,
    });

    expect(mockRouter.navigate).toHaveBeenCalledWith(
      [{ outlets: { right: ['item-view-specs'], left: ['ship-view-inventory'] } }],
      {
        preserveFragment: true,
        queryParams: { specsNav: jasmine.any(Number) },
        state: {
          playerName: 'Pioneer',
          joinCharacter: character,
          itemType: 'basic-mining-laser',
          item: groupedItem,
        },
      },
    );
  });

  it('should return empty inventory groups when ship inventory is empty', () => {
    const { component } = setup({
      socketService,
      sessionService,
      navigationState: {
        joinShip: { id: 's-1', name: 'Scavenger I', inventory: [] },
      },
    });

    expect(component['inventoryGroups']()).toEqual([]);
  });

  it('should return empty inventory groups when no ship is selected', () => {
    const { component } = setup({ socketService, sessionService });

    expect(component['inventoryGroups']()).toEqual([]);
  });

  it('should not show destroyed inventory items', () => {
    const { component } = setup({
      socketService,
      sessionService,
      navigationState: {
        joinShip: {
          id: 's-1',
          name: 'Scavenger I',
          inventory: [
            makeItem({
              id: 'kit-destroyed',
              itemType: 'hull-patch-kit',
              displayName: 'Hull Patch Kit',
              state: 'destroyed',
              damageStatus: 'destroyed',
              destroyedAt: '2026-05-18T00:00:00.000Z',
              destroyedReason: 'scrapped',
            }),
            makeItem({ id: 'iron-1', itemType: 'iron', displayName: 'Iron', state: 'contained', damageStatus: 'intact' }),
          ],
        },
      },
    });

    const groups = component['inventoryGroups']() as InventoryGroup[];
    const itemTypes = groups.map((g) => g.itemType);
    expect(itemTypes).toContain('iron');
    expect(itemTypes).not.toContain('hull-patch-kit');
  });

  it('should include damage-profile subsystem items when missing from inventory', () => {
    const { component } = setup({
      socketService,
      sessionService,
      navigationState: {
        playerName: 'Pioneer',
        joinCharacter: { id: 'c-1', characterName: 'Nova' },
        joinShip: {
          id: 's-1',
          name: 'Scavenger I',
          inventory: [makeItem()],
          damageProfile: {
            overallStatus: 'damaged',
            summary: 'Cold boot systems damaged',
            origin: 'cold-boot-scripted',
            updatedAt: '2026-05-17T00:00:00.000Z',
            systems: [
              {
                code: 'propulsion-manifold',
                label: 'Propulsion Manifold',
                severity: 'critical',
                summary: 'Main thrust line rupture',
                repairPriority: 1,
              },
              {
                code: 'sensor-array',
                label: 'Sensor Array',
                severity: 'major',
                summary: 'Long-range scatter',
                repairPriority: 2,
              },
              {
                code: 'power-distribution',
                label: 'Power Distribution Bus',
                severity: 'major',
                summary: 'Load balancing unstable',
                repairPriority: 3,
              },
            ],
          },
        },
      },
    });

    const groups = component['inventoryGroups']() as InventoryGroup[];
    const names = groups.map((g) => g.name);

    expect(names).toContain('Propulsion Manifold');
    expect(names).toContain('Sensor Array');
    expect(names).toContain('Power Distribution Bus');
  });

  it('should not duplicate subsystem item when inventory already contains matching backend item', () => {
    const { component } = setup({
      socketService,
      sessionService,
      navigationState: {
        playerName: 'Pioneer',
        joinCharacter: { id: 'c-1', characterName: 'Nova' },
        joinShip: {
          id: 's-1',
          name: 'Scavenger I',
          inventory: [
            makeItem({ id: 'item-1', itemType: 'power-distribution-bus', displayName: 'Power Distribution Bus' }),
          ],
          damageProfile: {
            overallStatus: 'damaged',
            summary: 'Cold boot systems damaged',
            origin: 'cold-boot-scripted',
            updatedAt: '2026-05-17T00:00:00.000Z',
            systems: [
              {
                code: 'power-distribution',
                label: 'Power Distribution Bus',
                severity: 'major',
                summary: 'Load balancing unstable',
                repairPriority: 3,
              },
            ],
          },
        },
      },
    });

    const groups = component['inventoryGroups']() as InventoryGroup[];
    const powerDistributionEntries = groups.filter((g) => g.name === 'Power Distribution Bus');
    expect(powerDistributionEntries.length).toBe(1);
    expect(powerDistributionEntries[0].quantity).toBe(1);
  });

  it('should navigate back to ship-hangar with player and character state', () => {
    const character = { id: 'c-1', characterName: 'Nova' };
    const { component, mockRouter } = setup({
      socketService,
      sessionService,
      navigationState: {
        playerName: 'Pioneer',
        joinCharacter: character,
        joinShip: { id: 's-1', name: 'Scavenger I', inventory: [] },
      },
    });

    component.navigateBackToHangar();

    expect(mockRouter.navigate).toHaveBeenCalledWith([{ outlets: { left: ['ship-hangar'] } }], {
      preserveFragment: true,
      state: {
        playerName: 'Pioneer',
        joinCharacter: character,
      },
    });
  });

  it('should return ship display name from ship name', () => {
    const { component } = setup({
      socketService,
      sessionService,
      navigationState: {
        joinShip: { id: 's-2', name: 'Dart Runner' },
      },
    });

    expect(component['getShipDisplayName']()).toBe('Dart Runner');
  });

  it('should fall back to ship id when name is blank', () => {
    const { component } = setup({
      socketService,
      sessionService,
      navigationState: {
        joinShip: { id: 's-3', name: '  ' },
      },
    });

    expect(component['getShipDisplayName']()).toBe('s-3');
  });

  it('should return empty display name when no ship is selected', () => {
    const { component } = setup({ socketService, sessionService });

    expect(component['getShipDisplayName']()).toBe('');
  });

  it('should navigate to character-profile with player and character state', () => {
    const character = { id: 'c-1', characterName: 'Nova' };
    const { component, mockRouter } = setup({
      socketService,
      sessionService,
      navigationState: {
        playerName: 'Pioneer',
        joinCharacter: character,
      },
    });

    component.navigateToCharacterProfile();

    expect(mockRouter.navigate).toHaveBeenCalledWith([{ outlets: { left: ['character-profile'] } }], {
      preserveFragment: true,
      state: {
        playerName: 'Pioneer',
        joinCharacter: character,
      },
    });
  });

  it('builds synthetic subsystem itemType from label when subsystem code is empty', () => {
    const { component } = setup({
      socketService,
      sessionService,
      navigationState: {
        playerName: 'Pioneer',
        joinCharacter: { id: 'c-1', characterName: 'Nova' },
        joinShip: {
          id: 's-1',
          name: 'Scavenger I',
          inventory: [],
          damageProfile: {
            overallStatus: 'damaged',
            summary: 'Damaged systems',
            origin: 'cold-boot-scripted',
            updatedAt: '2026-05-17T00:00:00.000Z',
            systems: [
              {
                code: '   ',
                label: 'Power Distribution Bus',
                severity: 'major',
                summary: 'Load balancing unstable',
                repairPriority: 1,
              },
            ],
          },
        },
      },
    });

    const groups = component['inventoryGroups']() as InventoryGroup[];
    const synthetic = groups.find((group) => group.name === 'Power Distribution Bus');
    expect(synthetic?.itemType).toBe('power-distribution-bus');
  });

  it('does not call upsertItem when ship context or session is missing', () => {
    const noSession = createMockSessionService(null);
    const { component } = setup({
      socketService,
      sessionService: noSession,
      navigationState: {
        playerName: 'Pioneer',
        joinCharacter: { id: 'c-1', characterName: 'Nova' },
      },
    });
    const upsertSpy = jasmine.createSpy('upsertItem');
    (socketService as unknown as { upsertItem: jasmine.Spy }).upsertItem = upsertSpy;

    component.addDroneToInventory();

    expect(upsertSpy).not.toHaveBeenCalled();
  });

  it('adds drone item into ship inventory on successful upsert', () => {
    const { component } = setup({
      socketService,
      sessionService,
      navigationState: {
        playerName: 'Pioneer',
        joinCharacter: { id: 'c-1', characterName: 'Nova' },
        joinShip: { id: 's-1', name: 'Scavenger I', inventory: [] },
      },
    });

    (socketService as unknown as { upsertItem: jasmine.Spy }).upsertItem = jasmine
      .createSpy('upsertItem')
      .and.callFake((_request: any, cb: (response: any) => void) => {
        cb({
          success: true,
          item: {
            id: 'drone-1',
            itemType: 'expendable-dart-drone',
            displayName: 'Expendable Dart Drone',
            state: 'contained',
            damageStatus: 'intact',
          },
        });
      });

    component.addDroneToInventory();

    expect(component['joinShip']()?.inventory?.some((item: any) => item.id === 'drone-1')).toBeTrue();
  });

  it('does not mutate inventory when drone upsert fails', () => {
    const { component } = setup({
      socketService,
      sessionService,
      navigationState: {
        playerName: 'Pioneer',
        joinCharacter: { id: 'c-1', characterName: 'Nova' },
        joinShip: { id: 's-1', name: 'Scavenger I', inventory: [] },
      },
    });

    (socketService as unknown as { upsertItem: jasmine.Spy }).upsertItem = jasmine
      .createSpy('upsertItem')
      .and.callFake((_request: any, cb: (response: any) => void) => {
        cb({ success: false, message: 'upsert failed' });
      });

    component.addDroneToInventory();

    expect(component['joinShip']()?.inventory?.length ?? 0).toBe(0);
  });

  it('does not request ship refresh when required context is missing', () => {
    const { component, mockShipService } = setup({
      socketService,
      sessionService,
      navigationState: {
        playerName: '',
        joinCharacter: { id: 'c-1', characterName: 'Nova' },
        joinShip: { id: 's-1', name: 'Scavenger I', inventory: [] },
      },
    });
    mockShipService.listShips.calls.reset();

    component['refreshShipFromServer']();

    expect(mockShipService.listShips).not.toHaveBeenCalled();
  });

  it('does not replace ship when refresh response has no matching ship', () => {
    const { component, mockShipService } = setup({
      socketService,
      sessionService,
      navigationState: {
        playerName: 'Pioneer',
        joinCharacter: { id: 'c-1', characterName: 'Nova' },
        joinShip: { id: 's-1', name: 'Scavenger I', inventory: [] },
      },
    });
    mockShipService.listShips.calls.reset();
    mockShipService.listShips.and.callFake((_request: any, cb: (response: any) => void) => {
      cb({ success: true, ships: [{ id: 'different-ship', name: 'Other', model: 'X', tier: 1, spatial: null }] });
    });

    component['refreshShipFromServer']();

    expect(component['joinShip']()?.id).toBe('s-1');
    expect(component['joinShip']()?.name).toBe('Scavenger I');
  });

  it('normalizes and replaces joinShip from a successful refresh match', () => {
    const { component, mockShipService } = setup({
      socketService,
      sessionService,
      navigationState: {
        playerName: 'Pioneer',
        joinCharacter: { id: 'c-1', characterName: 'Nova' },
        joinShip: { id: 's-1', name: 'Scavenger I', inventory: [] },
      },
    });
    mockShipService.listShips.calls.reset();
    mockShipService.listShips.and.callFake((_request: any, cb: (response: any) => void) => {
      cb({
        success: true,
        ships: [
          {
            id: 's-1',
            name: 'Scavenger II',
            status: ' ACTIVE ',
            modelName: '  ',
            tierLevel: 99,
            inventory: [{ id: 'iron-1', itemType: 'iron', displayName: 'Iron' }],
            spatial: null,
          },
        ],
      });
    });

    component['refreshShipFromServer']();

    expect(component['joinShip']()?.name).toBe('Scavenger II');
    expect(component['joinShip']()?.status).toBe('ACTIVE');
    expect(component['joinShip']()?.model).toBe('Scavenger Pod');
    expect(component['joinShip']()?.tier).toBe(1);
    expect(component['joinShip']()?.inventory?.length).toBe(1);
    expect(component['joinShip']()?.inventory?.[0].itemType).toBe('iron');
  });

  describe('DOM smoke tests', () => {
    it('should render without error', () => {
      const { fixture } = setup({
        socketService,
        sessionService,
        navigationState: {
          playerName: 'Pioneer',
          joinCharacter: { id: 'c-1', characterName: 'Nova' },
          joinShip: { id: 's-1', name: 'Scavenger I', inventory: [makeItem()] },
        },
      });
      fixture.detectChanges();
      expect(fixture.nativeElement).toBeTruthy();
    });
  });
});
