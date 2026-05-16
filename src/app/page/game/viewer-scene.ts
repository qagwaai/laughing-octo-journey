import { ChangeDetectionStrategy, Component, computed, inject, signal, CUSTOM_ELEMENTS_SCHEMA, OnDestroy } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { NgtCanvas } from 'angular-three/dom';
import { locale } from '../../i18n/locale';
import { isValidShipSpatial } from '../../model/math/spatial';
import type { ViewerBody } from '../../model/solar-system-get';
import type { SolarSystemSummary } from '../../model/solar-system-list';
import type { ShipSummary } from '../../model/ship-list';
import { MarketService } from '../../services/market.service';
import { SessionService } from '../../services/session.service';
import { ShipService } from '../../services/ship.service';
import { SocketService } from '../../services/socket.service';
import { SolarSystemService } from '../../services/solar-system.service';
import { ViewerTargetService } from '../../services/viewer-target.service';
import { ViewerSystemScene } from '../../scene/viewer/viewer-system-scene';
import type { ViewerSystemSceneInputs } from '../../scene/viewer/viewer-system-scene';
import { ViewerDataFacade } from './viewer-data-facade';
import { resolveNavigationState } from '../navigation-state';

interface ViewerSceneNavigationState {
  playerName?: string;
  solarSystemId?: string;
  solarSystem?: SolarSystemSummary;
}

