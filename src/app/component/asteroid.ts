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
import { beforeRender as _beforeRender, NgtArgs } from 'angular-three';
import { AsteroidMaterialProfile } from '../model/asteroid-materials';
import * as THREE from 'three';

export interface AsteroidHoverEvent {
	id: string;
	hovering: boolean;
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
	scanProgress = input(0);
	scanned = input(false);
	revealedMaterial = input<AsteroidMaterialProfile | null>(null);

	@Output() hoverChange = new EventEmitter<AsteroidHoverEvent>();

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

	constructor() {
		const beforeRender = inject(ASTEROID_BEFORE_RENDER_FN);
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
			mesh.rotation.y += delta * 0.45;
			mesh.rotation.x += delta * 0.1;
			this.morphPulseElapsedSeconds.update((elapsed) =>
				Math.min(MORPH_PULSE_DURATION_SECONDS, elapsed + delta),
			);
			this.pulsePhase.update((phase) => (phase + delta * 2.1) % (Math.PI * 2));
		});
	}

	protected emitHover(hovering: boolean): void {
		this.hovered.set(hovering);
		this.hoverChange.emit({
			id: this.asteroidId(),
			hovering,
		});
	}
}
