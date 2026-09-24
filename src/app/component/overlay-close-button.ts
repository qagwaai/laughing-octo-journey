import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { locale } from '../i18n/locale';
import { SessionService } from '../services/session.service';

/**
 * Dismiss control for right-outlet overlay pages.
 *
 * Closing clears the `right` outlet and pins `primary` to the ship exterior scene, so the
 * overlay always resolves back to the main game view. When the ship exterior is already the
 * active primary route the router reuses it, so the scene is not remounted.
 *
 * Navigation identity (player name and joined character) is re-supplied from the session so
 * the exterior scene can keep issuing owner-scoped queries instead of falling back to
 * `unknown-player` / `unknown-character`.
 */
@Component({
  selector: 'app-overlay-close-button',
  templateUrl: './overlay-close-button.html',
  styleUrls: ['./overlay-close-button.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OverlayCloseButton {
  protected readonly t = locale;
  private readonly router = inject(Router);
  private readonly sessionService = inject(SessionService);

  protected close(): void {
    this.router.navigate([{ outlets: { primary: ['ship-exterior-view'], right: null } }], {
      preserveFragment: true,
      replaceUrl: true,
      state: this.buildNavigationState(),
    });
  }

  private buildNavigationState(): Record<string, unknown> {
    const entryContext = this.readSignal<{ playerName?: string; joinCharacter?: unknown }>('missionEntryContext');
    const playerName =
      entryContext?.playerName?.trim() || this.readSignal<string>('playerName')?.trim() || '';
    const joinCharacter = entryContext?.joinCharacter ?? this.readSignal<unknown>('activeCharacter') ?? null;

    return {
      ...(playerName ? { playerName } : {}),
      ...(joinCharacter ? { joinCharacter } : {}),
    };
  }

  /**
   * Reads a session signal defensively. Overlay hosts are widely unit-tested with partial
   * `SessionService` stubs, so a missing accessor must degrade to "no identity" rather
   * than throwing and breaking the close interaction.
   */
  private readSignal<T>(key: 'missionEntryContext' | 'playerName' | 'activeCharacter'): T | null {
    const accessor = (this.sessionService as Partial<Record<typeof key, () => unknown>>)[key];
    if (typeof accessor !== 'function') {
      return null;
    }

    try {
      return (accessor.call(this.sessionService) as T) ?? null;
    } catch {
      return null;
    }
  }
}
