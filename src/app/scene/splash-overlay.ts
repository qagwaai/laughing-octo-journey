import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { locale } from '../i18n/locale';
import { ExternalAnchorsComponent } from '../component/external-anchors';
import { SATURN_REFERENCE_LINKS } from '../model/planet/saturn-profile';
import { BLACK_HOLE_SPLASH_QUALITY, CYGNUS_X1_REFERENCES } from '../model/black-hole/cygnus-x1';
import { GAS_GIANT_PALETTES, type GasGiantPalette } from '../model/planet/gas-giant-profile';
import { resolveSpectralClass } from '../model/star/star-profile';
import { GasGiantSettings, type GasGiantPaletteChoice } from './gas-giant/gas-giant-settings';
import { SplashState, type SplashQuality } from './splash-state';
import { PlanetCloudSettings } from './planet/planet-clouds';
import { resolveCatalogPlanetSurfaceAsset } from './planet/planet-surface-catalog';
import {
  isSplashPickerCategory,
  solBodyHasClouds,
  SPLASH_PICKER_CATEGORIES,
  SPLASH_PLANET_BODY_ID,
  SPLASH_STAR_CLASSES,
  splashEntriesForCategory,
  type SplashPickerCategory,
  type SplashPlanetEntry,
} from './planet/splash-planet-rotation';
import { isStarSpectralClassChoice, resolveStarSpectralClassChoice, StarSettings } from './star/star-settings';

