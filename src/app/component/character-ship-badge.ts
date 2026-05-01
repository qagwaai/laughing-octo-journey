import { ChangeDetectionStrategy, Component, computed, inject, Input } from '@angular/core';
import { Router } from '@angular/router';
import { PlayerCharacterSummary } from '../model/character-list';
import { SessionService } from '../services/session.service';
import { locale } from '../i18n/locale';

@Component({
	selector: 'app-character-ship-badge',
	templateUrl: './character-ship-badge.html',
	styleUrls: ['./character-ship-badge.css'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CharacterShipBadge {
	private router = inject(Router);
	private sessionService = inject(SessionService);

	@Input() playerName = '';
	@Input() joinCharacter: PlayerCharacterSummary | null = null;

	protected readonly t = locale.common.characterShipBadge;
	readonly activeShip = this.sessionService.activeShip;
	readonly activeShipDisplayName = computed(() => {
		const ship = this.activeShip();
		if (!ship) {
			return this.t.noShipSelected;
		}

		const preferred = [ship.name, ship.model, ship.id]
			.map((value) => (typeof value === 'string' ? value.trim() : ''))
			.find((value) => value.length > 0);

		return preferred ?? this.t.noShipSelected;
	});

	navigateToCharacterProfile(): void {
		this.router.navigate([{ outlets: { left: ['character-profile'] } }], {
			preserveFragment: true,
			state: {
				playerName: this.playerName,
				joinCharacter: this.joinCharacter,
			},
		});
	}

	navigateToShipHangar(): void {
		this.router.navigate([{ outlets: { left: ['ship-hangar'] } }], {
			preserveFragment: true,
			state: {
				playerName: this.playerName,
				joinCharacter: this.joinCharacter,
			},
		});
	}
}
