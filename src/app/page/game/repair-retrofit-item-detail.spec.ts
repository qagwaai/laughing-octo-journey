import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { createMockSessionService, createMockSocketService, type MockSocketService } from '../../../testing';
import { SessionService } from '../../services/session.service';
import { SocketService } from '../../services/socket.service';
import RepairRetrofitItemDetailPage from './repair-retrofit-item-detail';

interface NavigationState {
  playerName?: string;
  joinCharacter?: { id: string } | null;
  joinShip?: any;
  asset?: any;
}

type MockSocketWithUpsert = MockSocketService & {
  upsertItem?: (request: any, cb?: (r: any) => void) => void;
};

function createSocketWithUpsert(): MockSocketWithUpsert {
  return createMockSocketService() as MockSocketWithUpsert;
}

function setup(state?: NavigationState) {
  const mockRouter = {
    getCurrentNavigation: () => (state ? { extras: { state } } : null),
    navigate: jasmine.createSpy('navigate'),
  };
  const mockSocket = createSocketWithUpsert();
  const mockSession = createMockSessionService('session-key');

  TestBed.configureTestingModule({
    imports: [RepairRetrofitItemDetailPage],
    providers: [
      { provide: Router, useValue: mockRouter },
      { provide: SocketService, useValue: mockSocket },
      { provide: SessionService, useValue: mockSession },
    ],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
  });

  const fixture = TestBed.createComponent(RepairRetrofitItemDetailPage);
  fixture.detectChanges();
  return { component: fixture.componentInstance, fixture, mockRouter, mockSocket, mockSession };
}

// ---------------------------------------------------------------------------
// Tests: Initialization
// ---------------------------------------------------------------------------

describe('RepairRetrofitItemDetailPage - initialization', () => {
  it('should initialize signals from navigation state', () => {
    const { component } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: 'c-1' },
      joinShip: { id: 's-1', inventory: [{ id: 'i-1', itemType: 'iron', damageStatus: 'damaged' }] },
      asset: { key: 'inventory-item:i-1', kind: 'inventory-item', itemId: 'i-1' },
    });

    expect(component['playerName']()).toBe('Pioneer');
    expect(component['joinCharacter']()?.id).toBe('c-1');
    expect(component['joinShip']()?.id).toBe('s-1');
    expect(component['selectedAsset']()?.itemId).toBe('i-1');
  });

  it('should fall back to empty values when state is absent', () => {
    const { component } = setup();

    expect(component['playerName']()).toBe('');
    expect(component['joinCharacter']()).toBeNull();
    expect(component['joinShip']()).toBeNull();
    expect(component['selectedAsset']()).toBeNull();
  });

  describe('DOM smoke tests', () => {
    it('should render without error', () => {
      const { fixture } = setup({
        playerName: 'Pioneer',
        joinCharacter: { id: 'c-1' },
      });
      expect(fixture.nativeElement).toBeTruthy();
    });
  });
});

// ---------------------------------------------------------------------------
// Tests: selectedItem computed
// ---------------------------------------------------------------------------

describe('RepairRetrofitItemDetailPage - selectedItem', () => {
  it('should return null when no asset is selected', () => {
    const { component } = setup({
      joinShip: { id: 's-1', inventory: [{ id: 'i-1', itemType: 'iron' }] },
    });
    expect(component['selectedItem']()).toBeNull();
  });

  it('should return null when asset has no itemId', () => {
    const { component } = setup({
      joinShip: { id: 's-1', inventory: [{ id: 'i-1', itemType: 'iron' }] },
      asset: { key: 'ship:s-1', kind: 'ship' },
    });
    expect(component['selectedItem']()).toBeNull();
  });

  it('should return null when itemId does not match any inventory item', () => {
    const { component } = setup({
      joinShip: { id: 's-1', inventory: [{ id: 'i-1', itemType: 'iron' }] },
      asset: { key: 'inventory-item:i-999', kind: 'inventory-item', itemId: 'i-999' },
    });
    expect(component['selectedItem']()).toBeNull();
  });

  it('should return the matching inventory item by itemId', () => {
    const { component } = setup({
      joinShip: {
        id: 's-1',
        inventory: [
          { id: 'i-1', itemType: 'iron', damageStatus: 'intact' },
          { id: 'i-2', itemType: 'conduit', damageStatus: 'damaged' },
        ],
      },
      asset: { key: 'inventory-item:i-2', kind: 'inventory-item', itemId: 'i-2' },
    });
    const item = component['selectedItem']();
    expect(item?.id).toBe('i-2');
    expect(item?.itemType).toBe('conduit');
    expect(item?.damageStatus).toBe('damaged');
  });
});

