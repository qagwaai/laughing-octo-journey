import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PlayerCharacterSummary } from '../../model/character-list';
import { FIRST_TARGET_MISSION_ID } from '../../model/mission.locale';
import {
	SHIP_LIST_REQUEST_EVENT,
	SHIP_LIST_RESPONSE_EVENT,
	DEFAULT_SHIP_MODEL,
	coerceShipInventory,
	type ShipListRequest,
	type ShipListResponse,
	type ShipSummary,
} from '../../model/ship-list';
import {
	coerceShipDamageProfile,
	createColdBootStarterShipDamageProfile,
	type ShipDamageProfile,
} from '../../model/ship-damage';
import { GuardedLeftMenu } from '../../component/guarded-left-menu';
import { locale } from '../../i18n/locale';
import { SessionService, SocketService } from '../../services';
import {
	type RepairAssetGrouping,
	type RepairAssetFilter,
	type RepairDetailNavigationState,
} from './repair-retrofit-state';

interface RepairRetrofitNavigationState {
	playerName?: string;
	joinCharacter?: PlayerCharacterSummary;
	joinShip?: ShipSummary;
	selectedFilter?: RepairAssetFilter;
	selectedGrouping?: RepairAssetGrouping;
	searchQuery?: string;
}

@Component({
	selector: 'app-repair-retrofit-page',
	templateUrl: './repair-retrofit.html',
	styleUrls: ['./repair-retrofit.css'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [GuardedLeftMenu],
})
export default class RepairRetrofitPage {
	protected readonly t = locale;
	private router = inject(Router);
	private socketService = inject(SocketService);
	private sessionService = inject(SessionService);
	private unsubscribeShipListResponse?: () => void;
	private navigationState: RepairRetrofitNavigationState =
		(this.router.getCurrentNavigation()?.extras.state as RepairRetrofitNavigationState | undefined) ??
		(history.state as RepairRetrofitNavigationState | undefined) ??
		{};

	protected playerName = signal<string>(this.navigationState.playerName ?? '');
	protected joinCharacter = signal<PlayerCharacterSummary | null>(this.navigationState.joinCharacter ?? null);
	protected activeShip = signal<ShipSummary | null>(this.navigationState.joinShip ?? null);
	protected isLoadingShip = signal(false);
	protected shipLoadError = signal<string | null>(null);
	protected damageProfile = signal<ShipDamageProfile | null>(this.resolveInitialDamageProfile());
	protected selectedFilter = signal<RepairAssetFilter>(this.navigationState.selectedFilter ?? 'all');
	protected selectedGrouping = signal<RepairAssetGrouping>(this.navigationState.selectedGrouping ?? 'asset-type');
	protected searchQuery = signal<string>(this.navigationState.searchQuery ?? '');
	protected canOpenRepairItems = computed(() => !!this.activeShip());

	constructor() {
		this.socketService.connect(this.socketService.serverUrl);
		if (this.activeShip()) {
			return;
		}

		if (this.socketService.getIsConnected()) {
			this.loadActiveShip();
		} else {
			this.socketService.once('connect', () => this.loadActiveShip());
		}
	}

	private isFirstTargetInProgress(): boolean {
		const missions = this.joinCharacter()?.missions;
		if (!Array.isArray(missions)) {
			return false;
		}

		const status = missions.find((mission) => mission.missionId === FIRST_TARGET_MISSION_ID)?.status?.toLowerCase();
		return status === 'started' || status === 'in-progress' || status === 'paused';
	}

	private resolveInitialDamageProfile(): ShipDamageProfile | null {
		const shipProfile = coerceShipDamageProfile(this.navigationState.joinShip?.damageProfile);
		if (shipProfile) {
			return shipProfile;
		}

		if (this.isFirstTargetInProgress()) {
			return createColdBootStarterShipDamageProfile();
		}

		return null;
	}

	private resolveDamageProfileForShip(ship: ShipSummary | null): ShipDamageProfile | null {
		const shipProfile = coerceShipDamageProfile(ship?.damageProfile);
		if (shipProfile) {
			return shipProfile;
		}

		if (this.isFirstTargetInProgress()) {
			return createColdBootStarterShipDamageProfile();
		}

		return null;
	}

	private loadActiveShip(): void {
		const playerName = this.playerName().trim();
		const characterId = this.joinCharacter()?.id?.trim() ?? '';
		const sessionKey = this.sessionService.getSessionKey()?.trim() ?? '';

		if (!playerName || !characterId || !sessionKey) {
			this.shipLoadError.set('Unable to load ship context for repair operations.');
			return;
		}

		this.isLoadingShip.set(true);
		this.shipLoadError.set(null);
		this.unsubscribeShipListResponse?.();
		this.unsubscribeShipListResponse = this.socketService.on(
			SHIP_LIST_RESPONSE_EVENT,
			(response: ShipListResponse) => {
				this.isLoadingShip.set(false);
				this.unsubscribeShipListResponse?.();

				if (!response.success) {
					this.shipLoadError.set(response.message || 'Unable to load ship for repair operations.');
					return;
				}

				const nextShip = response.ships?.[0] ?? null;
				this.activeShip.set(
					nextShip
						? {
							...nextShip,
							inventory: coerceShipInventory(nextShip.inventory),
						}
						: null,
				);
				this.damageProfile.set(this.resolveDamageProfileForShip(nextShip));
			},
		);

		const request: ShipListRequest = {
			playerName,
			characterId,
			sessionKey,
		};
		this.socketService.emit(SHIP_LIST_REQUEST_EVENT, request);
	}

	protected openRepairItemsView(): void {
		const state: RepairDetailNavigationState = {
			playerName: this.playerName(),
			joinCharacter: this.joinCharacter(),
			joinShip: this.activeShip(),
			damageProfile: this.damageProfile(),
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

	navigateToCharacterProfile(): void {
		this.router.navigate([{ outlets: { left: ['character-profile'] } }], {
			preserveFragment: true,
			state: {
				playerName: this.playerName(),
				joinCharacter: this.joinCharacter(),
			},
		});
	}
}
