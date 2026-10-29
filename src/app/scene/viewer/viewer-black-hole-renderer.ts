import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  effect,
  EventEmitter,
  Output,
  signal,
} from '@angular/core';
import { beforeRender, injectStore, NgtArgs } from 'angular-three';
import { Quaternion } from 'three';
import { appLogger } from '../../services/logger';
import { createBlackHole, type BlackHoleHandle } from '../black-hole/black-hole';

const VIEWER_BLACK_HOLE_RENDER_BUDGET = { resolution: 320, traceSteps: 256 } as const;
const VIEWER_BLACK_HOLE_DISPLAY_SCALE = 0.25;

/** Angular Three lifecycle wrapper for the reusable, bounded Schwarzschild pass. */
@Component({
  selector: 'app-viewer-black-hole-renderer',
  imports: [NgtArgs],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (handle(); as blackHole) {
      <ngt-primitive *args="[blackHole.group]" />
    }
  `,
})
export class ViewerBlackHoleRenderer {
  @Output() readonly rendererError = new EventEmitter<void>();

  protected readonly handle = signal<BlackHoleHandle | null>(null);
  private readonly store = injectStore();
  private readonly reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  private hasReportedRendererError = false;

  constructor() {
    effect((onCleanup) => {
      const blackHole = createBlackHole({
        ...VIEWER_BLACK_HOLE_RENDER_BUDGET,
        viewRotation: new Quaternion(),
        background: 'transparent',
      });
      blackHole.group.scale.setScalar(VIEWER_BLACK_HOLE_DISPLAY_SCALE);
      this.handle.set(blackHole);
      onCleanup(() => {
        blackHole.dispose();
        this.handle.set(null);
      });
    });

    beforeRender(({ delta }) => {
      const blackHole = this.handle();
      if (!blackHole || this.hasReportedRendererError || document.hidden) return;
      const renderer = this.store.gl();
      const camera = this.store.camera();
      if (!renderer || !camera) return;

      try {
        blackHole.advance(this.reducedMotion?.matches ? 0 : delta);
        blackHole.render(renderer, camera);
      } catch (error) {
        if (this.hasReportedRendererError) return;
        this.hasReportedRendererError = true;
        appLogger.error('[viewer-black-hole-renderer] Black-hole renderer is unavailable.', { error });
        this.rendererError.emit();
      }
    });
  }
}
