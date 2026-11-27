import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GAME_JOIN_REQUEST_EVENT, GAME_JOIN_RESPONSE_EVENT } from '../model/game-join';
import { AUTH_SELECTION_TIMEOUT_MS } from './auth-selection-response';
import { GameSessionService } from './game-session.service';
import { SocketService } from './socket.service';

describe('Correlated game join', () => {
  const listeners = new Set<(value: unknown) => void>();
  let emitted: Record<string, unknown>[];
  let service: GameSessionService;
  const request = { playerName: 'Pilot', characterId: 'character-1', sessionKey: 'session' };
  const reply = (response: unknown) => {
    for (const listener of [...listeners]) listener(response);
  };
  const success = (index = 0) => ({
    success: true,
    message: 'Joined',
    playerName: request.playerName,
    characterId: request.characterId,
    correlationId: emitted[index]['correlationId'],
    requestIdentity: emitted[index]['requestIdentity'],
  });

  beforeEach(() => {
    vi.useFakeTimers();
    listeners.clear();
    emitted = [];
    TestBed.configureTestingModule({
      providers: [{
        provide: SocketService,
        useValue: {
          emit: (event: string, payload: Record<string, unknown>) => {
            expect(event).toBe(GAME_JOIN_REQUEST_EVENT);
            emitted.push(payload);
          },
          on: (event: string, callback: (value: unknown) => void) => {
            expect(event).toBe(GAME_JOIN_RESPONSE_EVENT);
            listeners.add(callback);
            return () => listeners.delete(callback);
          },
        },
      }],
    });
    service = TestBed.inject(GameSessionService);
  });

  afterEach(() => vi.useRealTimers());

  it('waits for the exact request and identity and completes once', () => {
    const callback = vi.fn();
    service.requestGameJoin(request, callback);
    reply({ ...success(), correlationId: '00000000-0000-4000-8000-000000000001' });
    reply({ ...success(), requestIdentity: { operation: 'game-join', entityType: 'game-session', containerId: 'other' } });
    expect(callback).not.toHaveBeenCalled();
    reply(success());
    reply(success());
    vi.advanceTimersByTime(AUTH_SELECTION_TIMEOUT_MS);
    expect(callback).toHaveBeenCalledExactlyOnceWith(success());
  });

  it('fails explicitly on malformed matched data or timeout without replay', () => {
    const invalid = vi.fn();
    service.requestGameJoin(request, invalid);
    reply({ ...success(), success: 'true' });
    expect(invalid).toHaveBeenCalledWith(expect.objectContaining({ success: false, clientError: 'invalid_response' }));
    const timedOut = vi.fn();
    service.requestGameJoin(request, timedOut);
    vi.advanceTimersByTime(AUTH_SELECTION_TIMEOUT_MS);
    expect(timedOut).toHaveBeenCalledWith(expect.objectContaining({ success: false, clientError: 'timeout' }));
    expect(emitted).toHaveLength(2);
  });

  it('accepts a fully correlated startup denial and preserves its reason', () => {
    const callback = vi.fn();
    service.requestGameJoin(request, callback);
    const denial = {
      ...success(),
      success: false,
      message: 'Game unavailable',
      availability: 'unavailable',
      reason: 'startup_not_verified',
    };
    reply(denial);
    reply(denial);
    expect(callback).toHaveBeenCalledExactlyOnceWith(denial);
  });

  it('does not resolve a denial without every matching correlation and identity field', () => {
    const callback = vi.fn();
    service.requestGameJoin(request, callback);
    const denial = {
      ...success(),
      success: false,
      message: 'Game unavailable',
      availability: 'unavailable',
      reason: 'startup_not_verified',
    };
    reply({ ...denial, correlationId: undefined });
    reply({ ...denial, requestIdentity: undefined });
    reply({ ...denial, requestIdentity: { operation: 'game-join', entityType: 'game-session', containerId: 'other' } });
    reply({ ...denial, playerName: undefined });
    reply({ ...denial, playerName: 'Another pilot' });
    reply({ ...denial, characterId: undefined });
    reply({ ...denial, characterId: 'other' });
    expect(callback).not.toHaveBeenCalled();
    reply(denial);
    expect(callback).toHaveBeenCalledExactlyOnceWith(denial);
  });

  it('rejects a matched denial with invalid availability metadata', () => {
    const callback = vi.fn();
    service.requestGameJoin(request, callback);
    reply({ ...success(), success: false, availability: 'unavailable', reason: 'unexpected' });
    expect(callback).toHaveBeenCalledWith(expect.objectContaining({ success: false, clientError: 'invalid_response' }));
  });

  it('cancels observation without replay or accepting a late success', () => {
    const callback = vi.fn();
    const cancel = service.requestGameJoin(request, callback);
    cancel();
    reply(success());
    vi.advanceTimersByTime(AUTH_SELECTION_TIMEOUT_MS);
    expect(callback).not.toHaveBeenCalled();
    expect(emitted).toHaveLength(1);
  });
});
