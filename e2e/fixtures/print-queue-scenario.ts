import { expect, type Page } from '@playwright/test';
import { loginViaUI } from '../helpers/auth-helper';
import { GameShellPage } from '../page-objects/game-shell.page';
import { TEST_PLAYER } from '../helpers/auth-helper';
import { SocketIOMock } from './socket-mock';

const PRINT_QUEUE_CHARACTER_ID = 'char-print-e2e';

export function configurePrintQueueMock(
  mock: SocketIOMock,
  options: { usableShipSpatial: boolean; includeIron: boolean },
): void {
  mock.on('character-list-request', () => ({
    event: 'character-list-response',
    data: {
      success: true,
      message: '',
      playerName: TEST_PLAYER,
      characters: [
        {
          id: PRINT_QUEUE_CHARACTER_ID,
          characterName: 'Printer Pilot',
          level: 3,
          missions: [{ missionId: 'first-target', status: 'active' }],
        },
      ],
    },
  }));

  mock.on('game-join-request', () => null);

  mock.on('ship-list-by-owner-request', () => ({
    event: 'ship-list-by-owner-response',
    data: {
      success: true,
      message: '',
      owner: {
        ownerType: 'player-character',
        playerId: 'player-1',
        characterId: PRINT_QUEUE_CHARACTER_ID,
        npcId: null,
        factionId: null,
      },
      ships: [
        {
          id: 'ship-print-1',
          name: 'Print Pod',
          model: 'Scavenger Pod',
          tier: 1,
          status: 'docked',
          inventory: options.includeIron
            ? [
                {
                  id: 'mat-iron-1',
                  itemType: 'iron-raw-material',
                  displayName: 'Iron (raw material)',
                  launchable: false,
                  state: 'contained',
                  damageStatus: 'intact',
                  container: { containerType: 'ship', containerId: 'ship-print-1' },
                  owningPlayerId: TEST_PLAYER,
                  owningCharacterId: PRINT_QUEUE_CHARACTER_ID,
                  kinematics: null,
                  destroyedAt: null,
                  destroyedReason: null,
                  discoveredAt: null,
                  discoveredByCharacterId: null,
                  createdAt: '2026-05-01T00:00:00.000Z',
                  updatedAt: '2026-05-01T00:00:00.000Z',
                },
              ]
            : [],
          spatial: {
            solarSystemId: 'sol',
            frame: 'barycentric',
            positionKm: options.usableShipSpatial ? { x: 100, y: 0, z: 0 } : { x: 0, y: 0, z: 0 },
            epochMs: 0,
          },
        },
      ],
    },
  }));

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
        destroyedAt?: string | null;
        destroyedReason?: string | null;
      };
    };

    const item = payload.item ?? {};
    const now = '2026-05-01T00:00:00.000Z';
    return {
      event: 'item-upsert-response',
      data: {
        success: true,
        message: '',
        item: {
          id: item.id ?? `itm-${Date.now()}`,
          itemType: item.itemType ?? 'iron-ore',
          displayName: item.displayName ?? 'Iron Ore',
          launchable: item.launchable ?? false,
          state: item.state ?? 'contained',
          damageStatus: item.damageStatus ?? 'intact',
          container: item.container ?? { containerType: 'ship', containerId: 'ship-print-1' },
          owningPlayerId: item.owningPlayerId ?? TEST_PLAYER,
          owningCharacterId: item.owningCharacterId ?? PRINT_QUEUE_CHARACTER_ID,
          kinematics: null,
          destroyedAt: item.destroyedAt ?? null,
          destroyedReason: item.destroyedReason ?? null,
          discoveredAt: null,
          discoveredByCharacterId: null,
          createdAt: now,
          updatedAt: now,
        },
      },
    };
  });
}

export async function setupAndOpenPrintQueue(
  options: { usableShipSpatial: boolean; includeIron: boolean },
  page: Page,
): Promise<void> {
  const mock = new SocketIOMock(page);
  const gameShell = new GameShellPage(page);
  await mock.setup();
  configurePrintQueueMock(mock, options);

  await loginViaUI(page, mock);
  await gameShell.joinGame('Join Game in Progress');
  await expect(page).toHaveURL(/left:game-main/, { timeout: 10_000 });

  await gameShell.openNav('Fabrication Lab');
  await expect(page).toHaveURL(/left:fabrication-lab/, { timeout: 10_000 });

  await page.getByRole('button', { name: 'View Print Queue' }).click();
  await expect(page).toHaveURL(/right:print-queue/, { timeout: 10_000 });
}