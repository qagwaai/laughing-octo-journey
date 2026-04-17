import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PlayerCharacterSummary } from '../../model/character-list';
import { DroneSummary } from '../../model/drone-list';

interface DroneViewSpecsNavigationState {
	playerName?: string;
	joinCharacter?: PlayerCharacterSummary;
	joinDrone?: DroneSummary;
}

@Component({
	selector: 'app-drone-view-specs-page',
	templateUrl: './drone-view-specs.html',
	styleUrls: ['./drone-view-specs.css'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class DroneViewSpecsPage {
	private router = inject(Router);
	private navigationState: DroneViewSpecsNavigationState =
		(this.router.getCurrentNavigation()?.extras.state as DroneViewSpecsNavigationState | undefined) ??
		(history.state as DroneViewSpecsNavigationState | undefined) ??
		{};

	protected playerName = signal<string>(this.navigationState.playerName ?? '');
	protected joinCharacter = signal<PlayerCharacterSummary | null>(this.navigationState.joinCharacter ?? null);
	protected joinDrone = signal<DroneSummary | null>(this.navigationState.joinDrone ?? null);
}
