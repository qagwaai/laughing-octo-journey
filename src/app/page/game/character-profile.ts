import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom, timeout } from 'rxjs';
import { CharacterShipBadge } from '../../component/character-ship-badge';
import { GuardedLeftMenu } from '../../component/guarded-left-menu';
import { locale } from '../../i18n/locale';
import { type BustDescriptorInput, type CharacterBustReadResponse } from '../../model/bust-descriptor';
import { readCachedCharacterBustDescriptor } from '../../model/character-bust-cache';
import { PlayerCharacterSummary } from '../../model/character-list';
import type { CreditLedgerEntry } from '../../model/domain/character-economy';
import { BustDescriptorAdapterService } from '../../services/bust-descriptor-adapter.service';
import { CreditLedgerService } from '../../services/credit-ledger.service';
import { appLogger } from '../../services/logger';
import { SessionService } from '../../services/session.service';
import { buildPortraitFilename } from '../character/components/character-preview-image/character-preview-image';
import { resolveNavigationState } from '../navigation-state';

const PORTRAIT_BASE_PATH = '/images/portraits';
const CHARACTER_PROFILE_BUST_READ_TIMEOUT_MS = 5000;
const CHARACTER_PROFILE_CREDIT_LEDGER_TIMEOUT_MS = 5000;
export const CHARACTER_PROFILE_CREDIT_LEDGER_PAGE_SIZE = 25;

interface ServerCreditLedgerState {
  entries: CreditLedgerEntry[];
  total: number;
  balance: number;
  /** Offset for the next page, advanced by entries actually received from the server. */
  nextOffset: number;
  /** True once the server returned an empty page before reaching `total`. */
  exhausted: boolean;
}

