export {};

/**
 * Unit tests for PrintQueuePage component.
 * Uses the mock-component pattern consistent with other page specs in this project.
 */

function createSignal<T>(initial: T) {
	let value = initial;
	const signal = () => value;
	signal.set = (next: T) => { value = next; };
	signal.update = (fn: (v: T) => T) => { value = fn(value); };
	return signal;
}

interface MockRouter {
	navigate: jasmine.Spy;
}

interface MockPrintQueueItem {
	id: string;
	itemType: string;
	label: string;
	startedAt: string;
	durationMs: number;
	consumedMaterials?: Array<{ id: string; itemType: string; label: string }>;
}

class MockPrintQueuePage {
	private router: MockRouter;
	private _playerName: string;
	private _characterId: string;
	private _shipId: string;
	private _queue: MockPrintQueueItem[];

	constructor(
		router: MockRouter,
		playerName = 'Pioneer',
		characterId = 'char-1',
		shipId = 'ship-1',
		queue: MockPrintQueueItem[] = [],
	) {
		this.router = router;
		this._playerName = playerName;
		this._characterId = characterId;
		this._shipId = shipId;
		this._queue = queue;
	}

	printerStatus(): 'printing' | 'idle' {
		return this._queue.length > 0 ? 'printing' : 'idle';
	}

	formatRemainingTime(ms: number): string {
		if (ms <= 0) {
			return '0:00';
		}

		const totalSeconds = Math.floor(ms / 1000);
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = totalSeconds % 60;
		return `${minutes}:${seconds.toString().padStart(2, '0')}`;
	}

	navigateBack(): void {
		this.router.navigate(
			[{ outlets: { right: null, left: ['repair-retrofit'] } }],
			{ preserveFragment: true, state: { playerName: this._playerName } },
		);
	}
}

describe('PrintQueuePage', () => {
	let router: MockRouter;
	let component: MockPrintQueuePage;

	beforeEach(() => {
		router = { navigate: jasmine.createSpy() };
		component = new MockPrintQueuePage(router);
	});

	describe('printerStatus()', () => {
		it('should return idle when queue is empty', () => {
			expect(component.printerStatus()).toBe('idle');
		});

		it('should return printing when queue has items', () => {
			const componentWithJobs = new MockPrintQueuePage(router, 'Pioneer', 'char-1', 'ship-1', [
				{ id: 'job-1', itemType: 'hull-patch-kit', label: 'Hull Patch Kit', startedAt: new Date().toISOString(), durationMs: 60000 },
			]);
			expect(componentWithJobs.printerStatus()).toBe('printing');
		});
	});

	describe('formatRemainingTime()', () => {
		it('should return 0:00 for zero or negative ms', () => {
			expect(component.formatRemainingTime(0)).toBe('0:00');
			expect(component.formatRemainingTime(-1000)).toBe('0:00');
		});

		it('should format under 1 minute correctly', () => {
			expect(component.formatRemainingTime(30000)).toBe('0:30');
			expect(component.formatRemainingTime(9000)).toBe('0:09');
		});

		it('should format minutes and seconds correctly', () => {
			expect(component.formatRemainingTime(90000)).toBe('1:30');
			expect(component.formatRemainingTime(125000)).toBe('2:05');
		});

		it('should pad seconds with leading zero', () => {
			expect(component.formatRemainingTime(61000)).toBe('1:01');
		});
	});

	describe('navigateBack()', () => {
		it('should navigate to repair-retrofit in left outlet and close right outlet', () => {
			component.navigateBack();

			expect(router.navigate).toHaveBeenCalledWith(
				[{ outlets: { right: null, left: ['repair-retrofit'] } }],
				jasmine.objectContaining({ preserveFragment: true }),
			);
		});

		it('should include playerName in navigation state', () => {
			const componentWithPlayer = new MockPrintQueuePage(router, 'Vega');
			componentWithPlayer.navigateBack();

			expect(router.navigate).toHaveBeenCalledWith(
				jasmine.anything(),
				jasmine.objectContaining({ state: jasmine.objectContaining({ playerName: 'Vega' }) }),
			);
		});
	});
});
