import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { locale } from '../../i18n/locale';
import { coerceShipDamageProfile, type ShipDamageProfile } from '../../model/ship-damage';
import { type ShipSummary } from '../../model/ship-list';
import { type ShipUpsertResponse } from '../../model/ship-upsert';
import { SessionService, SocketService } from '../../services';
import {
	describeSummaryForSystems,
	mapOverallStatusToShipStatus,
	type RepairDetailNavigationState,
} from './repair-retrofit-state';

@Component({
	selector: 'app-repair-retrofit-ship-detail-page',
	templateUrl: './repair-retrofit-ship-detail.html',
	styleUrls: ['./repair-retrofit-ship-detail.css'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class RepairRetrofitShipDetailPage {
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
	protected damageProfile = signal<ShipDamageProfile | null>(coerceShipDamageProfile(this.navigationState.damageProfile));
	protected selectedAsset = signal(this.navigationState.asset ?? null);
	protected isPersisting = signal(false);
	protected persistError = signal<string | null>(null);
	protected persistSuccess = signal<string | null>(null);

	protected canFullyRepair = computed(() => {
		const profile = this.damageProfile();
		return !!profile && profile.overallStatus !== 'intact';
	});

	constructor() {
		this.socketService.connect(this.socketService.serverUrl);
	}

	protected getShipName(): string {
		const ship = this.joinShip();
		return ship?.name?.trim() || ship?.model?.trim() || ship?.id || 'Ship';
	}

	protected fullyRepairShip(): void {
		const profile = this.damageProfile();
		const ship = this.joinShip();
		const characterId = this.joinCharacter()?.id?.trim() ?? '';
		const playerName = this.playerName().trim();
		const sessionKey = this.sessionService.getSessionKey()?.trim() ?? '';

		if (!profile || !ship?.id || !characterId || !playerName || !sessionKey) {
			this.persistError.set('Missing ship or session context for repair operation.');
			return;
		}

		const nextProfile: ShipDamageProfile = {
			...profile,
			overallStatus: 'intact',
			summary: describeSummaryForSystems([]),
			systems: [],
			updatedAt: new Date().toISOString(),
		};

		this.isPersisting.set(true);
		this.persistError.set(null);
		this.persistSuccess.set(null);

		this.socketService.upsertShip(
			{
				playerName,
				characterId,
				sessionKey,
				ship: {
					id: ship.id,
					status: mapOverallStatusToShipStatus(nextProfile.overallStatus),
					damageProfile: nextProfile,
				},
			},
			(response: ShipUpsertResponse) => {
				this.isPersisting.set(false);
				if (!response.success) {
					this.persistError.set(response.message || 'Ship repair update failed to persist.');
					return;
				}

				this.damageProfile.set(nextProfile);
				this.persistSuccess.set('Ship fully repaired and synchronized.');
			},
		);
	}

}
