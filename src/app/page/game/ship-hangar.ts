import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PlayerCharacterSummary } from '../../model/character-list';
import { FIRST_TARGET_MISSION_ID } from '../../model/mission.locale';
import {
	SHIP_LIST_REQUEST_EVENT,
	SHIP_LIST_RESPONSE_EVENT,
	coerceShipModel,
	coerceShipInventory,
	coerceShipTier,
	type ShipListRequest,
	type ShipListResponse,
	type ShipSummary,
} from '../../model/ship-list';
import { type MissionStatus } from '../../model/mission';
import { type ShipExteriorViewMissionContext } from '../../model/ship-exterior-view-context';
import { GuardedLeftMenu } from '../../component/guarded-left-menu';
import { locale } from '../../i18n/locale';
import { SessionService } from '../../services/session.service';
import { SocketService } from '../../services/socket.service';

interface ShipHangarNavigationState {
	playerName?: string;
	joinCharacter?: PlayerCharacterSummary;
}

@Component({
	selector: 'app-ship-hangar-page',
	templateUrl: './ship-hangar.html',
	styleUrls: ['./ship-hangar.css'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [GuardedLeftMenu],
})
export default class ShipHangarPage {
	protected readonly t = locale;
	private router = inject(Router);
	private socketService = inject(SocketService);
	private sessionService = inject(SessionService);
	private unsubscribeShipListResponse?: () => void;
	private navigationState: ShipHangarNavigationState =
		(this.router.getCurrentNavigation()?.extras.state as ShipHangarNavigationState | undefined) ??
		(history.state as ShipHangarNavigationState | undefined) ??
		{};

	protected playerName = signal<string>(this.navigationState.playerName ?? '');
	protected joinCharacter = signal<PlayerCharacterSummary | null>(this.navigationState.joinCharacter ?? null);
	protected ships = signal<ShipSummary[]>([]);
	protected isLoadingShips = signal(false);
	protected shipListError = signal<string | null>(null);

	constructor() {
		this.socketService.connect(this.socketService.serverUrl);

		if (this.socketService.getIsConnected()) {
			this.loadShipsForCharacter();
		} else {
			this.socketService.once('connect', () => this.loadShipsForCharacter());
		}
	}

	loadShipsForCharacter(): void {
		const playerName = this.playerName().trim();
		const characterId = this.joinCharacter()?.id?.trim() ?? '';
		const sessionKey = this.sessionService.getSessionKey()?.trim() ?? '';

		if (!playerName) {
			this.shipListError.set('Player name is required to load ships.');
			this.ships.set([]);
			return;
		}

		if (!characterId) {
			this.shipListError.set('Character id is required to load ships.');
			this.ships.set([]);
			return;
		}

		if (!sessionKey) {
			this.shipListError.set('Session key is required to load ships.');
			this.ships.set([]);
			return;
		}

		this.isLoadingShips.set(true);
		this.shipListError.set(null);
		this.unsubscribeShipListResponse?.();

		this.unsubscribeShipListResponse = this.socketService.on(
			SHIP_LIST_RESPONSE_EVENT,
			(response: ShipListResponse) => {
				this.isLoadingShips.set(false);
				if (response.success) {
					this.ships.set((response.ships ?? []).map((ship) => this.normalizeShipSummary(ship)));
					this.shipListError.set(null);
				} else {
					this.ships.set([]);
					this.shipListError.set(response.message);
				}
				this.unsubscribeShipListResponse?.();
			},
		);

		const request: ShipListRequest = { playerName, characterId, sessionKey };
		this.socketService.emit(SHIP_LIST_REQUEST_EVENT, request);
	}

	private normalizeShipSummary(ship: ShipSummary): ShipSummary {
		const rawShip = ship as ShipSummary & { modelName?: string; tierLevel?: number };
		const normalizedModel = coerceShipModel(rawShip.model ?? rawShip.modelName);
		return {
			...ship,
			model: normalizedModel,
			tier: coerceShipTier(rawShip.tier ?? rawShip.tierLevel),
			inventory: coerceShipInventory(rawShip.inventory),
		};
	}

	protected getShipDisplayName(ship: ShipSummary): string {
		return ship.name?.trim() || ship.id;
	}

	protected getShipModelLabel(ship: ShipSummary): string {
		return coerceShipModel(ship.model);
	}

	protected getShipTierLabel(ship: ShipSummary): string {
		return `T${coerceShipTier(ship.tier)}`;
	}

	protected getShipLocationSummary(ship: ShipSummary): string {
		const position = ship.location?.positionKm ?? ship.kinematics?.position;
		if (!position) {
			return this.t.game.shipHangar.locationUnavailable;
		}

		return `(${position.x}, ${position.y}, ${position.z}) km`;
	}

	private getFirstTargetMissionStatus(): MissionStatus | undefined {
		const missions = this.joinCharacter()?.missions;
		if (!Array.isArray(missions)) {
			return undefined;
		}

		return missions.find((mission) => mission.missionId === FIRST_TARGET_MISSION_ID)?.status;
	}

	navigateToShipInventory(ship: ShipSummary): void {
		this.router.navigate([{ outlets: { left: ['ship-view-inventory'] } }], {
			preserveFragment: true,
			state: {
				playerName: this.playerName(),
				joinCharacter: this.joinCharacter(),
				joinShip: ship,
			},
		});
	}

	navigateToExteriorView(ship: ShipSummary): void {
		const firstTargetMissionStatus = this.getFirstTargetMissionStatus();
		const missionContext: ShipExteriorViewMissionContext = {
			missionId: FIRST_TARGET_MISSION_ID,
			seedPolicy: 'auto',
			...(firstTargetMissionStatus ? { missionStatusHint: firstTargetMissionStatus } : {}),
		};

		this.router.navigate([{ outlets: { right: ['ship-exterior-view'], left: ['ship-hangar'] } }], {
			preserveFragment: true,
			state: {
				playerName: this.playerName(),
				joinCharacter: this.joinCharacter(),
				joinShip: ship,
				missionContext,
				...(firstTargetMissionStatus ? { firstTargetMissionStatus } : {}),
			},
		});
	}

	navigateToShipSpecs(ship: ShipSummary): void {
		this.router.navigate([{ outlets: { right: ['item-view-specs'], left: ['ship-hangar'] } }], {
			preserveFragment: true,
			queryParams: { specsNav: Date.now() },
			state: {
				playerName: this.playerName(),
				joinCharacter: this.joinCharacter(),
				itemType: coerceShipModel(ship.model),
				item: ship,
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
}
