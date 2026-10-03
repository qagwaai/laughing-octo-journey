import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  effect,
  input,
  signal,
} from '@angular/core';
import { beforeRender, NgtArgs } from 'angular-three';
import type { StarProfile } from '../../model/star/star-profile';
import { STAR_DEFAULT_FLARE_ACTIVITY } from './star-flares';
import { createStar, type StarHandle } from './star';

/**
 * Angular-three wrapper around `createStar`.
 *
 * Rebuilds the star when its profile, radius or mesh detail change, and
 * otherwise only updates flare activity and highlight.
 */
@Component({
  selector: 'app-star',
  imports: [NgtArgs],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (handle(); as star) {
      <ngt-primitive *args="[star.group]" />
    }
  `,
})
export class StarBody {
  readonly profile = input.required<StarProfile>();
  readonly radius = input(1);
  readonly widthSegments = input(64);
  readonly heightSegments = input(48);
  readonly flareActivity = input(STAR_DEFAULT_FLARE_ACTIVITY);
  /** Pick tint as a colour string, or null for none. */
  readonly highlightColor = input<string | null>(null);

  protected readonly handle = signal<StarHandle | null>(null);
  private readonly reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');

  constructor() {
    effect((onCleanup) => {
      const star = createStar(this.profile(), {
        radius: this.radius(),
        widthSegments: this.widthSegments(),
        heightSegments: this.heightSegments(),
      });
      this.handle.set(star);
      onCleanup(() => star.dispose());
    });
    effect(() => {
      this.handle()?.setFlareActivity(this.flareActivity());
    });
    effect(() => {
      this.handle()?.setHighlight(this.highlightColor());
    });
    beforeRender(({ delta }) => {
      const star = this.handle();
      if (star && !this.reducedMotion?.matches && !document.hidden) star.advance(delta);
    });
  }
}
