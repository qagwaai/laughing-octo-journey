import { afterEach, describe, expect, it, vi } from 'vitest';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { NGT_STORE } from 'angular-three';

import { OPENING_STAGE_TIMINGS_MS } from '../../model/opening-sequence';
import ColdBootHudScene from './cold-boot-hud-scene';

function setup(variant?: string | null) {
  const camera = {
    position: { set: vi.fn() },
    lookAt: vi.fn(),
  };

  const mockStore = {
    camera: () => camera,
  };

  TestBed.configureTestingModule({
    imports: [ColdBootHudScene],
    providers: [
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: {
            queryParamMap: convertToParamMap(variant ? { variant } : {}),
          },
        },
      },
      { provide: NGT_STORE, useValue: mockStore },
    ],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
  });

  TestBed.overrideComponent(ColdBootHudScene, { set: { imports: [], template: '' } });

  const fixture = TestBed.createComponent(ColdBootHudScene);
  fixture.detectChanges();

  return { fixture, component: fixture.componentInstance, camera };
}

describe('ColdBootHudScene', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should initialize camera through the angular-three store', () => {
    const { camera } = setup();

    expect(camera.position.set).toHaveBeenCalledWith(0, 0, 6);
    expect(camera.lookAt).toHaveBeenCalledWith(0, 0, 0);
  });

  it('should expose default cold-boot content metadata', () => {
    const { component } = setup();

    expect(component['content']().hudTitle).toContain('COLD BOOT');
    expect(component['content']().aiLabel).toContain('AI LINK');
    expect(component['content']().systemChecks.length).toBe(3);
  });

  it('should reveal debris after first-view stage timing', async () => {
    vi.useFakeTimers();
    const { component } = setup();

    expect(component['stage']()).toBe(0);
    expect(component['visibleDebris']().length).toBe(0);

    await vi.advanceTimersByTimeAsync(OPENING_STAGE_TIMINGS_MS.firstViewReveal);

    expect(component['stage']()).toBe(2);
    expect(component['visibleDebris']().length).toBeGreaterThan(0);
    vi.useRealTimers();
  });

  it('should reveal AI stage at the configured timing', async () => {
    vi.useFakeTimers();
    const { component } = setup();

    await vi.advanceTimersByTimeAsync(OPENING_STAGE_TIMINGS_MS.aiReveal);

    expect(component['stage']()).toBe(3);
    expect(component['content']().aiTransmission).toContain('Fabrication Unit');
    vi.useRealTimers();
  });

  it('should fall back to cold-boot content for unknown variant query param', () => {
    const { component } = setup('unknown-variant');

    expect(component['content']().hudTitle).toContain('COLD BOOT');
  });
});
