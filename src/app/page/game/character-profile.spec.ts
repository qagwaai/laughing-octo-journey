import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import type { CreditLedgerEntry } from '../../model/domain/character-economy';
import CharacterProfilePage from './character-profile';

function setup(options: { navigationState?: Record<string, unknown> } = {}) {
  const mockRouter = {
    getCurrentNavigation: () => (options.navigationState ? { extras: { state: options.navigationState } } : null),
    navigate: jasmine.createSpy('navigate'),
  };

  TestBed.configureTestingModule({
    imports: [CharacterProfilePage],
    providers: [{ provide: Router, useValue: mockRouter }],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
  });

  const fixture = TestBed.createComponent(CharacterProfilePage);
  fixture.detectChanges();
  return { component: fixture.componentInstance, fixture };
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
    expect(component['joinCharacter']()).toEqual(jasmine.objectContaining({ id: 'c-1', characterName: 'Nova' }));
  });

  it('should fallback to empty values', () => {
    const { component } = setup();
    expect(component['playerName']()).toBe('');
    expect(component['joinCharacter']()).toBeNull();
  });

  describe('credits display', () => {
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
        type: 'put',
        amount: 200,
        description: 'Mission reward',
        timestamp: '2026-05-02T00:00:00.000Z',
        referenceId: 'm-01',
      };
      const takeEntry: CreditLedgerEntry = {
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
        type: 'put',
        amount: 100,
        description: 'Ref reward',
        timestamp: '2026-05-04T00:00:00.000Z',
        referenceId: 'mission-ref-1',
      };
      const withoutRef: CreditLedgerEntry = {
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
