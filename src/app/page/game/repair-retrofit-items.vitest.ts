import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { createMockPrinterStateService, createMockSessionService, createMockSocketService } from '../../../testing';
import { SHIP_UPSERT_REQUEST_EVENT } from '../../model/ship-upsert';
import { DEFAULT_SHIP_MODEL } from '../../model/ship-list';
import { MissionProgressSyncService } from '../../services/mission-progress-sync.service';
import { PrinterStateService } from '../../services/printer-state.service';
import { ConsumedItemShadowService } from '../../services/consumed-item-shadow.service';
import { SessionService } from '../../services/session.service';
import { SocketLifecycleService } from '../../services/socket-lifecycle.service';
import { ShipExteriorMissionStateService } from '../../services/ship-exterior-mission-state.service';
import { SocketService } from '../../services/socket.service';
import RepairRetrofitItemsPage from './repair-retrofit-items';
import { type RepairAssetEntry, type RepairAssetFilter, type RepairAssetGrouping } from './repair-retrofit-state';

interface NavigationState {
  playerName?: string;
  joinCharacter?: { id: string; characterName?: string } | null;
  joinShip?: any;
  damageProfile?: any;
  selectedFilter?: RepairAssetFilter;
  selectedGrouping?: RepairAssetGrouping;
  searchQuery?: string;
  missionId?: string;
}

const mockMissionProgressSyncService = {
  syncGateState: () => Promise.resolve('skipped' as const),
};

const mockMissionStateService = {
  lastSaved: { asReadonly: () => () => null },
  loadState: () => null,
  saveState: () => undefined,
};

type MockSocketWithUpsert = ReturnType<typeof createMockSocketService> & {
  upsertShip(request: any, cb?: (r: any) => void): void;
  upsertItem(request: any, cb?: (r: any) => void): void;
};

function createSocketWithUpsert(): MockSocketWithUpsert {
  const base = createMockSocketService();
  return Object.assign(base, {
    upsertShip(request: any, cb?: (r: any) => void) {
      if (cb) {
        base.once('ship-upsert-response', cb);
      }
      base.emit(SHIP_UPSERT_REQUEST_EVENT, request);
    },
    upsertItem(request: any, cb?: (r: any) => void) {
      if (cb) {
        base.once('item-upsert-response', cb);
      }
      base.emit('item-upsert-request', request);
    },
  });
}

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
    navigate: vi.fn(),
  };
  const mockSocket = createSocketWithUpsert();
  const mockSession = createMockSessionService('test-session-key');
  const mockPrinter = createMockPrinterStateService();
  const loadQueueSpy = vi.spyOn(mockPrinter, 'loadQueue');
  const mockSocketLifecycle = {
    runWhenConnected: vi.fn().mockImplementation((action: () => void) => action()),
  };
  const mockConsumedItemShadowService = {
    markConsumed: vi.fn(),
    filterInventory: vi.fn().mockImplementation(
      (_playerName: string, _characterId: string, inventory: any[] | undefined) => [...(inventory ?? [])],
    ),
  };

  TestBed.configureTestingModule({
    imports: [RepairRetrofitItemsPage],
    providers: [
      { provide: Router, useValue: mockRouter },
      { provide: SocketService, useValue: mockSocket },
      { provide: SocketLifecycleService, useValue: mockSocketLifecycle },
      { provide: ConsumedItemShadowService, useValue: mockConsumedItemShadowService },
      { provide: SessionService, useValue: mockSession },
      { provide: PrinterStateService, useValue: mockPrinter },
      { provide: MissionProgressSyncService, useValue: mockMissionProgressSyncService },
      { provide: ShipExteriorMissionStateService, useValue: mockMissionStateService },
    ],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
  });

  const fixture = TestBed.createComponent(RepairRetrofitItemsPage);
  fixture.detectChanges();
  return {
    component: fixture.componentInstance,
    fixture,
    mockRouter,
    mockSocket,
    mockSession,
    mockPrinter,
    loadQueueSpy,
    mockSocketLifecycle,
    mockConsumedItemShadowService,
  };
}

