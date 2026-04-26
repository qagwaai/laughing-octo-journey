/**
 * Unit tests for CharacterSetupPage component
 *
 * Uses direct logic testing with a mock component pattern consistent with
 * existing page specs in this project.
 */

import {
	CHARACTER_ADD_REQUEST_EVENT,
	CHARACTER_ADD_RESPONSE_EVENT,
	CharacterAddRequest,
	CharacterAddResponse,
} from '../../model/character-add';
import {
	CHARACTER_EDIT_REQUEST_EVENT,
	CHARACTER_EDIT_RESPONSE_EVENT,
	CharacterEditResponse,
} from '../../model/character-edit';
import {
	SHIP_LIST_REQUEST_EVENT,
	SHIP_LIST_RESPONSE_EVENT,
	type ShipListResponse,
} from '../../model/ship-list';
import {
	SHIP_UPSERT_REQUEST_EVENT,
	SHIP_UPSERT_RESPONSE_EVENT,
} from '../../model/ship-upsert';
import {
	ITEM_UPSERT_REQUEST_EVENT,
	ITEM_UPSERT_RESPONSE_EVENT,
} from '../../model/item-upsert';
import {
	EXPENDABLE_DART_DRONE_ITEM_TYPE,
	EXPENDABLE_DART_DRONE_DISPLAY_NAME,
	createExpendableDartDrone,
} from '../../model/expendable-dart-drone';
import { generateDeterministicStarterShipUpdate } from '../../model/starter-ship';
import { INVALID_SESSION_EVENT } from '../../model/session';

function createSignal<T>(initial: T) {
	let value = initial;
	const sig = () => value;
	sig.set = (v: T) => {
		value = v;
	};
	return sig;
}

interface MockRouter {
	navigate: jasmine.Spy;
}

interface MockSessionService {
	storedKey: string | null;
	setSessionKey(key: string): void;
	getSessionKey(): string | null;
	clearSession(): void;
	hasSession(): boolean;
}

interface MockSocketService {
	emittedEvents: Array<{ event: string; data: any }>;
	registeredListeners: Map<string, (data: any) => void>;
	onceListeners: Map<string, (data: any) => void>;
	emit(event: string, data?: any): void;
	on(event: string, cb: (data: any) => void): () => void;
	once(event: string, cb: (data: any) => void): void;
	upsertShip(request: any, onResponse?: (r: any) => void): void;
	upsertItem(request: any, onResponse?: (r: any) => void): void;
	triggerEvent(event: string, data: any): void;
	triggerOnce(event: string, data: any): void;
}

interface SetupState {
	playerName?: string;
	mode?: 'create' | 'edit';
	editCharacter?: { id: string; characterName: string; level?: number };
}

function createMockSocketService(): MockSocketService {
	const emittedEvents: Array<{ event: string; data: any }> = [];
	const registeredListeners = new Map<string, (data: any) => void>();
	const onceListeners = new Map<string, (data: any) => void>();

	const service: MockSocketService = {
		emittedEvents,
		registeredListeners,
		onceListeners,
		emit(event: string, data?: any) {
			emittedEvents.push({ event, data });
		},
		on(event: string, cb: (data: any) => void) {
			registeredListeners.set(event, cb);
			return () => registeredListeners.delete(event);
		},
		once(event: string, cb: (data: any) => void) {
			onceListeners.set(event, cb);
		},
		upsertShip(request: any, onResponse?: (r: any) => void) {
			if (onResponse) { service.once(SHIP_UPSERT_RESPONSE_EVENT, onResponse); }
			service.emit(SHIP_UPSERT_REQUEST_EVENT, request);
		},
		upsertItem(request: any, onResponse?: (r: any) => void) {
			if (onResponse) { service.once(ITEM_UPSERT_RESPONSE_EVENT, onResponse); }
			service.emit(ITEM_UPSERT_REQUEST_EVENT, request);
		},
		triggerEvent(event: string, data: any) {
			registeredListeners.get(event)?.(data);
		},
		triggerOnce(event: string, data: any) {
			const cb = onceListeners.get(event);
			if (cb) {
				onceListeners.delete(event);
				cb(data);
			}
		},
	};
	return service;
}

