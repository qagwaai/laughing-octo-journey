import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  computed,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  inject,
  OnDestroy,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { NgtsStats } from 'angular-three-soba/stats';
import { NgtCanvas } from 'angular-three/dom';
import { filter, map, startWith, Subscription } from 'rxjs';
import { LeftPaneMissionGuidanceOverlay } from './component/left-pane-mission-guidance-overlay';
import { locale } from './i18n/locale';
import ShipExteriorHudOverlayComponent from './page/opening/ship-exterior-hud-overlay';
import { RoutedScene } from './routed-scene';
import { PlanetCloudSettings } from './scene/planet/planet-clouds';
import { createShipExteriorViewFacade } from './scene/ship-exterior/ship-exterior-view-facade';
import { SplashOverlay } from './scene/splash-overlay';
import { SplashState } from './scene/splash-state';
import { OpeningAudioService } from './services';
import { ContractVarianceNotifierService } from './services/contract-variance-notifier.service';
import { appLogger } from './services/logger';
import { RenderStatsService } from './services/render-stats.service';
import { SceneVisibilityService } from './services/scene-visibility.service';
import { ShipExteriorViewHostService } from './services/ship-exterior-view-host.service';

const START_SCANNING_UI_EVENT = 'cold-boot:start-scanning';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  host: { class: 'block h-dvh w-full', '[class.show-render-stats]': 'stats()' },
  styles: `
    :host {
      display: block;
      height: 100vh;
      width: 100vw;
      .split-layout {
        --splitter-width: 32px;
      }

      .splitter {
        width: var(--splitter-width);
        flex: none;
        user-select: none;
      }

      .splitter-drag {
        touch-action: none;
      }

      .splitter-controls {
        position: absolute;
        top: 8px;
        left: 2px;
        right: 2px;
        z-index: 20;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .splitter-controls button {
        width: 100%;
        aspect-ratio: 1;
        touch-action: manipulation;
      }

      @media (any-pointer: coarse), (max-width: 640px) {
        .split-layout {
          --splitter-width: 48px;
        }
      }

      &.resizing {
        user-select: none;
      }
    }

    .cold-boot-scan-host {
      position: absolute;
      inset: 0;
      display: block;
      height: 100%;
      min-height: 100%;
      background: transparent;
      pointer-events: none;
      font-family: Inter, Arial, sans-serif;
      --ship-properties-offset-x: 16px;
      --ship-properties-offset-y: 16px;
      --ship-hotkey-offset-x: 16px;
      --ship-hotkey-offset-y: 16px;
    }
  `,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [
    NgtCanvas,
    NgtsStats,
    RoutedScene,
    LeftPaneMissionGuidanceOverlay,
    ShipExteriorHudOverlayComponent,
    RouterOutlet,
    SplashOverlay,
  ],
})
export class AppComponent implements AfterViewInit, OnDestroy {
  private static readonly LOOK_HINT_HIDE_DELAY_MS = 2000;
  private static readonly START_SCANNING_LEFT_WIDTH = 33;
  private static readonly PANEL_SPLIT_DURATION_MS = 700;
  private static readonly PANEL_SPLIT_TRANSITION = `width ${AppComponent.PANEL_SPLIT_DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`;
  protected host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly t = locale;
  protected cdr = inject(ChangeDetectorRef);
  protected router = inject(Router);
  protected openingAudio = inject(OpeningAudioService);
  protected contractVarianceNotifier = inject(ContractVarianceNotifierService);
  protected renderStats = inject(RenderStatsService);
  private shipExteriorViewHost = inject(ShipExteriorViewHostService);
  private sceneVisibility = inject(SceneVisibilityService);
  protected leftPanelRef = viewChild.required<ElementRef<HTMLElement>>('leftPanel');
  protected rightPanelRef = viewChild.required<ElementRef<HTMLElement>>('rightPanel');
  protected dividerRef = viewChild.required<ElementRef<HTMLElement>>('divider');
  protected color = signal('#ff0000');
  protected stats = this.renderStats.enabled;
  protected readonly publicSettingsVisible = computed(() => {
    const url = this.currentUrl();
    const leftRoute = /(?:\(|\/\/)left:([^/)?#]+)/.exec(url)?.[1];
    const route = leftRoute ?? /^\/([^/(?#]+)/.exec(url)?.[1];
    return ['intro', 'splash', 'login', 'registration', 'menu', 'controls'].includes(route ?? '');
  });
  protected readonly persistentStatsOptions = { parent: this.host, domClass: 'stats pointer-events-none' };
  protected readonly shipExteriorHudFacade = createShipExteriorViewFacade(
    () => this.shipExteriorViewHost.source() ?? undefined,
  );
  protected readonly shipExteriorHudVisible = computed(() => this.shipExteriorViewHost.source() !== null);
  protected readonly shipExteriorObjectivePanel = computed(() => this.shipExteriorHudFacade.objectivePanel());
  protected readonly shipExteriorPropertiesPanel = computed(() => this.shipExteriorHudFacade.propertiesPanel());
  protected readonly shipExteriorFlightPanel = computed(() => this.shipExteriorHudFacade.flightPanel());
  protected readonly shipExteriorLaunchPanel = computed(() => this.shipExteriorHudFacade.launchPanel());
  protected readonly shipExteriorDebugPanel = computed(() => this.shipExteriorHudFacade.debugPanel());
  protected follow = signal(true);
  protected lockX = signal(false);
  protected lockY = signal(false);
  protected lockZ = signal(false);
  protected audioHooksEnabled = signal(this.openingAudio.isAudioHooksEnabled());
  protected audioArmed = signal(this.openingAudio.isArmed());
  protected audioBedRunning = signal(this.openingAudio.isCinematicBedRunning());
  protected speechAvailable = signal(this.openingAudio.isSpeechSynthesisAvailable());
  protected audioArmedLabel = computed(() => `Armed: ${this.openingAudio.isArmed() ? '●' : '○'}`);
  protected audioBedLabel = computed(() => `Bed: ${this.openingAudio.isCinematicBedRunning() ? '●' : '○'}`);
  protected leftPanelWidth = signal(50);
  protected isResizing = signal(false);
  protected lookHintOpacity = signal(0);
  protected readonly canvasCameraOptions = { position: [5, 5, 5] as [number, number, number] };
  protected readonly canvasLookAt = [0, 0, 0] as [number, number, number];
  protected readonly splash = inject(SplashState);
  private readonly cloudSettings = inject(PlanetCloudSettings);
  protected readonly splashActive = computed(() => /(?:^|\/)(?:intro|splash)(?:\(|\?|$)/.test(this.currentUrl()));
  protected readonly canvasFrameloop = computed(() =>
    this.splashActive()
      ? !this.sceneVisibility.isSceneHidden() &&
        (this.splash.moving() ||
          (this.splash.status() === 'ready' &&
            !this.splash.reducedMotion() &&
            !this.splash.documentHidden() &&
            (this.splash.stationSplash() || (this.cloudSettings.enabled() && this.cloudSettings.coverage() > 0))))
        ? 'always'
        : 'demand'
      : this.sceneVisibility.sceneFrameloop(),
  );
  protected readonly canvasDpr = computed<[number, number]>(() =>
    this.splashActive() ? [1, this.splash.quality() === 'low' ? 1 : 1.5] : [1, 2],
  );

  protected currentUrl = toSignal(
    this.router.events.pipe(
      filter((ev): ev is NavigationEnd => ev instanceof NavigationEnd),
      map((ev) => ev.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  protected isColdBootSceneActive = computed(
    () => this.currentUrl().includes('opening-cold-boot') && !this.rightOutletActive(),
  );

  protected isColdBootScanOverlayActive = computed(() => this.currentUrl().includes('opening-cold-boot-scan'));

  protected shipExteriorPrimaryActive = computed(() => {
    const url = this.currentUrl();
    return /(?:^|\/)ship-exterior-view(?:\(|$)/.test(url);
  });

  protected showColdBootLookHint = computed(() => this.isColdBootSceneActive() && this.lookHintOpacity() > 0);
  protected contractVarianceToast = this.contractVarianceNotifier.activeToast;

  private startX = 0;
  private startWidth = 50;
  private activePointerId: number | null = null;
  private lookHintTimerId: number | null = null;
  private splitTransitionTimerId: number | null = null;
  private navigationSubscription: Subscription;
  private readonly onStartScanningListener = () => this.animateSplitToStartScanningLayout();

  protected rightOutletActive = toSignal(
    this.router.events.pipe(
      filter((ev): ev is NavigationEnd => ev instanceof NavigationEnd),
      map((ev) => ev.urlAfterRedirects.includes('right:')),
      startWith(this.router.url.includes('right:')),
    ),
    { initialValue: false },
  );

  /**
   * Subscribe to rightOutletActive changes and notify the scene visibility service.
   * This ensures the scene knows when to deactivate (hidden) or activate (visible).
   */
  private rightOutletActiveSubscription = this.router.events
    .pipe(
      filter((ev): ev is NavigationEnd => ev instanceof NavigationEnd),
      map((ev) => ({
        active: ev.urlAfterRedirects.includes('right:'),
        url: ev.urlAfterRedirects,
      })),
      startWith({
        active: this.router.url.includes('right:'),
        url: this.router.url,
      }),
    )
    .subscribe(({ active, url }) => {
      this.sceneVisibility.setRightOutletActive(active && !url.includes('opening-cold-boot-scan'));
    });

  constructor() {
    this.navigationSubscription = this.router.events
      .pipe(
        filter((ev): ev is NavigationEnd => ev instanceof NavigationEnd),
        map((ev) => ev.urlAfterRedirects),
        startWith(this.router.url),
      )
      .subscribe((url) => {
        const isColdBootPrimary = url.includes('opening-cold-boot') && !url.includes('right:');
        this.configureColdBootLookHint(isColdBootPrimary);
      });
  }

  /**
   * Navigate to a route in the primary outlet (canvas/scene).
   * Optionally activate a left-panel or right-panel route at the same time.
   * When rightRoute is omitted the right outlet is cleared so the canvas shows.
   */
  navigateTo(primaryRoute: string, leftRoute?: string, rightRoute?: string) {
    const outlets: Record<string, string[] | null> = {
      primary: [primaryRoute],
      right: rightRoute ? [rightRoute] : null,
    };
    if (leftRoute) {
      outlets['left'] = [leftRoute];
    }
    this.router.navigate([{ outlets }], { preserveFragment: true });
  }

  protected openPublicSettings(): void {
    this.router.navigate([{ outlets: { left: ['settings'] } }], {
      preserveFragment: true,
      queryParamsHandling: 'preserve',
      state: { settingsReturnUrl: this.router.url },
    });
  }

  /**
   * Check if a route is currently active in the primary outlet
   */
  isRouteActive(route: string): boolean {
    return this.router.routerState.root.firstChild?.component === undefined
      ? this.router.url.includes(route) || (this.router.url === '/' && route === 'intro')
      : this.router.routerState.root.firstChild?.routeConfig?.path === route;
  }

  ngAfterViewInit() {
    // Initialize both panels after view is initialized
    const leftPanel = this.leftPanelRef().nativeElement;
    const rightPanel = this.rightPanelRef().nativeElement;
    if (leftPanel && rightPanel) {
      this.applyPanelSplit(50, leftPanel, rightPanel);
    }

    window.addEventListener(START_SCANNING_UI_EVENT, this.onStartScanningListener);
  }

  reset() {
    appLogger.log('Resetting billboard settings');
  }

  onCanvasClick() {}

  dismissContractVarianceToast(): void {
    this.contractVarianceNotifier.dismissActiveToast();
  }

  onAudioHooksChange(value: boolean) {
    this.openingAudio.setAudioHooksEnabled(value);
  }

  startResize(event: PointerEvent) {
    if (event.button !== 0 || !event.isPrimary || this.activePointerId !== null) return;

    event.preventDefault();
    this.clearSplitTransitionTimer();
    this.isResizing.set(true);
    this.startX = event.clientX;
    this.startWidth = this.leftPanelWidth();
    this.activePointerId = event.pointerId;
    this.host.nativeElement.classList.add('resizing');
    const divider = this.dividerRef().nativeElement;
    divider.focus({ preventScroll: true });
    divider.setPointerCapture(event.pointerId);
  }

  resetSplit() {
    this.setSplit(50);
  }

  setSplit(leftWidth: number): void {
    this.endResize();
    this.clearSplitTransitionTimer();
    this.applyPanelSplit(
      Math.min(100, Math.max(0, leftWidth)),
      this.leftPanelRef().nativeElement,
      this.rightPanelRef().nativeElement,
    );
  }

  resize(event: PointerEvent): void {
    if (event.pointerId !== this.activePointerId) return;

    const usableWidth = Math.max(1, this.host.nativeElement.clientWidth - this.dividerRef().nativeElement.offsetWidth);
    const width = this.startWidth + ((event.clientX - this.startX) / usableWidth) * 100;
    this.applyPanelSplit(
      Math.min(100, Math.max(0, width)),
      this.leftPanelRef().nativeElement,
      this.rightPanelRef().nativeElement,
    );
  }

  endResize(event?: PointerEvent): void {
    if (event && event.pointerId !== this.activePointerId) return;

    const pointerId = this.activePointerId;
    this.activePointerId = null;
    this.isResizing.set(false);
    this.host.nativeElement.classList.remove('resizing');
    const divider = this.dividerRef().nativeElement;
    if (pointerId !== null && divider.hasPointerCapture(pointerId)) {
      divider.releasePointerCapture(pointerId);
    }
  }

  onSplitterKeydown(event: KeyboardEvent): void {
    let width: number;
    switch (event.key) {
      case 'ArrowLeft':
        width = this.leftPanelWidth() - 5;
        break;
      case 'ArrowRight':
        width = this.leftPanelWidth() + 5;
        break;
      case 'Home':
        width = 0;
        break;
      case 'End':
        width = 100;
        break;
      default:
        return;
    }
    event.preventDefault();
    this.setSplit(width);
  }

  ngOnDestroy() {
    this.endResize();
    window.removeEventListener(START_SCANNING_UI_EVENT, this.onStartScanningListener);
    this.clearSplitTransitionTimer();
    this.clearLookHintTimer();
    this.navigationSubscription.unsubscribe();
  }

  private animateSplitToStartScanningLayout(): void {
    if (this.isResizing()) {
      return;
    }

    const leftPanel = this.leftPanelRef().nativeElement;
    const rightPanel = this.rightPanelRef().nativeElement;
    if (!leftPanel || !rightPanel) {
      return;
    }

    this.clearSplitTransitionTimer();
    leftPanel.style.transition = AppComponent.PANEL_SPLIT_TRANSITION;
    rightPanel.style.transition = AppComponent.PANEL_SPLIT_TRANSITION;
    this.applyPanelSplit(AppComponent.START_SCANNING_LEFT_WIDTH, leftPanel, rightPanel);

    this.splitTransitionTimerId = window.setTimeout(() => {
      leftPanel.style.transition = '';
      rightPanel.style.transition = '';
      this.splitTransitionTimerId = null;
    }, AppComponent.PANEL_SPLIT_DURATION_MS + 40);
  }

  private applyPanelSplit(leftWidth: number, leftPanel: HTMLElement, rightPanel: HTMLElement): void {
    this.leftPanelWidth.set(leftWidth);
    leftPanel.style.width = `calc(${leftWidth}% - var(--splitter-width) * ${leftWidth / 100})`;
    leftPanel.style.flex = 'none';
    rightPanel.style.width = '';
    rightPanel.style.flex = '1 1 auto';
  }

  private clearSplitTransitionTimer(): void {
    this.leftPanelRef().nativeElement.style.transition = '';
    this.rightPanelRef().nativeElement.style.transition = '';
    if (this.splitTransitionTimerId === null) {
      return;
    }
    clearTimeout(this.splitTransitionTimerId);
    this.splitTransitionTimerId = null;
  }

  private configureColdBootLookHint(isActive: boolean): void {
    this.clearLookHintTimer();
    if (!isActive) {
      this.lookHintOpacity.set(0);
      return;
    }

    this.lookHintOpacity.set(0.82);
    this.lookHintTimerId = window.setTimeout(() => {
      this.lookHintOpacity.set(0);
      this.lookHintTimerId = null;
    }, AppComponent.LOOK_HINT_HIDE_DELAY_MS);
  }

  private clearLookHintTimer(): void {
    if (this.lookHintTimerId === null) {
      return;
    }
    clearTimeout(this.lookHintTimerId);
    this.lookHintTimerId = null;
  }
}
