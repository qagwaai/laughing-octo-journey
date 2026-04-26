import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PlayerCharacterSummary } from '../../model/character-list';
import { coerceShipModel, coerceShipTier, ShipSummary } from '../../model/ship-list';
import { summarizeShipMotion } from '../../model/kinematics';

interface ShipViewSpecsNavigationState {
	playerName?: string;
	joinCharacter?: PlayerCharacterSummary;
	joinShip?: ShipSummary;
}

@Component({
	selector: 'app-ship-view-specs-page',
	templateUrl: './ship-view-specs.html',
	styleUrls: ['./ship-view-specs.css'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class ShipViewSpecsPage {
	private router = inject(Router);
	private navigationState: ShipViewSpecsNavigationState =
		(this.router.getCurrentNavigation()?.extras.state as ShipViewSpecsNavigationState | undefined) ??
		(history.state as ShipViewSpecsNavigationState | undefined) ??
		{};

	protected playerName = signal<string>(this.navigationState.playerName ?? '');
	protected joinCharacter = signal<PlayerCharacterSummary | null>(this.navigationState.joinCharacter ?? null);
	protected joinShip = signal<ShipSummary | null>(this.navigationState.joinShip ?? null);
	protected shipMotion = computed(() => {
		const kinematics = this.joinShip()?.kinematics;
		if (!kinematics) {
			return null;
		}

		return summarizeShipMotion(kinematics);
	});
	protected shipModel = computed(() => coerceShipModel(this.joinShip()?.model));
	protected shipTier = computed(() => coerceShipTier(this.joinShip()?.tier));

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
