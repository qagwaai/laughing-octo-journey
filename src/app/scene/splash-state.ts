import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { progress } from 'angular-three-soba/loaders';
import { appLogger } from '../services/logger';
import {
  pickRandomSplashPlanet,
  resolveSplashAppearance,
  selectSplashPlanet,
  SPLASH_SELECTABLE_BODIES,
  type SplashPickerCategory,
  type SplashPlanetEntry,
  type SplashPlanetKind,
} from './planet/splash-planet-rotation';
import { selectRenderQuality as selectSplashQuality, type RenderQuality } from './render-quality';
import {
  initialStationSplashPlanet,
  isStationSplashMarket,
  STATION_SPLASH_ASSETS,
  STATION_SPLASH_MARKET_ID,
  STATION_SPLASH_POSTER_URL,
} from './station-splash-assets';

export type SplashQuality = RenderQuality;
export type SplashForeground = 'asteroid-mining-rig' | 'station';

export { selectSplashQuality };

@Injectable({ providedIn: 'root' })
export class SplashState {
  private readonly initialSearch = window.location.search;
  readonly marketId = isStationSplashMarket(this.initialSearch) ? STATION_SPLASH_MARKET_ID : null;
  readonly foreground = signal<SplashForeground>(
    this.marketId === STATION_SPLASH_MARKET_ID ? 'station' : 'asteroid-mining-rig',
  );
  readonly stationSplash = computed(() => this.foreground() === 'station');
  readonly stellarWind = signal(false);
  readonly modelAsset = computed(() => this.assetForQuality(this.quality()));
  readonly triangleCount = computed(() => this.modelAsset().triangleCount);
  readonly posterUrl = computed(() =>
    this.stationSplash() ? STATION_SPLASH_POSTER_URL : 'models/mining-splash-poster.webp?v=32a3639e',
  );
  readonly loading = progress();
  readonly status = signal<'loading' | 'ready' | 'error' | 'static'>('loading');
  readonly loadDurationMs = signal<number | null>(null);
  readonly attempt = signal(0);
  readonly reducedMotion = signal(false);
  readonly documentHidden = signal(false);
  readonly orbitPaused = signal(false);
  readonly quality = signal<SplashQuality>('low');
  readonly supported = signal(true);
  readonly contextLost = signal(false);
  /** Chosen randomly per page load (or pinned); the overlay picker may replace it for the session. */
  readonly planet = signal<SplashPlanetEntry>(
    initialStationSplashPlanet(this.initialSearch) ?? selectSplashPlanet(this.initialSearch),
  );
  readonly planetBodyId = computed(() => this.planet().id);
  readonly planetKind = computed<SplashPlanetKind>(() => this.planet().kind);
  readonly appearance = computed(() => resolveSplashAppearance(this.planet()));
  readonly planetSurfaceArchetype = computed(() => {
    const appearance = this.appearance();
    return appearance.valid ? appearance.input.surfaceArchetype : null;
  });
  /** Stars only. */
  readonly planetSpectralClass = computed<string | null>(() => this.planet().spectralClass ?? null);
  /** Overlay picker state; 'random' means the body was drawn rather than chosen. */
  readonly pickerCategory = signal<SplashPickerCategory>('random');
  readonly pickerBody = signal<string>('random');
  /** True while a picked body's textures are loading; the previous body stays visible. */
  readonly bodySwapping = signal(false);
  readonly bodySwapError = signal<string | null>(null);
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
    this.quality.set(selectSplashQuality(window.innerWidth, navigator.hardwareConcurrency || 4, saveData));
    try {
      const canvas = document.createElement('canvas');
      const context = typeof WebGL2RenderingContext !== 'undefined' ? canvas.getContext('webgl2') : null;
      this.supported.set(context !== null);
      context?.getExtension('WEBGL_lose_context')?.loseContext();
      if (!context) {
        this.status.set('static');
        appLogger.warn('Splash: WebGL2 unavailable; showing static artwork.');
      }
    } catch (error) {
      this.supported.set(false);
      this.status.set('static');
      appLogger.warn('Splash: WebGL2 initialization failed; showing static artwork.', error);
    }
  }

  assetForQuality(quality: SplashQuality): { readonly url: string; readonly triangleCount: number } {
    return this.stationSplash()
      ? STATION_SPLASH_ASSETS[quality]
      : {
          url: `models/asteroid-mining-rig.${quality}.glb?v=${quality === 'standard' ? 'b4eaa6b9' : '9b277b11'}`,
          triangleCount: quality === 'standard' ? 154_757 : 50_239,
        };
  }

  retry(): void {
    if (!this.supported() || this.contextLost()) return;
    this.loadDurationMs.set(null);
    this.status.set('loading');
    this.attempt.update((attempt) => attempt + 1);
  }

  /** Loads the given triangle tier; the SplashScene load effect tracks `quality` and swaps the model. */
  switchQuality(quality: SplashQuality): void {
    if (!this.supported() || this.contextLost() || quality === this.quality()) return;
    this.quality.set(quality);
    if (this.status() !== 'ready') this.retry();
  }

  useStatic(): void {
    this.status.set('static');
  }

  chooseForeground(foreground: SplashForeground): void {
    this.foreground.set(foreground);
  }

  /** Switching category draws a random body from it. */
  chooseCategory(category: SplashPickerCategory): void {
    this.pickerCategory.set(category);
    this.pickerBody.set('random');
    this.reroll();
  }

  /** `'random'` re-rolls within the current category; otherwise picks the listed body. */
  chooseBody(bodyId: string): void {
    if (bodyId === 'random') {
      this.pickerBody.set('random');
      this.reroll();
      return;
    }
    const entry = SPLASH_SELECTABLE_BODIES.find((candidate) => candidate.id === bodyId);
    if (!entry) throw new Error(`Unknown splash body: ${bodyId}`);
    this.pickerBody.set(bodyId);
    this.applyPlanet(entry);
  }

  reroll(): void {
    const entry = pickRandomSplashPlanet(this.pickerCategory(), this.planet().id);
    if (entry) this.applyPlanet(entry);
  }

  private applyPlanet(entry: SplashPlanetEntry): void {
    if (entry.id === this.planet().id) return;
    this.bodySwapError.set(null);
    this.planet.set(entry);
  }

  /** A picked body failed to load; the scene keeps showing `displayed`. */
  rejectPlanet(displayed: SplashPlanetEntry, failed: SplashPlanetEntry, error: unknown): void {
    appLogger.error(`Splash could not load ${failed.id}; keeping ${displayed.id}.`, error);
    this.bodySwapError.set(failed.id);
    this.planet.set(displayed);
    const category = this.pickerCategory();
    const listed = category !== 'random' && displayed.kind === category;
    this.pickerBody.set(listed && this.pickerBody() !== 'random' ? displayed.id : 'random');
  }

  fail(error: unknown): void {
    appLogger.error('Splash could not be rendered.', error);
    this.status.set('error');
  }
}
