import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { beforeRender, NgtArgs } from 'angular-three';
import type { Mesh } from 'three';
import { createPlanetCloudStormMaterial, type PlanetCloudStormMaterial } from './planet-cloud-storms';
import { CLOUD_DRIFT_RADIANS_PER_SECOND, createPlanetCloudTexture, PlanetCloudSettings } from './planet-clouds';

@Component({
  selector: 'app-planet-cloud-layer',
  imports: [NgtArgs],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (stormLayer(); as layer) {
      <ngt-mesh #mesh [visible]="settings.enabled()">
        <ngt-sphere-geometry *args="[radius() * 1.012, 48, 32]" />
        <ngt-primitive attach="material" *args="[layer.material]" />
      </ngt-mesh>
    }
  `,
})
export class PlanetCloudLayer {
  readonly bodyId = input.required<string>();
  readonly radius = input.required<number>();
  readonly resolution = input(128);
  protected readonly settings = inject(PlanetCloudSettings);
  protected readonly stormLayer = signal<PlanetCloudStormMaterial | null>(null);
  private readonly cloudTexture = signal<ReturnType<typeof createPlanetCloudTexture> | null>(null);
  private readonly mesh = viewChild<ElementRef<Mesh>>('mesh');
  private readonly reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');

  constructor() {
    effect((onCleanup) => {
      const width = this.resolution();
      const bodyId = this.bodyId();
      const style = this.settings.style();
      const texture = createPlanetCloudTexture(bodyId, width, width / 2, style);
      const stormLayer = createPlanetCloudStormMaterial(bodyId, style, texture.texture);
      this.cloudTexture.set(texture);
      this.stormLayer.set(stormLayer);
      onCleanup(() => {
        stormLayer.material.dispose();
        texture.texture.dispose();
      });
    });
    effect(() => {
      this.cloudTexture()?.setCoverage(this.settings.coverage());
    });
    effect(() => {
      this.stormLayer()?.setActivity(this.settings.stormActivity());
    });
    beforeRender(({ delta }) => {
      if (this.settings.enabled() && !this.reducedMotion?.matches && !document.hidden) {
        const mesh = this.mesh()?.nativeElement;
        if (mesh) {
          mesh.rotation.y += Math.min(delta, 0.05) * CLOUD_DRIFT_RADIANS_PER_SECOND;
          this.stormLayer()?.advance(delta);
        }
      }
    });
  }
}
