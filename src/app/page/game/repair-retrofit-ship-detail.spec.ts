import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { createMockSessionService, createMockSocketService, type MockSocketService } from '../../../testing';
import { ITEM_UPSERT_REQUEST_EVENT, ITEM_UPSERT_RESPONSE_EVENT } from '../../model/item-upsert';
import { SHIP_UPSERT_REQUEST_EVENT, SHIP_UPSERT_RESPONSE_EVENT } from '../../model/ship-upsert';
import { MissionProgressSyncService } from '../../services/mission-progress-sync.service';
import { ConsumedItemShadowService } from '../../services/consumed-item-shadow.service';
import { SessionService } from '../../services/session.service';
import { ShipService } from '../../services/ship.service';
import { SocketLifecycleService } from '../../services/socket-lifecycle.service';
import { ShipExteriorMissionStateService } from '../../services/ship-exterior-mission-state.service';
import { SocketService } from '../../services/socket.service';
import RepairRetrofitShipDetailPage from './repair-retrofit-ship-detail';
import { describeSummaryForSystems } from './repair-retrofit-state';

interface NavigationState {
  playerName?: string;
  joinCharacter?: { id: string } | null;
  joinShip?: any;
  damageProfile?: any;
  missionId?: string;
}

type MockSocketWithUpsert = MockSocketService & {
  upsertShip(request: any, cb?: (r: any) => void): void;
  upsertItem(request: any, cb?: (r: any) => void): void;
};

function createSocketWithUpsert(): MockSocketWithUpsert {
  const base = createMockSocketService();
  return Object.assign(base, {
    upsertShip(request: any, cb?: (r: any) => void) {
      if (cb) {
        base.once(SHIP_UPSERT_RESPONSE_EVENT, cb);
      }
      base.emit(SHIP_UPSERT_REQUEST_EVENT, request);
    },
    upsertItem(request: any, cb?: (r: any) => void) {
      if (cb) {
        base.once(ITEM_UPSERT_RESPONSE_EVENT, cb);
      }
      base.emit(ITEM_UPSERT_REQUEST_EVENT, request);
    },
  });
}

const mockMissionProgressSyncService = {
  syncGateState: () => Promise.resolve('skipped' as const),
};

const mockMissionStateService = {
  lastSaved: { asReadonly: () => () => null },
  loadState: () => null,
  saveState: () => undefined,
};

function normalizeInventoryItem(item: any): any {
  if (!item || typeof item !== 'object') {
    return item;
  }

  if (item.itemType !== 'hull-patch-kit' && item.itemType !== 'iron') {
    return item;
  }

  if (item.state === 'destroyed' || item.damageStatus === 'destroyed') {
    return item;
  }

  return {
    ...item,
    state: item.state ?? 'contained',
    destroyedAt: item.destroyedAt ?? null,
    destroyedReason: item.destroyedReason ?? null,
  };
}

function setup(state?: NavigationState) {
  const normalizedState = state
    ? {
        ...state,
        joinShip: state.joinShip
          ? {
              ...state.joinShip,
              inventory: Array.isArray(state.joinShip.inventory)
                ? state.joinShip.inventory.map(normalizeInventoryItem)
                : state.joinShip.inventory,
            }
          : state.joinShip,
      }
    : state;

  const mockRouter = {
    getCurrentNavigation: () => (normalizedState ? { extras: { state: normalizedState } } : null),
    navigate: jasmine.createSpy('navigate'),
  };
  const mockSocket = createSocketWithUpsert();
  const mockSession = createMockSessionService('session-key');
  const mockSocketLifecycle = {
    ensureConnected: jasmine.createSpy('ensureConnected'),
  };
  const mockShipService = {
    listShips: jasmine.createSpy('listShips'),
  };
  const mockConsumedItemShadowService = {
    markConsumed: jasmine.createSpy('markConsumed'),
    filterInventory: jasmine.createSpy('filterInventory').and.callFake(
      (_playerName: string, _characterId: string, inventory: any[] | undefined) => [...(inventory ?? [])],
    ),
  };

  TestBed.configureTestingModule({
    imports: [RepairRetrofitShipDetailPage],
    providers: [
      { provide: Router, useValue: mockRouter },
      { provide: SocketService, useValue: mockSocket },
      { provide: SocketLifecycleService, useValue: mockSocketLifecycle },
      { provide: ShipService, useValue: mockShipService },
      { provide: ConsumedItemShadowService, useValue: mockConsumedItemShadowService },
      { provide: SessionService, useValue: mockSession },
      { provide: MissionProgressSyncService, useValue: mockMissionProgressSyncService },
      { provide: ShipExteriorMissionStateService, useValue: mockMissionStateService },
    ],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
  });

  const fixture = TestBed.createComponent(RepairRetrofitShipDetailPage);
  fixture.detectChanges();
  return {
    component: fixture.componentInstance,
    fixture,
    mockRouter,
    mockSocket,
    mockSession,
    mockSocketLifecycle,
    mockShipService,
    mockConsumedItemShadowService,
  };
}

