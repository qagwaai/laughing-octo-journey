/**
 * Progress readout for background planet-surface baking.
 *
 * Both the system view and the detail view need this, and both drive it from
 * the same cache, so it owns its own state rather than being wired up twice.
 */
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { locale } from '../../i18n/locale';
import { PlanetTextureCache } from './planet-texture-cache';

@Component({
  selector: 'app-planet-surface-progress',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (baking()) {
      <div
        class="surface-progress"
        role="status"
        data-testid="viewer-surface-progress"
        [attr.data-progress]="percent()"
      >
        <span class="surface-progress__label">{{ t.game.viewer.surfaceBakeStatus }}</span>
        <progress
          class="surface-progress__bar"
          max="100"
          [value]="percent()"
          [attr.aria-label]="t.game.viewer.surfaceBakeStatus"
        ></progress>
      </div>
    }
  `,
  styles: [
    `
      .surface-progress {
        position: absolute;
        bottom: 1rem;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        align-items: center;
        padding: 0.5rem 0.9rem;
        border-radius: 0.5rem;
        background: rgba(6, 12, 24, 0.78);
        border: 1px solid rgba(120, 190, 255, 0.28);
        color: #cfe4ff;
        font-size: 0.75rem;
        letter-spacing: 0.04em;
        pointer-events: none;
        z-index: 5;
      }

      .surface-progress__bar {
        width: 12rem;
        height: 0.35rem;
        accent-color: #6fb4ff;
      }
    `,
  ],
})
export class PlanetSurfaceProgress {
  protected readonly t = locale;
  private readonly planetTextures = inject(PlanetTextureCache);

  protected readonly baking = this.planetTextures.isBaking;
  protected readonly percent = computed(() => Math.round(this.planetTextures.progress() * 100));
}
