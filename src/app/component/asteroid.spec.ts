import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import * as THREE from 'three';
import {
	Asteroid,
	ASTEROID_BEFORE_RENDER_FN,
	generateRandomAsteroidRevealProfile,
	resolveAsteroidBeamOpacity,
	resolveAsteroidMaterialColor,
	resolveAsteroidSweepOpacity,
	type AsteroidHoverEvent,
} from './asteroid';

describe('Asteroid', () => {
	let component: Asteroid;
	let fixture: ComponentFixture<Asteroid>;
	let beforeRenderSpy: jasmine.Spy;
	let beforeRenderCallbacks: Array<(state: any) => void>;

	beforeEach(async () => {
		beforeRenderCallbacks = [];
		beforeRenderSpy = jasmine.createSpy('beforeRender').and.callFake((callback: any) => {
			beforeRenderCallbacks.push(callback);
			return () => {};
		});

		await TestBed.configureTestingModule({
			imports: [Asteroid],
			providers: [{ provide: ASTEROID_BEFORE_RENDER_FN, useValue: beforeRenderSpy }],
			schemas: [CUSTOM_ELEMENTS_SCHEMA],
		}).compileComponents();

		fixture = TestBed.createComponent(Asteroid);
		component = fixture.componentInstance;
		(component as any).beforeRenderCallback = beforeRenderCallbacks[0];
	});

	it('should create component', () => {
		expect(component).toBeTruthy();
	});

	it('should register beforeRender callback', () => {
		expect(beforeRenderSpy).toHaveBeenCalled();
	});

	it('should emit hoverChange with asteroid id on pointer enter and exit', () => {
		const events: AsteroidHoverEvent[] = [];
		component.hoverChange.subscribe((evt) => events.push(evt));

		(component as any).emitHover(true);
		(component as any).emitHover(false);

		expect(events).toEqual([
			{ id: 'sample-1', hovering: true },
			{ id: 'sample-1', hovering: false },
		]);
	});

	it('should rotate asteroid mesh in beforeRender callback', () => {
		const mockMesh = new THREE.Mesh();
		mockMesh.rotation.x = 0;
		mockMesh.rotation.y = 0;
		(component as any).pulsePhase.set(0);

		(component as any).meshRef = jasmine.createSpy().and.returnValue({ nativeElement: mockMesh });
		(component as any).beforeRenderCallback({ delta: 2 });

		expect(mockMesh.rotation.y).toBeCloseTo(0.9);
		expect(mockMesh.rotation.x).toBeCloseTo(0.2);
		expect((component as any).pulsePhase()).toBeGreaterThan(0);
	});

	it('should enable sweep line opacity only when hovered', () => {
		expect((component as any).sweepOpacity()).toBe(0);
		(component as any).emitHover(true);
		expect((component as any).sweepOpacity()).toBeCloseTo(0.92);
	});

	it('should trigger morph pulse when scan progress reaches 100 percent', () => {
		const mockMesh = new THREE.Mesh();
		(component as any).meshRef = jasmine.createSpy().and.returnValue({ nativeElement: mockMesh });

		fixture.componentRef.setInput('scanProgress', 99);
		fixture.detectChanges();
		fixture.componentRef.setInput('scanProgress', 100);
		fixture.detectChanges();

		expect((component as any).morphPulseElapsedSeconds()).toBe(0);

		(component as any).beforeRenderCallback({ delta: 0.14 });

		expect((component as any).morphPulse()).toBeGreaterThan(0);
		expect((component as any).ringOpacityA()).toBeGreaterThan(0.6);
	});

	it('should apply non-uniform mesh deformation while morph pulse is active', () => {
		(component as any).revealProfile.set({ geometry: 'dodecahedron', detail: 0, scale: [1, 1, 1] });
		(component as any).morphPulseElapsedSeconds.set(0.14);

		const [x, y, z] = (component as any).meshScale();

		expect(x).toBeGreaterThan(1);
		expect(y).toBeLessThan(1);
		expect(z).toBeGreaterThan(x);
	});

	it('should remove scan rings after completion when morph pulse has finished', () => {
		fixture.componentRef.setInput('scanned', true);
		fixture.detectChanges();

		(component as any).emitHover(true);
		(component as any).morphPulseElapsedSeconds.set(0.28);

		expect((component as any).morphPulse()).toBe(0);
		expect((component as any).showScanFx()).toBeFalse();
		expect((component as any).ringOpacityA()).toBe(0);
		expect((component as any).ringOpacityB()).toBe(0);
		expect((component as any).ringOpacityC()).toBe(0);
	});
});

describe('resolveAsteroidMaterialColor', () => {
	it('should prioritize scanned color', () => {
		expect(resolveAsteroidMaterialColor(0, false, true, null)).toBe('#8df7b2');
	});

	it('should use selected material color when scanned', () => {
		expect(
			resolveAsteroidMaterialColor(100, false, true, {
				rarity: 'Rare',
				material: 'Silver',
				textureColor: '#cad5e3',
			}),
		).toBe('#cad5e3');
	});

	it('should use hover color while scanning', () => {
		expect(resolveAsteroidMaterialColor(35, true, false, null)).toBe('#8de8ff');
	});

	it('should use in-progress color when partially scanned', () => {
		expect(resolveAsteroidMaterialColor(22, false, false, null)).toBe('#63a7bc');
	});

	it('should use idle color before scan starts', () => {
		expect(resolveAsteroidMaterialColor(0, false, false, null)).toBe('#5f6d7b');
	});
});

describe('resolveAsteroidBeamOpacity', () => {
	it('should use strongest beam when hovered', () => {
		expect(resolveAsteroidBeamOpacity(0, true, false)).toBeCloseTo(0.58);
	});

	it('should keep a medium beam when scanned', () => {
		expect(resolveAsteroidBeamOpacity(100, false, true)).toBeCloseTo(0.36);
	});

	it('should show a low beam while in progress but not hovered', () => {
		expect(resolveAsteroidBeamOpacity(45, false, false)).toBeCloseTo(0.24);
	});

	it('should hide beam when idle', () => {
		expect(resolveAsteroidBeamOpacity(0, false, false)).toBe(0);
	});
});

describe('resolveAsteroidSweepOpacity', () => {
	it('should show sweep line when hovered', () => {
		expect(resolveAsteroidSweepOpacity(true)).toBeCloseTo(0.92);
	});

	it('should hide sweep line when not hovered', () => {
		expect(resolveAsteroidSweepOpacity(false)).toBe(0);
	});
});

describe('generateRandomAsteroidRevealProfile', () => {
	it('should generate valid reveal profile values', () => {
		const fixed = [0.2, 0.9, 0.1, 0.7, 0.4];
		let cursor = 0;
		const profile = generateRandomAsteroidRevealProfile(() => {
			const value = fixed[cursor] ?? 0.5;
			cursor += 1;
			return value;
		});

		expect(['dodecahedron', 'icosahedron', 'octahedron']).toContain(profile.geometry);
		expect(profile.detail).toBeGreaterThanOrEqual(0);
		expect(profile.detail).toBeLessThanOrEqual(1);
		expect(profile.scale.length).toBe(3);
		expect(profile.scale[0]).toBeGreaterThan(0.8);
		expect(profile.scale[1]).toBeGreaterThan(0.7);
		expect(profile.scale[2]).toBeGreaterThan(0.8);
	});

	it('should force octahedron detail to zero', () => {
		const profile = generateRandomAsteroidRevealProfile(() => 0.9);
		if (profile.geometry === 'octahedron') {
			expect(profile.detail).toBe(0);
		}
	});
});