const mockSpatial = { solarSystemId: 'sol', frame: 'barycentric' as const, positionKm: [0, 0, 0] as any, epochMs: 0 };

// ---------------------------------------------------------------------------
// Tests: Initialization
// ---------------------------------------------------------------------------

describe('RepairRetrofitShipDetailPage - initialization', () => {
  it('ensures socket connection on construction', () => {
    const { mockSocketLifecycle } = setup();
    expect(mockSocketLifecycle.ensureConnected).toHaveBeenCalled();
  });

  it('should initialize signals from navigation state', () => {
    const { component } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: 'c-1' },
      joinShip: { id: 's-1', model: 'Scavenger Pod' },
    });

    expect(component['playerName']()).toBe('Pioneer');
    expect(component['joinCharacter']()?.id).toBe('c-1');
    expect(component['joinShip']()?.id).toBe('s-1');
  });

  it('should fall back to default values when state is absent', () => {
    const { component } = setup();

    expect(component['playerName']()).toBe('');
    expect(component['joinCharacter']()).toBeNull();
    expect(component['joinShip']()).toBeNull();
    expect(component['damageProfile']()).toBeNull();
    expect(component['missionId']()).toBe('first-target');
  });

  it('creates a cold-boot damage profile when first-target mission is active and profile missing', () => {
    const { component } = setup({
      playerName: 'Pioneer',
      joinCharacter: {
        id: 'c-1',
        missions: [{ missionId: 'first-target', status: 'in-progress' }],
      } as any,
      joinShip: { id: 's-1', model: 'Scavenger Pod', status: 'intact' } as any,
    });

    expect(component['damageProfile']()).not.toBeNull();
    expect(component['damageProfile']()?.overallStatus).toBe('damaged');
  });

  it('creates a cold-boot damage profile when ship status is damaged and profile missing', () => {
    const { component } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: 'c-1' },
      joinShip: { id: 's-1', model: 'Scavenger Pod', status: 'damaged' } as any,
    });

    expect(component['damageProfile']()).not.toBeNull();
    expect(component['damageProfile']()?.overallStatus).toBe('damaged');
  });

  describe('DOM smoke tests', () => {
    it('should render without error', () => {
      const { fixture } = setup({
        playerName: 'Pioneer',
        joinCharacter: { id: 'c-1' },
        joinShip: { id: 's-1', model: 'Scavenger Pod' },
      });
      expect(fixture.nativeElement).toBeTruthy();
    });
  });
});

// ---------------------------------------------------------------------------
// Tests: hasHullPatchKit
// ---------------------------------------------------------------------------

