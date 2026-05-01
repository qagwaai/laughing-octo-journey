import { CharacterShipBadge } from './character-ship-badge';
import { SessionService } from '../services/session.service';
import type { ShipSummary } from '../model/ship-list';

type Listener = (...args: any[]) => void;

class MockRouter {
	navigate = jasmine.createSpy('navigate');
}

class MockSessionService {
	private ship: ShipSummary | null = null;

	readonly activeShip = () => this.ship;

	setActiveShip(s: ShipSummary): void {
		this.ship = s;
	}

	clearActiveShip(): void {
		this.ship = null;
	}
}

function createBadge(
	playerName: string,
	character: { id: string; characterName: string } | null,
	sessionService: MockSessionService,
	router: MockRouter,
): CharacterShipBadge {
	const badge = new CharacterShipBadge();
	(badge as any).router = router;
	(badge as any).sessionService = sessionService;
	badge.playerName = playerName;
	badge.joinCharacter = character as never;
	return badge;
}

describe('CharacterShipBadge', () => {
	let sessionService: MockSessionService;
	let router: MockRouter;

	beforeEach(() => {
		sessionService = new MockSessionService();
		router = new MockRouter();
	});

	it('should reflect no active ship when none is set', () => {
		const badge = createBadge('Pioneer', { id: 'c-1', characterName: 'Nova' }, sessionService, router);
		expect(badge.activeShip()).toBeNull();
	});

	it('should reflect active ship name when one is set', () => {
		const ship = { id: 'd-1', name: 'Surveyor' } as ShipSummary;
		sessionService.setActiveShip(ship);
		const badge = createBadge('Pioneer', { id: 'c-1', characterName: 'Nova' }, sessionService, router);
		expect(badge.activeShip()?.name).toBe('Surveyor');
		expect(badge.activeShipDisplayName()).toBe('Surveyor');
	});

	it('should fall back to ship model when active ship name is missing', () => {
		const ship = { id: 'd-1', name: '   ', model: 'Scavenger Pod' } as ShipSummary;
		sessionService.setActiveShip(ship);
		const badge = createBadge('Pioneer', { id: 'c-1', characterName: 'Nova' }, sessionService, router);
		expect(badge.activeShipDisplayName()).toBe('Scavenger Pod');
	});

	it('should navigate to character-profile on navigateToCharacterProfile', () => {
		const badge = createBadge('Pioneer', { id: 'c-1', characterName: 'Nova' }, sessionService, router);
		badge.navigateToCharacterProfile();

		expect(router.navigate).toHaveBeenCalledWith(
			[{ outlets: { left: ['character-profile'] } }],
			{
				preserveFragment: true,
				state: {
					playerName: 'Pioneer',
					joinCharacter: { id: 'c-1', characterName: 'Nova' },
				},
			},
		);
	});

	it('should navigate to ship-hangar on navigateToShipHangar', () => {
		const badge = createBadge('Pioneer', { id: 'c-1', characterName: 'Nova' }, sessionService, router);
		badge.navigateToShipHangar();

		expect(router.navigate).toHaveBeenCalledWith(
			[{ outlets: { left: ['ship-hangar'] } }],
			{
				preserveFragment: true,
				state: {
					playerName: 'Pioneer',
					joinCharacter: { id: 'c-1', characterName: 'Nova' },
				},
			},
		);
	});

	it('should pass null joinCharacter through navigation state when not set', () => {
		const badge = createBadge('Pioneer', null, sessionService, router);
		badge.navigateToCharacterProfile();

		expect(router.navigate).toHaveBeenCalledWith(
			[{ outlets: { left: ['character-profile'] } }],
			jasmine.objectContaining({
				state: jasmine.objectContaining({ joinCharacter: null }),
			}),
		);
	});
});
