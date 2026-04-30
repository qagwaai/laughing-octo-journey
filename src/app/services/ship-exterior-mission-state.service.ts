import { Injectable, signal } from '@angular/core';
import type { ShipExteriorMissionGateState } from '../mission/ship-exterior-mission';

export interface ShipExteriorMissionStateContext {
	missionId: string;
	playerName: string;
	characterId: string;
}

@Injectable({
	providedIn: 'root',
})
export class ShipExteriorMissionStateService {
	private static readonly STORAGE_PREFIX = 'ship-exterior-mission-state';

	private readonly _lastSaved = signal<ShipExteriorMissionGateState | null>(null);
	readonly lastSaved = this._lastSaved.asReadonly();

	loadState(context: ShipExteriorMissionStateContext): ShipExteriorMissionGateState | null {
		const key = this.buildStorageKey(context);
		if (!key || typeof window === 'undefined' || !window.localStorage) {
			return null;
		}

		const raw = window.localStorage.getItem(key);
		if (raw) {
			const parsed = this.parseStoredState(raw, context);
			if (parsed) {
				return parsed;
			}
		}

		return this.loadFallbackStateByMissionAndCharacter(context);
	}

	private loadFallbackStateByMissionAndCharacter(context: ShipExteriorMissionStateContext): ShipExteriorMissionGateState | null {
		const missionId = context.missionId?.trim();
		const characterId = context.characterId?.trim();
		if (!missionId || !characterId) {
			return null;
		}

		for (let index = 0; index < window.localStorage.length; index += 1) {
			const key = window.localStorage.key(index);
			if (!key || !key.startsWith(`${ShipExteriorMissionStateService.STORAGE_PREFIX}::`)) {
				continue;
			}

			const [prefix, storedMissionId, _storedPlayerName, storedCharacterId] = key.split('::');
			if (
				prefix !== ShipExteriorMissionStateService.STORAGE_PREFIX
				|| storedMissionId !== missionId
				|| storedCharacterId !== characterId
			) {
				continue;
			}

			const raw = window.localStorage.getItem(key);
			if (!raw) {
				continue;
			}

			const parsed = this.parseStoredState(raw, context);
			if (parsed) {
				return parsed;
			}
		}

		return null;
	}

	private parseStoredState(
		raw: string,
		context: ShipExteriorMissionStateContext,
	): ShipExteriorMissionGateState | null {

		try {
			const parsed = JSON.parse(raw) as ShipExteriorMissionGateState;
			if (!parsed || typeof parsed !== 'object') {
				return null;
			}

			if (parsed.missionId !== context.missionId || parsed.characterId !== context.characterId) {
				return null;
			}

			if (!Array.isArray(parsed.steps)) {
				return null;
			}

			return parsed;
		} catch {
			return null;
		}
	}

	saveState(context: ShipExteriorMissionStateContext, state: ShipExteriorMissionGateState): void {
		const key = this.buildStorageKey(context);
		if (!key || typeof window === 'undefined' || !window.localStorage) {
			return;
		}

		window.localStorage.setItem(key, JSON.stringify(state));
		this._lastSaved.set(state);
	}

	clearState(context: ShipExteriorMissionStateContext): void {
		const key = this.buildStorageKey(context);
		if (!key || typeof window === 'undefined' || !window.localStorage) {
			return;
		}

		window.localStorage.removeItem(key);
	}

	private buildStorageKey(context: ShipExteriorMissionStateContext): string | null {
		const missionId = context.missionId?.trim();
		const playerName = context.playerName?.trim();
		const characterId = context.characterId?.trim();
		if (!missionId || !playerName || !characterId) {
			return null;
		}

		return `${ShipExteriorMissionStateService.STORAGE_PREFIX}::${missionId}::${playerName}::${characterId}`;
	}
}
