import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  computed,
  input,
  signal,
  viewChild,
} from '@angular/core';
import type { Triplet } from '@pmndrs/cannon-worker-api/dist/types';
import { NgtArgs } from 'angular-three';
import { NgtCanvas } from 'angular-three/dom';
import { NgtsOrbitControls } from 'angular-three-soba/controls';
import * as THREE from 'three';
import { locale } from '../../../../i18n/locale';
import type {
  BustApparelAccent,
  BustDescriptorInput,
  BustExpressionPreset,
  BustFaceShape,
  BustHairColor,
  BustHairStyle,
  BustSkinTone,
} from '../../../../model/bust-descriptor';

export const CHARACTER_BUST_MODEL_ROOT = 'src/assets/models/characters/busts/sw15/';
export const CHARACTER_BUST_INITIAL_CAMERA_PRESET: BustCameraPreset = 'three-quarter';

export type BustCameraPreset = 'front' | 'three-quarter' | 'left-profile' | 'right-profile';

interface BustCameraPose {
  position: Triplet;
  target: Triplet;
  distance: number;
}

interface BustCameraState extends BustCameraPose {
  preset: BustCameraPreset;
  presetLabel: string;
  azimuth: number;
  polar: number;
  sceneYOffset: number;
  firstRenderMs: number | null;
  interactionLabel: string;
  interactionRevision: number;
}

type BustPointerDragMode = 'rotate' | 'scene';

interface BustPointerDragState {
  mode: BustPointerDragMode;
  lastClientY: number;
}

interface BustRenderProfile {
  faceShape: BustFaceShape;
  skinTone: BustSkinTone;
  hairStyle: BustHairStyle;
  hairColor: BustHairColor;
  eyeStyle: string;
  eyeColor: string;
  expressionPreset: BustExpressionPreset;
  apparelAccent: BustApparelAccent;
  faceScale: Triplet;
  headScale: Triplet;
  neckScale: Triplet;
  shoulderScale: Triplet;
  hairScale: Triplet;
  hairOffset: Triplet;
  hairSheen: number;
  earScale: Triplet;
  earOffset: Triplet;
  earRotation: Triplet;
  eyeSocketScale: Triplet;
  eyeSocketOffset: Triplet;
  eyeLidScale: Triplet;
  eyeScale: Triplet;
  eyeIrisScale: Triplet;
  eyePupilScale: Triplet;
  eyeHighlightScale: Triplet;
  eyeOffset: Triplet;
  noseBridgeScale: Triplet;
  noseTipScale: Triplet;
  noseNostrilScale: Triplet;
  browScale: Triplet;
  browOffset: Triplet;
  mouthScale: Triplet;
  mouthOffset: Triplet;
  mouthArc: number;
  lipScale: Triplet;
  lipOffset: Triplet;
  lipArc: number;
  beardScale: Triplet;
  beardOffset: Triplet;
  beardOpacity: number;
  cheekScale: Triplet;
  cheekOffset: Triplet;
  noseScale: Triplet;
  noseOffset: Triplet;
  skinColor: string;
  skinShadow: string;
  hairColorHex: string;
  hairShadowHex: string;
  eyeColorHex: string;
  accentColor: string;
  shirtColor: string;
  collarColor: string;
  expressionLabel: string;
  faceLabel: string;
  accessory: 'none' | 'collar' | 'hood' | 'visor' | 'goggles' | 'headband';
}

type OrbitControlsLike = {
  object?: THREE.Camera & { position: THREE.Vector3 };
  target: THREE.Vector3;
  update: () => void;
  reset?: () => void;
  saveState?: () => void;
  getAzimuthalAngle?: () => number;
  getPolarAngle?: () => number;
  minDistance?: number;
  maxDistance?: number;
  enabled?: boolean;
};

const BUST_CAMERA_PRESETS: Array<{ preset: BustCameraPreset; labelKey: keyof typeof locale.character.setup.bust.viewer.cameraPresets }> = [
  { preset: 'front', labelKey: 'front' },
  { preset: 'three-quarter', labelKey: 'threeQuarter' },
  { preset: 'left-profile', labelKey: 'leftProfile' },
  { preset: 'right-profile', labelKey: 'rightProfile' },
];

const FACE_SHAPE_PROFILE: Record<
  BustFaceShape,
  { faceScale: Triplet; cheekScale: Triplet; noseScale: Triplet; browLift: number; jawDrop: number }
