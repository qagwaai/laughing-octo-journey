/**
 * Integration: CharacterShipBadge + SessionService + ShipHangar set-active flow
 *
 * Verifies that setting an active ship through the hangar service call is
 * immediately reflected in the badge's activeShip signal without any
 * additional wiring — the shared SessionService is the single source of truth.
 */
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { SessionService } from '../services/session.service';
import { CharacterShipBadge } from './character-ship-badge';
import type { ShipSummary } from '../model/ship-list';

function createBadgeWithService(): CharacterShipBadge {
	const badge = TestBed.runInInjectionContext(() => new CharacterShipBadge());
	badge.playerName = 'Pioneer';
	badge.joinCharacter = { id: 'c-1', characterName: 'Nova' } as never;
	return badge;
}

describe('CharacterShipBadge + SessionService integration', () => {
	let sessionService: SessionService;

	const surveyor: ShipSummary = { id: 'd-1', name: 'Surveyor', model: 'Scavenger Pod', tier: 1, status: 'ACTIVE' } as ShipSummary;
	const guardian: ShipSummary = { id: 'd-2', name: 'Guardian', model: 'Scavenger Pod', tier: 1, status: 'ACTIVE' } as ShipSummary;

	beforeEach(() => {
		sessionService = new SessionService();
		TestBed.configureTestingModule({
			providers: [
				{ provide: SessionService, useValue: sessionService },
				{ provide: Router, useValue: { navigate: jasmine.createSpy('navigate') } },
			],
		});
	});

	it('badge shows no ship before any ship is set', () => {
		const badge = createBadgeWithService();
		expect(badge.activeShip()).toBeNull();
	});

	it('badge immediately reflects ship set via SessionService.setActiveShip', () => {
		const badge = createBadgeWithService();
		sessionService.setActiveShip(surveyor);
		expect(badge.activeShip()?.id).toBe('d-1');
		expect(badge.activeShip()?.name).toBe('Surveyor');
	});

	it('badge updates when active ship is replaced (player selects different ship)', () => {
		const badge = createBadgeWithService();
		sessionService.setActiveShip(surveyor);
		sessionService.setActiveShip(guardian);
		expect(badge.activeShip()?.id).toBe('d-2');
		expect(badge.activeShip()?.name).toBe('Guardian');
	});

	it('badge display name falls back to model when active ship name is blank', () => {
		const badge = createBadgeWithService();
		sessionService.setActiveShip({
			id: 'd-9',
			name: '   ',
			model: 'Scavenger Pod',
			tier: 1,
			status: 'ACTIVE',
		} as ShipSummary);
		expect(badge.activeShipDisplayName()).toBe('Scavenger Pod');
	});

	it('badge reflects null after clearActiveShip is called', () => {
		const badge = createBadgeWithService();
		sessionService.setActiveShip(surveyor);
		sessionService.clearActiveShip();
		expect(badge.activeShip()).toBeNull();
	});

	it('badge reflects null after full session clear (logout scenario)', () => {
		const badge = createBadgeWithService();
		sessionService.setSessionKey('session-abc');
		sessionService.setActiveShip(surveyor);
		sessionService.clearSession();
		expect(badge.activeShip()).toBeNull();
	});

	it('two badge instances share the same active ship from the same service', () => {
		const badge1 = createBadgeWithService();
		const badge2 = createBadgeWithService();
		sessionService.setActiveShip(surveyor);
		expect(badge1.activeShip()?.id).toBe(badge2.activeShip()?.id);
		expect(badge1.activeShip()?.name).toBe('Surveyor');
		expect(badge2.activeShip()?.name).toBe('Surveyor');
	});
});
