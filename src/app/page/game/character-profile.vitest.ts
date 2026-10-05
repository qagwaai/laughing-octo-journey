import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import type { CharacterBustReadResponse } from '../../model/bust-descriptor';
import type { CreditLedgerListRequest, CreditLedgerListResponse } from '../../model/credit-ledger-list';
import type { CreditLedgerEntry } from '../../model/domain/character-economy';
import { BustDescriptorAdapterService } from '../../services/bust-descriptor-adapter.service';
import { CreditLedgerService } from '../../services/credit-ledger.service';
import { SessionService } from '../../services/session.service';
import CharacterProfilePage from './character-profile';

const TEST_BUST_RESPONSE: CharacterBustReadResponse = {
  success: true,
  message: 'ok',
  correlationId: 'corr-1',
  requestIdentity: {
    operation: 'character-bust-read',
    entityType: 'character-bust',
    containerId: 'c-1',
  },
  playerName: 'Pioneer',
  characterId: 'c-1',
  descriptor: {
    schemaVersion: 'sw-15-m1-v1',
    presetVersion: 'sw-15-m2-a-v1',
    faceShape: 'oval',
    skinTone: 'medium',
    hairStyle: 'short-crop',
    hairColor: 'brown',
    eyeStyle: 'almond',
    eyeColor: 'green',
    expressionPreset: 'focused',
    apparelAccent: 'collar',
    facialHair: 'none',
    scar: 'none',
    tattoo: 'none',
  },
};

function setup(
  options: {
    navigationState?: Record<string, unknown>;
    bustReadResponse?: CharacterBustReadResponse;
    sessionKey?: string | null;
    ledgerPages?: Array<Pick<CreditLedgerListResponse, 'entries' | 'total' | 'balance'> | Error> | Error;
  } = {},
) {
  const resolvedSessionKey = Object.prototype.hasOwnProperty.call(options, 'sessionKey')
    ? (options.sessionKey ?? null)
    : 'session-key';

  const mockRouter = {
    getCurrentNavigation: () => (options.navigationState ? { extras: { state: options.navigationState } } : null),
    navigate: vi.fn(),
  };
  const mockBustAdapter = {
    readCharacterBust: vi.fn().mockReturnValue(of(options.bustReadResponse ?? TEST_BUST_RESPONSE)),
  };
  const mockSessionService = {
    getSessionKey: vi.fn().mockReturnValue(resolvedSessionKey),
    activeShip: () => null,
  };
  const ledgerPages = options.ledgerPages;
  let ledgerCall = 0;
  const mockCreditLedgerService = {
    fetchCreditLedgerPage: vi.fn().mockImplementation((request: CreditLedgerListRequest) => {
      if (ledgerPages instanceof Error) {
        return Promise.reject(ledgerPages);
      }
      const page = ledgerPages?.[ledgerCall++] ?? { entries: [], total: 0, balance: 0 };
      if (page instanceof Error) {
        return Promise.reject(page);
      }
      return Promise.resolve({
        success: true,
        message: 'ok',
        correlationId: 'corr',
        requestIdentity: { operation: 'credit-ledger-list', entityType: 'credit-ledger', containerId: 'c-1' },
        playerName: request.playerName,
        offset: request.offset ?? 0,
        limit: request.limit ?? 50,
        ...page,
      } satisfies CreditLedgerListResponse);
    }),
  };

  TestBed.configureTestingModule({
    imports: [CharacterProfilePage],
    providers: [
      { provide: Router, useValue: mockRouter },
      { provide: BustDescriptorAdapterService, useValue: mockBustAdapter },
      { provide: SessionService, useValue: mockSessionService },
      { provide: CreditLedgerService, useValue: mockCreditLedgerService },
    ],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
  });

  const fixture = TestBed.createComponent(CharacterProfilePage);
  fixture.detectChanges();
  return { component: fixture.componentInstance, fixture, mockBustAdapter, mockCreditLedgerService };
}

