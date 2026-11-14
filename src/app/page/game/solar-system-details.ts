import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CharacterShipBadge } from '../../component/character-ship-badge';
import { GuardedLeftMenu } from '../../component/guarded-left-menu';
import { SolarSystemName } from '../../component/solar-system-name';
import { locale } from '../../i18n/locale';
import type { PlayerCharacterSummary } from '../../model/character-list';
import type { SolarSystemSummary } from '../../model/solar-system-list';
import { MarketService } from '../../services/market.service';
import { SessionService } from '../../services/session.service';
import { ShipExteriorNavigationService } from '../../services/ship-exterior-navigation.service';
import { ShipService } from '../../services/ship.service';
import { SolarSystemService } from '../../services/solar-system.service';
import { ViewerTargetService } from '../../services/viewer-target.service';
import { ViewerGroupVisibilityService } from '../../services/viewer-group-visibility.service';
import { resolveNavigationState } from '../navigation-state';
import { DETAILS_PLANET_TYPE_ORDER, SolarSystemDetailsFacade, type DetailsRow } from './solar-system-details-facade';
import { formatViewerNumber } from './viewer-number-format';

interface TypeGroup {
  type: string;
  label: string;
  rows: DetailsRow[];
}

interface SolarSystemDetailsNavigationState {
  playerName?: string;
  joinCharacter?: PlayerCharacterSummary;
  solarSystem?: SolarSystemSummary;
  viewerTargetShipId?: string;
}

const TYPE_GROUP_ORDER = [
  'star',
  ...DETAILS_PLANET_TYPE_ORDER.map((planetType) => planetGroupKey(planetType)),
  'planet',
  'dwarf-planet',
  'moon',
  'asteroid',
  'black-hole',
  'tno',
  'comet',
  'station',
  'ship',
];
/** Every category renders (count 0 when empty) except the untyped-planet fallback. */
const HIDDEN_WHEN_EMPTY_TYPES = new Set(['planet']);

/** Typed planets get their own section (e.g. `planet-hot-jupiter`); untyped planets stay in `planet`. */
function planetGroupKey(planetType: string): string {
  return `planet-${planetType}`;
}

function rowGroupKey(row: DetailsRow): string {
  const type = row.bodyType.trim().toLowerCase();
  return type === 'planet' && row.planetType ? planetGroupKey(row.planetType) : type;
}

