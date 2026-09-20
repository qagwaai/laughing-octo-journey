import { TEST_PLAYER } from '../helpers/auth-helper';
import {
  missionUpsertCorrelationEcho,
  registerMissionCharacterList,
  registerMissionGameJoin,
  registerMissionList,
  registerMissionShipListByOwner,
} from './mission-session-helpers';
import type { SocketIOMock } from './socket-mock';

const FIRST_TARGET_MISSION_ID = 'first-target';

export const SHIP_EXTERIOR_HOTKEY_HUD_CHARACTER_ID = 'char-hotkey-hud';
export const SHIP_EXTERIOR_HOTKEY_HUD_SHIP_ID = 'ship-hotkey-hud';

/**
 * The single launchable payload assigned to launch slot 1. Slots 2-5 stay
 * empty so the HUD can be asserted for both filled and empty slot states.
 */
export const SHIP_EXTERIOR_HOTKEY_HUD_LAUNCHABLE_DISPLAY_NAME = 'Expendable Dart Drone';

interface HotkeyHudMockOptions {
  /** Invoked for every launch-item emission so specs can assert no stray launches. */
  onLaunchItemRequest?: (request: { hotkey?: number; itemId?: string }) => void;
}

function launchableDroneItem() {
  return {
    id: 'item-drone-hud-1',
    itemType: 'expendable-dart-drone',
    displayName: SHIP_EXTERIOR_HOTKEY_HUD_LAUNCHABLE_DISPLAY_NAME,
    launchable: true,
    state: 'contained',
    damageStatus: 'intact',
    container: { containerType: 'ship' as const, containerId: SHIP_EXTERIOR_HOTKEY_HUD_SHIP_ID },
    owningPlayerId: TEST_PLAYER,
    owningCharacterId: SHIP_EXTERIOR_HOTKEY_HUD_CHARACTER_ID,
    spatial: null,
    motion: null,
    kinematics: null,
    destroyedAt: null,
    destroyedReason: null,
    discoveredAt: null,
    discoveredByCharacterId: null,
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
  };
}

function nonLaunchableSensorItem() {
  return {
    ...launchableDroneItem(),
    id: 'item-sensor-hud-1',
    itemType: 'sensor-array',
    displayName: 'Sensor Array T20',
    launchable: false,
  };
}

/**
 * Registers a deterministic ship-exterior session that reaches the bare scene
 * with exactly one launchable payload in launch slot 1.
 */
export function configureShipExteriorHotkeyHudMock(mock: SocketIOMock, options: HotkeyHudMockOptions = {}): void {
  registerMissionCharacterList(mock, [
    {
      id: SHIP_EXTERIOR_HOTKEY_HUD_CHARACTER_ID,
      characterName: 'Hotkey Pilot',
      level: 2,
      missions: [{ missionId: FIRST_TARGET_MISSION_ID, status: 'active' }],
    },
  ]);

  registerMissionGameJoin(mock);

  registerMissionList(mock, {
    characterId: SHIP_EXTERIOR_HOTKEY_HUD_CHARACTER_ID,
    missions: [{ missionId: FIRST_TARGET_MISSION_ID, status: 'active' }],
  });

  registerMissionShipListByOwner(mock, {
    characterId: SHIP_EXTERIOR_HOTKEY_HUD_CHARACTER_ID,
    ships: [
      {
        id: SHIP_EXTERIOR_HOTKEY_HUD_SHIP_ID,
        name: 'Starter Pod',
        model: 'Scavenger Pod',
        status: 'Damaged',
        inventory: [launchableDroneItem(), nonLaunchableSensorItem()],
        spatial: {
          solarSystemId: 'sol',
          frame: 'barycentric',
          positionKm: { x: 1_000_000, y: 0, z: 0 },
          epochMs: Date.now(),
        },
        motion: { velocityKmPerSec: { x: 0, y: 0, z: 0 } },
        observability: { visibility: 'visible', scanState: 'scanned' },
      },
    ],
  });

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
    const celestialBody = ((request ?? {}) as { celestialBody?: Record<string, unknown> }).celestialBody ?? {};
    return {
      event: 'celestial-body-upsert-response',
      data: {
        success: true,
        message: '',
        celestialBody: {
          ...celestialBody,
          id: (celestialBody['id'] as string | undefined) ?? `cb-${celestialBody['sourceScanId'] ?? 'generated'}`,
          sourceScanId: (celestialBody['sourceScanId'] as string | undefined) ?? 'generated',
          catalogId: (celestialBody['catalogId'] as string | undefined) ?? 'catalog-hotkey-hud',
          createdByCharacterId:
            (celestialBody['createdByCharacterId'] as string | undefined) ?? SHIP_EXTERIOR_HOTKEY_HUD_CHARACTER_ID,
          createdAt: (celestialBody['createdAt'] as string | undefined) ?? '2026-05-01T00:00:00.000Z',
          updatedAt: (celestialBody['updatedAt'] as string | undefined) ?? '2026-05-01T00:00:00.000Z',
          observability: celestialBody['observability'] ?? { visibility: 'visible', scanState: 'unscanned' },
          state: (celestialBody['state'] as string | undefined) ?? 'active',
        },
      },
    };
  });

  mock.on('item-list-by-location', () => ({
    event: 'item-list-by-location-response',
    data: { success: true, message: '', items: [] },
  }));

  mock.on('mission-upsert-request', (request) => ({
    event: 'mission-upsert-response',
    data: {
      success: true,
      message: '',
      playerName: TEST_PLAYER,
      characterId: SHIP_EXTERIOR_HOTKEY_HUD_CHARACTER_ID,
      ...missionUpsertCorrelationEcho(request),
    },
  }));

  mock.on('launch-item-request', (request) => {
    const payload = (request ?? {}) as {
      shipId?: string;
      targetCelestialBodyId?: string;
      hotkey?: number;
      itemId?: string;
      itemType?: string;
    };
    options.onLaunchItemRequest?.(payload);
    return {
      event: 'launch-item-response',
      data: {
        success: true,
        message: 'Target destroyed',
        playerName: TEST_PLAYER,
        characterId: SHIP_EXTERIOR_HOTKEY_HUD_CHARACTER_ID,
        shipId: payload.shipId ?? SHIP_EXTERIOR_HOTKEY_HUD_SHIP_ID,
        targetCelestialBodyId: payload.targetCelestialBodyId ?? 'cb-generated',
        hotkey: payload.hotkey ?? 1,
        itemId: payload.itemId ?? 'item-drone-hud-1',
        itemType: payload.itemType ?? 'expendable-dart-drone',
        resolution: {
          outcome: 'target-destroyed',
          targetDestroyed: true,
          yieldedMaterials: [],
          yieldedItems: [],
          launchSeed: 42,
        },
      },
    };
  });
}