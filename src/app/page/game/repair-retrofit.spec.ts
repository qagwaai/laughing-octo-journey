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
}

class MockRepairRetrofitPage {
	playerName = createSignal<string>('');
	joinCharacter = createSignal<NavigationState['joinCharacter'] | null>(null);

	constructor(state?: NavigationState) {
		this.playerName.set(state?.playerName ?? '');
		this.joinCharacter.set(state?.joinCharacter ?? null);
	}
}

describe('RepairRetrofitPage', () => {
	it('should initialize from navigation state', () => {
		const component = new MockRepairRetrofitPage({
			playerName: 'Pioneer',
			joinCharacter: { id: 'c-1', characterName: 'Nova' },
		});

		expect(component.playerName()).toBe('Pioneer');
		expect(component.joinCharacter()).toEqual({ id: 'c-1', characterName: 'Nova' });
	});

	it('should fallback to empty values', () => {
		const component = new MockRepairRetrofitPage();
		expect(component.playerName()).toBe('');
		expect(component.joinCharacter()).toBeNull();
	});
});
