import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
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
	private navigationState: ItemViewSpecsNavigationState =
		(this.router.getCurrentNavigation()?.extras.state as ItemViewSpecsNavigationState | undefined) ??
		(history.state as ItemViewSpecsNavigationState | undefined) ??
		{};

	protected playerName = signal<string>(this.navigationState.playerName ?? '');
	protected joinCharacter = signal<PlayerCharacterSummary | null>(this.navigationState.joinCharacter ?? null);
	protected itemType = signal<string>(this.navigationState.itemType ?? '');
	protected item = signal<unknown>(this.navigationState.item ?? null);

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
