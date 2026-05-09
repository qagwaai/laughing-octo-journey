import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import CharacterSetupPage from './character-setup';
import { SessionService } from '../../services/session.service';
import { SocketService } from '../../services/socket.service';
import {
	CHARACTER_ADD_REQUEST_EVENT,
	CHARACTER_ADD_RESPONSE_EVENT,
	type CharacterAddRequest,
	type CharacterAddResponse,
} from '../../model/character-add';
import {
	CHARACTER_EDIT_REQUEST_EVENT,
	CHARACTER_EDIT_RESPONSE_EVENT,
	type CharacterEditResponse,
} from '../../model/character-edit';
import {
	SHIP_LIST_REQUEST_EVENT,
	SHIP_LIST_RESPONSE_EVENT,
	type ShipListResponse,
} from '../../model/ship-list';
import { SHIP_UPSERT_REQUEST_EVENT, SHIP_UPSERT_RESPONSE_EVENT } from '../../model/ship-upsert';
import { ITEM_UPSERT_REQUEST_EVENT, ITEM_UPSERT_RESPONSE_EVENT } from '../../model/item-upsert';
import {
	EXPENDABLE_DART_DRONE_DISPLAY_NAME,
	EXPENDABLE_DART_DRONE_ITEM_TYPE,
	createExpendableDartDrone,
} from '../../model/domain/expendable-dart-drone';
import {
	THREE_D_PRINTER_DISPLAY_NAME,
	THREE_D_PRINTER_ITEM_TYPE,
	THREE_D_PRINTER_TIER,
	create3DPrinter,
} from '../../model/domain/3d-printer';
import { INVALID_SESSION_EVENT } from '../../model/session';
import {
	createMockSessionService,
	createMockSocketService,
	type MockSessionService,
	type MockSocketService,
} from '../../../testing';

type MockSocketServiceWithUpsert = MockSocketService & {
	upsertShip(request: any, onResponse?: (r: any) => void): void;
	upsertItem(request: any, onResponse?: (r: any) => void): void;
};

function createExtendedMockSocketService(): MockSocketServiceWithUpsert {
	const base = createMockSocketService();
	return Object.assign(base, {
		upsertShip(request: any, onResponse?: (r: any) => void) {
			if (onResponse) {
				base.once(SHIP_UPSERT_RESPONSE_EVENT, onResponse);
			}
			base.emit(SHIP_UPSERT_REQUEST_EVENT, request);
		},
		upsertItem(request: any, onResponse?: (r: any) => void) {
			if (onResponse) {
				base.once(ITEM_UPSERT_RESPONSE_EVENT, onResponse);
			}
			base.emit(ITEM_UPSERT_REQUEST_EVENT, request);
		},
	});
}

interface SetupState {
	playerName?: string;
	mode?: 'create' | 'edit';
	editCharacter?: { id: string; characterName: string; level?: number };
}

function createShipListResponse(params?: {
	success?: boolean;
	ships?: ShipListResponse['ships'];
	message?: string;
}): ShipListResponse {
	return {
		success: params?.success ?? true,
		message: params?.message ?? 'ok',
		playerName: 'Pioneer',
		characterId: 'c-1',
		ships:
			params?.ships ??
			[
				{
					id: 'ship-1',
					model: 'Scavenger Pod',
					tier: 1,
					name: "Pioneer's Ship",
					spatial: {
						solarSystemId: 'sol',
						frame: 'barycentric',
						positionKm: { x: 0, y: 0, z: 0 },
						epochMs: 1,
					},
				},
			],
	};
}

function setup(options: {
	socketService: MockSocketServiceWithUpsert;
	sessionService: MockSessionService;
	setupState?: SetupState;
}) {
	const navigationState: SetupState = options.setupState ?? { playerName: 'Pioneer' };

	const mockRouter = {
		getCurrentNavigation: () => ({ extras: { state: navigationState } }),
		navigate: jasmine.createSpy('navigate'),
	};

	TestBed.configureTestingModule({
		imports: [CharacterSetupPage],
		providers: [
			{ provide: SocketService, useValue: options.socketService },
			{ provide: SessionService, useValue: options.sessionService },
			{ provide: Router, useValue: mockRouter },
		],
		schemas: [CUSTOM_ELEMENTS_SCHEMA],
	});

	const fixture = TestBed.createComponent(CharacterSetupPage);
	fixture.detectChanges();
	return { component: fixture.componentInstance, fixture, mockRouter };
}