describe('RepairRetrofitItemsPage - initialization', () => {
  it('loads printer queue on connected lifecycle when player and character are present', () => {
    const { loadQueueSpy } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: 'c-1', characterName: 'Nova' },
    });

    expect(loadQueueSpy).toHaveBeenCalledWith('Pioneer', 'c-1');
  });

  it('does not load printer queue when lifecycle runs without required context', () => {
    const { loadQueueSpy } = setup({
      playerName: ' ',
      joinCharacter: { id: '', characterName: 'Nova' },
    });

    expect(loadQueueSpy).not.toHaveBeenCalled();
  });

  it('should initialize signals from navigation state', () => {
    const { component } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: 'c-1', characterName: 'Nova' },
      selectedFilter: 'needs-repair',
      selectedGrouping: 'severity',
      searchQuery: 'hull',
      missionId: 'first-target',
    });

    expect(component['playerName']()).toBe('Pioneer');
    expect(component['joinCharacter']()).toEqual(expect.objectContaining({ id: 'c-1', characterName: 'Nova' }));
    expect(component['selectedFilter']()).toBe('needs-repair');
    expect(component['selectedGrouping']()).toBe('severity');
    expect(component['searchQuery']()).toBe('hull');
    expect(component['missionId']()).toBe('first-target');
  });

  it('should fall back to default values when navigation state is absent', () => {
    const { component } = setup();

    expect(component['playerName']()).toBe('');
    expect(component['joinCharacter']()).toBeNull();
    expect(component['joinShip']()).toBeNull();
    expect(component['damageProfile']()).toBeNull();
    expect(component['selectedFilter']()).toBe('all');
    expect(component['selectedGrouping']()).toBe('asset-type');
    expect(component['searchQuery']()).toBe('');
    expect(component['missionId']()).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Tests: allAssets computed
// ---------------------------------------------------------------------------

describe('RepairRetrofitItemsPage - allAssets', () => {
  it('should always produce at least one entry (ship placeholder) even with no ship', () => {
    const { component } = setup();
    const assets = component['allAssets']();

    expect(assets.length).toBe(1);
    expect(assets[0].kind).toBe('ship');
    expect(assets[0].label).toBe(DEFAULT_SHIP_MODEL);
    expect(assets[0].shipId).toBe('active');
    expect(assets[0].severity).toBe('intact');
  });

  it('should use ship model as label when ship has no name', () => {
    const { component } = setup({
      joinShip: { id: 's-1', name: '', model: 'Scavenger Pod' },
    });

    expect(component['allAssets']()[0].label).toBe('Scavenger Pod');
  });

  it('should use ship name over model as label', () => {
    const { component } = setup({
      joinShip: { id: 's-1', name: 'The Iron Nomad', model: 'Scavenger Pod' },
    });

    expect(component['allAssets']()[0].label).toBe('The Iron Nomad');
  });

  it('should reflect damage profile severity in ship entry', () => {
    const { component } = setup({
      joinShip: { id: 's-1', name: '', model: '' },
      damageProfile: {
        overallStatus: 'damaged',
        summary: 'Minor hull breach.',
        systems: [],
      },
    });

    expect(component['allAssets']()[0].severity).toBe('damaged');
    expect(component['allAssets']()[0].summary).toBe('Minor hull breach.');
  });

  it('should include ship-system entries sorted by repairPriority', () => {
    const { component } = setup({
      joinShip: { id: 's-1', name: '', model: '' },
      damageProfile: {
        overallStatus: 'damaged',
        summary: 'Two systems damaged.',
        systems: [
          { code: 'navigation', label: 'Navigation', severity: 'minor', summary: 'Off-course.', repairPriority: 3 },
          {
            code: 'propulsion',
            label: 'Propulsion',
            severity: 'critical',
            summary: 'Thrust failure.',
            repairPriority: 1,
          },
        ],
      },
    });

    const assets = component['allAssets']();
    const shipSystemEntries = assets.filter((a: RepairAssetEntry) => a.kind === 'ship-system');
    expect(shipSystemEntries.length).toBe(2);
    expect(shipSystemEntries[0].systemCode).toBe('propulsion');
    expect(shipSystemEntries[1].systemCode).toBe('navigation');
  });

  it('normalizes ship systems even when repairPriority is omitted in raw profile', () => {
    const { component } = setup({
      joinShip: { id: 's-1', name: '', model: '' },
      damageProfile: {
        overallStatus: 'damaged',
        summary: 'Systems damaged.',
        systems: [
          {
            code: 'nav',
            label: 'Navigation',
            severity: 'critical',
            summary: 'Failed.',
            repairPriority: 1,
          },
          {
            code: 'life-support',
            label: 'Life Support',
            severity: 'major',
            summary: 'Intermittent.',
          },
        ],
      },
    });

    const systemEntries = component['allAssets']().filter((a: RepairAssetEntry) => a.kind === 'ship-system');
    expect(systemEntries.map((entry: RepairAssetEntry) => entry.systemCode)).toContain('nav');
    expect(systemEntries.map((entry: RepairAssetEntry) => entry.systemCode)).toContain('life-support');
    expect(systemEntries.every((entry: RepairAssetEntry) => typeof entry.repairPriority === 'number')).toBe(true);
  });

  it('should include inventory-item entries for each inventory item', () => {
    const { component } = setup({
      joinShip: {
        id: 's-1',
        name: '',
        model: '',
        inventory: [
          {
            id: 'item-1',
            itemType: 'hull-patch-kit',
            displayName: 'Hull Patch Kit',
            damageStatus: 'intact',
            state: 'contained',
          },
          { id: 'item-2', itemType: 'iron', displayName: 'Iron', damageStatus: 'damaged', state: 'contained' },
        ],
      },
    });

    const itemEntries = component['allAssets']().filter((a: RepairAssetEntry) => a.kind === 'inventory-item');
    expect(itemEntries.length).toBe(2);
    expect(itemEntries.find((a: RepairAssetEntry) => a.itemId === 'item-1')?.severity).toBe('intact');
    expect(itemEntries.find((a: RepairAssetEntry) => a.itemId === 'item-2')?.severity).toBe('damaged');
  });

  it('should not duplicate subsystem entries when matching inventory subsystem items exist', () => {
    const { component } = setup({
      joinShip: {
        id: 's-1',
        name: '',
        model: '',
        inventory: [
          {
            id: 'sub-1',
            itemType: 'propulsion-manifold',
            displayName: 'Propulsion Manifold',
            damageStatus: 'damaged',
            state: 'contained',
          },
          {
            id: 'sub-2',
            itemType: 'sensor-array',
            displayName: 'Sensor Array',
            damageStatus: 'damaged',
            state: 'contained',
          },
          {
            id: 'sub-3',
            itemType: 'power-distribution-bus',
            displayName: 'Power Distribution Bus',
            damageStatus: 'damaged',
            state: 'contained',
          },
        ],
      },
      damageProfile: {
        overallStatus: 'damaged',
        summary: 'Core systems damaged.',
        systems: [
          {
            code: 'propulsion-manifold',
            label: 'Propulsion Manifold',
            severity: 'critical',
            summary: 'Main thrust line rupture.',
            repairPriority: 1,
          },
          {
            code: 'sensor-array',
            label: 'Sensor Array',
            severity: 'major',
            summary: 'Long-range scatter.',
            repairPriority: 2,
          },
          {
            code: 'power-distribution',
            label: 'Power Distribution Bus',
            severity: 'major',
            summary: 'Load balancing unstable.',
            repairPriority: 3,
          },
        ],
      },
    });

    const assets = component['allAssets']();
    const shipSystemEntries = assets.filter((a: RepairAssetEntry) => a.kind === 'ship-system');
    const inventoryEntries = assets.filter((a: RepairAssetEntry) => a.kind === 'inventory-item');

    expect(shipSystemEntries.length).toBe(3);
    expect(inventoryEntries.length).toBe(0);
  });

  it('should assign repairPriority 100 to inventory items', () => {
    const { component } = setup({
      joinShip: {
        id: 's-1',
        name: '',
        model: '',
        inventory: [{ id: 'i-1', itemType: 'iron', damageStatus: 'intact' }],
      },
    });

    const itemEntry = component['allAssets']().find((a: RepairAssetEntry) => a.kind === 'inventory-item');
    expect(itemEntry?.repairPriority).toBe(100);
  });

  it('should exclude destroyed inventory items from repair asset entries', () => {
    const { component } = setup({
      joinShip: {
        id: 's-1',
        name: '',
        model: '',
        inventory: [
          {
            id: 'kit-destroyed',
            itemType: 'hull-patch-kit',
            displayName: 'Hull Patch Kit',
            damageStatus: 'destroyed',
            state: 'destroyed',
          },
          {
            id: 'iron-1',
            itemType: 'iron',
            displayName: 'Iron',
            damageStatus: 'intact',
            state: 'contained',
          },
        ],
      },
    });

    const inventoryEntries = component['allAssets']().filter((a: RepairAssetEntry) => a.kind === 'inventory-item');
    expect(inventoryEntries.length).toBe(1);
    expect(inventoryEntries[0].itemId).toBe('iron-1');
  });
});

// ---------------------------------------------------------------------------
// Tests: filteredAssets
// ---------------------------------------------------------------------------

describe('RepairRetrofitItemsPage - filteredAssets', () => {
  const mixedState: NavigationState = {
    joinShip: {
      id: 's-1',
      name: '',
      model: '',
      inventory: [
        { id: 'item-intact', itemType: 'iron', damageStatus: 'intact' },
        { id: 'item-damaged', itemType: 'conduit', damageStatus: 'damaged' },
        { id: 'item-critical', itemType: 'fuse', damageStatus: 'critical' },
      ],
    },
    damageProfile: {
      overallStatus: 'damaged',
      summary: 'Minor breach.',
      systems: [{ code: 'nav', label: 'Navigation', severity: 'critical', summary: 'Failed.', repairPriority: 2 }],
    },
  };

  it('should return all assets when filter is "all"', () => {
    const { component } = setup(mixedState);
    component['setFilter']('all');
    expect(component['filteredAssets']().length).toBe(component['allAssets']().length);
  });

  it('should return only non-intact assets when filter is "needs-repair"', () => {
    const { component } = setup(mixedState);
    component['setFilter']('needs-repair');
    const filtered = component['filteredAssets']();
    expect(filtered.every((a: RepairAssetEntry) => a.severity !== 'intact')).toBe(true);
    expect(filtered.some((a: RepairAssetEntry) => a.severity === 'damaged' || a.severity === 'critical')).toBe(true);
  });

  it('should return only critical/disabled/destroyed assets when filter is "critical-only"', () => {
    const { component } = setup(mixedState);
    component['setFilter']('critical-only');
    const filtered = component['filteredAssets']();
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((a: RepairAssetEntry) => component['isCriticalSeverity'](a.severity))).toBe(true);
  });

  it('should return only intact assets when filter is "intact-only"', () => {
    const { component } = setup(mixedState);
    component['setFilter']('intact-only');
    const filtered = component['filteredAssets']();
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((a: RepairAssetEntry) => a.severity === 'intact')).toBe(true);
  });

  it('should filter by search query against label', () => {
    const { component } = setup(mixedState);
    component['setSearchQuery']('Navigation');
    const filtered = component['filteredAssets']();
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((a: RepairAssetEntry) => a.label.toLowerCase().includes('navigation'))).toBe(true);
  });

  it('should filter by search query against kind', () => {
    const { component } = setup(mixedState);
    component['setSearchQuery']('ship-system');
    const filtered = component['filteredAssets']();
    expect(filtered.every((a: RepairAssetEntry) => a.kind === 'ship-system')).toBe(true);
  });

  it('should return empty array when search query matches nothing', () => {
    const { component } = setup(mixedState);
    component['setSearchQuery']('zzznomatch');
    expect(component['filteredAssets']().length).toBe(0);
  });

  it('should combine filter and search query', () => {
    const { component } = setup(mixedState);
    component['setFilter']('needs-repair');
    component['setSearchQuery']('iron');
    // iron item is intact → excluded by needs-repair filter
    expect(component['filteredAssets']().filter((a: RepairAssetEntry) => a.itemId === 'item-intact').length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Tests: groupedAssets
// ---------------------------------------------------------------------------

describe('RepairRetrofitItemsPage - groupedAssets', () => {
  const systemsState: NavigationState = {
    joinShip: {
      id: 's-1',
      name: '',
      model: '',
      inventory: [{ id: 'item-1', itemType: 'iron', damageStatus: 'intact' }],
    },
    damageProfile: {
      overallStatus: 'damaged',
      summary: 'Breach.',
      systems: [{ code: 'nav', label: 'Navigation', severity: 'critical', summary: 'Failed.', repairPriority: 2 }],
    },
  };

  it('should group by asset type by default', () => {
    const { component } = setup(systemsState);
    const groups = component['groupedAssets']();
    const groupNames = groups.map((g: any) => g.group);
    expect(groupNames).toContain('Ships');
    expect(groupNames).toContain('Ship Systems');
    expect(groupNames).toContain('Inventory Items');
  });

  it('should group by severity label (uppercase)', () => {
    const { component } = setup(systemsState);
    component['setGrouping']('severity');
    const groups = component['groupedAssets']();
    const groupNames = groups.map((g: any) => g.group);
    expect(groupNames).toContain('DAMAGED');
    expect(groupNames).toContain('CRITICAL');
    expect(groupNames).toContain('INTACT');
  });

  it('should group by priority band', () => {
    const { component } = setup(systemsState);
    component['setGrouping']('priority-band');
    const groups = component['groupedAssets']();
    const groupNames = groups.map((g: any) => g.group);
    expect(groupNames).toContain('Priority 1');
    expect(groupNames).toContain('Priority 2-3');
    expect(groupNames).toContain('Priority 4+');
  });

  it('should sort groups alphabetically', () => {
    const { component } = setup(systemsState);
    const groups = component['groupedAssets']();
    const names = groups.map((g: any) => g.group);
    const sorted = [...names].sort((a: string, b: string) => a.localeCompare(b));
    expect(names).toEqual(sorted);
  });

  it('groups normalized assets by priority-band without errors', () => {
    const { component } = setup({
      joinShip: {
        id: 's-1',
        name: '',
        model: '',
      },
      damageProfile: {
        overallStatus: 'damaged',
        summary: 'Breach.',
        systems: [
          { code: 'nav', label: 'Navigation', severity: 'critical', summary: 'Failed.' },
        ],
      },
    });

    component['setGrouping']('priority-band');
    const groupNames = component['groupedAssets']().map((g: any) => g.group);
    expect(groupNames.length).toBeGreaterThan(0);
    expect(groupNames.every((name: string) => name.startsWith('Priority'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests: hasHullPatchKit / canQueueHullPatchKit
// ---------------------------------------------------------------------------

describe('RepairRetrofitItemsPage - hull patch kit state', () => {
  it('should report no hull patch kit when inventory is empty', () => {
    const { component } = setup({ joinShip: { id: 's-1', name: '', model: '', inventory: [] } });
    expect(component['hasHullPatchKit']()).toBe(false);
  });

  it('should report hull patch kit present when inventory contains it', () => {
    const { component } = setup({
      joinShip: {
        id: 's-1',
        name: '',
        model: '',
        inventory: [{ id: 'kit-1', itemType: 'hull-patch-kit', displayName: 'Hull Patch Kit', state: 'contained' }],
      },
    });
    expect(component['hasHullPatchKit']()).toBe(true);
  });

  it('should allow queuing hull patch kit when iron is in inventory and kit is absent', () => {
    const { component } = setup({
      joinShip: {
        id: 's-1',
        name: '',
        model: '',
        inventory: [{ id: 'iron-1', itemType: 'iron', displayName: 'Iron', state: 'contained' }],
      },
    });
    expect(component['canQueueHullPatchKit']()).toBe(true);
  });

  it('should not allow queuing when kit already present', () => {
    const { component } = setup({
      joinShip: {
        id: 's-1',
        name: '',
        model: '',
        inventory: [
          { id: 'iron-1', itemType: 'iron', displayName: 'Iron' },
          { id: 'kit-1', itemType: 'hull-patch-kit', displayName: 'Hull Patch Kit' },
        ],
      },
    });
    expect(component['canQueueHullPatchKit']()).toBe(false);
  });

  it('should not allow queuing when no compatible materials in inventory', () => {
    const { component } = setup({
      joinShip: {
        id: 's-1',
        name: '',
        model: '',
        inventory: [{ id: 'crystal-1', itemType: 'crystal', displayName: 'Crystal' }],
      },
    });
    expect(component['canQueueHullPatchKit']()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests: action helpers
// ---------------------------------------------------------------------------

describe('RepairRetrofitItemsPage - action helpers', () => {
  const shipEntry: RepairAssetEntry = {
    key: 'ship:s-1',
    kind: 'ship',
    label: 'Scavenger Pod',
    severity: 'damaged',
    summary: 'Breach.',
    repairPriority: 0,
    shipId: 's-1',
  };
  const intactEntry: RepairAssetEntry = {
    key: 'ship:s-2',
    kind: 'ship',
    label: 'Ship',
    severity: 'intact',
    summary: 'Nominal.',
    repairPriority: 0,
    shipId: 's-2',
  };
  const systemCritical: RepairAssetEntry = {
    key: 'ship-system:nav',
    kind: 'ship-system',
    label: 'Navigation',
    severity: 'critical',
    summary: 'Failed.',
    repairPriority: 2,
    shipId: 's-1',
  };
  const itemEntry: RepairAssetEntry = {
    key: 'inventory-item:i-1',
    kind: 'inventory-item',
    label: 'Iron',
    severity: 'damaged',
    summary: 'Damaged.',
    repairPriority: 100,
    shipId: 's-1',
    itemId: 'i-1',
  };

  it('should allow opening detail when severity is not intact', () => {
    const { component } = setup();
    expect(component['canOpenDetail'](shipEntry)).toBe(true);
    expect(component['canOpenDetail'](intactEntry)).toBe(false);
  });

  it('should allow repair only for damaged ship entry', () => {
    const { component } = setup();
    expect(component['canRepairAsset'](shipEntry)).toBe(true);
    expect(component['canRepairAsset'](systemCritical)).toBe(false);
    expect(component['canRepairAsset'](itemEntry)).toBe(false);
    expect(component['canRepairAsset'](intactEntry)).toBe(false);
  });

  it('should provide correct repair label by asset kind', () => {
    const { component } = setup();
    expect(component['getRepairLabel'](shipEntry)).toBe('Fully Repair Ship');
    expect(component['getRepairLabel'](systemCritical)).toBe('Fully Repair System');
    expect(component['getRepairLabel'](itemEntry)).toBe('Fully Repair Item');
  });

  it('should return no materials for intact assets', () => {
    const { component } = setup();
    expect(component['getRequiredMaterials'](intactEntry)).toBe('No materials required');
  });

  it('should return correct materials per asset kind', () => {
    const { component } = setup();
    expect(component['getRequiredMaterials'](shipEntry)).toContain('Hull patch kit');
    expect(component['getRequiredMaterials'](systemCritical)).toContain('Subsystem relay');
    expect(component['getRequiredMaterials'](itemEntry)).toContain('Spare casing');
  });

  it('should estimate 2h 30m for critical severity', () => {
    const { component } = setup();
    expect(component['getEstimatedWindow'](systemCritical)).toBe('2h 30m');
  });

  it('should estimate 1h 20m for major/damaged severity', () => {
    const { component } = setup();
    const major: RepairAssetEntry = { ...shipEntry, severity: 'major' };
    expect(component['getEstimatedWindow'](major)).toBe('1h 20m');
  });

  it('should estimate 35m for minor severity', () => {
    const { component } = setup();
    const minor: RepairAssetEntry = { ...shipEntry, severity: 'minor' };
    expect(component['getEstimatedWindow'](minor)).toBe('35m');
  });

  it('should estimate 0m for intact assets', () => {
    const { component } = setup();
    expect(component['getEstimatedWindow'](intactEntry)).toBe('0m');
  });

  it('should cost 980 CR for critical severity', () => {
    const { component } = setup();
    expect(component['getEstimatedCost'](systemCritical)).toBe('980 CR');
  });

  it('should cost 560 CR for damaged severity', () => {
    const { component } = setup();
    expect(component['getEstimatedCost'](shipEntry)).toBe('560 CR');
  });

  it('should cost 0 CR for intact assets', () => {
    const { component } = setup();
    expect(component['getEstimatedCost'](intactEntry)).toBe('0 CR');
  });

  it('should show "Ready" availability for damaged ship assets', () => {
    const { component } = setup();
    expect(component['getActionAvailability'](shipEntry)).toBe('Ready');
  });

  it('should show blocked availability for non-ship damaged assets', () => {
    const { component } = setup();
    expect(component['getActionAvailability'](systemCritical)).toBe('Blocked - pending mission content');
    expect(component['getActionAvailability'](itemEntry)).toBe('Blocked - pending mission content');
  });

  it('should show "No action needed" for intact assets', () => {
    const { component } = setup();
    expect(component['getActionAvailability'](intactEntry)).toBe('No action needed');
  });

  it('should show explicit blocked reason for non-ship damaged assets', () => {
    const { component } = setup();
    expect(component['getBlockedReason'](systemCritical)).toBe('Requires mission salvage parts not yet available');
    expect(component['getBlockedReason'](itemEntry)).toBe('Requires mission salvage parts not yet available');
  });

  it('should show dock-lock blocked reason for critical ship assets', () => {
    const { component } = setup();
    const criticalShip: RepairAssetEntry = { ...shipEntry, severity: 'critical' };
    expect(component['getBlockedReason'](criticalShip)).toBe('Dock lock and bay supervisor authorization required');
  });

  it('returns grouping label text for each grouping mode', () => {
    const { component } = setup();

    component['setGrouping']('asset-type');
    expect(component['getGroupingLabel']()).toBe('Asset Type');

    component['setGrouping']('severity');
    expect(component['getGroupingLabel']()).toBe('Severity');

    component['setGrouping']('priority-band');
    expect(component['getGroupingLabel']()).toBe('Priority');
  });

  it('should track the active repair key per asset', () => {
    const { component } = setup();
    expect(component['isRepairing'](shipEntry)).toBe(false);
    component['activeRepairKey'].set(shipEntry.key);
    expect(component['isRepairing'](shipEntry)).toBe(true);
    expect(component['isRepairing'](systemCritical)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests: setFilter / setGrouping / setSearchQuery
// ---------------------------------------------------------------------------

describe('RepairRetrofitItemsPage - filter / grouping / search controls', () => {
  it('should update filter via setFilter', () => {
    const { component } = setup();
    component['setFilter']('needs-repair');
    expect(component['selectedFilter']()).toBe('needs-repair');
  });

  it('should update grouping via setGrouping', () => {
    const { component } = setup();
    component['setGrouping']('priority-band');
    expect(component['selectedGrouping']()).toBe('priority-band');
  });

  it('should update search query via setSearchQuery', () => {
    const { component } = setup();
    component['setSearchQuery']('hull');
    expect(component['searchQuery']()).toBe('hull');
  });
});

describe('RepairRetrofitItemsPage - full ship repair emits inventory patch', () => {
  it('should send ship-upsert inventory without hull patch kit for full ship repair', () => {
    const shipAsset: RepairAssetEntry = {
      key: 'ship:s-1',
      kind: 'ship',
      label: 'Scavenger Pod',
      severity: 'damaged',
      summary: 'Breach.',
      repairPriority: 0,
      shipId: 's-1',
    };

    const { component, mockSocket } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: 'c-1', characterName: 'Nova' },
      joinShip: {
        id: 's-1',
        name: 'Scavenger Pod',
        model: 'Scavenger Pod',
        spatial: { solarSystemId: 'sol', frame: 'barycentric', positionKm: [0, 0, 0], epochMs: 0 },
        inventory: [
          { id: 'kit-1', itemType: 'hull-patch-kit', displayName: 'Hull Patch Kit', state: 'contained' },
          { id: 'iron-1', itemType: 'iron', displayName: 'Iron', state: 'contained' },
        ],
      },
      damageProfile: {
        overallStatus: 'damaged',
        summary: 'Breach.',
        systems: [],
      },
    });

    component['repairAsset'](shipAsset);

    const shipUpsertEmit = mockSocket.emittedEvents.find((event) => event.event === SHIP_UPSERT_REQUEST_EVENT);
    expect(shipUpsertEmit).toBeDefined();
    expect(shipUpsertEmit?.data?.ship?.inventory).toBeDefined();
    expect(shipUpsertEmit?.data?.ship?.inventory.map((item: any) => item.id)).toEqual(['iron-1']);
  });
});

describe('RepairRetrofitItemsPage - queue and detail routing branches', () => {
  it('queues hull patch kit when required consumables are available', () => {
    const { component, mockSocket, mockPrinter } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: 'c-1', characterName: 'Nova' },
      joinShip: {
        id: 's-1',
        name: 'Scavenger Pod',
        model: 'Scavenger Pod',
        spatial: { solarSystemId: 'sol', frame: 'barycentric', positionKm: [0, 0, 0], epochMs: 0 },
        inventory: [{ id: 'iron-1', itemType: 'iron', displayName: 'Iron', state: 'contained' }],
      },
    });
    const addSpy = vi.spyOn(mockPrinter, 'addToQueue');

    // Simulate successful consume-material upsert callback chain.
    (mockSocket as unknown as { upsertItem: ReturnType<typeof vi.fn> }).upsertItem = vi
      .fn()
      .mockImplementation((_request: any, cb?: (r: any) => void) => cb?.({ success: true }));

    component['queueForPrinting']();

    expect(addSpy).toHaveBeenCalled();
    expect(component['persistSuccess']()).toContain('sent to the 3D Fabricator');
  });

  it('shows consume error and stops queue flow when material consume fails', () => {
    const { component, mockSocket, mockPrinter } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: 'c-1', characterName: 'Nova' },
      joinShip: {
        id: 's-1',
        name: 'Scavenger Pod',
        model: 'Scavenger Pod',
        spatial: { solarSystemId: 'sol', frame: 'barycentric', positionKm: [0, 0, 0], epochMs: 0 },
        inventory: [{ id: 'iron-1', itemType: 'iron', displayName: 'Iron', state: 'contained' }],
      },
    });
    const addSpy = vi.spyOn(mockPrinter, 'addToQueue');

    (mockSocket as unknown as { upsertItem: ReturnType<typeof vi.fn> }).upsertItem = vi
      .fn()
      .mockImplementation((_request: any, cb?: (r: any) => void) => cb?.({ success: false, message: 'consume failed' }));

    component['queueForPrinting']();

    expect(addSpy).not.toHaveBeenCalled();
    expect(component['persistError']()).toContain('consume failed');
  });

  it('uses default consume error text when backend message is absent', () => {
    const { component, mockSocket, mockPrinter } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: 'c-1', characterName: 'Nova' },
      joinShip: {
        id: 's-1',
        name: 'Scavenger Pod',
        model: 'Scavenger Pod',
        spatial: { solarSystemId: 'sol', frame: 'barycentric', positionKm: [0, 0, 0], epochMs: 0 },
        inventory: [{ id: 'iron-1', itemType: 'iron', displayName: 'Iron', state: 'contained' }],
      },
    });
    const addSpy = vi.spyOn(mockPrinter, 'addToQueue');

    (mockSocket as unknown as { upsertItem: ReturnType<typeof vi.fn> }).upsertItem = vi
      .fn()
      .mockImplementation((_request: any, cb?: (r: any) => void) => cb?.({ success: false }));

    component['queueForPrinting']();

    expect(addSpy).not.toHaveBeenCalled();
    expect(component['persistError']()).toContain('Unable to consume');
  });

  it('uses requirement fallback text when no materials are missing', () => {
    const { component } = setup({
      joinShip: {
        id: 's-1',
        name: 'Scavenger Pod',
        model: 'Scavenger Pod',
        inventory: [{ id: 'iron-1', itemType: 'iron', displayName: 'Iron', state: 'contained' }],
      },
    });

    const message = component['getHullPatchKitRequirementMessage']();
    expect(message).toContain('required in ship inventory');
  });

  it('requires full queue context when character and session are missing', () => {
    const { component } = setup({
      playerName: 'Pioneer',
      joinCharacter: null,
      joinShip: {
        id: 's-1',
        name: 'Scavenger Pod',
        model: 'Scavenger Pod',
        inventory: [{ id: 'iron-1', itemType: 'iron', displayName: 'Iron', state: 'contained' }],
      },
    });

    component['queueForPrinting']();

    expect(component['persistError']()).toContain('required in ship inventory');
  });

  it('resolves hull patch kit by display name and nullable state', () => {
    const { component } = setup({
      joinShip: {
        id: 's-1',
        name: 'Scavenger Pod',
        model: 'Scavenger Pod',
        inventory: [
          {
            id: 'kit-display',
            itemType: null,
            displayName: 'Standard Hull Patch Kit Mk I',
            state: null,
            destroyedAt: null,
            destroyedReason: null,
          },
        ],
      },
    });

    const kit = component['resolveHullPatchKitItem'](component['joinShip']());
    expect(kit?.id).toBe('kit-display');
  });

  it('navigates to the expected detail routes by asset kind', () => {
    const { component, mockRouter } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: 'c-1', characterName: 'Nova' },
    });

    component['navigateToRepairDetail']({
      key: 'ship:s-1',
      kind: 'ship',
      label: 'Scavenger Pod',
      severity: 'damaged',
      summary: 'breach',
      shipId: 's-1',
    });
    component['navigateToRepairDetail']({
      key: 'ship-system:nav',
      kind: 'ship-system',
      label: 'Navigation',
      severity: 'critical',
      summary: 'down',
      shipId: 's-1',
      systemCode: 'nav',
    });
    component['navigateToRepairDetail']({
      key: 'inventory-item:i-1',
      kind: 'inventory-item',
      label: 'Iron',
      severity: 'damaged',
      summary: 'dent',
      shipId: 's-1',
      itemId: 'i-1',
    });

    const routes = mockRouter.navigate.mock.calls.map((args) => args[0][0].outlets.right[0]);
    expect(routes).toContain('repair-retrofit-ship-detail');
    expect(routes).toContain('repair-retrofit-system-detail');
    expect(routes).toContain('repair-retrofit-item-detail');
  });
});

describe('RepairRetrofitItemsPage - repair path edge cases', () => {
  it('does not attempt repair when asset is intact', () => {
    const { component, mockSocket } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: 'c-1', characterName: 'Nova' },
    });

    component['repairAsset']({
      key: 'ship:s-1',
      kind: 'ship',
      label: 'Scavenger Pod',
      severity: 'intact',
      summary: 'ok',
      shipId: 's-1',
    });

    expect(mockSocket.emittedEvents.length).toBe(0);
  });

  it('reports missing context when attempting system repair without profile', () => {
    const { component } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: 'c-1', characterName: 'Nova' },
      joinShip: null,
      damageProfile: null,
    });

    component['repairAsset']({
      key: 'ship-system:nav',
      kind: 'ship',
      label: 'Scavenger Pod',
      severity: 'damaged',
      summary: 'broken',
      shipId: 's-1',
      systemCode: 'nav',
    });

    expect(component['persistError']()).toContain('ship or session context');
  });

  it('handles inventory item repair success and updates item status', () => {
    const { component, mockSocket } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: 'c-1', characterName: 'Nova' },
      joinShip: {
        id: 's-1',
        name: 'Scavenger Pod',
        model: 'Scavenger Pod',
        spatial: { solarSystemId: 'sol', frame: 'barycentric', positionKm: [0, 0, 0], epochMs: 0 },
        inventory: [
          { id: 'item-1', itemType: 'iron', displayName: 'Iron', damageStatus: 'damaged', state: 'contained' },
        ],
      },
    });

    (mockSocket as unknown as { upsertItem: ReturnType<typeof vi.fn> }).upsertItem = vi
      .fn()
      .mockImplementation((_request: any, cb?: (r: any) => void) =>
        cb?.({
          success: true,
          item: {
            id: 'item-1',
            itemType: 'iron',
            displayName: 'Iron',
            damageStatus: 'intact',
            state: 'contained',
          },
        }),
      );

    component['repairInventoryAsset']({
      key: 'inventory-item:item-1',
      kind: 'inventory-item',
      label: 'Iron',
      severity: 'damaged',
      summary: 'dent',
      shipId: 's-1',
      itemId: 'item-1',
    });

    expect(component['joinShip']()?.inventory?.[0]?.damageStatus).toBe('intact');
    expect(component['persistSuccess']()).toContain('repaired');
  });

  it('sets ship repair persist error when upsert response fails', () => {
    const { component, mockSocket } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: 'c-1', characterName: 'Nova' },
      joinShip: {
        id: 's-1',
        name: 'Scavenger Pod',
        model: 'Scavenger Pod',
        spatial: { solarSystemId: 'sol', frame: 'barycentric', positionKm: [0, 0, 0], epochMs: 0 },
        inventory: [{ id: 'kit-1', itemType: 'hull-patch-kit', displayName: 'Hull Patch Kit', state: 'contained' }],
      },
      damageProfile: {
        overallStatus: 'damaged',
        summary: 'Breach.',
        systems: [],
      },
    });

    component['repairShipAsset']({
      key: 'ship:s-1',
      kind: 'ship',
      label: 'Scavenger Pod',
      severity: 'damaged',
      summary: 'Breach.',
      shipId: 's-1',
    });

    mockSocket.triggerOnceEvent('ship-upsert-response', { success: false, message: 'ship write failed' });

    expect(component['persistError']()).toBe('ship write failed');
    expect(component['activeRepairKey']()).toBeNull();
  });

  it('falls back to localized ship repair persist error when backend omits message', () => {
    const { component, mockSocket } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: 'c-1', characterName: 'Nova' },
      joinShip: {
        id: 's-1',
        name: 'Scavenger Pod',
        model: 'Scavenger Pod',
        spatial: { solarSystemId: 'sol', frame: 'barycentric', positionKm: [0, 0, 0], epochMs: 0 },
        inventory: [{ id: 'kit-1', itemType: 'hull-patch-kit', displayName: 'Hull Patch Kit', state: 'contained' }],
      },
      damageProfile: {
        overallStatus: 'damaged',
        summary: 'Breach.',
        systems: [],
      },
    });

    component['repairShipAsset']({
      key: 'ship:s-1',
      kind: 'ship',
      label: 'Scavenger Pod',
      severity: 'damaged',
      summary: 'Breach.',
      shipId: 's-1',
    });

    mockSocket.triggerOnceEvent('ship-upsert-response', { success: false });

    expect(component['persistError']()).toBe(component['t'].game.repairRetrofitItems.shipRepairPersistFailed);
  });

  it('sets item repair missing-context error when item lookup fails', () => {
    const { component } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: 'c-1', characterName: 'Nova' },
      joinShip: {
        id: 's-1',
        name: 'Scavenger Pod',
        model: 'Scavenger Pod',
        inventory: [],
      },
    });

    component['repairInventoryAsset']({
      key: 'inventory-item:item-404',
      kind: 'inventory-item',
      label: 'Unknown Item',
      severity: 'damaged',
      summary: 'missing',
      shipId: 's-1',
      itemId: 'item-404',
    });

    expect(component['persistError']()).toBe('Missing item or session context for repair operation.');
  });

  it('preserves unrelated inventory entries during successful item repair update', () => {
    const { component, mockSocket } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: 'c-1', characterName: 'Nova' },
      joinShip: {
        id: 's-1',
        name: 'Scavenger Pod',
        model: 'Scavenger Pod',
        spatial: { solarSystemId: 'sol', frame: 'barycentric', positionKm: [0, 0, 0], epochMs: 0 },
        inventory: [
          { id: 'item-1', itemType: 'iron', displayName: 'Iron', damageStatus: 'damaged', state: 'contained' },
          { id: 'item-2', itemType: 'copper', displayName: 'Copper', damageStatus: 'intact', state: 'contained' },
        ],
      },
    });

    (mockSocket as unknown as { upsertItem: ReturnType<typeof vi.fn> }).upsertItem = vi
      .fn()
      .mockImplementation((_request: any, cb?: (r: any) => void) =>
        cb?.({
          success: true,
          item: {
            id: 'item-1',
            itemType: 'iron',
            displayName: 'Iron',
            damageStatus: 'intact',
            state: 'contained',
          },
        }),
      );

    component['repairInventoryAsset']({
      key: 'inventory-item:item-1',
      kind: 'inventory-item',
      label: 'Iron',
      severity: 'damaged',
      summary: 'dent',
      shipId: 's-1',
      itemId: 'item-1',
    });

    const inventory = component['joinShip']()?.inventory ?? [];
    expect(inventory.find((item: any) => item.id === 'item-2')?.itemType).toBe('copper');
  });
});

describe('DOM smoke tests', () => {
  it('should render without error', () => {
    const { fixture } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: 'c-1', characterName: 'Nova' },
    });
    expect(fixture.nativeElement).toBeTruthy();
  });
});
