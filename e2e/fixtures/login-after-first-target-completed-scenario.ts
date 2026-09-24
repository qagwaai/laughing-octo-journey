import {
  registerMissionCharacterList,
  registerMissionGameJoin,
  registerMissionList,
  registerMissionShipListByOwner,
} from './mission-session-helpers';
import { SocketIOMock } from './socket-mock';

const FIRST_TARGET_MISSION_ID = 'first-target';

export const COMPLETED_FIRST_TARGET_SHIP_ID = 'ship-complete-1';

export const CHARACTER_WITH_COMPLETED_FIRST_TARGET = {
  id: 'char-complete-1',
  characterName: 'Survey Veteran',
  level: 8,
  missions: [{ missionId: FIRST_TARGET_MISSION_ID, status: 'completed' }],
};

const SHIP_POSITION_KM = { x: 1_000_000, y: 0, z: 0 };

const COMPLETED_FIRST_TARGET_SHIP = {
  id: COMPLETED_FIRST_TARGET_SHIP_ID,
  name: 'Jax',
  model: 'Scavenger Pod',
  tier: 1,
  status: 'Operational',
  inventory: [
    {
      id: 'item-sensor-1',
      itemType: 'sensor-array',
      displayName: 'Sensor Array',
      tier: 1,
      launchable: false,
      state: 'installed',
      damageStatus: 'intact',
      container: { containerType: 'ship', containerId: COMPLETED_FIRST_TARGET_SHIP_ID },
      owningPlayerId: 'e2e-player',
      owningCharacterId: CHARACTER_WITH_COMPLETED_FIRST_TARGET.id,
      kinematics: null,
      destroyedAt: null,
      destroyedReason: null,
      discoveredAt: null,
      discoveredByCharacterId: null,
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z',
    },
  ],
  spatial: {
    solarSystemId: 'sol',
    frame: 'barycentric',
    positionKm: SHIP_POSITION_KM,
    epochMs: Date.now(),
  },
  motion: { velocityKmPerSec: { x: 0, y: 0, z: 0 } },
  observability: { visibility: 'visible', scanState: 'scanned' },
};

/**
 * Celestial bodies that persist after the first mission completes. They sit within the
 * tier 1 sensor detection range of the ship so the post-mission scene has contacts to
 * render without any client-side seeding.
 */
const LOCAL_CELESTIAL_BODIES = [
  { id: 'local-body-1', offsetKm: { x: 12, y: 4, z: -6 } },
  { id: 'local-body-2', offsetKm: { x: -18, y: -3, z: 9 } },
  { id: 'local-body-3', offsetKm: { x: 7, y: 11, z: 15 } },
].map((body) => ({
  id: body.id,
  state: 'unscanned',
  spatial: {
    solarSystemId: 'sol',
    frame: 'barycentric',
    positionKm: {
      x: SHIP_POSITION_KM.x + body.offsetKm.x,
      y: SHIP_POSITION_KM.y + body.offsetKm.y,
      z: SHIP_POSITION_KM.z + body.offsetKm.z,
    },
    epochMs: Date.now(),
  },
  motion: {
    velocityKmPerSec: { x: 0, y: 0, z: 0 },
    angularVelocityRadPerSec: { x: 0, y: 0, z: 0 },
  },
  physical: { estimatedMassKg: 1.2e9, estimatedDiameterM: 140 },
  observability: { visibility: 'visible', scanState: 'unscanned' },
}));

const COMPLETED_FIRST_TARGET_MISSIONS = [
  {
    missionId: FIRST_TARGET_MISSION_ID,
    status: 'completed',
    completedAt: '2026-05-10T00:00:00.000Z',
    updatedAt: '2026-05-10T00:00:00.000Z',
  },
];

export function registerSharedSessionHandlers(mock: SocketIOMock): void {
  registerMissionCharacterList(mock, [CHARACTER_WITH_COMPLETED_FIRST_TARGET]);
  registerMissionGameJoin(mock);
  registerMissionShipListByOwner(mock, {
    characterId: CHARACTER_WITH_COMPLETED_FIRST_TARGET.id,
    ships: [COMPLETED_FIRST_TARGET_SHIP],
  });
  registerMissionList(mock, {
    characterId: CHARACTER_WITH_COMPLETED_FIRST_TARGET.id,
    missions: COMPLETED_FIRST_TARGET_MISSIONS,
  });
  mock.on('celestial-body-list-request', () => ({
    event: 'celestial-body-list-response',
    data: {
      success: true,
      message: '',
      playerName: 'e2e-player',
      solarSystemId: 'sol',
      positionKm: SHIP_POSITION_KM,
      distanceKm: 100,
      celestialBodies: LOCAL_CELESTIAL_BODIES,
    },
  }));
}
