import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  effect,
  ElementRef,
  inject,
  InjectionToken,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { beforeRender as _beforeRender, injectStore, NgtArgs } from 'angular-three';
import * as THREE from 'three';
import type { PlanetArchetype } from '../model/planet/planet-seed';
import type { PlanetLodTier } from '../model/planet/planet-texture';
import { bakePlanetTextures as _bakePlanetTextures, type PlanetBakeResult } from '../scene/planet/planet-bake';
import { Cursor } from './cursor';

export const BEFORE_RENDER_FN = new InjectionToken('BEFORE_RENDER_FN', {
  providedIn: 'root',
  factory: () => _beforeRender,
});

export const PLANET_BAKE_FN = new InjectionToken('PLANET_BAKE_FN', {
  providedIn: 'root',
  factory: () => _bakePlanetTextures,
});

/**
 * Renders a procedurally generated planet.
 *
 * Surfaces are derived from `bodyId` rather than loaded from an image, so any
 * body Forge seeds can be drawn without a curated texture asset.
 */
@Component({
  selector: 'app-planet',
  template: `
    <ngt-mesh #planet cursor [position]="[positionX(), 1.5, 0]" [name]="bodyId()" castShadow receiveShadow>
      <ngt-sphere-geometry *args="[1, 64, 64]" />

      @let _textures = textures();

      <ngt-mesh-standard-material
        [map]="_textures?.albedo ?? null"
        [normalMap]="_textures?.normal ?? null"
        [roughnessMap]="_textures?.material ?? null"
        [metalnessMap]="_textures?.material ?? null"
        [roughness]="_textures?.material ? 1 : 0.9"
        [metalness]="_textures?.material ? 1 : 0"
      />
    </ngt-mesh>
  `,
  imports: [NgtArgs, Cursor],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class Planet {
  positionX = input(0);
  bodyId = input.required<string>();
  tier = input<PlanetLodTier>('l1');
  archetype = input<PlanetArchetype>('terran');
  spinPerSecond = input(0.2);

  private meshRef = viewChild.required<ElementRef<THREE.Mesh>>('planet');
  private readonly bake = inject(PLANET_BAKE_FN);
  private readonly store = injectStore({ optional: true });
  protected readonly textures = signal<PlanetBakeResult | null>(null);

  protected hovered = signal(false);
  protected clicked = signal(false);

  constructor() {
    effect((onCleanup) => {
      const result = this.bake({
        bodyId: this.bodyId(),
        tier: this.tier(),
        archetype: this.archetype(),
        renderer: this.store?.snapshot.gl ?? null,
      });
      this.textures.set(result);
      onCleanup(() => result.dispose());
    });

    const beforeRender = inject(BEFORE_RENDER_FN);
    beforeRender(({ delta }) => {
      const mesh = this.meshRef()?.nativeElement;
      if (mesh) {
        mesh.rotation.y += delta * this.spinPerSecond();
      }
    });
  }
}