// ---------------------------------------------------------------------------
// Tests: canFullyRepair
// ---------------------------------------------------------------------------

describe('RepairRetrofitItemDetailPage - canFullyRepair', () => {
  it('should be false when selected item is damaged (mission-locked)', () => {
    const { component } = setup({
      joinShip: { id: 's-1', inventory: [{ id: 'i-1', itemType: 'iron', damageStatus: 'damaged' }] },
      asset: { key: 'inventory-item:i-1', kind: 'inventory-item', itemId: 'i-1' },
    });
    expect(component['canFullyRepair']()).toBe(false);
  });

  it('should be false when selected item is intact', () => {
    const { component } = setup({
      joinShip: { id: 's-1', inventory: [{ id: 'i-1', itemType: 'iron', damageStatus: 'intact' }] },
      asset: { key: 'inventory-item:i-1', kind: 'inventory-item', itemId: 'i-1' },
    });
    expect(component['canFullyRepair']()).toBe(false);
  });

  it('should be false when selected item is critical (mission-locked)', () => {
    const { component } = setup({
      joinShip: { id: 's-1', inventory: [{ id: 'i-1', itemType: 'iron', damageStatus: 'critical' }] },
      asset: { key: 'inventory-item:i-1', kind: 'inventory-item', itemId: 'i-1' },
    });
    expect(component['canFullyRepair']()).toBe(false);
  });

  it('should be false when no item is selected', () => {
    const { component } = setup();
    expect(component['canFullyRepair']()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests: fullyRepairItem guard
// ---------------------------------------------------------------------------

describe('RepairRetrofitItemDetailPage - fullyRepairItem guard', () => {
  it('should return mission-lock blocked message when invoked', () => {
    const { component } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: 'c-1' },
      joinShip: { id: 's-1', inventory: [{ id: 'i-1', itemType: 'iron', damageStatus: 'damaged' }] },
      asset: { key: 'inventory-item:i-1', kind: 'inventory-item', itemId: 'i-1' },
    });

    component['fullyRepairItem']();
    expect(component['persistError']()).toBe('Requires mission salvage parts not yet available');
  });

  it('should return the same mission-lock blocked message when no item is selected', () => {
    const { component } = setup({
      playerName: 'Pioneer',
      joinShip: { id: 's-1', inventory: [] },
    });
    component['fullyRepairItem']();
    expect(component['persistError']()).toBe('Requires mission salvage parts not yet available');
  });

  it('should return the same mission-lock blocked message when sessionKey is empty', () => {
    const { component, mockSession } = setup({
      playerName: 'Pioneer',
      joinShip: { id: 's-1', inventory: [{ id: 'i-1', itemType: 'iron', damageStatus: 'damaged' }] },
      asset: { key: 'inventory-item:i-1', kind: 'inventory-item', itemId: 'i-1' },
    });
    mockSession.setSessionKey('');
    component['fullyRepairItem']();
    expect(component['persistError']()).toBe('Requires mission salvage parts not yet available');
  });

  it('should return the same mission-lock blocked message when sessionKey is only whitespace', () => {
    const { component, mockSession } = setup({
      playerName: 'Pioneer',
      joinShip: { id: 's-1', inventory: [{ id: 'i-1', itemType: 'iron', damageStatus: 'damaged' }] },
      asset: { key: 'inventory-item:i-1', kind: 'inventory-item', itemId: 'i-1' },
    });
    mockSession.setSessionKey('   ');
    component['fullyRepairItem']();
    expect(component['persistError']()).toBe('Requires mission salvage parts not yet available');
  });

  it('should return the same mission-lock blocked message when playerName is empty', () => {
    const { component } = setup({
      playerName: '',
      joinShip: { id: 's-1', inventory: [{ id: 'i-1', itemType: 'iron', damageStatus: 'damaged' }] },
      asset: { key: 'inventory-item:i-1', kind: 'inventory-item', itemId: 'i-1' },
    });
    component['fullyRepairItem']();
    expect(component['persistError']()).toBe('Requires mission salvage parts not yet available');
  });
});