@Component({
  selector: 'app-splash-overlay',
  imports: [ExternalAnchorsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      class="splash"
      [attr.data-state]="state.status()"
      [attr.data-market]="state.marketId"
      [attr.data-model]="state.foreground()"
      [attr.data-quality]="state.quality()"
      [attr.data-triangles]="state.triangleCount()"
      [attr.data-planet]="state.planetBodyId()"
      [attr.data-planet-kind]="state.planetKind()"
      [attr.data-motion]="state.orbitPaused() ? 'orbit' : state.moving() ? 'drift' : 'still'"
      [attr.aria-label]="splashTitle()"
    >
      <div class="diagnostic" aria-label="3D model diagnostics">
        {{ tierLabel() }}
        ·
        @if (state.status() === 'ready' && state.loadDurationMs() !== null) {
          {{ t.public.splash.loadTime }} {{ (state.loadDurationMs()! / 1000).toFixed(2) }} s
        } @else if (state.status() === 'loading') {
          {{ t.public.splash.loadingTier }}
        } @else {
          {{ t.public.splash.staticTier }}
        }
        · {{ t.public.splash.planetLabel }} {{ state.planetBodyId() }}
      </div>
      @if (state.status() !== 'ready') {
        <img
          class="poster"
          [class.station-poster]="state.stationSplash()"
          [src]="state.posterUrl()"
          alt=""
          fetchpriority="high"
        />
        <div class="status" role="status" aria-live="polite">
          @if (state.status() === 'loading') {
            <p>{{ loadingMessage() }}</p>
            <progress
              max="100"
              [value]="state.loading.active() ? state.loading.progress() : null"
              [attr.aria-label]="t.public.splash.loading"
            ></progress>
            <p class="hint">{{ t.public.splash.progressHint }}</p>
            <button type="button" (click)="state.useStatic()">{{ t.public.splash.staticAction }}</button>
          } @else {
            <p>{{ state.status() === 'error' ? t.public.splash.error : t.public.splash.static }}</p>
            @if (state.supported() && !state.contextLost()) {
              <button type="button" (click)="state.retry()">{{ t.public.splash.retry }}</button>
              <button type="button" class="tier-switch" (click)="state.switchQuality(otherQuality())">
                {{ switchLabel() }}
              </button>
            }
          }
        </div>
      } @else {
        <div class="cloud-controls" (pointerdown)="$event.stopPropagation()" (wheel)="$event.stopPropagation()">
          <div class="body-picker" data-testid="splash-body-picker">
            @if (state.planetKind() !== 'black-hole') {
            <label for="splash-foreground">{{ t.public.splash.foregroundLabel }}</label>
            <select id="splash-foreground" [value]="state.foreground()" (change)="onForeground($event)">
              <option value="asteroid-mining-rig">{{ t.public.splash.foregroundMiningRig }}</option>
              <option value="station">{{ t.public.splash.station.title }}</option>
            </select>
            }
            <label for="splash-body-category">{{ t.public.splash.bodyCategoryLabel }}</label>
            <select id="splash-body-category" (change)="onCategory($event)">
              @for (category of categories; track category) {
                <option [value]="category" [selected]="state.pickerCategory() === category">{{ categoryLabel(category) }}</option>
              }
            </select>
            @if (state.pickerCategory() !== 'random') {
              <label for="splash-body">{{ t.public.splash.bodyLabel }}</label>
              <select id="splash-body" (change)="onBody($event)">
                <option value="random" [selected]="state.pickerBody() === 'random'">{{ t.public.splash.bodyRandom }}</option>
                @for (entry of categoryEntries(); track entry.id) {
                  <option [value]="entry.id" [selected]="state.pickerBody() === entry.id">{{ bodyLabel(entry) }}</option>
                }
              </select>
            }
            <button type="button" class="shuffle" [disabled]="state.bodySwapping()" (click)="state.reroll()">
              {{ t.public.splash.bodyShuffle }}
            </button>
            <p class="current-body" data-testid="splash-current-body" aria-live="polite">
              {{ t.public.splash.bodyCurrent }}: {{ bodyLabel(state.planet()) }}
              @if (state.bodySwapping()) {
                <span class="swapping">? {{ t.public.splash.bodyLoading }}</span>
              }
            </p>
            @if (state.bodySwapError()) {
              <p class="swap-error" role="alert" data-testid="splash-body-error">
                {{ t.public.splash.bodyLoadError }}
              </p>
            }
          </div>
          @if (state.planetKind() === 'gas-giant') {
            <label for="splash-giant-palette">{{ t.public.splash.gasGiantPaletteLabel }}</label>
            <select id="splash-giant-palette" [value]="giants.palette()" (change)="onGiantPalette($event)">
              <option value="seeded">{{ t.public.splash.gasGiantPaletteSeeded }}</option>
              <option value="jovian">{{ t.public.splash.gasGiantPaletteJovian }}</option>
              <option value="saturnian">{{ t.public.splash.gasGiantPaletteSaturnian }}</option>
              <option value="ice">{{ t.public.splash.gasGiantPaletteIce }}</option>
            </select>
            <label for="splash-giant-rings">{{ t.public.splash.gasGiantRingsLabel }}</label>
            <select id="splash-giant-rings" [value]="giants.rings()" (change)="onGiantRings($event)">
              <option value="seeded">{{ t.public.splash.gasGiantRingsSeeded }}</option>
              <option value="on">{{ t.public.splash.gasGiantRingsOn }}</option>
              <option value="off">{{ t.public.splash.gasGiantRingsOff }}</option>
            </select>
            <label for="splash-storm-activity">
              {{ t.public.splash.stormActivityLabel }}: {{ clouds.stormActivity() }}%
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
          } @else if (state.planetKind() === 'star') {
            <p class="star-class" data-testid="splash-star-class">
              {{ t.public.splash.starSpectralClassLabel }}: {{ starClassLabel() }}
            </p>
            <label for="splash-star-spectral-class">{{ t.public.splash.starClassSelectLabel }}</label>
            <select id="splash-star-spectral-class" [value]="stars.spectralClass()" (change)="onStarClass($event)">
              <option value="seeded">{{ t.public.splash.starClassSeeded }}</option>
              @for (spectralClass of starClasses; track spectralClass) {
                <option [value]="spectralClass">{{ spectralClass }}</option>
              }
            </select>
            <label for="splash-flare-activity">
              {{ t.public.splash.starFlareActivityLabel }}: {{ stars.flareActivity() }}%
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
          } @else if (state.planetKind() === 'terran' || hasSolClouds()) {
            <label class="cloud-toggle">
              <input type="checkbox" [checked]="clouds.enabled()" (change)="onCloudToggle($event)" />
              {{ t.public.splash.cloudsLabel }}
            </label>
            <label for="splash-cloud-style">{{ t.public.splash.cloudStyleLabel }}</label>
            <select
              id="splash-cloud-style"
              [value]="clouds.style()"
              [disabled]="!clouds.enabled()"
              (change)="onCloudStyle($event)"
            >
              <option value="thin">{{ t.public.splash.thinCloudsLabel }}</option>
              <option value="thick">{{ t.public.splash.thickCloudsLabel }}</option>
            </select>
            <label for="splash-cloud-coverage">
              {{ t.public.splash.cloudCoverageLabel }}: {{ clouds.coverage() }}%
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
              {{ t.public.splash.stormActivityLabel }}: {{ clouds.stormActivity() }}%
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
          @if (solCredit(); as credit) {
            <p class="credit" data-testid="splash-body-credit">{{ t.public.splash.bodyCreditLabel }}: {{ credit }}</p>
          }
          @if (state.planetBodyId() === 'sol-saturn') {
            <app-external-anchors [anchors]="saturnSources" layout="stack" />
          }
          @if (state.planetKind() === 'black-hole') {
            <label class="cloud-toggle">
              <input type="checkbox" [checked]="state.stellarWind()" (change)="onStellarWind($event)" />
              {{ t.public.splash.stellarWindLabel }}
            </label>
            <p class="credit">{{ t.public.splash.stellarWindNote }}</p>
            <p class="credit" data-testid="splash-black-hole-note">{{ t.public.splash.blackHoleNote }}</p>
            <app-external-anchors [anchors]="blackHoleSources" layout="stack" />
          }
        </div>
        <div class="caption">
          <span>
            {{ splashTitle() }}
            <small>{{ t.public.splash.orbitHint }}</small>
          </span>
          <span class="actions">
            <button type="button" class="tier-switch" (click)="state.switchQuality(otherQuality())">
              {{ switchLabel() }}
            </button>
            <button type="button" (click)="state.useStatic()">{{ t.public.splash.staticAction }}</button>
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
    .splash[data-model='station'][data-state='static'] {
      background: #040914;
    }
    .poster {
      width: 100%;
      height: 100%;
      object-fit: cover;
      background: #050b16;
    }
    .poster.station-poster {
      object-fit: contain;
      background: transparent;
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
    .star-class,
    .current-body,
    .swap-error,
    .credit {
      margin: 0;
    }
    .body-picker {
      display: grid;
      gap: 0.35rem;
      padding-bottom: 0.45rem;
      border-bottom: 1px solid #415269;
    }
    .body-picker .shuffle {
      justify-self: start;
    }
    .body-picker .shuffle:disabled {
      cursor: progress;
      opacity: 0.6;
    }
    .swapping {
      color: #b9c9de;
    }
    .swap-error {
      color: #ffb4a8;
    }
    .credit {
      max-width: 14rem;
      font-size: 0.65rem;
      color: #b9c9de;
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
export class SplashOverlay {
  protected readonly state = inject(SplashState);
  protected readonly clouds = inject(PlanetCloudSettings);
  protected readonly giants = inject(GasGiantSettings);
  protected readonly stars = inject(StarSettings);
  protected readonly starClasses = SPLASH_STAR_CLASSES;
  protected readonly starClassLabel = computed(
    () =>
      resolveSpectralClass(resolveStarSpectralClassChoice(this.stars.spectralClass(), this.state.planetSpectralClass()))
        .label,
  );
  protected readonly t = locale;
  protected readonly splashTitle = computed(() =>
    this.state.planetKind() === 'black-hole'
      ? this.t.public.splash.bodyBlackHole
      : this.state.stationSplash() ? this.t.public.splash.station.title : this.t.public.splash.title,
  );
  protected readonly loadingMessage = computed(() =>
    this.state.stationSplash() ? this.t.public.splash.station.loading : this.t.public.splash.loading,
  );
  protected readonly tierLabel = computed(() => {
    if (this.state.planetKind() === 'black-hole') {
      const budget = BLACK_HOLE_SPLASH_QUALITY[this.state.quality()];
      return this.t.public.splash.blackHoleTier
        .replace('{width}', String(budget.resolution))
        .replace('{height}', String(Math.round(budget.resolution * 5 / 6)))
        .replace('{steps}', String(budget.traceSteps));
    }
    if (this.state.stationSplash()) {
      return this.t.public.splash.station.tier.replace(
        '{triangles}',
        this.state.triangleCount().toLocaleString(),
      );
    }
    return this.state.quality() === 'standard' ? this.t.public.splash.standardTier : this.t.public.splash.lowTier;
  });
  protected readonly categories = SPLASH_PICKER_CATEGORIES;
  protected readonly blackHoleSources = CYGNUS_X1_REFERENCES.map((link) => ({
    ...link, ariaLabel: link.text, showOrb: false,
  }));
  protected readonly saturnSources = SATURN_REFERENCE_LINKS.map((link) => ({
    ...link, ariaLabel: link.text, showOrb: false,
  }));
  protected readonly categoryEntries = computed(() => splashEntriesForCategory(this.state.pickerCategory()));
  protected readonly hasSolClouds = computed(() => {
    const entry = this.state.planet();
    return entry.kind === 'sol' && solBodyHasClouds(entry.solKey);
  });
  protected readonly solCredit = computed(() => {
    const entry = this.state.planet();
    if (entry.kind !== 'sol' || !entry.solKey) return null;
    if (entry.solKey === 'venus') return this.t.game.viewer.venusAtmosphereCredit;
    if (entry.solKey === 'titan') return this.t.game.viewer.titanAtmosphereCredit;
    if (entry.solKey === 'saturn') return this.t.game.viewer.saturnAppearanceCredit;
    return resolveCatalogPlanetSurfaceAsset({ namespace: 'sol', key: entry.solKey })?.credit ?? null;
  });

  protected categoryLabel(category: SplashPickerCategory): string {
    return this.t.public.splash.bodyCategories[category];
  }

  protected bodyLabel(entry: SplashPlanetEntry): string {
    const labels = this.t.public.splash;
    if (entry.kind === 'black-hole') return labels.bodyBlackHole;
    if (entry.kind === 'sol' && entry.solKey) return labels.solBodies[entry.solKey];
    if (entry.kind === 'star') return `${labels.bodyStar} ${entry.spectralClass ?? entry.id}`;
    const number = /(\d+)$/.exec(entry.id)?.[1];
    if (entry.kind === 'gas-giant') return number ? `${labels.bodyGiant} ${number}` : entry.id;
    if (entry.kind === 'icy-moon') return number ? `${labels.bodyIcyMoon} ${number}` : entry.id;
    if (entry.kind === 'rocky-moon') return number ? `${labels.bodyRockyMoon} ${number}` : entry.id;
    if (entry.id === SPLASH_PLANET_BODY_ID) return labels.bodyHomeworld;
    return number ? `${labels.bodyWorld} ${number}` : entry.id;
  }

  protected onForeground(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    const value = target.value;
    if (value !== 'asteroid-mining-rig' && value !== 'station') throw new Error(`Unknown splash foreground: ${value}`);
    this.state.chooseForeground(value);
  }

  protected onStellarWind(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) this.state.stellarWind.set(target.checked);
  }

  protected onCategory(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    if (!isSplashPickerCategory(target.value)) throw new Error(`Unknown splash body category: ${target.value}`);
    this.state.chooseCategory(target.value);
  }

  protected onBody(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLSelectElement) this.state.chooseBody(target.value);
  }

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
  protected readonly otherQuality = computed<SplashQuality>(() =>
    this.state.quality() === 'standard' ? 'low' : 'standard',
  );
  protected readonly switchLabel = computed(() => {
    const quality = this.otherQuality();
    if (this.state.planetKind() === 'black-hole') {
      return quality === 'standard'
        ? this.t.public.splash.blackHoleSwitchToStandard
        : this.t.public.splash.blackHoleSwitchToLow;
    }
    const label = quality === 'standard' ? this.t.public.splash.switchToStandard : this.t.public.splash.switchToLow;
    return label.replace('{triangles}', this.state.assetForQuality(quality).triangleCount.toLocaleString());
  });
}
