import { ChangeDetectionStrategy, Component, inject, OnDestroy, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { PlayerCharacterSummary } from '../../model/character-list';
import {
	SHIP_LIST_REQUEST_EVENT,
	SHIP_LIST_RESPONSE_EVENT,
	type ShipListRequest,
	type ShipListResponse,
	ShipSummary,
	coerceShipInventory,
	coerceShipModel,
	coerceShipStatus,
	coerceShipDamageProfileOrNull,
	coerceShipTier,
} from '../../model/ship-list';
import { ShipItem } from '../../model/ship-item';
import { GuardedLeftMenu } from '../../component/guarded-left-menu';
import { locale } from '../../i18n/locale';
import { SocketService } from '../../services/socket.service';
import { SessionService } from '../../services/session.service';
import {
	EXPENDABLE_DART_DRONE_ITEM_TYPE,
	EXPENDABLE_DART_DRONE_DISPLAY_NAME,
} from '../../model/expendable-dart-drone';
import type { ItemUpsertResponse } from '../../model/item-upsert';

interface ShipViewInventoryNavigationState {
	playerName?: string;
	joinCharacter?: PlayerCharacterSummary;
	joinShip?: ShipSummary;
}

export interface InventoryGroup {
	itemType: string;
	name: string;
	quantity: number;
	item: ShipItem;
}

@Component({
	selector: 'app-ship-view-inventory-page',
	templateUrl: './ship-view-inventory.html',
	styleUrls: ['./ship-view-inventory.css'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [GuardedLeftMenu],
})
export default class ShipViewInventoryPage implements OnDestroy {
	protected readonly t = locale;
	private router = inject(Router);
	private socketService = inject(SocketService);
	private sessionService = inject(SessionService);
	private unsubscribeShipListResponse?: () => void;
	private navigationState: ShipViewInventoryNavigationState =
		(this.router.getCurrentNavigation()?.extras.state as ShipViewInventoryNavigationState | undefined) ??
		(history.state as ShipViewInventoryNavigationState | undefined) ??
		{};

	protected playerName = signal<string>(this.navigationState.playerName ?? '');
	protected joinCharacter = signal<PlayerCharacterSummary | null>(this.navigationState.joinCharacter ?? null);
	protected joinShip = signal<ShipSummary | null>(this.navigationState.joinShip ?? null);

	constructor() {
		this.socketService.connect(this.socketService.serverUrl);

		if (this.socketService.getIsConnected()) {
			this.refreshShipFromServer();
		} else {
			this.socketService.once('connect', () => this.refreshShipFromServer());
		}
	}

	protected inventoryGroups = computed<InventoryGroup[]>(() => {
		const inventory = this.joinShip()?.inventory ?? [];
		const counts = new Map<string, InventoryGroup>();
		for (const item of inventory) {
			const existing = counts.get(item.itemType);
			if (existing) {
				existing.quantity += 1;
				continue;
			}

			counts.set(item.itemType, {
				itemType: item.itemType,
				name: item.displayName,
				quantity: 1,
				item,
			});
		}
		return Array.from(counts.values());
	});

	protected getShipDisplayName(): string {
		const ship = this.joinShip();
		return ship?.name?.trim() || ship?.id || '';
	}

	ngOnDestroy(): void {
		this.unsubscribeShipListResponse?.();
	}

	navigateBackToHangar(): void {
		this.router.navigate([{ outlets: { left: ['ship-hangar'] } }], {
			preserveFragment: true,
			state: {
				playerName: this.playerName(),
				joinCharacter: this.joinCharacter(),
			},
		});
	}

	navigateToCharacterProfile(): void {
		this.router.navigate([{ outlets: { left: ['character-profile'] } }], {
			preserveFragment: true,
			state: {
				playerName: this.playerName(),
				joinCharacter: this.joinCharacter(),
			},
		});
	}

	navigateToItemSpecs(group: InventoryGroup): void {
		this.router.navigate([{ outlets: { right: ['item-view-specs'], left: ['ship-view-inventory'] } }], {
			preserveFragment: true,
			queryParams: { specsNav: Date.now() },
			state: {
				playerName: this.playerName(),
				joinCharacter: this.joinCharacter(),
				itemType: group.itemType,
				item: group.item,
			},
		});
	}

	addDroneToInventory(): void {
		const ship = this.joinShip();
		const sessionKey = this.sessionService.getSessionKey();
		if (!ship || !sessionKey) {
			return;
		}

		this.socketService.upsertItem(
			{
				playerName: this.playerName(),
				sessionKey,
				item: {
					itemType: EXPENDABLE_DART_DRONE_ITEM_TYPE,
					displayName: EXPENDABLE_DART_DRONE_DISPLAY_NAME,
					state: 'contained',
					damageStatus: 'intact',
					container: { containerType: 'ship', containerId: ship.id },
					owningPlayerId: this.playerName(),
					owningCharacterId: this.joinCharacter()?.id ?? null,
				},
			},
			(response: ItemUpsertResponse) => {
				if (!response.success || !response.item) {
					console.warn('Add drone failed:', response.message);
					return;
				}

				this.joinShip.update((current) => {
					if (!current) return current;
					return { ...current, inventory: [...(current.inventory ?? []), response.item!] };
				});
			},
		);
	}

	private refreshShipFromServer(): void {
		const sessionKey = this.sessionService.getSessionKey();
		const playerName = this.playerName().trim();
		const characterId = this.joinCharacter()?.id?.trim();
		const shipId = this.joinShip()?.id?.trim();
		if (!sessionKey || !playerName || !characterId || !shipId) {
			return;
		}

		this.unsubscribeShipListResponse?.();
		this.unsubscribeShipListResponse = this.socketService.on(
			SHIP_LIST_RESPONSE_EVENT,
			(response: ShipListResponse) => {
				if (!response.success) {
					this.unsubscribeShipListResponse?.();
					return;
				}

				const matchingShip = (response.ships ?? []).find((ship) => ship.id === shipId);
				if (matchingShip) {
					this.joinShip.set(this.normalizeShipSummary(matchingShip));
				}

				this.unsubscribeShipListResponse?.();
			},
		);

		const request: ShipListRequest = { playerName, characterId, sessionKey };
		this.socketService.emit(SHIP_LIST_REQUEST_EVENT, request);
	}

	private normalizeShipSummary(ship: ShipSummary): ShipSummary {
		const rawShip = ship as ShipSummary & { modelName?: string; tierLevel?: number };
		return {
			...ship,
			status: coerceShipStatus(rawShip.status),
			damageProfile: coerceShipDamageProfileOrNull(rawShip.damageProfile),
			model: coerceShipModel(rawShip.model ?? rawShip.modelName),
			tier: coerceShipTier(rawShip.tier ?? rawShip.tierLevel),
			inventory: coerceShipInventory(rawShip.inventory),
		};
	}
}
