import { ChangeDetectionStrategy, Component, computed, inject, Input } from '@angular/core';
import { Router } from '@angular/router';
import { locale } from '../i18n/locale';
import { PlayerCharacterSummary } from '../model/character-list';
import { ShipSummary } from '../model/ship-list';
import { SessionService } from '../services/session.service';

@Component({
  selector: 'app-character-ship-badge',
  templateUrl: './character-ship-badge.html',
  styleUrls: ['./character-ship-badge.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CharacterShipBadge {
  private router = inject(Router);
  private sessionService = inject(SessionService);
  private activeShipSource: unknown = this.sessionService.activeShip;

  @Input() playerName = '';
  @Input() joinCharacter: PlayerCharacterSummary | null = null;

  protected readonly t = locale.common.characterShipBadge;

  protected characterInitials(name: string): string {
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.charAt(0).toUpperCase() ?? '';
    const last = parts.length > 1 ? (parts[parts.length - 1]?.charAt(0).toUpperCase() ?? '') : '';
    return first + last;
  }
  readonly activeShip = (): ShipSummary | null => {
    if (typeof this.activeShipSource === 'function') {
      const value = this.activeShipSource();
      return (value as ShipSummary | null) ?? null;
    }

    return null;
  };
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
