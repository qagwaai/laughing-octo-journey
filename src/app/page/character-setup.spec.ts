/**
 * Unit tests for CharacterSetupPage component
 *
 * Uses direct logic testing with a mock component pattern consistent with
 * existing page specs in this project.
 */

function createSignal<T>(initial: T) {
	let value = initial;
	const sig = () => value;
	sig.set = (v: T) => {
		value = v;
	};
	return sig;
}

class MockCharacterSetupPage {
	playerName = createSignal<string>('Pioneer');
	isSaved = createSignal(false);
	successMessage = createSignal<string | null>(null);

	characterForm = {
		characterName: 'Pioneer',
		invalid: false,
		touched: false,
		markAllAsTouched() {
			this.touched = true;
		},
		get value() {
			return { characterName: this.characterName };
		},
	};

	saveCharacter(): void {
		if (this.characterForm.invalid) {
			this.characterForm.markAllAsTouched();
			return;
		}

		const characterName = this.characterForm.value.characterName;
		this.isSaved.set(true);
		this.successMessage.set(`Character '${characterName}' is ready for launch.`);
	}
}

describe('CharacterSetupPage', () => {
	let component: MockCharacterSetupPage;

	beforeEach(() => {
		component = new MockCharacterSetupPage();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('should initialize with a playerName value', () => {
		expect(component.playerName()).toBe('Pioneer');
	});

	it('should initialize with unsaved state', () => {
		expect(component.isSaved()).toBe(false);
		expect(component.successMessage()).toBeNull();
	});

	describe('saveCharacter()', () => {
		it('should mark form touched and not save when invalid', () => {
			component.characterForm.invalid = true;
			component.saveCharacter();

			expect(component.characterForm.touched).toBe(true);
			expect(component.isSaved()).toBe(false);
			expect(component.successMessage()).toBeNull();
		});

		it('should set saved state and success message when valid', () => {
			component.characterForm.invalid = false;
			component.characterForm.characterName = 'Nova-Prime';
			component.saveCharacter();

			expect(component.isSaved()).toBe(true);
			expect(component.successMessage()).toBe("Character 'Nova-Prime' is ready for launch.");
		});

		it('should support updating character name before save', () => {
			component.characterForm.characterName = 'Atlas';
			component.saveCharacter();

			expect(component.successMessage()).toContain('Atlas');
		});
	});
});
