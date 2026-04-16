import { Injectable, signal } from '@angular/core';

@Injectable({
	providedIn: 'root',
})
export class SessionService {
	private sessionKey = signal<string | null>(null);

	setSessionKey(key: string): void {
		this.sessionKey.set(key);
	}

	getSessionKey(): string | null {
		return this.sessionKey();
	}

	clearSession(): void {
		this.sessionKey.set(null);
	}

	hasSession(): boolean {
		return this.sessionKey() !== null;
	}
}
