import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';
import { CharacterService } from './character.service';
import { SocketService } from './socket.service';
import { AUTH_SELECTION_TIMEOUT_MS, UUID_V4_PATTERN, validCharacterListResponse } from './auth-selection-response';

describe('Auth/selection contract adoption', () => {
  const listeners = new Map<string, Set<(value: unknown) => void>>();
  let emitted: { event: string; payload: Record<string, unknown> }[];
  let auth: AuthService;
  let characters: CharacterService;
  const reply = (event: string, value: unknown) => {
    for (const listener of [...(listeners.get(event) ?? [])]) listener(value);
  };

  beforeEach(() => {
    vi.useFakeTimers();
    listeners.clear();
    emitted = [];
    TestBed.configureTestingModule({
      providers: [{
        provide: SocketService,
        useValue: {
          emit: (event: string, payload: Record<string, unknown>) => emitted.push({ event, payload }),
          on: (event: string, callback: (value: unknown) => void) => {
            const set = listeners.get(event) ?? new Set();
            set.add(callback);
            listeners.set(event, set);
            return () => set.delete(callback);
          },
        },
      }],
    });
    auth = TestBed.inject(AuthService);
    characters = TestBed.inject(CharacterService);
  });

  afterEach(() => vi.useRealTimers());

  it('matches concurrent login replies exactly and discards missing/stale IDs', () => {
    const first = vi.fn();
    const second = vi.fn();
    const cancel = auth.login({ playerName: 'Pilot', password: 'password' }, first);
    auth.login({ playerName: 'Pilot', password: 'password' }, second);
    const a = emitted[0].payload['correlationId'];
    const b = emitted[1].payload['correlationId'];
    expect(a).toMatch(UUID_V4_PATTERN);
    expect(a).not.toBe(b);
    reply('login-response', { success: false, message: 'Unavailable', reason: 'unavailable' });
    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();
    cancel();
    reply('login-response', { success: true, message: 'ok', correlationId: a, playerId: 'p', sessionKey: 'a' });
    reply('login-response', { success: true, message: 'ok', correlationId: b, playerId: 'p', sessionKey: 'b' });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(AUTH_SELECTION_TIMEOUT_MS);
    expect(second).toHaveBeenCalledOnce();
  });

  it('surfaces malformed matched login and mutation timeout without replay', () => {
    const invalid = vi.fn();
    auth.login({ playerName: 'Pilot', password: 'password' }, invalid);
    reply('login-response', {
      success: true, message: 'ok', correlationId: emitted[0].payload['correlationId'], playerId: 'p',
    });
    expect(invalid).toHaveBeenCalledWith(expect.objectContaining({ success: false, clientError: 'invalid_response' }));
    const timedOut = vi.fn();
    auth.register({ playerName: 'Pilot', password: 'password', email: 'p@example.test' }, timedOut);
    vi.advanceTimersByTime(AUTH_SELECTION_TIMEOUT_MS);
    expect(timedOut).toHaveBeenCalledWith(expect.objectContaining({ success: false, clientError: 'timeout' }));
    expect(emitted).toHaveLength(2);
  });

  it('accepts correlated generic credential failure and never reflects extras', () => {
    const callback = vi.fn();
    auth.login({ playerName: 'Pilot', password: 'password', locale: 'it' }, callback);
    expect(Object.keys(emitted[0].payload).sort()).toEqual(['correlationId', 'locale', 'password', 'playerName']);
    reply('login-response', {
      success: false, message: 'Invalid credentials', reason: 'invalid_credentials',
      correlationId: emitted[0].payload['correlationId'],
    });
    expect(callback).toHaveBeenCalledWith(expect.objectContaining({ reason: 'invalid_credentials' }));
  });

  it('accepts served roster fields and failure envelope, rejects missing mission data', () => {
    const callback = vi.fn();
    characters.listCharacters({ playerName: 'Pilot', sessionKey: 'token', correlationSource: 'old-extra' }, callback);
    const request = emitted[0].payload;
    expect(request).not.toHaveProperty('correlationSource');
    reply('character-list-response', {
      success: true, message: 'ok', correlationId: request['correlationId'],
      requestIdentity: request['requestIdentity'], playerName: 'Pilot',
      characters: [{ id: 'c', characterName: 'Character', credits: 0, creditLedger: [], missions: [], ships: [], createdAt: '2026-01-01T00:00:00Z' }],
    });
    expect(callback).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    const failure = vi.fn();
    characters.listCharacters({ playerName: 'Pilot', sessionKey: 'token' }, failure);
    reply('character-list-response', {
      success: false, message: 'Unavailable', reason: 'incomplete_roster', correlationId: emitted[1].payload['correlationId'],
      requestIdentity: emitted[1].payload['requestIdentity'], playerName: 'Pilot', characters: [],
    });
    expect(failure).toHaveBeenCalledWith(expect.objectContaining({ reason: 'incomplete_roster' }));
    const malformed = vi.fn();
    characters.listCharacters({ playerName: 'Pilot', sessionKey: 'token' }, malformed);
    reply('character-list-response', {
      success: true, message: 'ok', correlationId: emitted[2].payload['correlationId'],
      requestIdentity: emitted[2].payload['requestIdentity'], playerName: 'Pilot',
      characters: [{ id: 'c', characterName: 'Character', credits: 0, creditLedger: [] }],
    });
    expect(malformed).toHaveBeenCalledWith(expect.objectContaining({ clientError: 'invalid_response' }));
  });

  it('ignores mismatched identity and expires selection without accepting uncorrelated notice', () => {
    const callback = vi.fn();
    characters.listCharacters({ playerName: 'Pilot', sessionKey: 'token' }, callback);
    reply('character-list-response', {
      success: false, message: 'Invalid session', reason: 'invalid_session',
      correlationId: emitted[0].payload['correlationId'],
      requestIdentity: { operation: 'character-list', entityType: 'character', containerId: 'other' },
    });
    expect(callback).not.toHaveBeenCalled();
    vi.advanceTimersByTime(AUTH_SELECTION_TIMEOUT_MS);
    expect(callback).toHaveBeenCalledWith(expect.objectContaining({ clientError: 'timeout' }));
  });

  it('rejects inconsistent balance, duplicate missions and invalid calendar dates', () => {
    const character = {
      id: 'c', characterName: 'Name', credits: 2, missions: [],
      creditLedger: [{
        id: 'l', type: 'put', amount: 2, description: '', timestamp: '2026-02-28T00:00:00Z', referenceId: null,
      }],
    };
    const response = {
      success: true, message: 'ok', correlationId: '00000000-0000-4000-8000-000000000001',
      requestIdentity: { operation: 'character-list', entityType: 'character', containerId: 'player' },
      playerName: 'Pilot', characters: [character],
    };
    expect(validCharacterListResponse(response)).toBe(true);
    expect(validCharacterListResponse({ ...response, characters: [{ ...character, credits: 0 }] })).toBe(false);
    expect(validCharacterListResponse({ ...response, characters: [{
      ...character, missions: [{ missionId: 'm', status: 'active' }, { missionId: 'm', status: 'completed' }],
    }] })).toBe(false);
    expect(validCharacterListResponse({ ...response, characters: [{
      ...character, creditLedger: [{ ...character.creditLedger[0], timestamp: '2026-02-31T00:00:00Z' }],
    }] })).toBe(false);
  });
});
