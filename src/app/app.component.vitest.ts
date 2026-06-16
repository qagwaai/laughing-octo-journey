import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';

import { AppComponent } from './app.component';
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

  return { fixture, component: fixture.componentInstance, routerMock, routerEvents$ };
}

describe('AppComponent (Vitest)', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should create the real component', () => {
    const { component } = setup();
    expect(component).toBeTruthy();
  });

  it('should toggle stats visibility in onStatsChange', () => {
    const { component } = setup();
    const renderStats = TestBed.inject(RenderStatsService);
    const statsElement = (component as any).host.nativeElement.querySelector('.stats') as HTMLElement;

    expect(renderStats.enabled()).toBe(false);
    expect(statsElement.style.display).toBe('none');
    (component as any).onStatsChange(false);
    expect(renderStats.enabled()).toBe(false);
    expect(statsElement.style.display).toBe('none');
    (component as any).onStatsChange(true);
    expect(renderStats.enabled()).toBe(true);
    expect(statsElement.style.display).toBe('block');
  });

  it('should enter and exit resizing mode', () => {
    const { component } = setup();
    const host = (component as any).host.nativeElement as HTMLElement;

    (component as any).startResize(new MouseEvent('mousedown', { clientX: 120 }));
    expect((component as any).isResizing()).toBe(true);
    expect(host.classList.contains('resizing')).toBe(true);

    (component as any).resetSplit();
    expect((component as any).isResizing()).toBe(false);
    expect(host.classList.contains('resizing')).toBe(false);
    expect((component as any).leftPanelWidth()).toBe(50);
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

    routerEvents$.next(new NavigationEnd(1, '/ship-exterior-view(right:opening-cold-boot-scan)', '/ship-exterior-view(right:opening-cold-boot-scan)'));
    expect(sceneVisibility.isSceneHidden()).toBe(false);
    expect(sceneVisibility.sceneFrameloop()).toBe('always');

    routerEvents$.next(new NavigationEnd(2, '/ship-exterior-view(right:market-hub)', '/ship-exterior-view(right:market-hub)'));
    expect(sceneVisibility.isSceneHidden()).toBe(true);
    expect(sceneVisibility.sceneFrameloop()).toBe('demand');
  });
});
