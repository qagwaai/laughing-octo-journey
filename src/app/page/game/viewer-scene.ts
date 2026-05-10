import { ChangeDetectionStrategy, Component, computed, inject, signal, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { NgtCanvas } from 'angular-three/dom';
import { locale } from '../../i18n/locale';
import type { SolarSystemGetResponse, ViewerBody } from '../../model/solar-system-get';
import type { SolarSystemSummary } from '../../model/solar-system-list';
import { SessionService } from '../../services/session.service';
import { SolarSystemService } from '../../services/solar-system.service';
import { ViewerSystemScene } from '../../scene/viewer/viewer-system-scene';
import type { ViewerSystemSceneInputs } from '../../scene/viewer/viewer-system-scene';

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
export default class ViewerScenePage {
  protected readonly t = locale;
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private sessionService = inject(SessionService);
  private solarSystemService = inject(SolarSystemService);

  private navigationState: ViewerSceneNavigationState =
    (this.router.getCurrentNavigation()?.extras.state as ViewerSceneNavigationState | undefined) ??
    (history.state as ViewerSceneNavigationState | undefined) ??
    {};

  protected playerName = signal<string>(this.navigationState.playerName ?? '');
  protected solarSystem = signal<SolarSystemSummary | null>(this.navigationState.solarSystem ?? null);
  protected solarSystemId = signal<string | null>(null);
  protected bodies = signal<ViewerBody[]>([]);
  protected hoveredBody = signal<ViewerBody | null>(null);
  protected focusedPlanet = signal<ViewerBody | null>(null);
  protected isLoading = signal(false);
  protected sceneError = signal<string | null>(null);

  protected hasSystem = computed(() => this.solarSystemId() !== null);

  /** Inputs forwarded to `<app-viewer-system-scene *canvasContent />`. */
  protected sceneInputs = computed<ViewerSystemSceneInputs>(() => ({
    bodies: this.bodies(),
    summary: this.solarSystem(),
  }));


  private lastLoadedSystemId: string | null = null;

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
    const playerName = this.playerName();
    const sessionKey = this.sessionService.getSessionKey();
    const solarSystemId = this.solarSystemId();
    if (!playerName || !sessionKey || !solarSystemId) {
      this.sceneError.set(this.t.game.viewer.sceneErrorPrefix + ' missing-session');
      return;
    }
    // Prevent duplicate loads for the same system
    if (solarSystemId === this.lastLoadedSystemId) {
      return;
    }
    this.lastLoadedSystemId = solarSystemId;
    this.isLoading.set(true);
    this.sceneError.set(null);

    this.solarSystemService.getSolarSystem(
      { playerName, sessionKey, solarSystemId },
      (response: SolarSystemGetResponse) => {
        this.isLoading.set(false);
        if (!response.success) {
          this.sceneError.set(this.t.game.viewer.sceneErrorPrefix + ' ' + (response.message ?? 'unknown-error'));
          return;
        }
        if (response.solarSystem) {
          this.solarSystem.set(response.solarSystem);
        }
        const allBodies = [...(response.stars ?? []), ...(response.bodies ?? [])];
        const dedupedBodies: ViewerBody[] = [];
        const seenBodyIds = new Set<string>();
        for (const body of allBodies) {
          if (seenBodyIds.has(body.id)) {
            continue;
          }
          seenBodyIds.add(body.id);
          dedupedBodies.push(body);
        }
        this.bodies.set(dedupedBodies);
        this.hoveredBody.set(null);
        this.focusedPlanet.set(null);
      },
    );
  }

  protected onHoveredBodyChange(body: ViewerBody | null): void {
    this.hoveredBody.set(body);
  }

  protected onFocusedPlanetChange(body: ViewerBody | null): void {
    this.focusedPlanet.set(body);
  }
}
