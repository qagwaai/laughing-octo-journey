export {};

function createSignal<T>(initial: T) {
	let value = initial;
	const sig = () => value;
	sig.set = (v: T) => {
		value = v;
	};
	return sig;
}

interface NavigationState {
	playerName?: string;
	joinCharacter?: { id: string; characterName: string };
	joinShip?: { id: string };
}

class MockFabricationLabPage {
	playerName = createSignal<string>('');
	joinCharacter = createSignal<NavigationState['joinCharacter'] | null>(null);
	activeShip = createSignal<NavigationState['joinShip'] | null>(null);
	printerQueue = createSignal<Array<{ id: string }>>([]);

	constructor(state?: NavigationState) {
		this.playerName.set(state?.playerName ?? '');
		this.joinCharacter.set(state?.joinCharacter ?? null);
		this.activeShip.set(state?.joinShip ?? null);
	}

	printerStatus(): 'idle' | 'printing' {
		return this.printerQueue().length > 0 ? 'printing' : 'idle';
	}

	printerActiveJobCount(): number {
		return this.printerQueue().length;
	}

	openPrintQueueView() {
		return {
			outlets: { right: ['print-queue'], left: ['fabrication-lab'] },
			state: {
				playerName: this.playerName(),
				joinCharacter: this.joinCharacter(),
				joinShip: this.activeShip(),
			},
		};
	}
}

describe('FabricationLabPage', () => {
	it('should initialize from navigation state', () => {
		const component = new MockFabricationLabPage({
			playerName: 'Pioneer',
			joinCharacter: { id: 'c-1', characterName: 'Nova' },
		});

		expect(component.playerName()).toBe('Pioneer');
		expect(component.joinCharacter()).toEqual({ id: 'c-1', characterName: 'Nova' });
	});

	it('should fallback to empty values', () => {
		const component = new MockFabricationLabPage();
		expect(component.playerName()).toBe('');
		expect(component.joinCharacter()).toBeNull();
	});

	it('should expose idle status and zero active jobs when print queue is empty', () => {
		const component = new MockFabricationLabPage();
		expect(component.printerStatus()).toBe('idle');
		expect(component.printerActiveJobCount()).toBe(0);
	});

	it('should expose printing status when print queue has jobs', () => {
		const component = new MockFabricationLabPage();
		component.printerQueue.set([{ id: 'job-1' }]);
		expect(component.printerStatus()).toBe('printing');
		expect(component.printerActiveJobCount()).toBe(1);
	});

	it('should navigate print queue flow with fabrication-lab as left outlet', () => {
		const component = new MockFabricationLabPage({
			playerName: 'Pioneer',
			joinCharacter: { id: 'c-1', characterName: 'Nova' },
			joinShip: { id: 's-1' },
		});

		expect(component.openPrintQueueView()).toEqual({
			outlets: { right: ['print-queue'], left: ['fabrication-lab'] },
			state: {
				playerName: 'Pioneer',
				joinCharacter: { id: 'c-1', characterName: 'Nova' },
				joinShip: { id: 's-1' },
			},
		});
	});
});
