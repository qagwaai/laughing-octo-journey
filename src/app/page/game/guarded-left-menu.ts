import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import { Router } from '@angular/router';
import { PlayerCharacterSummary } from '../../model/character-list';

@Component({
	selector: 'app-guarded-left-menu',
	templateUrl: './guarded-left-menu.html',
	styleUrls: ['./guarded-left-menu.css'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GuardedLeftMenu {
	private router = inject(Router);

	@Input() playerName = '';
	@Input() joinCharacter: PlayerCharacterSummary | null = null;

	navigateLeft(route: string): void {
		this.router.navigate([{ outlets: { left: [route] } }], {
			preserveFragment: true,
			state: {
				playerName: this.playerName,
				joinCharacter: this.joinCharacter,
			},
		});
	}
}
