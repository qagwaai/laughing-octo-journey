import { TEST_PLAYER } from '../helpers/auth-helper';
import { SocketIOMock } from './socket-mock';

export const FIRST_TARGET_MISSION_ID = 'first-target';

export const PROFILE_CHARACTER = {
  id: 'char-profile-1',
  characterName: 'Profile Pilot',
  level: 4,
  missions: [{ missionId: FIRST_TARGET_MISSION_ID, status: 'active' }],
};

export const PROFILE_SHIP = {
  id: 'ship-profile-1',
  name: 'Pathfinder',
  model: 'Scavenger Pod',
  tier: 1,
  status: 'ACTIVE',
  spatial: {
    solarSystemId: 'sol',
    frame: 'barycentric',
    positionKm: { x: 1, y: 0, z: 0 },
    epochMs: 0,
  },
};

export const PROFILE_DESCRIPTOR = {
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
};

export function characterListResponse(characters: object[]) {
  return {
    success: true,
    message: '',
    playerName: TEST_PLAYER,
    characters,
  };
}

export function shipListByOwnerResponse() {
  return {
    success: true,
    message: '',
    playerName: TEST_PLAYER,
    characterId: PROFILE_CHARACTER.id,
    owner: {
      ownerType: 'player-character',
      playerId: 'player-1',
      characterId: PROFILE_CHARACTER.id,
      npcId: null,
      factionId: null,
    },
    ships: [PROFILE_SHIP],
  };
}

export function characterBustReadResponse() {
  return {
    success: true,
    message: 'Character bust retrieved successfully',
    playerName: TEST_PLAYER,
    characterId: PROFILE_CHARACTER.id,
    descriptor: PROFILE_DESCRIPTOR,
  };
}

export function registerCharacterProfileSessionHandlers(mock: SocketIOMock): void {
  mock.on('character-list-request', () => ({
    event: 'character-list-response',
    data: characterListResponse([PROFILE_CHARACTER]),
  }));
  mock.on('game-join-request', () => null);
  mock.on('ship-list-by-owner-request', () => ({
    event: 'ship-list-by-owner-response',
    data: shipListByOwnerResponse(),
  }));
}