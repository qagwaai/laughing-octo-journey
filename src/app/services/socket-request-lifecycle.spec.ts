import { SocketRequestLifecycle } from './socket-request-lifecycle';

type Handler = (payload: unknown) => void;

function createFakeSocket() {
  const handlers = new Map<string, Set<Handler>>();
  const emitted: Array<{ event: string; payload: unknown }> = [];
  let offCalls = 0;

  return {
    socket: {
      on: (event: string, callback: Handler) => {
        const set = handlers.get(event) ?? new Set<Handler>();
        set.add(callback);
        handlers.set(event, set);
      },
      off: (event: string, callback: Handler) => {
        offCalls += 1;
        const set = handlers.get(event);
        if (!set) {
          return;
        }
        set.delete(callback);
        if (set.size === 0) {
          handlers.delete(event);
        }
      },
      emit: (event: string, payload: unknown) => {
        emitted.push({ event, payload });
      },
    },
    trigger: (event: string, payload: unknown) => {
      const set = handlers.get(event);
      if (!set) {
        return;
      }
      for (const callback of Array.from(set)) {
        callback(payload);
      }
    },
    emitted,
    getOffCalls: () => offCalls,
  };
}

describe('SocketRequestLifecycle', () => {
  it('serializes requests for the same domain key', (done) => {
    const lifecycle = new SocketRequestLifecycle();
    const fake = createFakeSocket();
    const matched: string[] = [];

    lifecycle.runQueuedRequestWithResponse({
      socket: fake.socket as any,
      domainKey: 'domain-1',
      correlationId: 'corr-1',
      requestEvent: 'req',
      responseEvent: 'res',
      requestPayload: { id: 1 },
      timeoutMs: 5000,
      isResponseForRequest: (response: any) => response?.correlationId === 'corr-1',
      onResponseMatched: () => matched.push('corr-1'),
      onTimeout: () => {},
    });

    lifecycle.runQueuedRequestWithResponse({
      socket: fake.socket as any,
      domainKey: 'domain-1',
      correlationId: 'corr-2',
      requestEvent: 'req',
      responseEvent: 'res',
      requestPayload: { id: 2 },
      timeoutMs: 5000,
      isResponseForRequest: (response: any) => response?.correlationId === 'corr-2',
      onResponseMatched: () => matched.push('corr-2'),
      onTimeout: () => {},
    });

    expect(fake.emitted.length).toBe(1);
    expect(fake.emitted[0]?.payload).toEqual({ id: 1 });

    fake.trigger('res', { correlationId: 'corr-1' });

    setTimeout(() => {
      expect(fake.emitted.length).toBe(2);
      expect(fake.emitted[1]?.payload).toEqual({ id: 2 });

      fake.trigger('res', { correlationId: 'corr-2' });
      expect(matched).toEqual(['corr-1', 'corr-2']);
      done();
    }, 0);
  });

  it('allows different domain keys to run in parallel', () => {
    const lifecycle = new SocketRequestLifecycle();
    const fake = createFakeSocket();

    lifecycle.runQueuedRequestWithResponse({
      socket: fake.socket as any,
      domainKey: 'domain-a',
      correlationId: 'corr-a',
      requestEvent: 'req',
      responseEvent: 'res',
      requestPayload: { id: 'a' },
      timeoutMs: 5000,
      isResponseForRequest: (response: any) => response?.correlationId === 'corr-a',
      onTimeout: () => {},
    });

    lifecycle.runQueuedRequestWithResponse({
      socket: fake.socket as any,
      domainKey: 'domain-b',
      correlationId: 'corr-b',
      requestEvent: 'req',
      responseEvent: 'res',
      requestPayload: { id: 'b' },
      timeoutMs: 5000,
      isResponseForRequest: (response: any) => response?.correlationId === 'corr-b',
      onTimeout: () => {},
    });

    expect(fake.emitted.length).toBe(2);
  });

  it('times out and unblocks next queued request for the same domain', (done) => {
    const lifecycle = new SocketRequestLifecycle();
    const fake = createFakeSocket();
    let timeoutCalled = false;

    lifecycle.runQueuedRequestWithResponse({
      socket: fake.socket as any,
      domainKey: 'domain-timeout',
      correlationId: 'corr-1',
      requestEvent: 'req',
      responseEvent: 'res',
      requestPayload: { id: 1 },
      timeoutMs: 1,
      isResponseForRequest: (response: any) => response?.correlationId === 'corr-1',
      onTimeout: () => {
        timeoutCalled = true;
      },
    });

    lifecycle.runQueuedRequestWithResponse({
      socket: fake.socket as any,
      domainKey: 'domain-timeout',
      correlationId: 'corr-2',
      requestEvent: 'req',
      responseEvent: 'res',
      requestPayload: { id: 2 },
      timeoutMs: 5000,
      isResponseForRequest: (response: any) => response?.correlationId === 'corr-2',
      onTimeout: () => {},
    });

    expect(fake.emitted.length).toBe(1);

    setTimeout(() => {
      expect(timeoutCalled).toBeTrue();
      expect(fake.emitted.length).toBe(2);
      done();
    }, 20);
  });

  it('cancels pending operations and unsubscribes listeners on disconnect', () => {
    const lifecycle = new SocketRequestLifecycle();
    const fake = createFakeSocket();
    let matched = false;

    lifecycle.runQueuedRequestWithResponse({
      socket: fake.socket as any,
      domainKey: 'domain-cancel',
      correlationId: 'corr-cancel',
      requestEvent: 'req',
      responseEvent: 'res',
      requestPayload: { id: 'cancel' },
      timeoutMs: 5000,
      isResponseForRequest: (response: any) => response?.correlationId === 'corr-cancel',
      onResponseMatched: () => {
        matched = true;
      },
      onTimeout: () => {},
    });

    lifecycle.cancelPendingOperations('disconnect');
    expect(fake.getOffCalls()).toBeGreaterThan(0);

    fake.trigger('res', { correlationId: 'corr-cancel' });
    expect(matched).toBeFalse();
  });
});
