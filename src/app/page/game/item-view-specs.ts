import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { PlayerCharacterSummary } from '../../model/character-list';
import { getSpecsImagePath, ItemViewSpecsConfig, ResolvedGroup, resolveGroups } from '../../model/item-view-specs';
import { ITEM_VIEW_SPECS_CONFIGS } from '../../model/item-view-specs-configs';

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
})
export default class ItemViewSpecsPage {
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

	private readNavigationState(): ItemViewSpecsNavigationState {
		return (
			(this.router.getCurrentNavigation()?.extras.state as ItemViewSpecsNavigationState | undefined) ??
			(history.state as ItemViewSpecsNavigationState | undefined) ??
			{}
		);
	}

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

	protected displayTitle = computed(() => (this.config()?.title ?? this.itemType()) || 'Unknown Item');
	protected unitLine = computed(
		() => this.config()?.blueprint?.unitLine ?? 'PROJECT STELLAR // FIELD OPERATIONS BLUEPRINT',
	);
	protected classificationLine = computed(
		() => this.config()?.blueprint?.classificationLine ?? 'UNIVERSAL ITEM TELEMETRY PROFILE',
	);
	protected footerTag = computed(
		() => this.config()?.blueprint?.footerTag ?? '[ L-BRACKET_SYSTEM_READY ]',
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