> = {
  oval: { faceScale: [1.02, 1.11, 0.94], cheekScale: [0.35, 0.29, 0.26], noseScale: [0.16, 0.24, 0.16], browLift: 0.08, jawDrop: 0.03 },
  round: { faceScale: [1.08, 1.08, 0.98], cheekScale: [0.4, 0.31, 0.3], noseScale: [0.15, 0.22, 0.15], browLift: 0.06, jawDrop: 0.02 },
  square: { faceScale: [1.1, 1.02, 0.96], cheekScale: [0.34, 0.27, 0.24], noseScale: [0.17, 0.24, 0.16], browLift: 0.03, jawDrop: -0.01 },
  angular: { faceScale: [1.05, 1.06, 0.92], cheekScale: [0.3, 0.24, 0.22], noseScale: [0.18, 0.25, 0.15], browLift: 0.1, jawDrop: 0.01 },
  narrow: { faceScale: [0.9, 1.14, 0.86], cheekScale: [0.26, 0.23, 0.19], noseScale: [0.15, 0.27, 0.14], browLift: 0.12, jawDrop: 0.05 },
};

const SKIN_TONE_COLOR: Record<BustSkinTone, { skin: string; shadow: string }> = {
  pale: { skin: '#f3d7ca', shadow: '#d2ac98' },
  light: { skin: '#e8c2a6', shadow: '#c28f71' },
  medium: { skin: '#c98f67', shadow: '#9f6844' },
  tan: { skin: '#b66f47', shadow: '#8e4f31' },
  dark: { skin: '#82543a', shadow: '#5b372a' },
  deep: { skin: '#5f392f', shadow: '#40251f' },
};

const HAIR_COLOR_HEX: Record<BustHairColor, string> = {
  black: '#161615',
  brown: '#4b3226',
  auburn: '#763f27',
  blonde: '#cda860',
  silver: '#b8c1cd',
  white: '#ecebeb',
  red: '#a53e27',
};

const EYE_COLOR_HEX: Record<Exclude<BustDescriptorInput['eyeColor'], never>, string> = {
  brown: '#4f3325',
  hazel: '#7f5a2f',
  green: '#5c8d48',
  blue: '#4e77b7',
  grey: '#8e98a6',
  amber: '#c98a32',
  violet: '#8a63ba',
};

const ACCESSORY_COLOR: Record<BustApparelAccent, string> = {
  none: '#9fb4c9',
  collar: '#4f7aa0',
  hood: '#355268',
  visor: '#65a0c7',
  goggles: '#d3ae5a',
  headband: '#cf8245',
};

const HAIR_STYLE_PROFILE: Record<BustHairStyle, { hairScale: Triplet; hairOffset: Triplet; hairSheen: number; accessory: BustRenderProfile['accessory'] }> = {
  'short-crop': { hairScale: [1.04, 0.76, 1.02], hairOffset: [0, 0.32, -0.02], hairSheen: 0.28, accessory: 'none' },
  'mid-fade': { hairScale: [1.06, 0.82, 1.05], hairOffset: [0, 0.38, -0.02], hairSheen: 0.34, accessory: 'none' },
  'long-loose': { hairScale: [1.16, 0.96, 1.08], hairOffset: [0, 0.28, -0.1], hairSheen: 0.25, accessory: 'none' },
  braided: { hairScale: [1.08, 0.84, 1.0], hairOffset: [0, 0.3, -0.04], hairSheen: 0.2, accessory: 'none' },
  shaved: { hairScale: [0.96, 0.66, 0.98], hairOffset: [0, 0.35, 0], hairSheen: 0.4, accessory: 'none' },
  slicked: { hairScale: [1.04, 0.78, 1.02], hairOffset: [0, 0.35, -0.03], hairSheen: 0.52, accessory: 'none' },
};

const EXPRESSION_PROFILE: Record<BustExpressionPreset, { browTilt: number; mouthCurve: number; lipScaleY: number; eyeScaleY: number; browLift: number }> = {
  neutral: { browTilt: 0, mouthCurve: 0.02, lipScaleY: 1, eyeScaleY: 1, browLift: 0.02 },
  focused: { browTilt: -0.18, mouthCurve: 0.0, lipScaleY: 0.88, eyeScaleY: 0.94, browLift: 0.0 },
  smirk: { browTilt: 0.12, mouthCurve: 0.14, lipScaleY: 0.94, eyeScaleY: 1, browLift: 0.03 },
  stern: { browTilt: -0.28, mouthCurve: -0.08, lipScaleY: 0.82, eyeScaleY: 0.9, browLift: -0.01 },
  warm: { browTilt: 0.08, mouthCurve: 0.22, lipScaleY: 1.04, eyeScaleY: 1.02, browLift: 0.04 },
  weary: { browTilt: 0.0, mouthCurve: -0.12, lipScaleY: 0.86, eyeScaleY: 0.84, browLift: -0.05 },
};

