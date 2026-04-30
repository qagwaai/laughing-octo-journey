import { TestBed } from '@angular/core/testing';
import { PrinterStateService } from './printer-state.service';

describe('PrinterStateService', () => {
  let service: PrinterStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PrinterStateService);
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('queue starts empty', () => {
    expect(service.queue()).toEqual([]);
  });

  describe('loadQueue', () => {
    it('loads an empty queue when no stored data exists', () => {
      service.loadQueue('player1', 'char-1');
      expect(service.queue()).toEqual([]);
    });

    it('loads a previously saved queue from localStorage', () => {
      const stored = [{ id: 'p-1', itemType: 'hull-patch-kit', label: 'Hull Patch Kit', startedAt: '2026-01-01T00:00:00.000Z', durationMs: 60000 }];
      localStorage.setItem('printer-queue:player1:char-1', JSON.stringify(stored));

      service.loadQueue('player1', 'char-1');

      expect(service.queue().length).toBe(1);
      expect(service.queue()[0].itemType).toBe('hull-patch-kit');
    });

    it('resets to empty queue when stored data is not an array', () => {
      localStorage.setItem('printer-queue:player1:char-1', JSON.stringify({ broken: true }));
      service.loadQueue('player1', 'char-1');
      expect(service.queue()).toEqual([]);
    });

    it('resets to empty queue when stored data is invalid JSON', () => {
      localStorage.setItem('printer-queue:player1:char-1', 'not-json{{');
      service.loadQueue('player1', 'char-1');
      expect(service.queue()).toEqual([]);
    });

    it('does nothing when playerName is empty', () => {
      service.loadQueue('', 'char-1');
      expect(service.queue()).toEqual([]);
    });

    it('does nothing when characterId is empty', () => {
      service.loadQueue('player1', '');
      expect(service.queue()).toEqual([]);
    });
  });

  describe('addToQueue', () => {
    it('adds an item to the queue and returns it with id and startedAt', () => {
      const result = service.addToQueue('player1', 'char-1', {
        itemType: 'hull-patch-kit',
        label: 'Hull Patch Kit',
        durationMs: 60000,
      });

      expect(result.id).toMatch(/^print-/);
      expect(result.startedAt).toBeTruthy();
      expect(service.queue().length).toBe(1);
      expect(service.queue()[0].itemType).toBe('hull-patch-kit');
    });

    it('persists the item to localStorage', () => {
      service.addToQueue('player1', 'char-1', {
        itemType: 'hull-patch-kit',
        label: 'Hull Patch Kit',
        durationMs: 60000,
      });

      const raw = localStorage.getItem('printer-queue:player1:char-1');
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw!);
      expect(Array.isArray(parsed)).toBeTrue();
      expect(parsed.length).toBe(1);
    });

    it('accumulates multiple items', () => {
      service.addToQueue('player1', 'char-1', { itemType: 'a', label: 'A', durationMs: 1000 });
      service.addToQueue('player1', 'char-1', { itemType: 'b', label: 'B', durationMs: 2000 });
      expect(service.queue().length).toBe(2);
    });

    it('generates a unique id for each item', () => {
      const r1 = service.addToQueue('player1', 'char-1', { itemType: 'x', label: 'X', durationMs: 1000 });
      const r2 = service.addToQueue('player1', 'char-1', { itemType: 'y', label: 'Y', durationMs: 1000 });
      expect(r1.id).not.toBe(r2.id);
    });

    it('stores consumedMaterials when provided', () => {
      const materials = [{ id: 'm-1', itemType: 'iron', label: 'Iron' }];
      const result = service.addToQueue('player1', 'char-1', {
        itemType: 'hull-patch-kit',
        label: 'Hull Patch Kit',
        durationMs: 60000,
        consumedMaterials: materials,
      });
      expect(result.consumedMaterials).toEqual(materials);
    });
  });

  describe('removeFromQueue', () => {
    it('removes an item by id', () => {
      const item = service.addToQueue('player1', 'char-1', { itemType: 'a', label: 'A', durationMs: 1000 });
      service.removeFromQueue('player1', 'char-1', item.id);
      expect(service.queue().length).toBe(0);
    });

    it('does not affect other items when removing one', () => {
      service.addToQueue('player1', 'char-1', { itemType: 'a', label: 'A', durationMs: 1000 });
      const b = service.addToQueue('player1', 'char-1', { itemType: 'b', label: 'B', durationMs: 2000 });
      service.removeFromQueue('player1', 'char-1', b.id);
      expect(service.queue().length).toBe(1);
      expect(service.queue()[0].itemType).toBe('a');
    });

    it('persists the updated queue to localStorage after removal', () => {
      const item = service.addToQueue('player1', 'char-1', { itemType: 'a', label: 'A', durationMs: 1000 });
      service.removeFromQueue('player1', 'char-1', item.id);
      const raw = localStorage.getItem('printer-queue:player1:char-1');
      const parsed = JSON.parse(raw!);
      expect(parsed).toEqual([]);
    });

    it('does nothing when id does not exist', () => {
      service.addToQueue('player1', 'char-1', { itemType: 'a', label: 'A', durationMs: 1000 });
      service.removeFromQueue('player1', 'char-1', 'nonexistent');
      expect(service.queue().length).toBe(1);
    });
  });
});
