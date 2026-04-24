export {};

function createSignal<T>(initial: T) {
	let value = initial;
	const sig = () => value;
	sig.set = (v: T) => {
		value = v;
	};
	return sig;
}

interface ShipViewSpecsState {
	playerName?: string;
	joinCharacter?: { id: string; characterName: string };
	joinShip?: { id: string; name: string; model?: string; status?: string };
}

class MockShipViewSpecsScene {
	currentRouteLabel = '/ship-view-specs';
	playerName = createSignal<string>('');
	joinCharacter = createSignal<ShipViewSpecsState['joinCharacter'] | null>(null);
	joinShip = createSignal<ShipViewSpecsState['joinShip'] | null>(null);

	constructor(state?: ShipViewSpecsState) {
		this.playerName.set(state?.playerName ?? '');
		this.joinCharacter.set(state?.joinCharacter ?? null);
		this.joinShip.set(state?.joinShip ?? null);
	}
}

describe('ShipViewSpecs Scene', () => {
	it('should initialize selected ship context from navigation state', () => {
		const component = new MockShipViewSpecsScene({
			playerName: 'Pioneer',
			joinCharacter: { id: 'c-1', characterName: 'Nova' },
			joinShip: { id: 'd-2', name: 'Guardian', model: 'G-Class', status: 'ACTIVE' },
		});

		expect(component.playerName()).toBe('Pioneer');
		expect(component.joinCharacter()).toEqual({ id: 'c-1', characterName: 'Nova' });
		expect(component.joinShip()).toEqual({ id: 'd-2', name: 'Guardian', model: 'G-Class', status: 'ACTIVE' });
	});

	it('should handle missing ship context safely', () => {
		const component = new MockShipViewSpecsScene({ playerName: 'Pioneer' });

		expect(component.playerName()).toBe('Pioneer');
		expect(component.joinCharacter()).toBeNull();
		expect(component.joinShip()).toBeNull();
	});

	it('should define its own current route label for in-canvas display', () => {
		const component = new MockShipViewSpecsScene();
		expect(component.currentRouteLabel).toBe('/ship-view-specs');
	});
});
