import type { CharacterListResult } from '../model/character-list';
import type { LoginResponse } from '../model/login';
import type { RegisterResponse } from '../model/register';

export const AUTH_SELECTION_TIMEOUT_MS = 30000;
export const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function responseRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function nonblank(value: unknown): value is string {
  return typeof value === 'string' && /\S/.test(value);
}

function onlyKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

function validLedgerTimestamp(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):([0-5]\d)(?:\.\d+)?(?:Z|([+-])(\d{2}):(\d{2}))$/i.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1] &&
    Number(match[4]) < 24 && Number(match[5]) < 60 &&
    (match[7] === undefined || (Number(match[8]) < 24 && Number(match[9]) < 60)) &&
    Number.isFinite(Date.parse(value));
}

export function validAuthResponse(value: unknown, operation: 'login'): value is LoginResponse;
export function validAuthResponse(value: unknown, operation: 'register'): value is RegisterResponse;
export function validAuthResponse(value: unknown, operation: 'login' | 'register'): boolean {
  if (!responseRecord(value) || typeof value['message'] !== 'string' ||
      typeof value['correlationId'] !== 'string' || !UUID_V4_PATTERN.test(value['correlationId'])) return false;
  if (value['success'] === true) {
    const keys = ['success', 'message', 'correlationId', 'playerId'];
    if (operation === 'login') keys.push('sessionKey');
    return onlyKeys(value, keys) && nonblank(value['playerId']) &&
      (operation !== 'login' || nonblank(value['sessionKey']));
  }
  const reasons = ['invalid_request', 'unavailable', 'storage_failure', 'data_unavailable'];
  reasons.push(...(operation === 'login'
    ? ['invalid_credentials', 'conflict', 'outcome_unknown']
    : ['player_exists', 'outcome_unknown']));
  return value['success'] === false && onlyKeys(value, ['success', 'message', 'reason', 'correlationId']) &&
    typeof value['reason'] === 'string' && reasons.includes(value['reason']);
}

export function validCharacterIdentity(value: unknown): boolean {
  return responseRecord(value) && onlyKeys(value, ['operation', 'entityType', 'containerId']) &&
    value['operation'] === 'character-list' && value['entityType'] === 'character' && nonblank(value['containerId']);
}

export function validCharacterListResponse(value: unknown): value is CharacterListResult {
  if (!responseRecord(value) || typeof value['message'] !== 'string' ||
      typeof value['correlationId'] !== 'string' || !UUID_V4_PATTERN.test(value['correlationId'])) return false;
  if (value['requestIdentity'] !== undefined && !validCharacterIdentity(value['requestIdentity'])) return false;
  if (value['success'] === false) {
    return nonblank(value['playerName']) && validCharacterIdentity(value['requestIdentity']) &&
      Array.isArray(value['characters']) && value['characters'].length === 0 &&
      typeof value['reason'] === 'string' &&
      ['invalid_request', 'invalid_session', 'player_not_registered', 'incomplete_roster', 'outcome_unknown'].includes(value['reason']);
  }
  if (value['success'] !== true || !validCharacterIdentity(value['requestIdentity']) || !nonblank(value['playerName']) ||
      !onlyKeys(value, ['success', 'message', 'correlationId', 'requestIdentity', 'playerName', 'characters']) ||
      !Array.isArray(value['characters'])) return false;
  const characters = new Set<string>();
  const ledgers = new Set<string>();
  return value['characters'].every((character: unknown) => {
    if (!responseRecord(character) || !nonblank(character['id']) || characters.has(character['id']) ||
        !nonblank(character['characterName']) ||
        typeof character['credits'] !== 'number' || !Number.isFinite(character['credits']) ||
        (character['level'] !== undefined && (typeof character['level'] !== 'number' || !Number.isFinite(character['level']))) ||
        !Array.isArray(character['creditLedger']) || !Array.isArray(character['missions'])) return false;
    characters.add(character['id']);
    let balance = 0;
    for (const entry of character['creditLedger']) {
      if (!responseRecord(entry) || !nonblank(entry['id']) || ledgers.has(entry['id']) ||
          !['put', 'take'].includes(String(entry['type'])) || typeof entry['amount'] !== 'number' ||
          !Number.isFinite(entry['amount']) || entry['amount'] <= 0 || typeof entry['description'] !== 'string' ||
          !validLedgerTimestamp(entry['timestamp']) ||
          !(entry['referenceId'] === null || typeof entry['referenceId'] === 'string')) return false;
      ledgers.add(entry['id']);
      balance += entry['type'] === 'put' ? entry['amount'] : -entry['amount'];
      if (!Number.isFinite(balance)) return false;
    }
    if (balance !== character['credits']) return false;
    const missions = new Set<string>();
    return character['missions'].every((mission: unknown) => {
      if (!responseRecord(mission) ||
          !nonblank(mission['missionId']) || missions.has(mission['missionId']) ||
          !['available', 'active', 'completed'].includes(String(mission['status']))) return false;
      missions.add(mission['missionId']);
      return true;
    });
  });
}