describe('RepairRetrofitShipDetailPage - hasHullPatchKit', () => {
  it('should be false when inventory is empty', () => {
    const { component } = setup({
      joinShip: { id: 's-1', model: 'Scavenger Pod', inventory: [] } as any,
    });
    expect(component['hasHullPatchKit']()).toBe(false);
  });

  it('should be true when hull-patch-kit is in inventory', () => {
    const { component } = setup({
      joinShip: {
        id: 's-1',
        model: 'Scavenger Pod',
        inventory: [{ id: 'kit-1', itemType: 'hull-patch-kit', displayName: 'Hull Patch Kit', state: 'contained' }],
      } as any,
    });
    expect(component['hasHullPatchKit']()).toBe(true);
  });

  it('should be false when inventory has other items but no hull patch kit', () => {
    const { component } = setup({
      joinShip: {
        id: 's-1',
        model: 'Scavenger Pod',
        inventory: [{ id: 'iron-1', itemType: 'iron', displayName: 'Iron' }],
      } as any,
    });
    expect(component['hasHullPatchKit']()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests: canFullyRepair
// ---------------------------------------------------------------------------

describe('RepairRetrofitShipDetailPage - canFullyRepair', () => {
  it('should be false when damage profile is null', () => {
    const { component } = setup({
      joinShip: {
        id: 's-1',
        model: 'Scavenger Pod',
        inventory: [{ id: 'kit-1', itemType: 'hull-patch-kit', state: 'contained' }],
      } as any,
    });
    expect(component['canFullyRepair']()).toBe(false);
  });

  it('should be false when ship is intact even with hull patch kit', () => {
    const { component } = setup({
      joinShip: {
        id: 's-1',
        model: 'Scavenger Pod',
        inventory: [{ id: 'kit-1', itemType: 'hull-patch-kit', state: 'contained' }],
      } as any,
      damageProfile: {
        overallStatus: 'intact',
        summary: 'Nominal.',
        systems: [],
        origin: 'unknown',
        updatedAt: '',
      } as any,
    });
    expect(component['canFullyRepair']()).toBe(false);
  });

  it('should be false when ship is damaged but hull patch kit is missing', () => {
    const { component } = setup({
      joinShip: { id: 's-1', model: 'Scavenger Pod', inventory: [] } as any,
      damageProfile: {
        overallStatus: 'damaged',
        summary: 'Breach.',
        systems: [],
        origin: 'unknown',
        updatedAt: '',
      } as any,
    });
    expect(component['canFullyRepair']()).toBe(false);
  });

  it('should be true when ship is damaged and hull patch kit is present', () => {
    const { component } = setup({
      joinShip: {
        id: 's-1',
        model: 'Scavenger Pod',
        inventory: [{ id: 'kit-1', itemType: 'hull-patch-kit' }],
      } as any,
      damageProfile: {
        overallStatus: 'damaged',
        summary: 'Breach.',
        systems: [],
        origin: 'unknown',
        updatedAt: '',
      } as any,
    });
    expect(component['canFullyRepair']()).toBe(true);
  });

  it('should be true when ship is disabled and hull patch kit is present', () => {
    const { component } = setup({
      joinShip: {
        id: 's-1',
        model: 'Scavenger Pod',
        inventory: [{ id: 'kit-1', itemType: 'hull-patch-kit' }],
      } as any,
      damageProfile: {
        overallStatus: 'disabled',
        summary: 'Total failure.',
        systems: [],
        origin: 'unknown',
        updatedAt: '',
      } as any,
    });
    expect(component['canFullyRepair']()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests: getShipName
// ---------------------------------------------------------------------------

describe('RepairRetrofitShipDetailPage - getShipName', () => {
  it('should prefer name over model and id', () => {
    const { component } = setup({
      joinShip: { id: 's-1', name: 'The Iron Nomad', model: 'Scavenger Pod' } as any,
    });
    expect(component['getShipName']()).toBe('The Iron Nomad');
  });

  it('should fall back to model when name is absent', () => {
    const { component } = setup({
      joinShip: { id: 's-1', name: '', model: 'Scavenger Pod' } as any,
    });
    expect(component['getShipName']()).toBe('Scavenger Pod');
  });

  it('should fall back to id when name and model are absent', () => {
    const { component } = setup({
      joinShip: { id: 's-1', name: '', model: '' } as any,
    });
    expect(component['getShipName']()).toBe('s-1');
  });

  it('should return "Ship" when no ship context is set', () => {
    const { component } = setup();
    expect(component['getShipName']()).toBe('Ship');
  });
});

// ---------------------------------------------------------------------------
// Tests: fullyRepairShip guard conditions
// ---------------------------------------------------------------------------

describe('RepairRetrofitShipDetailPage - fullyRepairShip guard', () => {
  it('should report error when damage profile is missing', () => {
    const { component } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: 'c-1' },
      joinShip: { id: 's-1', model: 'Scavenger Pod' } as any,
    });
    component['fullyRepairShip']();
    expect(component['persistError']()).not.toBeNull();
  });

  it('should report error when ship id is missing', () => {
    const { component } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: 'c-1' },
      joinShip: { id: '', name: '', model: 'Scavenger Pod' } as any,
      damageProfile: {
        overallStatus: 'damaged',
        summary: 'Breach.',
        systems: [],
        origin: 'unknown',
        updatedAt: '',
      } as any,
    });
    component['fullyRepairShip']();
    expect(component['persistError']()).not.toBeNull();
  });

  it('should report error when characterId is missing', () => {
    const { component } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: '' },
      joinShip: { id: 's-1', model: 'Scavenger Pod' } as any,
      damageProfile: {
        overallStatus: 'damaged',
        summary: 'Breach.',
        systems: [],
        origin: 'unknown',
        updatedAt: '',
      } as any,
    });
    component['fullyRepairShip']();
    expect(component['persistError']()).not.toBeNull();
  });

  it('should report error when playerName is missing', () => {
    const { component } = setup({
      playerName: '',
      joinCharacter: { id: 'c-1' },
      joinShip: { id: 's-1', model: 'Scavenger Pod' } as any,
      damageProfile: {
        overallStatus: 'damaged',
        summary: 'Breach.',
        systems: [],
        origin: 'unknown',
        updatedAt: '',
      } as any,
    });
    component['fullyRepairShip']();
    expect(component['persistError']()).not.toBeNull();
  });

  it('should report error when sessionKey is missing', () => {
    const { component, mockSession } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: 'c-1' },
      joinShip: { id: 's-1', model: 'Scavenger Pod' } as any,
      damageProfile: {
        overallStatus: 'damaged',
        summary: 'Breach.',
        systems: [],
        origin: 'unknown',
        updatedAt: '',
      } as any,
    });
    mockSession.setSessionKey('');
    component['fullyRepairShip']();
    expect(component['persistError']()).not.toBeNull();
  });

  it('should allow repair when all context is present', () => {
    const { component } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: 'c-1' },
      joinShip: {
        id: 's-1',
        model: 'Scavenger Pod',
        spatial: mockSpatial,
        inventory: [{ id: 'kit-1', itemType: 'hull-patch-kit', state: 'contained' }],
      } as any,
      damageProfile: {
        overallStatus: 'damaged',
        summary: 'Breach.',
        systems: [],
        origin: 'unknown',
        updatedAt: '',
      } as any,
    });
    component['fullyRepairShip']();
    // No guard error — socket call was dispatched (persistError stays null until response)
    expect(component['persistError']()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests: buildRepairedProfile
// ---------------------------------------------------------------------------

describe('RepairRetrofitShipDetailPage - buildRepairedProfile', () => {
  it('should return null when there is no current damage profile', () => {
    const { component } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: 'c-1' },
      joinShip: { id: 's-1', model: 'Scavenger Pod', spatial: mockSpatial } as any,
      // no damageProfile provided
    });
    // With no damageProfile, fullyRepairShip sets persistError immediately
    component['fullyRepairShip']();
    expect(component['persistError']()).not.toBeNull();
    expect(component['damageProfile']()).toBeNull();
  });

  it('should produce an intact profile with no systems', () => {
    const { component, mockSocket } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: 'c-1' },
      joinShip: {
        id: 's-1',
        model: 'Scavenger Pod',
        spatial: mockSpatial,
        inventory: [{ id: 'kit-1', itemType: 'hull-patch-kit', state: 'contained' }],
      } as any,
      damageProfile: {
        overallStatus: 'damaged',
        summary: 'Breach.',
        systems: [{ code: 'nav', label: 'Navigation', severity: 'critical', summary: 'Failed.', repairPriority: 1 }],
        origin: 'unknown',
        updatedAt: '',
      } as any,
    });
    // Trigger the repair and simulate a successful socket response
    component['fullyRepairShip']();
    mockSocket.triggerOnceEvent(SHIP_UPSERT_RESPONSE_EVENT, { success: true });

    expect(component['damageProfile']()?.overallStatus).toBe('intact');
    expect(component['damageProfile']()?.systems.length).toBe(0);
    expect(component['damageProfile']()?.summary).toBe(describeSummaryForSystems([]));
  });
});

