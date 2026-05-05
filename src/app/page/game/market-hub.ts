import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { PlayerCharacterSummary } from '../../model/character-list';
import { GuardedLeftMenu } from '../../component/guarded-left-menu';
import { CharacterShipBadge } from '../../component/character-ship-badge';
import { locale } from '../../i18n/locale';
import type { CharacterMissionProgress } from '../../model/mission';
import { MISSION_IDS, resolveMissionById } from '../../model/mission-catalog';
import {
	MARKET_LIST_REQUEST_EVENT,
	MARKET_LIST_RESPONSE_EVENT,
	computeDistanceKm,
	type MarketListRequest,
	type MarketListResponse,
	type MarketSummary,
} from '../../model/market-list';
import { SessionService } from '../../services/session.service';
import { SocketService } from '../../services/socket.service';
import type { Triple } from '../../model/triple';

interface MarketHubMarketView extends MarketSummary {
	distanceKm: number | null;
}

const DEFAULT_MARKET_RADIUS_KM = 100;
const MARKET_RADIUS_OPTIONS_KM: readonly number[] = [25, 50, 100, 250, 500, 1000];

const KNOWN_MARKET_POSITIONS_KM: Record<string, Triple> = {
	'sol-ceres-exchange': { x: 413_700_000, y: 0, z: 0 },
};

interface MarketHubNavigationState {
	playerName?: string;
	joinCharacter?: PlayerCharacterSummary;
	missions?: CharacterMissionProgress[];
}

@Component({
	selector: 'app-market-hub-page',
	templateUrl: './market-hub.html',
	styleUrls: ['./market-hub.css'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [GuardedLeftMenu, CharacterShipBadge, ReactiveFormsModule],
})
export default class MarketHubPage {
	protected readonly t = locale;
	private fb = inject(FormBuilder);
	private router = inject(Router);
	private socketService = inject(SocketService);
	private sessionService = inject(SessionService);
	private unsubscribeMarketListResponse?: () => void;
	private navigationState: MarketHubNavigationState =
		(this.router.getCurrentNavigation()?.extras.state as MarketHubNavigationState | undefined) ??
		(history.state as MarketHubNavigationState | undefined) ??
		{};

	protected playerName = signal<string>(this.navigationState.playerName ?? '');
	protected joinCharacter = signal<PlayerCharacterSummary | null>(this.navigationState.joinCharacter ?? null);
	protected missions = signal<CharacterMissionProgress[]>(this.navigationState.missions ?? []);
	protected marketRadiusOptionsKm = MARKET_RADIUS_OPTIONS_KM;
	protected selectedRadiusKm = signal<number>(DEFAULT_MARKET_RADIUS_KM);
	protected markets = signal<MarketSummary[]>([]);
	protected isLoadingMarkets = signal(false);
	protected marketListError = signal<string | null>(null);
	protected activeShip = this.sessionService.activeShip;

	protected marketFilterForm = this.fb.group({
		radiusKm: [DEFAULT_MARKET_RADIUS_KM, [Validators.required, Validators.min(1)]],
	});

	protected readonly activeShipSolarSystemId = computed(
		() => this.activeShip()?.kinematics?.reference?.solarSystemId?.trim() || 'sol',
	);

	protected readonly activeShipPositionKm = computed<Triple | null>(
		() => this.activeShip()?.kinematics?.position ?? this.activeShip()?.location?.positionKm ?? null,
	);

	protected readonly isDocked = computed(() => {
		const status = this.activeShip()?.status?.trim().toLowerCase() ?? '';
		return status === 'docked';
	});

	protected readonly localMarkets = computed<MarketHubMarketView[]>(() => {
		const selectedRadiusKm = this.selectedRadiusKm();
		const shipPositionKm = this.activeShipPositionKm();
		const shipSolarSystemId = this.activeShipSolarSystemId();

		return this.markets()
			.filter((market) => !shipSolarSystemId || market.solarSystemId === shipSolarSystemId)
			.map((market) => {
				const marketPositionKm = KNOWN_MARKET_POSITIONS_KM[market.marketId];
				const distanceKm = shipPositionKm && marketPositionKm
					? computeDistanceKm(shipPositionKm, marketPositionKm)
					: null;
				return {
					...market,
					distanceKm,
				};
			})
			.filter((market) => market.distanceKm === null || market.distanceKm <= selectedRadiusKm)
			.sort((a, b) => {
				if (a.distanceKm === null && b.distanceKm === null) {
					return a.marketName.localeCompare(b.marketName);
				}
				if (a.distanceKm === null) {
					return 1;
				}
				if (b.distanceKm === null) {
					return -1;
				}
				return a.distanceKm - b.distanceKm;
			});
	});

	/** The M-01 mission progress entry if it is active. */
	protected readonly activeM01Mission = computed(() =>
		this.missions().find(
			(m) => m.missionId === MISSION_IDS.m01 && (m.status === 'available' || m.status === 'started' || m.status === 'in-progress'),
		) ?? null,
	);

	/** M-01 catalog definition for briefing/objectives display. */
	protected readonly m01Definition = resolveMissionById(MISSION_IDS.m01);

	constructor() {
		this.socketService.connect(this.socketService.serverUrl);

		if (this.socketService.getIsConnected()) {
			this.loadNearbyMarkets();
		} else {
			this.socketService.once('connect', () => this.loadNearbyMarkets());
		}
	}

	applyRadiusSelection(): void {
		if (this.marketFilterForm.invalid) {
			this.marketFilterForm.markAllAsTouched();
			return;
		}

		const selectedRadius = Number(this.marketFilterForm.controls.radiusKm.value ?? DEFAULT_MARKET_RADIUS_KM);
		this.selectedRadiusKm.set(selectedRadius);
	}

	loadNearbyMarkets(): void {
		const playerName = this.playerName().trim();
		const sessionKey = this.sessionService.getSessionKey()?.trim() ?? '';

		if (!playerName) {
			this.marketListError.set(this.t.game.marketHub.errors.loadMarketsRequiresPlayer);
			this.markets.set([]);
			return;
		}

		if (!sessionKey) {
			this.marketListError.set(this.t.game.marketHub.errors.loadMarketsRequiresSessionKey);
			this.markets.set([]);
			return;
		}

		this.isLoadingMarkets.set(true);
		this.marketListError.set(null);
		this.unsubscribeMarketListResponse?.();

		this.unsubscribeMarketListResponse = this.socketService.on(
			MARKET_LIST_RESPONSE_EVENT,
			(response: MarketListResponse) => {
				this.isLoadingMarkets.set(false);
				if (response.success) {
					this.markets.set(response.markets ?? []);
					this.marketListError.set(null);
				} else {
					this.markets.set([]);
					this.marketListError.set(response.message);
				}
				this.unsubscribeMarketListResponse?.();
			},
		);

		const request: MarketListRequest = {
			playerName,
			sessionKey,
			solarSystemId: this.activeShipSolarSystemId(),
		};
		this.socketService.emit(MARKET_LIST_REQUEST_EVENT, request);
	}

	protected formatMarketDistance(distanceKm: number | null): string {
		if (distanceKm === null) {
			return this.t.game.marketHub.unknownDistanceLabel;
		}

		return `${distanceKm.toFixed(1)} km`;
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