@Component({
  selector: 'app-solar-system-details-page',
  templateUrl: './solar-system-details.html',
  styleUrls: ['./solar-system-details.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GuardedLeftMenu, CharacterShipBadge, SolarSystemName],
})
/**
 * Left-pane details view for a selected solar system. Lists all bodies,
 * market stations, and ships in two navigation modes: grouped by type
 * (collapsible sections) or sorted by orbital distance.
 */
export default class SolarSystemDetailsPage {
  protected readonly t = locale;
  protected readonly formatNumber = formatViewerNumber;
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private sessionService = inject(SessionService);
  private solarSystemService = inject(SolarSystemService);
  private marketService = inject(MarketService);
  private shipService = inject(ShipService);
  private exteriorNavigation = inject(ShipExteriorNavigationService);
  private viewerTargetService = inject(ViewerTargetService);
  private viewerGroupVisibility = inject(ViewerGroupVisibilityService);

  private readonly detailsFacade = new SolarSystemDetailsFacade({
    solarSystemService: this.solarSystemService,
    marketService: this.marketService,
    shipService: this.shipService,
    getPlayerName: () => this.playerName(),
    getSessionKey: () => this.sessionService.getSessionKey(),
    getActiveCharacterId: () => this.sessionService.activeCharacter()?.id ?? null,
    getActiveShipId: () => this.sessionService.activeShip()?.id ?? null,
    setSolarSystem: (solarSystem: SolarSystemSummary | null) => this.solarSystem.set(solarSystem),
    setBodyRows: (rows: DetailsRow[]) => this.bodyRows.set(rows),
    setShipRows: (rows: DetailsRow[]) => this.shipRows.set(rows),
    setIsLoading: (value: boolean) => this.isLoading.set(value),
    setLoadError: (value: string | null) => this.loadError.set(value),
  });

  private navigationState: SolarSystemDetailsNavigationState =
    resolveNavigationState<SolarSystemDetailsNavigationState>(this.router);

  protected playerName = signal<string>(this.navigationState.playerName ?? '');
  protected joinCharacter = signal<PlayerCharacterSummary | null>(this.navigationState.joinCharacter ?? null);
  protected solarSystem = signal<SolarSystemSummary | null>(this.navigationState.solarSystem ?? null);

  private bodyRows = signal<DetailsRow[]>([]);
  private shipRows = signal<DetailsRow[]>([]);

  protected readonly rows = computed<DetailsRow[]>(() => [...this.bodyRows(), ...this.shipRows()]);

  protected isLoading = signal(false);
  protected loadError = signal<string | null>(null);
  protected readonly activeTargetId = this.viewerTargetService.targetBodyId.asReadonly();

  protected viewMode = signal<'type' | 'distance'>('type');
  protected expandedTypes = signal<Set<string>>(new Set());

  protected readonly hasRows = computed(() => this.rows().length > 0);

  protected readonly typeGroups = computed<TypeGroup[]>(() => {
    const allRows = this.rows();
    const groupMap = new Map<string, DetailsRow[]>();
    for (const row of allRows) {
      const type = rowGroupKey(row);
      if (!groupMap.has(type)) groupMap.set(type, []);
      groupMap.get(type)!.push(row);
    }
    const labels: Record<string, string> = {
      star: this.t.game.viewer.detailsSectionStar,
      planet: this.t.game.viewer.detailsSectionPlanet,
      moon: this.t.game.viewer.detailsSectionMoon,
      asteroid: this.t.game.viewer.detailsSectionAsteroid,
      station: this.t.game.viewer.detailsSectionStation,
      'dwarf-planet': this.t.game.viewer.detailsSectionDwarfPlanet,
      'black-hole': this.t.game.viewer.detailsSectionBlackHole,
      tno: this.t.game.viewer.detailsSectionTno,
      comet: this.t.game.viewer.detailsSectionComet,
      ship: this.t.game.viewer.detailsSectionShips,
    };
    const planetTypeLabels: Record<string, string> = this.t.game.viewer.detailsSectionPlanetTypes;
    for (const planetType of DETAILS_PLANET_TYPE_ORDER) {
      labels[planetGroupKey(planetType)] = planetTypeLabels[planetType];
    }
    return TYPE_GROUP_ORDER.filter((type) => groupMap.has(type) || !HIDDEN_WHEN_EMPTY_TYPES.has(type)).map((type) => ({
      type,
      label: labels[type] ?? this.capitalize(type),
      rows: groupMap.get(type) ?? [],
    }));
  });

  protected readonly sortedByDistance = computed<DetailsRow[]>(() => {
    return [...this.rows()].sort((a, b) => {
      if (a.semiMajorAxisKm === null && b.semiMajorAxisKm === null) return 0;
      if (a.semiMajorAxisKm === null) return 1;
      if (b.semiMajorAxisKm === null) return -1;
      return a.semiMajorAxisKm - b.semiMajorAxisKm;
    });
  });

  private capitalize(s: string): string {
    return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
  }

  /** Distance-view type: the planet archetype name for typed planets, otherwise the raw body type. */
  protected rowTypeLabel(row: DetailsRow): string {
    const names: Record<string, string> = this.t.game.viewer.detailsPlanetTypeNames;
    return (row.planetType && names[row.planetType]) || row.bodyType;
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('solarSystemId');
      if (id) {
        this.loadDetails(id);
      }
    });
  }

  private loadDetails(solarSystemId: string): void {
    this.viewerTargetService.clearTarget();
    const targetShipId = this.navigationState.viewerTargetShipId;
    this.navigationState = { ...this.navigationState, viewerTargetShipId: undefined };
    if (targetShipId) {
      this.viewerGroupVisibility.setGroupIncluded('ships', true);
      this.expandedTypes.update((current) => new Set([...current, 'ship']));
      this.viewerTargetService.target(targetShipId);
    }
    this.detailsFacade.loadDetails(solarSystemId, this.t.game.viewer.detailsErrorPrefix);
  }

  protected setViewMode(mode: 'type' | 'distance'): void {
    this.viewMode.set(mode);
  }

  protected toggleSection(type: string): void {
    const current = this.expandedTypes();
    const next = new Set(current);
    if (next.has(type)) {
      next.delete(type);
    } else {
      next.add(type);
    }
    this.expandedTypes.set(next);
  }

  protected isExpanded(type: string): boolean {
    return this.expandedTypes().has(type);
  }

  protected targetBody(id: string): void {
    const row = this.rows().find((candidate) => candidate.id === id);
    if (!row || !this.isTargetEnabled(row)) return;
    this.viewerTargetService.target(id);
  }

  protected openShipExterior(row: DetailsRow): void {
    if (row.ship) {
      void this.exteriorNavigation.navigate(row.ship, this.playerName(), this.joinCharacter());
    }
  }

  protected shipExteriorTooltip(row: DetailsRow): string {
    return this.t.game.viewer.detailsShipExteriorTooltip.replace('{ship}', row.displayName);
  }

  protected isTargetEnabled(row: DetailsRow): boolean {
    return this.viewerGroupVisibility.isGroupIncluded(row.viewerGroup);
  }

  protected targetDisabledTooltip(row: DetailsRow): string {
    return this.t.game.viewer.detailsTargetDisabledTooltip.replace('{group}', row.viewerGroup);
  }

  protected targetTooltip(row: DetailsRow): string {
    return this.isTargetEnabled(row) ? this.t.game.viewer.detailsTargetTooltip : this.targetDisabledTooltip(row);
  }

  protected goBackToSystemList(): void {
    this.viewerTargetService.clearTarget();
    this.router.navigate([{ outlets: { left: ['viewer'] } }], {
      preserveFragment: true,
      state: {
        playerName: this.playerName(),
        joinCharacter: this.joinCharacter(),
      },
    });
  }
}
