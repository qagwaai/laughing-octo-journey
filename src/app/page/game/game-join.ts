import { ChangeDetectionStrategy, Component, effect, inject, OnDestroy, signal } from '@angular/core';
import { Router } from '@angular/router';
import { locale } from '../../i18n/locale';
import { PlayerCharacterSummary } from '../../model/character-list';
import {
	DRONE_LIST_REQUEST_EVENT,
	DRONE_LIST_RESPONSE_EVENT,
	DroneKinematics,
	DroneListRequest,
	DroneListResponse,
	DroneSummary,
	SpatialReference,
} from '../../model/drone-list';
import { summarizeDroneMotion } from '../../model/kinematics';
import { INVALID_SESSION_EVENT } from '../../model/session';
import { SessionService } from '../../services/session.service';
import { SocketService } from '../../services/socket.service';
import { Triple } from '../../model/triple';
import { GuardedLeftMenu } from './guarded-left-menu';

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
	private unsubscribeDroneListResponse?: () => void;
	private unsubscribeInvalidSession?: () => void;
	private navigationState: GameJoinNavigationState =
		(this.router.getCurrentNavigation()?.extras.state as GameJoinNavigationState | undefined) ??
		(history.state as GameJoinNavigationState | undefined) ??
		{};

	protected playerName = signal<string>(this.navigationState.playerName ?? '');
	protected joinCharacter = signal<PlayerCharacterSummary | null>(this.navigationState.joinCharacter ?? null);
	protected characterName = signal<string>(this.joinCharacter()?.characterName ?? 'Unknown Character');
	protected drones = signal<DroneSummary[]>([]);
	protected isLoadingDrones = signal(false);
	protected droneListError = signal<string | null>(null);

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
			this.loadDronesForCharacter();
		} else {
			this.socketService.once('connect', () => this.loadDronesForCharacter());
		}
	}

	loadDronesForCharacter(): void {
		const playerName = this.playerName().trim();
		const character = this.joinCharacter();

		if (!playerName) {
			this.droneListError.set('Player name is required to load drones.');
			this.drones.set([]);
			return;
		}

		if (!character?.id) {
			this.droneListError.set('Character id is required to load drones.');
			this.drones.set([]);
			return;
		}

		this.isLoadingDrones.set(true);
		this.droneListError.set(null);
		this.unsubscribeDroneListResponse?.();

		this.unsubscribeDroneListResponse = this.socketService.on(
			DRONE_LIST_RESPONSE_EVENT,
			(response: DroneListResponse) => {
				this.isLoadingDrones.set(false);
				if (response.success) {
					this.drones.set((response.drones ?? []).map((drone) => this.normalizeDroneSummary(drone)));
					this.droneListError.set(null);
				} else {
					this.drones.set([]);
					this.droneListError.set(response.message);
				}
				this.unsubscribeDroneListResponse?.();
			},
		);

		const request: DroneListRequest = {
			playerName,
			characterId: character.id,
			sessionKey: this.sessionService.getSessionKey()!,
		};
		this.socketService.emit(DRONE_LIST_REQUEST_EVENT, request);
	}

	private normalizeDroneSummary(drone: DroneSummary): DroneSummary {
		const rawDrone = drone as DroneSummary & {
			droneName?: string;
			displayName?: string;
			position?: Triple;
			location?: Triple;
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

		const normalizedName = rawDrone.name?.trim() || rawDrone.droneName?.trim() || rawDrone.displayName?.trim() || rawDrone.id;
		const normalizedKinematics = this.normalizeDroneKinematics(rawDrone);

		return {
			...drone,
			name: normalizedName,
			kinematics: normalizedKinematics,
		};
	}

	private normalizeDroneKinematics(drone: DroneSummary & {
		position?: Triple;
		location?: Triple;
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
	}): DroneKinematics | undefined {
		if (drone.kinematics) {
			return drone.kinematics;
		}

		const position = this.normalizeTriple(drone.position) ?? this.normalizeTriple(drone.location);
		const velocity =
			this.normalizeTriple(drone.velocity) ??
			this.normalizeTriple(drone.velocityVector) ??
			this.normalizeTriple(drone.directionOfTravel);

		if (!position || !velocity) {
			return undefined;
		}

		return {
			position,
			velocity,
			reference: {
				solarSystemId: drone.reference?.solarSystemId ?? drone.solarSystemId ?? 'unknown-system',
				referenceKind: drone.reference?.referenceKind ?? drone.referenceKind ?? 'barycentric',
				referenceBodyId: drone.reference?.referenceBodyId ?? drone.referenceBodyId,
				distanceUnit: drone.reference?.distanceUnit ?? drone.distanceUnit ?? 'km',
				velocityUnit: drone.reference?.velocityUnit ?? drone.velocityUnit ?? 'km/s',
				epochMs: drone.reference?.epochMs ?? drone.epochMs ?? Date.now(),
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

	navigateToDroneSpecs(drone: DroneSummary): void {
		const playerName = this.playerName();
		const joinCharacter = this.joinCharacter();

		this.router.navigate([{ outlets: { right: ['drone-view-specs'], left: ['game-join'] } }], {
			preserveFragment: true,
			state: {
				playerName,
				joinCharacter,
				joinDrone: drone,
			},
		});
	}

	protected getDroneDisplayName(drone: DroneSummary): string {
		return drone.name.trim() || 'Unnamed Drone';
	}

	protected getDroneKinematicsSummary(drone: DroneSummary): string {
		const kinematics = drone.kinematics;
		if (!kinematics) {
			return 'Kinematics unavailable';
		}

		const motion = summarizeDroneMotion(kinematics);
		const speed = `${motion.speedKmPerSec.toFixed(3)} ${kinematics.reference.velocityUnit}`;
		const position = `(${kinematics.position.x}, ${kinematics.position.y}, ${kinematics.position.z}) ${kinematics.reference.distanceUnit}`;

		if (!motion.headingUnitVector) {
			return `${kinematics.reference.referenceKind}, position ${position}, stationary at ${speed}`;
		}

		const heading = `(${motion.headingUnitVector.x.toFixed(3)}, ${motion.headingUnitVector.y.toFixed(3)}, ${motion.headingUnitVector.z.toFixed(3)})`;
		return `${kinematics.reference.referenceKind}, position ${position}, speed ${speed}, heading ${heading}`;
	}

	ngOnDestroy(): void {
		this.unsubscribeDroneListResponse?.();
		this.unsubscribeInvalidSession?.();
	}
}