function createMockSessionService(initialKey: string | null = null): MockSessionService {
	const state = { key: initialKey };
	return {
		get storedKey() { return state.key; },
		setSessionKey(key: string) { state.key = key; },
		getSessionKey() { return state.key; },
		clearSession() { state.key = null; },
		hasSession() { return state.key !== null; },
	};
}

class MockCharacterSetupPage {
	private router: MockRouter;
	private socketService: MockSocketService;
	private sessionService: MockSessionService;
	private unsubscribeAddResponse?: () => void;
	private unsubscribeShipListResponse?: () => void;
	private unsubscribeInvalidSession?: () => void;
	private editCharacterId: string | null = null;

	playerName = createSignal<string>('Pioneer');
	isEditMode = createSignal(false);
	isSaved = createSignal(false);
	successMessage = createSignal<string | null>(null);
	errorMessage = createSignal<string | null>(null);
	warningMessage = createSignal<string | null>(null);
	isSubmitting = createSignal(false);

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

	constructor(
		router: MockRouter,
		socketService: MockSocketService,
		sessionService: MockSessionService,
		setupState?: SetupState,
	) {
		this.router = router;
		this.socketService = socketService;
		this.sessionService = sessionService;

		if (setupState?.playerName !== undefined) {
			this.playerName.set(setupState.playerName);
		}

		if (setupState?.mode === 'edit' && setupState.editCharacter) {
			this.isEditMode.set(true);
			this.characterForm.characterName = setupState.editCharacter.characterName;
			this.editCharacterId = setupState.editCharacter.id;
		} else {
			this.characterForm.characterName = this.playerName();
		}

		this.unsubscribeInvalidSession = this.socketService.on(
			INVALID_SESSION_EVENT,
			() => {
				this.sessionService.clearSession();
				this.router.navigate([{ outlets: { left: ['login'] } }], { preserveFragment: true });
			},
		);
	}

	saveCharacter(): void {
		if (this.characterForm.invalid) {
			this.characterForm.markAllAsTouched();
			return;
		}

		const playerName = this.playerName().trim();
		const characterName = this.characterForm.value.characterName;

		if (!playerName) {
			this.errorMessage.set('Player name is required to save a character.');
			this.isSaved.set(false);
			return;
		}

		this.isSubmitting.set(true);
		this.errorMessage.set(null);
		this.successMessage.set(null);
		this.isSaved.set(false);
		this.unsubscribeAddResponse?.();

		const isEditMode = this.isEditMode();
		if (isEditMode && !this.editCharacterId) {
			this.isSubmitting.set(false);
			this.errorMessage.set('Character id is required to edit a character.');
			return;
		}

		const responseEventName = isEditMode ? CHARACTER_EDIT_RESPONSE_EVENT : CHARACTER_ADD_RESPONSE_EVENT;

		this.unsubscribeAddResponse = this.socketService.on(
			responseEventName,
			(response: CharacterAddResponse | CharacterEditResponse) => {
				this.isSubmitting.set(false);
				if (response.success) {
					this.isSaved.set(true);
					this.successMessage.set(response.message);
					this.errorMessage.set(null);				if (!isEditMode) {
					const addResponse = response as CharacterAddResponse;
					this.createStarterShipForCharacter(addResponse.characterId);
				}				} else {
					this.isSaved.set(false);
					this.successMessage.set(null);
					this.errorMessage.set(response.message);
				}
				this.unsubscribeAddResponse?.();
			},
		);

		if (isEditMode) {
			this.socketService.emit(CHARACTER_EDIT_REQUEST_EVENT, {
				characterId: this.editCharacterId!,
				playerName,
				characterName,
				sessionKey: this.sessionService.getSessionKey()!,
			});
			return;
		}

		const request: CharacterAddRequest = { playerName, characterName, sessionKey: this.sessionService.getSessionKey()! };
		this.socketService.emit(CHARACTER_ADD_REQUEST_EVENT, request);
	}

