import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMockSessionService } from '../../../testing';
import { setActiveLocaleCode } from '../../i18n/locale';
import type { CanonicalViewerBody, SolarSystemGetResponse } from '../../model/solar-system-get';
import { MarketService } from '../../services/market.service';
import { SessionService } from '../../services/session.service';
import { ShipService } from '../../services/ship.service';
import { SolarSystemService } from '../../services/solar-system.service';
import { ViewerTargetService } from '../../services/viewer-target.service';
import SolarSystemDetailsPage from './solar-system-details';

function body(bodyType: CanonicalViewerBody['bodyType'], index: number): CanonicalViewerBody {
  return {
    id: `body-${index}`,
    bodyType,
    surfaceArchetype:
      bodyType === 'star'
        ? 'star'
        : bodyType === 'comet' || bodyType === 'asteroid'
          ? 'asteroid'
          : bodyType === 'moon'
            ? 'rocky-moon'
            : bodyType === 'tno'
              ? 'icy-moon'
              : 'rocky',
    state: 'unscanned',
    displayName: `Body ${index}`,
    spatial: { solarSystemId: 'sol', frame: 'barycentric', positionKm: { x: index, y: 0, z: 0 }, epochMs: 0 },
  };
}

function setup(bodies: CanonicalViewerBody[] = []) {
  TestBed.configureTestingModule({
    imports: [SolarSystemDetailsPage],
    providers: [
      { provide: SessionService, useValue: createMockSessionService('test-session') },
      {
        provide: SolarSystemService,
        useValue: {
          getSolarSystem: vi.fn((_request: unknown, callback: (response: SolarSystemGetResponse) => void) =>
            callback({
              success: true,
              message: '',
              correlationId: 'details-test',
              requestIdentity: { operation: 'solar-system-get', entityType: 'sol', containerId: 'sol' },
              stars: [],
              bodies,
            }),
          ),
        },
      },
      { provide: MarketService, useValue: { listMarketsByLocation: vi.fn() } },
      { provide: ShipService, useValue: { listShipsByOwner: vi.fn() } },
      {
        provide: Router,
        useValue: {
          getCurrentNavigation: () => ({ extras: { state: { playerName: 'Pioneer' } } }),
          navigate: vi.fn(),
        },
      },
      { provide: ActivatedRoute, useValue: { paramMap: of({ get: () => 'sol' }) } },
    ],
  });
  TestBed.overrideComponent(SolarSystemDetailsPage, {
    set: { imports: [], schemas: [CUSTOM_ELEMENTS_SCHEMA] },
  });
  const fixture = TestBed.createComponent(SolarSystemDetailsPage);
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance };
}

describe('SolarSystemDetailsPage body groups', () => {
  afterEach(() => setActiveLocaleCode('en'));

  it('includes every canonical type in the requested order and preserves distance-view rows', () => {
    const bodies = (['star', 'planet', 'dwarf-planet', 'moon', 'asteroid', 'tno', 'comet'] as const).map(
      (type, index) => body(type, index),
    );
    const { component } = setup(bodies);
    expect(component['typeGroups']().map((group) => group.type)).toEqual(bodies.map((entry) => entry.bodyType));
    expect(new Set(component['typeGroups']().flatMap((group) => group.rows.map((row) => row.id)))).toEqual(
      new Set(component['sortedByDistance']().map((row) => row.id)),
    );
  });

  it('renders the three empty groups at zero count even when the entire system is empty', () => {
    const { fixture, component } = setup();
    expect(component['typeGroups']().map((group) => [group.label, group.rows.length])).toEqual([
      ['Dwarf Planet', 0],
      ['Trans-Neptunian object', 0],
      ['Comet', 0],
    ]);
    const element: HTMLElement = fixture.nativeElement;
    expect(
      Array.from(element.querySelectorAll('.details-type-header__count'), (node) => node.textContent?.trim()),
    ).toEqual(['0', '0', '0']);
    component['toggleSection']('comet');
    fixture.detectChanges();
    expect(element.querySelector('[data-testid="details-table-comet"] tbody')?.children.length).toBe(0);
    component['setViewMode']('distance');
    fixture.detectChanges();
    expect(element.querySelector('[data-testid="details-empty"]')).not.toBeNull();
    component['setViewMode']('type');
    fixture.detectChanges();
    expect(element.querySelectorAll('.details-type-header').length).toBe(3);
  });

  it.each(['dwarf-planet', 'tno', 'comet'] as const)('targets a %s from its group', (type) => {
    const selected = body(type, 1);
    const { fixture, component } = setup([selected]);
    component['toggleSection'](type);
    fixture.detectChanges();
    const button: HTMLButtonElement | null = fixture.nativeElement.querySelector(
      `[data-testid="details-table-${type}"] .details-target-btn`,
    );
    expect(button).not.toBeNull();
    button!.click();
    fixture.detectChanges();
    expect(TestBed.inject(ViewerTargetService).targetBodyId()).toBe(selected.id);
    expect(button!.getAttribute('aria-pressed')).toBe('true');
  });

  it('localizes the new group names in Italian', () => {
    setActiveLocaleCode('it');
    const { component } = setup();
    expect(component['typeGroups']().map((group) => group.label)).toEqual([
      'Pianeta nano',
      'Oggetto transnettuniano',
      'Cometa',
    ]);
  });
});
