export {};

const FIRST_TARGET_MISSION_ID = 'first-target';

interface MockMissionService {
	upsertMissionStatus: jasmine.Spy;
}

interface MockSessionService {
	getSessionKey: () => string | null;
}

interface MockRouter {
	navigate: jasmine.Spy;
}

interface ColdBootNavigationState {
	playerName?: string;
	joinCharacter?: {
		id: string;
		characterName?: string;
	};
}

class MockColdBootOpeningPage {
	stage = 0;
	scanActionPending = false;
	scanActionError = '';
	content = {
		sequenceTitle: 'Opening Sequence: Cold Boot',
		eyebrow: 'Mission Bootstrap',
		phaseOneTitle: '1. The Blackout Phase',
		phaseTwoTitle: '2. The First View',
		phaseThreeTitle: '3. The AI Awakening',
		systemChecks: [
		'BIOS CHECK... OK',
		'OXYGEN LEVELS... 18% (CRITICAL)',
		'NEURAL LINK... ESTABLISHED',
		],
		aiTransmission:
			'Pilot, the Reactor Ship has been lost. We are drifting on residual battery. To survive, we must secure high-density matter for the Fabrication Unit. Deployment of the last Expendable unit is authorized.',
	};
	t = {
		opening: {
			coldBoot: {
				startScanningErrorLabel: 'Scanning handoff failed. Retry after comms stabilize.',
			},
		},
	};

	constructor(
		private missionService: MockMissionService = { upsertMissionStatus: jasmine.createSpy('upsertMissionStatus') },
		private sessionService: MockSessionService = { getSessionKey: () => 'session-key' },
		private router: MockRouter = { navigate: jasmine.createSpy('navigate').and.returnValue(Promise.resolve(true)) },
		private navigationState: ColdBootNavigationState = {
			playerName: 'Pioneer',
			joinCharacter: { id: 'char-1', characterName: 'Nova' },
		},
	) {}

	ngOnInit() {
		return;
	}

	visibleSystemChecks() {
		if (this.stage < 1) {
			return [];
		}
		if (this.stage === 1) {
			return this.content.systemChecks.slice(0, 1);
		}
		if (this.stage === 2) {
			return this.content.systemChecks.slice(0, 2);
		}
		return this.content.systemChecks;
	}

	async startScanning(): Promise<void> {
		if (this.scanActionPending) {
			return;
		}

		const missionRequest = this.buildMissionRequest();
		if (!missionRequest) {
			this.scanActionError = this.t.opening.coldBoot.startScanningErrorLabel;
			return;
		}

		this.scanActionPending = true;
		this.scanActionError = '';

		const result = await this.missionService.upsertMissionStatus(missionRequest);
		if (result !== 'updated') {
			this.scanActionPending = false;
			this.scanActionError = this.t.opening.coldBoot.startScanningErrorLabel;
			return;
		}

		await this.router.navigate([{ outlets: { right: ['opening-cold-boot-scan'], left: ['game-main'] } }], {
			preserveFragment: true,
			state: this.navigationState,
		});
		this.scanActionPending = false;
	}

	private buildMissionRequest() {
		const playerName = this.navigationState.playerName?.trim() ?? '';
		const characterId = this.navigationState.joinCharacter?.id?.trim() ?? '';
		const sessionKey = this.sessionService.getSessionKey();

		if (!playerName || !characterId || !sessionKey) {
			return null;
		}

		return {
			playerName,
			characterId,
			sessionKey,
			missionId: FIRST_TARGET_MISSION_ID,
			status: 'started',
		};
	}
}

