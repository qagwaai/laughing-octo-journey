import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CharacterShipBadge } from '../../component/character-ship-badge';
import { GuardedLeftMenu } from '../../component/guarded-left-menu';
import { locale } from '../../i18n/locale';
import type { PlayerCharacterSummary } from '../../model/character-list';
import type { SolarSystemSummary } from '../../model/solar-system-list';
import { MarketService } from '../../services/market.service';
import { SessionService } from '../../services/session.service';
import { ShipService } from '../../services/ship.service';
import { SolarSystemService } from '../../services/solar-system.service';
import { ViewerTargetService } from '../../services/viewer-target.service';
import { SolarSystemDetailsFacade, type DetailsRow } from './solar-system-details-facade';
import { resolveNavigationState } from '../navigation-state';

interface TypeGroup {
  type: string;
  label: string;
  rows: DetailsRow[];
}

interface SolarSystemDetailsNavigationState {
  playerName?: string;
  joinCharacter?: PlayerCharacterSummary;
  solarSystem?: SolarSystemSummary;
}

const BODY_TYPE_SORT_ORDER: Record<string, number> = {
  star: 0,
  planet: 1,
  moon: 2,
  asteroid: 3,
  station: 4,
  ship: 5,
};

const TYPE_GROUP_ORDER = ['star', 'planet', 'moon', 'asteroid', 'station', 'ship'];

function sortOrder(bodyType: string): number {
  const normalized = typeof bodyType === 'string' ? bodyType.trim().toLowerCase() : '';
  return BODY_TYPE_SORT_ORDER[normalized] ?? 99;
}

@Component({
  selector: 'app-solar-system-details-page',
  templateUrl: './solar-system-details.html',
  styleUrls: ['./solar-system-details.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GuardedLeftMenu, CharacterShipBadge],
})
/**
 * Left-pane details view for a selected solar system. Lists all bodies,
 * market stations, and ships in two navigation modes: grouped by type
 * (collapsible sections) or sorted by orbital distance.
 */
export default class SolarSystemDetailsPage {
  protected readonly t = locale;
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private sessionService = inject(SessionService);
  private solarSystemService = inject(SolarSystemService);
  private marketService = inject(MarketService);
  private shipService = inject(ShipService);
  private viewerTargetService = inject(ViewerTargetService);

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
  protected activeTargetId = signal<string | null>(null);

  protected viewMode = signal<'type' | 'distance'>('type');
  protected expandedTypes = signal<Set<string>>(new Set());

  protected readonly hasRows = computed(() => this.rows().length > 0);

  protected readonly typeGroups = computed<TypeGroup[]>(() => {
    const allRows = this.rows();
    const groupMap = new Map<string, DetailsRow[]>();
    for (const row of allRows) {
      const type = row.bodyType.trim().toLowerCase();
      if (!groupMap.has(type)) groupMap.set(type, []);
      groupMap.get(type)!.push(row);
    }
    return TYPE_GROUP_ORDER
      .filter((type) => groupMap.has(type))
      .map((type) => ({
        type,
        label: type === 'ship' ? this.t.game.viewer.detailsSectionShips : this.capitalize(type),
        rows: groupMap.get(type)!,
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
    this.activeTargetId.set(null);
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
    this.activeTargetId.set(id);
    this.viewerTargetService.target(id);
  }

  protected goBackToSystemList(): void {
    this.viewerTargetService.clearTarget();
    this.router.navigate(
      [{ outlets: { left: ['viewer'] } }],
      {
        preserveFragment: true,
        state: {
          playerName: this.playerName(),
          joinCharacter: this.joinCharacter(),
        },
      },
    );
  }
}
