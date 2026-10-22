import { ChangeDetectionStrategy, Component, computed, DestroyRef, ElementRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { NgtCanvas } from 'angular-three/dom';
import { NgtsStats } from 'angular-three-soba/stats';
import { locale } from '../../i18n/locale';
import type { ViewerBody } from '../../model/solar-system-get';
import type { SolarSystemSummary } from '../../model/solar-system-list';
import { CatalogSurfaceCache } from '../../scene/planet/catalog-surface-cache';
import type { StationModelStatus } from '../../scene/station/station-model';
import { hasDedicatedStationModel, STATION_MODELS } from '../../scene/station/station-model-assets';
import { StationViewScene } from '../../scene/station/station-view-scene';
import { appLogger } from '../../services/logger';
import { MarketService } from '../../services/market.service';
import { SessionService } from '../../services/session.service';
import { ShipService } from '../../services/ship.service';
import { SocketService } from '../../services/socket.service';
import { SolarSystemService } from '../../services/solar-system.service';
import { resolveNavigationState } from '../navigation-state';
import { ViewerDataFacade } from './viewer-data-facade';

interface StationViewNavigationState {
  playerName?: string;
  solarSystem?: SolarSystemSummary;
  bodies?: ViewerBody[];
}

@Component({
  selector: 'app-station-view-page',
  template: `
    <section class="station-view" [attr.aria-label]="t.game.viewer.stationViewTitle">
      <header>
        <h2>{{ selectedBody()?.displayName ?? t.game.viewer.stationViewTitle }}</h2>
        <button type="button" (click)="exitToViewer()">{{ t.game.viewer.closeupBack }}</button>
      </header>
      @if (sceneError()) {
        <p role="alert" data-testid="station-view-error">{{ sceneError() }}</p>
      } @else if (selectedBody(); as body) {
        <ngt-canvas [stats]="persistentStatsOptions" [camera]="{ position: [3.5, 2.6, 5], fov: 48 }" [lookAt]="[0, 0, 0]">
          <app-station-view-scene
            *canvasContent
            [bodyId]="body.id"
            [quality]="quality()"
            [attempt]="attempt()"
            (statusChange)="modelStatus.set($event)"
          />
        </ngt-canvas>
        <p
          class="model-status"
          data-testid="station-view-status"
          [attr.data-state]="modelStatus()?.state ?? 'loading'"
          [attr.data-quality]="quality()"
          [attr.role]="modelStatus()?.state === 'error' ? 'alert' : 'status'"
        >
          @if (modelStatus()?.state === 'error') {
            {{ t.game.viewer.stationModelError }}
            <button type="button" (click)="retryModel()">{{ t.game.viewer.stationModelRetry }}</button>
          } @else if (modelStatus()?.state !== 'ready') {
            {{ t.game.viewer.stationModelLoading }}
          }
        </p>
        <p class="hint">{{ t.game.viewer.stationViewHint }}</p>
      } @else {
        <p role="status">{{ t.game.viewer.sceneLoadingStatus }}</p>
      }
    </section>
  `,
  styles: `
    :host {
      display: block;
      position: absolute;
      inset: 0;
    }
    .station-view {
      height: 100%;
      background: #040914;
      color: #edf4ff;
      position: relative;
    }
    ngt-canvas {
      display: block;
      width: 100%;
      height: 100%;
    }
    header {
      position: absolute;
      top: 1rem;
      left: 1rem;
      right: 1rem;
      z-index: 1;
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      align-items: center;
    }
    h2 {
      margin: 0;
      font-size: 1rem;
    }
    button {
      min-height: 44px;
      border: 1px solid #879bb7;
      border-radius: 0.25rem;
      padding: 0.4rem 0.7rem;
      color: #edf4ff;
      background: #0d1b2c;
      cursor: pointer;
    }
    button:focus-visible {
      outline: 2px solid #eff7ff;
      outline-offset: 2px;
    }
    .model-status {
      position: absolute;
      top: 4rem;
      left: 1rem;
    }
    .hint {
      position: absolute;
      bottom: 1rem;
      left: 1rem;
      pointer-events: none;
    }
    p[role='alert'] {
      color: #ffb4a8;
    }
  `,
  imports: [NgtCanvas, NgtsStats, StationViewScene],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class StationViewPage {
  protected readonly persistentStatsOptions = { parent: inject(ElementRef), domClass: 'stats' };
  protected readonly t = locale;
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly session = inject(SessionService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly navigationState = resolveNavigationState<StationViewNavigationState>(this.router);
  protected readonly quality = inject(CatalogSurfaceCache).quality;
  protected readonly solarSystemId = signal<string | null>(null);
  protected readonly bodyId = signal<string | null>(null);
  protected readonly bodies = signal<ViewerBody[]>(this.navigationState.bodies ?? []);
  protected readonly sceneError = signal<string | null>(null);
  protected readonly modelStatus = signal<StationModelStatus | null>(null);
  protected readonly attempt = signal(0);
  protected readonly selectedBody = computed(() => {
    const body = this.bodies().find((candidate) => candidate.id === this.bodyId());
    return body && hasDedicatedStationModel(body) ? body : null;
  });
  private readonly facade = new ViewerDataFacade({
    solarSystemService: inject(SolarSystemService),
    marketService: inject(MarketService),
    shipService: inject(ShipService),
    socketService: inject(SocketService),
    getPlayerName: () => this.navigationState.playerName ?? this.session.playerName() ?? '',
    getSessionKey: () => this.session.getSessionKey(),
    getActiveCharacterId: () => null,
    getCurrentSolarSystemId: () => this.solarSystemId(),
    getBodies: () => this.bodies(),
    setSolarSystem: () => undefined,
    setBodies: (bodies) => {
      this.bodies.set(bodies);
      // The system response can precede market hydration, so absence is not yet a failure.
      if (bodies.some((body) => body.id === this.bodyId()) && !this.selectedBody()) {
        this.sceneError.set(this.t.game.viewer.stationViewUnavailable);
      }
    },
    setShips: () => undefined,
    setIsLoading: () => undefined,
    setSceneError: (error) => this.sceneError.set(error),
    resetSelectionState: () => undefined,
    onBodiesResolved: (error) => {
      if (error) {
        appLogger.error('Station view could not resolve market stations.', error);
        this.sceneError.set(`${this.t.game.viewer.sceneErrorPrefix} ${error}`);
      } else if (!this.selectedBody()) {
        this.sceneError.set(this.t.game.viewer.stationViewUnavailable);
      }
    },
  });

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.solarSystemId.set(params.get('solarSystemId'));
      this.bodyId.set(params.get('bodyId'));
      this.modelStatus.set(null);
      this.sceneError.set(null);
      const systemId = this.solarSystemId();
      if (!systemId || STATION_MODELS[this.bodyId() ?? '']?.solarSystemId !== systemId) {
        this.sceneError.set(this.t.game.viewer.stationViewUnavailable);
      } else if (!this.selectedBody()) {
        this.facade.loadSystem(systemId);
      }
    });
    this.destroyRef.onDestroy(() => {
      this.solarSystemId.set(null);
      this.facade.dispose();
    });
  }

  protected retryModel(): void {
    this.attempt.update((attempt) => attempt + 1);
  }

  protected exitToViewer(): void {
    const systemId = this.solarSystemId();
    if (!systemId) return;
    void this.router
      .navigate([{ outlets: { right: ['viewer-scene', systemId] } }], {
        preserveFragment: true,
        state: {
          playerName: this.navigationState.playerName ?? this.session.playerName(),
          solarSystem: this.navigationState.solarSystem,
        },
      })
      .then((navigated) => {
        if (!navigated) appLogger.warn('Station return navigation was cancelled.', { systemId });
      })
      .catch((error: unknown) => appLogger.error('Station return navigation failed.', error));
  }
}
