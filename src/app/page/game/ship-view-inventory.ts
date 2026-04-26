import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PlayerCharacterSummary } from '../../model/character-list';
import { ShipSummary } from '../../model/ship-list';
import { GuardedLeftMenu } from '../../component/guarded-left-menu';
import { locale } from '../../i18n/locale';

interface ShipViewInventoryNavigationState {
	playerName?: string;
	joinCharacter?: PlayerCharacterSummary;
	joinShip?: ShipSummary;
}

export interface InventoryGroup {
	name: string;
	quantity: number;
}

@Component({
	selector: 'app-ship-view-inventory-page',
	templateUrl: './ship-view-inventory.html',
	styleUrls: ['./ship-view-inventory.css'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [GuardedLeftMenu],
})
export default class ShipViewInventoryPage {
	protected readonly t = locale;
	private router = inject(Router);
	private navigationState: ShipViewInventoryNavigationState =
		(this.router.getCurrentNavigation()?.extras.state as ShipViewInventoryNavigationState | undefined) ??
		(history.state as ShipViewInventoryNavigationState | undefined) ??
		{};

	protected playerName = signal<string>(this.navigationState.playerName ?? '');
	protected joinCharacter = signal<PlayerCharacterSummary | null>(this.navigationState.joinCharacter ?? null);
	protected joinShip = signal<ShipSummary | null>(this.navigationState.joinShip ?? null);

	protected inventoryGroups = computed<InventoryGroup[]>(() => {
		const inventory = this.joinShip()?.inventory ?? [];
		const counts = new Map<string, number>();
		for (const item of inventory) {
			counts.set(item.displayName, (counts.get(item.displayName) ?? 0) + 1);
		}
		return Array.from(counts.entries()).map(([name, quantity]) => ({ name, quantity }));
	});

	protected getShipDisplayName(): string {
		const ship = this.joinShip();
		return ship?.name?.trim() || ship?.id || '';
	}

	navigateBackToHangar(): void {
		this.router.navigate([{ outlets: { left: ['ship-hangar'] } }], {
			preserveFragment: true,
			state: {
				playerName: this.playerName(),
				joinCharacter: this.joinCharacter(),
			},
		});
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
