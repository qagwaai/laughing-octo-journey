import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { progress } from 'angular-three-soba/loaders';
import { appLogger } from '../services/logger';

export type MiningQuality = 'standard' | 'low';

export function selectMiningQuality(width: number, cores: number, saveData: boolean): MiningQuality {
  return width < 768 || cores <= 4 || saveData ? 'low' : 'standard';
}

@Injectable({ providedIn: 'root' })
export class MiningSplashState {
  readonly loading = progress();
  readonly status = signal<'loading' | 'ready' | 'error' | 'static'>('loading');
  readonly loadDurationMs = signal<number | null>(null);
  readonly attempt = signal(0);
  readonly reducedMotion = signal(false);
  readonly documentHidden = signal(false);
  readonly orbitPaused = signal(false);
  readonly quality = signal<MiningQuality>('low');
  readonly supported = signal(true);
  readonly contextLost = signal(false);
  readonly moving = computed(
    () => this.status() === 'ready' && !this.reducedMotion() && !this.documentHidden() && !this.orbitPaused(),
  );

  constructor() {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const updateMotion = () => this.reducedMotion.set(media?.matches ?? false);
    const updateVisibility = () => this.documentHidden.set(document.hidden);
    updateMotion();
    updateVisibility();
    media?.addEventListener('change', updateMotion);
    document.addEventListener('visibilitychange', updateVisibility);
    inject(DestroyRef).onDestroy(() => {
      media?.removeEventListener('change', updateMotion);
      document.removeEventListener('visibilitychange', updateVisibility);
    });
    const connection: unknown = Reflect.get(navigator, 'connection');
    const saveData =
      typeof connection === 'object' && connection !== null && 'saveData' in connection && connection.saveData === true;
    this.quality.set(selectMiningQuality(window.innerWidth, navigator.hardwareConcurrency || 4, saveData));
    try {
      const canvas = document.createElement('canvas');
      const context = typeof WebGL2RenderingContext !== 'undefined' ? canvas.getContext('webgl2') : null;
      this.supported.set(context !== null);
      context?.getExtension('WEBGL_lose_context')?.loseContext();
      if (!context) {
        this.status.set('static');
        appLogger.warn('Mining splash: WebGL2 unavailable; showing static artwork.');
      }
    } catch (error) {
      this.supported.set(false);
      this.status.set('static');
      appLogger.warn('Mining splash: WebGL2 initialization failed; showing static artwork.', error);
    }
  }

  retry(): void {
    if (!this.supported() || this.contextLost()) return;
    this.loadDurationMs.set(null);
    this.status.set('loading');
    this.attempt.update((attempt) => attempt + 1);
  }

  useStatic(): void {
    this.status.set('static');
  }

  fail(error: unknown): void {
    appLogger.error('Mining splash could not be rendered.', error);
    this.status.set('error');
  }
}
