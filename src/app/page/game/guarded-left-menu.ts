import { ChangeDetectionStrategy, Component, Input, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PlayerCharacterSummary } from '../../model/character-list';

const MENU_PIN_STORAGE_KEY = 'guarded-left-menu:pinned';

interface GuardedMenuItem {
	route: string;
	label: string;
	icon: string;
	logout?: boolean;
}

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

	protected readonly menuItems: GuardedMenuItem[] = [
		{ route: 'stellar-initiation', label: 'Stellar Initiation', icon: 'SI' },
		{ route: 'character-profile', label: 'Character Profile', icon: 'CP' },
		{ route: 'drone-hangar', label: 'Drone Hangar', icon: 'DH' },
		{ route: 'repair-retrofit', label: 'Repair & Retrofit', icon: 'RR' },
		{ route: 'market-hub', label: 'Market Hub', icon: 'MH' },
		{ route: 'fabrication-lab', label: 'Fabrication Lab', icon: 'FL' },
		{ route: 'logout', label: 'Logout', icon: 'LO', logout: true },
	];
	protected isPinned = signal(this.readPinnedState());
	protected isHovered = signal(false);
	protected isExpanded = computed(() => this.isPinned() || this.isHovered());

	navigateLeft(route: string): void {
		this.router.navigate([{ outlets: { left: [route] } }], {
			preserveFragment: true,
			state: {
				playerName: this.playerName,
				joinCharacter: this.joinCharacter,
			},
		});
	}

	protected onMouseEnter(): void {
		this.isHovered.set(true);
	}

	protected onMouseLeave(): void {
		this.isHovered.set(false);
	}

	protected togglePinned(): void {
		const nextPinned = !this.isPinned();
		this.isPinned.set(nextPinned);
		this.writePinnedState(nextPinned);
	}

	private readPinnedState(): boolean {
		try {
			return sessionStorage.getItem(MENU_PIN_STORAGE_KEY) === 'true';
		} catch {
			return false;
		}
	}

	private writePinnedState(isPinned: boolean): void {
		try {
			sessionStorage.setItem(MENU_PIN_STORAGE_KEY, String(isPinned));
		} catch {
			// Ignore storage failures and keep in-memory state only.
		}
	}
}
