import { ChangeDetectionStrategy, Component, computed, inject, OnDestroy, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { PlayerCharacterSummary } from '../../model/character-list';
import { GuardedLeftMenu } from '../../component/guarded-left-menu';
import { CharacterShipBadge } from '../../component/character-ship-badge';
import { locale } from '../../i18n/locale';
import type { CharacterMissionProgress } from '../../model/mission';
import { MISSION_IDS, resolveMissionById } from '../../model/mission-catalog';
import {
	MARKET_LIST_BY_LOCATION_REQUEST_EVENT,
	MARKET_LIST_BY_LOCATION_RESPONSE_EVENT,
	type MarketListByLocationRequest,
	type MarketListByLocationResponse,
	type MarketSummary,
} from '../../model/market-list';
import {
	SHIP_LIST_REQUEST_EVENT,
	SHIP_LIST_RESPONSE_EVENT,
	type ShipListRequest,
	type ShipListResponse,
	type ShipSummary,
} from '../../model/ship-list';
import { SessionService } from '../../services/session.service';
import { SocketService } from '../../services/socket.service';
import type { Triple } from '../../model/triple';

const DEFAULT_MARKET_RADIUS_KM = 100;
const MARKET_RADIUS_OPTIONS_KM: readonly number[] = [25, 50, 100, 250, 500, 1000];

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
	private unsubscribeMarketListByLocationResponse?: () => void;
	private unsubscribeShipListResponse?: () => void;
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
	protected isDockedAtAnyMarket = signal(false);
	protected dockedMarketId = signal<string | null>(null);
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

	protected readonly isDocked = computed(() => this.isDockedAtAnyMarket());

	protected readonly localMarkets = computed<MarketSummary[]>(() =>
		(this.markets() ?? []).slice().sort((a, b) => {
			const aDistance = typeof a.distanceKm === 'number' ? a.distanceKm : Number.POSITIVE_INFINITY;
			const bDistance = typeof b.distanceKm === 'number' ? b.distanceKm : Number.POSITIVE_INFINITY;
			return aDistance - bDistance;
		}),
	);

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
			this.ensureActiveShipPosition();
			this.loadNearbyMarkets();
		} else {
			this.socketService.once('connect', () => {
				this.ensureActiveShipPosition();
				this.loadNearbyMarkets();
			});
		}
	}

	ngOnDestroy(): void {
		this.unsubscribeMarketListByLocationResponse?.();
		this.unsubscribeShipListResponse?.();
	}

	private ensureActiveShipPosition(): void {
		const existing = this.activeShip();
		if (existing?.kinematics?.position || existing?.location?.positionKm) {
			return;
		}

		const playerName = this.playerName().trim();
		const characterId = this.joinCharacter()?.id?.trim() ?? '';
		const sessionKey = this.sessionService.getSessionKey()?.trim() ?? '';

		if (!playerName || !characterId || !sessionKey) {
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

				const ships = response.ships ?? [];
				if (ships.length === 0) {
					this.unsubscribeShipListResponse?.();
					return;
				}

				const current = this.activeShip();
				const sameShip = current ? ships.find((ship) => ship.id === current.id) : undefined;
				const shipWithPosition = ships.find((ship) => ship.kinematics?.position || ship.location?.positionKm);
				const fallbackShip = ships[0];

				const resolvedShip: ShipSummary | undefined =
					sameShip ?? shipWithPosition ?? fallbackShip;

				if (resolvedShip) {
					this.sessionService.setActiveShip(resolvedShip);
				}

				this.unsubscribeShipListResponse?.();
			},
		);

		const request: ShipListRequest = {
			playerName,
			characterId,
			sessionKey,
		};
		this.socketService.emit(SHIP_LIST_REQUEST_EVENT, request);
	}

	applyRadiusSelection(): void {
		if (this.marketFilterForm.invalid) {
			this.marketFilterForm.markAllAsTouched();
			return;
		}

		const selectedRadius = Number(this.marketFilterForm.controls.radiusKm.value ?? DEFAULT_MARKET_RADIUS_KM);
		this.selectedRadiusKm.set(selectedRadius);
		this.loadNearbyMarkets();
	}

	loadNearbyMarkets(): void {
		const playerName = this.playerName().trim();
		const sessionKey = this.sessionService.getSessionKey()?.trim() ?? '';
		const positionKm = this.activeShipPositionKm();
		const solarSystemId = this.activeShipSolarSystemId();
		const characterId = this.joinCharacter()?.id?.trim() ?? '';
		const shipId = this.activeShip()?.id?.trim() ?? '';

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

		if (!positionKm) {
			this.marketListError.set(this.t.game.marketHub.errors.loadMarketsRequiresPosition);
			this.markets.set([]);
			this.isDockedAtAnyMarket.set(false);
			this.dockedMarketId.set(null);
			return;
		}

		this.isLoadingMarkets.set(true);
		this.marketListError.set(null);
		this.unsubscribeMarketListByLocationResponse?.();

		this.unsubscribeMarketListByLocationResponse = this.socketService.on(
			MARKET_LIST_BY_LOCATION_RESPONSE_EVENT,
			(response: MarketListByLocationResponse) => {
				this.isLoadingMarkets.set(false);
				if (response.success) {
					this.markets.set(response.markets ?? []);
					this.isDockedAtAnyMarket.set(Boolean(response.isDocked));
					this.dockedMarketId.set(response.dockedMarketId ?? null);
					this.marketListError.set(null);
				} else {
					this.markets.set([]);
					this.isDockedAtAnyMarket.set(false);
					this.dockedMarketId.set(null);
					this.marketListError.set(response.message);
				}
				this.unsubscribeMarketListByLocationResponse?.();
			},
		);

		const request: MarketListByLocationRequest = {
			playerName,
			sessionKey,
			solarSystemId,
			positionKm,
			distanceKm: this.selectedRadiusKm(),
			limit: 50,
			locationTypes: ['station'],
			...(characterId ? { characterId } : {}),
			...(shipId ? { shipId } : {}),
		};
		this.socketService.emit(MARKET_LIST_BY_LOCATION_REQUEST_EVENT, request);
	}

	protected formatMarketDistance(distanceKm: number | null): string {
		if (distanceKm === null || !Number.isFinite(distanceKm)) {
			return this.t.game.marketHub.unknownDistanceLabel;
		}

		return `${distanceKm.toFixed(1)} km`;
	}

	protected canTransactAtMarket(market: MarketSummary): boolean {
		if (market.isDocked === true) {
			return true;
		}

		const dockedMarketId = this.dockedMarketId();
		if (this.isDockedAtAnyMarket() && dockedMarketId && market.marketId === dockedMarketId) {
			return true;
		}

		return false;
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
