import { Injectable } from '@angular/core';
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

	loadState(context: ShipExteriorMissionStateContext): ShipExteriorMissionGateState | null {
		const key = this.buildStorageKey(context);
		if (!key || typeof window === 'undefined' || !window.localStorage) {
			return null;
		}

		const raw = window.localStorage.getItem(key);
		if (!raw) {
			return null;
		}

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
