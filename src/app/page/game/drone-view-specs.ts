import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PlayerCharacterSummary } from '../../model/character-list';
import { DroneSummary } from '../../model/drone-list';
import { summarizeDroneMotion } from '../../model/kinematics';

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
	protected droneMotion = computed(() => {
		const kinematics = this.joinDrone()?.kinematics;
		if (!kinematics) {
			return null;
		}

		return summarizeDroneMotion(kinematics);
	});
}
