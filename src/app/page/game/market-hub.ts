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
import {
	estimateTravelHours,
	resolveDriveProfileForShip,
	resolveMinimumDriveProfileForDistance,
} from '../../model/drive-profile';
import { resolveJumpGateHops } from '../../model/jump-gate';
import { SessionService } from '../../services/session.service';
import { SocketService } from '../../services/socket.service';
import type { Triple } from '../../model/triple';

const ASTRONOMICAL_UNIT_KM = 149_597_870.7;
const DEFAULT_MARKET_RADIUS_AU = 0.5;
const MARKET_RADIUS_OPTIONS_AU: readonly number[] = [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 25, 50];

interface MarketHubNavigationState {
	playerName?: string;
	joinCharacter?: PlayerCharacterSummary;
	missions?: CharacterMissionProgress[];
}

type MarketRouteStatus = 'in-system' | 'gate-route' | 'no-route';

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
	protected marketRadiusOptionsAu = MARKET_RADIUS_OPTIONS_AU;
	protected selectedRadiusAu = signal<number>(DEFAULT_MARKET_RADIUS_AU);
	protected markets = signal<MarketSummary[]>([]);
	protected isLoadingMarkets = signal(false);
	protected marketListError = signal<string | null>(null);
	protected isDockedAtAnyMarket = signal(false);
	protected dockedMarketId = signal<string | null>(null);
	protected activeShip = this.sessionService.activeShip;

	protected marketFilterForm = this.fb.group({
		radiusAu: [DEFAULT_MARKET_RADIUS_AU, [Validators.required, Validators.min(0.001)]],
	});

	protected readonly activeShipSolarSystemId = computed(
		() => this.activeShip()?.spatial.solarSystemId?.trim() || 'sol',
	);

	protected readonly activeShipPositionKm = computed<Triple | null>(
		() => {
			const position = this.activeShip()?.spatial.positionKm ?? null;
			return this.hasUsablePosition(position) ? position : null;
		},
	);

	protected readonly isDocked = computed(() => this.isDockedAtAnyMarket());

	protected readonly activeDriveProfile = computed(() =>
		resolveDriveProfileForShip(this.activeShip() ?? null),
	);

	protected readonly activeDriveRangeAu = computed(() => this.activeDriveProfile().rangeAu);
	protected readonly effectiveSearchRadiusAu = computed(() =>
		Math.min(this.selectedRadiusAu(), this.activeDriveRangeAu()),
	);

	protected readonly isSearchRadiusClamped = computed(
		() => this.selectedRadiusAu() > this.activeDriveRangeAu(),
	);

	protected readonly localMarkets = computed<MarketSummary[]>(() =>
		(this.markets() ?? []).slice().sort((a, b) => {
			const aDistance = typeof a.distanceAu === 'number' ? a.distanceAu : Number.POSITIVE_INFINITY;
			const bDistance = typeof b.distanceAu === 'number' ? b.distanceAu : Number.POSITIVE_INFINITY;
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
		if (this.hasUsableShipPosition(existing)) {
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
				const shipWithPosition = ships.find((ship) => this.hasUsablePosition(ship.spatial?.positionKm));
				const fallbackShip = ships[0];

				const resolvedShip: ShipSummary | undefined =
					sameShip ?? shipWithPosition ?? fallbackShip;

				if (resolvedShip) {
					this.sessionService.setActiveShip(resolvedShip);
					if (this.hasUsableShipPosition(resolvedShip)) {
						this.loadNearbyMarkets();
					}
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

	private hasUsableShipPosition(ship: ShipSummary | null): boolean {
		return this.hasUsablePosition(ship?.spatial?.positionKm);
	}

	private hasUsablePosition(position: Triple | null | undefined): boolean {
		if (!position) {
			return false;
		}

		// Treat origin as placeholder until we hydrate authoritative ship location.
		return !(position.x === 0 && position.y === 0 && position.z === 0);
	}

	applyRadiusSelection(): void {
		if (this.marketFilterForm.invalid) {
			this.marketFilterForm.markAllAsTouched();
			return;
		}

		const selectedRadius = Number(this.marketFilterForm.controls.radiusAu.value ?? DEFAULT_MARKET_RADIUS_AU);
		this.selectedRadiusAu.set(selectedRadius);
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
			distanceAu: this.effectiveSearchRadiusAu(),
			limit: 50,
			locationTypes: ['station'],
			...(characterId ? { characterId } : {}),
			...(shipId ? { shipId } : {}),
		};
		this.socketService.emit(MARKET_LIST_BY_LOCATION_REQUEST_EVENT, request);
	}

	protected formatMarketDistanceAu(distanceAu: number | null): string {
		if (distanceAu === null || !Number.isFinite(distanceAu)) {
			return this.t.game.marketHub.unknownDistanceLabel;
		}

		return `${distanceAu.toFixed(3)} ${this.t.game.marketHub.auLabel}`;
	}

	protected formatMarketDistanceKmTooltip(distanceAu: number | null): string {
		if (distanceAu === null || !Number.isFinite(distanceAu)) {
			return this.t.game.marketHub.unknownDistanceLabel;
		}

		const distanceKm = distanceAu * ASTRONOMICAL_UNIT_KM;
		let humanized = `${Math.round(distanceKm).toLocaleString()} km`;
		if (distanceKm >= 1_000_000) {
			humanized = `${(distanceKm / 1_000_000).toFixed(1)}M km`;
		} else if (distanceKm >= 1_000) {
			humanized = `${(distanceKm / 1_000).toFixed(1)}K km`;
		}

		return `${this.t.game.marketHub.approxDistancePrefix} ${humanized}`;
	}

	protected formatMarketTravelEstimate(distanceAu: number | null): string {
		if (distanceAu === null || !Number.isFinite(distanceAu)) {
			return this.t.game.marketHub.unknownDistanceLabel;
		}

		const hours = estimateTravelHours(distanceAu, this.activeDriveProfile());
		if (hours < 1) {
			return `${this.t.game.marketHub.aboutPrefix} ${this.t.game.marketHub.lessThanOneHourLabel} ${this.t.game.marketHub.standardCruiseSuffix}`;
		}

		const roundedHours = Math.round(hours);
		const unitLabel = roundedHours === 1 ? this.t.game.marketHub.hourLabel : this.t.game.marketHub.hoursLabel;
		return `${this.t.game.marketHub.aboutPrefix} ${roundedHours} ${unitLabel} ${this.t.game.marketHub.standardCruiseSuffix}`;
	}

	protected formatMarketFlavorText(market: MarketSummary): string {
		const activeSystem = this.activeShipSolarSystemId();
		if (market.solarSystemId !== activeSystem) {
			const hops = this.jumpGateHopsForMarket(market);
			if (hops !== null) {
				return `${market.marketName}, ${hops} ${hops === 1 ? this.t.game.marketHub.gateHopLabel : this.t.game.marketHub.gateHopsLabel} ${this.t.game.marketHub.awaySuffix}`;
			}

			return `${market.marketName}, ${this.t.game.marketHub.unreachableRouteLabel}`;
		}

		const distanceLabel = this.formatMarketDistanceAu(market.distanceAu ?? null);
		const travelEstimate = this.formatMarketTravelEstimate(market.distanceAu ?? null);
		return `${market.marketName}, ${distanceLabel} ${this.t.game.marketHub.awaySuffix} - ${travelEstimate}`;
	}

	protected marketRouteStatus(market: MarketSummary): MarketRouteStatus {
		if (market.solarSystemId === this.activeShipSolarSystemId()) {
			return 'in-system';
		}

		return this.jumpGateHopsForMarket(market) === null ? 'no-route' : 'gate-route';
	}

	protected marketRouteLabel(market: MarketSummary): string {
		const routeStatus = this.marketRouteStatus(market);
		if (routeStatus === 'in-system') {
			return this.t.game.marketHub.inSystemRouteLabel;
		}

		if (routeStatus === 'no-route') {
			return this.t.game.marketHub.noRouteLabel;
		}

		const hops = this.jumpGateHopsForMarket(market);
		if (hops === null) {
			return this.t.game.marketHub.noRouteLabel;
		}

		const hopLabel = hops === 1 ? this.t.game.marketHub.gateHopLabel : this.t.game.marketHub.gateHopsLabel;
		return `${hops} ${hopLabel}`;
	}

	protected isMarketWithinDriveRange(market: MarketSummary): boolean {
		if (market.solarSystemId !== this.activeShipSolarSystemId()) {
			return this.jumpGateHopsForMarket(market) !== null;
		}

		const distanceAu = market.distanceAu;
		if (distanceAu === undefined || !Number.isFinite(distanceAu)) {
			return false;
		}

		return distanceAu <= this.activeDriveProfile().rangeAu;
	}

	protected requiredDriveNameForMarket(market: MarketSummary): string {
		if (market.solarSystemId !== this.activeShipSolarSystemId()) {
			const hops = this.jumpGateHopsForMarket(market);
			if (hops !== null) {
				return `${hops} ${hops === 1 ? this.t.game.marketHub.gateHopLabel : this.t.game.marketHub.gateHopsLabel}`;
			}

			return this.t.game.marketHub.unreachableRouteLabel;
		}

		const distanceAu = market.distanceAu;
		if (distanceAu === undefined || !Number.isFinite(distanceAu)) {
			return this.t.game.marketHub.unknownDistanceLabel;
		}

		return resolveMinimumDriveProfileForDistance(distanceAu).name;
	}

	private jumpGateHopsForMarket(market: MarketSummary): number | null {
		return resolveJumpGateHops(this.activeShipSolarSystemId(), market.solarSystemId);
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
