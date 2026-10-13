import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA, effect, input, signal } from '@angular/core';
import { NgtArgs } from 'angular-three';
import {
  ClampToEdgeWrapping,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  TextureLoader,
  type Texture,
} from 'three';
import { appLogger } from '../../services/logger';
import {
  createTitanHazeTexture,
  resolveVenusAtmosphereUrl,
  type AtmosphereQuality,
  type DedicatedAtmosphereBody,
} from './planet-atmosphere';

const ATMOSPHERE_OVERVIEW_RADIUS_SCALE = 1.012;

@Component({
  selector: 'app-planet-atmosphere-layer',
  imports: [NgtArgs],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (material(); as atmosphereMaterial) {
      <ngt-mesh [name]="'Atmosphere ' + bodyId()" [renderOrder]="2">
        <ngt-sphere-geometry *args="[radius() * ATMOSPHERE_OVERVIEW_RADIUS_SCALE, 48, 32]" />
        <ngt-primitive attach="material" *args="[atmosphereMaterial]" />
      </ngt-mesh>
    }
  `,
})
export class PlanetAtmosphereLayer {
  readonly bodyId = input.required<string>();
  readonly atmosphereBody = input.required<DedicatedAtmosphereBody>();
  readonly radius = input.required<number>();
  readonly quality = input<AtmosphereQuality>('overview');
  protected readonly ATMOSPHERE_OVERVIEW_RADIUS_SCALE = ATMOSPHERE_OVERVIEW_RADIUS_SCALE;
  protected readonly material = signal<MeshStandardMaterial | null>(null);

  constructor() {
    effect((onCleanup) => {
      const bodyId = this.bodyId();
      const body = this.atmosphereBody();
      const quality = this.quality();
      let texturePromise: Promise<Texture>;
      if (body === 'venus') {
        texturePromise = new TextureLoader().loadAsync(resolveVenusAtmosphereUrl(quality));
      } else {
        const resolution = quality === 'detail' ? 512 : 256;
        texturePromise = Promise.resolve(createTitanHazeTexture(resolution, resolution / 2));
      }

      let disposed = false;
      let loadedMaterial: MeshStandardMaterial | null = null;
      void texturePromise.then(
        (texture) => {
          if (disposed) {
            texture.dispose();
            return;
          }
          texture.colorSpace = SRGBColorSpace;
          texture.wrapS = RepeatWrapping;
          texture.wrapT = ClampToEdgeWrapping;
          texture.needsUpdate = true;
          loadedMaterial = new MeshStandardMaterial({
            map: texture,
            roughness: 1,
            metalness: 0,
          });
          this.material.set(loadedMaterial);
        },
        (error: unknown) => {
          if (!disposed) {
            appLogger.error('[planet-atmosphere-load]', {
              bodyId,
              atmosphereBody: body,
              quality,
              error,
            });
          }
        },
      );
      onCleanup(() => {
        disposed = true;
        loadedMaterial?.map?.dispose();
        loadedMaterial?.dispose();
        this.material.set(null);
      });
    });
  }
}
