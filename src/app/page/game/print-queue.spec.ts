import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { signal } from '@angular/core';
import {
  createMockPrinterStateService,
  createMockSessionService,
  createMockSocketService,
  type MockPrinterStateService,
  type MockSessionService,
  type MockSocketService,
} from '../../../testing';
import { HULL_PATCH_KIT_PRINTABLE_ITEM } from '../../model/printable-item';
import { MissionProgressSyncService } from '../../services/mission-progress-sync.service';
import { ShipService } from '../../services/ship.service';
import { PrinterStateService } from '../../services/printer-state.service';
import { SessionService } from '../../services/session.service';
import { ShipExteriorMissionStateService } from '../../services/ship-exterior-mission-state.service';
import { SocketService } from '../../services/socket.service';
import PrintQueuePage from './print-queue';

function makeContainedInventoryItem(id: string, itemType: string, displayName: string) {
  const now = new Date().toISOString();
  return {
    id,
    itemType,
    displayName,
    launchable: false,
    state: 'contained',
    damageStatus: 'intact',
    container: { containerType: 'ship', containerId: 'ship-1' },
    owningPlayerId: 'tester',
    owningCharacterId: 'char-1',
    spatial: null,
    destroyedAt: null,
    destroyedReason: null,
    discoveredAt: null,
    discoveredByCharacterId: null,
    createdAt: now,
    updatedAt: now,
  } as any;
}

function makeActiveShip(overrides?: Partial<any>) {
  return {
    id: 'ship-1',
    name: 'Scavenger Pod',
    model: 'Scavenger Pod',
    tier: 1,
    status: 'docked',
    inventory: [],
    ...overrides,
  } as any;
}

function setup(options: {
  socketService: MockSocketService;
  sessionService: MockSessionService;
  printerService: MockPrinterStateService;
  navigationState?: Record<string, unknown>;
}) {
  const mockRouter = {
    getCurrentNavigation: () => (options.navigationState ? { extras: { state: options.navigationState } } : null),
    navigate: jasmine.createSpy('navigate'),
  };

  const mockMissionState = {
    lastSaved: signal(null),
    loadState: jasmine.createSpy('loadState').and.returnValue(null),
    saveState: jasmine.createSpy('saveState'),
  };
  const mockMissionProgressSync = {
    syncGateState: jasmine.createSpy('syncGateState').and.returnValue(Promise.resolve('skipped' as const)),
  };
  const mockShipService = {
    listShipsByOwner: jasmine.createSpy('listShipsByOwner'),
  };

  TestBed.configureTestingModule({
    imports: [PrintQueuePage],
    providers: [
      { provide: SocketService, useValue: options.socketService },
      { provide: SessionService, useValue: options.sessionService },
      { provide: ShipService, useValue: mockShipService },
      { provide: PrinterStateService, useValue: options.printerService },
      { provide: ShipExteriorMissionStateService, useValue: mockMissionState },
      { provide: MissionProgressSyncService, useValue: mockMissionProgressSync },
      { provide: Router, useValue: mockRouter },
    ],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
  });

  const fixture = TestBed.createComponent(PrintQueuePage);
  fixture.detectChanges();
  return {
    component: fixture.componentInstance,
    fixture,
    mockRouter,
    mockMissionState,
    mockMissionProgressSync,
    mockShipService,
  };
}

