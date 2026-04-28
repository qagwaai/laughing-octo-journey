import { Injectable } from '@angular/core';
import type { AsteroidScanSample } from '../model/ship-exterior-asteroid-sample';

export interface ShipExteriorAsteroidStateContext {
	missionId: string;
	playerName: string;
	characterId: string;
}

@Injectable({
	providedIn: 'root',
})
export class ShipExteriorAsteroidStateService {
	private static readonly STORAGE_PREFIX = 'ship-exterior:asteroids';

	loadSamples(context: ShipExteriorAsteroidStateContext): AsteroidScanSample[] | null {
		const storageKey = this.resolveStorageKey(context);
		if (!storageKey) {
			return null;
		}

		try {
			const raw = sessionStorage.getItem(storageKey);
			if (!raw) {
				return null;
			}

			const parsed = JSON.parse(raw);
			if (!Array.isArray(parsed)) {
				return null;
			}

			return parsed.filter(
				(candidate): candidate is AsteroidScanSample =>
					!!candidate && typeof candidate === 'object' && typeof (candidate as { id?: unknown }).id === 'string',
			);
		} catch {
			return null;
		}
	}

	saveSamples(context: ShipExteriorAsteroidStateContext, samples: readonly AsteroidScanSample[]): void {
		const storageKey = this.resolveStorageKey(context);
		if (!storageKey) {
			return;
		}

		try {
			sessionStorage.setItem(storageKey, JSON.stringify(samples));
		} catch {
			// Storage can fail in private mode/quota limits; callers should continue gracefully.
		}
	}

	clearSamples(context: ShipExteriorAsteroidStateContext): void {
		const storageKey = this.resolveStorageKey(context);
		if (!storageKey) {
			return;
		}

		try {
			sessionStorage.removeItem(storageKey);
		} catch {
			// Ignore storage failures.
		}
	}

	private resolveStorageKey(context: ShipExteriorAsteroidStateContext): string | null {
		const missionId = context.missionId?.trim();
		const playerName = context.playerName?.trim().toLowerCase();
		const characterId = context.characterId?.trim();
		if (!missionId || !playerName || !characterId) {
			return null;
		}

		return `${ShipExteriorAsteroidStateService.STORAGE_PREFIX}:${missionId}:${playerName}:${characterId}`;
	}
}
