import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PlayerCharacterSummary } from '../../model/character-list';

interface GameJoinNavigationState {
	playerName?: string;
	joinCharacter?: PlayerCharacterSummary;
}

@Component({
	selector: 'app-game-join-page',
	templateUrl: './game-join.html',
	styleUrls: ['./game-join.css'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class GameJoinPage {
	private router = inject(Router);
	private navigationState: GameJoinNavigationState =
		(this.router.getCurrentNavigation()?.extras.state as GameJoinNavigationState | undefined) ??
		(history.state as GameJoinNavigationState | undefined) ??
		{};

	protected playerName = signal<string>(this.navigationState.playerName ?? '');
	protected joinCharacter = signal<PlayerCharacterSummary | null>(this.navigationState.joinCharacter ?? null);
	protected characterName = signal<string>(this.joinCharacter()?.characterName ?? 'Unknown Character');
}
