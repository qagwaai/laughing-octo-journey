import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  computed,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  inject,
  NgZone,
  OnDestroy,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { NgtsStats } from 'angular-three-soba/stats';
import { TweakpaneButton, TweakpaneCheckbox, TweakpaneColor, TweakpanePane } from 'angular-three-tweakpane';
import { NgtCanvas } from 'angular-three/dom';
import { filter, map, startWith, Subscription } from 'rxjs';
import { RoutedScene } from './routed-scene';
import { LeftPaneMissionGuidanceOverlay } from './component/left-pane-mission-guidance-overlay';
import { OpeningAudioService } from './services';
import { ContractVarianceNotifierService } from './services/contract-variance-notifier.service';
import { appLogger } from './services/logger';
import { RenderStatsService } from './services/render-stats.service';
import { SceneVisibilityService } from './services/scene-visibility.service';

const START_SCANNING_UI_EVENT = 'cold-boot:start-scanning';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  host: { class: 'block h-dvh w-full' },
  styles: `
    :host {
      display: block;
      height: 100vh;
      width: 100vw;
      & .stats {
        display: none;
        position: static !important;

        & canvas {
          margin-top: 0 !important;
        }
      }

      &.resizing {
        user-select: none;
      }
    }
  `,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [
    NgtCanvas,
    TweakpanePane,
    TweakpaneCheckbox,
    TweakpaneColor,
    TweakpaneButton,
    NgtsStats,
    RoutedScene,
    LeftPaneMissionGuidanceOverlay,
    RouterOutlet,
  ],
})
export class AppComponent implements AfterViewInit, OnDestroy {
  private static readonly LOOK_HINT_HIDE_DELAY_MS = 2000;
  private static readonly START_SCANNING_LEFT_WIDTH = 33;
  private static readonly DIVIDER_WIDTH_PX = 20;
  private static readonly PANEL_SPLIT_DURATION_MS = 700;
  private static readonly PANEL_SPLIT_TRANSITION = `width ${AppComponent.PANEL_SPLIT_DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`;
  protected host = inject(ElementRef);
  protected ngZone = inject(NgZone);
  protected cdr = inject(ChangeDetectorRef);
  protected router = inject(Router);
  protected openingAudio = inject(OpeningAudioService);
  protected contractVarianceNotifier = inject(ContractVarianceNotifierService);
  protected renderStats = inject(RenderStatsService);
  private sceneVisibility = inject(SceneVisibilityService);
  protected leftPanelRef = viewChild.required<ElementRef>('leftPanel');
  protected rightPanelRef = viewChild.required<ElementRef>('rightPanel');
  protected dividerRef = viewChild.required<ElementRef>('divider');
  protected color = signal('#ff0000');
  protected stats = this.renderStats.enabled;
  protected readonly persistentStatsOptions = { parent: this.host, domClass: 'stats' };
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

  protected showColdBootLookHint = computed(() => this.isColdBootSceneActive() && this.lookHintOpacity() > 0);
  protected contractVarianceToast = this.contractVarianceNotifier.activeToast;

