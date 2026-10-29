import {
  ChangeDetectionStrategy,
  Component,
  computed,
  CUSTOM_ELEMENTS_SCHEMA,
  DestroyRef,
  effect,
  inject,
  InjectionToken,
  input,
  output,
  signal,
} from '@angular/core';
import { beforeRender, injectStore, NgtArgs } from 'angular-three';
import { Color, Mesh, MeshStandardMaterial, type Group } from 'three';
import { appLogger } from '../../services/logger';
import type { RenderQuality } from '../render-quality';
import { disposeSplashObject } from '../splash-composition';
import { createStationHabitatRotation } from './station-habitat-rotation';
import { STATION_MODELS } from './station-model-assets';
import { loadStationModel } from './station-model-loader';

export interface StationModelStatus {
  bodyId: string;
  state: 'loading' | 'ready' | 'error';
  quality: RenderQuality;
}

export const STATION_MODEL_LOAD = new InjectionToken('STATION_MODEL_LOAD', {
  providedIn: 'root',
  factory: () => loadStationModel,
});

@Component({
  selector: 'app-station-model',
  template: `
    <ngt-group [scale]="[radius(), radius(), radius()]">
      @if (model(); as object) {
        <ngt-primitive *args="[object]" />
      }
    </ngt-group>
  `,
  imports: [NgtArgs],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StationModel {
  private readonly store = injectStore();
  private readonly load = inject(STATION_MODEL_LOAD);
  private readonly reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  readonly bodyId = input.required<string>();
  readonly quality = input.required<RenderQuality>();
  readonly radius = input(1);
  readonly highlight = input<string | null>(null);
  readonly attempt = input(0);
  readonly statusChange = output<StationModelStatus>();
  protected readonly model = signal<Group | null>(null);
  readonly asset = computed(() => {
    const model = STATION_MODELS[this.bodyId()];
    if (!model) throw new Error(`No model registered for station ${this.bodyId()}.`);
    return model.assets[this.quality()];
  });

  constructor() {
    let rotateHabitat: ReturnType<typeof createStationHabitatRotation> | undefined;
    const pauseHabitat = () => rotateHabitat?.(0, false);
    document.addEventListener('visibilitychange', pauseHabitat);
    this.reducedMotion?.addEventListener('change', pauseHabitat);
    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener('visibilitychange', pauseHabitat);
      this.reducedMotion?.removeEventListener('change', pauseHabitat);
    });
    beforeRender(({ delta }) => {
      rotateHabitat?.(delta, !this.reducedMotion?.matches && !document.hidden);
    });
    effect((onCleanup) => {
      const quality = this.quality();
      const bodyId = this.bodyId();
      const asset = this.asset();
      this.attempt();
      const { gl, invalidate } = this.store.snapshot;
      let cancelled = false;
      let owned: Group | null = null;
      this.model.set(null);
      this.statusChange.emit({ bodyId, quality, state: 'loading' });
      void this.load(asset.url, gl)
        .then((model) => {
          if (cancelled) {
            disposeSplashObject(model);
            return;
          }
          owned = model;
          rotateHabitat = createStationHabitatRotation(model);
          this.model.set(model);
          this.statusChange.emit({ bodyId, quality, state: 'ready' });
          invalidate();
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          if (owned) disposeSplashObject(owned);
          owned = null;
          rotateHabitat = undefined;
          appLogger.error('Station model could not be loaded.', { bodyId, quality, error });
          this.statusChange.emit({ bodyId, quality, state: 'error' });
          invalidate();
        });
      onCleanup(() => {
        cancelled = true;
        rotateHabitat = undefined;
        this.model.set(null);
        if (owned) disposeSplashObject(owned);
      });
    });
    effect((onCleanup) => {
      const model = this.model();
      const highlight = this.highlight();
      if (!model) return;
      const originals = new Map<MeshStandardMaterial, { color: Color; intensity: number }>();
      model.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          if (!(material instanceof MeshStandardMaterial) || originals.has(material)) continue;
          originals.set(material, { color: material.emissive.clone(), intensity: material.emissiveIntensity });
          if (highlight) {
            material.emissive.set(highlight);
            material.emissiveIntensity = 0.4;
          }
        }
      });
      this.store.snapshot.invalidate();
      onCleanup(() => {
        originals.forEach((original, material) => {
          material.emissive.copy(original.color);
          material.emissiveIntensity = original.intensity;
        });
      });
    });
  }
}
