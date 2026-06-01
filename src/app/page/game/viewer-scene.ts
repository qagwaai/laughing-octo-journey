import { ChangeDetectionStrategy, Component, computed, inject, signal, CUSTOM_ELEMENTS_SCHEMA, OnDestroy } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { NgtCanvas } from 'angular-three/dom';
import { locale } from '../../i18n/locale';
import {
  EXTERNAL_OBJECT_SCHEMA_VERSION,
  type ExternalObjectDescriptor,
  type ExternalObjectDomain,
} from '../../model/external-object-descriptor';
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
import {
  resolveDescriptorRenderProfile,
  resolveGateApproachMetadata,
  type DescriptorRenderProfile,
  type GateApproachMetadata,
} from '../../scene/viewer/viewer-descriptor-selectors';
import { ViewerDataFacade } from './viewer-data-facade';
import { resolveNavigationState } from '../navigation-state';
import { environment } from '../../../environments/environment';

interface ViewerSceneNavigationState {
  playerName?: string;
  solarSystemId?: string;
  solarSystem?: SolarSystemSummary;
}

function normalizeToken(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? '';
}

function parseBooleanQueryFlag(value: string | null): boolean | null {
  if (value === null) {
    return null;
  }

  const normalized = normalizeToken(value);
  if (normalized === '1' || normalized === 'true' || normalized === 'on' || normalized === 'yes') {
    return true;
  }
  if (normalized === '0' || normalized === 'false' || normalized === 'off' || normalized === 'no') {
    return false;
  }

  return null;
}

function inferShipFamily(model: string | undefined): string {
  const normalizedModel = normalizeToken(model);
  if (normalizedModel.includes('frigate')) {
    return 'frigate';
  }
  if (normalizedModel.includes('hauler') || normalizedModel.includes('cargo')) {
    return 'hauler';
  }
  if (normalizedModel.includes('interceptor') || normalizedModel.includes('fighter')) {
    return 'interceptor';
  }
  if (normalizedModel.includes('industrial') || normalizedModel.includes('miner')) {
    return 'industrial';
  }
  return 'scout';
}

function createViewerQaDescriptor(
  id: string,
  domain: ExternalObjectDomain,
  objectFamily: string,
  label: string,
): ExternalObjectDescriptor {
  return {
    descriptorId: `qa-${domain}-${id}`,
    schemaVersion: EXTERNAL_OBJECT_SCHEMA_VERSION,
    domain,
    objectFamily,
    roleCue: 'qa-manual-test',
    factionCue: 'neutral',
    fallbackTier: 'hero',
    displayLabel: label,
    silhouetteProfile: 'qa-hero',
    materialProfile: 'qa-hero',
    emissiveProfile: 'qa-hero',
  };
}

function toForceHeroViewerBody(body: ViewerBody): ViewerBody {
  if (body.externalObjectDescriptor) {
    return {
      ...body,
      externalObjectDescriptor: {
        ...body.externalObjectDescriptor,
        fallbackTier: 'hero',
      },
    };
  }

  const bodyType = normalizeToken(body.bodyType);
  if (bodyType === 'asteroid') {
    return {
      ...body,
      externalObjectDescriptor: createViewerQaDescriptor(body.id, 'asteroids', 'cinematic-hero', body.displayName),
    };
  }

  if (bodyType === 'debris') {
    return {
      ...body,
      externalObjectDescriptor: createViewerQaDescriptor(body.id, 'debris', 'field-shard', body.displayName),
    };
  }

  if (bodyType === 'gate' || bodyType === 'jump-gate' || bodyType === 'jumpgate') {
    return {
      ...body,
      externalObjectDescriptor: createViewerQaDescriptor(body.id, 'gates', 'ring-gate', body.displayName),
    };
  }

  if (bodyType === 'station') {
    return {
      ...body,
      externalObjectDescriptor: createViewerQaDescriptor(body.id, 'stations', 'trade-hub', body.displayName),
    };
  }

  return body;
}

function toForceHeroShip(ship: ShipSummary): ShipSummary {
  if (ship.externalObjectDescriptor) {
    return {
      ...ship,
      externalObjectDescriptor: {
        ...ship.externalObjectDescriptor,
        fallbackTier: 'hero',
      },
    };
  }

  return {
    ...ship,
    externalObjectDescriptor: createViewerQaDescriptor(
      ship.id,
      'ships',
      inferShipFamily(ship.model),
      ship.name?.trim() || ship.id,
    ),
  };
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
  protected readonly isDevBuild = !environment.production;
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
  protected viewerQaEnabled = signal(this.isDevBuild && environment.viewerQaEnabledByDefault);
  protected forceHeroMode = signal(this.isDevBuild && environment.viewerForceHeroByDefault);
  protected showEffectiveRenderProfile = signal(this.isDevBuild && environment.viewerShowEffectiveProfileByDefault);

  protected zoomPercent = computed<number>(() => Math.round(this.zoomLevel()));

  protected hasSystem = computed(() => this.solarSystemId() !== null);

  /** True when at least one ship in the active list has missing/invalid spatial state. */
  protected hasUnknownSpatialShip = computed<boolean>(() => this.ships().some((s) => !isValidShipSpatial(s.spatial)));

  /** Inputs forwarded to `<app-viewer-system-scene *canvasContent />`. */
  private viewerTargetService = inject(ViewerTargetService);

  protected readonly effectiveSceneBodies = computed<ViewerBody[]>(() => {
    if (!(this.viewerQaEnabled() && this.forceHeroMode())) {
      return this.bodies();
    }

    return this.bodies().map((body) => toForceHeroViewerBody(body));
  });

  protected readonly effectiveSceneShips = computed<ShipSummary[]>(() => {
    if (!(this.viewerQaEnabled() && this.forceHeroMode())) {
      return this.ships();
    }

    return this.ships().map((ship) => toForceHeroShip(ship));
  });

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
    bodies: this.effectiveSceneBodies(),
    summary: this.solarSystem(),
    targetBodyId: this.viewerTargetService.targetBodyId(),
    ships: this.effectiveSceneShips(),
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

    this.route.queryParamMap.subscribe((params) => {
      if (!this.isDevBuild) {
        return;
      }

      const qaOverride = parseBooleanQueryFlag(params.get('viewerQa'));
      const forceHeroOverride = parseBooleanQueryFlag(params.get('forceHero'));
      const showProfileOverride = parseBooleanQueryFlag(params.get('showRenderProfile'));

      if (qaOverride !== null) {
        this.viewerQaEnabled.set(qaOverride);
      }
      if (forceHeroOverride !== null) {
        this.forceHeroMode.set(forceHeroOverride);
      }
      if (showProfileOverride !== null) {
        this.showEffectiveRenderProfile.set(showProfileOverride);
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

  protected resolveGateApproachMetadata(body: ViewerBody): GateApproachMetadata | null {
    return resolveGateApproachMetadata(body.externalObjectDescriptor);
  }

  protected resolveBodyRenderProfile(body: ViewerBody): DescriptorRenderProfile | null {
    return resolveDescriptorRenderProfile(body.externalObjectDescriptor);
  }

  protected onViewerQaToggle(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    this.viewerQaEnabled.set(target.checked);
  }

  protected onForceHeroToggle(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    this.forceHeroMode.set(target.checked);
  }

  protected onShowRenderProfileToggle(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    this.showEffectiveRenderProfile.set(target.checked);
  }

}