	private createStarterShipForCharacter(characterId?: string): void {
		const playerName = this.playerName().trim();
		const sessionKey = this.sessionService.getSessionKey()?.trim() ?? '';
		const resolvedCharacterId = characterId?.trim() ?? '';

		if (!playerName || !sessionKey || !resolvedCharacterId) {
			this.warningMessage.set('Character created, but starter ship initialization is pending.');
			return;
		}

		this.unsubscribeShipListResponse?.();
		this.unsubscribeShipListResponse = this.socketService.on(
			SHIP_LIST_RESPONSE_EVENT,
			(response: ShipListResponse) => {
				this.unsubscribeShipListResponse?.();
				if (!response.success) {
					this.warningMessage.set('Character created, but starter ship could not be resolved yet.');
					return;
				}

				const starterShipId = response.ships?.[0]?.id?.trim();
				if (!starterShipId) {
					this.warningMessage.set('Character created, but no starter ship record was returned.');
					return;
				}

				const starterShipHasDrone =
					response.ships?.[0]?.inventory?.some(
						(item) => item.itemType === EXPENDABLE_DART_DRONE_ITEM_TYPE,
					) ?? false;

				const shipUpdate = generateDeterministicStarterShipUpdate(playerName, resolvedCharacterId, starterShipId);
				this.socketService.upsertShip(
					{
						playerName,
						characterId: resolvedCharacterId,
						sessionKey,
						ship: shipUpdate,
					},
					(upsertResponse: any) => {
						if (!upsertResponse.success) {
							this.warningMessage.set('Character created, but starter ship position update failed.');
							return;
						}

						const upsertedShipHasDrone =
							upsertResponse.ship?.inventory?.some(
								(item: any) => item.itemType === EXPENDABLE_DART_DRONE_ITEM_TYPE,
							) ?? false;

						if (starterShipHasDrone || upsertedShipHasDrone) {
							this.warningMessage.set(null);
							return;
						}

						this.socketService.upsertItem(
							{
								playerName,
								sessionKey,
								item: {
									itemType: EXPENDABLE_DART_DRONE_ITEM_TYPE,
									displayName: EXPENDABLE_DART_DRONE_DISPLAY_NAME,
									state: 'contained',
									damageStatus: 'intact',
									container: { containerType: 'ship', containerId: starterShipId },
									owningPlayerId: playerName,
									owningCharacterId: resolvedCharacterId,
								},
							},
							(itemResponse: any) => {
								if (!itemResponse.success) {
									this.warningMessage.set('Ship updated, but starter drone could not be created.');
									return;
								}

								this.warningMessage.set(null);
							},
						);
					},
				);
			},
		);

		this.socketService.emit(SHIP_LIST_REQUEST_EVENT, {
			playerName,
			characterId: resolvedCharacterId,
			sessionKey,
		});
	}

	navigateToCharacterList(): void {
		const playerName = this.playerName() || this.characterForm.value.characterName || '';
		this.router.navigate([{ outlets: { left: ['character-list'] } }], {
			preserveFragment: true,
			state: { playerName },
		});
	}

	ngOnDestroy(): void {
		this.unsubscribeAddResponse?.();
		this.unsubscribeShipListResponse?.();
		this.unsubscribeInvalidSession?.();
	}
}

