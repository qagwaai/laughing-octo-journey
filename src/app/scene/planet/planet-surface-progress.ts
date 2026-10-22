/**
 * Progress readout for background planet-surface baking.
 *
 * Both the system view and the detail view need this, and both drive it from
 * the same cache, so it owns its own state rather than being wired up twice.
 */
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ExternalAnchorsComponent } from '../../component/external-anchors';
import { locale } from '../../i18n/locale';
import { SATURN_REFERENCE_LINKS } from '../../model/planet/saturn-profile';
import type { CatalogTextureVariant } from './catalog-surface-loader';
import type { CatalogPlanetSurfaceAsset } from './planet-surface-catalog';
import { PlanetTextureCache } from './planet-texture-cache';

@Component({
  selector: 'app-planet-surface-progress',
  imports: [ExternalAnchorsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.surface-progress-embedded]': 'embedded()' },
  template: `
    @if (baking()) {
      <div
        class="surface-progress"
        role="status"
        data-testid="viewer-surface-progress"
        [attr.data-progress]="planetTextures.proceduralPending() > 0 ? percent() : null"
      >
        @if (planetTextures.proceduralPending() > 0) {
          <span class="surface-progress__label">{{ t.game.viewer.surfaceBakeStatus }}</span>
          <progress
            class="surface-progress__bar"
            max="100"
            [value]="percent()"
            [attr.aria-label]="t.game.viewer.surfaceBakeStatus"
          ></progress>
        }
        @if (planetTextures.catalog.pending() > 0) {
          <span>{{ t.game.viewer.surfaceCatalogLoading }} {{ planetTextures.catalog.pending() }}</span>
        }
      </div>
    }
    @if (catalogAssets().length > 0 || atmosphereSources().length > 0) {
      <div class="surface-notices">
        @if (planetTextures.catalog.issues().length > 0) {
          <div class="surface-notice surface-notice--error" role="alert" data-testid="viewer-surface-error">
            <span>{{ t.game.viewer.surfaceCatalogFailure }}</span>
            @for (issue of planetTextures.catalog.issues(); track issue.request.key) {
              <span>{{ issue.request.bodyId }} · {{ issue.request.asset.assetVersion }}</span>
            }
            @if (planetTextures.catalog.canRetry()) {
              <button type="button" (click)="planetTextures.catalog.retryActive()" data-testid="viewer-surface-retry">
                {{ t.game.viewer.surfaceCatalogRetry }}
              </button>
            }
          </div>
        }
        <details class="surface-notice surface-notice--sources" data-testid="viewer-surface-sources">
          <summary>{{ t.game.viewer.surfaceCatalogSources }}</summary>
          @for (asset of catalogAssets(); track asset.assetVersion) {
            <section [attr.data-asset-version]="asset.assetVersion">
              <strong>{{ asset.assetVersion }}</strong>
              @for (request of planetTextures.catalog.active(); track request.key) {
                @if (
                  request.asset.assetVersion === asset.assetVersion && planetTextures.catalog.ready().has(request.key)
                ) {
                  <span class="surface-variant" [attr.data-surface-variant]="request.variant">
                    {{ variantLabel(request.variant) }}
                  </span>
                }
              }
              <p>{{ asset.credit }}</p>
              @for (citation of asset.citations; track citation) {
                <p>{{ citation }}</p>
              }
              <p>{{ coverage(asset) }}</p>
              <app-external-anchors [anchors]="sourceAnchors(asset)" layout="stack" />
            </section>
          }
          @if (atmosphereSources().length > 0) {
            <h3>{{ t.game.viewer.atmosphereSourcesTitle }}</h3>
            @for (source of atmosphereSources(); track source.bodyId) {
              <section [attr.data-atmosphere-source]="source.bodyId">
                <strong>{{ source.bodyName }}</strong>
                <p>{{ source.credit }}</p>
                <p>{{ source.notes }}</p>
                @if (source.links.length > 0) {
                  <app-external-anchors [anchors]="source.links" layout="stack" />
                }
              </section>
            }
          }
          <p>{{ t.game.viewer.surfaceCatalogPendingReview }}</p>
        </details>
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

      .surface-notices {
        position: absolute;
        bottom: 4.5rem;
        left: 1rem;
        max-width: min(26rem, calc(100% - 2rem));
        max-height: 40%;
        overflow: auto;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        z-index: 11;
      }
      :host-context(.planet-view-host) .surface-notices {
        top: 5.5rem;
        right: 4.9rem;
        bottom: auto;
        left: auto;
        max-width: min(22rem, calc(100% - 6rem));
        max-height: calc(100% - 12rem);
      }
      .surface-notice {
        padding: 0.5rem 0.75rem;
        background: rgba(6, 12, 24, 0.9);
        color: #cfe4ff;
        border: 1px solid #526b86;
        border-radius: 0.5rem;
        font-size: 0.75rem;
      }
      .surface-notice--error {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
        border-color: #e8aa70;
      }
      summary,
      button {
        cursor: pointer;
      }
      button {
        padding: 0.35rem;
        border: 1px solid #a0c4e8;
        border-radius: 0.25rem;
      }
      section {
        margin: 0.75rem 0;
      }
      .surface-variant {
        margin-left: 0.5rem;
      }
      p {
        margin: 0.4rem 0;
      }

      :host(.surface-progress-embedded) {
        display: block;
      }
      :host(.surface-progress-embedded) .surface-progress,
      :host(.surface-progress-embedded) .surface-notices {
        position: static;
        transform: none;
        max-width: none;
        max-height: none;
        overflow: visible;
        margin-top: 0.5rem;
      }
      :host(.surface-progress-embedded) .surface-notices {
        margin-top: 0;
      }
      :host(.surface-progress-embedded) .surface-notice--sources {
        padding: 0.45rem 0;
        border: 0;
        border-top: 1px solid rgba(162, 210, 255, 0.18);
        border-radius: 0;
        background: transparent;
        font-size: inherit;
      }
      summary:focus-visible {
        outline: 2px solid #eff7ff;
        outline-offset: 2px;
      }
    `,
  ],
})
export class PlanetSurfaceProgress {
  readonly embedded = input(false);
  protected readonly t = locale;
  protected readonly planetTextures = inject(PlanetTextureCache);

