import {
	Component,
	CUSTOM_ELEMENTS_SCHEMA,
	ElementRef,
	EventEmitter,
	effect,
	inject,
	InjectionToken,
	input,
	Output,
	signal,
	viewChild,
	computed,
} from '@angular/core';
import { beforeRender as _beforeRender, injectStore, NgtArgs } from 'angular-three';
import { AsteroidKinematics } from '../model/asteroid-kinematics';
import { CelestialBodyLocation } from '../model/celestial-body-location';
import { AsteroidMaterialProfile } from '../model/asteroid-materials';
import { Triple } from '../model/triple';
import * as THREE from 'three';

export interface AsteroidHoverEvent {
	id: string;
	hovering: boolean;
}

export interface AsteroidPointerButtonEvent {
	id: string;
	button: number;
}

export type AsteroidGeometryKind = 'dodecahedron' | 'icosahedron' | 'octahedron';

export interface AsteroidRevealProfile {
	geometry: AsteroidGeometryKind;
	detail: number;
	scale: [number, number, number];
}

const MORPH_PULSE_DURATION_SECONDS = 0.28;

export const ASTEROID_BEFORE_RENDER_FN = new InjectionToken<typeof _beforeRender>(
	'ASTEROID_BEFORE_RENDER_FN',
	{ providedIn: 'root', factory: () => _beforeRender },
);

export const ASTEROID_INJECT_STORE_FN = new InjectionToken<typeof injectStore>(
	'ASTEROID_INJECT_STORE_FN',
	{ providedIn: 'root', factory: () => injectStore },
);

export function resolveAsteroidMaterialColor(
	scanProgress: number,
	hovered: boolean,
	scanned: boolean,
	revealedMaterial: AsteroidMaterialProfile | null,
): string {
	if (scanned) {
		return revealedMaterial?.textureColor ?? '#8df7b2';
	}
	if (hovered) {
		return '#8de8ff';
	}
	if (scanProgress > 0) {
		return '#63a7bc';
	}
	return '#5f6d7b';
}

export function resolveAsteroidBeamOpacity(scanProgress: number, hovered: boolean, scanned: boolean): number {
	if (hovered) {
		return 0.58;
	}
	if (scanned) {
		return 0.36;
	}
	if (scanProgress > 0) {
		return 0.24;
	}
	return 0;
}

export function resolveAsteroidSweepOpacity(hovered: boolean): number {
	return hovered ? 0.92 : 0;
}

export function generateRandomAsteroidRevealProfile(random: () => number = Math.random): AsteroidRevealProfile {
	const geometryPool: AsteroidGeometryKind[] = ['dodecahedron', 'icosahedron', 'octahedron'];
	const geometry = geometryPool[Math.floor(random() * geometryPool.length)] ?? 'dodecahedron';
	const detail = geometry === 'octahedron' ? 0 : random() > 0.5 ? 1 : 0;

	const scaleX = 0.86 + random() * 0.42;
	const scaleY = 0.78 + random() * 0.58;
	const scaleZ = 0.84 + random() * 0.44;

	return {
		geometry,
		detail,
		scale: [Number(scaleX.toFixed(2)), Number(scaleY.toFixed(2)), Number(scaleZ.toFixed(2))],
	};
}