describe('CharacterSetupPage', () => {
	let component: MockCharacterSetupPage;
	let router: MockRouter;
	let socketService: MockSocketService;
	let sessionService: MockSessionService;

	beforeEach(() => {
		router = { navigate: jasmine.createSpy() };
		socketService = createMockSocketService();
		sessionService = createMockSessionService('test-session-key');
		component = new MockCharacterSetupPage(router, socketService, sessionService);
	});

	afterEach(() => {
		component.ngOnDestroy();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('should initialize with a playerName value', () => {
		expect(component.playerName()).toBe('Pioneer');
	});

	it('should initialize form in edit mode using selected character name', () => {
		const editModeComponent = new MockCharacterSetupPage(
			router,
			socketService,
			sessionService,
			{
				playerName: 'Pioneer',
				mode: 'edit',
				editCharacter: { id: 'c-1', characterName: 'Nova-Prime' },
			},
		);

		expect(editModeComponent.isEditMode()).toBe(true);
		expect(editModeComponent.characterForm.characterName).toBe('Nova-Prime');
		expect(editModeComponent.playerName()).toBe('Pioneer');

		editModeComponent.ngOnDestroy();
	});

	it('should initialize with unsaved and idle state', () => {
		expect(component.isSaved()).toBe(false);
		expect(component.successMessage()).toBeNull();
		expect(component.errorMessage()).toBeNull();
		expect(component.isSubmitting()).toBe(false);
	});

	describe('saveCharacter()', () => {
		it('should mark form touched and not emit when invalid', () => {
			component.characterForm.invalid = true;
			component.saveCharacter();

			expect(component.characterForm.touched).toBe(true);
			expect(component.isSaved()).toBe(false);
			expect(component.successMessage()).toBeNull();
			expect(socketService.emittedEvents).toBeDefined(); if (socketService.emittedEvents) { expect(socketService.emittedEvents.length).toBe(0) };
		});

		it('should set error when playerName is missing', () => {
			component.playerName.set('');
			component.characterForm.invalid = false;
			component.characterForm.characterName = 'Nova';
			component.saveCharacter();

			expect(component.errorMessage()).toBe('Player name is required to save a character.');
			expect(component.isSaved()).toBe(false);
			expect(socketService.emittedEvents).toBeDefined(); if (socketService.emittedEvents) { expect(socketService.emittedEvents.length).toBe(0) };
		});

		it('should emit save request in edit mode with updated character name', () => {
			const editModeComponent = new MockCharacterSetupPage(
				router,
				socketService,
				sessionService,
				{
					playerName: 'Pioneer',
					mode: 'edit',
					editCharacter: { id: 'c-1', characterName: 'Nova' },
				},
			);
			editModeComponent.characterForm.invalid = false;
			editModeComponent.characterForm.characterName = 'Nova-Prime';
			editModeComponent.saveCharacter();

			expect(editModeComponent.isEditMode()).toBe(true);
			expect(socketService.emittedEvents[socketService.emittedEvents.length - 1]).toEqual({
				event: CHARACTER_EDIT_REQUEST_EVENT,
				data: {
					characterId: 'c-1',
					playerName: 'Pioneer',
					characterName: 'Nova-Prime',
					sessionKey: 'test-session-key',
				},
			});

			editModeComponent.ngOnDestroy();
		});

		it('should handle successful character-edit response in edit mode', () => {
			const editModeComponent = new MockCharacterSetupPage(
				router,
				socketService,
				sessionService,
				{
					playerName: 'Pioneer',
					mode: 'edit',
					editCharacter: { id: 'c-1', characterName: 'Nova' },
				},
			);

			editModeComponent.characterForm.invalid = false;
			editModeComponent.characterForm.characterName = 'Nova-Prime';
			editModeComponent.saveCharacter();

			socketService.triggerEvent(CHARACTER_EDIT_RESPONSE_EVENT, {
				success: true,
				message: "Character 'Nova-Prime' updated.",
				playerName: 'Pioneer',
				characterId: 'c-1',
				characterName: 'Nova-Prime',
			} satisfies CharacterEditResponse);

			expect(editModeComponent.isSubmitting()).toBe(false);
			expect(editModeComponent.isSaved()).toBe(true);
			expect(editModeComponent.successMessage()).toBe("Character 'Nova-Prime' updated.");
			expect(editModeComponent.errorMessage()).toBeNull();

			editModeComponent.ngOnDestroy();
		});

		it('should emit character-add request when valid', () => {
			component.characterForm.invalid = false;
			component.characterForm.characterName = 'Nova-Prime';
			component.saveCharacter();

			expect(socketService.emittedEvents).toBeDefined(); if (socketService.emittedEvents) { expect(socketService.emittedEvents.length).toBe(1) };
			expect(socketService.emittedEvents[0].event).toBe(CHARACTER_ADD_REQUEST_EVENT);
				expect(socketService.emittedEvents[0].data).toEqual({
				playerName: 'Pioneer',
				characterName: 'Nova-Prime',
				sessionKey: 'test-session-key',
			});
			expect(component.isSubmitting()).toBe(true);
		});

		it('should handle successful character-add response', () => {
			component.characterForm.invalid = false;
			component.characterForm.characterName = 'Nova-Prime';
			component.saveCharacter();

			socketService.triggerEvent(CHARACTER_ADD_RESPONSE_EVENT, {
				success: true,
				message: "Character 'Nova-Prime' created.",
				playerName: 'Pioneer',
				characterName: 'Nova-Prime',
				characterId: 'c-1',
			} satisfies CharacterAddResponse);

			expect(component.isSubmitting()).toBe(false);
			expect(component.isSaved()).toBe(true);
			expect(component.successMessage()).toBe("Character 'Nova-Prime' created.");
			expect(component.errorMessage()).toBeNull();
		});

		it('should handle failed character-add response', () => {
			component.characterForm.invalid = false;
			component.characterForm.characterName = 'Nova-Prime';
			component.saveCharacter();

			socketService.triggerEvent(CHARACTER_ADD_RESPONSE_EVENT, {
				success: false,
				message: 'Character name already exists.',
				playerName: 'Pioneer',
			} satisfies CharacterAddResponse);

			expect(component.isSubmitting()).toBe(false);
			expect(component.isSaved()).toBe(false);
			expect(component.successMessage()).toBeNull();
			expect(component.errorMessage()).toBe('Character name already exists.');
		});

		it('should clear previous messages before a new request', () => {
			component.errorMessage.set('Old error');
			component.successMessage.set('Old success');
			component.characterForm.invalid = false;
			component.characterForm.characterName = 'Atlas';
			component.saveCharacter();

			expect(component.errorMessage()).toBeNull();
			expect(component.successMessage()).toBeNull();
		});
	});

	describe('navigateToCharacterList()', () => {
		it('should navigate to character-list with playerName from login context', () => {
			component.playerName.set('Pioneer');
			component.navigateToCharacterList();

			expect(router.navigate).toHaveBeenCalledWith(
				[{ outlets: { left: ['character-list'] } }],
				{ preserveFragment: true, state: { playerName: 'Pioneer' } },
			);
		});

		it('should fallback to character name when playerName is empty', () => {
			component.playerName.set('');
			component.characterForm.characterName = 'Nova';
			component.navigateToCharacterList();

			expect(router.navigate).toHaveBeenCalledWith(
				[{ outlets: { left: ['character-list'] } }],
				{ preserveFragment: true, state: { playerName: 'Nova' } },
			);
		});
	});

	describe('ngOnDestroy()', () => {
		it('should unsubscribe add-response listener on destroy', () => {
			component.characterForm.invalid = false;
			component.characterForm.characterName = 'Nova';
			component.saveCharacter();
			expect(socketService.registeredListeners.has(CHARACTER_ADD_RESPONSE_EVENT)).toBe(true);

			component.ngOnDestroy();
			expect(socketService.registeredListeners.has(CHARACTER_ADD_RESPONSE_EVENT)).toBe(false);
		});

		it('should unsubscribe invalid-session listener on destroy', () => {
			expect(socketService.registeredListeners.has(INVALID_SESSION_EVENT)).toBe(true);

			component.ngOnDestroy();
			expect(socketService.registeredListeners.has(INVALID_SESSION_EVENT)).toBe(false);
		});
	});

	describe('invalid session handling', () => {
		it('should clear session and navigate to login on invalid-session event', () => {
			expect(sessionService.hasSession()).toBe(true);

			socketService.triggerEvent(INVALID_SESSION_EVENT, { message: 'Session expired.' });

			expect(sessionService.hasSession()).toBe(false);
			expect(router.navigate).toHaveBeenCalledWith(
				[{ outlets: { left: ['login'] } }],
				{ preserveFragment: true },
			);
		});
	});

	describe('createStarterShipForCharacter() — cold-boot item provisioning', () => {
		function triggerSuccessfulCharacterAdd(characterId = 'c-1') {
			component.characterForm.invalid = false;
			component.characterForm.characterName = 'Nova';
			component.saveCharacter();
			socketService.triggerEvent(CHARACTER_ADD_RESPONSE_EVENT, {
				success: true,
				message: "Character 'Nova' created.",
				playerName: 'Pioneer',
				characterName: 'Nova',
				characterId,
			} satisfies CharacterAddResponse);
		}

		it('should emit ship-list-request after successful character-add', () => {
			triggerSuccessfulCharacterAdd('c-1');

			const shipListEmit = socketService.emittedEvents.find(e => e.event === SHIP_LIST_REQUEST_EVENT);
			expect(shipListEmit).toBeDefined();
			expect(shipListEmit!.data).toEqual({
				playerName: 'Pioneer',
				characterId: 'c-1',
				sessionKey: 'test-session-key',
			});
		});

		it('should set warningMessage when ship-list-response fails', () => {
			triggerSuccessfulCharacterAdd('c-1');

			socketService.triggerEvent(SHIP_LIST_RESPONSE_EVENT, {
				success: false,
				message: 'No ships found.',
				playerName: 'Pioneer',
				characterId: 'c-1',
				ships: [],
			} satisfies ShipListResponse);

			expect(component.warningMessage()).toBe('Character created, but starter ship could not be resolved yet.');
		});

		it('should set warningMessage when ship-list-response has no ships', () => {
			triggerSuccessfulCharacterAdd('c-1');

			socketService.triggerEvent(SHIP_LIST_RESPONSE_EVENT, {
				success: true,
				message: 'ok',
				playerName: 'Pioneer',
				characterId: 'c-1',
				ships: [],
			} satisfies ShipListResponse);

			expect(component.warningMessage()).toBe('Character created, but no starter ship record was returned.');
		});

		it('should emit ship-upsert-request when ship-list-response succeeds with a ship', () => {
			triggerSuccessfulCharacterAdd('c-1');

			socketService.triggerEvent(SHIP_LIST_RESPONSE_EVENT, {
				success: true,
				message: 'ok',
				playerName: 'Pioneer',
				characterId: 'c-1',
				ships: [{ id: 'ship-1', model: 'Scavenger Pod', tier: 1, name: "Pioneer's Ship" }],
			} satisfies ShipListResponse);

			const shipUpsertEmit = socketService.emittedEvents.find(e => e.event === SHIP_UPSERT_REQUEST_EVENT);
			expect(shipUpsertEmit).toBeDefined();
			expect(shipUpsertEmit!.data.playerName).toBe('Pioneer');
			expect(shipUpsertEmit!.data.characterId).toBe('c-1');
			expect(shipUpsertEmit!.data.ship.id).toBe('ship-1');
		});

		it('should set warningMessage when ship-upsert-response fails', () => {
			triggerSuccessfulCharacterAdd('c-1');

			socketService.triggerEvent(SHIP_LIST_RESPONSE_EVENT, {
				success: true,
				message: 'ok',
				playerName: 'Pioneer',
				characterId: 'c-1',
				ships: [{ id: 'ship-1', model: 'Scavenger Pod', tier: 1, name: "Pioneer's Ship" }],
			} satisfies ShipListResponse);

			socketService.triggerOnce(SHIP_UPSERT_RESPONSE_EVENT, {
				success: false,
				message: 'Ship upsert failed.',
				playerName: 'Pioneer',
			});

			expect(component.warningMessage()).toBe('Character created, but starter ship position update failed.');
			const itemEmit = socketService.emittedEvents.find(e => e.event === ITEM_UPSERT_REQUEST_EVENT);
			expect(itemEmit).toBeUndefined();
		});

		it('should emit item-upsert-request with drone payload after successful ship upsert', () => {
			triggerSuccessfulCharacterAdd('c-1');

			socketService.triggerEvent(SHIP_LIST_RESPONSE_EVENT, {
				success: true,
				message: 'ok',
				playerName: 'Pioneer',
				characterId: 'c-1',
				ships: [{ id: 'ship-1', model: 'Scavenger Pod', tier: 1, name: "Pioneer's Ship" }],
			} satisfies ShipListResponse);

			socketService.triggerOnce(SHIP_UPSERT_RESPONSE_EVENT, {
				success: true,
				message: 'ok',
				playerName: 'Pioneer',
			});

			const itemEmit = socketService.emittedEvents.find(e => e.event === ITEM_UPSERT_REQUEST_EVENT);
			expect(itemEmit).toBeDefined();
			expect(itemEmit!.data).toEqual({
				playerName: 'Pioneer',
				sessionKey: 'test-session-key',
				item: {
					itemType: EXPENDABLE_DART_DRONE_ITEM_TYPE,
					displayName: EXPENDABLE_DART_DRONE_DISPLAY_NAME,
					state: 'contained',
					damageStatus: 'intact',
					container: { containerType: 'ship', containerId: 'ship-1' },
					owningPlayerId: 'Pioneer',
					owningCharacterId: 'c-1',
				},
			});
		});

		it('should skip item-upsert when starter ship already has a drone in inventory', () => {
			const existingDrone = createExpendableDartDrone();
			existingDrone.container = { containerType: 'ship', containerId: 'ship-1' };
			existingDrone.owningPlayerId = 'Pioneer';
			existingDrone.owningCharacterId = 'c-1';

			triggerSuccessfulCharacterAdd('c-1');

			socketService.triggerEvent(SHIP_LIST_RESPONSE_EVENT, {
				success: true,
				message: 'ok',
				playerName: 'Pioneer',
				characterId: 'c-1',
				ships: [{ id: 'ship-1', model: 'Scavenger Pod', tier: 1, name: "Pioneer's Ship", inventory: [existingDrone] }],
			} satisfies ShipListResponse);

			socketService.triggerOnce(SHIP_UPSERT_RESPONSE_EVENT, {
				success: true,
				message: 'ok',
				playerName: 'Pioneer',
			});

			const itemEmit = socketService.emittedEvents.find(e => e.event === ITEM_UPSERT_REQUEST_EVENT);
			expect(itemEmit).toBeUndefined();
			expect(component.warningMessage()).toBeNull();
		});

		it('should set warningMessage when item-upsert-response fails', () => {
			triggerSuccessfulCharacterAdd('c-1');

			socketService.triggerEvent(SHIP_LIST_RESPONSE_EVENT, {
				success: true,
				message: 'ok',
				playerName: 'Pioneer',
				characterId: 'c-1',
				ships: [{ id: 'ship-1', model: 'Scavenger Pod', tier: 1, name: "Pioneer's Ship" }],
			} satisfies ShipListResponse);

			socketService.triggerOnce(SHIP_UPSERT_RESPONSE_EVENT, {
				success: true,
				message: 'ok',
				playerName: 'Pioneer',
			});

			socketService.triggerOnce(ITEM_UPSERT_RESPONSE_EVENT, {
				success: false,
				message: 'Item creation failed.',
				playerName: 'Pioneer',
			});

			expect(component.warningMessage()).toBe('Ship updated, but starter drone could not be created.');
		});

		it('should clear warningMessage after full successful provisioning flow', () => {
			component.warningMessage.set('Previous warning');
			triggerSuccessfulCharacterAdd('c-1');

			socketService.triggerEvent(SHIP_LIST_RESPONSE_EVENT, {
				success: true,
				message: 'ok',
				playerName: 'Pioneer',
				characterId: 'c-1',
				ships: [{ id: 'ship-1', model: 'Scavenger Pod', tier: 1, name: "Pioneer's Ship" }],
			} satisfies ShipListResponse);

			socketService.triggerOnce(SHIP_UPSERT_RESPONSE_EVENT, {
				success: true,
				message: 'ok',
				playerName: 'Pioneer',
			});

			socketService.triggerOnce(ITEM_UPSERT_RESPONSE_EVENT, {
				success: true,
				message: 'Drone created.',
				playerName: 'Pioneer',
			});

			expect(component.warningMessage()).toBeNull();
		});

		it('should not trigger ship provisioning on character-edit success', () => {
			const editModeComponent = new MockCharacterSetupPage(
				router,
				socketService,
				sessionService,
				{
					playerName: 'Pioneer',
					mode: 'edit',
					editCharacter: { id: 'c-1', characterName: 'Nova' },
				},
			);

			editModeComponent.characterForm.invalid = false;
			editModeComponent.characterForm.characterName = 'Nova-Prime';
			editModeComponent.saveCharacter();

			socketService.triggerEvent(CHARACTER_EDIT_RESPONSE_EVENT, {
				success: true,
				message: "Character 'Nova-Prime' updated.",
				playerName: 'Pioneer',
				characterId: 'c-1',
				characterName: 'Nova-Prime',
			} satisfies CharacterEditResponse);

			const shipListEmit = socketService.emittedEvents.find(e => e.event === SHIP_LIST_REQUEST_EVENT);
			expect(shipListEmit).toBeUndefined();

			editModeComponent.ngOnDestroy();
		});
	});
});