const ACCESSORY_PROFILE: Record<BustApparelAccent, { scale: Triplet; offset: Triplet; rotation: Triplet; accent: string }> = {
  none: { scale: [0, 0, 0], offset: [0, 0, 0], rotation: [0, 0, 0], accent: '#000000' },
  collar: { scale: [1.22, 0.2, 1.02], offset: [0, -0.9, 0.02], rotation: [0, 0, 0], accent: ACCESSORY_COLOR.collar },
  hood: { scale: [1.26, 1.0, 1.15], offset: [0, -0.12, -0.12], rotation: [0, 0, 0], accent: ACCESSORY_COLOR.hood },
  visor: { scale: [1.12, 0.18, 1.0], offset: [0, 0.42, 0.42], rotation: [0, 0, 0], accent: ACCESSORY_COLOR.visor },
  goggles: { scale: [1.14, 0.18, 1.02], offset: [0, 0.39, 0.36], rotation: [0, 0, 0], accent: ACCESSORY_COLOR.goggles },
  headband: { scale: [1.12, 0.11, 1.0], offset: [0, 0.57, 0.36], rotation: [0, 0, 0], accent: ACCESSORY_COLOR.headband },
};

export function resolveBustCameraPose(preset: BustCameraPreset): BustCameraPose {
  switch (preset) {
    case 'front':
      return { position: [0, 1.24, 5.15], target: [0, 1.08, 0], distance: 5.15 };
    case 'left-profile':
      return { position: [-4.2, 1.16, 0.18], target: [0, 1.12, 0], distance: 4.2 };
    case 'right-profile':
      return { position: [4.2, 1.16, 0.18], target: [0, 1.12, 0], distance: 4.2 };
    case 'three-quarter':
    default:
      return { position: [2.15, 1.3, 4.35], target: [0, 1.12, 0], distance: 4.86 };
  }
}

