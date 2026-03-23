import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  Directive,
  DOCUMENT,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { beforeRender, extend } from 'angular-three';
import { NgtsPerspectiveCamera } from 'angular-three-soba/cameras';
import { NgtsOrbitControls } from 'angular-three-soba/controls';
import { BoxGeometry, GridHelper, Mesh, MeshBasicMaterial } from 'three';

@Directive({
  selector: '[cursorPointer]',
  host: {
    '(pointerover)': "document.body.style.cursor = 'pointer'",
    '(pointerout)': "document.body.style.cursor = 'default'",
  },
})
export class CursorPointer {
  protected document = inject(DOCUMENT);
}

@Component({
  selector: 'app-experience',
  template: `
    <ngts-perspective-camera [options]="{ makeDefault: true, position: [-3, 5, 5] }" />

    <ngt-mesh
      #mesh
      cursorPointer
      (click)="clicked.set(!clicked())"
      (pointerover)="hovered.set(true)"
      (pointerout)="hovered.set(false)"
      [scale]="clicked() ? 1.5 : 1"
    >
      <ngt-box-geometry />
      <ngt-mesh-basic-material [color]="hovered() ? 'hotpink' : 'orange'" />
    </ngt-mesh>

    <ngt-grid-helper />

    <ngts-orbit-controls />
  `,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CursorPointer, NgtsOrbitControls, NgtsPerspectiveCamera],
})
export class Experience {
  private meshRef = viewChild.required<ElementRef<Mesh>>('mesh');

  protected hovered = signal(false);
  protected clicked = signal(false);

  constructor() {
    extend({ Mesh, BoxGeometry, MeshBasicMaterial, GridHelper });
    beforeRender(({ delta }) => {
      const mesh = this.meshRef().nativeElement;
      mesh.rotation.x += delta;
      mesh.rotation.y += delta;
    });
  }
}
