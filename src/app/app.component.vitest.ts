import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppComponent } from './app.component';
import { PlanetCloudSettings } from './scene/planet/planet-clouds';
import { SplashState } from './scene/splash-state';
import { OpeningAudioService } from './services';
import { RenderStatsService } from './services/render-stats.service';
import { SceneVisibilityService } from './services/scene-visibility.service';

function createOpeningAudioMock() {
  return {
    isAudioHooksEnabled: () => false,
    isArmed: () => false,
    isCinematicBedRunning: () => false,
    isSpeechSynthesisAvailable: () => false,
    setAudioHooksEnabled: vi.fn(),
  };
}

function setup() {
  const routerEvents$ = new Subject<any>();
  const routerMock = {
    events: routerEvents$.asObservable(),
    url: '/intro',
    navigate: vi.fn().mockResolvedValue(true),
    routerState: {
      root: {
        firstChild: null,
      },
    },
  };
  const openingAudioMock = createOpeningAudioMock();

  TestBed.configureTestingModule({
    imports: [AppComponent],
    providers: [
      { provide: Router, useValue: routerMock },
      { provide: OpeningAudioService, useValue: openingAudioMock },
    ],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
  });

  TestBed.overrideComponent(AppComponent, {
    set: {
      imports: [],
      template: `
				<div #leftPanel class="left-panel"></div>
				<div #divider class="divider"></div>
				<div #rightPanel class="right-panel"></div>
				<div class="stats"></div>
			`,
    },
  });

  const fixture = TestBed.createComponent(AppComponent);
  fixture.detectChanges();
  const host: HTMLElement = fixture.nativeElement;
  const divider = host.querySelector<HTMLElement>('.divider')!;
  const capturedPointers = new Set<number>();
  divider.setPointerCapture = vi.fn((id: number) => capturedPointers.add(id));
  divider.hasPointerCapture = vi.fn((id: number) => capturedPointers.has(id));
  divider.releasePointerCapture = vi.fn((id: number) => capturedPointers.delete(id));
  Object.defineProperty(host, 'clientWidth', { value: 1048 });
  Object.defineProperty(divider, 'offsetWidth', { value: 48 });

  return { fixture, component: fixture.componentInstance, routerMock, routerEvents$, host, divider };
}

