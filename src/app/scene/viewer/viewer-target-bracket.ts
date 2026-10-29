import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  input,
  OnDestroy,
  viewChild,
} from '@angular/core';
import { beforeRender, injectStore, NgtArgs } from 'angular-three';
import { BoxGeometry, BufferGeometry, Float32BufferAttribute, type Group } from 'three';

const BRACKET_HALF_EXTENT = 1.3;
const BRACKET_ARM_LENGTH = 0.55;
const BRACKET_THICKNESS = 0.045;

export function createViewerTargetBracketGeometry(): BufferGeometry {
  const corners: Array<[number, number]> = [
    [-BRACKET_HALF_EXTENT, BRACKET_HALF_EXTENT],
    [BRACKET_HALF_EXTENT, BRACKET_HALF_EXTENT],
    [-BRACKET_HALF_EXTENT, -BRACKET_HALF_EXTENT],
    [BRACKET_HALF_EXTENT, -BRACKET_HALF_EXTENT],
  ];
  const segments = corners.flatMap(([cx, cy]) => {
    const signX = Math.sign(cx);
    const signY = Math.sign(cy);
    return [
      {
        size: [BRACKET_ARM_LENGTH, BRACKET_THICKNESS, BRACKET_THICKNESS] as const,
        position: [cx - (signX * BRACKET_ARM_LENGTH) / 2, cy, 0] as const,
      },
      {
        size: [BRACKET_THICKNESS, BRACKET_ARM_LENGTH, BRACKET_THICKNESS] as const,
        position: [cx, cy - (signY * BRACKET_ARM_LENGTH) / 2, 0] as const,
      },
    ];
  });

  const positions: number[] = [];
  const indices: number[] = [];
  for (const segment of segments) {
    const box = new BoxGeometry(...segment.size).translate(...segment.position);
    const position = box.getAttribute('position');
    const index = box.getIndex();
    const vertexOffset = positions.length / 3;
    for (let vertex = 0; vertex < position.count; vertex++) {
      positions.push(position.getX(vertex), position.getY(vertex), position.getZ(vertex));
    }
    if (index) {
      for (let i = 0; i < index.count; i++) indices.push(index.getX(i) + vertexOffset);
    }
    box.dispose();
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

@Component({
  selector: 'app-viewer-target-bracket',
  imports: [NgtArgs],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ngt-group #bracket [scale]="radius()">
      <ngt-mesh name="viewer-target-bracket" [renderOrder]="1000">
        <ngt-primitive attach="geometry" *args="[geometry]" />
        <ngt-mesh-basic-material [color]="'#ff3b30'" [depthTest]="false" [depthWrite]="false" [toneMapped]="false" />
      </ngt-mesh>
    </ngt-group>
  `,
})
export class ViewerTargetBracket implements OnDestroy {
  readonly radius = input.required<number>();

  private readonly store = injectStore();
  private readonly bracketRef = viewChild.required<ElementRef<Group>>('bracket');
  protected readonly geometry = createViewerTargetBracketGeometry();

  constructor() {
    beforeRender(() => {
      const camera = this.store.camera();
      const bracket = this.bracketRef().nativeElement;
      if (camera) bracket.quaternion.copy(camera.quaternion);
    });
  }

  ngOnDestroy(): void {
    this.geometry.dispose();
  }
}