@Component({
	selector: 'app-asteroid',
	templateUrl: './asteroid.html',
	imports: [NgtArgs],
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class Asteroid {
	asteroidId = input('sample-1');
	position = input<[number, number, number]>([0, 0, 0]);
	targetingHold = input(false);
	targeted = input(false);
	scanProgress = input(0);
	scanned = input(false);
	revealedMaterial = input<AsteroidMaterialProfile | null>(null);
	revealedKinematics = input<AsteroidKinematics | null>(null);
	revealedLocation = input<CelestialBodyLocation | null>(null);
	revealedClusterCenterKm = input<Triple | null>(null);

	@Output() hoverChange = new EventEmitter<AsteroidHoverEvent>();
	@Output() pointerButtonDown = new EventEmitter<AsteroidPointerButtonEvent>();
	@Output() pointerButtonUp = new EventEmitter<AsteroidPointerButtonEvent>();

	private meshRef = viewChild.required<ElementRef<THREE.Mesh>>('mesh');
	private revealProfile = signal<AsteroidRevealProfile | null>(null);
	private completionEdgePrimed = false;
	private morphPulseElapsedSeconds = signal(MORPH_PULSE_DURATION_SECONDS);
	protected hovered = signal(false);
	protected pulsePhase = signal(0);
	protected Math = Math;
	protected morphPulse = computed(() => {
		const elapsed = this.morphPulseElapsedSeconds();
		if (elapsed >= MORPH_PULSE_DURATION_SECONDS) {
			return 0;
		}

		const progress = elapsed / MORPH_PULSE_DURATION_SECONDS;
		return Math.sin(progress * Math.PI);
	});
	protected activeGeometry = computed(() => this.revealProfile()?.geometry ?? 'dodecahedron');
	protected activeDetail = computed(() => this.revealProfile()?.detail ?? 0);
	protected meshScale = computed<[number, number, number]>(() => {
		const base = this.scanned() ? 1.08 : this.hovered() ? 1.03 : 1;
		const profileScale = this.revealProfile()?.scale ?? [1, 1, 1];
		const morph = this.morphPulse();
		const x = (1 + morph * 0.14) * profileScale[0];
		const y = (1 - morph * 0.08) * profileScale[1];
		const z = (1 + morph * 0.18) * profileScale[2];
		return [base * x, base * y, base * z];
	});
	protected morphShellScale = computed(() => 1 + this.morphPulse() * 0.4);
	protected morphShellOpacity = computed(() => this.morphPulse() * 0.55);
	protected morphTiltX = computed(() => Math.sin(this.pulsePhase() * 2.3) * this.morphPulse() * 0.16);
	protected morphTiltZ = computed(() => Math.cos(this.pulsePhase() * 1.9) * this.morphPulse() * 0.12);
	protected revealedMaterialColor = computed(() => this.revealedMaterial()?.textureColor ?? '#8df7b2');
	protected showResultDialog = computed(() => this.scanned() && this.hovered() && !!this.revealedMaterial());
	protected resultDialogMaterialText = computed(() => `MATERIAL: ${this.revealedMaterial()?.material ?? 'UNKNOWN'}`);
	protected resultDialogRarityText = computed(() => `RARITY: ${this.revealedMaterial()?.rarity ?? 'UNKNOWN'}`);
	protected resultDialogVelocityText = computed(() => {
		const k = this.revealedKinematics();
		if (!k) return 'VEL: ---';
		const { x, y, z } = k.velocityKmPerSec;
		const speed = Math.sqrt(x * x + y * y + z * z);
		return `VEL: ${speed.toFixed(1)} km/s`;
	});
	protected resultDialogSpinText = computed(() => {
		const k = this.revealedKinematics();
		if (!k) return 'SPIN: ---';
		const { x, y, z } = k.angularVelocityRadPerSec;
		const spin = Math.sqrt(x * x + y * y + z * z);
		return `SPIN: ${spin.toFixed(4)} rad/s`;
	});
	protected resultDialogMassText = computed(() => {
		const k = this.revealedKinematics();
		if (!k) return 'MASS: ---';
		const kg = k.estimatedMassKg;
		if (kg >= 1e12) return `MASS: ${(kg / 1e12).toFixed(2)}e12 kg`;
		if (kg >= 1e9) return `MASS: ${(kg / 1e9).toFixed(2)}e9 kg`;
		return `MASS: ${kg.toFixed(0)} kg`;
	});
	protected resultDialogDiameterText = computed(() => {
		const k = this.revealedKinematics();
		if (!k) return 'DIAM: ---';
		return k.estimatedDiameterM >= 1000
			? `DIAM: ${(k.estimatedDiameterM / 1000).toFixed(2)} km`
			: `DIAM: ${k.estimatedDiameterM} m`;
	});
	protected resultDialogLocationText = computed(() => {
		const location = this.revealedLocation();
		if (!location) return 'LOC: ---';

		const { x, y, z } = location.positionKm;
		const xM = (x / 1e6).toFixed(3);
		const yM = (y / 1e6).toFixed(3);
		const zM = (z / 1e6).toFixed(3);
		return `LOC(Mkm): X ${xM} | Y ${yM} | Z ${zM}`;
	});
	protected resultDialogClusterText = computed(() => {
		const center = this.revealedClusterCenterKm();
		if (!center) return 'CLUSTER(Mkm): ---';

		const xM = (center.x / 1e6).toFixed(3);
		const yM = (center.y / 1e6).toFixed(3);
		const zM = (center.z / 1e6).toFixed(3);
		return `CLUSTER(Mkm): X ${xM} | Y ${yM} | Z ${zM}`;
	});
	protected resultDialogOffsetText = computed(() => {
		const location = this.revealedLocation();
		const center = this.revealedClusterCenterKm();
		if (!location || !center) return 'OFFSET(km): ---';

		const dx = location.positionKm.x - center.x;
		const dy = location.positionKm.y - center.y;
		const dz = location.positionKm.z - center.z;
		const distance = Math.hypot(dx, dy, dz);
		return `OFFSET(km): dX ${dx.toFixed(0)} dY ${dy.toFixed(0)} dZ ${dz.toFixed(0)} | R ${distance.toFixed(0)}`;
	});
	private cameraDistance = signal(1);
	protected dialogScale = computed(() => {
		const d = this.cameraDistance();
		// Keep billboard at a constant apparent size; calibrated to look right at ~6 units
		return Math.max(1, d / 6);
	});
	protected materialColor = computed(() =>
		resolveAsteroidMaterialColor(this.scanProgress(), this.hovered(), this.scanned(), this.revealedMaterial()),
	);
	protected beamOpacity = computed(() =>
		resolveAsteroidBeamOpacity(this.scanProgress(), this.hovered(), this.scanned()),
	);
	protected showScanFx = computed(() => {
		if (this.morphPulse() > 0) {
			return true;
		}

		if (this.scanned()) {
			return false;
		}

		return this.hovered() || this.scanProgress() > 0;
	});
	protected ringOpacityA = computed(() =>
		this.showScanFx() ? Math.min(1, 0.18 + this.scanProgress() * 0.0042 + this.morphPulse() * 0.36) : 0,
	);
	protected ringOpacityB = computed(() =>
		this.showScanFx() ? Math.min(1, 0.12 + this.scanProgress() * 0.0028 + this.morphPulse() * 0.24) : 0,
	);
	protected ringOpacityC = computed(() =>
		this.showScanFx() ? Math.min(1, 0.08 + this.scanProgress() * 0.002 + this.morphPulse() * 0.2) : 0,
	);
	protected ringScaleA = computed(() => 1 + Math.sin(this.pulsePhase()) * 0.06 + this.morphPulse() * 0.16);
	protected ringScaleB = computed(() => 1 + Math.sin(this.pulsePhase() + 1.1) * 0.08 + this.morphPulse() * 0.2);
	protected ringScaleC = computed(() => 1 + Math.sin(this.pulsePhase() + 2.2) * 0.1 + this.morphPulse() * 0.24);
	protected sweepOffsetY = computed(() => Math.sin(this.pulsePhase() * 2.2) * 0.43);
	protected sweepOpacity = computed(() => resolveAsteroidSweepOpacity(this.hovered()));
	protected targetHoldRingOpacity = computed(() => (this.targetingHold() ? 0.95 : 0));
	protected targetedRingOpacity = computed(() => (this.targeted() ? 0.9 : 0));

	constructor() {
		const beforeRender = inject(ASTEROID_BEFORE_RENDER_FN);
		const injectStoreFn = inject(ASTEROID_INJECT_STORE_FN);
		const store = injectStoreFn();
		const _pos = new THREE.Vector3();

		effect(() => {
			const scanComplete = this.scanProgress() >= 100;
			if (!this.completionEdgePrimed && scanComplete && !this.scanned()) {
				this.morphPulseElapsedSeconds.set(0);
			}

			this.completionEdgePrimed = scanComplete;
		});

		effect(() => {
			if (!this.scanned() || this.revealProfile()) {
				return;
			}

			this.morphPulseElapsedSeconds.set(0);
			this.revealProfile.set(generateRandomAsteroidRevealProfile());
		});

		beforeRender(({ delta }) => {
			const mesh = this.meshRef().nativeElement;
			const k = this.revealedKinematics();
			if (k && this.scanned()) {
				// Scale rad/s values up so subtle kinematics are visible in scene units
				const SPIN_SCALE = 20;
				mesh.rotation.x += delta * k.angularVelocityRadPerSec.x * SPIN_SCALE;
				mesh.rotation.y += delta * k.angularVelocityRadPerSec.y * SPIN_SCALE;
				mesh.rotation.z += delta * k.angularVelocityRadPerSec.z * SPIN_SCALE;
			} else {
				mesh.rotation.y += delta * 0.45;
				mesh.rotation.x += delta * 0.1;
			}
			this.morphPulseElapsedSeconds.update((elapsed) =>
				Math.min(MORPH_PULSE_DURATION_SECONDS, elapsed + delta),
			);
			this.pulsePhase.update((phase) => (phase + delta * 2.1) % (Math.PI * 2));

			const pos = this.position();
			_pos.set(pos[0], pos[1], pos[2]);
			const cam = store.snapshot.camera;
			this.cameraDistance.set(cam.position.distanceTo(_pos));
		});
	}

	protected emitHover(hovering: boolean): void {
		this.hovered.set(hovering);
		this.hoverChange.emit({
			id: this.asteroidId(),
			hovering,
		});
	}

	protected onPointerDown(event: { button?: number; buttons?: number; nativeEvent?: { button?: number; buttons?: number } }): void {
		const button = event.button ?? event.nativeEvent?.button;
		const buttons = event.buttons ?? event.nativeEvent?.buttons;
		const isRightButton = button === 2 || (button === undefined && typeof buttons === 'number' && (buttons & 2) === 2);
		if (!isRightButton) {
			return;
		}

		this.pointerButtonDown.emit({
			id: this.asteroidId(),
			button: 2,
		});
	}

	protected onPointerUp(event: { button?: number; nativeEvent?: { button?: number } }): void {
		const button = event.button ?? event.nativeEvent?.button;
		if (button !== 2) {
			return;
		}

		this.pointerButtonUp.emit({
			id: this.asteroidId(),
			button,
		});
	}
}
