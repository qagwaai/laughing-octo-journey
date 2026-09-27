import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { locale } from '../i18n/locale';
import { MiningSplashState } from './mining-splash-state';

@Component({
  selector: 'app-mining-splash-overlay',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      class="splash"
      [attr.data-state]="state.status()"
      [attr.data-quality]="state.quality()"
      [attr.data-motion]="state.orbitPaused() ? 'orbit' : state.moving() ? 'drift' : 'still'"
      [attr.aria-label]="t.public.mining.title"
    >
      <div class="diagnostic" aria-label="3D model diagnostics">
        {{ state.quality() === 'standard' ? t.public.mining.standardTier : t.public.mining.lowTier }}
        ·
        @if (state.status() === 'ready' && state.loadDurationMs() !== null) {
          {{ t.public.mining.loadTime }} {{ (state.loadDurationMs()! / 1000).toFixed(2) }} s
        } @else if (state.status() === 'loading') {
          {{ t.public.mining.loadingTier }}
        } @else {
          {{ t.public.mining.staticTier }}
        }
      </div>
      @if (state.status() !== 'ready') {
        <img class="poster" src="models/mining-splash-poster.webp?v=32a3639e" alt="" fetchpriority="high" />
        <div class="status" role="status" aria-live="polite">
          @if (state.status() === 'loading') {
            <p>{{ t.public.mining.loading }}</p>
            <progress
              max="100"
              [value]="state.loading.active() ? state.loading.progress() : null"
              [attr.aria-label]="t.public.mining.loading"
            ></progress>
            <p class="hint">{{ t.public.mining.progressHint }}</p>
            <button type="button" (click)="state.useStatic()">{{ t.public.mining.staticAction }}</button>
          } @else {
            <p>{{ state.status() === 'error' ? t.public.mining.error : t.public.mining.static }}</p>
            @if (state.supported() && !state.contextLost()) {
              <button type="button" (click)="state.retry()">{{ t.public.mining.retry }}</button>
            }
          }
        </div>
      } @else {
        <div class="caption">
          <span>
            {{ t.public.mining.title }}
            <small>{{ t.public.mining.orbitHint }}</small>
          </span>
          <button type="button" (click)="state.useStatic()">{{ t.public.mining.staticAction }}</button>
        </div>
      }
    </section>
  `,
  styles: `
    :host {
      position: absolute;
      inset: 0;
      z-index: 5;
      pointer-events: none;
    }
    .splash {
      position: relative;
      width: 100%;
      height: 100%;
      color: #edf4ff;
    }
    .poster {
      width: 100%;
      height: 100%;
      object-fit: cover;
      background: #050b16;
    }
    .diagnostic {
      position: absolute;
      top: max(0.75rem, env(safe-area-inset-top));
      right: max(0.75rem, env(safe-area-inset-right));
      z-index: 1;
      max-width: calc(100% - 1.5rem);
      border: 1px solid #879bb7;
      border-radius: 0.25rem;
      background: #061020e8;
      padding: 0.4rem 0.6rem;
      font-size: 0.7rem;
      line-height: 1.4;
      text-align: right;
      pointer-events: none;
    }
    .status {
      position: absolute;
      bottom: 2rem;
      left: 5%;
      right: 5%;
      padding: 1rem;
      background: #061020e8;
      border: 1px solid #415269;
      border-radius: 0.5rem;
    }
    p {
      margin: 0 0 0.7rem;
    }
    .hint {
      font-size: 0.75rem;
      color: #b9c9de;
    }
    progress {
      width: 100%;
      accent-color: #f59e42;
      margin-bottom: 0.5rem;
    }
    button {
      pointer-events: auto;
      cursor: pointer;
      border: 1px solid #879bb7;
      border-radius: 0.25rem;
      background: #0d1b2c;
      color: #edf4ff;
      padding: 0.4rem 0.7rem;
      font-size: 0.75rem;
    }
    button:focus-visible {
      outline: 2px solid #f59e42;
      outline-offset: 3px;
    }
    .caption {
      position: absolute;
      bottom: 1rem;
      left: 1rem;
      right: 1rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      text-shadow: 0 1px 4px #000;
    }
    .caption span {
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.15em;
    }
    .caption small {
      display: block;
      margin-top: 0.25rem;
      font-size: 0.65rem;
      font-weight: normal;
      letter-spacing: normal;
      text-transform: none;
    }
  `,
})
export class MiningSplashOverlay {
  protected readonly state = inject(MiningSplashState);
  protected readonly t = locale;
}
