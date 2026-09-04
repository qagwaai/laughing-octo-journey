import { expect, test } from '@playwright/test';
import { SocketIOMock } from '../fixtures/socket-mock';
import { CharacterListPage } from '../page-objects/character-list.page';
import { CharacterSetupPage } from '../page-objects/character-setup.page';
import { RegistrationPage } from '../page-objects/registration.page';

const PLAYER_NAME = 'coldbootpilot';
const CHARACTER_NAME = 'Nova Prime';
const CHARACTER_ID = 'char-coldboot-01';

const shipInventory = [
  {
    id: 'item-drone-1',
    itemType: 'expendable-dart-drone',
    displayName: 'Expendable Dart Drone',
    launchable: true,
    state: 'contained',
    damageStatus: 'intact',
    container: { containerType: 'ship' as const, containerId: 'ship-1' },
    owningPlayerId: PLAYER_NAME,
    owningCharacterId: CHARACTER_ID,
    kinematics: null,
    destroyedAt: null,
    destroyedReason: null,
    discoveredAt: null,
    discoveredByCharacterId: null,
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
  },
];

test.describe('Cold boot asteroid parity', () => {
  test.slow();

  test('new player creates a character, cold boots, starts scanning, and validates asteroid samples in debug output', async ({
    page,
  }) => {
    const mock = new SocketIOMock(page);
    const registrationPage = new RegistrationPage(page);
    const characterListPage = new CharacterListPage(page);
    const characterSetupPage = new CharacterSetupPage(page);
    let createdCharacter = false;

    await mock.setup();

    mock.on('register', () => ({
      event: 'register-response',
      data: { success: true, message: 'Registration successful!' },
    }));

    mock.on('login', () => ({
      event: 'login-response',
      data: {
        success: true,
        message: 'Login successful!',
        playerId: 'player-coldboot-01',
        sessionKey: 'session-coldboot-01',
      },
    }));

    mock.on('character-list-request', () => ({
      event: 'character-list-response',
      data: {
        success: true,
        message: '',
        playerName: PLAYER_NAME,
        characters: createdCharacter
          ? [
              {
                id: CHARACTER_ID,
                characterName: CHARACTER_NAME,
                level: 1,
                missions: [{ missionId: 'first-target', status: 'not-started' }],
              },
            ]
          : [],
      },
    }));

    mock.on('character-add-request', () => {
      createdCharacter = true;
      return {
        event: 'character-add-response',
        data: {
          success: true,
          message: 'Character created.',
          playerName: PLAYER_NAME,
          characterId: CHARACTER_ID,
          characterName: CHARACTER_NAME,
        },
      };
    });

    mock.on('game-join-request', () => null);

    mock.on('list-missions-request', () => ({
      event: 'list-missions-response',
      data: {
        success: true,
        message: '',
        playerName: PLAYER_NAME,
        characterId: CHARACTER_ID,
        missions: [{ missionId: 'first-target', status: 'active' }],
      },
    }));

    mock.on('ship-list-by-owner-request', () => ({
      event: 'ship-list-by-owner-response',
      data: {
        success: true,
        message: '',
        playerName: PLAYER_NAME,
        characterId: CHARACTER_ID,
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
        playerName: PLAYER_NAME,
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
            createdByCharacterId: celestialBody.createdByCharacterId ?? CHARACTER_ID,
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
        playerName: PLAYER_NAME,
        characterId: CHARACTER_ID,
      },
    }));

    await test.step('Register as a new player and create a new character', async () => {
      await registrationPage.goto();
      await registrationPage.register(PLAYER_NAME, 'coldboot@example.com', 'password123');
      await expect(page).toHaveURL(/left:character-list/, { timeout: 20_000 });

      await characterListPage.clickSetup();
      await expect(page).toHaveURL(/right:character-bust-preview/, { timeout: 20_000 });

      await characterSetupPage.fillCharacterName(CHARACTER_NAME);
      await characterSetupPage.clickSubmit();

      await expect(page).toHaveURL(/left:character-list/, { timeout: 20_000 });
      await expect(characterListPage.characterItems).toHaveCount(1, { timeout: 20_000 });
      await expect(characterListPage.characterName(0)).toContainText(CHARACTER_NAME);
    });

    await test.step('Join the character and reach the opening cold-boot sequence', async () => {
      const joinButton = page.locator('.character-item button.join-link').first();
      await expect(joinButton).toBeVisible({ timeout: 20_000 });
      await joinButton.click();

      await expect(page).toHaveURL(/opening-cold-boot/, { timeout: 20_000 });
      await expect(page.locator('.scan-action')).toHaveClass(/visible/, { timeout: 30_000 });
      await expect(page.locator('.scan-action-button')).toBeVisible({ timeout: 20_000 });
    });

    await test.step('Start scanning and validate asteroid samples are generated', async () => {
      await page.locator('.scan-action-button').evaluate((button) => {
        (button as HTMLButtonElement).click();
      });

      await expect(page).toHaveURL(/ship-exterior-view\(left:game-main\/\/right:opening-cold-boot-scan\)/, {
        timeout: 20_000,
      });

      await expect
        .poll(
          async () =>
            page.evaluate(() => {
              const api = (
                window as Window & {
                  __shipExteriorBareSceneTestUtils?: {
                    legacy?: {
                      getAsteroidSamples?: () => Array<{ id: string; scanned: boolean; scanProgress: number }>;
                    };
                  };
                }
              ).__shipExteriorBareSceneTestUtils?.legacy;
              return api?.getAsteroidSamples?.().length ?? 0;
            }),
          { timeout: 30_000 },
        )
        .toBeGreaterThan(0);

      const samples = await page.evaluate(() => {
        const api = (
          window as Window & {
            __shipExteriorBareSceneTestUtils?: {
              legacy?: {
                getAsteroidSamples?: () => Array<{ id: string; scanned: boolean; scanProgress: number }>;
              };
            };
          }
        ).__shipExteriorBareSceneTestUtils?.legacy;
        return api?.getAsteroidSamples?.() ?? [];
      });

      expect(samples.length).toBeGreaterThan(0);
      expect(samples.every((sample) => typeof sample.id === 'string' && sample.id.length > 0)).toBeTruthy();
    });

    await test.step('Confirm asteroid samples exist in scene state without depending on a debug overlay', async () => {
      await expect.poll(async () => page.url(), { timeout: 30_000 }).toContain('opening-cold-boot-scan');

      await expect
        .poll(
          async () =>
            (
              await page.evaluate(() => {
                const api = (
                  window as Window & {
                    __shipExteriorBareSceneTestUtils?: {
                      legacy?: {
                        getAsteroidSamples?: () => Array<{ id: string; scanned: boolean; scanProgress: number }>;
                      };
                    };
                  }
                ).__shipExteriorBareSceneTestUtils?.legacy;
                return api?.getAsteroidSamples?.() ?? [];
              })
            ).length,
          { timeout: 30_000 },
        )
        .toBeGreaterThan(0);

      const samples = await page.evaluate(() => {
        const api = (
          window as Window & {
            __shipExteriorBareSceneTestUtils?: {
              legacy?: {
                getAsteroidSamples?: () => Array<{ id: string; scanned: boolean; scanProgress: number }>;
              };
            };
          }
        ).__shipExteriorBareSceneTestUtils?.legacy;
        return api?.getAsteroidSamples?.() ?? [];
      });

      expect(samples.length).toBeGreaterThan(0);
      expect(samples.every((sample) => typeof sample.id === 'string' && sample.id.length > 0)).toBeTruthy();
      expect(samples.every((sample) => typeof sample.scanProgress === 'number')).toBeTruthy();
    });
  });
});
