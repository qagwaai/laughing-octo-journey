import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { createMockSessionService, createMockSocketService, type MockSocketService } from '../../../testing';
import { ITEM_UPSERT_REQUEST_EVENT, ITEM_UPSERT_RESPONSE_EVENT } from '../../model/item-upsert';
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
  upsertItem(request: any, cb?: (r: any) => void): void;
};

function createSocketWithUpsert(): MockSocketWithUpsert {
  const base = createMockSocketService();
  return Object.assign(base, {
    upsertItem(request: any, cb?: (r: any) => void) {
      if (cb) {
        base.once(ITEM_UPSERT_RESPONSE_EVENT, cb);
      }
      base.emit(ITEM_UPSERT_REQUEST_EVENT, request);
    },
  });
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
  it('should be true when selected item is damaged', () => {
    const { component } = setup({
      joinShip: { id: 's-1', inventory: [{ id: 'i-1', itemType: 'iron', damageStatus: 'damaged' }] },
      asset: { key: 'inventory-item:i-1', kind: 'inventory-item', itemId: 'i-1' },
    });
    expect(component['canFullyRepair']()).toBe(true);
  });

  it('should be false when selected item is intact', () => {
    const { component } = setup({
      joinShip: { id: 's-1', inventory: [{ id: 'i-1', itemType: 'iron', damageStatus: 'intact' }] },
      asset: { key: 'inventory-item:i-1', kind: 'inventory-item', itemId: 'i-1' },
    });
    expect(component['canFullyRepair']()).toBe(false);
  });

  it('should be true when selected item is critical', () => {
    const { component } = setup({
      joinShip: { id: 's-1', inventory: [{ id: 'i-1', itemType: 'iron', damageStatus: 'critical' }] },
      asset: { key: 'inventory-item:i-1', kind: 'inventory-item', itemId: 'i-1' },
    });
    expect(component['canFullyRepair']()).toBe(true);
  });

  it('should be true when no item is selected (undefined damageStatus !== "intact")', () => {
    // When selectedItem() returns null, null?.damageStatus is undefined, and undefined !== 'intact' is true.
    // This mirrors the actual computed in the component, and the template guards the repair button separately.
    const { component } = setup();
    expect(component['canFullyRepair']()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests: fullyRepairItem guard
// ---------------------------------------------------------------------------

describe('RepairRetrofitItemDetailPage - fullyRepairItem guard', () => {
  it('should allow repair when all context is present', () => {
    const { component } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: 'c-1' },
      joinShip: { id: 's-1', inventory: [{ id: 'i-1', itemType: 'iron', damageStatus: 'damaged' }] },
      asset: { key: 'inventory-item:i-1', kind: 'inventory-item', itemId: 'i-1' },
    });
    // With all context, fullyRepairItem() proceeds to socket call without setting persistError
    component['fullyRepairItem']();
    expect(component['persistError']()).toBeNull();
  });

  it('should report error when no item is selected', () => {
    const { component } = setup({
      playerName: 'Pioneer',
      joinShip: { id: 's-1', inventory: [] },
    });
    component['fullyRepairItem']();
    expect(component['persistError']()).not.toBeNull();
  });

  it('should report error when sessionKey is empty', () => {
    const { component, mockSession } = setup({
      playerName: 'Pioneer',
      joinShip: { id: 's-1', inventory: [{ id: 'i-1', itemType: 'iron', damageStatus: 'damaged' }] },
      asset: { key: 'inventory-item:i-1', kind: 'inventory-item', itemId: 'i-1' },
    });
    mockSession.setSessionKey('');
    component['fullyRepairItem']();
    expect(component['persistError']()).not.toBeNull();
  });

  it('should report error when sessionKey is only whitespace', () => {
    const { component, mockSession } = setup({
      playerName: 'Pioneer',
      joinShip: { id: 's-1', inventory: [{ id: 'i-1', itemType: 'iron', damageStatus: 'damaged' }] },
      asset: { key: 'inventory-item:i-1', kind: 'inventory-item', itemId: 'i-1' },
    });
    mockSession.setSessionKey('   ');
    component['fullyRepairItem']();
    expect(component['persistError']()).not.toBeNull();
  });

  it('should report error when playerName is empty', () => {
    const { component } = setup({
      playerName: '',
      joinShip: { id: 's-1', inventory: [{ id: 'i-1', itemType: 'iron', damageStatus: 'damaged' }] },
      asset: { key: 'inventory-item:i-1', kind: 'inventory-item', itemId: 'i-1' },
    });
    component['fullyRepairItem']();
    expect(component['persistError']()).not.toBeNull();
  });
});
