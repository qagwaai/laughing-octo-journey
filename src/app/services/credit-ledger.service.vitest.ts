import { TestBed } from '@angular/core/testing';
import {
  CREDIT_LEDGER_LIST_REQUEST_EVENT,
  CREDIT_LEDGER_LIST_RESPONSE_EVENT,
  type CreditLedgerListRequest,
  type CreditLedgerListResponse,
} from '../model/credit-ledger-list';
import { CreditLedgerListError, CreditLedgerService } from './credit-ledger.service';
import { SocketService } from './socket.service';

type Listener<T = unknown> = (payload: T) => void;

class MockSocketService {
  public readonly events = new Map<string, Set<Listener>>();
  public readonly emittedEvents: Array<{ event: string; data: CreditLedgerListRequest }> = [];
  public onEmit?: (data: CreditLedgerListRequest) => void;

  on(eventName: string, callback: Listener): () => void {
    const listeners = this.events.get(eventName) ?? new Set<Listener>();
    listeners.add(callback);
    this.events.set(eventName, listeners);
    return () => {
      this.events.get(eventName)?.delete(callback);
    };
  }

  emit(event: string, data: CreditLedgerListRequest): void {
    this.emittedEvents.push({ event, data });
    this.onEmit?.(data);
  }

  trigger<T>(eventName: string, payload: T): void {
    for (const listener of Array.from(this.events.get(eventName) ?? [])) {
      listener(payload);
    }
  }

  listenerCount(eventName: string): number {
    return this.events.get(eventName)?.size ?? 0;
  }
}

function responseFor(
  request: CreditLedgerListRequest,
  overrides: Partial<CreditLedgerListResponse> = {},
): CreditLedgerListResponse {
  return {
    success: true,
    message: 'ok',
    correlationId: request.correlationId!,
    requestIdentity: request.requestIdentity!,
    playerName: request.playerName,
    entries: [],
    total: 0,
    balance: 0,
    offset: request.offset ?? 0,
    limit: request.limit ?? 50,
    ...overrides,
  };
}

describe('CreditLedgerService', () => {
  let socketService: MockSocketService;
  let service: CreditLedgerService;

  beforeEach(() => {
    socketService = new MockSocketService();
    TestBed.configureTestingModule({
      providers: [{ provide: SocketService, useValue: socketService }],
    });
    service = TestBed.inject(CreditLedgerService);
  });

  it('emits credit-ledger-list-request scoped to the character and ignores mismatched responses', () => {
    let received: CreditLedgerListResponse | undefined;
    service.listCreditLedger({ playerName: 'Pioneer', sessionKey: 's-1', characterId: 'char-1', limit: 25 }, (r) => {
      received = r;
    });

    const emitted = socketService.emittedEvents[0];
    expect(emitted.event).toBe(CREDIT_LEDGER_LIST_REQUEST_EVENT);
    expect(emitted.data).toEqual(
      expect.objectContaining({
        playerName: 'Pioneer',
        sessionKey: 's-1',
        characterId: 'char-1',
        limit: 25,
        requestIdentity: { operation: 'credit-ledger-list', entityType: 'credit-ledger', containerId: 'char-1' },
      }),
    );
    expect(emitted.data.correlationId).toBeTruthy();

    socketService.trigger(CREDIT_LEDGER_LIST_RESPONSE_EVENT, responseFor(emitted.data, { correlationId: 'other' }));
    expect(received).toBeUndefined();

    socketService.trigger(
      CREDIT_LEDGER_LIST_RESPONSE_EVENT,
      responseFor(emitted.data, { requestIdentity: { ...emitted.data.requestIdentity!, containerId: 'char-2' } }),
    );
    expect(received).toBeUndefined();

    socketService.trigger(CREDIT_LEDGER_LIST_RESPONSE_EVENT, responseFor(emitted.data, { balance: 325, total: 2 }));
    expect(received?.balance).toBe(325);
    expect(socketService.listenerCount(CREDIT_LEDGER_LIST_RESPONSE_EVENT)).toBe(0);
  });

  it('uses the player-wide containerId when characterId is absent', () => {
    service.listCreditLedger({ playerName: ' PilotOne ', sessionKey: 's-1' }, () => undefined);
    expect(socketService.emittedEvents[0].data.requestIdentity?.containerId).toBe('player-pilotone');
  });

  it('resolves a single page including the authoritative balance', async () => {
    socketService.onEmit = (data) =>
      queueMicrotask(() =>
        socketService.trigger(
          CREDIT_LEDGER_LIST_RESPONSE_EVENT,
          responseFor(data, {
            entries: [
              { id: 'credit-2', type: 'take', amount: 100, description: 'Buy', timestamp: '2026-05-05T01:00:00.000Z', referenceId: 'o-1' },
            ],
            total: 40,
            balance: 9000,
          }),
        ),
      );

    const page = await service.fetchCreditLedgerPage(
      { playerName: 'Pioneer', sessionKey: 's-1', characterId: 'char-1', offset: 0, limit: 25 },
      1000,
    );

    expect(socketService.emittedEvents).toHaveLength(1);
    expect(page.balance).toBe(9000);
    expect(page.total).toBe(40);
    expect(page.entries[0].id).toBe('credit-2');
  });

  it('rejects with the failure reason instead of resolving failure zeros', async () => {
    socketService.onEmit = (data) =>
      queueMicrotask(() =>
        socketService.trigger(
          CREDIT_LEDGER_LIST_RESPONSE_EVENT,
          responseFor(data, { success: false, reason: 'character-not-found', message: 'Character was not found' }),
        ),
      );

    const promise = service.fetchCreditLedgerPage({ playerName: 'Pioneer', sessionKey: 's-1', characterId: 'x' }, 1000);
    await expect(promise).rejects.toBeInstanceOf(CreditLedgerListError);
    await expect(promise).rejects.toMatchObject({ reason: 'character-not-found' });
  });

  it('rejects with TimeoutError and detaches its listener when no response arrives', async () => {
    vi.useFakeTimers();
    try {
      const promise = service.fetchCreditLedgerPage({ playerName: 'Pioneer', sessionKey: 's-1', characterId: 'c' }, 500);
      const assertion = expect(promise).rejects.toMatchObject({ name: 'TimeoutError' });
      await vi.advanceTimersByTimeAsync(500);
      await assertion;
      expect(socketService.listenerCount(CREDIT_LEDGER_LIST_RESPONSE_EVENT)).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
