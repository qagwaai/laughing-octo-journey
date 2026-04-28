import { ChangeDetectionStrategy, Component, effect, inject, OnDestroy, signal } from '@angular/core';
import { Router } from '@angular/router';
import { locale } from '../../i18n/locale';
import { PlayerCharacterSummary } from '../../model/character-list';
import {
	SHIP_LIST_REQUEST_EVENT,
	SHIP_LIST_RESPONSE_EVENT,
	coerceShipModel,
	coerceShipInventory,
	coerceShipTier,
	ShipListRequest,
	ShipKinematics,
	ShipListResponse,
	ShipSummary,
	SpatialReference,
} from '../../model/ship-list';
import { CelestialBodyLocation } from '../../model/celestial-body-location';
import { summarizeShipMotion } from '../../model/kinematics';
import { INVALID_SESSION_EVENT } from '../../model/session';
import { SessionService } from '../../services/session.service';
import { SocketService } from '../../services/socket.service';
import { Triple } from '../../model/triple';
import { GuardedLeftMenu } from '../../component/guarded-left-menu';

interface GameJoinNavigationState {
	playerName?: string;
	joinCharacter?: PlayerCharacterSummary;
}

@Component({
	selector: 'app-game-join-page',
	templateUrl: './game-join.html',
	styleUrls: ['./game-join.css'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [GuardedLeftMenu],
})
export default class GameJoinPage {
	protected readonly t = locale;
	private router = inject(Router);
	private socketService = inject(SocketService);
	private sessionService = inject(SessionService);
	private unsubscribeShipListResponse?: () => void;
	private unsubscribeInvalidSession?: () => void;
	private navigationState: GameJoinNavigationState =
		(this.router.getCurrentNavigation()?.extras.state as GameJoinNavigationState | undefined) ??
		(history.state as GameJoinNavigationState | undefined) ??
		{};

	protected playerName = signal<string>(this.navigationState.playerName ?? '');
	protected joinCharacter = signal<PlayerCharacterSummary | null>(this.navigationState.joinCharacter ?? null);
	protected characterName = signal<string>(this.joinCharacter()?.characterName ?? 'Unknown Character');
	protected ships = signal<ShipSummary[]>([]);
	protected isLoadingShips = signal(false);
	protected shipListError = signal<string | null>(null);

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

		if (this.socketService.getIsConnected()) {
			this.loadShipsForCharacter();
		} else {
			this.socketService.once('connect', () => this.loadShipsForCharacter());
		}
	}

	loadShipsForCharacter(): void {
		const playerName = this.playerName().trim();
		const character = this.joinCharacter();

		if (!playerName) {
			this.shipListError.set('Player name is required to load ships.');
			this.ships.set([]);
			return;
		}

		if (!character?.id) {
			this.shipListError.set('Character id is required to load ships.');
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

		const request: ShipListRequest = {
			playerName,
			characterId: character.id,
			sessionKey: this.sessionService.getSessionKey()!,
		};
		this.socketService.emit(SHIP_LIST_REQUEST_EVENT, request);
	}

	private normalizeShipSummary(ship: ShipSummary): ShipSummary {
		const rawShip = ship as ShipSummary & {
			shipName?: string;
			displayName?: string;
			modelName?: string;
			tierLevel?: number;
			position?: Triple;
			location?: Triple;
			bodyLocation?: CelestialBodyLocation;
			velocity?: Triple;
			velocityVector?: Triple;
			directionOfTravel?: Triple;
			reference?: Partial<SpatialReference>;
			solarSystemId?: string;
			referenceKind?: SpatialReference['referenceKind'];
			referenceBodyId?: string;
			distanceUnit?: SpatialReference['distanceUnit'];
			velocityUnit?: SpatialReference['velocityUnit'];
			epochMs?: number;
		};

		const normalizedName = rawShip.name?.trim() || rawShip.shipName?.trim() || rawShip.displayName?.trim() || rawShip.id;
		const normalizedKinematics = this.normalizeShipKinematics(rawShip);
		const normalizedModel = coerceShipModel(rawShip.model ?? rawShip.modelName);
		const normalizedTier = coerceShipTier(rawShip.tier ?? rawShip.tierLevel);
		const normalizedInventory = coerceShipInventory(rawShip.inventory);

		return {
			...ship,
			name: normalizedName,
			model: normalizedModel,
			tier: normalizedTier,
			inventory: normalizedInventory,
			kinematics: normalizedKinematics,
		};
	}

	private normalizeShipKinematics(ship: ShipSummary & {
		position?: Triple;
		location?: Triple;
		bodyLocation?: CelestialBodyLocation;
		velocity?: Triple;
		velocityVector?: Triple;
		directionOfTravel?: Triple;
		reference?: Partial<SpatialReference>;
		solarSystemId?: string;
		referenceKind?: SpatialReference['referenceKind'];
		referenceBodyId?: string;
		distanceUnit?: SpatialReference['distanceUnit'];
		velocityUnit?: SpatialReference['velocityUnit'];
		epochMs?: number;
	}): ShipKinematics | undefined {
		if (ship.kinematics) {
			return ship.kinematics;
		}

		const positionFromLocation = ship.location?.positionKm ?? ship.bodyLocation?.positionKm;
		const position =
			this.normalizeTriple(ship.position) ??
			this.normalizeTriple(positionFromLocation) ??
			this.normalizeTriple(ship.location);
		const velocity =
			this.normalizeTriple(ship.velocity) ??
			this.normalizeTriple(ship.velocityVector) ??
			this.normalizeTriple(ship.directionOfTravel);

		if (!position || !velocity) {
			return undefined;
		}

		return {
			position,
			velocity,
			reference: {
				solarSystemId: ship.reference?.solarSystemId ?? ship.solarSystemId ?? 'unknown-system',
				referenceKind: ship.reference?.referenceKind ?? ship.referenceKind ?? 'barycentric',
				referenceBodyId: ship.reference?.referenceBodyId ?? ship.referenceBodyId,
				distanceUnit: ship.reference?.distanceUnit ?? ship.distanceUnit ?? 'km',
				velocityUnit: ship.reference?.velocityUnit ?? ship.velocityUnit ?? 'km/s',
				epochMs: ship.reference?.epochMs ?? ship.epochMs ?? Date.now(),
			},
		};
	}

	private normalizeTriple(value: unknown): Triple | undefined {
		if (!value || typeof value !== 'object') {
			return undefined;
		}

		const candidate = value as Partial<Record<'x' | 'y' | 'z', unknown>>;
		if (typeof candidate.x !== 'number' || typeof candidate.y !== 'number' || typeof candidate.z !== 'number') {
			return undefined;
		}

		return {
			x: candidate.x,
			y: candidate.y,
			z: candidate.z,
		};
	}

	navigateToShipSpecs(ship: ShipSummary): void {
		const playerName = this.playerName();
		const joinCharacter = this.joinCharacter();

		this.router.navigate([{ outlets: { right: ['item-view-specs'], left: ['game-join'] } }], {
			preserveFragment: true,
			queryParams: { specsNav: Date.now() },
			state: {
				playerName,
				joinCharacter,
				itemType: coerceShipModel(ship.model),
				item: ship,
			},
		});
	}

	protected getShipDisplayName(ship: ShipSummary): string {
		return ship.name.trim() || 'Unnamed Ship';
	}

	protected getShipModelLabel(ship: ShipSummary): string {
		return coerceShipModel(ship.model);
	}

	protected getShipTierLabel(ship: ShipSummary): string {
		return `T${coerceShipTier(ship.tier)}`;
	}

	protected getShipKinematicsSummary(ship: ShipSummary): string {
		const kinematics = ship.kinematics;
		if (!kinematics) {
			return 'Kinematics unavailable';
		}

		const motion = summarizeShipMotion(kinematics);
		const speed = `${motion.speedKmPerSec.toFixed(3)} ${kinematics.reference.velocityUnit}`;
		const position = `(${kinematics.position.x}, ${kinematics.position.y}, ${kinematics.position.z}) ${kinematics.reference.distanceUnit}`;

		if (!motion.headingUnitVector) {
			return `${kinematics.reference.referenceKind}, position ${position}, stationary at ${speed}`;
		}

		const heading = `(${motion.headingUnitVector.x.toFixed(3)}, ${motion.headingUnitVector.y.toFixed(3)}, ${motion.headingUnitVector.z.toFixed(3)})`;
		return `${kinematics.reference.referenceKind}, position ${position}, speed ${speed}, heading ${heading}`;
	}

	ngOnDestroy(): void {
		this.unsubscribeShipListResponse?.();
		this.unsubscribeInvalidSession?.();
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
