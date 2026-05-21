import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  EventEmitter,
  inject,
  InjectionToken,
  input,
  Output,
  viewChild,
} from '@angular/core';
import { beforeRender as _beforeRender, NgtArgs } from 'angular-three';
import * as THREE from 'three';
import type { FloatingDebrisItem } from '../../model/floating-debris-item';

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

@Component({
  selector: 'app-floating-debris-node',
  template: `
    <ngt-group [position]="position()">
      <ngt-mesh
        #mesh
        name="floating-debris"
        (pointerdown)="onPointerDown($event)"
        (pointerup)="onPointerUp($event)"
      >
        <ngt-box-geometry *args="[0.5, 0.5, 0.5]" />
        <ngt-mesh-standard-material
          [color]="'#5ad9ff'"
          [emissive]="'#5ad9ff'"
          [emissiveIntensity]="targeted() ? 3.2 : 1.8"
          [metalness]="0.4"
          [roughness]="0.35"
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
  targeted = input<boolean>(false);

  private meshRef = viewChild<ElementRef<THREE.Mesh>>('mesh');

  @Output() pointerButtonDown = new EventEmitter<FloatingDebrisPointerEvent>();
  @Output() pointerButtonUp = new EventEmitter<FloatingDebrisPointerEvent>();

  constructor() {
    const beforeRender = inject(FLOATING_DEBRIS_BEFORE_RENDER_FN);
    beforeRender(({ delta }) => {
      const mesh = this.meshRef()?.nativeElement;
      if (!mesh) {
        return;
      }
      mesh.rotation.x += delta * 0.4;
      mesh.rotation.y += delta * 0.55;
      mesh.rotation.z += delta * 0.25;
    });
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
