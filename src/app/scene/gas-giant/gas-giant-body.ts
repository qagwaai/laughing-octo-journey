import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  effect,
  input,
  signal,
} from '@angular/core';
import { beforeRender, NgtArgs } from 'angular-three';
import { Color, Vector3 } from 'three';
import type { GasGiantProfile } from '../../model/planet/gas-giant-profile';
import { createGasGiant, type GasGiantHandle } from './gas-giant';
import type { GasGiantBandSize } from './gas-giant-bands';

export interface GasGiantMoonInput {
  /** World-space position; the planet view's scene root is the world frame. */
  position: readonly [number, number, number];
  radius: number;
}

/** Rings read light as a multiplier; this keeps them level with the lit planet. */
const RING_LIGHT_GAIN = 1.8;

/**
 * Angular-three wrapper around `createGasGiant`.
 *
 * Rebuilds the giant when its profile, radius or texture size change, and
 * otherwise only updates uniforms: light, moon shadows, storms and highlight.
 */
@Component({
  selector: 'app-gas-giant',
  imports: [NgtArgs],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (handle(); as giant) {
      <ngt-primitive *args="[giant.group]" />
    }
  `,
})
export class GasGiantBody {
  readonly profile = input.required<GasGiantProfile>();
  readonly radius = input(1);
  readonly textureSize = input<GasGiantBandSize>({ width: 1024, height: 512 });
  /** Light source position in the parent frame; the giant is lit from there. */
  readonly lightPosition = input<readonly [number, number, number] | null>(null);
  readonly lightColor = input<string | null>(null);
  readonly moons = input<readonly GasGiantMoonInput[]>([]);
  readonly stormActivity = input(60);
  readonly highlighted = input(false);

  protected readonly handle = signal<GasGiantHandle | null>(null);
  private readonly reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  private readonly lightDirection = new Vector3();
  private readonly center = new Vector3();

  constructor() {
    effect((onCleanup) => {
      const giant = createGasGiant(this.profile(), {
        radius: this.radius(),
        textureSize: this.textureSize(),
      });
      this.handle.set(giant);
      onCleanup(() => giant.dispose());
    });
    effect(() => {
      this.handle()?.setStormActivity(this.stormActivity());
    });
    effect(() => {
      this.handle()?.setHighlight(this.highlighted());
    });
    effect(() => {
      const color = this.lightColor();
      if (color) this.handle()?.setLightColor(new Color(color).multiplyScalar(RING_LIGHT_GAIN));
    });
    effect(() => {
      this.handle()?.setMoons(
        this.moons().map((moon) => ({ position: new Vector3(...moon.position), radius: moon.radius })),
      );
    });
    beforeRender(({ delta }) => {
      const giant = this.handle();
      if (!giant) return;
      const light = this.lightPosition();
      if (light) {
        giant.group.getWorldPosition(this.center);
        giant.setLightDirection(this.lightDirection.set(light[0], light[1], light[2]).sub(this.center));
      }
      if (!this.reducedMotion?.matches && !document.hidden) giant.advance(delta);
    });
  }
}
