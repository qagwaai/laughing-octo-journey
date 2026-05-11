import { ChangeDetectionStrategy, Component, computed, CUSTOM_ELEMENTS_SCHEMA, HostListener, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NgtCanvas } from 'angular-three/dom';
import { locale } from '../../i18n/locale';
import type { SolarSystemGetResponse, ViewerBody } from '../../model/solar-system-get';
import type { SolarSystemSummary } from '../../model/solar-system-list';
import { SessionService } from '../../services/session.service';
import { SolarSystemService } from '../../services/solar-system.service';
import { PlanetViewScene } from '../../scene/viewer/planet-view-scene';

interface PlanetViewNavigationState {
  playerName?: string;
  solarSystem?: SolarSystemSummary;
  bodies?: ViewerBody[];
}

@Component({
  selector: 'app-planet-view-page',
  templateUrl: './planet-view.html',
  styleUrls: ['./planet-view.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgtCanvas, PlanetViewScene],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export default class PlanetViewPage {
  protected readonly t = locale;
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private sessionService = inject(SessionService);
  private solarSystemService = inject(SolarSystemService);

  private navigationState: PlanetViewNavigationState =
    (this.router.getCurrentNavigation()?.extras.state as PlanetViewNavigationState | undefined) ??
    (history.state as PlanetViewNavigationState | undefined) ??
    {};

  protected playerName = signal<string>(this.navigationState.playerName ?? '');
  protected solarSystem = signal<SolarSystemSummary | null>(this.navigationState.solarSystem ?? null);
  protected solarSystemId = signal<string | null>(null);
  protected selectedBodyId = signal<string | null>(null);
  protected bodies = signal<ViewerBody[]>(this.navigationState.bodies ?? []);

  protected zoomLevel = signal<number>(18);
  protected isLoading = signal(false);
  protected sceneError = signal<string | null>(null);
  protected showEntryFade = signal(true);

  private lastLoadedSystemId: string | null = null;
  private entryFadeTimer: ReturnType<typeof setTimeout> | null = null;

  protected selectedBody = computed<ViewerBody | null>(() => {
    const id = this.selectedBodyId();
    if (!id) {
      return null;
    }
    return this.bodies().find((body) => body.id === id) ?? null;
  });

  protected moonCount = computed<number>(() => {
    const selected = this.selectedBody();
    if (!selected) {
      return 0;
    }
    return this.bodies().filter((body) => body.orbitalElements?.anchorBodyId === selected.id).length;
  });

  protected moonBodies = computed<ViewerBody[]>(() => {
    const selected = this.selectedBody();
    if (!selected) {
      return [];
    }
    return this.bodies().filter((body) => body.orbitalElements?.anchorBodyId === selected.id);
  });

  protected zoomPercent = computed<number>(() => Math.round(this.zoomLevel()));

  ngOnInit(): void {
    this.showEntryFade.set(true);
    this.entryFadeTimer = setTimeout(() => {
      this.showEntryFade.set(false);
      this.entryFadeTimer = null;
    }, 420);

    this.route.paramMap.subscribe((params) => {
      this.solarSystemId.set(params.get('solarSystemId'));
      this.selectedBodyId.set(params.get('bodyId'));
      this.zoomLevel.set(18);
      this.loadSystem();
    });
  }

  ngOnDestroy(): void {
    if (this.entryFadeTimer) {
      clearTimeout(this.entryFadeTimer);
      this.entryFadeTimer = null;
    }
  }

  protected loadSystem(): void {
    const playerName = this.playerName();
    const sessionKey = this.sessionService.getSessionKey();
    const solarSystemId = this.solarSystemId();

    if (!playerName || !sessionKey || !solarSystemId) {
      this.sceneError.set(this.t.game.viewer.sceneErrorPrefix + ' missing-session');
      return;
    }

    // If navigation state has this system preloaded, use it immediately.
    if (this.navigationState.bodies?.length && this.lastLoadedSystemId !== solarSystemId) {
      this.bodies.set(this.navigationState.bodies);
      this.lastLoadedSystemId = solarSystemId;
    }

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
        const deduped: ViewerBody[] = [];
        const seen = new Set<string>();
        for (const body of allBodies) {
          if (seen.has(body.id)) {
            continue;
          }
          seen.add(body.id);
          deduped.push(body);
        }
        this.bodies.set(deduped);

        if (this.selectedBodyId()) {
          const hasSelection = deduped.some((body) => body.id === this.selectedBodyId());
          if (!hasSelection) {
            const firstPlanet = deduped.find((body) => body.bodyType === 'planet' || body.bodyType === 'moon');
            this.selectedBodyId.set(firstPlanet?.id ?? null);
          }
        }
      },
    );
  }

  protected onZoomChange(value: string): void {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return;
    }
    this.zoomLevel.set(Math.max(0, Math.min(100, parsed)));
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

  protected onSceneContextMenu(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  protected onScenePointerDown(event: PointerEvent): void {
    if (event.button !== 2) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  }

  @HostListener('document:contextmenu', ['$event'])
  protected onDocumentContextMenu(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  @HostListener('document:pointerdown', ['$event'])
  protected onDocumentPointerDown(event: PointerEvent): void {
    if (event.button === 2) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  @HostListener('contextmenu', ['$event'])
  protected onHostContextMenu(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  protected onSelectedBodyChange(body: ViewerBody): void {
    this.selectedBodyId.set(body.id);
    this.zoomLevel.set(18);
  }

  protected selectBodyFromList(body: ViewerBody): void {
    this.onSelectedBodyChange(body);
  }

  protected formatNumber(value: number | undefined | null, digits = 0): string {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return '—';
    }
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: digits,
    });
  }

  protected exitToViewer(): void {
    const solarSystemId = this.solarSystemId();
    if (!solarSystemId) {
      return;
    }

    this.router.navigate([{ outlets: { right: ['viewer-scene', solarSystemId] } }], {
      preserveFragment: true,
      state: {
        playerName: this.playerName(),
        solarSystem: this.solarSystem(),
      },
    });
  }
}
