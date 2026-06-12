import { describe, expect, it, vi } from 'vitest';
import { ContractVarianceNotifierService } from './contract-variance-notifier.service';

describe('ContractVarianceNotifierService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('enqueues socket correlation warnings and applies fallback labels', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const service = new ContractVarianceNotifierService();

    window.dispatchEvent(new CustomEvent('socket-correlation-warning', { detail: {} }));

    const active = service.activeToast();
    expect(active).not.toBeNull();
    expect(active?.level).toBe('warn');
    expect(active?.message).toBe('[socket-correlation] unknown-operation: contract-warning');
    expect(logSpy).toHaveBeenCalledWith('[contract-variance-notifier] socket-correlation-warning', {});
  });

  it('ignores non-contract app logger events', () => {
    const service = new ContractVarianceNotifierService();

    window.dispatchEvent(
      new CustomEvent('app-logger-entry', {
        detail: { level: 'warn', args: ['unrelated warning'] },
      }),
    );

    expect(service.activeToast()).toBeNull();
  });

  it('enqueues contract variance app logger events and stringifies message content', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const service = new ContractVarianceNotifierService();

    window.dispatchEvent(
      new CustomEvent('app-logger-entry', {
        detail: {
          level: 'error',
          args: ['[ship-exterior-contract]', { mismatch: true }, 'missing field'],
        },
      }),
    );

    const active = service.activeToast();
    expect(active).not.toBeNull();
    expect(active?.level).toBe('error');
    expect(active?.message).toContain('[ship-exterior-contract]');
    expect(active?.message).toContain('{"mismatch":true}');
    expect(logSpy).toHaveBeenCalledWith('[contract-variance-notifier] app-logger-contract-variance', {
      level: 'error',
      args: ['[ship-exterior-contract]', { mismatch: true }, 'missing field'],
    });
  });

  it('cycles queued toasts via dismiss and auto hide', () => {
    vi.useFakeTimers();
    try {
      const service = new ContractVarianceNotifierService();

      window.dispatchEvent(
        new CustomEvent('app-logger-entry', {
          detail: { level: 'warn', args: ['[socket-correlation]', 'first'] },
        }),
      );
      window.dispatchEvent(
        new CustomEvent('app-logger-entry', {
          detail: { level: 'error', args: ['contract violation', 'second'] },
        }),
      );

      expect(service.activeToast()?.message).toContain('first');
      service.dismissActiveToast();
      expect(service.activeToast()?.message).toContain('second');

      vi.advanceTimersByTime(6501);
      expect(service.activeToast()).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('handles unserializable logger args without crashing', () => {
    const circular: Record<string, unknown> = {};
    circular['self'] = circular;
    const service = new ContractVarianceNotifierService();

    window.dispatchEvent(
      new CustomEvent('app-logger-entry', {
        detail: { level: 'warn', args: ['[socket-correlation]', circular] },
      }),
    );

    expect(service.activeToast()).not.toBeNull();
    expect(service.activeToast()?.message).toContain('[socket-correlation]');
  });
});
