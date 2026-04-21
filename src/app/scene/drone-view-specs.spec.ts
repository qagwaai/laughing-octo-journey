export {};

function createSignal<T>(initial: T) {
	let value = initial;
	const sig = () => value;
	sig.set = (v: T) => {
		value = v;
	};
	return sig;
}

interface DroneViewSpecsState {
	playerName?: string;
	joinCharacter?: { id: string; characterName: string };
	joinDrone?: { id: string; name: string; model?: string; status?: string };
}

class MockDroneViewSpecsScene {
	currentRouteLabel = '/drone-view-specs';
	playerName = createSignal<string>('');
	joinCharacter = createSignal<DroneViewSpecsState['joinCharacter'] | null>(null);
	joinDrone = createSignal<DroneViewSpecsState['joinDrone'] | null>(null);

	constructor(state?: DroneViewSpecsState) {
		this.playerName.set(state?.playerName ?? '');
		this.joinCharacter.set(state?.joinCharacter ?? null);
		this.joinDrone.set(state?.joinDrone ?? null);
	}
}

describe('DroneViewSpecs Scene', () => {
	it('should initialize selected drone context from navigation state', () => {
		const component = new MockDroneViewSpecsScene({
			playerName: 'Pioneer',
			joinCharacter: { id: 'c-1', characterName: 'Nova' },
			joinDrone: { id: 'd-2', name: 'Guardian', model: 'G-Class', status: 'ACTIVE' },
		});

		expect(component.playerName()).toBe('Pioneer');
		expect(component.joinCharacter()).toEqual({ id: 'c-1', characterName: 'Nova' });
		expect(component.joinDrone()).toEqual({ id: 'd-2', name: 'Guardian', model: 'G-Class', status: 'ACTIVE' });
	});

	it('should handle missing drone context safely', () => {
		const component = new MockDroneViewSpecsScene({ playerName: 'Pioneer' });

		expect(component.playerName()).toBe('Pioneer');
		expect(component.joinCharacter()).toBeNull();
		expect(component.joinDrone()).toBeNull();
	});

	it('should define its own current route label for in-canvas display', () => {
		const component = new MockDroneViewSpecsScene();
		expect(component.currentRouteLabel).toBe('/drone-view-specs');
	});
});
