import {
  ChangeDetectionStrategy,
  Component,
  computed,
  CUSTOM_ELEMENTS_SCHEMA,
  inject,
  InjectionToken,
  input,
} from '@angular/core';
import { gltfResource as _gltfResource } from 'angular-three-soba/loaders';
import { NgtArgs } from 'angular-three';
import * as THREE from 'three';

export const SHIP_GLTF_RESOURCE_FN = new InjectionToken('SHIP_GLTF_RESOURCE_FN', {
  providedIn: 'root',
  factory: () => _gltfResource,
});

/**
 * Loads a ship GLB from the given asset path and renders it via ngt-primitive.
 *
 * Hull-coloured mesh nodes (names starting with 'pod-hull' or 'pod-nose-upper')
 * receive the `color` input as their base colour.  All standard-material nodes
 * receive the targeted/active emissive accent so the ship visually responds to
 * game state at runtime.
 *
 * Scale is intentionally NOT applied here — the calling template is responsible
 * for wrapping this component in an ngt-group with the desired scale.
 */
@Component({
  selector: 'app-ship-model-mesh',
  template: `
    @if (scene()) {
      <ngt-primitive *args="[scene()]" />
    }
  `,
  imports: [NgtArgs],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShipModelMesh {
  assetPath = input.required<string>();
  color = input<string>('#3b82f6');
  targeted = input(false);
  isActive = input(false);

  protected gltfData = inject(SHIP_GLTF_RESOURCE_FN)(
    () => ({ ship: this.assetPath() }),
    { onLoad() {} },
  );

  protected scene = computed(() => {
    const gltf = this.gltfData.asReadonly().value()?.ship;
    if (!gltf) return null;

    const cloned = gltf.scene.clone(true);

    const hullColor = new THREE.Color(this.color());
    const emissiveColor = new THREE.Color(
      this.targeted() ? '#92400e' : this.isActive() ? '#78350f' : '#1e3a5f',
    );
    const emissiveIntensity = this.targeted() ? 0.65 : 0.4;

    cloned.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return;
      const meshChild = child as THREE.Mesh;
      if (Array.isArray(meshChild.material)) return;

      const mat = (meshChild.material as THREE.MeshStandardMaterial).clone();
      const name = meshChild.name;

      if (name === 'pod-hull-core' || name === 'pod-nose-upper') {
        mat.color = hullColor;
      }

      if (
        name === 'pod-hull-core' ||
        name === 'pod-nose-upper' ||
        name === 'pod-thruster-upper' ||
        name === 'pod-thruster-lower'
      ) {
        mat.emissive = emissiveColor;
        mat.emissiveIntensity = emissiveIntensity;
      }

      meshChild.material = mat;
    });

    return cloned;
  });
}
