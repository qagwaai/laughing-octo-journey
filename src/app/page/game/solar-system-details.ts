import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CharacterShipBadge } from '../../component/character-ship-badge';
import { GuardedLeftMenu } from '../../component/guarded-left-menu';
import { locale } from '../../i18n/locale';
import type { PlayerCharacterSummary } from '../../model/character-list';
import type { ViewerBody } from '../../model/solar-system-get';
import type { SolarSystemGetResponse } from '../../model/solar-system-get';
import type { MarketListByLocationRequest, MarketListByLocationResponse, MarketSummary } from '../../model/market-list';
import type { SolarSystemSummary } from '../../model/solar-system-list';
import type { ShipListRequest, ShipListResponse } from '../../model/ship-list';
import { MarketService } from '../../services/market.service';
import { SessionService } from '../../services/session.service';
import { ShipService } from '../../services/ship.service';
import { SolarSystemService } from '../../services/solar-system.service';
import { ViewerTargetService } from '../../services/viewer-target.service';

interface DetailsRow {
  id: string;
  displayName: string;
  bodyType: string;
  diameterM: number | null;
  semiMajorAxisKm: number | null;
  isShip: boolean;
  isActiveShip: boolean;
  shipModel: string | null;
  shipTier: number | null;
  shipStatus: string | null;
}

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

const DETAILS_MARKET_DISTANCE_AU = 200;
const DETAILS_MARKET_LIMIT = 250;

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

  private navigationState: SolarSystemDetailsNavigationState =
    (this.router.getCurrentNavigation()?.extras.state as SolarSystemDetailsNavigationState | undefined) ??
    (history.state as SolarSystemDetailsNavigationState | undefined) ??
    {};

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
  protected expandedTypes = signal<Set<string>>(new Set(TYPE_GROUP_ORDER));

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
    const playerName = this.playerName();
    const sessionKey = this.sessionService.getSessionKey();
    if (!playerName || !sessionKey) {
      this.loadError.set(this.t.game.viewer.detailsErrorPrefix + ' missing-session');
      return;
    }

    this.isLoading.set(true);
    this.loadError.set(null);
    this.bodyRows.set([]);
    this.shipRows.set([]);
    this.viewerTargetService.clearTarget();
    this.activeTargetId.set(null);

    this.solarSystemService.getSolarSystem(
      { playerName, sessionKey, solarSystemId },
      (response: SolarSystemGetResponse) => {
        this.isLoading.set(false);
        if (!response.success) {
          this.loadError.set(this.t.game.viewer.detailsErrorPrefix + ' ' + (response.message ?? 'unknown-error'));
          return;
        }
        if (response.solarSystem) {
          this.solarSystem.set(response.solarSystem);
        }
        const allBodies = [...(response.stars ?? []), ...(response.bodies ?? [])];
        const bodyRows = this.bodiesToRows(allBodies);
        bodyRows.sort((a, b) => sortOrder(a.bodyType) - sortOrder(b.bodyType));
        this.bodyRows.set(bodyRows);
        this.hydrateMarkets(bodyRows, allBodies, playerName, sessionKey, solarSystemId);
        this.loadShipsForSystem(playerName, sessionKey, solarSystemId);
      },
    );
  }

  private bodiesToRows(bodies: ViewerBody[]): DetailsRow[] {
    return bodies.map((b) => ({
      id: b.id,
      displayName: b.displayName,
      bodyType: typeof b.bodyType === 'string' && b.bodyType.trim() ? b.bodyType : 'unknown',
      diameterM: b.physicalCatalog?.estimatedDiameterM ?? null,
      semiMajorAxisKm: b.orbitalElements?.semiMajorAxisKm ?? null,
      isShip: false,
      isActiveShip: false,
      shipModel: null,
      shipTier: null,
      shipStatus: null,
    }));
  }

  private hydrateMarkets(
    existingRows: DetailsRow[],
    allBodies: ViewerBody[],
    playerName: string,
    sessionKey: string,
    solarSystemId: string,
  ): void {
    const hasStation = allBodies.some((b) => typeof b.bodyType === 'string' && b.bodyType.toLowerCase() === 'station');
    if (hasStation) {
      return;
    }

    const firstStar = allBodies.find((b) => typeof b.bodyType === 'string' && b.bodyType.toLowerCase() === 'star');
    const positionKm = firstStar?.spatial.positionKm ?? { x: 0, y: 0, z: 0 };

    const request: MarketListByLocationRequest = {
      playerName,
      sessionKey,
      solarSystemId,
      positionKm,
      distanceAu: DETAILS_MARKET_DISTANCE_AU,
      limit: DETAILS_MARKET_LIMIT,
      locationTypes: ['station', 'free-floating'],
    };

    this.marketService.listMarketsByLocation(request, (response: MarketListByLocationResponse) => {
      if (!response.success) {
        return;
      }
      const marketRows = (response.markets ?? []).map((m: MarketSummary): DetailsRow => ({
        id: m.marketId,
        displayName: m.siteName?.trim() || m.marketName?.trim() || m.marketId,
        bodyType: 'station',
        diameterM: null,
        semiMajorAxisKm: m.trajectory?.orbit?.semiMajorAxisKm ?? null,
        isShip: false,
        isActiveShip: false,
        shipModel: null,
        shipTier: null,
        shipStatus: null,
      }));
      const merged = [...existingRows, ...marketRows];
      merged.sort((a, b) => sortOrder(a.bodyType) - sortOrder(b.bodyType));
      this.bodyRows.set(merged);
    });
  }

  private loadShipsForSystem(playerName: string, sessionKey: string, solarSystemId: string): void {
    const character = this.sessionService.activeCharacter();
    if (!character?.id) {
      this.shipRows.set([]);
      return;
    }

    const request: ShipListRequest = {
      playerName,
      characterId: character.id,
      sessionKey,
    };

    this.shipService.listShips(request, (response: ShipListResponse) => {
      if (!response.success) {
        this.shipRows.set([]);
        return;
      }
      const activeShipId = this.sessionService.activeShip()?.id ?? null;
      const systemShips = (response.ships ?? []).filter(
        (ship) => ship.spatial?.solarSystemId === solarSystemId,
      );
      this.shipRows.set(systemShips.map((ship) => ({
        id: ship.id,
        displayName: ship.name,
        bodyType: 'ship',
        diameterM: null,
        semiMajorAxisKm: null,
        isShip: true,
        isActiveShip: ship.id === activeShipId,
        shipModel: ship.model ?? null,
        shipTier: ship.tier ?? null,
        shipStatus: ship.status ?? null,
      })));
    });
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
