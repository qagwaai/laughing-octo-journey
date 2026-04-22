export {};

const FIRST_TARGET_MISSION_ID = 'first-target';

interface MockMissionService {
	ensureMissionExists: jasmine.Spy;
}

interface MockSessionService {
	getSessionKey: () => string | null;
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
	private didRequestInitialMission = false;
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
			'Pilot, the Reactor Drone has been lost. We are drifting on residual battery. To survive, we must secure high-density matter for the Fabrication Unit. Deployment of the last Expendable unit is authorized.',
	};

	constructor(
		private missionService: MockMissionService = { ensureMissionExists: jasmine.createSpy('ensureMissionExists') },
		private sessionService: MockSessionService = { getSessionKey: () => 'session-key' },
		private navigationState: ColdBootNavigationState = {
			playerName: 'Pioneer',
			joinCharacter: { id: 'char-1', characterName: 'Nova' },
		},
	) {}

	ngOnInit() {
		this.requestInitialMission();
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

	private requestInitialMission(): void {
		if (this.didRequestInitialMission) {
			return;
		}

		const playerName = this.navigationState.playerName?.trim() ?? '';
		const characterId = this.navigationState.joinCharacter?.id?.trim() ?? '';
		const sessionKey = this.sessionService.getSessionKey();

		if (!playerName || !characterId || !sessionKey) {
			return;
		}

		this.didRequestInitialMission = true;
		void this.missionService.ensureMissionExists({
			playerName,
			characterId,
			sessionKey,
			missionId: FIRST_TARGET_MISSION_ID,
			initialStatus: 'started',
		});
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

	it('should request first mission once on init', () => {
		const missionService: MockMissionService = {
			ensureMissionExists: jasmine.createSpy('ensureMissionExists').and.returnValue(Promise.resolve('added')),
		};
		const sessionService: MockSessionService = { getSessionKey: () => 'session-key' };
		const component = new MockColdBootOpeningPage(missionService, sessionService, {
			playerName: 'Pioneer',
			joinCharacter: { id: 'char-1' },
		});

		component.ngOnInit();
		component.ngOnInit();

		expect(missionService.ensureMissionExists.calls.count()).toBe(1);
		expect(missionService.ensureMissionExists).toHaveBeenCalledWith({
			playerName: 'Pioneer',
			characterId: 'char-1',
			sessionKey: 'session-key',
			missionId: FIRST_TARGET_MISSION_ID,
			initialStatus: 'started',
		});
	});

	it('should not request mission when required context is missing', () => {
		const missionService: MockMissionService = {
			ensureMissionExists: jasmine.createSpy('ensureMissionExists').and.returnValue(Promise.resolve('added')),
		};
		const sessionService: MockSessionService = { getSessionKey: () => null };
		const component = new MockColdBootOpeningPage(missionService, sessionService, {
			playerName: 'Pioneer',
			joinCharacter: { id: 'char-1' },
		});

		component.ngOnInit();

		expect(missionService.ensureMissionExists.calls.count()).toBe(0);
	});
});