describe('PrintQueuePage', () => {
  let socketService: MockSocketService;
  let sessionService: MockSessionService;
  let printerService: MockPrinterStateService;

  beforeEach(() => {
    socketService = createMockSocketService();
    sessionService = createMockSessionService('test-session-key');
    printerService = createMockPrinterStateService();
  });

  describe('printerStatus()', () => {
    it('should return idle when queue is empty', () => {
      const { component } = setup({ socketService, sessionService, printerService });
      expect(component['printerStatus']()).toBe('idle');
    });

    it('should return printing when queue has items', () => {
      const { component, fixture } = setup({ socketService, sessionService, printerService });
      printerService.queue.set([
        {
          id: 'job-1',
          itemType: 'hull-patch-kit',
          label: 'Hull Patch Kit',
          startedAt: new Date().toISOString(),
          durationMs: 60000,
        },
      ]);
      fixture.detectChanges();
      expect(component['printerStatus']()).toBe('printing');
    });
  });

  describe('loadActiveShip() resolver behavior', () => {
    const navigationState = {
      playerName: 'tester',
      joinCharacter: { id: 'char-1', characterName: 'Nova' },
      joinShip: makeActiveShip({
        id: 'ship-requested',
        spatial: { solarSystemId: 'sol', frame: 'barycentric', positionKm: { x: 0, y: 0, z: 0 }, epochMs: 0 },
      }),
    };

    it('sets printer error when no returned ship has usable spatial data', () => {
      const { component, fixture, mockShipService } = setup({ socketService, sessionService, printerService, navigationState });
      mockShipService.listShipsByOwner.and.callFake((_request: any, cb: (response: any) => void) => {
        cb({
          success: true,
          ships: [
            {
              id: 'ship-requested',
              name: 'Requested Ship',
              model: 'Scavenger Pod',
              tier: 1,
              spatial: { solarSystemId: 'sol', frame: 'barycentric', positionKm: { x: 0, y: 0, z: 0 }, epochMs: 0 },
              inventory: [],
            },
          ],
        });
      });

      component['loadActiveShip']();
      fixture.detectChanges();

      expect(component['printerError']()).toBe('No ship with usable spatial data is available.');
    });
  });

  describe('formatRemainingTime()', () => {
    it('should return 0:00 for zero or negative ms', () => {
      const { component } = setup({ socketService, sessionService, printerService });
      expect(component['formatRemainingTime'](0)).toBe('0:00');
      expect(component['formatRemainingTime'](-1000)).toBe('0:00');
    });

    it('should format under 1 minute correctly', () => {
      const { component } = setup({ socketService, sessionService, printerService });
      expect(component['formatRemainingTime'](30000)).toBe('0:30');
      expect(component['formatRemainingTime'](9000)).toBe('0:09');
    });

    it('should format minutes and seconds correctly', () => {
      const { component } = setup({ socketService, sessionService, printerService });
      expect(component['formatRemainingTime'](90000)).toBe('1:30');
      expect(component['formatRemainingTime'](125000)).toBe('2:05');
    });

    it('should pad seconds with leading zero', () => {
      const { component } = setup({ socketService, sessionService, printerService });
      expect(component['formatRemainingTime'](61000)).toBe('1:01');
    });
  });

  describe('DOM smoke tests', () => {
    it('should render without error', () => {
      const { fixture } = setup({ socketService, sessionService, printerService });
      fixture.detectChanges();
      expect(fixture.nativeElement).toBeTruthy();
    });
  });

  describe('finishPrintJob() (dev-only)', () => {
    const navigationState = {
      playerName: 'tester',
      joinCharacter: { id: 'char-1' },
    };

    it('should expose isDevBuild as true in non-production builds', () => {
      const { component } = setup({ socketService, sessionService, printerService, navigationState });
      expect(component['isDevBuild']).toBeTrue();
    });

    it('should fast-forward the queue item so elapsed >= durationMs', () => {
      const { component } = setup({ socketService, sessionService, printerService, navigationState });
      const job = {
        id: 'job-finish',
        itemType: 'hull-patch-kit',
        label: 'Hull Patch Kit',
        startedAt: new Date().toISOString(),
        durationMs: 60_000,
      };
      printerService.queue.set([job]);

      component['finishPrintJob'](job);

      const updated = printerService.queue().find((i) => i.id === 'job-finish');
      expect(updated).toBeTruthy();
      const elapsed = Date.now() - new Date(updated!.startedAt).getTime();
      expect(elapsed).toBeGreaterThanOrEqual(updated!.durationMs);
    });

    it('should render a Finish (dev) button on active job rows when dev build', () => {
      const { fixture } = setup({ socketService, sessionService, printerService, navigationState });
      printerService.queue.set([
        {
          id: 'job-render',
          itemType: 'hull-patch-kit',
          label: 'Hull Patch Kit',
          startedAt: new Date().toISOString(),
          durationMs: 60_000,
        },
      ]);
      fixture.detectChanges();

      const buttons: HTMLButtonElement[] = Array.from(
        fixture.nativeElement.querySelectorAll('button.repair-action--finish-dev'),
      );
      expect(buttons.length).toBe(1);
      expect(buttons[0].textContent?.toLowerCase()).toContain('finish');
    });
  });

  describe('queue/cancel/collect branches', () => {
    const navigationState = {
      playerName: 'tester',
      joinCharacter: { id: 'char-1', characterName: 'Nova' },
      joinShip: makeActiveShip(),
    };

    it('sets requirement error when printable materials are missing', () => {
      const { component } = setup({ socketService, sessionService, printerService, navigationState });
      component['activeShip'].set(makeActiveShip({ inventory: [] }));

      component['queuePrintableItem'](HULL_PATCH_KIT_PRINTABLE_ITEM);

      expect(component['printerError']()).toContain('Iron');
    });

    it('does not start queue flow when a queue operation is already running', () => {
      const addSpy = spyOn(printerService, 'addToQueue').and.callThrough();
      const upsertSpy = jasmine.createSpy('upsertItem');
      (socketService as any).upsertItem = upsertSpy;

      const { component } = setup({ socketService, sessionService, printerService, navigationState });
      component['activeShip'].set(
        makeActiveShip({
          inventory: [makeContainedInventoryItem('iron-busy', 'iron-ore', 'Iron Ore')],
        }),
      );
      component['isQueueingPrintableItem'].set(true);

      component['queuePrintableItem'](HULL_PATCH_KIT_PRINTABLE_ITEM);

      expect(addSpy).not.toHaveBeenCalled();
      expect(upsertSpy).not.toHaveBeenCalled();
    });

    it('shows unavailable requirement message when materials exist but session context is missing', () => {
      const { component } = setup({
        socketService,
        sessionService: createMockSessionService(null),
        printerService,
        navigationState,
      });
      component['activeShip'].set(
        makeActiveShip({
          inventory: [makeContainedInventoryItem('iron-session', 'iron-ore', 'Iron Ore')],
        }),
      );

      component['queuePrintableItem'](HULL_PATCH_KIT_PRINTABLE_ITEM);

      expect(component['printerError']()).toContain('not available to print right now');
    });

    it('canQueuePrintableItem returns true when requirements are satisfied', () => {
      const { component } = setup({ socketService, sessionService, printerService, navigationState });
      component['activeShip'].set(
        makeActiveShip({
          inventory: [makeContainedInventoryItem('iron-ok', 'iron-ore', 'Iron Ore')],
        }),
      );

      expect(component['canQueuePrintableItem'](HULL_PATCH_KIT_PRINTABLE_ITEM)).toBeTrue();
    });

    it('canQueuePrintableItem returns false when item is already queued', () => {
      const { component } = setup({ socketService, sessionService, printerService, navigationState });
      component['activeShip'].set(
        makeActiveShip({
          inventory: [makeContainedInventoryItem('iron-ok', 'iron-ore', 'Iron Ore')],
        }),
      );
      printerService.queue.set([
        {
          id: 'job-printing-1',
          itemType: HULL_PATCH_KIT_PRINTABLE_ITEM.itemType,
          label: HULL_PATCH_KIT_PRINTABLE_ITEM.displayName,
          startedAt: new Date().toISOString(),
          durationMs: 60_000,
        } as any,
      ]);

      expect(component['canQueuePrintableItem'](HULL_PATCH_KIT_PRINTABLE_ITEM)).toBeFalse();
    });

    it('canQueuePrintableItem returns false when printable already exists in inventory', () => {
      const { component } = setup({ socketService, sessionService, printerService, navigationState });
      component['activeShip'].set(
        makeActiveShip({
          inventory: [makeContainedInventoryItem('kit-existing', HULL_PATCH_KIT_PRINTABLE_ITEM.itemType, 'Hull Patch Kit')],
        }),
      );

      expect(component['canQueuePrintableItem'](HULL_PATCH_KIT_PRINTABLE_ITEM)).toBeFalse();
    });

    it('returns generic requirement message when materials are present but queueing is unavailable', () => {
      const { component } = setup({ socketService, sessionService, printerService, navigationState });
      component['activeShip'].set(
        makeActiveShip({
          inventory: [makeContainedInventoryItem('iron-ok', 'iron-ore', 'Iron Ore')],
        }),
      );

      expect(component['getPrintableItemRequirementMessage'](HULL_PATCH_KIT_PRINTABLE_ITEM)).toContain(
        'is not available to print right now',
      );
    });

    it('queues printable item after consuming required materials', () => {
      const addSpy = spyOn(printerService, 'addToQueue').and.callThrough();
      (socketService as any).upsertItem = jasmine.createSpy('upsertItem').and.callFake((_request: any, cb: any) => {
        cb({ success: true, item: null });
      });

      const { component } = setup({ socketService, sessionService, printerService, navigationState });
      component['activeShip'].set(
        makeActiveShip({
          inventory: [makeContainedInventoryItem('iron-1', 'iron-ore', 'Iron Ore')],
        }),
      );

      component['queuePrintableItem'](HULL_PATCH_KIT_PRINTABLE_ITEM);

      expect(addSpy).toHaveBeenCalled();
      expect(component['printerSuccess']()).toContain('queued for printing');
      expect(component['activeShip']()?.inventory?.length ?? 0).toBe(0);
    });

    it('handles queue success when active ship inventory is undefined', () => {
      const addSpy = spyOn(printerService, 'addToQueue').and.callThrough();
      (socketService as any).upsertItem = jasmine.createSpy('upsertItem').and.callFake((_request: any, cb: any) => {
        cb({ success: true, item: null });
      });

      const { component } = setup({ socketService, sessionService, printerService, navigationState });
      component['activeShip'].set({ ...makeActiveShip(), inventory: undefined } as any);

      component['queuePrintableItem'](HULL_PATCH_KIT_PRINTABLE_ITEM);

      expect(addSpy).not.toHaveBeenCalled();
      expect(component['printerError']()).toContain('required in ship inventory');
    });

    it('surfaces consume-material failure and does not queue item', () => {
      const addSpy = spyOn(printerService, 'addToQueue').and.callThrough();
      (socketService as any).upsertItem = jasmine.createSpy('upsertItem').and.callFake((_request: any, cb: any) => {
        cb({ success: false, message: 'material lock conflict' });
      });

      const { component } = setup({ socketService, sessionService, printerService, navigationState });
      component['activeShip'].set(
        makeActiveShip({
          inventory: [makeContainedInventoryItem('iron-2', 'iron-ore', 'Iron Ore')],
        }),
      );

      component['queuePrintableItem'](HULL_PATCH_KIT_PRINTABLE_ITEM);

      expect(addSpy).not.toHaveBeenCalled();
      expect(component['printerError']()).toBe('material lock conflict');
    });

    it('uses default consume-material failure text when backend message is missing', () => {
      (socketService as any).upsertItem = jasmine.createSpy('upsertItem').and.callFake((_request: any, cb: any) => {
        cb({ success: false });
      });

      const { component } = setup({ socketService, sessionService, printerService, navigationState });
      component['activeShip'].set(
        makeActiveShip({
          inventory: [makeContainedInventoryItem('iron-default-consume', 'iron-ore', 'Iron Ore')],
        }),
      );

      component['queuePrintableItem'](HULL_PATCH_KIT_PRINTABLE_ITEM);

      expect(component['printerError']()).toContain('Unable to consume Iron Ore for print job.');
    });

    it('cancels queue item without consumed materials by removing it immediately', () => {
      const removeSpy = spyOn(printerService, 'removeFromQueue').and.callThrough();
      const { component } = setup({ socketService, sessionService, printerService, navigationState });
      component['activeShip'].set(makeActiveShip());

      const queued = {
        id: 'job-cancel-empty',
        itemType: 'hull-patch-kit',
        label: 'Hull Patch Kit',
        startedAt: new Date().toISOString(),
        durationMs: 60_000,
        consumedMaterials: [],
      };
      printerService.queue.set([queued as any]);

      component['cancelPrintJob'](queued as any);

      expect(removeSpy).toHaveBeenCalledWith('tester', 'char-1', 'job-cancel-empty');
    });

    it('restores consumed materials on cancel and appends them to inventory', () => {
      const removeSpy = spyOn(printerService, 'removeFromQueue').and.callThrough();
      (socketService as any).upsertItem = jasmine.createSpy('upsertItem').and.callFake((request: any, cb: any) => {
        cb({
          success: true,
          item: makeContainedInventoryItem(request.item.id, request.item.itemType, request.item.displayName),
        });
      });

      const { component } = setup({ socketService, sessionService, printerService, navigationState });
      component['activeShip'].set(makeActiveShip({ inventory: [] }));

      const queued = {
        id: 'job-cancel-restore',
        itemType: 'hull-patch-kit',
        label: 'Hull Patch Kit',
        startedAt: new Date().toISOString(),
        durationMs: 60_000,
        consumedMaterials: [{ id: 'iron-restore-1', itemType: 'iron-ore', label: 'Iron Ore' }],
      };

      component['cancelPrintJob'](queued as any);

      expect(removeSpy).toHaveBeenCalledWith('tester', 'char-1', 'job-cancel-restore');
      expect(component['activeShip']()?.inventory?.length).toBe(1);
      expect(component['printerSuccess']()).toContain('Print job canceled');
    });

    it('restores materials when active ship inventory is undefined', () => {
      const removeSpy = spyOn(printerService, 'removeFromQueue').and.callThrough();
      (socketService as any).upsertItem = jasmine.createSpy('upsertItem').and.callFake((request: any, cb: any) => {
        cb({
          success: true,
          item: makeContainedInventoryItem(request.item.id, request.item.itemType, request.item.displayName),
        });
      });

      const { component } = setup({ socketService, sessionService, printerService, navigationState });
      component['activeShip'].set({ ...makeActiveShip(), inventory: undefined } as any);

      component['cancelPrintJob']({
        id: 'job-cancel-undefined-inventory',
        itemType: 'hull-patch-kit',
        label: 'Hull Patch Kit',
        startedAt: new Date().toISOString(),
        durationMs: 60_000,
        consumedMaterials: [{ id: 'iron-restore-undefined', itemType: 'iron-ore', label: 'Iron Ore' }],
      } as any);

      expect(removeSpy).toHaveBeenCalledWith('tester', 'char-1', 'job-cancel-undefined-inventory');
      expect(component['activeShip']()?.inventory?.length).toBe(1);
    });

    it('surfaces restore-material failure and keeps queue item in place', () => {
      const removeSpy = spyOn(printerService, 'removeFromQueue').and.callThrough();
      (socketService as any).upsertItem = jasmine.createSpy('upsertItem').and.callFake((_request: any, cb: any) => {
        cb({ success: false, message: 'restore failed' });
      });

      const { component } = setup({ socketService, sessionService, printerService, navigationState });
      component['activeShip'].set(makeActiveShip({ inventory: [] }));

      component['cancelPrintJob']({
        id: 'job-cancel-fail',
        itemType: 'hull-patch-kit',
        label: 'Hull Patch Kit',
        startedAt: new Date().toISOString(),
        durationMs: 60_000,
        consumedMaterials: [{ id: 'iron-restore-fail', itemType: 'iron-ore', label: 'Iron Ore' }],
      } as any);

      expect(component['printerError']()).toBe('restore failed');
      expect(removeSpy).not.toHaveBeenCalled();
    });

    it('uses default restore-material failure text when backend message is missing', () => {
      (socketService as any).upsertItem = jasmine.createSpy('upsertItem').and.callFake((_request: any, cb: any) => {
        cb({ success: false });
      });

      const { component } = setup({ socketService, sessionService, printerService, navigationState });
      component['activeShip'].set(makeActiveShip({ inventory: [] }));

      component['cancelPrintJob']({
        id: 'job-cancel-default-restore',
        itemType: 'hull-patch-kit',
        label: 'Hull Patch Kit',
        startedAt: new Date().toISOString(),
        durationMs: 60_000,
        consumedMaterials: [{ id: 'iron-default-restore', itemType: 'iron-ore', label: 'Iron Ore' }],
      } as any);

      expect(component['printerError']()).toContain('Unable to restore Iron Ore from canceled print job.');
    });

    it('does not cancel when ship context is incomplete', () => {
      const removeSpy = spyOn(printerService, 'removeFromQueue').and.callThrough();
      const { component } = setup({ socketService, sessionService, printerService, navigationState });
      component['activeShip'].set(makeActiveShip({ id: '' }));

      component['cancelPrintJob']({
        id: 'job-cancel-incomplete',
        itemType: 'hull-patch-kit',
        label: 'Hull Patch Kit',
        startedAt: new Date().toISOString(),
        durationMs: 60_000,
      } as any);

      expect(removeSpy).not.toHaveBeenCalled();
    });

    it('collects completed print jobs and moves them to ship inventory', () => {
      const removeSpy = spyOn(printerService, 'removeFromQueue').and.callThrough();
      (socketService as any).upsertItem = jasmine.createSpy('upsertItem').and.callFake((_request: any, cb: any) => {
        cb({ success: true, item: makeContainedInventoryItem('printed-1', 'hull-patch-kit', 'Hull Patch Kit') });
      });

      const { component } = setup({ socketService, sessionService, printerService, navigationState });
      component['activeShip'].set(makeActiveShip({ inventory: [] }));
      const job = {
        id: 'job-complete-1',
        itemType: 'hull-patch-kit',
        label: 'Hull Patch Kit',
        startedAt: new Date(Date.now() - 65_000).toISOString(),
        durationMs: 60_000,
      };
      printerService.queue.set([job as any]);

      component['checkPrintCompletion']();

      expect(removeSpy).toHaveBeenCalledWith('tester', 'char-1', 'job-complete-1');
      expect(component['activeShip']()?.inventory?.length).toBe(1);
      expect(component['printerSuccess']()).toContain('print complete');
    });

    it('collects completed jobs when ship inventory is undefined', () => {
      const removeSpy = spyOn(printerService, 'removeFromQueue').and.callThrough();
      (socketService as any).upsertItem = jasmine.createSpy('upsertItem').and.callFake((_request: any, cb: any) => {
        cb({ success: true, item: makeContainedInventoryItem('printed-undefined', 'hull-patch-kit', 'Hull Patch Kit') });
      });

      const { component } = setup({ socketService, sessionService, printerService, navigationState });
      component['activeShip'].set({ ...makeActiveShip(), inventory: undefined } as any);
      printerService.queue.set([
        {
          id: 'job-complete-undefined-inventory',
          itemType: 'hull-patch-kit',
          label: 'Hull Patch Kit',
          startedAt: new Date(Date.now() - 65_000).toISOString(),
          durationMs: 60_000,
        } as any,
      ]);

      component['checkPrintCompletion']();

      expect(removeSpy).toHaveBeenCalledWith('tester', 'char-1', 'job-complete-undefined-inventory');
      expect(component['activeShip']()?.inventory?.length).toBe(1);
    });

    it('skips collection for jobs already tracked as collecting', () => {
      const upsertSpy = jasmine.createSpy('upsertItem');
      (socketService as any).upsertItem = upsertSpy;

      const { component } = setup({ socketService, sessionService, printerService, navigationState });
      component['activeShip'].set(makeActiveShip({ inventory: [] }));
      printerService.queue.set([
        {
          id: 'job-already-collecting',
          itemType: 'hull-patch-kit',
          label: 'Hull Patch Kit',
          startedAt: new Date(Date.now() - 65_000).toISOString(),
          durationMs: 60_000,
        } as any,
      ]);
      component['collectingItemIds'].add('job-already-collecting');

      component['checkPrintCompletion']();

      expect(upsertSpy).not.toHaveBeenCalled();
    });

    it('removes collecting marker when collection cannot proceed due to missing context', () => {
      const noSession = createMockSessionService(null);
      const { component } = setup({
        socketService,
        sessionService: noSession,
        printerService,
        navigationState,
      });
      component['activeShip'].set(makeActiveShip({ id: '' }));

      const job = {
        id: 'job-missing-context',
        itemType: 'hull-patch-kit',
        label: 'Hull Patch Kit',
        startedAt: new Date().toISOString(),
        durationMs: 60_000,
      };

      component['collectingItemIds'].add(job.id);
      component['collectCompletedPrintJob'](job as any);

      expect(component['collectingItemIds'].has(job.id)).toBeFalse();
    });

    it('surfaces collect failure when upsert response is unsuccessful', () => {
      (socketService as any).upsertItem = jasmine.createSpy('upsertItem').and.callFake((_request: any, cb: any) => {
        cb({ success: false, message: 'collect failed' });
      });

      const { component } = setup({ socketService, sessionService, printerService, navigationState });
      component['activeShip'].set(makeActiveShip({ inventory: [] }));
      printerService.queue.set([
        {
          id: 'job-complete-fail',
          itemType: 'hull-patch-kit',
          label: 'Hull Patch Kit',
          startedAt: new Date(Date.now() - 65_000).toISOString(),
          durationMs: 60_000,
        } as any,
      ]);

      component['checkPrintCompletion']();

      expect(component['printerError']()).toBe('collect failed');
    });

    it('uses default collect failure text when backend message is missing', () => {
      (socketService as any).upsertItem = jasmine.createSpy('upsertItem').and.callFake((_request: any, cb: any) => {
        cb({ success: false });
      });

      const { component } = setup({ socketService, sessionService, printerService, navigationState });
      component['activeShip'].set(makeActiveShip({ inventory: [] }));
      printerService.queue.set([
        {
          id: 'job-complete-default-fail',
          itemType: 'hull-patch-kit',
          label: 'Hull Patch Kit',
          startedAt: new Date(Date.now() - 65_000).toISOString(),
          durationMs: 60_000,
        } as any,
      ]);

      component['checkPrintCompletion']();

      expect(component['printerError']()).toBe('Failed to collect completed print job.');
    });

    it('parses stored mission gate state and syncs on completed manufacture', () => {
      const removeSpy = spyOn(printerService, 'removeFromQueue').and.callThrough();
      (socketService as any).upsertItem = jasmine.createSpy('upsertItem').and.callFake((_request: any, cb: any) => {
        cb({ success: true, item: makeContainedInventoryItem('printed-gate', 'hull-patch-kit', 'Hull Patch Kit') });
      });

      const { component, mockMissionState } = setup({
        socketService,
        sessionService,
        printerService,
        navigationState,
      });
      mockMissionState.loadState.and.returnValue({
        missionId: 'first-target',
        characterId: 'char-1',
        currentStepId: 'manufacture-hull-patch-kit',
        status: 'ACTIVE',
        steps: [
          {
            id: 'manufacture-hull-patch-kit',
            status: 'ACTIVE',
            updatedAt: '2026-05-01T00:00:00.000Z',
          },
        ],
      });

      component['activeShip'].set(makeActiveShip({ inventory: [] }));
      printerService.queue.set([
        {
          id: 'job-complete-gate-state',
          itemType: 'hull-patch-kit',
          label: 'Hull Patch Kit',
          startedAt: new Date(Date.now() - 65_000).toISOString(),
          durationMs: 60_000,
        } as any,
      ]);

      component['checkPrintCompletion']();

      expect(removeSpy).toHaveBeenCalledWith('tester', 'char-1', 'job-complete-gate-state');
      expect(mockMissionState.loadState).toHaveBeenCalled();
    });
  });
});
