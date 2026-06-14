import { ChangeDetectionStrategy, Component, computed, CUSTOM_ELEMENTS_SCHEMA, input } from '@angular/core';
import { Triplet } from '@pmndrs/cannon-worker-api';
import { NgtArgs } from 'angular-three';
import { gltfResource } from 'angular-three-soba/loaders';

@Component({
  selector: 'app-jaxs-ship',
  template: `
    @if (shipScene()) {
      <ngt-group [position]="position()" [rotation]="rotation()" [scale]="scale()">
        <ngt-primitive *args="[shipScene()]" />
      </ngt-group>
    }
  `,
  imports: [NgtArgs],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JaxsShip {
  position = input<Triplet>([0, 0, 0]);
  rotation = input<Triplet>([0, 0, 0]);
  scale = input<number>(0.12);

  protected shipModel = gltfResource(
    () => ({ ship: 'models/Jaxs_Ship_texture.glb' }),
    { onLoad() {} },
  );

  protected shipScene = computed(() => this.shipModel.asReadonly().value()?.ship?.scene ?? null);
}