// ---------------------------------------------------------------------------
// Tests: fullyRepairShip - optimistic state updates
// ---------------------------------------------------------------------------

describe('RepairRetrofitShipDetailPage - fullyRepairShip optimistic updates', () => {
  it('sets persistError and clears persisting when ship-upsert fails', () => {
    const { component, mockSocket } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: 'c-1' },
      joinShip: {
        id: 's-1',
        model: 'Scavenger Pod',
        spatial: mockSpatial,
        inventory: [{ id: 'kit-1', itemType: 'hull-patch-kit', displayName: 'Hull Patch Kit', state: 'contained' }],
      } as any,
      damageProfile: {
        overallStatus: 'damaged',
        summary: 'Breach.',
        systems: [],
        origin: 'unknown',
        updatedAt: '',
      } as any,
    });

    component['fullyRepairShip']();
    mockSocket.triggerOnceEvent(SHIP_UPSERT_RESPONSE_EVENT, { success: false, message: 'ship write failed' });

    expect(component['persistError']()).toBe('ship write failed');
    expect(component['isPersisting']()).toBeFalse();
  });

  it('should remove kit from inventory immediately after ship-upsert success', () => {
    const { component, mockSocket } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: 'c-1' },
      joinShip: {
        id: 's-1',
        model: 'Scavenger Pod',
        spatial: mockSpatial,
        inventory: [
          { id: 'kit-1', itemType: 'hull-patch-kit', displayName: 'Hull Patch Kit', state: 'contained' },
          { id: 'iron-1', itemType: 'iron', displayName: 'Iron', state: 'contained' },
        ],
      } as any,
      damageProfile: {
        overallStatus: 'damaged',
        summary: 'Breach.',
        systems: [],
        origin: 'unknown',
        updatedAt: '',
      } as any,
    });

    component['fullyRepairShip']();
    mockSocket.triggerOnceEvent(SHIP_UPSERT_RESPONSE_EVENT, { success: true });

    const inventory = component['joinShip']()?.inventory ?? [];
    expect(inventory.some((item: any) => item.id === 'kit-1')).toBe(false);
    expect(inventory.some((item: any) => item.id === 'iron-1')).toBe(true);
  });

  it('should not remove kit from inventory before ship-upsert response arrives', () => {
    const { component } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: 'c-1' },
      joinShip: {
        id: 's-1',
        model: 'Scavenger Pod',
        spatial: mockSpatial,
        inventory: [{ id: 'kit-1', itemType: 'hull-patch-kit', displayName: 'Hull Patch Kit', state: 'contained' }],
      } as any,
      damageProfile: {
        overallStatus: 'damaged',
        summary: 'Breach.',
        systems: [],
        origin: 'unknown',
        updatedAt: '',
      } as any,
    });

    component['fullyRepairShip']();
    // Response not yet triggered — kit should still be present
    const inventory = component['joinShip']()?.inventory ?? [];
    expect(inventory.some((item: any) => item.id === 'kit-1')).toBe(true);
  });

  it('should set persistSuccess to kitConsumedLabel and clear isPersisting after ship-upsert success with kit', () => {
    const { component, mockSocket } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: 'c-1' },
      joinShip: {
        id: 's-1',
        model: 'Scavenger Pod',
        spatial: mockSpatial,
        inventory: [{ id: 'kit-1', itemType: 'hull-patch-kit', displayName: 'Hull Patch Kit', state: 'contained' }],
      } as any,
      damageProfile: {
        overallStatus: 'damaged',
        summary: 'Breach.',
        systems: [],
        origin: 'unknown',
        updatedAt: '',
      } as any,
    });

    component['fullyRepairShip']();
    mockSocket.triggerOnceEvent(SHIP_UPSERT_RESPONSE_EVENT, { success: true });

    expect(component['persistSuccess']()).toBe(component['t'].game.repairRetrofitShipDetail.kitConsumedLabel);
    expect(component['isPersisting']()).toBe(false);
  });

  it('should set persistError when ship-upsert is attempted without a hull patch kit', () => {
    const { component, mockSocket } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: 'c-1' },
      joinShip: {
        id: 's-1',
        model: 'Scavenger Pod',
        spatial: mockSpatial,
        inventory: [],
      } as any,
      damageProfile: {
        overallStatus: 'damaged',
        summary: 'Breach.',
        systems: [],
        origin: 'unknown',
        updatedAt: '',
      } as any,
    });

    component['fullyRepairShip']();
    expect(component['persistError']()).toBe(component['t'].game.repairRetrofitShipDetail.hullPatchKitRequiredLabel);
    expect(mockSocket.emittedEvents.find((event) => event.event === SHIP_UPSERT_REQUEST_EVENT)).toBeUndefined();

    expect(component['persistSuccess']()).toBeNull();
    expect(component['isPersisting']()).toBe(false);
  });

  it('should emit item-upsert request for kit destruction after ship-upsert success', () => {
    const { component, mockSocket } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: 'c-1' },
      joinShip: {
        id: 's-1',
        model: 'Scavenger Pod',
        spatial: mockSpatial,
        inventory: [{ id: 'kit-1', itemType: 'hull-patch-kit', displayName: 'Hull Patch Kit', state: 'contained' }],
      } as any,
      damageProfile: {
        overallStatus: 'damaged',
        summary: 'Breach.',
        systems: [],
        origin: 'unknown',
        updatedAt: '',
      } as any,
    });

    component['fullyRepairShip']();
    mockSocket.triggerOnceEvent(SHIP_UPSERT_RESPONSE_EVENT, { success: true });

    const itemUpsertEmit = mockSocket.emittedEvents.find((e) => e.event === ITEM_UPSERT_REQUEST_EVENT);
    expect(itemUpsertEmit).toBeDefined();
    expect(itemUpsertEmit?.data?.item?.id).toBe('kit-1');
    expect(itemUpsertEmit?.data?.item?.itemType).toBeUndefined();
    expect(itemUpsertEmit?.data?.item?.state).toBe('destroyed');
    expect(itemUpsertEmit?.data?.item?.damageStatus).toBe('destroyed');
    expect(itemUpsertEmit?.data?.item?.container).toBeNull();
    expect(itemUpsertEmit?.data?.item?.spatial).toBeNull();
  });

  it('should emit item-upsert request for kit destruction even when destroyed metadata is omitted', () => {
    const { component, mockSocket } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: 'c-1' },
      joinShip: {
        id: 's-1',
        model: 'Scavenger Pod',
        spatial: mockSpatial,
        inventory: [
          {
            id: 'kit-1',
            itemType: 'hull-patch-kit',
            displayName: 'Hull Patch Kit',
            state: 'contained',
            damageStatus: 'intact',
            container: { containerType: 'ship', containerId: 's-1' },
          },
        ],
      } as any,
      damageProfile: {
        overallStatus: 'damaged',
        summary: 'Breach.',
        systems: [],
        origin: 'unknown',
        updatedAt: '',
      } as any,
    });

    component['fullyRepairShip']();
    mockSocket.triggerOnceEvent(SHIP_UPSERT_RESPONSE_EVENT, { success: true });

    const itemUpsertEmit = mockSocket.emittedEvents.find((e) => e.event === ITEM_UPSERT_REQUEST_EVENT);
    expect(itemUpsertEmit).toBeDefined();
    expect(itemUpsertEmit?.data?.item?.id).toBe('kit-1');
  });

  it('refreshes ship snapshot after successful item-upsert and keeps kit removed', () => {
    const { component, mockSocket, mockShipService } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: 'c-1' },
      joinShip: {
        id: 's-1',
        model: 'Scavenger Pod',
        spatial: mockSpatial,
        inventory: [
          { id: 'kit-1', itemType: 'hull-patch-kit', displayName: 'Hull Patch Kit', state: 'contained' },
          { id: 'iron-1', itemType: 'iron', displayName: 'Iron', state: 'contained' },
        ],
      } as any,
      damageProfile: {
        overallStatus: 'damaged',
        summary: 'Breach.',
        systems: [],
        origin: 'unknown',
        updatedAt: '',
      } as any,
    });

    mockShipService.listShips.and.callFake((_request: any, cb: (response: any) => void) => {
      cb({
        success: true,
        ships: [
          {
            id: 's-1',
            model: 'Scavenger Pod',
            tier: 1,
            spatial: mockSpatial,
            inventory: [
              { id: 'kit-1', itemType: 'hull-patch-kit', displayName: 'Hull Patch Kit', state: 'contained' },
              { id: 'iron-1', itemType: 'iron', displayName: 'Iron', state: 'contained' },
            ],
            damageProfile: null,
          },
        ],
      });
    });

    component['fullyRepairShip']();
    mockSocket.triggerOnceEvent(SHIP_UPSERT_RESPONSE_EVENT, { success: true });
    mockSocket.triggerOnceEvent(ITEM_UPSERT_RESPONSE_EVENT, { success: true, item: { id: 'kit-1' } });

    const inventory = component['joinShip']()?.inventory ?? [];
    expect(inventory.some((item: any) => item.id === 'kit-1')).toBeFalse();
    expect(inventory.some((item: any) => item.id === 'iron-1')).toBeTrue();
    expect(component['damageProfile']()?.overallStatus).toBe('intact');
  });

  it('surfaces item-upsert failure but still attempts ship refresh', () => {
    const { component, mockSocket, mockShipService } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: 'c-1' },
      joinShip: {
        id: 's-1',
        model: 'Scavenger Pod',
        spatial: mockSpatial,
        inventory: [{ id: 'kit-1', itemType: 'hull-patch-kit', displayName: 'Hull Patch Kit', state: 'contained' }],
      } as any,
      damageProfile: {
        overallStatus: 'damaged',
        summary: 'Breach.',
        systems: [],
        origin: 'unknown',
        updatedAt: '',
      } as any,
    });

    mockShipService.listShips.and.callFake((_request: any, cb: (response: any) => void) => {
      cb({ success: false, ships: [] });
    });

    component['fullyRepairShip']();
    mockSocket.triggerOnceEvent(SHIP_UPSERT_RESPONSE_EVENT, { success: true });
    mockSocket.triggerOnceEvent(ITEM_UPSERT_RESPONSE_EVENT, { success: false, message: 'item write failed' });

    expect(component['persistError']()).toBe('item write failed');
    expect(mockShipService.listShips).toHaveBeenCalled();
  });

  it('does not replace ship when refresh response has no matching ship id', () => {
    const { component, mockSocket, mockShipService } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: 'c-1' },
      joinShip: {
        id: 's-1',
        name: 'Old Name',
        model: 'Scavenger Pod',
        spatial: mockSpatial,
        inventory: [{ id: 'kit-1', itemType: 'hull-patch-kit', displayName: 'Hull Patch Kit', state: 'contained' }],
      } as any,
      damageProfile: {
        overallStatus: 'damaged',
        summary: 'Breach.',
        systems: [],
        origin: 'unknown',
        updatedAt: '',
      } as any,
    });

    mockShipService.listShips.and.callFake((_request: any, cb: (response: any) => void) => {
      cb({
        success: true,
        ships: [{ id: 'other-ship', name: 'Other', model: 'Scavenger Pod', tier: 1, spatial: mockSpatial, inventory: [] }],
      });
    });

    component['fullyRepairShip']();
    mockSocket.triggerOnceEvent(SHIP_UPSERT_RESPONSE_EVENT, { success: true });
    mockSocket.triggerOnceEvent(ITEM_UPSERT_RESPONSE_EVENT, { success: true, item: { id: 'kit-1' } });

    expect(component['joinShip']()?.id).toBe('s-1');
    expect(component['joinShip']()?.name).toBe('Old Name');
  });

  it('should fail with hull patch required message and not emit item-upsert request when no kit is present', () => {
    const { component, mockSocket } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: 'c-1' },
      joinShip: {
        id: 's-1',
        model: 'Scavenger Pod',
        spatial: mockSpatial,
        inventory: [],
      } as any,
      damageProfile: {
        overallStatus: 'damaged',
        summary: 'Breach.',
        systems: [],
        origin: 'unknown',
        updatedAt: '',
      } as any,
    });

    component['fullyRepairShip']();

    const itemUpsertEmit = mockSocket.emittedEvents.find((e) => e.event === ITEM_UPSERT_REQUEST_EVENT);
    expect(itemUpsertEmit).toBeUndefined();
    expect(component['persistError']()).toBe(component['t'].game.repairRetrofitShipDetail.hullPatchKitRequiredLabel);
  });
});
