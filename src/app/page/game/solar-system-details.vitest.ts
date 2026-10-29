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
import { ViewerGroupVisibilityService } from '../../services/viewer-group-visibility.service';
import SolarSystemDetailsPage from './solar-system-details';

function body(bodyType: CanonicalViewerBody['bodyType'], index: number): CanonicalViewerBody {
  return {
    id: `body-${index}`,
    bodyType,
    surfaceArchetype:
      bodyType === 'star'
        ? 'star'
        : bodyType === 'black-hole'
          ? 'black-hole'
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

function setup(bodies: CanonicalViewerBody[] = [], stars: CanonicalViewerBody[] = []) {
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
              stars,
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
    const bodies = (['star', 'planet', 'dwarf-planet', 'moon', 'asteroid', 'black-hole', 'tno', 'comet'] as const).map(
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
    const viewerGroup = component['typeGroups']().find((group) => group.type === type)?.rows[0]?.viewerGroup ?? type;
    TestBed.inject(ViewerGroupVisibilityService).setGroupIncluded(viewerGroup, true);
    component['toggleSection'](type);
    fixture.detectChanges();
    const button: HTMLButtonElement | null = fixture.nativeElement.querySelector(
      `[data-testid="details-table-${type}"] .details-target-btn`,
    );
    expect(button).not.toBeNull();
    expect(button!.getAttribute('aria-label')).toBe('Target');
    expect(button!.title).toBe('Target this object in the Viewer.');
    expect(button!.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    button!.click();
    fixture.detectChanges();
    expect(TestBed.inject(ViewerTargetService).targetBodyId()).toBe(selected.id);
    expect(button!.getAttribute('aria-pressed')).toBe('true');
  });

  it('places accessible target icons before names in grouped, distance, and ship rows', () => {
    const { fixture, component } = setup([body('planet', 1)]);
    const expectIconBeforeName = (selector: string) => {
      const button: HTMLButtonElement | null = fixture.nativeElement.querySelector(selector);
      expect(button).not.toBeNull();
      expect(button!.closest('td')?.classList.contains('details-col-name')).toBe(true);
      expect(button!.getAttribute('aria-label')).toBe('Target');
      expect(button!.title).toBe('Target this object in the Viewer.');
      expect(button!.closest('.details-name-target')?.firstElementChild?.contains(button)).toBe(true);
    };

    component['toggleSection']('planet');
    fixture.detectChanges();
    expectIconBeforeName('[data-testid="details-table-planet"] .details-target-btn');
    expect(fixture.nativeElement.querySelector('[data-testid="details-table-planet"] .details-col-action')).toBeNull();

    component['setViewMode']('distance');
    fixture.detectChanges();
    expectIconBeforeName('[data-testid="details-table"] .details-target-btn');
    expect(fixture.nativeElement.querySelector('[data-testid="details-table"] .details-col-action')).toBeNull();

    component['shipRows'].set([{
      id: 'ship-1',
      displayName: 'Scout',
      bodyType: 'ship',
      viewerGroup: 'ships',
      diameterM: null,
      semiMajorAxisKm: null,
      isShip: true,
      isActiveShip: false,
      shipModel: 'scout',
      shipTier: 1,
      shipStatus: 'available',
    }]);
    component['setViewMode']('type');
    component['toggleSection']('ship');
    fixture.detectChanges();
    expectIconBeforeName('[data-testid="details-table-ship"] .details-target-btn');
    expect(fixture.nativeElement.querySelector('[data-testid="details-table-ship"] .details-col-action')).toBeNull();
  });

  it('disables targeting hidden groups with localized guidance until the group is enabled', () => {
    const comet = body('comet', 1);
    const { fixture, component } = setup([comet]);
    component['toggleSection']('comet');
    fixture.detectChanges();
    const service = TestBed.inject(ViewerGroupVisibilityService);
    const button: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="details-table-comet"] .details-target-btn',
    );
    const tooltip = 'Enable the comet group in the Viewer to target this object.';

    expect(button.disabled).toBe(true);
    expect(button.title).toBe(tooltip);
    expect(button.parentElement?.getAttribute('title')).toBe(tooltip);
    expect(button.parentElement?.getAttribute('tabindex')).toBe('0');
    expect(button.getAttribute('aria-label')).toBe('Target');
    button.click();
    expect(TestBed.inject(ViewerTargetService).targetBodyId()).toBeNull();

    service.setGroupIncluded('comet', true);
    fixture.detectChanges();
    expect(button.disabled).toBe(false);
    expect(button.title).toBe('Target this object in the Viewer.');
    expect(button.parentElement?.getAttribute('tabindex')).toBeNull();
    button.click();
    expect(TestBed.inject(ViewerTargetService).targetBodyId()).toBe(comet.id);
  });

  it('disables distance-view target buttons for hidden asteroids', () => {
    const asteroid = body('asteroid', 1);
    const { fixture, component } = setup([asteroid]);
    component['setViewMode']('distance');
    fixture.detectChanges();
    const button: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="details-table"] .details-target-btn',
    );
    expect(button.disabled).toBe(true);
    expect(button.title).toBe('Enable the asteroids group in the Viewer to target this object.');
  });

  it('localizes the new group names in Italian', () => {
    setActiveLocaleCode('it');
    const { component, fixture } = setup([body('black-hole', 0), body('comet', 1)]);
    expect(component['typeGroups']().find((group) => group.type === 'black-hole')?.label).toBe('Buchi neri');
    component['toggleSection']('comet');
    fixture.detectChanges();
    const button: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="details-table-comet"] .details-target-btn',
    );
    expect(button.title).toBe('Attiva il gruppo comet nel visualizzatore per puntare questo oggetto.');
  });

  it('deduplicates a companion listed in both stars and bodies while retaining the black-hole row', () => {
    const star = body('star', 1);
    const blackHole = body('black-hole', 2);
    const { component } = setup([blackHole, star], [star]);
    expect(
      component['typeGroups']()
        .find((group) => group.type === 'star')
        ?.rows.map((row) => row.id),
    ).toEqual([star.id]);
    expect(
      component['typeGroups']()
        .find((group) => group.type === 'black-hole')
        ?.rows.map((row) => row.id),
    ).toEqual([blackHole.id]);
  });
});