describe('CharacterProfilePage', () => {
  it('should initialize from navigation state', () => {
    const { component } = setup({
      navigationState: {
        playerName: 'Pioneer',
        joinCharacter: { id: 'c-1', characterName: 'Nova' },
      },
    });

    expect(component['playerName']()).toBe('Pioneer');
    expect(component['joinCharacter']()).toEqual(expect.objectContaining({ id: 'c-1', characterName: 'Nova' }));
  });

  it('should fallback to empty values', () => {
    const { component } = setup();
    expect(component['playerName']()).toBe('');
    expect(component['joinCharacter']()).toBeNull();
  });

  it('should load bust descriptor for portrait/attributes when character context is available', async () => {
    const { component, fixture, mockBustAdapter } = setup({
      navigationState: {
        playerName: 'Pioneer',
        joinCharacter: { id: 'c-1', characterName: 'Nova' },
      },
    });

    await fixture.whenStable();

    expect(mockBustAdapter.readCharacterBust).toHaveBeenCalledWith({
      playerName: 'Pioneer',
      sessionKey: 'session-key',
      characterId: 'c-1',
    });
    expect(component['bustDescriptor']()?.presetVersion).toBe('sw-15-m2-a-v1');
    expect(component['portraitSrc']()).toContain('/images/portraits/');
    expect(component['bustAttributes']().length).toBe(12);
  });

  it('should not request bust descriptor when session is unavailable', async () => {
    const { fixture, mockBustAdapter } = setup({
      sessionKey: null,
      navigationState: {
        playerName: 'Pioneer',
        joinCharacter: { id: 'c-1', characterName: 'Nova' },
      },
    });

    await fixture.whenStable();

    expect(mockBustAdapter.readCharacterBust).not.toHaveBeenCalled();
  });

  it('should hydrate portrait/attributes from cached bust descriptor when available', async () => {
    localStorage.setItem('character-bust-cache::c-1', JSON.stringify(TEST_BUST_RESPONSE.descriptor));

    const { component, fixture } = setup({
      sessionKey: null,
      navigationState: {
        playerName: 'Pioneer',
        joinCharacter: { id: 'c-1', characterName: 'Nova' },
      },
    });

    await fixture.whenStable();

    expect(component['bustDescriptor']()?.presetVersion).toBe('sw-15-m2-a-v1');
    expect(component['portraitSrc']()).toContain('/images/portraits/');
    expect(component['bustAttributes']().length).toBe(12);

    localStorage.removeItem('character-bust-cache::c-1');
  });

  describe('credits display', () => {
    const e = (id: string, type: 'put' | 'take', amount: number, ts: string): CreditLedgerEntry => ({
      id,
      type,
      amount,
      description: id,
      timestamp: ts,
      referenceId: null,
    });

    it('should request the first 25-entry page and show the authoritative server balance', async () => {
      const serverEntries = [
        e('credit-2', 'take', 120, '2026-05-02T00:00:00.000Z'),
        e('credit-1', 'put', 500, '2026-05-01T00:00:00.000Z'),
      ];
      const { component, fixture, mockCreditLedgerService } = setup({
        // balance deliberately differs from the page sum: it covers the full ledger, not the page.
        ledgerPages: [{ entries: serverEntries, total: 2, balance: 9000 }],
        navigationState: {
          playerName: 'Pioneer',
          joinCharacter: { id: 'c-1', characterName: 'Nova', credits: 0 },
        },
      });

      await fixture.whenStable();
      fixture.detectChanges();

      expect(mockCreditLedgerService.fetchCreditLedgerPage).toHaveBeenCalledTimes(1);
      expect(mockCreditLedgerService.fetchCreditLedgerPage).toHaveBeenCalledWith(
        { playerName: 'Pioneer', sessionKey: 'session-key', characterId: 'c-1', offset: 0, limit: 25 },
        expect.any(Number),
      );
      expect(component['creditLedgerEntries']()).toEqual(serverEntries);
      expect(component['creditBalance']()).toBe(9000);
      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelector('.credits-balance strong')?.textContent?.trim()).toBe('9000');
      expect(el.querySelectorAll('.ledger-table tbody tr').length).toBe(2);
      expect(el.querySelector('.ledger-load-more')).toBeNull();
    });

    it('should append the next page on Load more and de-duplicate shifted entries by id', async () => {
      const page1 = [e('c-4', 'put', 1, '2026-05-04T00:00:00.000Z'), e('c-3', 'put', 1, '2026-05-03T00:00:00.000Z')];
      const page2 = [e('c-3', 'put', 1, '2026-05-03T00:00:00.000Z'), e('c-2', 'take', 1, '2026-05-02T00:00:00.000Z')];
      const { component, fixture, mockCreditLedgerService } = setup({
        ledgerPages: [
          { entries: page1, total: 3, balance: 50 },
          { entries: page2, total: 3, balance: 55 },
        ],
        navigationState: { playerName: 'Pioneer', joinCharacter: { id: 'c-1', characterName: 'Nova' } },
      });

      await fixture.whenStable();
      fixture.detectChanges();

      const button = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.ledger-load-more');
      expect(button).toBeTruthy();
      button!.click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(mockCreditLedgerService.fetchCreditLedgerPage).toHaveBeenLastCalledWith(
        expect.objectContaining({ offset: 2, limit: 25 }),
        expect.any(Number),
      );
      expect(component['creditLedgerEntries']().map((x) => x.id)).toEqual(['c-4', 'c-3', 'c-2']);
      expect(component['creditBalance']()).toBe(55);
      expect(component['creditLedgerHasMore']()).toBe(false);
      expect((fixture.nativeElement as HTMLElement).querySelector('.ledger-load-more')).toBeNull();
    });

    it('should keep loaded entries and show an error when Load more fails', async () => {
      const { component, fixture } = setup({
        ledgerPages: [
          { entries: [e('c-2', 'put', 10, '2026-05-02T00:00:00.000Z')], total: 2, balance: 10 },
          new Error('timeout'),
        ],
        navigationState: { playerName: 'Pioneer', joinCharacter: { id: 'c-1', characterName: 'Nova' } },
      });

      await fixture.whenStable();
      component['loadMoreCreditLedger']();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(component['creditLedgerLoadMoreFailed']()).toBe(true);
      expect(component['creditLedgerEntries']().length).toBe(1);
      expect(component['creditLedgerHasMore']()).toBe(true);
      expect((fixture.nativeElement as HTMLElement).querySelector('.ledger-error')).toBeTruthy();
    });

    it('should fall back to the character-list snapshot (newest first) and flag failure when the request fails', async () => {
      const snapshot = [e('c-1', 'put', 42, '2026-05-01T00:00:00.000Z'), e('c-2', 'take', 2, '2026-05-02T00:00:00.000Z')];
      const { component, fixture } = setup({
        ledgerPages: new Error('boom'),
        navigationState: {
          playerName: 'Pioneer',
          joinCharacter: { id: 'c-1', characterName: 'Nova', credits: 40, creditLedger: snapshot },
        },
      });

      await fixture.whenStable();
      fixture.detectChanges();

      expect(component['creditLedgerLoadFailed']()).toBe(true);
      expect(component['creditBalance']()).toBe(40);
      expect(component['creditLedgerEntries']().map((x) => x.id)).toEqual(['c-2', 'c-1']);
      expect(component['creditLedgerHasMore']()).toBe(false);
      expect((fixture.nativeElement as HTMLElement).querySelector('.ledger-error')).toBeTruthy();
    });

    it('should not request the ledger when session is unavailable', async () => {
      const { fixture, mockCreditLedgerService } = setup({
        sessionKey: null,
        navigationState: {
          playerName: 'Pioneer',
          joinCharacter: { id: 'c-1', characterName: 'Nova' },
        },
      });

      await fixture.whenStable();

      expect(mockCreditLedgerService.fetchCreditLedgerPage).not.toHaveBeenCalled();
    });

    it('should expose credits from joinCharacter when present', () => {
      const { component } = setup({
        navigationState: {
          playerName: 'Pioneer',
          joinCharacter: { id: 'c-1', characterName: 'Nova', credits: 425 },
        },
      });
      expect(component['joinCharacter']()?.credits).toBe(425);
    });

    it('should treat missing credits as zero', () => {
      const { component } = setup({
        navigationState: {
          playerName: 'Pioneer',
          joinCharacter: { id: 'c-1', characterName: 'Nova' },
        },
      });
      expect(component['joinCharacter']()?.credits ?? 0).toBe(0);
    });

    it('should expose creditLedger from joinCharacter when present', () => {
      const entry: CreditLedgerEntry = {
        id: 'entry-1',
        type: 'put',
        amount: 425,
        description: 'Starting credits',
        timestamp: '2026-05-01T00:00:00.000Z',
        referenceId: null,
      };
      const { component } = setup({
        navigationState: {
          playerName: 'Pioneer',
          joinCharacter: { id: 'c-1', characterName: 'Nova', credits: 425, creditLedger: [entry] },
        },
      });
      expect(component['joinCharacter']()?.creditLedger?.length).toBe(1);
      expect(component['joinCharacter']()?.creditLedger?.[0]).toEqual(entry);
    });

    it('should treat missing creditLedger as empty', () => {
      const { component } = setup({
        navigationState: {
          playerName: 'Pioneer',
          joinCharacter: { id: 'c-1', characterName: 'Nova', credits: 0 },
        },
      });
      expect(component['joinCharacter']()?.creditLedger ?? []).toEqual([]);
    });

    it('should correctly identify put and take entry types', () => {
      const putEntry: CreditLedgerEntry = {
        id: 'entry-2',
        type: 'put',
        amount: 200,
        description: 'Mission reward',
        timestamp: '2026-05-02T00:00:00.000Z',
        referenceId: 'm-01',
      };
      const takeEntry: CreditLedgerEntry = {
        id: 'entry-3',
        type: 'take',
        amount: 50,
        description: 'Market purchase',
        timestamp: '2026-05-03T00:00:00.000Z',
        referenceId: null,
      };
      const { component } = setup({
        navigationState: {
          playerName: 'Pioneer',
          joinCharacter: { id: 'c-1', characterName: 'Nova', credits: 150, creditLedger: [putEntry, takeEntry] },
        },
      });
      const ledger = component['joinCharacter']()!.creditLedger!;
      expect(ledger[0].type).toBe('put');
      expect(ledger[1].type).toBe('take');
    });

    it('should support referenceId being null or a string', () => {
      const withRef: CreditLedgerEntry = {
        id: 'entry-4',
        type: 'put',
        amount: 100,
        description: 'Ref reward',
        timestamp: '2026-05-04T00:00:00.000Z',
        referenceId: 'mission-ref-1',
      };
      const withoutRef: CreditLedgerEntry = {
        id: 'entry-5',
        type: 'take',
        amount: 30,
        description: 'No ref spend',
        timestamp: '2026-05-04T01:00:00.000Z',
        referenceId: null,
      };
      expect(withRef.referenceId).toBe('mission-ref-1');
      expect(withoutRef.referenceId).toBeNull();
    });
  });

  describe('DOM smoke tests', () => {
    it('should render without error', () => {
      const { fixture } = setup();
      fixture.detectChanges();
      expect(fixture.nativeElement).toBeTruthy();
    });
  });
});

describe('CreditLedgerEntry model', () => {
  it('should accept a valid put entry', () => {
    const entry: CreditLedgerEntry = {
      id: 'entry-6',
      type: 'put',
      amount: 425,
      description: 'Starting credits',
      timestamp: '2026-05-01T00:00:00.000Z',
      referenceId: null,
    };
    expect(entry.type).toBe('put');
    expect(entry.amount).toBe(425);
    expect(entry.referenceId).toBeNull();
  });

  it('should accept a valid take entry', () => {
    const entry: CreditLedgerEntry = {
      id: 'entry-7',
      type: 'take',
      amount: 75,
      description: 'Repair cost',
      timestamp: '2026-05-02T12:00:00.000Z',
      referenceId: 'repair-event-42',
    };
    expect(entry.type).toBe('take');
    expect(entry.amount).toBe(75);
    expect(entry.referenceId).toBe('repair-event-42');
  });
});
