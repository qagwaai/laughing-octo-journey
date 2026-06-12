import { afterEach, describe, expect, it, vi } from 'vitest';
import { appLogger } from './logger';

describe('appLogger', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('dispatches app-logger-entry with warn metadata', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    appLogger.warn('[socket-correlation]', { reason: 'mismatch' });

    const event = dispatchSpy.mock.calls[0]?.[0] as CustomEvent;
    expect(event.type).toBe('app-logger-entry');
    expect(event.detail).toEqual({
      level: 'warn',
      args: ['[socket-correlation]', { reason: 'mismatch' }],
    });
    expect(warnSpy).toHaveBeenCalledWith('[socket-correlation]', { reason: 'mismatch' });
  });

  it('dispatches app-logger-entry with error metadata', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    appLogger.error('contract violation', { field: 'missionId' });

    const event = dispatchSpy.mock.calls[0]?.[0] as CustomEvent;
    expect(event.type).toBe('app-logger-entry');
    expect(event.detail).toEqual({
      level: 'error',
      args: ['contract violation', { field: 'missionId' }],
    });
    expect(errorSpy).toHaveBeenCalledWith('contract violation', { field: 'missionId' });
  });
});
