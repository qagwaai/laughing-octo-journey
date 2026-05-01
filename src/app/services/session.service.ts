import { Injectable, signal } from '@angular/core';
import type { ShipSummary } from '../model/ship-list';

@Injectable({
	providedIn: 'root',
})
export class SessionService {
	private sessionKey = signal<string | null>(null);
	private activeShipSignal = signal<ShipSummary | null>(null);

	readonly activeShip = this.activeShipSignal.asReadonly();

	setSessionKey(key: string): void {
		this.sessionKey.set(key);
	}

	getSessionKey(): string | null {
		return this.sessionKey();
	}

	clearSession(): void {
		this.sessionKey.set(null);
		this.activeShipSignal.set(null);
	}

	hasSession(): boolean {
		return this.sessionKey() !== null;
	}

	setActiveShip(ship: ShipSummary): void {
		this.activeShipSignal.set(ship);
	}

	clearActiveShip(): void {
		this.activeShipSignal.set(null);
	}
}