export function resolveBustRenderProfile(descriptor: BustDescriptorInput): BustRenderProfile {
  const skinTone = SKIN_TONE_COLOR[descriptor.skinTone];
  const faceProfile = FACE_SHAPE_PROFILE[descriptor.faceShape];
  const hairProfile = HAIR_STYLE_PROFILE[descriptor.hairStyle];
  const expressionProfile = EXPRESSION_PROFILE[descriptor.expressionPreset];
  const accessoryProfile = ACCESSORY_PROFILE[descriptor.apparelAccent];

  const mouthCurve = expressionProfile.mouthCurve;
  const lipScaleY = expressionProfile.lipScaleY;

  const eyeStyleScale: Record<BustDescriptorInput['eyeStyle'], Triplet> = {
    narrow: [0.92, 0.72, 0.82],
    wide: [1.08, 1.12, 1.04],
    almond: [1.0, 0.84, 0.96],
    hooded: [0.98, 0.7, 0.9],
    round: [1.02, 1.0, 1.0],
  };

  return {
    faceShape: descriptor.faceShape,
    skinTone: descriptor.skinTone,
    hairStyle: descriptor.hairStyle,
    hairColor: descriptor.hairColor,
    eyeStyle: descriptor.eyeStyle,
    eyeColor: descriptor.eyeColor,
    expressionPreset: descriptor.expressionPreset,
    apparelAccent: descriptor.apparelAccent,
    faceScale: faceProfile.faceScale,
    headScale: [faceProfile.faceScale[0], faceProfile.faceScale[1], faceProfile.faceScale[2]],
    neckScale: [0.42 + faceProfile.faceScale[0] * 0.04, 0.34, 0.42],
    shoulderScale: [1.28 + faceProfile.faceScale[0] * 0.07, 0.56, 0.92],
    hairScale: hairProfile.hairScale,
    hairOffset: hairProfile.hairOffset,
    hairSheen: hairProfile.hairSheen,
    earScale: [0.22, 0.5, 0.28],
    earOffset: [0.77, 0.05, -0.04],
    earRotation: [0.02, 0.06, 0.02],
    eyeSocketScale: [0.44, 0.34, 0.2],
    eyeSocketOffset: [0.28 + faceProfile.faceScale[0] * 0.01, 0.17 + expressionProfile.browLift * 0.42, 0.56],
    eyeLidScale: [0.48, 0.16, 0.24],
    eyeScale: [eyeStyleScale[descriptor.eyeStyle][0] * 1.04, eyeStyleScale[descriptor.eyeStyle][1] * 0.98, eyeStyleScale[descriptor.eyeStyle][2] * 1.04],
    eyeIrisScale: [0.44, 0.44, 0.44],
    eyePupilScale: [0.2, 0.2, 0.2],
    eyeHighlightScale: [0.06, 0.06, 0.06],
    eyeOffset: [0.28 + faceProfile.faceScale[0] * 0.01, 0.14 + expressionProfile.browLift * 0.4, 0.66],
    noseBridgeScale: [0.16, 0.34, 0.14],
    noseTipScale: [0.18, 0.2, 0.22],
    noseNostrilScale: [0.08, 0.08, 0.08],
    browScale: [0.98, 0.12, 0.12],
    browOffset: [0.3, 0.57 + faceProfile.browLift + expressionProfile.browLift, 0.62],
    mouthScale: [0.62 + mouthCurve * 0.18, 0.08, 0.08],
    mouthOffset: [0, -0.23 + faceProfile.jawDrop, 0.84],
    mouthArc: Math.PI * 0.55,
    lipScale: [0.52, 0.08 * lipScaleY, 0.08],
    lipOffset: [0, -0.22 + faceProfile.jawDrop, 0.88],
    lipArc: Math.PI * 0.46,
    beardScale: [1.02, 0.82, 1.0],
    beardOffset: [0, -0.12 + faceProfile.jawDrop * 0.5, 0.56],
    beardOpacity: 0.28,
    cheekScale: faceProfile.cheekScale,
    cheekOffset: [0.32, 0.0 + faceProfile.jawDrop * 0.2, 0.62],
    noseScale: faceProfile.noseScale,
    noseOffset: [0, 0.02, 0.8],
    skinColor: skinTone.skin,
    skinShadow: skinTone.shadow,
    hairColorHex: HAIR_COLOR_HEX[descriptor.hairColor],
    hairShadowHex: '#0d0d0d',
    eyeColorHex: EYE_COLOR_HEX[descriptor.eyeColor],
    accentColor: accessoryProfile.accent,
    shirtColor: '#1f3951',
    collarColor: '#d5e1ef',
    expressionLabel: descriptor.expressionPreset,
    faceLabel: descriptor.faceShape,
    accessory: descriptor.apparelAccent,
  };
}

