function createSignal<T>(initial: T) {
	let value = initial;
	const sig = () => value;
	sig.set = (v: T) => {
		value = v;
	};
	return sig;
}

interface GameJoinState {
	playerName?: string;
	joinCharacter?: {
		id: string;
		characterName: string;
		level?: number;
	};
}

class MockGameJoinPage {
	playerName = createSignal<string>('');
	joinCharacter = createSignal<GameJoinState['joinCharacter'] | null>(null);
	characterName = createSignal<string>('Unknown Character');

	constructor(state?: GameJoinState) {
		this.playerName.set(state?.playerName ?? '');
		this.joinCharacter.set(state?.joinCharacter ?? null);
		this.characterName.set(state?.joinCharacter?.characterName ?? 'Unknown Character');
	}
}

describe('GameJoinPage', () => {
	it('should initialize character name from navigation state', () => {
		const component = new MockGameJoinPage({
			playerName: 'Pioneer',
			joinCharacter: { id: 'c-1', characterName: 'Nova-Prime', level: 7 },
		});

		expect(component.playerName()).toBe('Pioneer');
		expect(component.joinCharacter()).toEqual({ id: 'c-1', characterName: 'Nova-Prime', level: 7 });
		expect(component.characterName()).toBe('Nova-Prime');
	});

	it('should fall back to Unknown Character when no character is provided', () => {
		const component = new MockGameJoinPage({ playerName: 'Pioneer' });

		expect(component.playerName()).toBe('Pioneer');
		expect(component.joinCharacter()).toBeNull();
		expect(component.characterName()).toBe('Unknown Character');
	});
});