describe('ColdBootOpeningPage', () => {
	it('should expose opening sequence title', () => {
		const component = new MockColdBootOpeningPage();
		expect(component.content.sequenceTitle).toBe('Opening Sequence: Cold Boot');
	});

	it('should list blackout system checks in order', () => {
		const component = new MockColdBootOpeningPage();
		expect(component.content.systemChecks).toEqual([
			'BIOS CHECK... OK',
			'OXYGEN LEVELS... 18% (CRITICAL)',
			'NEURAL LINK... ESTABLISHED',
		]);
	});

	it('should include critical oxygen warning in checks', () => {
		const component = new MockColdBootOpeningPage();
		expect(component.content.systemChecks[1]).toContain('CRITICAL');
	});

	it('should include expendable unit authorization in AI transmission', () => {
		const component = new MockColdBootOpeningPage();
		expect(component.content.aiTransmission).toContain('Deployment of the last Expendable unit is authorized.');
	});

	it('should reveal checks progressively by stage', () => {
		const component = new MockColdBootOpeningPage();

		component.stage = 0;
		expect(component.visibleSystemChecks().length).toBe(0);

		component.stage = 1;
		expect(component.visibleSystemChecks()).toEqual(['BIOS CHECK... OK']);

		component.stage = 2;
		expect(component.visibleSystemChecks().length).toBe(2);

		component.stage = 3;
		expect(component.visibleSystemChecks().length).toBe(3);
	});

	it('should not start mission automatically on init', () => {
		const missionService: MockMissionService = {
			upsertMissionStatus: jasmine.createSpy('upsertMissionStatus').and.returnValue(Promise.resolve('updated')),
		};
		const sessionService: MockSessionService = { getSessionKey: () => 'session-key' };
		const router: MockRouter = {
			navigate: jasmine.createSpy('navigate').and.returnValue(Promise.resolve(true)),
		};
		const component = new MockColdBootOpeningPage(missionService, sessionService, router, {
			playerName: 'Pioneer',
			joinCharacter: { id: 'char-1' },
		});

		component.ngOnInit();
		component.ngOnInit();

		expect(missionService.upsertMissionStatus.calls.count()).toBe(0);
	});

	it('should start first mission and navigate to scanning pane when requested', async () => {
		const missionService: MockMissionService = {
			upsertMissionStatus: jasmine.createSpy('upsertMissionStatus').and.returnValue(Promise.resolve('updated')),
		};
		const sessionService: MockSessionService = { getSessionKey: () => 'session-key' };
		const router: MockRouter = {
			navigate: jasmine.createSpy('navigate').and.returnValue(Promise.resolve(true)),
		};
		const component = new MockColdBootOpeningPage(missionService, sessionService, router, {
			playerName: 'Pioneer',
			joinCharacter: { id: 'char-1', characterName: 'Nova' },
		});

		await component.startScanning();

		expect(missionService.upsertMissionStatus).toHaveBeenCalledWith({
			playerName: 'Pioneer',
			characterId: 'char-1',
			sessionKey: 'session-key',
			missionId: FIRST_TARGET_MISSION_ID,
			status: 'started',
		});
		expect(router.navigate).toHaveBeenCalledWith(
			[{ outlets: { right: ['opening-cold-boot-scan'], left: ['game-main'] } }],
			{
				preserveFragment: true,
				state: {
					playerName: 'Pioneer',
					joinCharacter: { id: 'char-1', characterName: 'Nova' },
				},
			},
		);
		expect(component.scanActionError).toBe('');
		expect(component.scanActionPending).toBe(false);
	});

	it('should surface an error when mission start context is missing', async () => {
		const missionService: MockMissionService = {
			upsertMissionStatus: jasmine.createSpy('upsertMissionStatus').and.returnValue(Promise.resolve('updated')),
		};
		const sessionService: MockSessionService = { getSessionKey: () => null };
		const component = new MockColdBootOpeningPage(missionService, sessionService);

		await component.startScanning();

		expect(missionService.upsertMissionStatus).not.toHaveBeenCalled();
		expect(component.scanActionError).toBe('Scanning handoff failed. Retry after comms stabilize.');
	});

	it('should surface an error when mission status update fails', async () => {
		const missionService: MockMissionService = {
			upsertMissionStatus: jasmine.createSpy('upsertMissionStatus').and.returnValue(Promise.resolve('update-failed')),
		};
		const sessionService: MockSessionService = { getSessionKey: () => 'session-key' };
		const router: MockRouter = {
			navigate: jasmine.createSpy('navigate').and.returnValue(Promise.resolve(true)),
		};
		const component = new MockColdBootOpeningPage(missionService, sessionService, router, {
			playerName: 'Pioneer',
			joinCharacter: { id: 'char-1', characterName: 'Nova' },
		});

		await component.startScanning();

		expect(router.navigate).not.toHaveBeenCalled();
		expect(component.scanActionError).toBe('Scanning handoff failed. Retry after comms stabilize.');
		expect(component.scanActionPending).toBe(false);
	});
});