  private startX = 0;
  private lookHintTimerId: number | null = null;
  private splitTransitionTimerId: number | null = null;
  private statsSyncTimerId: number | null = null;
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
      map((ev) => ev.urlAfterRedirects.includes('right:')),
      startWith(this.router.url.includes('right:')),
    )
    .subscribe((active) => {
      this.sceneVisibility.setRightOutletActive(active);
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
        this.scheduleStatsVisibilitySync();
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
      leftPanel.style.width = '50%';
      leftPanel.style.flex = 'none';
      rightPanel.style.width = '';
      rightPanel.style.flex = '1 1 auto';
    }

    window.addEventListener(START_SCANNING_UI_EVENT, this.onStartScanningListener);
    this.onStatsChange(this.stats());

  }

  reset() {
    appLogger.log('Resetting billboard settings');
  }

  onCanvasClick() {}

  dismissContractVarianceToast(): void {
    this.contractVarianceNotifier.dismissActiveToast();
  }

  onStatsChange(value: boolean) {
    this.renderStats.setEnabled(value);
    this.applyStatsVisibility(value);
  }

  private applyStatsVisibility(value: boolean): void {
    const statsElements = this.host.nativeElement.querySelectorAll('.stats');
    statsElements.forEach((element: HTMLElement) => {
      element.style.display = value ? 'block' : 'none';
    });
  }

  private scheduleStatsVisibilitySync(): void {
    if (this.statsSyncTimerId !== null) {
      window.clearTimeout(this.statsSyncTimerId);
    }

    this.statsSyncTimerId = window.setTimeout(() => {
      this.applyStatsVisibility(this.stats());
      this.statsSyncTimerId = null;
    }, 0);
  }

  onAudioHooksChange(value: boolean) {
    this.openingAudio.setAudioHooksEnabled(value);
  }

  startResize(event: MouseEvent) {
    this.isResizing.set(true);
    this.startX = event.clientX;
    this.host.nativeElement.classList.add('resizing');

    // Attach event listeners directly to document (they'll be removed on mouseup)
    document.addEventListener('mousemove', this.onMouseMoveListener);
    document.addEventListener('mouseup', this.onMouseUpListener);
  }

  resetSplit() {
    // Reset the state
    this.isResizing.set(false);
    this.host.nativeElement.classList.remove('resizing');

    this.leftPanelWidth.set(50);
    this.clearSplitTransitionTimer();
    const leftPanel = this.leftPanelRef().nativeElement;
    const rightPanel = this.rightPanelRef().nativeElement;

    if (leftPanel && rightPanel) {
      leftPanel.style.width = '50%';
      leftPanel.style.flex = 'none';
      rightPanel.style.width = '';
      rightPanel.style.flex = '1 1 auto';

      // Force a reflow to trigger layout recalculation
      void leftPanel.offsetHeight;
      void rightPanel.offsetHeight;
      void this.host.nativeElement.offsetHeight;
    }
  }

  private onMouseMoveListener = (event: MouseEvent) => {
    if (!this.isResizing()) return;

    try {
      this.ngZone.run(() => {
        const container = this.host.nativeElement;
        const deltaX = event.clientX - this.startX;
        const containerWidth = container.offsetWidth;
        const usableWidth = Math.max(1, containerWidth - AppComponent.DIVIDER_WIDTH_PX);
        const newWidth = this.leftPanelWidth() + (deltaX / usableWidth) * 100;

        // Constrain width between 20% and 80%
        if (newWidth >= 20 && newWidth <= 80) {
          this.leftPanelWidth.set(newWidth);
          this.startX = event.clientX;
          // Directly set the DOM element width for both panels
          const leftPanel = this.leftPanelRef().nativeElement;
          const rightPanel = this.rightPanelRef().nativeElement;
          if (leftPanel && rightPanel) {
            leftPanel.style.width = newWidth + '%';
            leftPanel.style.flex = 'none';
            rightPanel.style.width = '';
            rightPanel.style.flex = '1 1 auto';
          }
        }
      });
    } catch {
      // Silently ignore errors during resize
    }
  };

  private onMouseUpListener = (_event: MouseEvent) => {
    if (this.isResizing()) {
      this.isResizing.set(false);
      this.host.nativeElement.classList.remove('resizing');

      // Remove event listeners
      document.removeEventListener('mousemove', this.onMouseMoveListener);
      document.removeEventListener('mouseup', this.onMouseUpListener);
    }
  };

  ngOnDestroy() {
    // Clean up event listeners
    document.removeEventListener('mousemove', this.onMouseMoveListener);
    document.removeEventListener('mouseup', this.onMouseUpListener);
    window.removeEventListener(START_SCANNING_UI_EVENT, this.onStartScanningListener);
    this.clearSplitTransitionTimer();
    this.clearLookHintTimer();
    if (this.statsSyncTimerId !== null) {
      clearTimeout(this.statsSyncTimerId);
      this.statsSyncTimerId = null;
    }
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
    leftPanel.style.width = `${leftWidth}%`;
    leftPanel.style.flex = 'none';
    rightPanel.style.width = '';
    rightPanel.style.flex = '1 1 auto';
  }

  private clearSplitTransitionTimer(): void {
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
