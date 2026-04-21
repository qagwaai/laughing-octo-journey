import { AfterViewInit, ChangeDetectorRef, Component, CUSTOM_ELEMENTS_SCHEMA, ElementRef, computed, inject, NgZone, OnDestroy, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { Subscription, filter, map, startWith } from 'rxjs';
import { NgtsStats } from 'angular-three-soba/stats';
import { TweakpaneButton, TweakpaneCheckbox, TweakpaneColor, TweakpanePane } from 'angular-three-tweakpane';
import { NgtCanvas } from 'angular-three/dom';
import { RoutedScene } from './routed-scene';
import { OpeningAudioService } from './services';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  host: { class: 'block h-dvh w-full' },
  styles: `:host { display: block; height: 100vh; width: 100vw;
    & .stats {
				position: static !important;

				& canvas {
					margin-top: 0 !important;
				}
			}

    &.resizing {
      user-select: none;
    }
  }`,
  schemas: [CUSTOM_ELEMENTS_SCHEMA], 
  imports: [
    NgtCanvas, 
    TweakpanePane, 
    TweakpaneCheckbox, 
    TweakpaneColor, 
    TweakpaneButton, 
    NgtsStats, 
    RoutedScene, 
    RouterOutlet],
})
export class AppComponent implements AfterViewInit, OnDestroy {
  private static readonly LOOK_HINT_HIDE_DELAY_MS = 2000;
  protected host = inject(ElementRef);
  protected ngZone = inject(NgZone);
  protected cdr = inject(ChangeDetectorRef);
  protected router = inject(Router);
  protected openingAudio = inject(OpeningAudioService);
  protected leftPanelRef = viewChild.required<ElementRef>('leftPanel');
  protected rightPanelRef = viewChild.required<ElementRef>('rightPanel');
  protected dividerRef = viewChild.required<ElementRef>('divider');
  protected color = signal('#ff0000');
  protected stats = signal(false);
  protected follow = signal(true);
  protected lockX = signal(false);
  protected lockY = signal(false);
  protected lockZ = signal(false);
  protected audioHooksEnabled = signal(this.openingAudio.isAudioHooksEnabled());
  protected audioArmed = signal(this.openingAudio.isArmed());
  protected audioBedRunning = signal(this.openingAudio.isCinematicBedRunning());
  protected speechAvailable = signal(this.openingAudio.isSpeechSynthesisAvailable());
  protected audioArmedLabel = computed(() =>
    `Armed: ${this.openingAudio.isArmed() ? '●' : '○'}`
  );
  protected audioBedLabel = computed(() =>
    `Bed: ${this.openingAudio.isCinematicBedRunning() ? '●' : '○'}`
  );
  protected leftPanelWidth = signal(50);
  protected isResizing = signal(false);
  protected lookHintOpacity = signal(0);

  protected currentUrl = toSignal(
    this.router.events.pipe(
      filter((ev): ev is NavigationEnd => ev instanceof NavigationEnd),
      map((ev) => ev.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  protected isColdBootSceneActive = computed(() =>
    this.currentUrl().includes('opening-cold-boot') && !this.rightOutletActive(),
  );

  protected showColdBootLookHint = computed(() =>
    this.isColdBootSceneActive() && this.lookHintOpacity() > 0,
  );

  private startX = 0;
  private lookHintTimerId: number | null = null;
  private navigationSubscription: Subscription;

  protected rightOutletActive = toSignal(
    this.router.events.pipe(
      filter((ev): ev is NavigationEnd => ev instanceof NavigationEnd),
      map((ev) => ev.urlAfterRedirects.includes('right:')),
      startWith(this.router.url.includes('right:')),
    ),
    { initialValue: false },
  );

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

  /**
   * Check if a route is currently active in the primary outlet
   */
  isRouteActive(route: string): boolean {
    return this.router.routerState.root.firstChild?.component === undefined
      ? this.router.url.includes(route) || this.router.url === '/' && route === 'intro'
      : this.router.routerState.root.firstChild?.routeConfig?.path === route;
  }

  ngAfterViewInit() {
    // Initialize both panels after view is initialized
    const leftPanel = this.leftPanelRef().nativeElement;
    const rightPanel = this.rightPanelRef().nativeElement;
    if (leftPanel && rightPanel) {
      leftPanel.style.width = '50%';
      leftPanel.style.flex = 'none';
      rightPanel.style.width = '50%';
      rightPanel.style.flex = 'none';
    }

    // Hide stats by default - run outside Angular zone then back inside for DOM manipulation
    this.ngZone.runOutsideAngular(() => {
      setTimeout(() => {
        this.ngZone.run(() => {
          const statsElement = this.host.nativeElement.querySelector('.stats');
          if (statsElement) {
            statsElement.style.display = 'none';
          }
        });
      }, 1000);
    });
  }

  reset() {
		console.log("Resetting billboard settings");
	}

  onCanvasClick() {}

  onStatsChange(value: boolean) {
    var statsElement = this.host.nativeElement.querySelector('.stats');
    if (statsElement) {
      statsElement.style.display = value ? 'block' : 'none';
    }
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
    const leftPanel = this.leftPanelRef().nativeElement;
    const rightPanel = this.rightPanelRef().nativeElement;
    
    if (leftPanel && rightPanel) {
      leftPanel.style.width = '50%';
      leftPanel.style.flex = 'none';
      rightPanel.style.width = '50%';
      rightPanel.style.flex = 'none';
      
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
        const newWidth = this.leftPanelWidth() + (deltaX / containerWidth) * 100;

        // Constrain width between 20% and 80%
        if (newWidth >= 20 && newWidth <= 80) {
          this.leftPanelWidth.set(newWidth);
          this.startX = event.clientX;
          // Directly set the DOM element width for both panels
          const leftPanel = this.leftPanelRef().nativeElement;
          const rightPanel = this.rightPanelRef().nativeElement;
          if (leftPanel && rightPanel) {
            const rightWidth = 100 - newWidth;
            leftPanel.style.width = newWidth + '%';
            leftPanel.style.flex = 'none';
            rightPanel.style.width = rightWidth + '%';
            rightPanel.style.flex = 'none';
          }
        }
      });
    } catch (error) {
      // Silently ignore errors during resize
    }
  };

  private onMouseUpListener = (event: MouseEvent) => {
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
    this.clearLookHintTimer();
    this.navigationSubscription.unsubscribe();
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
