import {
  Component,
  computed,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  EventEmitter,
  inject,
  InjectionToken,
  input,
  Output,
  signal,
  viewChild,
} from '@angular/core';
import { beforeRender as _beforeRender, NgtArgs } from 'angular-three';
import * as THREE from 'three';
import type { ExternalObjectDescriptor } from '../../model/external-object-descriptor';
import type { FloatingDebrisItem } from '../../model/floating-debris-item';
import { resolveDescriptorRenderProfile } from '../viewer/viewer-descriptor-selectors';

export const FLOATING_DEBRIS_BEFORE_RENDER_FN = new InjectionToken<typeof _beforeRender>(
  'FLOATING_DEBRIS_BEFORE_RENDER_FN',
  {
    providedIn: 'root',
    factory: () => _beforeRender,
  },
);

export interface FloatingDebrisPointerEvent {
  id: string;
  button: number;
}

export interface FloatingDebrisHoverEvent {
  id: string;
  hovering: boolean;
}

type DebrisGeometryKind = 'box' | 'capsule' | 'octahedron' | 'icosahedron';

@Component({
  selector: 'app-floating-debris-node',
  template: `
    <ngt-group [position]="position()" [scale]="hovered() ? 1.15 : 1">
      <ngt-mesh
        #mesh
        name="floating-debris"
        (pointerover)="emitHover(true)"
        (pointerout)="emitHover(false)"
        (pointerdown)="onPointerDown($event)"
        (pointerup)="onPointerUp($event)"
      >
        @switch (geometryKind()) {
          @case ('capsule') {
            <ngt-capsule-geometry *args="[0.25, 0.35, 6, 12]" />
          }
          @case ('octahedron') {
            <ngt-octahedron-geometry *args="[0.38, 0]" />
          }
          @case ('icosahedron') {
            <ngt-icosahedron-geometry *args="[0.35, 0]" />
          }
          @default {
            <ngt-box-geometry *args="[0.5, 0.5, 0.5]" />
          }
        }
        <ngt-mesh-standard-material
          [color]="materialColor()"
          [emissive]="materialEmissive()"
          [emissiveIntensity]="resolveEmissiveIntensity()"
          [metalness]="materialMetalness()"
          [roughness]="materialRoughness()"
        />
      </ngt-mesh>

      <ngt-mesh [visible]="targetingHold()" [rotation]="[Math.PI / 2, -pulsePhase() * 0.9, 0]" [scale]="1.24">
        <ngt-torus-geometry *args="[0.68, 0.03, 10, 64]" />
        <ngt-mesh-basic-material
          [color]="'#ff4747'"
          [transparent]="true"
          [opacity]="targetHoldRingOpacity()"
          [depthWrite]="false"
        />
      </ngt-mesh>

      <ngt-mesh [visible]="targeted()" [rotation]="[Math.PI / 2, pulsePhase() * 0.45, 0]" [scale]="1.16">
        <ngt-torus-geometry *args="[0.64, 0.02, 10, 64]" />
        <ngt-mesh-basic-material
          [color]="'#ffb347'"
          [transparent]="true"
          [opacity]="targetedRingOpacity()"
          [depthWrite]="false"
        />
      </ngt-mesh>
    </ngt-group>
  `,
  imports: [NgtArgs],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class FloatingDebrisNode {
  item = input.required<FloatingDebrisItem>();
  position = input.required<[number, number, number]>();
  descriptor = input<ExternalObjectDescriptor | null>(null);
  targetingHold = input<boolean>(false);
  targeted = input<boolean>(false);

  protected hovered = signal(false);
  protected pulsePhase = signal(0);
  protected targetHoldRingOpacity = computed(() => (this.targetingHold() ? 0.92 : 0));
  protected targetedRingOpacity = computed(() => (this.targeted() ? 0.9 : 0));
  protected descriptorProfile = computed(() => resolveDescriptorRenderProfile(this.descriptor() ?? undefined));
  protected geometryKind = computed<DebrisGeometryKind>(() => {
    const profile = this.descriptorProfile();
    if (!profile || profile.domain !== 'debris') {
      return 'box';
    }

    if (profile.objectFamily === 'cargo-canister') {
      return 'capsule';
    }

    if (profile.objectFamily === 'field-shard') {
      return 'octahedron';
    }

    if (profile.objectFamily === 'salvage-fragment') {
      return 'icosahedron';
    }

    return 'box';
  });
  protected materialColor = computed(() => this.descriptorProfile()?.color ?? '#5ad9ff');
  protected materialEmissive = computed(() => this.descriptorProfile()?.emissive ?? '#5ad9ff');
  protected materialMetalness = computed(() => this.descriptorProfile()?.metalness ?? 0.4);
  protected materialRoughness = computed(() => this.descriptorProfile()?.roughness ?? 0.35);
  protected Math = Math;

  private meshRef = viewChild<ElementRef<THREE.Mesh>>('mesh');

  @Output() pointerButtonDown = new EventEmitter<FloatingDebrisPointerEvent>();
  @Output() pointerButtonUp = new EventEmitter<FloatingDebrisPointerEvent>();
  @Output() hoverChange = new EventEmitter<FloatingDebrisHoverEvent>();

  constructor() {
    const beforeRender = inject(FLOATING_DEBRIS_BEFORE_RENDER_FN);
    beforeRender(({ delta }) => {
      const mesh = this.meshRef()?.nativeElement;
      if (!mesh) {
        return;
      }
      this.pulsePhase.update((value) => value + delta * 1.1);
      mesh.rotation.x += delta * 0.4;
      mesh.rotation.y += delta * 0.55;
      mesh.rotation.z += delta * 0.25;
    });
  }

  protected emitHover(hovering: boolean): void {
    this.hovered.set(hovering);
    this.hoverChange.emit({ id: this.item().id, hovering });
  }

  protected resolveEmissiveIntensity(): number {
    const descriptorEmissive = this.descriptorProfile()?.emissiveIntensity ?? 1.8;
    if (this.targeted()) {
      return descriptorEmissive + 1.4;
    }
    return this.hovered() ? descriptorEmissive + 0.8 : descriptorEmissive;
  }

  protected onPointerDown(event: {
    button?: number;
    buttons?: number;
    nativeEvent?: { button?: number; buttons?: number };
  }): void {
    const button = event.button ?? event.nativeEvent?.button;
    const buttons = event.buttons ?? event.nativeEvent?.buttons;
    const isRightButton =
      button === 2 || (button === undefined && typeof buttons === 'number' && (buttons & 2) === 2);
    if (!isRightButton) {
      return;
    }
    this.pointerButtonDown.emit({ id: this.item().id, button: 2 });
  }

  protected onPointerUp(event: { button?: number; nativeEvent?: { button?: number } }): void {
    const button = event.button ?? event.nativeEvent?.button;
    if (button !== 2) {
      return;
    }
    this.pointerButtonUp.emit({ id: this.item().id, button });
  }
}