@Component({
  selector: 'app-viewer-scene-page',
  templateUrl: './viewer-scene.html',
  styleUrls: ['./viewer-scene.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgtCanvas, ViewerSystemScene],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
/**
 * Right-pane host for the Angular Three Viewer scene. Hosts `<ngt-canvas>`
 * (so child scene components have an `NgtStore`) and feeds the inner scene
 * the {@link ViewerBody} list resolved from the backend's
 * `solar-system-get-response`.
 */
export default class ViewerScenePage implements OnDestroy {
  protected readonly t = locale;
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private sessionService = inject(SessionService);
  private solarSystemService = inject(SolarSystemService);
  private marketService = inject(MarketService);
  private shipService = inject(ShipService);
  private socketService = inject(SocketService);

  private navigationState: ViewerSceneNavigationState = resolveNavigationState<ViewerSceneNavigationState>(this.router);

  protected playerName = signal<string>(this.navigationState.playerName ?? '');
  protected solarSystem = signal<SolarSystemSummary | null>(this.navigationState.solarSystem ?? null);
  protected solarSystemId = signal<string | null>(null);
  protected bodies = signal<ViewerBody[]>([]);
  protected ships = signal<ShipSummary[]>([]);
  protected hoveredBody = signal<ViewerBody | null>(null);
  protected focusedPlanet = signal<ViewerBody | null>(null);
  protected isLoading = signal(false);
  protected sceneError = signal<string | null>(null);
  protected isPlanetTransitioning = signal(false);
  protected zoomLevel = signal<number>(78);

  protected zoomPercent = computed<number>(() => Math.round(this.zoomLevel()));

  protected hasSystem = computed(() => this.solarSystemId() !== null);

  /** True when at least one ship in the active list has missing/invalid spatial state. */
  protected hasUnknownSpatialShip = computed<boolean>(() => this.ships().some((s) => !isValidShipSpatial(s.spatial)));

  /** Inputs forwarded to `<app-viewer-system-scene *canvasContent />`. */
  private viewerTargetService = inject(ViewerTargetService);

  private readonly viewerDataFacade = new ViewerDataFacade({
    solarSystemService: this.solarSystemService,
    marketService: this.marketService,
    shipService: this.shipService,
    socketService: this.socketService,
    getPlayerName: () => this.playerName(),
    getSessionKey: () => this.sessionService.getSessionKey(),
    getActiveCharacterId: () => this.sessionService.activeCharacter()?.id ?? null,
    getCurrentSolarSystemId: () => this.solarSystemId(),
    getBodies: () => this.bodies(),
    setSolarSystem: (solarSystem: SolarSystemSummary | null) => this.solarSystem.set(solarSystem),
    setBodies: (bodies: ViewerBody[]) => this.bodies.set(bodies),
    setShips: (ships: ShipSummary[]) => this.ships.set(ships),
    setIsLoading: (value: boolean) => this.isLoading.set(value),
    setSceneError: (value: string | null) => this.sceneError.set(value),
    resetSelectionState: () => {
      this.hoveredBody.set(null);
      this.focusedPlanet.set(null);
    },
  });

  protected sceneInputs = computed<ViewerSystemSceneInputs>(() => ({
    bodies: this.bodies(),
    summary: this.solarSystem(),
    targetBodyId: this.viewerTargetService.targetBodyId(),
    ships: this.ships(),
    activeShipId: this.sessionService.activeShip()?.id ?? null,
  }));


  private planetTransitionTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    // Subscribe to route param changes
    this.route.paramMap.subscribe(params => {
      const id = params.get('solarSystemId');
      this.solarSystemId.set(id);
      if (id) {
        this.loadSystem();
      }
    });
  }

  protected loadSystem(): void {
    const solarSystemId = this.solarSystemId();
    if (!solarSystemId) {
      this.sceneError.set(this.t.game.viewer.sceneErrorPrefix + ' missing-session');
      return;
    }

    this.viewerDataFacade.loadSystem(solarSystemId);
  }

  ngOnDestroy(): void {
    this.viewerDataFacade.dispose();
    if (this.planetTransitionTimer !== null) {
      clearTimeout(this.planetTransitionTimer);
      this.planetTransitionTimer = null;
    }
  }

  protected onHoveredBodyChange(body: ViewerBody | null): void {
    this.hoveredBody.set(body);
  }

  protected onFocusedPlanetChange(body: ViewerBody | null): void {
    this.focusedPlanet.set(body);
  }

  protected onPlanetViewRequest(body: ViewerBody): void {
    const solarSystemId = this.solarSystemId();
    if (!solarSystemId || this.isPlanetTransitioning()) {
      return;
    }

    this.isPlanetTransitioning.set(true);
    this.planetTransitionTimer = setTimeout(() => {
      this.router.navigate([{ outlets: { right: ['planet-view', solarSystemId, body.id] } }], {
        preserveFragment: true,
        state: {
          playerName: this.playerName(),
          solarSystem: this.solarSystem(),
          bodies: this.bodies(),
        },
      });
      this.planetTransitionTimer = null;
    }, 140);
  }

  protected onZoomChange(value: string | number): void {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return;
    }

    this.zoomLevel.set(Math.max(0, Math.min(100, parsed)));
  }

  protected onWheel(event: WheelEvent): void {
    if (!this.hasSystem()) {
      return;
    }

    event.preventDefault();

    // deltaMode 0 = pixels (~100 per notch), 1 = lines, 2 = pages.
    // Scroll up (negative deltaY) decreases zoom level → camera moves closer.
    const STEP_PER_LINE = 5;
    const delta = event.deltaMode === 0
      ? (event.deltaY / 100) * STEP_PER_LINE
      : event.deltaY * STEP_PER_LINE;

    this.onZoomChange(this.zoomLevel() + delta);
  }

  protected onZoomInput(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    this.onZoomChange(target.value);
  }

  protected onZoomContextMenu(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  protected onZoomPointerDown(event: PointerEvent): void {
    if (event.button !== 2) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
  }

  protected onZoomPointerUp(event: PointerEvent): void {
    if (event.button !== 2) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
  }

  protected onZoomMouseDown(event: MouseEvent): void {
    if (event.button !== 2) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
  }

  protected onZoomMouseUp(event: MouseEvent): void {
    if (event.button !== 2) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
  }

  protected onZoomAuxClick(event: MouseEvent): void {
    if (event.button !== 2) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
  }

}
