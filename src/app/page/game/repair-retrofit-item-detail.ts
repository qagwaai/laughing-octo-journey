import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { locale } from '../../i18n/locale';
import { type ShipSummary } from '../../model/ship-list';
import { type ShipItem } from '../../model/ship-item';
import { type ItemUpsertResponse } from '../../model/item-upsert';
import { SessionService, SocketService } from '../../services';
import {
	type RepairAssetFilter,
	type RepairAssetGrouping,
	type RepairDetailNavigationState,
} from './repair-retrofit-state';

@Component({
	selector: 'app-repair-retrofit-item-detail-page',
	templateUrl: './repair-retrofit-item-detail.html',
	styleUrls: ['./repair-retrofit-item-detail.css'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class RepairRetrofitItemDetailPage {
	protected readonly t = locale;
	private router = inject(Router);
	private socketService = inject(SocketService);
	private sessionService = inject(SessionService);
	private navigationState: RepairDetailNavigationState =
		(this.router.getCurrentNavigation()?.extras.state as RepairDetailNavigationState | undefined) ??
		(history.state as RepairDetailNavigationState | undefined) ??
		{};

	protected playerName = signal<string>(this.navigationState.playerName ?? '');
	protected joinCharacter = signal(this.navigationState.joinCharacter ?? null);
	protected joinShip = signal<ShipSummary | null>(this.navigationState.joinShip ?? null);
	protected selectedAsset = signal(this.navigationState.asset ?? null);
	protected selectedFilter = signal<RepairAssetFilter>(this.navigationState.selectedFilter ?? 'all');
	protected selectedGrouping = signal<RepairAssetGrouping>(this.navigationState.selectedGrouping ?? 'asset-type');
	protected searchQuery = signal<string>(this.navigationState.searchQuery ?? '');
	protected isPersisting = signal(false);
	protected persistError = signal<string | null>(null);
	protected persistSuccess = signal<string | null>(null);

	protected selectedItem = computed<ShipItem | null>(() => {
		const itemId = this.selectedAsset()?.itemId;
		if (!itemId) {
			return null;
		}

		return this.joinShip()?.inventory?.find((item) => item.id === itemId) ?? null;
	});

	protected canFullyRepair = computed(() => this.selectedItem()?.damageStatus !== 'intact');

	constructor() {
		this.socketService.connect(this.socketService.serverUrl);
	}

	protected navigateBackToRepairItems(): void {
		const state: RepairDetailNavigationState = {
			playerName: this.playerName(),
			joinCharacter: this.joinCharacter(),
			joinShip: this.joinShip(),
			selectedFilter: this.selectedFilter(),
			selectedGrouping: this.selectedGrouping(),
			searchQuery: this.searchQuery(),
		};

		this.router.navigate([{ outlets: { right: ['repair-retrofit-items'], left: ['repair-retrofit'] } }], {
			preserveFragment: true,
			queryParams: { repairNav: Date.now() },
			state,
		});
	}

	protected fullyRepairItem(): void {
		const item = this.selectedItem();
		const sessionKey = this.sessionService.getSessionKey()?.trim() ?? '';
		const playerName = this.playerName().trim();

		if (!item || !sessionKey || !playerName) {
			this.persistError.set('Missing item or session context for repair operation.');
			return;
		}

		this.isPersisting.set(true);
		this.persistError.set(null);
		this.persistSuccess.set(null);

		this.socketService.upsertItem(
			{
				playerName,
				sessionKey,
				item: {
					id: item.id,
					damageStatus: 'intact',
				},
			},
			(response: ItemUpsertResponse) => {
				this.isPersisting.set(false);
				if (!response.success || !response.item) {
					this.persistError.set(response.message || 'Item repair update failed to persist.');
					return;
				}

				this.joinShip.update((current) => {
					if (!current) {
						return current;
					}

					return {
						...current,
						inventory: (current.inventory ?? []).map((entry) => (entry.id === response.item!.id ? response.item! : entry)),
					};
				});
				this.persistSuccess.set('Inventory item fully repaired and synchronized.');
			},
		);
	}

}