@Component({
  selector: 'app-character-bust-viewer',
  templateUrl: './character-bust-viewer.html',
  styleUrls: ['./character-bust-viewer.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgtCanvas, NgtArgs, NgtsOrbitControls],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class CharacterBustViewerComponent {
  protected readonly t = locale;
  protected readonly modelRoot = CHARACTER_BUST_MODEL_ROOT;
  protected readonly cameraPresets = BUST_CAMERA_PRESETS;

  descriptor = input.required<BustDescriptorInput>();

  protected readonly profile = computed(() => resolveBustRenderProfile(this.descriptor()));
  protected readonly cameraPreset = signal<BustCameraPreset>(CHARACTER_BUST_INITIAL_CAMERA_PRESET);
  protected readonly viewerReady = signal(false);
  protected readonly firstRenderMs = signal<number | null>(null);
  protected readonly sceneYOffset = signal(1.0);
  protected readonly interactionLabel = signal<'idle' | 'rotate' | 'scene' | 'pinch' | 'zoom' | 'reset' | 'preset'>('idle');
  protected readonly interactionRevision = signal(0);
  protected readonly cameraState = signal<BustCameraState>({
    preset: CHARACTER_BUST_INITIAL_CAMERA_PRESET,
    presetLabel: this.t.character.setup.bust.viewer.cameraPresets.threeQuarter,
    position: resolveBustCameraPose(CHARACTER_BUST_INITIAL_CAMERA_PRESET).position,
    target: resolveBustCameraPose(CHARACTER_BUST_INITIAL_CAMERA_PRESET).target,
    distance: resolveBustCameraPose(CHARACTER_BUST_INITIAL_CAMERA_PRESET).distance,
    azimuth: 0,
    polar: 0,
    sceneYOffset: this.sceneYOffset(),
    firstRenderMs: null,
    interactionLabel: 'idle',
    interactionRevision: 0,
  });

  private readonly mountedAt = performance.now();
  private readonly orbitControlsRef = viewChild(NgtsOrbitControls);
  private readonly pointerDragStates = new Map<number, BustPointerDragState>();

  protected readonly cameraOptions = computed(() => ({
    fov: 34,
    near: 0.1,
    far: 40,
    position: resolveBustCameraPose(this.cameraPreset()).position,
  }));

  protected readonly orbitOptions = computed(() => ({
    enableDamping: false,
    enablePan: false,
    enableRotate: true,
    enableZoom: true,
    minDistance: 3.2,
    maxDistance: 7.1,
    minPolarAngle: 0.58,
    maxPolarAngle: 2.22,
    rotateSpeed: 0.82,
    zoomSpeed: 0.82,
    target: resolveBustCameraPose(this.cameraPreset()).target,
  }));

  protected readonly framePointerHandlers = {
    pointerdown: (event: PointerEvent) => this.beginPointerInteraction(event),
    pointermove: (event: PointerEvent) => this.updatePointerInteraction(event),
    pointerup: (event: PointerEvent) => this.endPointerInteraction(event),
    pointercancel: (event: PointerEvent) => this.endPointerInteraction(event),
    contextmenu: (event: MouseEvent) => this.preventFrameContextMenu(event),
    wheel: () => this.recordInteraction('zoom'),
  };

  constructor() {
    this.viewerReady.set(true);
    this.syncCameraState(undefined, this.cameraPreset());
  }

  protected selectCameraPreset(preset: BustCameraPreset): void {
    this.cameraPreset.set(preset);
    this.recordInteraction('preset');
    const pose = resolveBustCameraPose(preset);
    const controls = this.orbitControlsRef()?.controls() as OrbitControlsLike | undefined;
    if (controls?.object?.position) {
      controls.object.position.set(pose.position[0], pose.position[1], pose.position[2]);
      controls.object.lookAt(pose.target[0], pose.target[1], pose.target[2]);
    }
    if (controls?.target) {
      controls.target.set(pose.target[0], pose.target[1], pose.target[2]);
      controls.update();
      controls.saveState?.();
    }
    this.syncCameraState(controls, preset);
  }

  protected resetOrientation(): void {
    this.recordInteraction('reset');
    this.selectCameraPreset(CHARACTER_BUST_INITIAL_CAMERA_PRESET);
    const controls = this.orbitControlsRef()?.controls() as OrbitControlsLike | undefined;
    controls?.reset?.();
    controls?.update();
    controls?.saveState?.();
    this.syncCameraState(controls, CHARACTER_BUST_INITIAL_CAMERA_PRESET);
  }

  protected cameraPresetLabel(preset: BustCameraPreset): string {
    switch (preset) {
      case 'front':
        return this.t.character.setup.bust.viewer.cameraPresets.front;
      case 'left-profile':
        return this.t.character.setup.bust.viewer.cameraPresets.leftProfile;
      case 'right-profile':
        return this.t.character.setup.bust.viewer.cameraPresets.rightProfile;
      case 'three-quarter':
      default:
        return this.t.character.setup.bust.viewer.cameraPresets.threeQuarter;
    }
  }

  protected describeCameraState(): string {
    const state = this.cameraState();
    return [
      `${this.t.character.setup.bust.viewer.statePrefix} ${state.presetLabel}`,
      `${this.t.character.setup.bust.viewer.distanceLabel} ${state.distance.toFixed(2)}`,
      `${this.t.character.setup.bust.viewer.azimuthLabel} ${state.azimuth.toFixed(2)}`,
      `${this.t.character.setup.bust.viewer.polarLabel} ${state.polar.toFixed(2)}`,
      `${this.t.character.setup.bust.viewer.sceneYOffsetLabel} ${state.sceneYOffset.toFixed(2)}`,
      `${this.t.character.setup.bust.viewer.renderLabel} ${state.firstRenderMs === null ? '...' : `${Math.round(state.firstRenderMs)}ms`}`,
      `${this.t.character.setup.bust.viewer.interactionLabel} ${state.interactionLabel} #${state.interactionRevision}`,
    ].join(' · ');
  }

  protected presetButtonClass(preset: BustCameraPreset): string {
    return preset === this.cameraPreset() ? 'bust-viewer__preset-button bust-viewer__preset-button--active' : 'bust-viewer__preset-button';
  }

  protected hintText(): string {
    return this.t.character.setup.bust.viewer.hint;
  }

  protected assetRootText(): string {
    return `${this.t.character.setup.bust.viewer.assetPathLabel} ${this.modelRoot}`;
  }

  private syncCameraState(controls: OrbitControlsLike | undefined, preset: BustCameraPreset): void {
    const pose = resolveBustCameraPose(preset);
    const azimuth = controls?.getAzimuthalAngle?.() ?? 0;
    const polar = controls?.getPolarAngle?.() ?? 0;
    const firstRenderMs = this.firstRenderMs() ?? Math.max(0, performance.now() - this.mountedAt);
    this.firstRenderMs.set(firstRenderMs);
    this.cameraState.set({
      preset,
      presetLabel: this.cameraPresetLabel(preset),
      position: pose.position,
      target: pose.target,
      distance: controls?.object?.position?.distanceTo ? controls.object.position.distanceTo(controls.target) : pose.distance,
      azimuth,
      polar,
      sceneYOffset: this.sceneYOffset(),
      firstRenderMs,
      interactionLabel: this.interactionLabel(),
      interactionRevision: this.interactionRevision(),
    });
  }

  private recordInteraction(kind: 'rotate' | 'scene' | 'pinch' | 'zoom' | 'reset' | 'preset'): void {
    this.interactionLabel.set(kind);
    this.interactionRevision.update((value) => value + 1);
    this.syncCameraState(this.orbitControlsRef()?.controls() as OrbitControlsLike | undefined, this.cameraPreset());
  }

  private beginPointerInteraction(event: PointerEvent): void {
    if (this.shouldIgnoreFramePointerEvent(event)) {
      return;
    }

    event.preventDefault();
    const mode: BustPointerDragMode = event.button === 2 ? 'scene' : 'rotate';
    this.pointerDragStates.set(event.pointerId, { mode, lastClientY: event.clientY });
    this.setPointerCapture(event);
    this.recordInteraction(this.pointerDragStates.size > 1 ? 'pinch' : mode);
  }

  private updatePointerInteraction(event: PointerEvent): void {
    const drag = this.pointerDragStates.get(event.pointerId);
    if (!drag) {
      return;
    }

    if (drag.mode === 'scene') {
      const deltaY = drag.lastClientY - event.clientY;
      if (deltaY !== 0) {
        this.sceneYOffset.update((value) => this.clampSceneYOffset(value + deltaY * 0.006));
        this.recordInteraction('scene');
      }
      drag.lastClientY = event.clientY;
      this.pointerDragStates.set(event.pointerId, drag);
      return;
    }

    this.recordInteraction(this.pointerDragStates.size > 1 ? 'pinch' : 'rotate');
  }

  private endPointerInteraction(event: PointerEvent): void {
    if (!this.pointerDragStates.delete(event.pointerId)) {
      return;
    }

    this.releasePointerCapture(event);
    this.syncCameraState(this.orbitControlsRef()?.controls() as OrbitControlsLike | undefined, this.cameraPreset());
  }

  private preventFrameContextMenu(event: MouseEvent): void {
    event.preventDefault();
  }

  private setPointerCapture(event: PointerEvent): void {
    const target = event.currentTarget;
    if (target instanceof Element && 'setPointerCapture' in target) {
      try {
        target.setPointerCapture(event.pointerId);
      } catch {
        // Ignore capture errors when the browser refuses the pointer handoff.
      }
    }
  }

  private releasePointerCapture(event: PointerEvent): void {
    const target = event.currentTarget;
    if (target instanceof Element && 'releasePointerCapture' in target) {
      try {
        target.releasePointerCapture(event.pointerId);
      } catch {
        // Ignore capture errors when the browser already released the pointer.
      }
    }
  }

  private clampSceneYOffset(value: number): number {
    return Math.min(1.5, Math.max(-0.5, value));
  }

  private shouldIgnoreFramePointerEvent(event: PointerEvent): boolean {
    const target = event.target;
    if (!(target instanceof Element)) {
      return false;
    }

    // Overlay controls inside the frame should keep native button click behavior.
    return target.closest('.bust-viewer__controls') !== null;
  }
}
