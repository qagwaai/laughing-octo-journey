import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { CharacterShipBadge } from '../../component/character-ship-badge';
import { locale } from '../../i18n/locale';
import { ITEM_VIEW_SPECS_CONFIGS } from '../../model/catalog/item-view-specs-configs';
import { PlayerCharacterSummary } from '../../model/character-list';
import { getSpecsImagePath, ItemViewSpecsConfig, ResolvedGroup, resolveGroups } from '../../model/view/item-view-specs';
import { resolveNavigationState } from '../navigation-state';

interface ItemViewSpecsNavigationState {
  playerName?: string;
  joinCharacter?: PlayerCharacterSummary;
  itemType?: string;
  item?: unknown;
}

@Component({
  selector: 'app-item-view-specs-page',
  templateUrl: './item-view-specs.html',
  styleUrls: ['./item-view-specs.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CharacterShipBadge],
})
/**
 * Item specs page that maps item payloads into grouped blueprint/spec display data.
 */
export default class ItemViewSpecsPage {
  protected readonly t = locale;
  private router = inject(Router);

  protected playerName = signal<string>('');
  protected joinCharacter = signal<PlayerCharacterSummary | null>(null);
  protected itemType = signal<string>('');
  protected item = signal<unknown>(null);

  constructor() {
    this.applyNavigationState(this.readNavigationState());
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.applyNavigationState(this.readNavigationState()));
  }

  /**
   * Reads navigation state from current transition or browser history fallback.
   */
  private readNavigationState(): ItemViewSpecsNavigationState {
    return resolveNavigationState<ItemViewSpecsNavigationState>(this.router);
  }

  /**
   * Applies partial navigation state updates into page signals.
   */
  private applyNavigationState(state: ItemViewSpecsNavigationState): void {
    if (typeof state.playerName === 'string') {
      this.playerName.set(state.playerName);
    }

    if ('joinCharacter' in state) {
      this.joinCharacter.set(state.joinCharacter ?? null);
    }

    if (typeof state.itemType === 'string' && state.itemType.trim().length > 0) {
      this.itemType.set(state.itemType);
    }

    if ('item' in state) {
      this.item.set(state.item ?? null);
    }
  }

  protected config = computed<ItemViewSpecsConfig | null>(() => {
    const type = this.itemType();
    return ITEM_VIEW_SPECS_CONFIGS.get(type) ?? null;
  });

  protected resolvedGroups = computed<ResolvedGroup[]>(() => {
    const cfg = this.config();
    const data = this.item();
    if (!cfg || data === null) return [];
    return resolveGroups(cfg, data);
  });

  protected displayTitle = computed(
    () => (this.config()?.title ?? this.itemType()) || this.t.game.itemViewSpecs.unknownItemTitle,
  );
  protected unitLine = computed(() => this.config()?.blueprint?.unitLine ?? this.t.game.itemViewSpecs.defaultUnitLine);
  protected classificationLine = computed(
    () => this.config()?.blueprint?.classificationLine ?? this.t.game.itemViewSpecs.defaultClassificationLine,
  );
  protected footerTag = computed(
    () => this.config()?.blueprint?.footerTag ?? this.t.game.itemViewSpecs.defaultFooterTag,
  );
  protected blueprintImagePath = computed(
    () => this.config()?.blueprint?.blueprintImagePath ?? getSpecsImagePath(this.itemType()),
  );
  protected blueprintLabels = computed(() => this.config()?.blueprint?.labels ?? []);
  protected shellBackgroundStyle = computed(() => {
    const backgroundImagePath = this.config()?.blueprint?.backgroundImagePath;
    if (!backgroundImagePath) {
      return 'radial-gradient(circle at 20% 20%, rgba(18, 54, 95, 0.55), rgba(4, 10, 20, 0.95))';
    }

    return `linear-gradient(180deg, rgba(2, 8, 18, 0.74), rgba(1, 6, 12, 0.92)), url('${backgroundImagePath}')`;
  });

  protected specImagePath = computed(() => getSpecsImagePath(this.itemType()));
  protected imageNotFound = signal(false);

  onImageError(): void {
    this.imageNotFound.set(true);
  }

  /**
   * Routes to character profile preserving current player/character context.
   */
  navigateToCharacterProfile(): void {
    this.router.navigate([{ outlets: { left: ['character-profile'] } }], {
      preserveFragment: true,
      state: {
        playerName: this.playerName(),
        joinCharacter: this.joinCharacter(),
      },
    });
  }
}
