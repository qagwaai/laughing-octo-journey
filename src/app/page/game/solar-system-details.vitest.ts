import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMockSessionService } from '../../../testing';
import { setActiveLocaleCode } from '../../i18n/locale';
import type { ShipSummary } from '../../model/ship-list';
import type { ShipListByOwnerResponse } from '../../model/ship-list-by-owner';
import type { CanonicalViewerBody, SolarSystemGetResponse } from '../../model/solar-system-get';
import { MarketService } from '../../services/market.service';
import { MissionNavigationService } from '../../services/mission-navigation';
import { MissionService } from '../../services/mission.service';
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

function setup(
  bodies: CanonicalViewerBody[] = [],
  stars: CanonicalViewerBody[] = [],
  ships: ShipSummary[] = [],
  viewerTargetShipId?: string,
  visibility = new ViewerGroupVisibilityService(),
) {
  const session = createMockSessionService('test-session');
  const character = { id: 'character-1', characterName: 'Nova' };
  session.setActiveCharacter(character);
  const router = {
    getCurrentNavigation: () => ({ extras: { state: { playerName: 'Pioneer', joinCharacter: character, viewerTargetShipId } } }),
    navigate: vi.fn(),
  };
  TestBed.configureTestingModule({
    imports: [SolarSystemDetailsPage],
    providers: [
      { provide: SessionService, useValue: session },
      { provide: ViewerGroupVisibilityService, useValue: visibility },
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
      { provide: ShipService, useValue: {
        listShipsByOwner: vi.fn((_request: unknown, callback: (response: ShipListByOwnerResponse) => void) =>
          callback({
            success: true, message: '', correlationId: 'ships',
            requestIdentity: { operation: 'ship-list-by-owner', entityType: 'ship', containerId: character.id },
            ships,
          }),
        ),
      } },
      { provide: MissionService, useValue: { isMissionInProgress: vi.fn().mockReturnValue(false) } },
      { provide: MissionNavigationService, useValue: {
        prepareNavigation: vi.fn().mockResolvedValue({
          missionContext: { missionId: 'first-target', seedPolicy: 'resume' },
        }),
      } },
      { provide: Router, useValue: router },
      { provide: ActivatedRoute, useValue: { paramMap: of({ get: () => 'sol' }) } },
    ],
  });
  TestBed.overrideComponent(SolarSystemDetailsPage, {
    set: { imports: [], schemas: [CUSTOM_ELEMENTS_SCHEMA] },
  });
  const fixture = TestBed.createComponent(SolarSystemDetailsPage);
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance, session, router, character };
}

