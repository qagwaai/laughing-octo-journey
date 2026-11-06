import { ChangeDetectionStrategy, Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CharacterShipBadge } from '../../component/character-ship-badge';
import { GuardedLeftMenu } from '../../component/guarded-left-menu';
import { SolarSystemName } from '../../component/solar-system-name';
import { locale } from '../../i18n/locale';
import { PlayerCharacterSummary } from '../../model/character-list';
import { readPagedListPageInfo } from '../../model/paged-list';
import type {
  SolarSystemListRequest,
  SolarSystemListResponse,
  SolarSystemListSort,
  SolarSystemSource,
  SolarSystemSummary,
} from '../../model/solar-system-list';
import { appLogger } from '../../services/logger';
import { SessionService } from '../../services/session.service';
import { SolarSystemService } from '../../services/solar-system.service';
import { ViewerTargetService } from '../../services/viewer-target.service';
import { resolveNavigationState } from '../navigation-state';
import { catalogSnapshotDate } from './viewer-data-attribution';

interface ViewerNavigationState {
  playerName?: string;
  joinCharacter?: PlayerCharacterSummary;
}

export const VIEWER_PAGE_SIZE = 50;
export const VIEWER_DEFAULT_MAX_DISTANCE_PARSEC = 50;
export const VIEWER_SEARCH_DEBOUNCE_MS = 300;
export const VIEWER_SOURCE_OPTIONS: readonly SolarSystemSource[] = ['curated', 'procedural', 'exoplanet-catalog'];
export const VIEWER_SPECTRAL_CLASS_OPTIONS: readonly string[] = ['O', 'B', 'A', 'F', 'G', 'K', 'M'];

type ViewerSourceFilter = SolarSystemSource | '';

/** The server-side query a page is fetched with; any change restarts paging at offset 0. */
interface ViewerListQuery {
  search: string;
  source: ViewerSourceFilter;
  minDistanceParsec: number | null;
  maxDistanceParsec: number | null;
  hasPlanets: boolean;
  spectralClass: string;
  sort: SolarSystemListSort;
}

