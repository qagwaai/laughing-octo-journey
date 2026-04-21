import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PlayerCharacterSummary } from '../../model/character-list';
import { GuardedLeftMenu } from './guarded-left-menu';

interface FabricationLabNavigationState {
	playerName?: string;
	joinCharacter?: PlayerCharacterSummary;
}

@Component({
	selector: 'app-fabrication-lab-page',
	templateUrl: './fabrication-lab.html',
	styleUrls: ['./fabrication-lab.css'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [GuardedLeftMenu],
})
export default class FabricationLabPage {
	private router = inject(Router);
	private navigationState: FabricationLabNavigationState =
		(this.router.getCurrentNavigation()?.extras.state as FabricationLabNavigationState | undefined) ??
		(history.state as FabricationLabNavigationState | undefined) ??
		{};

	protected playerName = signal<string>(this.navigationState.playerName ?? '');
	protected joinCharacter = signal<PlayerCharacterSummary | null>(this.navigationState.joinCharacter ?? null);
}
