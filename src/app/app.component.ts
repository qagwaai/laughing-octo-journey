import { AfterViewInit, ChangeDetectorRef, Component, CUSTOM_ELEMENTS_SCHEMA, ElementRef, inject, NgZone, OnDestroy, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { NgtsStats } from 'angular-three-soba/stats';
import { TweakpaneButton, TweakpaneCheckbox, TweakpaneColor, TweakpanePane } from 'angular-three-tweakpane';
import { NgtCanvas } from 'angular-three/dom';
import { RoutedScene } from './routed-scene';

@Component({
  selector: 'app-root',
  template: `
    <div class="flex h-dvh w-full" [style.cursor]="isResizing() ? 'col-resize' : 'default'">
      <!-- Left Content Area with Router Outlet -->
      <div class="bg-gray-900 text-white overflow-auto flex flex-col" #leftPanel>
        <router-outlet name="left" />
        <div class="p-4">
          <tweakpane-pane title="Options" [container]="host">
              <tweakpane-checkbox [(value)]="stats" label="Show Stats" (valueChange)="onStatsChange($event)" />
              <tweakpane-checkbox [(value)]="follow" label="Follow" />
              <tweakpane-checkbox [(value)]="lockX" label="Lock X" />
              <tweakpane-checkbox [(value)]="lockY" label="Lock Y" />
              <tweakpane-checkbox [(value)]="lockZ" label="Lock Z" />
              <tweakpane-color [(value)]="color" label="Color" />
              <tweakpane-button title="Reset" (click)="reset()" />
          </tweakpane-pane>
        </div>
        <nav class="mt-auto p-4 border-t border-gray-700">
          <button 
            class="w-full mb-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
            (click)="resetSplit()"
          >
            Reset Split (50/50)
          </button>
          <ul class="flex items-center gap-4">
            <li>
              <a
                (click)="navigateTo('intro')"
                [class.text-blue-500]="isRouteActive('intro')"
                class="underline hover:text-blue-400 cursor-pointer"
              >
                intro
              </a>
            </li>
            <li>
              <a
                (click)="navigateTo('knot')"
                [class.text-blue-500]="isRouteActive('knot')"
                class="underline hover:text-blue-400 cursor-pointer"
              >
                knot
              </a>
            </li>
            <li>
              <a
                (click)="navigateTo('scene-graph')"
                [class.text-blue-500]="isRouteActive('scene-graph')"
                class="underline hover:text-blue-400 cursor-pointer"
              >
                scene graph
              </a>
            </li>
          </ul>
        </nav>
      </div>

      <!-- Divider -->
      <div 
        #divider
        class="bg-gray-700 hover:bg-blue-500 cursor-col-resize transition-colors"
        style="width: 2px; pointer-events: auto; user-select: none; z-index: 10; flex-shrink: 0;"
        (mousedown)="startResize($event)"
        (dblclick)="resetSplit()"
      ></div>

      <!-- Right Canvas Area -->
      <div class="flex-1" #rightPanel>
        @if (rightOutletActive()) {
          <div class="h-full overflow-auto bg-gray-950 text-white">
            <router-outlet name="right" />
          </div>
        } @else {
          <ngt-canvas
            #canvas
            [stats]="{ parent: host, domClass: 'stats' }"
            shadows 
            [camera]="{ position: [5, 5, 5] }" 
            [lookAt]="[0, 0, 0]"
            (click)="onCanvasClick()"
          >
            <app-routed-scene *canvasContent />
          </ngt-canvas>
        }
      </div>
    </div>
  `,
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
  protected host = inject(ElementRef);
  protected ngZone = inject(NgZone);
  protected cdr = inject(ChangeDetectorRef);
  protected router = inject(Router);
  protected leftPanelRef = viewChild.required<ElementRef>('leftPanel');
  protected rightPanelRef = viewChild.required<ElementRef>('rightPanel');
  protected dividerRef = viewChild.required<ElementRef>('divider');
  protected color = signal('#ff0000');
  protected stats = signal(false);
  protected follow = signal(true);
  protected lockX = signal(false);
  protected lockY = signal(false);
  protected lockZ = signal(false);
  protected leftPanelWidth = signal(50);
  protected isResizing = signal(false);
  private startX = 0;

  protected rightOutletActive = toSignal(
    this.router.events.pipe(
      filter((ev): ev is NavigationEnd => ev instanceof NavigationEnd),
      map((ev) => ev.urlAfterRedirects.includes('right:')),
      startWith(this.router.url.includes('right:')),
    ),
    { initialValue: false },
  );

  constructor() { 
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
  }
}
