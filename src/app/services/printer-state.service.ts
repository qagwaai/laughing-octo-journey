import { Injectable, signal } from '@angular/core';
import type { PrintableConsumedMaterial } from '../model/printable-item';

/**
 * Persisted print queue item shape used by the fabrication workflow.
 */
export interface PrintQueueItem {
  id: string;
  itemType: string;
  label: string;
  startedAt: string;
  durationMs: number;
  consumedMaterials?: PrintableConsumedMaterial[];
}

@Injectable({
  providedIn: 'root',
})
/**
 * Stores and persists per-character print queue state in local storage.
 */
export class PrinterStateService {
  private static readonly STORAGE_PREFIX = 'printer-queue';
  private readonly queueSignal = signal<PrintQueueItem[]>([]);
  readonly queue = this.queueSignal.asReadonly();

  /**
   * Loads queue entries for the provided player/character storage identity.
   */
  loadQueue(playerName: string, characterId: string): void {
    const key = PrinterStateService.buildKey(playerName, characterId);
    if (!key || typeof window === 'undefined') {
      return;
    }

    try {
      const raw = window.localStorage.getItem(key);
      const parsed = raw ? (JSON.parse(raw) as unknown) : null;
      this.queueSignal.set(Array.isArray(parsed) ? (parsed as PrintQueueItem[]) : []);
    } catch {
      this.queueSignal.set([]);
    }
  }

  /**
   * Appends a new queue entry and persists updated queue state.
   */
  addToQueue(playerName: string, characterId: string, item: Omit<PrintQueueItem, 'id' | 'startedAt'>): PrintQueueItem {
    const newItem: PrintQueueItem = {
      ...item,
      id: `print-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      startedAt: new Date().toISOString(),
    };
    const updated = [...this.queueSignal(), newItem];
    this.queueSignal.set(updated);
    this.saveToStorage(playerName, characterId, updated);
    return newItem;
  }

  /**
   * Removes a queue entry by ID and persists updated queue state.
   */
  removeFromQueue(playerName: string, characterId: string, itemId: string): void {
    const updated = this.queueSignal().filter((item) => item.id !== itemId);
    this.queueSignal.set(updated);
    this.saveToStorage(playerName, characterId, updated);
  }

  /**
   * Fast-forwards a queue entry so its elapsed time meets/exceeds its duration.
   * Dev-only helper for forcing print completion.
   */
  expireQueueItem(playerName: string, characterId: string, itemId: string): void {
    const updated = this.queueSignal().map((item) =>
      item.id === itemId
        ? { ...item, startedAt: new Date(Date.now() - item.durationMs - 1000).toISOString() }
        : item,
    );
    this.queueSignal.set(updated);
    this.saveToStorage(playerName, characterId, updated);
  }

  private saveToStorage(playerName: string, characterId: string, items: PrintQueueItem[]): void {
    const key = PrinterStateService.buildKey(playerName, characterId);
    if (!key || typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(key, JSON.stringify(items));
  }

  private static buildKey(playerName: string, characterId: string): string {
    if (!playerName?.trim() || !characterId?.trim()) {
      return '';
    }

    return `${PrinterStateService.STORAGE_PREFIX}:${playerName.trim()}:${characterId.trim()}`;
  }
}