/** Matches the server's credit-ledger-list order: timestamp descending, then id ascending. */
function sortLedgerNewestFirst(entries: readonly CreditLedgerEntry[]): CreditLedgerEntry[] {
  return [...entries].sort((a, b) => {
    const byTime = Date.parse(b.timestamp) - Date.parse(a.timestamp);
    if (byTime !== 0 && !Number.isNaN(byTime)) {
      return byTime;
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

interface CharacterProfileAttribute {
  label: string;
  value: string;
}

interface CharacterProfileNavigationState {
  playerName?: string;
  joinCharacter?: PlayerCharacterSummary;
}

@Component({
  selector: 'app-character-profile-page',
  templateUrl: './character-profile.html',
  styleUrls: ['./character-profile.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GuardedLeftMenu, CharacterShipBadge, DatePipe],
})
/**
 * Displays character profile details and links back to profile outlet flows.
 */
export default class CharacterProfilePage {
  protected readonly t = locale;
  private router = inject(Router);
  private bustAdapter = inject(BustDescriptorAdapterService);
  private sessionService = inject(SessionService);
  private creditLedgerService = inject(CreditLedgerService);
  private navigationState: CharacterProfileNavigationState = resolveNavigationState<CharacterProfileNavigationState>(
    this.router,
  );

  protected playerName = signal<string>(this.navigationState.playerName ?? '');
  protected joinCharacter = signal<PlayerCharacterSummary | null>(this.navigationState.joinCharacter ?? null);
  protected bustDescriptor = signal<BustDescriptorInput | null>(null);
  protected bustDescriptorLoading = signal(false);
  protected bustDescriptorLoadFailed = signal(false);
  protected portraitLoadFailed = signal(false);
  /** Server-sourced ledger state; null until the first credit-ledger-list page succeeds. */
  protected serverCreditLedger = signal<ServerCreditLedgerState | null>(null);
  protected creditLedgerLoading = signal(false);
  protected creditLedgerLoadFailed = signal(false);
  protected creditLedgerLoadingMore = signal(false);
  protected creditLedgerLoadMoreFailed = signal(false);

  protected readonly creditLedgerEntries = computed<CreditLedgerEntry[]>(() => {
    const server = this.serverCreditLedger();
    if (server) {
      return server.entries;
    }
    return sortLedgerNewestFirst(this.joinCharacter()?.creditLedger ?? []);
  });

  /** Authoritative server balance when loaded; otherwise the character-list snapshot. */
  protected readonly creditBalance = computed<number>(
    () => this.serverCreditLedger()?.balance ?? this.joinCharacter()?.credits ?? 0,
  );

  protected readonly creditLedgerHasMore = computed<boolean>(() => {
    const server = this.serverCreditLedger();
    return !!server && !server.exhausted && server.nextOffset < server.total;
  });

  protected readonly portraitSrc = computed(() => {
    const descriptor = this.bustDescriptor();
    if (!descriptor) {
      return null;
    }

    return `${PORTRAIT_BASE_PATH}/${buildPortraitFilename(descriptor)}`;
  });

  protected readonly bustAttributes = computed<CharacterProfileAttribute[]>(() => {
    const descriptor = this.bustDescriptor();
    if (!descriptor) {
      return [];
    }

    return [
      { label: this.t.character.setup.bust.presetVersionLabel, value: descriptor.presetVersion },
      { label: this.t.character.setup.bust.faceShapeLabel, value: descriptor.faceShape },
      { label: this.t.character.setup.bust.skinToneLabel, value: descriptor.skinTone },
      { label: this.t.character.setup.bust.hairStyleLabel, value: descriptor.hairStyle },
      { label: this.t.character.setup.bust.hairColorLabel, value: descriptor.hairColor },
      { label: this.t.character.setup.bust.eyeStyleLabel, value: descriptor.eyeStyle },
      { label: this.t.character.setup.bust.eyeColorLabel, value: descriptor.eyeColor },
      { label: this.t.character.setup.bust.expressionLabel, value: descriptor.expressionPreset },
      { label: this.t.character.setup.bust.apparelAccentLabel, value: descriptor.apparelAccent },
      { label: this.t.character.setup.bust.facialHairLabel, value: descriptor.facialHair },
      { label: this.t.character.setup.bust.scarLabel, value: descriptor.scar },
      { label: this.t.character.setup.bust.tattooLabel, value: descriptor.tattoo },
    ];
  });

  constructor() {
    this.loadCharacterBustDescriptor();
    this.loadCreditLedger();
  }

  /**
   * Re-opens character profile outlet while preserving current player context.
   */
  navigateToCharacterProfile(): void {
    this.router.navigate([{ outlets: { left: ['character-profile'] } }], {
      preserveFragment: true,
      state: {
        playerName: this.playerName(),
        joinCharacter: this.joinCharacter(),
      },
    });
  }

  protected handlePortraitLoad(): void {
    this.portraitLoadFailed.set(false);
  }

  protected handlePortraitError(): void {
    this.portraitLoadFailed.set(true);
  }

  /**
   * Appends the next credit-ledger page. Entries already shown are de-duplicated by id because
   * offsets can shift when new movements are recorded between page requests.
   */
  protected loadMoreCreditLedger(): void {
    const current = this.serverCreditLedger();
    const context = this.creditLedgerRequestContext();
    if (!current || !context || this.creditLedgerLoadingMore() || !this.creditLedgerHasMore()) {
      return;
    }

    this.creditLedgerLoadingMore.set(true);
    this.creditLedgerLoadMoreFailed.set(false);

    void this.creditLedgerService
      .fetchCreditLedgerPage(
        { ...context, offset: current.nextOffset, limit: CHARACTER_PROFILE_CREDIT_LEDGER_PAGE_SIZE },
        CHARACTER_PROFILE_CREDIT_LEDGER_TIMEOUT_MS,
      )
      .then((response) => {
        const latest = this.serverCreditLedger() ?? current;
        const seen = new Set(latest.entries.map((entry) => entry.id));
        const pageEntries = response.entries ?? [];
        this.serverCreditLedger.set({
          entries: [...latest.entries, ...pageEntries.filter((entry) => !seen.has(entry.id))],
          total: response.total,
          balance: response.balance,
          nextOffset: latest.nextOffset + pageEntries.length,
          exhausted: pageEntries.length === 0,
        });
      })
      .catch((error: unknown) => {
        this.creditLedgerLoadMoreFailed.set(true);
        const message = error instanceof Error ? error.message : String(error);
        appLogger.warn(`Unable to load more credit ledger entries for character profile: ${message}`);
      })
      .finally(() => {
        this.creditLedgerLoadingMore.set(false);
      });
  }

  private creditLedgerRequestContext(): { playerName: string; sessionKey: string; characterId: string } | null {
    const playerName = this.playerName().trim();
    const sessionKey = this.sessionService.getSessionKey()?.trim() ?? '';
    const characterId = this.joinCharacter()?.id?.trim() ?? '';
    return playerName && sessionKey && characterId ? { playerName, sessionKey, characterId } : null;
  }

  private loadCreditLedger(): void {
    const context = this.creditLedgerRequestContext();
    if (!context) {
      return;
    }

    this.creditLedgerLoading.set(true);
    this.creditLedgerLoadFailed.set(false);

    void this.creditLedgerService
      .fetchCreditLedgerPage(
        { ...context, offset: 0, limit: CHARACTER_PROFILE_CREDIT_LEDGER_PAGE_SIZE },
        CHARACTER_PROFILE_CREDIT_LEDGER_TIMEOUT_MS,
      )
      .then((response) => {
        const entries = response.entries ?? [];
        this.serverCreditLedger.set({
          entries,
          total: response.total,
          balance: response.balance,
          nextOffset: entries.length,
          exhausted: entries.length === 0,
        });
      })
      .catch((error: unknown) => {
        this.creditLedgerLoadFailed.set(true);
        const message = error instanceof Error ? error.message : String(error);
        appLogger.warn(`Unable to load credit ledger for character profile: ${message}`);
      })
      .finally(() => {
        this.creditLedgerLoading.set(false);
      });
  }

  private loadCharacterBustDescriptor(): void {
    const playerName = this.playerName().trim();
    const sessionKey = this.sessionService.getSessionKey()?.trim() ?? '';
    const characterId = this.joinCharacter()?.id?.trim() ?? '';

    if (characterId) {
      const cachedDescriptor = readCachedCharacterBustDescriptor(characterId);
      if (cachedDescriptor) {
        this.bustDescriptor.set(cachedDescriptor);
      }
    }

    if (!playerName || !sessionKey || !characterId) {
      return;
    }

    this.bustDescriptorLoading.set(true);
    this.bustDescriptorLoadFailed.set(false);

    void firstValueFrom(
      this.bustAdapter
        .readCharacterBust({ playerName, sessionKey, characterId })
        .pipe(timeout(CHARACTER_PROFILE_BUST_READ_TIMEOUT_MS)),
    )
      .then((response: CharacterBustReadResponse) => {
        if (!response.success || !response.descriptor) {
          this.bustDescriptorLoadFailed.set(this.bustDescriptor() === null);
          return;
        }

        this.bustDescriptor.set(response.descriptor);
      })
      .catch((error: unknown) => {
        const isTimeout = error instanceof Error && error.name === 'TimeoutError';
        const hasDescriptor = this.bustDescriptor() !== null;

        this.bustDescriptorLoadFailed.set(!hasDescriptor);
        const message = error instanceof Error ? error.message : String(error);
        appLogger.warn(
          `Unable to load bust descriptor for character profile: ${message} (timeout=${isTimeout ? '1' : '0'}, usingCachedFallback=${hasDescriptor ? '1' : '0'})`,
        );
      })
      .finally(() => {
        this.bustDescriptorLoading.set(false);
      });
  }
}
