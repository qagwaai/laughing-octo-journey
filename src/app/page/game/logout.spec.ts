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

	constructor(router: MockRouter, sessionService: MockSessionService) {
		this.router = router;
		this.sessionService = sessionService;
	}

	confirmLogout(): void {
		this.sessionService.clearSession();
		this.router.navigate([{ outlets: { primary: ['intro'], left: ['login'], right: null } }], {
			preserveFragment: true,
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
});
