import { ChangeDetectionStrategy, Component, effect, inject, OnDestroy, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { locale } from '../../i18n/locale';
import {
	CHARACTER_ADD_REQUEST_EVENT,
	CHARACTER_ADD_RESPONSE_EVENT,
	CharacterAddRequest,
	CharacterAddResponse,
} from '../../model/character-add';
import {
	CHARACTER_EDIT_REQUEST_EVENT,
	CHARACTER_EDIT_RESPONSE_EVENT,
	CharacterEditRequest,
	CharacterEditResponse,
} from '../../model/character-edit';
import {
	SHIP_LIST_REQUEST_EVENT,
	SHIP_LIST_RESPONSE_EVENT,
	type ShipListRequest,
	type ShipListResponse,
} from '../../model/ship-list';
import { type ShipUpsertResponse } from '../../model/ship-upsert';
import { type ItemUpsertResponse } from '../../model/item-upsert';
import { EXPENDABLE_DART_DRONE_ITEM_TYPE, EXPENDABLE_DART_DRONE_DISPLAY_NAME } from '../../model/expendable-dart-drone';
import {
	THREE_D_PRINTER_ITEM_TYPE,
	THREE_D_PRINTER_DISPLAY_NAME,
	THREE_D_PRINTER_TIER,
} from '../../model/3d-printer';
import { generateDeterministicStarterShipUpdate } from '../../model/starter-ship';
import { GuardedLeftMenu } from '../../component/guarded-left-menu';
import { PlayerCharacterSummary } from '../../model/character-list';
import { INVALID_SESSION_EVENT } from '../../model/session';
import { SessionService } from '../../services/session.service';
import { SocketService } from '../../services/socket.service';

interface StarterShipInventoryItemDefinition {
	itemType: string;
	displayName: string;
	tier?: number;
	launchable: boolean;
	failureMessage: string;
}

const STARTER_SHIP_INVENTORY_ITEMS: readonly StarterShipInventoryItemDefinition[] = [
	{
		itemType: EXPENDABLE_DART_DRONE_ITEM_TYPE,
		displayName: EXPENDABLE_DART_DRONE_DISPLAY_NAME,
		launchable: true,
		failureMessage: 'Ship updated, but starter drone could not be created.',
	},
	{
		itemType: THREE_D_PRINTER_ITEM_TYPE,
		displayName: THREE_D_PRINTER_DISPLAY_NAME,
		tier: THREE_D_PRINTER_TIER,
		launchable: false,
		failureMessage: 'Ship updated, but starter 3D printer could not be created.',
	},
];

interface CharacterSetupNavigationState {
	playerName?: string;
	mode?: 'create' | 'edit';
	editCharacter?: PlayerCharacterSummary;
}

@Component({
	selector: 'app-character-setup-page',
	templateUrl: './character-setup.html',
	styleUrls: ['./character-setup.css'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [ReactiveFormsModule, GuardedLeftMenu],
})
export default class CharacterSetupPage implements OnDestroy {
	protected readonly t = locale;
	private fb = inject(FormBuilder);
	private router = inject(Router);
	private socketService = inject(SocketService);
	private sessionService = inject(SessionService);
	private unsubscribeAddResponse?: () => void;
	private unsubscribeShipListResponse?: () => void;
	private unsubscribeInvalidSession?: () => void;
	private setupState: CharacterSetupNavigationState =
		(this.router.getCurrentNavigation()?.extras.state as CharacterSetupNavigationState | undefined) ??
		(history.state as CharacterSetupNavigationState | undefined) ??
		{};

	protected playerName = signal<string>(
		this.setupState.playerName ??
			'',
	);
	protected editCharacter = signal<PlayerCharacterSummary | null>(this.setupState.editCharacter ?? null);
	protected isEditMode = signal(
		this.setupState.mode === 'edit' && !!this.setupState.editCharacter,
	);

	protected characterForm = this.fb.group({
		characterName: [
			this.editCharacter()?.characterName ?? this.playerName(),
			[Validators.required, Validators.minLength(2), Validators.maxLength(24)],
		],
	});

	protected isSaved = signal(false);
	protected successMessage = signal<string | null>(null);
	protected errorMessage = signal<string | null>(null);
	protected warningMessage = signal<string | null>(null);
	protected isSubmitting = signal(false);

	constructor() {
		effect(() => {
			this.socketService.connect(this.socketService.serverUrl);
		});

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
		const characterName = this.characterForm.value.characterName!;

		if (!playerName) {
			this.errorMessage.set('Player name is required to save a character.');
			this.isSaved.set(false);
			return;
		}

		this.isSubmitting.set(true);
		this.errorMessage.set(null);
		this.successMessage.set(null);
		this.warningMessage.set(null);
		this.isSaved.set(false);
		this.unsubscribeAddResponse?.();

		const isEditMode = this.isEditMode();
		if (isEditMode) {
			const editCharacter = this.editCharacter();
			if (!editCharacter?.id) {
				this.isSubmitting.set(false);
				this.errorMessage.set('Character id is required to edit a character.');
				return;
			}
		}

		const responseEventName = isEditMode ? CHARACTER_EDIT_RESPONSE_EVENT : CHARACTER_ADD_RESPONSE_EVENT;

		this.unsubscribeAddResponse = this.socketService.on(
			responseEventName,
			(response: CharacterAddResponse | CharacterEditResponse) => {
				this.isSubmitting.set(false);
				if (response.success) {
					this.isSaved.set(true);
					this.successMessage.set(response.message);
					this.errorMessage.set(null);
					if (!isEditMode) {
						const addResponse = response as CharacterAddResponse;
						this.createStarterShipForCharacter(addResponse.characterId);
					}
				} else {
					this.isSaved.set(false);
					this.successMessage.set(null);
					this.errorMessage.set(response.message);
				}
				this.unsubscribeAddResponse?.();
			},
		);

		if (isEditMode) {
			const editCharacter = this.editCharacter()!;
			const request: CharacterEditRequest = {
				characterId: editCharacter.id,
				playerName,
				characterName,
				sessionKey: this.sessionService.getSessionKey()!,
			};
			this.socketService.emit(CHARACTER_EDIT_REQUEST_EVENT, request);
			return;
		}

		const request: CharacterAddRequest = {
			playerName,
			characterName,
			sessionKey: this.sessionService.getSessionKey()!,
		};
		this.socketService.emit(CHARACTER_ADD_REQUEST_EVENT, request);
	}

	private createStarterShipForCharacter(characterId?: string): void {
		const playerName = this.playerName().trim();
		const sessionKey = this.sessionService.getSessionKey()?.trim() ?? '';
		const resolvedCharacterId = characterId?.trim() ?? '';

		if (!playerName || !sessionKey || !resolvedCharacterId) {
			console.warn('Skipping starter ship upsert due to missing character context.');
			this.warningMessage.set('Character created, but starter ship initialization is pending.');
			return;
		}

		this.unsubscribeShipListResponse?.();
		this.unsubscribeShipListResponse = this.socketService.on(
			SHIP_LIST_RESPONSE_EVENT,
			(response: ShipListResponse) => {
				this.unsubscribeShipListResponse?.();
				if (!response.success) {
					console.warn('Unable to resolve starter ship from ship-list:', response.message);
					this.warningMessage.set('Character created, but starter ship could not be resolved yet.');
					return;
				}

				const starterShipId = response.ships?.[0]?.id?.trim();
				if (!starterShipId) {
					console.warn('Starter ship id was not returned by ship-list response.');
					this.warningMessage.set('Character created, but no starter ship record was returned.');
					return;
				}

				const existingInventory = response.ships?.[0]?.inventory ?? [];

				const shipUpdate = generateDeterministicStarterShipUpdate(playerName, resolvedCharacterId, starterShipId);
				this.socketService.upsertShip(
					{
						playerName,
						characterId: resolvedCharacterId,
						sessionKey,
						ship: shipUpdate,
					},
					(upsertResponse: ShipUpsertResponse) => {
						if (!upsertResponse.success) {
							console.warn('Starter ship upsert failed:', upsertResponse.message);
							this.warningMessage.set('Character created, but starter ship position update failed.');
							return;
						}

						const upsertedInventory = upsertResponse.ship?.inventory ?? [];
						const missingStarterItems = STARTER_SHIP_INVENTORY_ITEMS.filter(
							(definition) =>
								!this.hasStarterShipInventoryItem(existingInventory, definition) &&
								!this.hasStarterShipInventoryItem(upsertedInventory, definition),
						);

						if (missingStarterItems.length === 0) {
							this.warningMessage.set(null);
							return;
						}

						this.upsertStarterShipInventoryItems(
							missingStarterItems,
							playerName,
							sessionKey,
							resolvedCharacterId,
							starterShipId,
						);
					},
				);
			},
		);

		const followupRequest: ShipListRequest = {
			playerName,
			characterId: resolvedCharacterId,
			sessionKey,
		};
		this.socketService.emit(SHIP_LIST_REQUEST_EVENT, followupRequest);
	}

	private hasStarterShipInventoryItem(
		inventory: ReadonlyArray<{ itemType?: string; tier?: number | undefined }> | undefined,
		definition: StarterShipInventoryItemDefinition,
	): boolean {
		return (
			inventory?.some(
				(item) =>
					item.itemType === definition.itemType &&
					(definition.tier === undefined || item.tier === definition.tier),
			) ?? false
		);
	}

	private upsertStarterShipInventoryItems(
		items: readonly StarterShipInventoryItemDefinition[],
		playerName: string,
		sessionKey: string,
		characterId: string,
		shipId: string,
		index = 0,
	): void {
		const itemDefinition = items[index];
		if (!itemDefinition) {
			this.warningMessage.set(null);
			return;
		}

		this.socketService.upsertItem(
			{
				playerName,
				sessionKey,
				item: {
					itemType: itemDefinition.itemType,
					displayName: itemDefinition.displayName,
					...(itemDefinition.tier === undefined ? {} : { tier: itemDefinition.tier }),
					launchable: itemDefinition.launchable,
					state: 'contained',
					damageStatus: 'intact',
					container: { containerType: 'ship', containerId: shipId },
					owningPlayerId: playerName,
					owningCharacterId: characterId,
				},
			},
			(itemResponse: ItemUpsertResponse) => {
				if (!itemResponse.success) {
					console.warn(`Starter item creation failed for ${itemDefinition.itemType}:`, itemResponse.message);
					this.warningMessage.set(itemDefinition.failureMessage);
					return;
				}

				this.upsertStarterShipInventoryItems(items, playerName, sessionKey, characterId, shipId, index + 1);
			},
		);
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