describe('CharacterSetupPage', () => {
	let socketService: MockSocketServiceWithUpsert;
	let sessionService: MockSessionService;

	beforeEach(() => {
		socketService = createExtendedMockSocketService();
		sessionService = createMockSessionService('test-session-key');
	});

	it('should create', () => {
		const { component } = setup({ socketService, sessionService });
		expect(component).toBeTruthy();
	});

	it('should initialize with a playerName value', () => {
		const { component } = setup({ socketService, sessionService, setupState: { playerName: 'Pioneer' } });
		expect(component['playerName']()).toBe('Pioneer');
	});

	it('should initialize form in edit mode using selected character name', () => {
		const { component } = setup({
			socketService,
			sessionService,
			setupState: {
				playerName: 'Pioneer',
				mode: 'edit',
				editCharacter: { id: 'c-1', characterName: 'Nova-Prime' },
			},
		});

		expect(component['isEditMode']()).toBe(true);
		expect(component['characterForm'].value.characterName).toBe('Nova-Prime');
		expect(component['playerName']()).toBe('Pioneer');
	});

	it('should initialize with unsaved and idle state', () => {
		const { component } = setup({ socketService, sessionService });
		expect(component['isSaved']()).toBe(false);
		expect(component['successMessage']()).toBeNull();
		expect(component['errorMessage']()).toBeNull();
		expect(component['isSubmitting']()).toBe(false);
	});

	describe('saveCharacter()', () => {
		it('should mark form touched and not emit when invalid', () => {
			const { component } = setup({ socketService, sessionService });
			component['characterForm'].patchValue({ characterName: '' });

			component.saveCharacter();

			expect(component['characterForm'].touched).toBe(true);
			expect(component['isSaved']()).toBe(false);
			expect(component['successMessage']()).toBeNull();
			expect(socketService.emittedEvents.length).toBe(0);
		});

		it('should set error when playerName is missing', () => {
			const { component } = setup({ socketService, sessionService });
			component['playerName'].set('');
			component['characterForm'].patchValue({ characterName: 'Nova' });

			component.saveCharacter();

			expect(component['errorMessage']()).toBe('Player name is required to save a character.');
			expect(component['isSaved']()).toBe(false);
			expect(socketService.emittedEvents.length).toBe(0);
		});

		it('should emit save request in edit mode with updated character name', () => {
			const { component } = setup({
				socketService,
				sessionService,
				setupState: {
					playerName: 'Pioneer',
					mode: 'edit',
					editCharacter: { id: 'c-1', characterName: 'Nova' },
				},
			});
			component['characterForm'].patchValue({ characterName: 'Nova-Prime' });
			component.saveCharacter();

			expect(component['isEditMode']()).toBe(true);
			expect(socketService.emittedEvents[socketService.emittedEvents.length - 1]).toEqual({
				event: CHARACTER_EDIT_REQUEST_EVENT,
				data: {
					characterId: 'c-1',
					playerName: 'Pioneer',
					characterName: 'Nova-Prime',
					sessionKey: 'test-session-key',
				},
			});
		});

		it('should handle successful character-edit response in edit mode', () => {
			const { component, mockRouter } = setup({
				socketService,
				sessionService,
				setupState: {
					playerName: 'Pioneer',
					mode: 'edit',
					editCharacter: { id: 'c-1', characterName: 'Nova' },
				},
			});

			component['characterForm'].patchValue({ characterName: 'Nova-Prime' });
			component.saveCharacter();

			socketService.triggerEvent(CHARACTER_EDIT_RESPONSE_EVENT, {
				success: true,
				message: "Character 'Nova-Prime' updated.",
				playerName: 'Pioneer',
				characterId: 'c-1',
				characterName: 'Nova-Prime',
			} satisfies CharacterEditResponse);

			expect(component['isSubmitting']()).toBe(false);
			expect(component['isSaved']()).toBe(true);
			expect(component['successMessage']()).toBe("Character 'Nova-Prime' updated.");
			expect(component['errorMessage']()).toBeNull();
			expect(mockRouter.navigate).toHaveBeenCalledWith(
				[{ outlets: { left: ['character-list'] } }],
				{ preserveFragment: true, state: { playerName: 'Pioneer' } },
			);
		});

		it('should emit character-add request when valid', () => {
			const { component } = setup({ socketService, sessionService });
			component['characterForm'].patchValue({ characterName: 'Nova-Prime' });
			component.saveCharacter();

			expect(socketService.emittedEvents.length).toBe(1);
			expect(socketService.emittedEvents[0].event).toBe(CHARACTER_ADD_REQUEST_EVENT);
			expect(socketService.emittedEvents[0].data).toEqual({
				playerName: 'Pioneer',
				characterName: 'Nova-Prime',
				sessionKey: 'test-session-key',
			} satisfies CharacterAddRequest);
			expect(component['isSubmitting']()).toBe(true);
		});

		it('should handle successful character-add response', () => {
			const { component, mockRouter } = setup({ socketService, sessionService });
			component['characterForm'].patchValue({ characterName: 'Nova-Prime' });
			component.saveCharacter();

			socketService.triggerEvent(CHARACTER_ADD_RESPONSE_EVENT, {
				success: true,
				message: "Character 'Nova-Prime' created.",
				playerName: 'Pioneer',
				characterName: 'Nova-Prime',
				characterId: 'c-1',
			} satisfies CharacterAddResponse);

			expect(component['isSubmitting']()).toBe(false);
			expect(component['isSaved']()).toBe(true);
			expect(component['successMessage']()).toBe("Character 'Nova-Prime' created.");
			expect(component['errorMessage']()).toBeNull();
			expect(mockRouter.navigate).toHaveBeenCalledWith(
				[{ outlets: { left: ['character-list'] } }],
				{ preserveFragment: true, state: { playerName: 'Pioneer' } },
			);
		});

		it('should handle failed character-add response', () => {
			const { component, mockRouter } = setup({ socketService, sessionService });
			component['characterForm'].patchValue({ characterName: 'Nova-Prime' });
			component.saveCharacter();

			socketService.triggerEvent(CHARACTER_ADD_RESPONSE_EVENT, {
				success: false,
				message: 'Character name already exists.',
				playerName: 'Pioneer',
			} satisfies CharacterAddResponse);

			expect(component['isSubmitting']()).toBe(false);
			expect(component['isSaved']()).toBe(false);
			expect(component['successMessage']()).toBeNull();
			expect(component['errorMessage']()).toBe('Character name already exists.');
			expect(mockRouter.navigate).not.toHaveBeenCalled();
		});

		it('should clear previous messages before a new request', () => {
			const { component } = setup({ socketService, sessionService });
			component['errorMessage'].set('Old error');
			component['successMessage'].set('Old success');
			component['characterForm'].patchValue({ characterName: 'Atlas' });
			component.saveCharacter();

			expect(component['errorMessage']()).toBeNull();
			expect(component['successMessage']()).toBeNull();
		});
	});

	describe('navigateToCharacterList()', () => {
		it('should navigate to character-list with playerName from login context', () => {
			const { component, mockRouter } = setup({ socketService, sessionService });
			component['playerName'].set('Pioneer');
			component.navigateToCharacterList();

			expect(mockRouter.navigate).toHaveBeenCalledWith(
				[{ outlets: { left: ['character-list'] } }],
				{ preserveFragment: true, state: { playerName: 'Pioneer' } },
			);
		});

		it('should fallback to character name when playerName is empty', () => {
			const { component, mockRouter } = setup({ socketService, sessionService });
			component['playerName'].set('');
			component['characterForm'].patchValue({ characterName: 'Nova' });
			component.navigateToCharacterList();

			expect(mockRouter.navigate).toHaveBeenCalledWith(
				[{ outlets: { left: ['character-list'] } }],
				{ preserveFragment: true, state: { playerName: 'Nova' } },
			);
		});
	});

	describe('ngOnDestroy()', () => {
		it('should unsubscribe add-response listener on destroy', () => {
			const { component } = setup({ socketService, sessionService });
			component['characterForm'].patchValue({ characterName: 'Nova' });
			component.saveCharacter();
			expect(socketService.registeredListeners.has(CHARACTER_ADD_RESPONSE_EVENT)).toBe(true);

			component.ngOnDestroy();
			expect(socketService.registeredListeners.has(CHARACTER_ADD_RESPONSE_EVENT)).toBe(false);
		});

		it('should unsubscribe invalid-session listener on destroy', () => {
			const { component } = setup({ socketService, sessionService });
			expect(socketService.registeredListeners.has(INVALID_SESSION_EVENT)).toBe(true);

			component.ngOnDestroy();
			expect(socketService.registeredListeners.has(INVALID_SESSION_EVENT)).toBe(false);
		});
	});

	describe('invalid session handling', () => {
		it('should clear session and navigate to login on invalid-session event', () => {
			const { mockRouter } = setup({ socketService, sessionService });
			expect(sessionService.hasSession()).toBe(true);

			socketService.triggerEvent(INVALID_SESSION_EVENT, { message: 'Session expired.' });

			expect(sessionService.hasSession()).toBe(false);
			expect(mockRouter.navigate).toHaveBeenCalledWith(
				[{ outlets: { left: ['login'] } }],
				{ preserveFragment: true },
			);
		});
	});

	describe('createStarterShipForCharacter() — cold-boot item provisioning', () => {
		function triggerSuccessfulCharacterAdd(component: CharacterSetupPage, characterId = 'c-1') {
			component['characterForm'].patchValue({ characterName: 'Nova' });
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
			const { component } = setup({ socketService, sessionService });
			triggerSuccessfulCharacterAdd(component, 'c-1');

			const shipListEmit = socketService.emittedEvents.find((e) => e.event === SHIP_LIST_REQUEST_EVENT);
			expect(shipListEmit).toBeDefined();
			expect(shipListEmit!.data).toEqual({
				playerName: 'Pioneer',
				characterId: 'c-1',
				sessionKey: 'test-session-key',
			});
		});

		it('should set warningMessage when ship-list-response fails', () => {
			const { component } = setup({ socketService, sessionService });
			triggerSuccessfulCharacterAdd(component, 'c-1');

			socketService.triggerOnce(SHIP_LIST_RESPONSE_EVENT, createShipListResponse({ success: false, ships: [], message: 'No ships found.' }));

			expect(component['warningMessage']()).toBe('Character created, but starter ship could not be resolved yet.');
		});

		it('should set warningMessage when ship-list-response has no ships', () => {
			const { component } = setup({ socketService, sessionService });
			triggerSuccessfulCharacterAdd(component, 'c-1');

			socketService.triggerOnce(SHIP_LIST_RESPONSE_EVENT, createShipListResponse({ ships: [] }));

			expect(component['warningMessage']()).toBe('Character created, but no starter ship record was returned.');
		});

		it('should emit ship-upsert-request when ship-list-response succeeds with a ship', () => {
			const { component } = setup({ socketService, sessionService });
			triggerSuccessfulCharacterAdd(component, 'c-1');

			socketService.triggerOnce(SHIP_LIST_RESPONSE_EVENT, createShipListResponse());

			const shipUpsertEmit = socketService.emittedEvents.find((e) => e.event === SHIP_UPSERT_REQUEST_EVENT);
			expect(shipUpsertEmit).toBeDefined();
			expect(shipUpsertEmit!.data.playerName).toBe('Pioneer');
			expect(shipUpsertEmit!.data.characterId).toBe('c-1');
			expect(shipUpsertEmit!.data.ship.id).toBe('ship-1');
		});

		it('should set warningMessage when ship-upsert-response fails', () => {
			const { component } = setup({ socketService, sessionService });
			triggerSuccessfulCharacterAdd(component, 'c-1');

			socketService.triggerOnce(SHIP_LIST_RESPONSE_EVENT, createShipListResponse());
			socketService.triggerOnce(SHIP_UPSERT_RESPONSE_EVENT, {
				success: false,
				message: 'Ship upsert failed.',
				playerName: 'Pioneer',
			});

			expect(component['warningMessage']()).toBe('Character created, but starter ship position update failed.');
			const itemEmit = socketService.emittedEvents.find((e) => e.event === ITEM_UPSERT_REQUEST_EVENT);
			expect(itemEmit).toBeUndefined();
		});

		it('should emit item-upsert-request with drone payload after successful ship upsert', () => {
			const { component } = setup({ socketService, sessionService });
			triggerSuccessfulCharacterAdd(component, 'c-1');

			socketService.triggerOnce(SHIP_LIST_RESPONSE_EVENT, createShipListResponse());
			socketService.triggerOnce(SHIP_UPSERT_RESPONSE_EVENT, {
				success: true,
				message: 'ok',
				playerName: 'Pioneer',
			});

			const itemEmit = socketService.emittedEvents.find((e) => e.event === ITEM_UPSERT_REQUEST_EVENT);
			expect(itemEmit).toBeDefined();
			expect(itemEmit!.data).toEqual({
				playerName: 'Pioneer',
				sessionKey: 'test-session-key',
				item: {
					itemType: EXPENDABLE_DART_DRONE_ITEM_TYPE,
					displayName: EXPENDABLE_DART_DRONE_DISPLAY_NAME,
					launchable: true,
					state: 'contained',
					damageStatus: 'intact',
					container: { containerType: 'ship', containerId: 'ship-1' },
					owningPlayerId: 'Pioneer',
					owningCharacterId: 'c-1',
				},
			});
		});

		it('should emit second item-upsert-request with 3D printer payload after drone creation succeeds', () => {
			const { component } = setup({ socketService, sessionService });
			triggerSuccessfulCharacterAdd(component, 'c-1');

			socketService.triggerOnce(SHIP_LIST_RESPONSE_EVENT, createShipListResponse());
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

			const itemEmits = socketService.emittedEvents.filter((e) => e.event === ITEM_UPSERT_REQUEST_EVENT);
			expect(itemEmits.length).toBe(2);
			expect(itemEmits[1].data).toEqual({
				playerName: 'Pioneer',
				sessionKey: 'test-session-key',
				item: {
					itemType: THREE_D_PRINTER_ITEM_TYPE,
					displayName: THREE_D_PRINTER_DISPLAY_NAME,
					tier: THREE_D_PRINTER_TIER,
					launchable: false,
					state: 'contained',
					damageStatus: 'intact',
					container: { containerType: 'ship', containerId: 'ship-1' },
					owningPlayerId: 'Pioneer',
					owningCharacterId: 'c-1',
				},
			});
		});

		it('should skip 3D printer provisioning when the starter ship already has one in inventory', () => {
			const { component } = setup({ socketService, sessionService });
			const existingPrinter = create3DPrinter();
			existingPrinter.container = { containerType: 'ship', containerId: 'ship-1' };
			existingPrinter.owningPlayerId = 'Pioneer';
			existingPrinter.owningCharacterId = 'c-1';

			triggerSuccessfulCharacterAdd(component, 'c-1');
			socketService.triggerOnce(
				SHIP_LIST_RESPONSE_EVENT,
				createShipListResponse({
					ships: [
						{
							id: 'ship-1',
							model: 'Scavenger Pod',
							tier: 1,
							name: "Pioneer's Ship",
							inventory: [existingPrinter],
							spatial: {
								solarSystemId: 'sol',
								frame: 'barycentric',
								positionKm: { x: 0, y: 0, z: 0 },
								epochMs: 1,
							},
						},
					],
				}),
			);
			socketService.triggerOnce(SHIP_UPSERT_RESPONSE_EVENT, {
				success: true,
				message: 'ok',
				playerName: 'Pioneer',
			});

			const itemEmit = socketService.emittedEvents.find((e) => e.event === ITEM_UPSERT_REQUEST_EVENT);
			expect(itemEmit).toBeDefined();
			expect(itemEmit!.data.item.itemType).toBe(EXPENDABLE_DART_DRONE_ITEM_TYPE);
		});

		it('should skip item-upsert when starter ship already has both default items in inventory', () => {
			const { component } = setup({ socketService, sessionService });
			const existingDrone = createExpendableDartDrone();
			existingDrone.container = { containerType: 'ship', containerId: 'ship-1' };
			existingDrone.owningPlayerId = 'Pioneer';
			existingDrone.owningCharacterId = 'c-1';

			const existingPrinter = create3DPrinter();
			existingPrinter.container = { containerType: 'ship', containerId: 'ship-1' };
			existingPrinter.owningPlayerId = 'Pioneer';
			existingPrinter.owningCharacterId = 'c-1';

			triggerSuccessfulCharacterAdd(component, 'c-1');
			socketService.triggerOnce(
				SHIP_LIST_RESPONSE_EVENT,
				createShipListResponse({
					ships: [
						{
							id: 'ship-1',
							model: 'Scavenger Pod',
							tier: 1,
							name: "Pioneer's Ship",
							inventory: [existingDrone, existingPrinter],
							spatial: {
								solarSystemId: 'sol',
								frame: 'barycentric',
								positionKm: { x: 0, y: 0, z: 0 },
								epochMs: 1,
							},
						},
					],
				}),
			);
			socketService.triggerOnce(SHIP_UPSERT_RESPONSE_EVENT, {
				success: true,
				message: 'ok',
				playerName: 'Pioneer',
			});

			const itemEmit = socketService.emittedEvents.find((e) => e.event === ITEM_UPSERT_REQUEST_EVENT);
			expect(itemEmit).toBeUndefined();
			expect(component['warningMessage']()).toBeNull();
		});

		it('should set warningMessage when drone item-upsert-response fails', () => {
			const { component } = setup({ socketService, sessionService });
			triggerSuccessfulCharacterAdd(component, 'c-1');

			socketService.triggerOnce(SHIP_LIST_RESPONSE_EVENT, createShipListResponse());
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

			expect(component['warningMessage']()).toBe('Ship updated, but starter drone could not be created.');
		});

		it('should set warningMessage when 3D printer item-upsert-response fails', () => {
			const { component } = setup({ socketService, sessionService });
			triggerSuccessfulCharacterAdd(component, 'c-1');

			socketService.triggerOnce(SHIP_LIST_RESPONSE_EVENT, createShipListResponse());
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
			socketService.triggerOnce(ITEM_UPSERT_RESPONSE_EVENT, {
				success: false,
				message: 'Printer creation failed.',
				playerName: 'Pioneer',
			});

			expect(component['warningMessage']()).toBe('Ship updated, but starter 3D printer could not be created.');
		});

		it('should clear warningMessage after full successful provisioning flow', () => {
			const { component } = setup({ socketService, sessionService });
			component['warningMessage'].set('Previous warning');
			triggerSuccessfulCharacterAdd(component, 'c-1');

			socketService.triggerOnce(SHIP_LIST_RESPONSE_EVENT, createShipListResponse());
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
			socketService.triggerOnce(ITEM_UPSERT_RESPONSE_EVENT, {
				success: true,
				message: '3D printer created.',
				playerName: 'Pioneer',
			});

			expect(component['warningMessage']()).toBeNull();
		});

		it('should not trigger ship provisioning on character-edit success', () => {
			const { component } = setup({
				socketService,
				sessionService,
				setupState: {
					playerName: 'Pioneer',
					mode: 'edit',
					editCharacter: { id: 'c-1', characterName: 'Nova' },
				},
			});

			component['characterForm'].patchValue({ characterName: 'Nova-Prime' });
			component.saveCharacter();

			socketService.triggerEvent(CHARACTER_EDIT_RESPONSE_EVENT, {
				success: true,
				message: "Character 'Nova-Prime' updated.",
				playerName: 'Pioneer',
				characterId: 'c-1',
				characterName: 'Nova-Prime',
			} satisfies CharacterEditResponse);

			const shipListEmit = socketService.emittedEvents.find((e) => e.event === SHIP_LIST_REQUEST_EVENT);
			expect(shipListEmit).toBeUndefined();
		});
	});

	describe('DOM smoke tests', () => {
		it('should render without error', () => {
			const { fixture } = setup({ socketService, sessionService });
			fixture.detectChanges();
			expect(fixture.nativeElement).toBeTruthy();
		});
	});
});
