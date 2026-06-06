import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import {
  CHARACTER_BUST_INITIAL_CAMERA_PRESET,
  CharacterBustViewerComponent,
  resolveBustCameraPose,
  resolveBustRenderProfile,
} from './character-bust-viewer';

function descriptor(overrides: Partial<Parameters<typeof resolveBustRenderProfile>[0]> = {}) {
  return {
    presetVersion: 'sw-15-m2-a-v1',
    faceShape: 'oval',
    skinTone: 'medium',
    hairStyle: 'short-crop',
    hairColor: 'brown',
    eyeStyle: 'almond',
    eyeColor: 'green',
    expressionPreset: 'focused',
    apparelAccent: 'collar',
    ...overrides,
  } as Parameters<typeof resolveBustRenderProfile>[0];
}

describe('CharacterBustViewerComponent', () => {
  let fixture: ComponentFixture<CharacterBustViewerComponent>;
  let component: CharacterBustViewerComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CharacterBustViewerComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    })
      .overrideComponent(CharacterBustViewerComponent, {
        set: {
          template: '',
          imports: [],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(CharacterBustViewerComponent);
    component = fixture.componentInstance;
  });

  it('creates the component', () => {
    expect(component).toBeTruthy();
  });

  it('resolves a distinct render profile per selector state', () => {
    const focused = resolveBustRenderProfile(descriptor());
    const warm = resolveBustRenderProfile(descriptor({ expressionPreset: 'warm', apparelAccent: 'visor' }));

    expect(focused).toEqual(jasmine.objectContaining({ faceShape: 'oval', hairStyle: 'short-crop' }));
    expect(warm).toEqual(jasmine.objectContaining({ expressionPreset: 'warm', apparelAccent: 'visor' }));
    expect(warm.mouthArc).toBe(focused.mouthArc);
    expect(warm.accentColor).not.toBe(focused.accentColor);
  });

  it('resolves deterministic camera poses', () => {
    expect(resolveBustCameraPose('three-quarter')).toEqual(
      jasmine.objectContaining({ position: [2.15, 1.16, 4.35], target: [0, 0.98, 0] }),
    );
    expect(resolveBustCameraPose('front')).toEqual(
      jasmine.objectContaining({ position: [0, 1.1, 5.15], target: [0, 0.95, 0] }),
    );
  });

  it('applies preset changes and captures camera state from orbit controls', () => {
    const camera = new THREE.PerspectiveCamera();
    const controls = {
      object: camera,
      target: new THREE.Vector3(0, 0.98, 0),
      update: jasmine.createSpy('update'),
      reset: jasmine.createSpy('reset'),
      saveState: jasmine.createSpy('saveState'),
      getAzimuthalAngle: jasmine.createSpy('getAzimuthalAngle').and.returnValue(0.42),
      getPolarAngle: jasmine.createSpy('getPolarAngle').and.returnValue(1.1),
    };

    (component as any).orbitControlsRef = () => ({ controls: () => controls });
    fixture.componentRef.setInput('descriptor', descriptor());
    fixture.detectChanges();

    expect(component['viewerReady']()).toBeTrue();
    expect(component['cameraState']().preset).toBe(CHARACTER_BUST_INITIAL_CAMERA_PRESET);

    component.selectCameraPreset('front');
    expect(component['cameraState']().preset).toBe('front');
    expect(camera.position.toArray()).toEqual([0, 1.1, 5.15]);
    expect(controls.target.toArray()).toEqual([0, 0.95, 0]);
    expect(controls.update).toHaveBeenCalled();
    expect(controls.saveState).toHaveBeenCalled();
  });

  it('resets orientation to the default preset', () => {
    const camera = new THREE.PerspectiveCamera();
    const controls = {
      object: camera,
      target: new THREE.Vector3(1, 1, 1),
      update: jasmine.createSpy('update'),
      reset: jasmine.createSpy('reset'),
      saveState: jasmine.createSpy('saveState'),
      getAzimuthalAngle: jasmine.createSpy('getAzimuthalAngle').and.returnValue(1.4),
      getPolarAngle: jasmine.createSpy('getPolarAngle').and.returnValue(1.7),
    };

    (component as any).orbitControlsRef = () => ({ controls: () => controls });

    component.selectCameraPreset('left-profile');
    component.resetOrientation();

    expect(component['cameraPreset']()).toBe(CHARACTER_BUST_INITIAL_CAMERA_PRESET);
    expect(controls.reset).toHaveBeenCalled();
    expect(controls.saveState).toHaveBeenCalled();
    expect(camera.position.toArray()).toEqual([2.15, 1.16, 4.35]);
  });

  it('moves the bust vertically with right-drag while preserving left-drag rotation tracking', () => {
    const frame = {
      setPointerCapture: jasmine.createSpy('setPointerCapture'),
      releasePointerCapture: jasmine.createSpy('releasePointerCapture'),
    } as unknown as HTMLElement;

    fixture.componentRef.setInput('descriptor', descriptor());
    fixture.detectChanges();

    const initialOffset = component['sceneYOffset']();

    component['framePointerHandlers'].pointerdown({
      button: 2,
      clientY: 200,
      currentTarget: frame,
      preventDefault: jasmine.createSpy('preventDefault'),
      pointerId: 7,
    } as unknown as PointerEvent);

    component['framePointerHandlers'].pointermove({
      clientY: 160,
      currentTarget: frame,
      pointerId: 7,
    } as unknown as PointerEvent);

    expect(component['sceneYOffset']()).toBeGreaterThan(initialOffset);
    expect(component['cameraState']().sceneYOffset).toBe(component['sceneYOffset']());
    expect(component['describeCameraState']()).toContain('Scene Y offset');

    component['framePointerHandlers'].pointerup({
      currentTarget: frame,
      pointerId: 7,
    } as unknown as PointerEvent);

    expect(frame.setPointerCapture).toHaveBeenCalled();
    expect(frame.releasePointerCapture).toHaveBeenCalled();
  });
});
