import { signal, type WritableSignal } from '@angular/core';
import type { PrintQueueItem } from '../app/services/printer-state.service';

/**
 * Canonical MockPrinterStateService for use in spec files.
 * Implements the full public surface of PrinterStateService.
 *
 * Usage:
 *   import { createMockPrinterStateService, MockPrinterStateService } from '../../../testing';
 *   let printerState: MockPrinterStateService;
 *   beforeEach(() => { printerState = createMockPrinterStateService(); });
 */
export interface MockPrinterStateService {
  queue: WritableSignal<PrintQueueItem[]>;
  loadQueue(playerName: string, characterId: string): void;
  addToQueue(playerName: string, characterId: string, item: Omit<PrintQueueItem, 'id' | 'startedAt'>): PrintQueueItem;
  removeFromQueue(playerName: string, characterId: string, itemId: string): void;
  expireQueueItem(playerName: string, characterId: string, itemId: string): void;
}

export function createMockPrinterStateService(): MockPrinterStateService {
  const queue = signal<PrintQueueItem[]>([]);

  return {
    queue,
    loadQueue(_playerName: string, _characterId: string) {
      // no-op by default; tests can pre-populate via queue.set(...)
    },
    addToQueue(_playerName: string, _characterId: string, item: Omit<PrintQueueItem, 'id' | 'startedAt'>) {
      const newItem: PrintQueueItem = {
        ...item,
        id: `mock-print-${Date.now()}`,
        startedAt: new Date().toISOString(),
      };
      queue.set([...queue(), newItem]);
      return newItem;
    },
    removeFromQueue(_playerName: string, _characterId: string, itemId: string) {
      queue.set(queue().filter((i) => i.id !== itemId));
    },
    expireQueueItem(_playerName: string, _characterId: string, itemId: string) {
      queue.set(
        queue().map((i) =>
          i.id === itemId
            ? { ...i, startedAt: new Date(Date.now() - i.durationMs - 1000).toISOString() }
            : i,
        ),
      );
    },
  };
}