  protected readonly baking = this.planetTextures.isBaking;
  protected readonly percent = computed(() => Math.round(this.planetTextures.progress() * 100));
  protected readonly atmosphereSources = computed(() => [
    {
      bodyId: 'sol-saturn',
      bodyName: this.t.public.splash.solBodies.saturn,
      credit: this.t.game.viewer.saturnAppearanceCredit,
      notes: this.t.game.viewer.saturnAppearanceNotes,
      links: SATURN_REFERENCE_LINKS.map((link) => ({ ...link, ariaLabel: link.text, showOrb: false })),
    },
    {
      bodyId: 'venus',
      bodyName: 'Venus',
      credit: this.t.game.viewer.venusAtmosphereCredit,
      notes: this.t.game.viewer.venusAtmosphereNotes,
      links: [
        {
          href: 'https://www.solarsystemscope.com/textures/',
          text: this.t.game.viewer.venusAtmosphereSourceLink,
          ariaLabel: this.t.game.viewer.venusAtmosphereSourceLink,
          showOrb: false,
        },
        {
          href: 'https://creativecommons.org/licenses/by/4.0/',
          text: this.t.game.viewer.atmosphereLicenseLink,
          ariaLabel: this.t.game.viewer.atmosphereLicenseLink,
          showOrb: false,
        },
      ],
    },
    {
      bodyId: 'titan',
      bodyName: 'Titan',
      credit: this.t.game.viewer.titanAtmosphereCredit,
      notes: this.t.game.viewer.titanAtmosphereNotes,
      links: [],
    },
  ]);
  protected readonly catalogAssets = computed(() => [
    ...new Map(
      this.planetTextures.catalog.active().map((request) => [request.asset.assetVersion, request.asset]),
    ).values(),
  ]);
  protected coverage(asset: CatalogPlanetSurfaceAsset): string {
    switch (asset.identity.key) {
      case 'earth':
        return this.t.game.viewer.surfaceCatalogEarthCoverage;
      case 'luna':
        return this.t.game.viewer.surfaceCatalogLunaCoverage;
      case 'io':
        return this.t.game.viewer.surfaceCatalogIoCoverage;
      default:
        return this.t.game.viewer.surfaceCatalogMarsCoverage;
    }
  }
  protected sourceAnchors(asset: CatalogPlanetSurfaceAsset) {
    return asset.sourceLinks.map((link) => ({ ...link, ariaLabel: link.text, showOrb: false }));
  }
  protected variantLabel(variant: CatalogTextureVariant): string {
    switch (variant) {
      case 'preview':
        return this.t.game.viewer.surfaceCatalogPreview;
      case 'low':
        return this.t.game.viewer.surfaceCatalogLow;
      case 'standard':
        return this.t.game.viewer.surfaceCatalogStandard;
    }
  }
}
