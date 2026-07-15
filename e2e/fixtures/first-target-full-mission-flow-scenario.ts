import { TEST_PLAYER } from '../helpers/auth-helper';
import { loginViaUI } from '../helpers/auth-helper';
import { GameShellPage } from '../page-objects/game-shell.page';
import type { Page } from '@playwright/test';
import { SocketIOMock } from './socket-mock';

export const FIRST_TARGET_MISSION_ID = 'first-target';
export const TEST_CHARACTER_ID = 'char-first-target';

export async function setupFirstTargetFlowTest(
  page: Page,
  options?: { includeIronInShipInventory?: boolean; autoJoin?: boolean },
): Promise<{
  mock: SocketIOMock;
  gameShell: GameShellPage;
  missionUpsertRequests: Array<{ status?: string }>;
}> {
  const mock = new SocketIOMock(page);
  const gameShell = new GameShellPage(page);
  const missionUpsertRequests: Array<{ status?: string }> = [];

  await mock.setup();
  configureFirstTargetFlowMock(mock, missionUpsertRequests, {
    includeIronInShipInventory: options?.includeIronInShipInventory,
  });

  await loginViaUI(page, mock);

  if (options?.autoJoin !== false) {
    await gameShell.joinGame('Join Game in Progress');
  }

  return { mock, gameShell, missionUpsertRequests };
}

export function configureFirstTargetFlowMock(
  mock: SocketIOMock,
  missionUpsertRequests: Array<{ status?: string }>,
  options?: { includeIronInShipInventory?: boolean },
): void {
  const pickMissionStatus = (value: unknown): string | undefined => {
    if (!value || typeof value !== 'object') {
      return undefined;
    }

    const queue: unknown[] = [value];
    const visited = new Set<unknown>();
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || typeof current !== 'object' || visited.has(current)) {
        continue;
      }
      visited.add(current);

      const node = current as Record<string, unknown>;
      const statusCandidate = node.status;
      if (typeof statusCandidate === 'string') {
        const normalized = statusCandidate.trim().toLowerCase();
        if (normalized === 'active' || normalized === 'completed' || normalized === 'not-started') {
          return normalized;
        }
      }

      for (const child of Object.values(node)) {
        if (child && typeof child === 'object') {
          queue.push(child);
        }
      }
    }

    return undefined;
  };

  const shipInventory = [
    {
      id: 'item-drone-1',
      itemType: 'expendable-dart-drone',
      displayName: 'Expendable Dart Drone',
      launchable: true,
      state: 'contained',
      damageStatus: 'intact',
      container: { containerType: 'ship' as const, containerId: 'ship-1' },
      owningPlayerId: TEST_PLAYER,
      owningCharacterId: TEST_CHARACTER_ID,
      kinematics: null,
      destroyedAt: null,
      destroyedReason: null,
      discoveredAt: null,
      discoveredByCharacterId: null,
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z',
    },
  ];

  if (options?.includeIronInShipInventory) {
    shipInventory.push({
      id: 'item-iron-1',
      itemType: 'iron-raw-material',
      displayName: 'Iron (raw material)',
      launchable: false,
      state: 'contained',
      damageStatus: 'intact',
      container: { containerType: 'ship' as const, containerId: 'ship-1' },
      owningPlayerId: TEST_PLAYER,
      owningCharacterId: TEST_CHARACTER_ID,
      kinematics: null,
      destroyedAt: null,
      destroyedReason: null,
      discoveredAt: null,
      discoveredByCharacterId: null,
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z',
    });
  }

  mock.on('character-list-request', () => ({
    event: 'character-list-response',
    data: {
      success: true,
      message: '',
      playerName: TEST_PLAYER,
      characters: [
        {
          id: TEST_CHARACTER_ID,
          characterName: 'Scout Alpha',
          level: 2,
          missions: [{ missionId: FIRST_TARGET_MISSION_ID, status: 'active' }],
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
      characterId: TEST_CHARACTER_ID,
      missions: [
        {
          missionId: FIRST_TARGET_MISSION_ID,
          status: 'active',
        },
      ],
    },
  }));

  mock.on('ship-list-by-owner-request', () => ({
    event: 'ship-list-by-owner-response',
    data: {
      success: true,
      message: '',
      playerName: TEST_PLAYER,
      characterId: TEST_CHARACTER_ID,
      ships: [
        {
          id: 'ship-1',
          name: 'Starter Pod',
          model: 'Scavenger Pod',
          status: 'Damaged',
          inventory: shipInventory,
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
          createdByCharacterId: celestialBody.createdByCharacterId ?? TEST_CHARACTER_ID,
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

  mock.on('launch-item-request', (request) => {
    const payload = request as {
      shipId?: string;
      targetCelestialBodyId?: string;
      hotkey?: 1 | 2 | 3 | 4 | 5;
      itemId?: string;
      itemType?: string;
    };
    return {
      event: 'launch-item-response',
      data: {
        success: true,
        message: 'Target destroyed',
        playerName: TEST_PLAYER,
        characterId: TEST_CHARACTER_ID,
        shipId: payload.shipId ?? 'ship-1',
        targetCelestialBodyId: payload.targetCelestialBodyId ?? 'cb-generated',
        hotkey: payload.hotkey ?? 1,
        itemId: payload.itemId ?? 'item-drone-1',
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

  mock.on('mission-upsert-request', (request) => {
    missionUpsertRequests.push({
      status: pickMissionStatus(request),
    });
    return {
      event: 'mission-upsert-response',
      data: {
        success: true,
        message: '',
        playerName: TEST_PLAYER,
        characterId: TEST_CHARACTER_ID,
      },
    };
  });

  mock.on('item-upsert-request', (request) => {
    const payload = request as {
      item?: {
        id?: string;
        itemType?: string;
        displayName?: string;
        launchable?: boolean;
        state?: string;
        damageStatus?: string;
        container?: { containerType: 'ship'; containerId: string } | null;
        owningPlayerId?: string;
        owningCharacterId?: string;
      };
    };
    const item = payload.item ?? {};
    return {
      event: 'item-upsert-response',
      data: {
        success: true,
        message: '',
        item: {
          id: item.id ?? `itm-${Date.now()}`,
          itemType: item.itemType ?? 'hull-patch-kit',
          displayName: item.displayName ?? 'Hull Patch Kit',
          launchable: item.launchable ?? false,
          state: item.state ?? 'contained',
          damageStatus: item.damageStatus ?? 'intact',
          container: item.container ?? { containerType: 'ship', containerId: 'ship-1' },
          owningPlayerId: item.owningPlayerId ?? TEST_PLAYER,
          owningCharacterId: item.owningCharacterId ?? TEST_CHARACTER_ID,
          kinematics: null,
          destroyedAt: null,
          destroyedReason: null,
          discoveredAt: null,
          discoveredByCharacterId: null,
          createdAt: '2026-05-01T00:00:00.000Z',
          updatedAt: '2026-05-01T00:00:00.000Z',
        },
      },
    };
  });
}