describe('SolarSystemDetailsPage body groups', () => {
  afterEach(() => setActiveLocaleCode('en'));

  it.each([
    { localeCode: 'en', diameters: ['12,742,000.000', '4,000.000', '—'], orbit: '1,234,567.892', zero: '0.000' },
    { localeCode: 'it', diameters: ['12.742.000,000', '4.000,000', '—'], orbit: '1.234.567,892', zero: '0,000' },
  ])('formats diameter and orbit in $localeCode without changing source values or sorting', ({
    localeCode, diameters, orbit, zero,
  }) => {
    setActiveLocaleCode(localeCode);
    const orbitalElements = {
      semiMajorAxisKm: 1_234_567.8916,
      eccentricity: 0,
      inclinationDeg: 0,
      longitudeOfAscendingNodeDeg: 0,
      argumentOfPeriapsisDeg: 0,
      meanAnomalyAtEpochDeg: 0,
      orbitalPeriodSec: 1,
      epoch: '2026-01-01T00:00:00Z',
    };
    const bodies = [
      { ...body('planet', 1), physicalCatalog: { meanRadiusKm: 6_371, estimatedDiameterM: 1 }, orbitalElements },
      { ...body('planet', 2), physical: { estimatedDiameterM: 4_000 }, orbitalElements: { ...orbitalElements, semiMajorAxisKm: 0 } },
      { ...body('planet', 3), physicalCatalog: { radiusKm: 0 } },
    ];
    const { fixture, component } = setup(bodies);
    component['toggleSection']('planet-rocky');
    fixture.detectChanges();
    const rows: NodeListOf<HTMLTableRowElement> = fixture.nativeElement.querySelectorAll(
      '[data-testid="details-table-planet-rocky"] tbody tr',
    );
    expect(Array.from(rows, (row) => row.cells[1].textContent?.trim())).toEqual(diameters);
    expect(Array.from(rows, (row) => row.cells[2].textContent?.trim())).toEqual([orbit, zero, '—']);
    component['setViewMode']('distance');
    fixture.detectChanges();
    const distanceRows: NodeListOf<HTMLTableRowElement> = fixture.nativeElement.querySelectorAll(
      '[data-testid="details-table"] tbody tr',
    );
    expect(Array.from(distanceRows, (row) => row.cells[2].textContent?.trim())).toEqual([zero, orbit, '—']);
    expect(bodies[0].physicalCatalog).toEqual({ meanRadiusKm: 6_371, estimatedDiameterM: 1 });
    expect(bodies[1].physical).toEqual({ estimatedDiameterM: 4_000 });
    expect(bodies[0].orbitalElements?.semiMajorAxisKm).toBe(1_234_567.8916);
  });

  it('includes every canonical type in the requested order and preserves distance-view rows', () => {
    const bodies = (['star', 'planet', 'dwarf-planet', 'moon', 'asteroid', 'black-hole', 'tno', 'comet'] as const).map(
      (type, index) => body(type, index),
    );
    const { component } = setup(bodies);
    expect(
      component['typeGroups']()
        .filter((group) => group.rows.length > 0)
        .map((group) => group.type),
    ).toEqual(bodies.map((entry) => (entry.bodyType === 'planet' ? 'planet-rocky' : entry.bodyType)));
    expect(new Set(component['typeGroups']().flatMap((group) => group.rows.map((row) => row.id)))).toEqual(
      new Set(component['sortedByDistance']().map((row) => row.id)),
    );
  });

  it('renders every category at zero count even when the entire system is empty', () => {
    const { fixture, component } = setup();
    expect(component['typeGroups']().map((group) => [group.label, group.rows.length])).toEqual([
      ['Star', 0],
      ['Rocky planets', 0],
      ['Super-Earths', 0],
      ['Ocean worlds', 0],
      ['Lava worlds', 0],
      ['Sub-Neptunes', 0],
      ['Hot Neptunes', 0],
      ['Ice giants', 0],
      ['Gas giants', 0],
      ['Hot Jupiters', 0],
      ['Super-Jupiters', 0],
      ['Dwarf Planet', 0],
      ['Moon', 0],
      ['Asteroid', 0],
      ['Black holes', 0],
      ['Trans-Neptunian object', 0],
      ['Comet', 0],
      ['Station', 0],
      ['Ships', 0],
    ]);
    const element: HTMLElement = fixture.nativeElement;
    expect(
      Array.from(element.querySelectorAll('.details-type-header__count'), (node) => node.textContent?.trim()),
    ).toEqual(Array(19).fill('0'));
    component['toggleSection']('comet');
    fixture.detectChanges();
    expect(element.querySelector('[data-testid="details-table-comet"] tbody')?.children.length).toBe(0);
    component['setViewMode']('distance');
    fixture.detectChanges();
    expect(element.querySelector('[data-testid="details-empty"]')).not.toBeNull();
    component['setViewMode']('type');
    fixture.detectChanges();
    expect(element.querySelectorAll('.details-type-header').length).toBe(19);
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

    component['toggleSection']('planet-rocky');
    fixture.detectChanges();
    expectIconBeforeName('[data-testid="details-table-planet-rocky"] .details-target-btn');
    expect(fixture.nativeElement.querySelector('[data-testid="details-table-planet-rocky"] .details-col-action')).toBeNull();

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

  it.each(['type', 'distance'] as const)('opens the selected owned ship from %s view', async (mode) => {
    const ship = (id: string, solarSystemId: string): ShipSummary => ({
      id, name: `Ship ${id}`, model: 'Scout', tier: 1,
      spatial: { solarSystemId, frame: 'barycentric', positionKm: { x: 1, y: 2, z: 3 }, epochMs: 1 },
      inventory: [],
    });

    const ships = [ship('one', 'sol'), ship('two', 'sol'), ship('elsewhere', 'other')];
    const { fixture, component, session, router, character } = setup([body('planet', 1)], [], ships);
    session.setActiveShip(ships[0]);
    component['setViewMode'](mode);
    if (mode === 'type') component['toggleSection']('ship');
    fixture.detectChanges();

    const buttons: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('.details-exterior-btn');
    expect(buttons.length).toBe(2);
    expect(buttons[1].title).toBe('Open Ship two in the Ship Hangar and external view.');
    expect(buttons[1].getAttribute('aria-label')).toBe(buttons[1].title);
    expect(fixture.nativeElement.querySelector('[data-testid="details-table-planet-rocky"] .details-exterior-btn')).toBeNull();
    buttons[1].click();
    await fixture.whenStable();
    expect(session.activeShip()).toEqual(ships[1]);
    expect(router.navigate).toHaveBeenCalledWith(
      [{ outlets: { primary: ['ship-exterior-view'], right: null, left: ['ship-hangar'] } }],
      {
        preserveFragment: true,
        state: {
          playerName: 'Pioneer', joinCharacter: character, joinShip: ships[1],
          missionContext: { missionId: 'first-target', seedPolicy: 'resume' },
        },
      },
    );
    expect(TestBed.inject(ViewerTargetService).targetBodyId()).toBeNull();
  });

  it('targets the requested ship, reveals its group, and clears that request on later system loads', () => {
    const visibility = new ViewerGroupVisibilityService();
    visibility.setGroupIncluded('ships', false);
    const ship: ShipSummary = {
      id: 'ship-2', name: 'Drifter', model: 'Scout', tier: 1,
      spatial: { solarSystemId: 'sol', frame: 'barycentric', positionKm: { x: 1, y: 0, z: 0 }, epochMs: 1 },
    };
    const { fixture, component } = setup([], [], [ship], ship.id, visibility);
    const target = TestBed.inject(ViewerTargetService);
    fixture.detectChanges();
    expect(visibility.isGroupIncluded('ships')).toBe(true);
    expect(target.targetBodyId()).toBe(ship.id);
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="details-table-ship"] .details-target-btn');
    expect(button.getAttribute('aria-pressed')).toBe('true');
    component['loadDetails']('other');
    expect(target.targetBodyId()).toBeNull();
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

describe('SolarSystemDetailsPage planet-type sections', () => {
  afterEach(() => setActiveLocaleCode('en'));

  function planet(index: number, overrides: Partial<CanonicalViewerBody>): CanonicalViewerBody {
    return { ...body('planet', index), ...overrides } as CanonicalViewerBody;
  }

  it('splits planets into per-type sections in archetype order, with untyped planets last', () => {
    const { component } = setup([
      planet(1, { planetType: 'hot-jupiter', surfaceArchetype: 'gas-giant' }),
      planet(2, { surfaceArchetype: 'super-earth' }),
      planet(3, { planetType: 'lava' }),
      planet(4, { surfaceArchetype: 'unknown-archetype' as CanonicalViewerBody['surfaceArchetype'] }),
      planet(5, { planetType: 'hot-jupiter' }),
    ]);
    const planetGroups = component['typeGroups']().filter(
      (group) => group.type.startsWith('planet') && group.rows.length > 0,
    );
    expect(planetGroups.map((group) => [group.type, group.label, group.rows.map((row) => row.id)])).toEqual([
      ['planet-super-earth', 'Super-Earths', ['body-2']],
      ['planet-lava', 'Lava worlds', ['body-3']],
      ['planet-hot-jupiter', 'Hot Jupiters', ['body-1', 'body-5']],
      ['planet', 'Planet', ['body-4']],
    ]);
  });

  it('marks approximate planet types as likely and names the type in the distance view', () => {
    const { fixture, component } = setup([
      planet(1, { planetType: 'sub-neptune', approximateFields: ['planetType'] }),
      planet(2, { planetType: 'ice-giant' }),
    ]);
    component['toggleSection']('planet-sub-neptune');
    component['toggleSection']('planet-ice-giant');
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(
      element.querySelector('[data-testid="details-table-planet-sub-neptune"] [data-testid="details-planet-type-likely"]')
        ?.textContent?.trim(),
    ).toBe('(likely)');
    expect(
      element.querySelector('[data-testid="details-table-planet-ice-giant"] [data-testid="details-planet-type-likely"]'),
    ).toBeNull();

    component['setViewMode']('distance');
    fixture.detectChanges();
    expect(
      Array.from(element.querySelectorAll('[data-testid="details-table"] .details-col-type'), (cell) =>
        cell.textContent?.trim(),
      ),
    ).toEqual(['Sub-Neptune', 'Ice giant']);
  });

  it('localizes planet-type sections in Italian', () => {
    setActiveLocaleCode('it');
    const { component } = setup([planet(1, { planetType: 'hot-jupiter' })]);
    expect(component['typeGroups']().find((group) => group.type === 'planet-hot-jupiter')?.label).toBe(
      'Gioviani caldi',
    );
  });
});
