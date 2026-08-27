import { TEST_PLAYER } from '../helpers/auth-helper';
import { SocketIOMock } from './socket-mock';

const FIRST_TARGET_MISSION_ID = 'first-target';

export const SHIP_EXTERIOR_RESUME_CHARACTER_ID = 'char-hangar-resume';
export const SHIP_EXTERIOR_RESUME_SHIP_ID = 'ship-1';

interface ShipExteriorResumeMockOptions {
  missionStatus?: 'active' | 'completed';
  inventory?: unknown[];
}

export function configureShipExteriorResumeMock(
  mock: SocketIOMock,
  options: ShipExteriorResumeMockOptions = {},
): void {
  const missionStatus = options.missionStatus ?? 'active';
  const inventory =
    options.inventory ??
    [
      {
        id: 'item-drone-1',
        itemType: 'expendable-dart-drone',
        displayName: 'Expendable Dart Drone',
        launchable: true,
        state: 'contained',
        damageStatus: 'intact',
        container: { containerType: 'ship', containerId: SHIP_EXTERIOR_RESUME_SHIP_ID },
        owningPlayerId: TEST_PLAYER,
        owningCharacterId: SHIP_EXTERIOR_RESUME_CHARACTER_ID,
        kinematics: null,
        destroyedAt: null,
        destroyedReason: null,
        discoveredAt: null,
        discoveredByCharacterId: null,
        createdAt: '2026-05-01T00:00:00.000Z',
        updatedAt: '2026-05-01T00:00:00.000Z',
      },
    ];

  mock.on('character-list-request', () => ({
    event: 'character-list-response',
    data: {
      success: true,
      message: '',
      playerName: TEST_PLAYER,
      characters: [
        {
          id: SHIP_EXTERIOR_RESUME_CHARACTER_ID,
          characterName: 'Scout Alpha',
          level: 2,
          missions: [{ missionId: FIRST_TARGET_MISSION_ID, status: missionStatus }],
        },
      ],
    },
  }));

  mock.on('game-join-request', () => null);

  mock.on('list-missions-request', () => ({
    event: 'list-missions-response',
    data: {
      success: true,
      message: '',
      playerName: TEST_PLAYER,
      characterId: SHIP_EXTERIOR_RESUME_CHARACTER_ID,
      missions: [{ missionId: FIRST_TARGET_MISSION_ID, status: missionStatus }],
    },
  }));

  mock.on('ship-list-by-owner-request', () => ({
    event: 'ship-list-by-owner-response',
    data: {
      success: true,
      message: '',
      playerName: TEST_PLAYER,
      characterId: SHIP_EXTERIOR_RESUME_CHARACTER_ID,
      ships: [
        {
          id: SHIP_EXTERIOR_RESUME_SHIP_ID,
          name: 'Starter Pod',
          model: 'Scavenger Pod',
          status: 'Damaged',
          inventory,
          spatial: {
            solarSystemId: 'sol',
            frame: 'barycentric',
            positionKm: { x: 1_000_000, y: 0, z: 0 },
            epochMs: Date.now(),
          },
          motion: {
            velocityKmPerSec: { x: 0, y: 0, z: 0 },
          },
          observability: {
            visibility: 'visible',
            scanState: 'scanned',
          },
        },
      ],
    },
  }));

  mock.on('celestial-body-list-request', () => ({
    event: 'celestial-body-list-response',
    data: {
      success: true,
      message: '',
      playerName: TEST_PLAYER,
      solarSystemId: 'sol',
      positionKm: { x: 1_000_000, y: 0, z: 0 },
      distanceKm: 900_000,
      celestialBodies: [],
    },
  }));

  mock.on('celestial-body-upsert-request', (request) => {
    const payload = request as {
      celestialBody?: {
        id?: string;
        sourceScanId?: string;
        catalogId?: string;
        createdByCharacterId?: string;
        createdAt?: string;
        updatedAt?: string;
        spatial?: unknown;
        motion?: unknown;
        physical?: unknown;
        composition?: unknown;
        observability?: unknown;
        state?: 'active' | 'destroyed';
      };
    };
    const celestialBody = payload.celestialBody ?? {};
    return {
      event: 'celestial-body-upsert-response',
      data: {
        success: true,
        message: '',
        celestialBody: {
          id: celestialBody.id ?? `cb-${celestialBody.sourceScanId ?? 'generated'}`,
          sourceScanId: celestialBody.sourceScanId ?? 'generated',
          catalogId: celestialBody.catalogId ?? `catalog-${Date.now()}`,
          createdByCharacterId: celestialBody.createdByCharacterId ?? SHIP_EXTERIOR_RESUME_CHARACTER_ID,
          createdAt: celestialBody.createdAt ?? '2026-05-01T00:00:00.000Z',
          updatedAt: celestialBody.updatedAt ?? '2026-05-01T00:00:00.000Z',
          spatial: celestialBody.spatial,
          motion: celestialBody.motion,
          physical: celestialBody.physical,
          composition: celestialBody.composition,
          observability: celestialBody.observability ?? { visibility: 'visible', scanState: 'unscanned' },
          state: celestialBody.state ?? 'active',
        },
      },
    };
  });

  mock.on('mission-upsert-request', () => ({
    event: 'mission-upsert-response',
    data: {
      success: true,
      message: '',
      playerName: TEST_PLAYER,
      characterId: SHIP_EXTERIOR_RESUME_CHARACTER_ID,
    },
  }));
}