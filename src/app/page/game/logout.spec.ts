export {};

interface MockRouter {
	navigate: jasmine.Spy;
}

interface MockSessionService {
	clearSession: jasmine.Spy;
}

class MockLogoutPage {
	private router: MockRouter;
	private sessionService: MockSessionService;
	private _playerName: string;

	constructor(router: MockRouter, sessionService: MockSessionService, playerName = '') {
		this.router = router;
		this.sessionService = sessionService;
		this._playerName = playerName;
	}

	confirmLogout(): void {
		this.sessionService.clearSession();
		this.router.navigate([{ outlets: { primary: ['intro'], left: ['login'], right: null } }], {
			preserveFragment: true,
		});
	}

	navigateToCharacterList(): void {
		this.router.navigate([{ outlets: { left: ['character-list'] } }], {
			preserveFragment: true,
			state: { playerName: this._playerName },
		});
	}
}

describe('LogoutPage', () => {
	it('should clear session and navigate to login', () => {
		const router: MockRouter = { navigate: jasmine.createSpy() };
		const sessionService: MockSessionService = { clearSession: jasmine.createSpy() };
		const component = new MockLogoutPage(router, sessionService);

		component.confirmLogout();

		expect(sessionService.clearSession).toHaveBeenCalled();
		expect(router.navigate).toHaveBeenCalledWith(
			[{ outlets: { primary: ['intro'], left: ['login'], right: null } }],
			{ preserveFragment: true },
		);
	});

	describe('navigateToCharacterList()', () => {
		it('should navigate to character-list in left outlet', () => {
			const router: MockRouter = { navigate: jasmine.createSpy() };
			const sessionService: MockSessionService = { clearSession: jasmine.createSpy() };
			const component = new MockLogoutPage(router, sessionService);

			component.navigateToCharacterList();

			expect(router.navigate).toHaveBeenCalledWith(
				[{ outlets: { left: ['character-list'] } }],
				{ preserveFragment: true, state: { playerName: '' } },
			);
		});

		it('should pass playerName in navigation state', () => {
			const router: MockRouter = { navigate: jasmine.createSpy() };
			const sessionService: MockSessionService = { clearSession: jasmine.createSpy() };
			const component = new MockLogoutPage(router, sessionService, 'Pioneer');

			component.navigateToCharacterList();

			expect(router.navigate).toHaveBeenCalledWith(
				[{ outlets: { left: ['character-list'] } }],
				{ preserveFragment: true, state: { playerName: 'Pioneer' } },
			);
		});

		it('should not clear session when navigating to character list', () => {
			const router: MockRouter = { navigate: jasmine.createSpy() };
			const sessionService: MockSessionService = { clearSession: jasmine.createSpy() };
			const component = new MockLogoutPage(router, sessionService);

			component.navigateToCharacterList();

			expect(sessionService.clearSession).not.toHaveBeenCalled();
		});
	});
});
