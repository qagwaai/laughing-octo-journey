import { Injectable, signal } from '@angular/core';
import type { PrintableConsumedMaterial } from '../model/printable-item';

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
export class PrinterStateService {
	private static readonly STORAGE_PREFIX = 'printer-queue';
	private readonly queueSignal = signal<PrintQueueItem[]>([]);
	readonly queue = this.queueSignal.asReadonly();

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

	addToQueue(
		playerName: string,
		characterId: string,
		item: Omit<PrintQueueItem, 'id' | 'startedAt'>,
	): PrintQueueItem {
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

	removeFromQueue(playerName: string, characterId: string, itemId: string): void {
		const updated = this.queueSignal().filter((item) => item.id !== itemId);
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
