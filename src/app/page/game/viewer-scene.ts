import {
  ChangeDetectionStrategy,
  Component,
  computed,
  CUSTOM_ELEMENTS_SCHEMA,
  effect,
  ElementRef,
  inject,
  OnDestroy,
  signal,
  untracked,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NgtsStats } from 'angular-three-soba/stats';
import { NgtCanvas } from 'angular-three/dom';
import { environment } from '../../../environments/environment';
import { locale } from '../../i18n/locale';
import {
  EXTERNAL_OBJECT_SCHEMA_VERSION,
  type ExternalObjectDescriptor,
  type ExternalObjectDomain,
} from '../../model/external-object-descriptor';
import { isValidShipSpatial } from '../../model/math/spatial';
import { resolveCatalogDiameterM } from '../../model/physical-catalog';
import { INVALID_SESSION_EVENT } from '../../model/session';
import type { ShipSummary } from '../../model/ship-list';
import type { ViewerBody } from '../../model/solar-system-get';
import type { SolarSystemSummary } from '../../model/solar-system-list';
import { PlanetSurfaceProgress } from '../../scene/planet/planet-surface-progress';
import type { StationModelStatus } from '../../scene/station/station-model';
import { hasDedicatedStationModel } from '../../scene/station/station-model-assets';
import { isCygnusX1BlackHole } from '../../scene/viewer/cygnus-x1-viewer-profile';
import {
  resolveDescriptorRenderProfile,
  resolveGateApproachMetadata,
  type DescriptorRenderProfile,
  type GateApproachMetadata,
} from '../../scene/viewer/viewer-descriptor-selectors';
import { resolveScenePositionFromSpatialKm, type ViewerDistanceMode } from '../../scene/viewer/viewer-formatters';
import { viewerBodyGroup } from '../../scene/viewer/viewer-item-groups';
import {
  buildNavigationDetour,
  NAVIGATION_CANDIDATE_MARKER_RADIUS,
  NAVIGATION_DETOUR_MARGIN,
  type NavigationDetour,
  type NavigationGeometryState,
  type NavigationScenePoint,
} from '../../scene/viewer/viewer-navigation-detour';
import type { ViewerSystemSceneInputs } from '../../scene/viewer/viewer-system-scene';
import { ViewerSystemScene } from '../../scene/viewer/viewer-system-scene';
import { appLogger } from '../../services/logger';
import { MarketService } from '../../services/market.service';
import { SessionService } from '../../services/session.service';
import { ShipService } from '../../services/ship.service';
import { SocketService } from '../../services/socket.service';
import { SolarSystemService } from '../../services/solar-system.service';
import { ViewerGroupVisibilityService } from '../../services/viewer-group-visibility.service';
import { ViewerNavigationPreviewService } from '../../services/viewer-navigation-preview.service';
import { ViewerTargetService } from '../../services/viewer-target.service';
import { resolveNavigationState } from '../navigation-state';
import { AstronomyCreditList } from '../public/astronomy-credit-list';
import {
  APPROXIMATE_PREFIX,
  approximatePrefix,
  areRingsApproximate,
  hasCatalogMetadata,
  isApproximateField,
  isLikelyBodyType,
  secondaryCatalogName,
} from './viewer-body-metadata';
import {
  catalogSnapshotDate,
  REFERENCE_COLLAPSE_LIMIT,
  resolveViewerDataCredits,
  viewerBodyReferences,
  visibleBodyReferences,
} from './viewer-data-attribution';
import { ViewerDataFacade } from './viewer-data-facade';
import { formatViewerNumber } from './viewer-number-format';

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
  imports: [NgtCanvas, NgtsStats, ViewerSystemScene, PlanetSurfaceProgress, AstronomyCreditList],
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
  protected readonly catalogDiameterM = resolveCatalogDiameterM;
  protected readonly formatNumber = formatViewerNumber;
  protected readonly isDevBuild = !environment.production;
  protected host = inject<ElementRef<HTMLElement>>(ElementRef);
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
  protected readonly targetBody = computed(() => {
    const id = this.viewerTargetService.targetBodyId();
    return this.visibleSceneBodies().find((body) => body.id === id) ?? null;
  });
  protected readonly inspectedBodyId = signal<string | null>(null);
  protected readonly inspectedBody = computed(
    () => this.visibleSceneBodies().find((body) => body.id === this.inspectedBodyId()) ?? null,
  );
  protected readonly dataCredits = computed(() =>
    resolveViewerDataCredits(this.solarSystem(), environment.nameExoWorldsCreditEnabled),
  );
  protected readonly snapshotDate = computed(() => catalogSnapshotDate(this.solarSystem()));
  protected readonly referenceCollapseLimit = REFERENCE_COLLAPSE_LIMIT;
  protected readonly inspectedReferences = computed(() => {
    const body = this.inspectedBody();
    return body ? viewerBodyReferences(body) : [];
  });
  /** Collapses again whenever the inspected body changes. */
  protected readonly referencesExpanded = signal(false);
  private readonly collapseReferencesOnBodyChange = effect(() => {
    this.inspectedBodyId();
    untracked(() => this.referencesExpanded.set(false));
  });
  protected readonly visibleReferences = computed(() =>
    visibleBodyReferences(this.inspectedReferences(), this.referencesExpanded()),
  );
  protected focusedPlanet = signal<ViewerBody | null>(null);
  protected readonly labeledBody = computed<ViewerBody | null>(() => {
    const hovered = this.hoveredBody();
    if (hovered && this.visibleSceneBodies().some((body) => body.id === hovered.id)) return hovered;
    const targetId = this.viewerTargetService.targetBodyId();
    return targetId ? (this.visibleSceneBodies().find((body) => body.id === targetId) ?? null) : null;
  });
  protected isLoading = signal(false);
  protected sceneError = signal<string | null>(null);
  protected blackHoleRendererError = signal(false);
  protected isPlanetTransitioning = signal(false);
  protected readonly stationModelStatus = signal<StationModelStatus | null>(null);
  protected readonly stationModelAttempt = signal(0);
  protected readonly hasDedicatedStationModel = hasDedicatedStationModel;

  protected retryStationModel(): void {
    this.stationModelAttempt.update((attempt) => attempt + 1);
  }

  protected openStationView(body: ViewerBody): void {
    const solarSystemId = this.solarSystemId();
    if (!solarSystemId || !hasDedicatedStationModel(body)) return;
    void this.router
      .navigate([{ outlets: { right: ['station-view', solarSystemId, body.id] } }], {
        preserveFragment: true,
        state: { playerName: this.playerName(), solarSystem: this.solarSystem(), bodies: this.bodies() },
      })
      .then((navigated) => {
        if (!navigated) appLogger.warn('Station view navigation was cancelled.', { bodyId: body.id });
      })
      .catch((error: unknown) => appLogger.error('Station view navigation failed.', { bodyId: body.id, error }));
  }
  protected zoomLevel = signal<number>(100);
  protected distanceMode = signal<ViewerDistanceMode>('proportional');

  toggleDistanceMode(): void {
    this.distanceMode.update((mode) => (mode === 'proportional' ? 'compressed' : 'proportional'));
    if (!this.viewerTargetService.targetBodyId() && !this.focusedPlanet()) {
      this.zoomLevel.set(100);
    }
  }
  protected viewerQaEnabled = signal(this.isDevBuild && environment.viewerQaEnabledByDefault);
  protected forceHeroMode = signal(this.isDevBuild && environment.viewerForceHeroByDefault);
  protected showEffectiveRenderProfile = signal(this.isDevBuild && environment.viewerShowEffectiveProfileByDefault);

  protected zoomPercent = computed<number>(() => Math.round(this.zoomLevel()));
  protected readonly persistentStatsOptions = { parent: this.host, domClass: 'stats' };

  protected hasSystem = computed(() => this.solarSystemId() !== null);
  protected readonly hasCygnusX1BlackHole = computed(() => this.visibleSceneBodies().some(isCygnusX1BlackHole));

  /** True when at least one ship in the active list has missing/invalid spatial state. */
  protected hasUnknownSpatialShip = computed<boolean>(() =>
    this.visibleSceneShips().some((s) => !isValidShipSpatial(s.spatial)),
  );

  /** Inputs forwarded to `<app-viewer-system-scene *canvasContent />`. */
  private viewerTargetService = inject(ViewerTargetService);
  private viewerGroupVisibility = inject(ViewerGroupVisibilityService);
  private navigationPreviewService = inject(ViewerNavigationPreviewService);

  protected readonly navigationPreview = this.navigationPreviewService.preview.asReadonly();
  protected readonly navigationPrediction = this.navigationPreviewService.prediction.asReadonly();
  protected readonly predictionSpeed = signal<number | null>(null);
  protected readonly predictionSpeedValid = computed(() => {
    const speed = this.predictionSpeed();
    return speed !== null && Number.isFinite(speed) && speed >= 120 && speed <= 10000;
  });
  protected readonly supportedPrediction = computed(() => {
    const result = this.navigationPrediction();
    return result.status === 'ready' ? result.prediction : null;
  });
  protected readonly predictionGeometryState = computed<NavigationGeometryState | null>(() => {
    const p = this.supportedPrediction();
    return p
      ? {
          departure: p.departure,
          destination: p.arrival,
          candidates: [p.encounter],
        }
      : null;
  });
  protected readonly predictionDestinationLabel = computed(() => {
    const p = this.supportedPrediction();
    const preview = this.navigationPreview();
    return p && preview
      ? `${this.t.game.viewer.navigationPredictionArrival}: ${preview.selection.destinationName} — ${this.gameTimeLabel(p.arrival.epochMs)}`
      : '';
  });
  protected readonly predictionCandidateLabel = computed(() => {
    const p = this.supportedPrediction();
    return p
      ? `${this.t.game.viewer.navigationPredictionEncounter}: ${this.navigationCandidateName()} — ${this.gameTimeLabel(p.encounter.epochMs)}`
      : '';
  });
  protected readonly projectedNavigationState = computed(() => {
    const preview = this.navigationPreview();
    return preview?.status === 'ready' ? preview.state : null;
  });
  protected readonly navigationDestinationLabel = computed(() => {
    const preview = this.navigationPreview();
    if (preview?.status !== 'ready') return '';
    return `${this.t.game.viewer.navigationPreviewDestinationLabel}: ${preview.selection.destinationName} — ${preview.state.epochMs} ms`;
  });
  protected readonly navigationCandidateLabel = computed(() => {
    const preview = this.navigationPreview();
    if (preview?.status !== 'ready' || !preview.selection.candidateBodyId) return '';
    return `${this.t.game.viewer.navigationPreviewCandidateMarkerLabel}: ${this.navigationCandidateName()} — ${preview.state.epochMs} ms`;
  });
  protected readonly navigationDetour = computed<NavigationDetour | null>(() => {
    const preview = this.navigationPreview();
    if (preview?.status !== 'ready') return null;
    const predictionState = this.predictionGeometryState();
    if (predictionState) return buildNavigationDetour(predictionState, this.distanceMode());
    return this.navigationPrediction().status === 'idle'
      ? buildNavigationDetour(preview.state, this.distanceMode())
      : null;
  });
  protected readonly navigationRoutePoints = computed(() => {
    const detour = this.navigationDetour();
    return detour && detour.status !== 'unavailable' ? detour.points : null;
  });
  protected readonly navigationDetour3dUnavailable = signal(false);
  protected readonly navigationPrediction3dUnavailable = signal(false);
  protected readonly navigationCandidateBodies = computed(() =>
    this.bodies().filter((body) => ['planet', 'moon'].includes(body.bodyType.trim().toLowerCase())),
  );
  protected navigationCandidateName(): string {
    const candidateId = this.navigationPreview()?.selection.candidateBodyId;
    if (!candidateId) return '';
    return this.navigationCandidateBodies().find((body) => body.id === candidateId)?.displayName ?? candidateId;
  }
  protected readonly navigationPlot = computed(() => {
    const preview = this.navigationPreview();
    if (preview?.status !== 'ready') return null;

    const departure = resolveScenePositionFromSpatialKm(preview.state.departure.positionKm, this.distanceMode());
    const destination = resolveScenePositionFromSpatialKm(preview.state.destination.positionKm, this.distanceMode());
    const predictionState = this.predictionGeometryState();
    const drawState = predictionState ?? preview.state;
    const routeDestination = resolveScenePositionFromSpatialKm(drawState.destination.positionKm, this.distanceMode());
    const candidatePosition = drawState.candidates[0]?.positionKm;
    const candidate = candidatePosition
      ? resolveScenePositionFromSpatialKm(candidatePosition, this.distanceMode())
      : null;
    const detour = this.navigationDetour();
    const route = detour && detour.status !== 'unavailable' ? detour.points : null;
    const markerBounds: NavigationScenePoint[] = candidate
      ? [
          [
            candidate[0] - NAVIGATION_CANDIDATE_MARKER_RADIUS,
            candidate[1],
            candidate[2] - NAVIGATION_CANDIDATE_MARKER_RADIUS,
          ],
          [
            candidate[0] + NAVIGATION_CANDIDATE_MARKER_RADIUS,
            candidate[1],
            candidate[2] + NAVIGATION_CANDIDATE_MARKER_RADIUS,
          ],
        ]
      : [];
    const frozenCandidatePosition = preview.state.candidates[0]?.positionKm;
    const frozenCandidate = frozenCandidatePosition
      ? resolveScenePositionFromSpatialKm(frozenCandidatePosition, this.distanceMode())
      : null;
    const positions = [
      ...(route ?? []),
      departure,
      destination,
      routeDestination,
      ...markerBounds,
      ...(frozenCandidate ? [frozenCandidate] : []),
    ];
    const minX = Math.min(...positions.map((position) => position[0]));
    const maxX = Math.max(...positions.map((position) => position[0]));
    const minY = Math.min(...positions.map((position) => position[2]));
    const maxY = Math.max(...positions.map((position) => position[2]));
    const width = 560;
    const height = 220;
    const padding = 24;
    const xRange = Math.max(maxX - minX, 1);
    const yRange = Math.max(maxY - minY, 1);
    const scale = Math.min((width - padding * 2) / xRange, (height - padding * 2) / yRange);
    const plotWidth = xRange * scale;
    const plotHeight = yRange * scale;
    const offsetX = (width - plotWidth) / 2;
    const offsetY = (height - plotHeight) / 2;
    const project = (position: NavigationScenePoint) => ({
      x: offsetX + (position[0] - minX) * scale,
      y: height - offsetY - (position[2] - minY) * scale,
    });
    const plotDeparture = project(departure);
    const plotDestination = project(destination);
    const plotArrival = predictionState ? project(routeDestination) : null;
    const plotCandidate = candidate ? project(candidate) : null;
    const markerRadius = NAVIGATION_CANDIDATE_MARKER_RADIUS * scale;
    const unavailable =
      !!plotCandidate &&
      (Math.hypot(plotCandidate.x - plotDeparture.x, plotCandidate.y - plotDeparture.y) <= markerRadius + 8 ||
        Math.hypot(
          plotCandidate.x - (plotArrival ?? plotDestination).x,
          plotCandidate.y - (plotArrival ?? plotDestination).y,
        ) <=
          markerRadius + 10);

    return {
      departure: plotDeparture,
      destination: plotDestination,
      candidate: plotCandidate,
      frozenCandidate: predictionState && frozenCandidate ? project(frozenCandidate) : null,
      arrival: plotArrival,
      unavailable,
      routePoints:
        route && !unavailable
          ? route
              .map(project)
              .map((point) => `${point.x},${point.y}`)
              .join(' ')
          : null,
      routeStrokeWidth: candidate ? Math.min(2.5, NAVIGATION_DETOUR_MARGIN * scale) : 2.5,
      candidateMarkerStrokeWidth: Math.min(2, (NAVIGATION_DETOUR_MARGIN * scale) / 2),
      candidateMarkerSize: candidate ? markerRadius * Math.SQRT2 : 0,
    };
  });

  constructor() {
    effect(() => {
      const preview = this.navigationPreviewService.preview();
      if (!preview) return;
      const activeShip = this.sessionService.activeShip();
      const position = activeShip?.spatial?.positionKm;
      const selectedPosition = preview.selection.shipPositionKm;
      const currentSystemId = this.solarSystemId();
      if (
        preview.selection.shipId !== activeShip?.id ||
        preview.selection.characterId !== this.sessionService.activeCharacter()?.id ||
        preview.selection.solarSystemId !== currentSystemId ||
        preview.selection.solarSystemId !== activeShip?.spatial?.solarSystemId ||
        preview.selection.shipEpochMs !== activeShip?.spatial?.epochMs ||
        !position ||
        position.x !== selectedPosition.x ||
        position.y !== selectedPosition.y ||
        position.z !== selectedPosition.z
      ) {
        this.navigationPreviewService.clear();
      }
    });
  }

  protected navigationHiddenGroups(): string[] {
    const preview = this.navigationPreview();
    if (!preview) return [];

    const hidden = new Set<string>();
    if (!this.viewerGroupVisibility.isGroupIncluded('stations')) hidden.add('stations');
    const candidateId = preview.selection.candidateBodyId;
    if (candidateId) {
      const candidate = this.bodies().find((body) => body.id === candidateId);
      if (candidate) {
        const group = viewerBodyGroup(candidate);
        if (!this.viewerGroupVisibility.isGroupIncluded(group)) hidden.add(group);
      }
    }
    return [...hidden];
  }

  protected selectNavigationCandidate(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLSelectElement) {
      this.navigationPreviewService.selectCandidate(target.value || null);
    }
  }

  protected changePredictionSpeed(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    this.predictionSpeed.set(target.value === '' ? null : target.valueAsNumber);
    this.navigationPreviewService.clearPrediction();
  }

  protected calculateNavigationPrediction(): void {
    const speed = this.predictionSpeed();
    if (speed !== null) this.navigationPreviewService.calculatePrediction(speed);
  }

  protected clearNavigationPrediction(): void {
    this.navigationPreviewService.clearPrediction();
    this.predictionSpeed.set(null);
  }

  protected gameTimeLabel(epochMs: number): string {
    return new Date(epochMs).toISOString();
  }

  protected clearNavigationPreview(): void {
    this.predictionSpeed.set(null);
    this.navigationPreviewService.clear();
  }

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

  protected readonly itemGroups = computed(() => {
    const groups = new Set(['asteroids', ...this.bodies().map(viewerBodyGroup)]);
    if (this.ships().length) groups.add('ships');
    return [...groups].sort();
  });
  protected readonly visibleSceneBodies = computed(() =>
    this.effectiveSceneBodies().filter((body) => this.isGroupIncluded(viewerBodyGroup(body))),
  );
  protected readonly visibleSceneShips = computed(() =>
    this.isGroupIncluded('ships') ? this.effectiveSceneShips() : [],
  );

  protected isGroupIncluded(group: string): boolean {
    return this.viewerGroupVisibility.isGroupIncluded(group);
  }

  protected setGroupIncluded(group: string, included: boolean): void {
    this.viewerGroupVisibility.setGroupIncluded(group, included);
    if (included) return;
    const hovered = this.hoveredBody();
    if (hovered && viewerBodyGroup(hovered) === group) this.hoveredBody.set(null);
    const focused = this.focusedPlanet();
    if (focused && viewerBodyGroup(focused) === group) this.focusedPlanet.set(null);
    if (
      !this.targetBody() &&
      !this.visibleSceneShips().some((ship) => ship.id === this.viewerTargetService.targetBodyId())
    ) {
      this.viewerTargetService.clearTarget();
      this.stationModelStatus.set(null);
    }
    if (!this.inspectedBody()) this.inspectedBodyId.set(null);
  }

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
      this.stationModelStatus.set(null);
      this.blackHoleRendererError.set(false);
    },
  });

  protected onBlackHoleRendererError(): void {
    this.blackHoleRendererError.set(true);
  }

  protected sceneInputs = computed<ViewerSystemSceneInputs>(() => ({
    bodies: this.visibleSceneBodies(),
    summary: this.solarSystem(),
    targetBodyId: this.viewerTargetService.targetBodyId(),
    ships: this.visibleSceneShips(),
    activeShipId: this.sessionService.activeShip()?.id ?? null,
  }));

  private planetTransitionTimer: ReturnType<typeof setTimeout> | null = null;
  private unsubscribeInvalidSession?: () => void;

  ngOnInit(): void {
    this.unsubscribeInvalidSession = this.socketService.on(INVALID_SESSION_EVENT, () => {
      this.navigationPreviewService.invalidateSession();
    });
    // Subscribe to route param changes
    this.route.paramMap.subscribe((params) => {
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
    this.unsubscribeInvalidSession?.();
    this.navigationPreviewService.clear();
    this.viewerDataFacade.dispose();
    if (this.planetTransitionTimer !== null) {
      clearTimeout(this.planetTransitionTimer);
      this.planetTransitionTimer = null;
    }
  }

  protected onHoveredBodyChange(body: ViewerBody | null): void {
    this.hoveredBody.set(body);
  }

  protected inspectTarget(): void {
    const body = this.targetBody();
    if (body) this.inspectedBodyId.set(body.id);
  }

  protected onTargetBodyRequest(id: string): void {
    this.viewerTargetService.target(id);
  }

  protected closeInspector(): void {
    this.inspectedBodyId.set(null);
    this.host.nativeElement.querySelector<HTMLButtonElement>('.viewer-inspect-button')?.focus();
  }

  protected isBodyTargeted(body: ViewerBody): boolean {
    return this.viewerTargetService.targetBodyId() === body.id;
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
      this.planetTransitionTimer = null;
      void this.router
        .navigate([{ outlets: { right: ['planet-view', solarSystemId, body.id] } }], {
          preserveFragment: true,
          state: {
            playerName: this.playerName(),
            solarSystem: this.solarSystem(),
            bodies: this.bodies(),
          },
        })
        .then((navigated) => {
          if (!navigated) {
            this.isPlanetTransitioning.set(false);
            appLogger.warn('Planet view navigation was cancelled', { solarSystemId, bodyId: body.id });
          }
        })
        .catch((error: unknown) => {
          this.isPlanetTransitioning.set(false);
          appLogger.error('Planet view navigation failed', { solarSystemId, bodyId: body.id, error });
        });
    }, 140);
  }

  protected canOpenCloseup(body: ViewerBody): boolean {
    return this.canOpenBodyCloseup(body) || hasDedicatedStationModel(body);
  }

  private canOpenBodyCloseup(body: ViewerBody): boolean {
    return ['planet', 'moon', 'dwarf-planet', 'tno', 'comet'].includes(body.bodyType);
  }

  protected openInspectedCloseup(body: ViewerBody): void {
    if (hasDedicatedStationModel(body)) {
      this.openStationView(body);
    } else if (this.canOpenBodyCloseup(body)) {
      this.onPlanetViewRequest(body);
    }
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
    const delta = event.deltaMode === 0 ? (event.deltaY / 100) * STEP_PER_LINE : event.deltaY * STEP_PER_LINE;

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

  protected readonly approximatePrefix = approximatePrefix;
  protected readonly approximateMark = APPROXIMATE_PREFIX;
  protected readonly areRingsApproximate = areRingsApproximate;
  protected readonly isApproximateField = isApproximateField;
  protected readonly isLikelyBodyType = isLikelyBodyType;
  protected readonly secondaryCatalogName = secondaryCatalogName;
  protected readonly hasCatalogMetadata = hasCatalogMetadata;

  protected approximateTitle(body: ViewerBody, path: string): string | null {
    return isApproximateField(body, path) ? this.t.game.viewer.approximateValueTooltip : null;
  }

  protected toggleReferences(): void {
    this.referencesExpanded.update((expanded) => !expanded);
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