describe('AppComponent (Vitest)', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should create the real component', () => {
    const { component } = setup();
    expect(component).toBeTruthy();
  });

  it('keeps the habitat spinning while camera drift and clouds are paused, but idles when hidden or static', () => {
    const { component } = setup();
    const splash = TestBed.inject(SplashState);
    const visibility = TestBed.inject(SceneVisibilityService);
    TestBed.inject(PlanetCloudSettings).enabled.set(false);
    splash.foreground.set('station');
    splash.status.set('ready');
    splash.reducedMotion.set(false);
    splash.documentHidden.set(false);
    splash.orbitPaused.set(true);
    expect(component['canvasFrameloop']()).toBe('always');
    visibility.setRightOutletActive(true);
    expect(component['canvasFrameloop']()).toBe('demand');
    visibility.setRightOutletActive(false);
    splash.reducedMotion.set(true);
    expect(component['canvasFrameloop']()).toBe('demand');
    splash.reducedMotion.set(false);
    splash.documentHidden.set(true);
    expect(component['canvasFrameloop']()).toBe('demand');
    splash.documentHidden.set(false);
    splash.status.set('static');
    expect(component['canvasFrameloop']()).toBe('demand');
    splash.status.set('ready');
    splash.foreground.set('asteroid-mining-rig');
    expect(component['canvasFrameloop']()).toBe('demand');
  });

  it('offers the public gear only on public left-pane routes', () => {
    const { component, fixture, routerEvents$ } = setup();
    for (const [url, visible] of [
      ['/splash(left:intro)', true],
      ['/splash(left:login)', true],
      ['/splash(left:registration)', true],
      ['/splash(left:settings)', false],
      ['/splash(left:game-main)', false],
      ['/ship-exterior-view(left:game-main)', false],
    ] as const) {
      routerEvents$.next(new NavigationEnd(1, url, url));
      fixture.detectChanges();
      expect(component['publicSettingsVisible']()).toBe(visible);
    }
  });

  it('should react to the shared performance setting without navigation', () => {
    const { fixture, host } = setup();
    const renderStats = TestBed.inject(RenderStatsService);

    expect(renderStats.enabled()).toBe(false);
    expect(host.classList.contains('show-render-stats')).toBe(false);
    renderStats.setEnabled(true);
    fixture.detectChanges();
    expect(host.classList.contains('show-render-stats')).toBe(true);
    renderStats.setEnabled(false);
    fixture.detectChanges();
    expect(host.classList.contains('show-render-stats')).toBe(false);
  });

  it('should enter and exit resizing mode', () => {
    const { component } = setup();
    const host = (component as any).host.nativeElement as HTMLElement;

    component.startResize(new PointerEvent('pointerdown', { clientX: 120, pointerId: 1, isPrimary: true }));
    expect((component as any).isResizing()).toBe(true);
    expect(host.classList.contains('resizing')).toBe(true);

    (component as any).resetSplit();
    expect((component as any).isResizing()).toBe(false);
    expect(host.classList.contains('resizing')).toBe(false);
    expect((component as any).leftPanelWidth()).toBe(50);
  });

  it('should maximize either pane and restore the equal split', () => {
    const { component, host } = setup();
    const leftPanel = host.querySelector<HTMLElement>('.left-panel')!;
    for (const width of [0, 100, 50]) {
      component.setSplit(width);
      expect(leftPanel.style.width).toBe(`calc(${width}% - var(--splitter-width) * ${width / 100})`);
    }
  });

  it.each(['mouse', 'touch', 'pen'])('should drag back from either edge with %s input', (pointerType) => {
    const { component, divider, host } = setup();
    const leftPanel = host.querySelector<HTMLElement>('.left-panel')!;
    for (const [initialWidth, delta] of [
      [0, 250],
      [100, -250],
    ]) {
      component.setSplit(initialWidth);
      component.startResize(
        new PointerEvent('pointerdown', {
          pointerId: 1,
          pointerType,
          isPrimary: true,
          clientX: 500,
        }),
      );
      expect(divider.setPointerCapture).toHaveBeenCalledWith(1);
      component.resize(new PointerEvent('pointermove', { pointerId: 1, clientX: 500 + delta }));
      const expectedWidth = initialWidth + delta / 10;
      expect(leftPanel.style.width).toBe(`calc(${expectedWidth}% - var(--splitter-width) * ${expectedWidth / 100})`);
      component.endResize(new PointerEvent('pointerup', { pointerId: 1 }));
      expect(divider.releasePointerCapture).toHaveBeenCalledWith(1);
      expect(host.classList.contains('resizing')).toBe(false);
    }
  });

  it('should clamp overshooting drags and ignore other pointers', () => {
    const { component, host } = setup();
    const leftPanel = host.querySelector<HTMLElement>('.left-panel')!;
    component.startResize(new PointerEvent('pointerdown', { pointerId: 1, isPrimary: true, clientX: 500 }));
    component.resize(new PointerEvent('pointermove', { pointerId: 2, clientX: 1000 }));
    expect(leftPanel.style.width).toBe('calc(50% - var(--splitter-width) * 0.5)');
    component.endResize(new PointerEvent('pointercancel', { pointerId: 2 }));
    expect(host.classList.contains('resizing')).toBe(true);
    component.resize(new PointerEvent('pointermove', { pointerId: 1, clientX: 2000 }));
    expect(leftPanel.style.width).toBe('calc(100% - var(--splitter-width) * 1)');
    component.resize(new PointerEvent('pointermove', { pointerId: 1, clientX: -1000 }));
    expect(leftPanel.style.width).toBe('calc(0% - var(--splitter-width) * 0)');
    component.endResize(new PointerEvent('pointercancel', { pointerId: 1 }));
    component.resize(new PointerEvent('pointermove', { pointerId: 1, clientX: 500 }));
    expect(leftPanel.style.width).toBe('calc(0% - var(--splitter-width) * 0)');
    expect(host.classList.contains('resizing')).toBe(false);
  });

  it('should reject secondary input and support keyboard resizing', () => {
    const { component, host, divider } = setup();
    component.startResize(new PointerEvent('pointerdown', { button: 2, pointerId: 1, isPrimary: true }));
    component.startResize(new PointerEvent('pointerdown', { pointerId: 2, isPrimary: false }));
    expect(divider.setPointerCapture).not.toHaveBeenCalled();
    const leftPanel = host.querySelector<HTMLElement>('.left-panel')!;
    for (const [key, width] of [
      ['Home', 0],
      ['ArrowRight', 5],
      ['End', 100],
      ['ArrowLeft', 95],
    ] as const) {
      const event = new KeyboardEvent('keydown', { key, cancelable: true });
      component.onSplitterKeydown(event);
      expect(event.defaultPrevented).toBe(true);
      expect(leftPanel.style.width).toBe(`calc(${width}% - var(--splitter-width) * ${width / 100})`);
    }
  });

  it('should release pointer capture when reset or destroyed and cancel split animations', () => {
    const { component, fixture, divider, host } = setup();
    const leftPanel = host.querySelector<HTMLElement>('.left-panel')!;
    window.dispatchEvent(new Event('cold-boot:start-scanning'));
    expect(leftPanel.style.transition).toContain('700ms');
    component.startResize(new PointerEvent('pointerdown', { pointerId: 1, isPrimary: true }));
    expect(leftPanel.style.transition).toBe('');
    component.resetSplit();
    expect(divider.releasePointerCapture).toHaveBeenCalledWith(1);
    component.startResize(new PointerEvent('pointerdown', { pointerId: 2, isPrimary: true }));
    fixture.destroy();
    expect(divider.releasePointerCapture).toHaveBeenCalledWith(2);
  });

  it('should navigate using primary and optional outlets', async () => {
    const { component, routerMock } = setup();

    (component as any).navigateTo('game-main', 'ship-hangar', 'market-hub');
    expect(routerMock.navigate).toHaveBeenCalledWith(
      [
        {
          outlets: {
            primary: ['game-main'],
            right: ['market-hub'],
            left: ['ship-hangar'],
          },
        },
      ],
      { preserveFragment: true },
    );

    (component as any).navigateTo('intro');
    expect(routerMock.navigate).toHaveBeenCalledWith(
      [
        {
          outlets: {
            primary: ['intro'],
            right: null,
          },
        },
      ],
      { preserveFragment: true },
    );
  });

  it('should react to cold-boot navigation state changes', () => {
    const { component, routerEvents$ } = setup();

    routerEvents$.next(new NavigationEnd(1, '/opening-cold-boot', '/opening-cold-boot'));
    expect((component as any).isColdBootSceneActive()).toBe(true);
    expect((component as any).showColdBootLookHint()).toBe(true);

    routerEvents$.next(new NavigationEnd(2, '/intro', '/intro'));
    expect((component as any).isColdBootSceneActive()).toBe(false);
  });

  it('should keep the scan overlay from hiding the scene', () => {
    const { routerEvents$ } = setup();
    const sceneVisibility = TestBed.inject(SceneVisibilityService);

    routerEvents$.next(
      new NavigationEnd(
        1,
        '/ship-exterior-view(right:opening-cold-boot-scan)',
        '/ship-exterior-view(right:opening-cold-boot-scan)',
      ),
    );
    expect(sceneVisibility.isSceneHidden()).toBe(false);
    expect(sceneVisibility.sceneFrameloop()).toBe('always');

    routerEvents$.next(
      new NavigationEnd(2, '/ship-exterior-view(right:market-hub)', '/ship-exterior-view(right:market-hub)'),
    );
    expect(sceneVisibility.isSceneHidden()).toBe(true);
    expect(sceneVisibility.sceneFrameloop()).toBe('demand');
  });
});
