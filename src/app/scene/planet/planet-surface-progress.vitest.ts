import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { PlanetSurfaceProgress } from './planet-surface-progress';
import { PlanetTextureCache } from './planet-texture-cache';

function setup(embedded: boolean) {
  const planetTextureCache = {
    catalog: {
      active: signal([]),
      issues: signal([]),
      pending: signal(0),
      ready: signal(new Set()),
      canRetry: () => false,
      retryActive: () => {},
    },
    isBaking: signal(false),
    proceduralPending: signal(0),
    progress: signal(1),
  };

  TestBed.configureTestingModule({
    imports: [PlanetSurfaceProgress],
    providers: [{ provide: PlanetTextureCache, useValue: planetTextureCache }],
  });

  const fixture = TestBed.createComponent(PlanetSurfaceProgress);
  fixture.componentRef.setInput('embedded', embedded);
  fixture.detectChanges();
  return fixture;
}

describe('PlanetSurfaceProgress', () => {
  it('shows a collapsed, keyboard-focusable catalog disclosure in the embedded Viewer', () => {
    const fixture = setup(true);
    const disclosure = fixture.nativeElement.querySelector(
      '[data-testid="viewer-catalog-sources"]',
    ) as HTMLDetailsElement;
    const summary = disclosure.querySelector('summary') as HTMLElement;

    expect(disclosure).not.toBeNull();
    expect(disclosure.open).toBe(false);
    expect(summary.tabIndex).toBe(0);
    summary.focus();
    expect(document.activeElement).toBe(summary);
  });

  it('displays the exact MPC acknowledgment and secure source links', () => {
    const fixture = setup(true);
    const disclosure = fixture.nativeElement.querySelector('[data-testid="viewer-catalog-sources"]') as HTMLElement;
    const expectedAcknowledgment =
      "This research has made use of data and/or services provided by the International Astronomical Union's Minor Planet Center.";
    const expectedLinks = [
      'https://www.minorplanetcenter.net/iau/MPCORB/AllCometEls.txt',
      'https://docs.minorplanetcenter.net/mpc-ops-docs/orbits/comet-orbit-format/',
      'https://ssd.jpl.nasa.gov/sats/elem/',
      'https://ssd.jpl.nasa.gov/sats/discovery.html',
      'https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=2026%20ED138',
    ];

    expect(disclosure.textContent).toContain(expectedAcknowledgment);
    const links = Array.from(disclosure.querySelectorAll('a'));
    expect(links.map((link) => link.href)).toEqual(expectedLinks);
    expect(links.every((link) => link.target === '_blank' && link.rel === 'noopener noreferrer')).toBe(true);
  });

  it('keeps the catalog disclosure out of non-embedded planet detail views', () => {
    const fixture = setup(false);
    expect(fixture.nativeElement.querySelector('[data-testid="viewer-catalog-sources"]')).toBeNull();
  });
});
