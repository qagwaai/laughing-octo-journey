import { CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import {
  Asteroid,
  ASTEROID_BEFORE_RENDER_FN,
  ASTEROID_INJECT_STORE_FN,
  generateRandomAsteroidRevealProfile,
  resolveAsteroidBeamOpacity,
  resolveAsteroidEmissiveIntensity,
  resolveAsteroidGeometryDetail,
  resolveAsteroidMaterialColor,
  resolveAsteroidPbrMetalness,
  resolveAsteroidPbrRoughness,
  resolveAsteroidRockRevealSelection,
  resolveAsteroidRockGeometry,
  resolveAsteroidSweepOpacity,
  resolveAsteroidVisualState,
  type AsteroidHoverEvent,
} from './asteroid';

describe('Asteroid', () => {
  let component: Asteroid;
  let fixture: ComponentFixture<Asteroid>;
  let beforeRenderSpy: jasmine.Spy;
  let beforeRenderCallbacks: Array<(state: any) => void>;
  let injectStoreSpy: jasmine.Spy;

  beforeEach(async () => {
    beforeRenderCallbacks = [];
    beforeRenderSpy = jasmine.createSpy('beforeRender').and.callFake((callback: any) => {
      beforeRenderCallbacks.push(callback);
      return () => {};
    });
    injectStoreSpy = jasmine.createSpy('injectStore').and.returnValue({
      snapshot: {
        camera: {
          position: new THREE.Vector3(0, 0, 6),
        },
      },
    });

    await TestBed.configureTestingModule({
      imports: [Asteroid],
      providers: [
        { provide: ASTEROID_BEFORE_RENDER_FN, useValue: beforeRenderSpy },
        { provide: ASTEROID_INJECT_STORE_FN, useValue: injectStoreSpy },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA],
    })
      .overrideComponent(Asteroid, {
        set: {
          template: '',
          imports: [],
        },
      })
      .compileComponents();

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

  it('should remove scan rings after completion when morph pulse has finished and asteroid is not hovered', () => {
    fixture.componentRef.setInput('scanned', true);
    fixture.detectChanges();

    (component as any).emitHover(false);
    (component as any).morphPulseElapsedSeconds.set(0.28);

    expect((component as any).morphPulse()).toBe(0);
    expect((component as any).showScanFx()).toBeFalse();
    expect((component as any).ringOpacityA()).toBe(0);
    expect((component as any).ringOpacityB()).toBe(0);
    expect((component as any).ringOpacityC()).toBe(0);
  });

  it('should show material dialog only when scanned and hovered with material', () => {
    fixture.componentRef.setInput('revealedMaterial', {
      rarity: 'Rare',
      material: 'Silver',
      textureColor: '#cad5e3',
      roughness: 0.3,
      metalness: 0.9,
    });
    fixture.componentRef.setInput('scanned', true);
    fixture.detectChanges();

    expect((component as any).showResultDialog()).toBeFalse();

    (component as any).emitHover(true);
    expect((component as any).showResultDialog()).toBeTrue();
    expect((component as any).resultDialogMaterialText()).toContain('Silver');
    expect((component as any).resultDialogRarityText()).toContain('Rare');

    (component as any).emitHover(false);
    expect((component as any).showResultDialog()).toBeFalse();
  });

  it('should format velocity, spin, mass and diameter fallback text when kinematics are unavailable', () => {
    expect((component as any).resultDialogVelocityText()).toBe('VEL: ---');
    expect((component as any).resultDialogSpinText()).toBe('SPIN: ---');
    expect((component as any).resultDialogMassText()).toBe('MASS: ---');
    expect((component as any).resultDialogDiameterText()).toBe('DIAM: ---');
  });

  it('should format velocity and spin text when kinematics are available', () => {
    fixture.componentRef.setInput('revealedKinematics', {
      velocityKmPerSec: { x: 3, y: 4, z: 0 },
      angularVelocityRadPerSec: { x: 0.3, y: 0.4, z: 0 },
      estimatedMassKg: 1234,
      estimatedDiameterM: 12,
    });
    fixture.detectChanges();

    expect((component as any).resultDialogVelocityText()).toBe('VEL: 5.0 km/s');
    expect((component as any).resultDialogSpinText()).toBe('SPIN: 0.5000 rad/s');
  });

  it('should format mass text across threshold branches', () => {
    fixture.componentRef.setInput('revealedKinematics', {
      velocityKmPerSec: { x: 0, y: 0, z: 0 },
      angularVelocityRadPerSec: { x: 0, y: 0, z: 0 },
      estimatedMassKg: 2.5e12,
      estimatedDiameterM: 12,
    });
    fixture.detectChanges();
    expect((component as any).resultDialogMassText()).toBe('MASS: 2.50e12 kg');

    fixture.componentRef.setInput('revealedKinematics', {
      velocityKmPerSec: { x: 0, y: 0, z: 0 },
      angularVelocityRadPerSec: { x: 0, y: 0, z: 0 },
      estimatedMassKg: 3.75e9,
      estimatedDiameterM: 12,
    });
    fixture.detectChanges();
    expect((component as any).resultDialogMassText()).toBe('MASS: 3.75e9 kg');

    fixture.componentRef.setInput('revealedKinematics', {
      velocityKmPerSec: { x: 0, y: 0, z: 0 },
      angularVelocityRadPerSec: { x: 0, y: 0, z: 0 },
      estimatedMassKg: 999,
      estimatedDiameterM: 12,
    });
    fixture.detectChanges();
    expect((component as any).resultDialogMassText()).toBe('MASS: 999 kg');
  });

  it('should format diameter text for meter and kilometer branches', () => {
    fixture.componentRef.setInput('revealedKinematics', {
      velocityKmPerSec: { x: 0, y: 0, z: 0 },
      angularVelocityRadPerSec: { x: 0, y: 0, z: 0 },
      estimatedMassKg: 10,
      estimatedDiameterM: 1200,
    });
    fixture.detectChanges();
    expect((component as any).resultDialogDiameterText()).toBe('DIAM: 1.20 km');

    fixture.componentRef.setInput('revealedKinematics', {
      velocityKmPerSec: { x: 0, y: 0, z: 0 },
      angularVelocityRadPerSec: { x: 0, y: 0, z: 0 },
      estimatedMassKg: 10,
      estimatedDiameterM: 150,
    });
    fixture.detectChanges();
    expect((component as any).resultDialogDiameterText()).toBe('DIAM: 150 m');
  });

  it('should format location and cluster text branches', () => {
    expect((component as any).resultDialogLocationText()).toBe('LOC: ---');
    expect((component as any).resultDialogClusterText()).toBe('CLUSTER(Mkm): ---');

    fixture.componentRef.setInput('revealedLocation', {
      positionKm: { x: 1234000, y: -5678000, z: 900000 },
    });
    fixture.componentRef.setInput('revealedClusterCenterKm', {
      x: 1000000,
      y: -5000000,
      z: 750000,
    });
    fixture.detectChanges();

    expect((component as any).resultDialogLocationText()).toContain('LOC(Mkm): X 1.234 | Y -5.678 | Z 0.900');
    expect((component as any).resultDialogClusterText()).toContain('CLUSTER(Mkm): X 1.000 | Y -5.000 | Z 0.750');
  });

  it('should format offset text only when both location and cluster are available', () => {
    expect((component as any).resultDialogOffsetText()).toBe('OFFSET(km): ---');

    fixture.componentRef.setInput('revealedLocation', {
      positionKm: { x: 1200, y: 3500, z: -700 },
    });
    fixture.componentRef.setInput('revealedClusterCenterKm', {
      x: 1000,
      y: 3000,
      z: -500,
    });
    fixture.detectChanges();

    expect((component as any).resultDialogOffsetText()).toContain('OFFSET(km): dX 200 dY 500 dZ -200');
  });

  it('should emit right-button pointer down events for button or bitmask input', () => {
    const downSpy = jasmine.createSpy('pointerButtonDown');
    component.pointerButtonDown.subscribe(downSpy);

    (component as any).onPointerDown({ button: 2 });
    (component as any).onPointerDown({ buttons: 2 });

    expect(downSpy).toHaveBeenCalledTimes(2);
    expect(downSpy.calls.mostRecent().args[0]).toEqual({ id: 'sample-1', button: 2 });
  });

  it('should ignore non-right-button pointer down events', () => {
    const downSpy = jasmine.createSpy('pointerButtonDown');
    component.pointerButtonDown.subscribe(downSpy);

    (component as any).onPointerDown({ button: 0 });
    (component as any).onPointerDown({ buttons: 1 });

    expect(downSpy).not.toHaveBeenCalled();
  });

  it('should emit pointer up only for right button', () => {
    const upSpy = jasmine.createSpy('pointerButtonUp');
    component.pointerButtonUp.subscribe(upSpy);

    (component as any).onPointerUp({ button: 0 });
    (component as any).onPointerUp({ button: 2 });

    expect(upSpy).toHaveBeenCalledTimes(1);
    expect(upSpy).toHaveBeenCalledWith({ id: 'sample-1', button: 2 });
  });

  it('should apply revealed kinematics spin in beforeRender when scanned', () => {
    const mockMesh = new THREE.Mesh();
    (component as any).meshRef = jasmine.createSpy().and.returnValue({ nativeElement: mockMesh });

    fixture.componentRef.setInput('scanned', true);
    fixture.componentRef.setInput('revealedKinematics', {
      velocityKmPerSec: { x: 0, y: 0, z: 0 },
      angularVelocityRadPerSec: { x: 0.05, y: 0.1, z: 0.15 },
      estimatedMassKg: 50,
      estimatedDiameterM: 5,
    });
    fixture.detectChanges();

    (component as any).beforeRenderCallback({ delta: 1 });

    expect(mockMesh.rotation.x).toBeCloseTo(1, 5);
    expect(mockMesh.rotation.y).toBeCloseTo(2, 5);
    expect(mockMesh.rotation.z).toBeCloseTo(3, 5);
  });

  it('should switch to revealed rock detail policy after scan', () => {
    (component as any).revealProfile.set({
      meshProfileKey: 'v1|pv=dodecahedron:1|rv=rock:2|s=1.00,1.00,1.00',
      geometry: 'dodecahedron',
      detail: 1,
      revealGeometry: 'rock',
      revealDetail: 2,
      scale: [1, 1, 1],
    });

    fixture.componentRef.setInput('scanned', false);
    fixture.detectChanges();
    expect((component as any).activeDetail()).toBe(1);

    fixture.componentRef.setInput('scanned', true);
    fixture.detectChanges();
    expect((component as any).activeDetail()).toBe(0);
  });

  it('should swap to the revealed rock mesh after scan', () => {
    (component as any).revealProfile.set({
      meshProfileKey: 'v1|pv=octahedron:0|rv=rock:2|s=1.00,1.00,1.00',
      geometry: 'octahedron',
      detail: 0,
      revealGeometry: 'rock',
      revealDetail: 2,
      scale: [1, 1, 1],
    });
    fixture.componentRef.setInput('scanned', true);
    fixture.detectChanges();

    expect((component as any).activeGeometry()).toBe('rock');
    expect(['dodecahedron', 'icosahedron', 'octahedron']).toContain((component as any).activeRockGeometry());
  });

  it('should resolve PBR values from revealed material only after scan', () => {
    fixture.componentRef.setInput('revealedMaterial', {
      rarity: 'Exotic',
      material: 'Unobtainium',
      textureColor: '#7deaff',
      roughness: 0.28,
      metalness: 0.64,
      emissiveBoost: 0.45,
    });
    fixture.componentRef.setInput('scanned', false);
    fixture.detectChanges();

    expect((component as any).pbrRoughness()).toBeCloseTo(0.92);
    expect((component as any).pbrMetalness()).toBeCloseTo(0.03);
    expect((component as any).resolvedEmissiveIntensity()).toBeCloseTo(0.25);

    fixture.componentRef.setInput('scanned', true);
    fixture.detectChanges();

    expect((component as any).pbrRoughness()).toBeCloseTo(0.28);
    expect((component as any).pbrMetalness()).toBeCloseTo(0.64);
    expect((component as any).resolvedEmissiveIntensity()).toBeCloseTo(1.25);
  });
});

describe('resolveAsteroidMaterialColor', () => {
  it('should keep the hover highlight after scan', () => {
    expect(resolveAsteroidMaterialColor(0, false, true, null)).toBe('#8de8ff');
  });

  it('should use selected material color when scanned', () => {
    expect(
      resolveAsteroidMaterialColor(100, false, true, {
        rarity: 'Rare',
        material: 'Silver',
        textureColor: '#cad5e3',
      }),
    ).toBe('#8de8ff');
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

describe('resolveAsteroidVisualState', () => {
  it('should prioritize targeted over targeting/hover/scanning/scanned', () => {
    const state = resolveAsteroidVisualState({
      hovered: true,
      targetingHold: true,
      targeted: true,
      scanProgress: 62,
      scanned: true,
      tier: 'hero',
    });

    expect(state.interaction).toBe('targeted');
    expect(state.tier).toBe('hero');
  });

  it('should resolve targeting when hold is active but not targeted', () => {
    const state = resolveAsteroidVisualState({
      hovered: true,
      targetingHold: true,
      targeted: false,
      scanProgress: 62,
      scanned: true,
      tier: 'near',
    });

    expect(state.interaction).toBe('targeting');
    expect(state.tier).toBe('near');
  });

  it('should resolve scanned when no interaction is active', () => {
    const state = resolveAsteroidVisualState({
      hovered: false,
      targetingHold: false,
      targeted: false,
      scanProgress: 100,
      scanned: true,
      tier: 'background',
    });

    expect(state.interaction).toBe('scanned');
    expect(state.tier).toBe('background');
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
    expect(profile.revealGeometry).toBe('rock');
    expect(profile.meshProfileKey).toContain('v1|pv=');
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

describe('resolveAsteroidGeometryDetail', () => {
  it('should keep low detail before scan', () => {
    expect(resolveAsteroidGeometryDetail('dodecahedron', 1, false)).toBe(1);
    expect(resolveAsteroidGeometryDetail('icosahedron', 0, false)).toBe(0);
  });

  it('should clamp octahedron to zero even after scan', () => {
    expect(resolveAsteroidGeometryDetail('octahedron', 1, true)).toBe(0);
  });

  it('should promote non-octahedron to detail 2 when scanned', () => {
    expect(resolveAsteroidGeometryDetail('dodecahedron', 0, true)).toBe(2);
    expect(resolveAsteroidGeometryDetail('icosahedron', 1, true)).toBe(2);
  });
});

describe('resolveAsteroidRockRevealSelection', () => {
  it('should resolve to a deterministic rocky primitive for the same key', () => {
    const first = resolveAsteroidRockRevealSelection({
      asteroidId: 'sample-a',
      meshProfileKey: 'v1|pv=dodecahedron:1|rv=rock:2|s=1.00,1.10,0.95',
      renderTier: 'background',
    });
    const second = resolveAsteroidRockRevealSelection({
      asteroidId: 'sample-a',
      meshProfileKey: 'v1|pv=dodecahedron:1|rv=rock:2|s=1.00,1.10,0.95',
      renderTier: 'background',
    });

    expect(first).toEqual(second);
    expect(['dodecahedron', 'icosahedron', 'octahedron']).toContain(first.geometry);
  });

  it('should resolve fallback selection from asteroid id when profile key is absent', () => {
    const selection = resolveAsteroidRockRevealSelection({
      asteroidId: 'sample-no-key',
      meshProfileKey: null,
      renderTier: 'hero',
    });

    expect(['dodecahedron', 'icosahedron', 'octahedron']).toContain(selection.geometry);
  });

  it('should boost rock reveal detail for hero-tier samples', () => {
    const selection = resolveAsteroidRockRevealSelection({
      asteroidId: 'sample-hero',
      meshProfileKey: 'v1|pv=dodecahedron:1|rv=rock:2|s=1.00,1.10,0.95',
      renderTier: 'hero',
    });

    expect(selection.detail).toBeGreaterThan(0);
  });

  it('should boost rock reveal detail when hero detail is forced after scan', () => {
    const selection = resolveAsteroidRockRevealSelection({
      asteroidId: 'sample-forced-hero',
      meshProfileKey: 'v1|pv=dodecahedron:1|rv=rock:2|s=1.00,1.10,0.95',
      renderTier: 'background',
      forceHeroDetail: true,
    });

    expect(selection.detail).toBeGreaterThan(0);
  });

  it('should build a spikier hero rock geometry than background geometry', () => {
    const heroGeometry = resolveAsteroidRockGeometry({
      asteroidId: 'sample-hero',
      meshProfileKey: 'v1|pv=dodecahedron:1|rv=rock:2|s=1.00,1.10,0.95',
      renderTier: 'hero',
      detail: 3,
    });
    const backgroundGeometry = resolveAsteroidRockGeometry({
      asteroidId: 'sample-hero',
      meshProfileKey: 'v1|pv=dodecahedron:1|rv=rock:2|s=1.00,1.10,0.95',
      renderTier: 'background',
      detail: 3,
    });

    const heroPosition = heroGeometry.getAttribute('position');
    const backgroundPosition = backgroundGeometry.getAttribute('position');

    let heroRadiusSpread = 0;
    for (let index = 0; index < heroPosition.count; index += 1) {
      const radius = Math.hypot(heroPosition.getX(index), heroPosition.getY(index), heroPosition.getZ(index));
      heroRadiusSpread = Math.max(heroRadiusSpread, radius);
    }

    let backgroundRadiusSpread = 0;
    for (let index = 0; index < backgroundPosition.count; index += 1) {
      const radius = Math.hypot(
        backgroundPosition.getX(index),
        backgroundPosition.getY(index),
        backgroundPosition.getZ(index),
      );
      backgroundRadiusSpread = Math.max(backgroundRadiusSpread, radius);
    }

    expect(heroRadiusSpread).toBeGreaterThan(backgroundRadiusSpread);
  });

  it('should force hero-level deformation when requested on background tier', () => {
    const forcedHeroGeometry = resolveAsteroidRockGeometry({
      asteroidId: 'sample-forced-hero-geometry',
      meshProfileKey: 'v1|pv=dodecahedron:1|rv=rock:2|s=1.00,1.10,0.95',
      renderTier: 'background',
      detail: 3,
      forceHeroDetail: true,
    });
    const backgroundGeometry = resolveAsteroidRockGeometry({
      asteroidId: 'sample-forced-hero-geometry',
      meshProfileKey: 'v1|pv=dodecahedron:1|rv=rock:2|s=1.00,1.10,0.95',
      renderTier: 'background',
      detail: 3,
    });

    const forcedPosition = forcedHeroGeometry.getAttribute('position');
    const backgroundPosition = backgroundGeometry.getAttribute('position');

    let forcedRadiusSpread = 0;
    for (let index = 0; index < forcedPosition.count; index += 1) {
      const radius = Math.hypot(forcedPosition.getX(index), forcedPosition.getY(index), forcedPosition.getZ(index));
      forcedRadiusSpread = Math.max(forcedRadiusSpread, radius);
    }

    let backgroundRadiusSpread = 0;
    for (let index = 0; index < backgroundPosition.count; index += 1) {
      const radius = Math.hypot(
        backgroundPosition.getX(index),
        backgroundPosition.getY(index),
        backgroundPosition.getZ(index),
      );
      backgroundRadiusSpread = Math.max(backgroundRadiusSpread, radius);
    }

    expect(forcedRadiusSpread).toBeGreaterThan(backgroundRadiusSpread);
  });
});

describe('resolveAsteroidPbrRoughness', () => {
  it('should use matte fallback before scan', () => {
    expect(resolveAsteroidPbrRoughness(false, null)).toBeCloseTo(0.92);
  });

  it('should use revealed roughness after scan', () => {
    expect(
      resolveAsteroidPbrRoughness(true, {
        rarity: 'Rare',
        material: 'Silver',
        textureColor: '#cad5e3',
        roughness: 0.28,
        metalness: 0.92,
      }),
    ).toBeCloseTo(0.28);
  });
});

describe('resolveAsteroidPbrMetalness', () => {
  it('should keep metalness low before scan', () => {
    expect(resolveAsteroidPbrMetalness(false, null)).toBeCloseTo(0.03);
  });

  it('should use revealed metalness after scan', () => {
    expect(
      resolveAsteroidPbrMetalness(true, {
        rarity: 'Rare',
        material: 'Silver',
        textureColor: '#cad5e3',
        roughness: 0.28,
        metalness: 0.92,
      }),
    ).toBeCloseTo(0.92);
  });
});

describe('resolveAsteroidEmissiveIntensity', () => {
  it('should use hover-dependent intensity before scan', () => {
    expect(resolveAsteroidEmissiveIntensity(false, false, null)).toBeCloseTo(0.25);
    expect(resolveAsteroidEmissiveIntensity(false, true, null)).toBeCloseTo(0.5);
  });

  it('should include emissive boost after scan', () => {
    expect(
      resolveAsteroidEmissiveIntensity(true, false, {
        rarity: 'Exotic',
        material: 'Unobtainium',
        textureColor: '#7deaff',
        roughness: 0.28,
        metalness: 0.64,
        emissiveBoost: 0.45,
      }),
    ).toBeCloseTo(1.4);
  });
});
