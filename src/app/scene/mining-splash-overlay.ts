import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { locale } from '../i18n/locale';
import { GAS_GIANT_PALETTES, type GasGiantPalette } from '../model/planet/gas-giant-profile';
import { GasGiantSettings, type GasGiantPaletteChoice } from './gas-giant/gas-giant-settings';
import { MiningSplashState, type MiningQuality } from './mining-splash-state';
import { resolveSpectralClass } from '../model/star/star-profile';
import { SPLASH_STAR_CLASSES } from './planet/splash-planet-rotation';
import { isStarSpectralClassChoice, resolveStarSpectralClassChoice, StarSettings } from './star/star-settings';
import { PlanetCloudSettings } from './planet/planet-clouds';

@Component({
  selector: 'app-mining-splash-overlay',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      class="splash"
      [attr.data-state]="state.status()"
      [attr.data-quality]="state.quality()"
      [attr.data-planet]="state.planetBodyId"
      [attr.data-planet-kind]="state.planetKind"
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
        · {{ t.public.mining.planetLabel }} {{ state.planetBodyId }}
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
              <button type="button" class="tier-switch" (click)="state.switchQuality(otherQuality())">
                {{ switchLabel() }}
              </button>
            }
          }
        </div>
      } @else {
        <div class="cloud-controls" (pointerdown)="$event.stopPropagation()" (wheel)="$event.stopPropagation()">
          @if (state.planetKind === 'gas-giant') {
            <label for="splash-giant-palette">{{ t.public.mining.gasGiantPaletteLabel }}</label>
            <select id="splash-giant-palette" [value]="giants.palette()" (change)="onGiantPalette($event)">
              <option value="seeded">{{ t.public.mining.gasGiantPaletteSeeded }}</option>
              <option value="jovian">{{ t.public.mining.gasGiantPaletteJovian }}</option>
              <option value="saturnian">{{ t.public.mining.gasGiantPaletteSaturnian }}</option>
              <option value="ice">{{ t.public.mining.gasGiantPaletteIce }}</option>
            </select>
            <label for="splash-giant-rings">{{ t.public.mining.gasGiantRingsLabel }}</label>
            <select id="splash-giant-rings" [value]="giants.rings()" (change)="onGiantRings($event)">
              <option value="seeded">{{ t.public.mining.gasGiantRingsSeeded }}</option>
              <option value="on">{{ t.public.mining.gasGiantRingsOn }}</option>
              <option value="off">{{ t.public.mining.gasGiantRingsOff }}</option>
            </select>
            <label for="splash-storm-activity">
              {{ t.public.mining.stormActivityLabel }}: {{ clouds.stormActivity() }}%
            </label>
            <input
              id="splash-storm-activity"
              type="range"
              min="0"
              max="100"
              step="1"
              [value]="clouds.stormActivity()"
              (input)="onStormActivity($event)"
            />
          } @else if (state.planetKind === 'star') {
            <p class="star-class" data-testid="splash-star-class">
              {{ t.public.mining.starSpectralClassLabel }}: {{ starClassLabel() }}
            </p>
            <label for="splash-star-spectral-class">{{ t.public.mining.starClassSelectLabel }}</label>
            <select id="splash-star-spectral-class" [value]="stars.spectralClass()" (change)="onStarClass($event)">
              <option value="seeded">{{ t.public.mining.starClassSeeded }}</option>
              @for (spectralClass of starClasses; track spectralClass) {
                <option [value]="spectralClass">{{ spectralClass }}</option>
              }
            </select>
            <label for="splash-flare-activity">
              {{ t.public.mining.starFlareActivityLabel }}: {{ stars.flareActivity() }}%
            </label>
            <input
              id="splash-flare-activity"
              type="range"
              min="0"
              max="100"
              step="1"
              [value]="stars.flareActivity()"
              (input)="onFlareActivity($event)"
            />
          } @else {
            <label class="cloud-toggle">
              <input type="checkbox" [checked]="clouds.enabled()" (change)="onCloudToggle($event)" />
              {{ t.public.mining.cloudsLabel }}
            </label>
            <label for="splash-cloud-style">{{ t.public.mining.cloudStyleLabel }}</label>
            <select
              id="splash-cloud-style"
              [value]="clouds.style()"
              [disabled]="!clouds.enabled()"
              (change)="onCloudStyle($event)"
            >
              <option value="thin">{{ t.public.mining.thinCloudsLabel }}</option>
              <option value="thick">{{ t.public.mining.thickCloudsLabel }}</option>
            </select>
            <label for="splash-cloud-coverage">
              {{ t.public.mining.cloudCoverageLabel }}: {{ clouds.coverage() }}%
            </label>
            <input
              id="splash-cloud-coverage"
              type="range"
              min="0"
              max="100"
              step="1"
              [value]="clouds.coverage()"
              [disabled]="!clouds.enabled()"
              (input)="onCloudCoverage($event)"
            />
            <label for="splash-storm-activity">
              {{ t.public.mining.stormActivityLabel }}: {{ clouds.stormActivity() }}%
            </label>
            <input
              id="splash-storm-activity"
              type="range"
              min="0"
              max="100"
              step="1"
              [value]="clouds.stormActivity()"
              [disabled]="!clouds.enabled()"
              (input)="onStormActivity($event)"
            />
          }
        </div>
        <div class="caption">
          <span>
            {{ t.public.mining.title }}
            <small>{{ t.public.mining.orbitHint }}</small>
          </span>
          <span class="actions">
            <button type="button" class="tier-switch" (click)="state.switchQuality(otherQuality())">
              {{ switchLabel() }}
            </button>
            <button type="button" (click)="state.useStatic()">{{ t.public.mining.staticAction }}</button>
          </span>
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
    .cloud-controls {
      position: absolute;
      right: 1rem;
      bottom: 4.5rem;
      display: grid;
      gap: 0.35rem;
      min-width: 11rem;
      border: 1px solid #879bb7;
      border-radius: 0.4rem;
      background: #061020e8;
      padding: 0.55rem 0.7rem;
      font-size: 0.75rem;
      pointer-events: auto;
    }
    .cloud-toggle {
      display: flex;
      align-items: center;
      gap: 0.45rem;
    }
    .star-class {
      margin: 0;
    }
    .cloud-controls input[type='range'] {
      width: 100%;
      accent-color: #f59e42;
    }
    .cloud-controls select {
      border: 1px solid #879bb7;
      border-radius: 0.25rem;
      background: #0d1b2c;
      color: #edf4ff;
      padding: 0.3rem;
    }
    .cloud-controls select:focus-visible,
    .cloud-controls input:focus-visible {
      outline: 2px solid #f59e42;
      outline-offset: 2px;
    }
    .caption span {
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.15em;
    }
    .caption .actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 0.5rem;
      font-size: inherit;
      text-transform: none;
      letter-spacing: normal;
    }
    .status button + button {
      margin-left: 0.5rem;
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
  protected readonly clouds = inject(PlanetCloudSettings);
  protected readonly giants = inject(GasGiantSettings);
  protected readonly stars = inject(StarSettings);
  protected readonly starClasses = SPLASH_STAR_CLASSES;
  protected readonly starClassLabel = computed(
    () =>
      resolveSpectralClass(
        resolveStarSpectralClassChoice(this.stars.spectralClass(), this.state.planetSpectralClass),
      ).label,
  );
  protected readonly t = locale;

  protected onStarClass(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    const value = target.value;
    if (!isStarSpectralClassChoice(value)) throw new Error(`Unknown star spectral class: ${value}`);
    this.stars.spectralClass.set(value);
  }

  protected onFlareActivity(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) this.stars.flareActivity.set(Number(target.value));
  }

  protected onGiantPalette(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    const value = target.value;
    if (value !== 'seeded' && !GAS_GIANT_PALETTES.includes(value as GasGiantPalette)) {
      throw new Error(`Unknown gas giant palette: ${value}`);
    }
    this.giants.palette.set(value as GasGiantPaletteChoice);
  }

  protected onGiantRings(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    const value = target.value;
    if (value !== 'seeded' && value !== 'on' && value !== 'off') throw new Error(`Unknown ring choice: ${value}`);
    this.giants.rings.set(value);
  }

  protected onCloudToggle(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) this.clouds.enabled.set(target.checked);
  }

  protected onCloudCoverage(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) this.clouds.setCoverage(Number(target.value));
  }

  protected onStormActivity(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) this.clouds.stormActivity.set(Number(target.value));
  }

  protected onCloudStyle(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    if (target.value !== 'thin' && target.value !== 'thick') throw new Error(`Unknown cloud style: ${target.value}`);
    this.clouds.style.set(target.value);
  }
  protected readonly otherQuality = computed<MiningQuality>(() =>
    this.state.quality() === 'standard' ? 'low' : 'standard',
  );
  protected readonly switchLabel = computed(() =>
    this.otherQuality() === 'standard' ? this.t.public.mining.switchToStandard : this.t.public.mining.switchToLow,
  );
}