@Component({
  selector: 'app-viewer-page',
  templateUrl: './viewer.html',
  styleUrls: ['./viewer.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GuardedLeftMenu, CharacterShipBadge, SolarSystemName],
})
/**
 * Left-pane Viewer page. Discovers solar systems through the paged
 * `solar-system-list` channel (server-side search, filters and sort, with an
 * explicit "Load more"), lets the player select one, and routes the right
 * outlet to the Viewer system scene.
 *
 * Filter state is intentionally not persisted: every visit starts from the
 * default 50 pc distance band.
 *
 * Currently always unlocked via {@link isViewerUnlocked}; the predicate
 * exists so a future entitlement check can gate access without changing
 * the menu structure.
 */
export default class ViewerPage implements OnInit, OnDestroy {
  protected readonly t = locale;
  protected readonly sourceOptions = VIEWER_SOURCE_OPTIONS;
  protected readonly spectralClassOptions = VIEWER_SPECTRAL_CLASS_OPTIONS;
  private router = inject(Router);
  private sessionService = inject(SessionService);
  private solarSystemService = inject(SolarSystemService);
  private viewerTargetService = inject(ViewerTargetService);

  private navigationState: ViewerNavigationState = resolveNavigationState<ViewerNavigationState>(this.router);

  protected playerName = signal<string>(this.navigationState.playerName ?? '');
  protected joinCharacter = signal<PlayerCharacterSummary | null>(this.navigationState.joinCharacter ?? null);

  protected readonly searchText = signal('');
  protected readonly query = signal<ViewerListQuery>({
    search: '',
    source: '',
    minDistanceParsec: null,
    maxDistanceParsec: VIEWER_DEFAULT_MAX_DISTANCE_PARSEC,
    hasPlanets: false,
    spectralClass: '',
    sort: 'distance',
  });

  protected solarSystems = signal<SolarSystemSummary[]>([]);
  protected readonly total = signal<number | null>(null);
  protected readonly hasMore = signal(false);
  protected isLoading = signal(false);
  protected readonly isLoadingMore = signal(false);
  protected listError = signal<string | null>(null);
  protected readonly loadMoreError = signal<string | null>(null);
  protected selectedSystemId = signal<string | null>(null);

  protected readonly displayedSolarSystems = computed(() => this.solarSystems());
  protected readonly hasResults = computed(() => this.displayedSolarSystems().length > 0);
  protected readonly isSearchActive = computed(() => this.query().search.length > 0);
  protected readonly resultCountText = computed(() => {
    const total = this.total();
    if (total === null) {
      return '';
    }
    return this.t.game.viewer.resultCount
      .replace('{shown}', String(this.solarSystems().length))
      .replace('{total}', String(total));
  });

  /** Incremented for every new query so late replies from superseded queries are ignored. */
  private generation = 0;
  private nextOffset = 0;
  private cancelInFlight: (() => void) | null = null;
  private searchDebounce: ReturnType<typeof setTimeout> | null = null;

  /**
   * Future: replace with character/entitlement-based unlock check. Returns true
   * for all characters today so the route is universally accessible.
   */
  protected isViewerUnlocked(): boolean {
    return true;
  }

  ngOnInit(): void {
    if (!this.isViewerUnlocked()) {
      return;
    }
    this.loadSolarSystems();
  }

  ngOnDestroy(): void {
    this.clearSearchDebounce();
    this.cancelPending();
  }

  /** Restarts the list at offset 0 for the current query. */
  protected loadSolarSystems(): void {
    this.cancelPending();
    const generation = ++this.generation;
    this.solarSystems.set([]);
    this.total.set(null);
    this.hasMore.set(false);
    this.nextOffset = 0;
    this.listError.set(null);
    this.loadMoreError.set(null);
    this.isLoadingMore.set(false);
    this.requestPage(generation, 0);
  }

  protected loadMore(): void {
    if (!this.hasMore() || this.isLoading() || this.isLoadingMore()) {
      return;
    }
    this.loadMoreError.set(null);
    this.requestPage(this.generation, this.nextOffset);
  }

  protected onSearchInput(value: string): void {
    this.searchText.set(value);
    this.clearSearchDebounce();
    this.searchDebounce = setTimeout(() => {
      this.searchDebounce = null;
      this.applySearch();
    }, VIEWER_SEARCH_DEBOUNCE_MS);
  }

  protected onSourceChange(value: string): void {
    const source = (VIEWER_SOURCE_OPTIONS as readonly string[]).includes(value) ? (value as SolarSystemSource) : '';
    this.updateQuery({ source });
  }

  protected onMinDistanceChange(value: string): void {
    this.updateQuery({ minDistanceParsec: this.parseDistance(value) });
  }

  protected onMaxDistanceChange(value: string): void {
    this.updateQuery({ maxDistanceParsec: this.parseDistance(value) });
  }

  protected onHasPlanetsChange(checked: boolean): void {
    this.updateQuery({ hasPlanets: checked });
  }

  protected onSpectralClassChange(value: string): void {
    this.updateQuery({ spectralClass: VIEWER_SPECTRAL_CLASS_OPTIONS.includes(value) ? value : '' });
  }

  protected onSortChange(value: string): void {
    this.updateQuery({ sort: value === 'name' ? 'name' : 'distance' });
  }

  protected sourceLabel(source: SolarSystemSource): string {
    const labels = this.t.game.viewer.sourceLabels as Record<string, string>;
    return labels[source] ?? source;
  }

  protected selectSystem(system: SolarSystemSummary): void {
    if (!this.isViewerUnlocked()) {
      return;
    }
    this.selectedSystemId.set(system.id);
    this.viewerTargetService.clearTarget();
    this.router.navigate(
      [{ outlets: { left: ['solar-system-details', system.id], right: ['viewer-scene', system.id] } }],
      {
        preserveFragment: true,
        state: {
          playerName: this.playerName(),
          joinCharacter: this.joinCharacter(),
          solarSystem: system,
        },
      },
    );
  }

  protected snapshotDateOf(system: SolarSystemSummary): string | null {
    return catalogSnapshotDate(system);
  }

  protected formatDistance(parsecs: number | null | undefined, approximate?: boolean): string {
    if (typeof parsecs !== 'number' || !Number.isFinite(parsecs)) {
      return '—';
    }
    return (approximate ? '≈' : '') + parsecs.toFixed(2);
  }

  private applySearch(): void {
    // Preserve literal query text; the server owns documented substring matching.
    const text = this.searchText();
    this.updateQuery({ search: text.trim() ? text : '' });
  }

  private updateQuery(patch: Partial<ViewerListQuery>): void {
    const current = this.query();
    const next = { ...current, ...patch };
    const changed = (Object.keys(next) as (keyof ViewerListQuery)[]).some((key) => next[key] !== current[key]);
    if (!changed) {
      return;
    }
    this.query.set(next);
    this.loadSolarSystems();
  }

  private parseDistance(value: string): number | null {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }

  private buildRequest(offset: number): Omit<SolarSystemListRequest, 'playerName' | 'sessionKey'> {
    const query = this.query();
    const request: Omit<SolarSystemListRequest, 'playerName' | 'sessionKey'> = {
      sort: query.sort,
      offset,
      limit: VIEWER_PAGE_SIZE,
    };
    if (query.search) {
      // Search spans every distance so far-away catalog systems (for example KOI-351) stay discoverable.
      request.search = query.search;
    } else {
      if (query.minDistanceParsec !== null) request.minDistanceParsec = query.minDistanceParsec;
      if (query.maxDistanceParsec !== null) request.maxDistanceParsec = query.maxDistanceParsec;
    }
    if (query.source) request.source = query.source;
    if (query.hasPlanets) request.minPlanetCount = 1;
    if (query.spectralClass) request.spectralClass = query.spectralClass;
    return request;
  }

  private requestPage(generation: number, offset: number): void {
    const playerName = this.playerName();
    const sessionKey = this.sessionService.getSessionKey();
    if (!playerName || !sessionKey) {
      this.listError.set(this.t.game.viewer.listErrorPrefix + ' missing-session');
      return;
    }

    const isFirstPage = offset === 0;
    (isFirstPage ? this.isLoading : this.isLoadingMore).set(true);

    this.cancelInFlight = this.solarSystemService.listSolarSystems(
      { playerName, sessionKey, ...this.buildRequest(offset) },
      (response: SolarSystemListResponse) => {
        if (generation !== this.generation) {
          return;
        }
        this.cancelInFlight = null;
        (isFirstPage ? this.isLoading : this.isLoadingMore).set(false);
        this.applyPage(response, isFirstPage);
      },
    );
  }

  private applyPage(response: SolarSystemListResponse, isFirstPage: boolean): void {
    const errorTarget = isFirstPage ? this.listError : this.loadMoreError;
    if (!response.success) {
      errorTarget.set(this.t.game.viewer.listErrorPrefix + ' ' + (response.message?.trim() || 'unknown-error'));
      return;
    }

    const pageInfo = readPagedListPageInfo(response);
    if (!pageInfo) {
      appLogger.warn('[viewer] solar-system-list success response is missing paging metadata.');
    }

    const incoming = response.solarSystems ?? [];
    if (isFirstPage) {
      this.solarSystems.set(incoming);
    } else {
      const seen = new Set(this.solarSystems().map((system) => system.id));
      this.solarSystems.update((systems) => [...systems, ...incoming.filter((system) => !seen.has(system.id))]);
    }
    this.total.set(pageInfo?.total ?? null);
    this.hasMore.set(pageInfo?.hasMore ?? false);
    this.nextOffset = pageInfo ? pageInfo.offset + pageInfo.limit : this.solarSystems().length;
  }

  private cancelPending(): void {
    this.cancelInFlight?.();
    this.cancelInFlight = null;
    this.isLoading.set(false);
    this.isLoadingMore.set(false);
  }

  private clearSearchDebounce(): void {
    if (this.searchDebounce !== null) {
      clearTimeout(this.searchDebounce);
      this.searchDebounce = null;
    }
  }
}
