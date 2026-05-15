import { expect, test, type Page } from '@playwright/test';
import { SocketIOMock } from '../fixtures/socket-mock';
import { GameShellPage } from '../page-objects/game-shell.page';
import { LoginPage } from '../page-objects/login.page';
import { MissionBoardPage } from '../page-objects/mission-board.page';

const TEST_PLAYER = 'localeplayer';
const TEST_PASSWORD = 'testpassword123';
const FIRST_TARGET_MISSION_ID = 'first-target';

function setupLoginHandlers(mock: SocketIOMock) {
  const loginResponse = {
    success: true,
    message: 'Login successful',
    playerId: 'player-id-001',
    sessionKey: 'session-key-001',
  };

  mock.on('login', () => ({
    event: 'login-response',
    data: loginResponse,
  }));

  return loginResponse;
}

async function openLoginAndWaitForSocket(page: Page, mock: SocketIOMock) {
  const socketConnectedInApp = page
    .waitForEvent('console', {
      predicate: (msg) => msg.type() === 'log' && msg.text().includes('Socket connected:'),
      timeout: 10_000,
    })
    .catch(() => null);

  await page.goto('/(left:login)');
  await mock.connected;
  await socketConnectedInApp;
}

async function loginWithItalianLocale(page: Page, mock: SocketIOMock) {
  const loginResponse = setupLoginHandlers(mock);
  const loginPage = new LoginPage(page);
  await openLoginAndWaitForSocket(page, mock);

  await loginPage.localeSelect.selectOption('it');
  await loginPage.playerNameInput.fill(TEST_PLAYER);
  await loginPage.passwordInput.fill(TEST_PASSWORD);
  await loginPage.submitButton.click();

  mock.push('login-response', loginResponse);
  await expect(page).toHaveURL(/left:character-list/, { timeout: 10_000 });

  await expect(page.locator('.page-main h1')).toHaveText('Lista Personaggi');
  await expect.poll(async () => page.evaluate(() => window.localStorage.getItem('stellar.preferredLocale'))).toBe('it');
  await expect.poll(async () => page.evaluate(() => document.documentElement.lang)).toBe('it');
}

test.describe('Locale opening and mission flow', () => {
  test('shows Italian opening sequence text for a fresh mission join', async ({ page }) => {
    const mock = new SocketIOMock(page);
    const gameShell = new GameShellPage(page);
    await mock.setup();

    mock.on('character-list-request', () => ({
      event: 'character-list-response',
      data: {
        success: true,
        message: '',
        playerName: TEST_PLAYER,
        characters: [
          {
            id: 'char-it-1',
            characterName: 'Nova',
            level: 4,
            missions: [{ missionId: FIRST_TARGET_MISSION_ID, status: 'not-started' }],
          },
        ],
      },
    }));

    await loginWithItalianLocale(page, mock);

    await gameShell.joinGame();

    await expect(page).toHaveURL(/left:opening-cold-boot/, { timeout: 10_000 });
    await expect(page.locator('.cold-boot-container h1')).toHaveText('Sequenza iniziale: Cold Boot');
    await expect(page.locator('.cold-boot-container .eyebrow')).toHaveText('Bootstrap missione');

    const scanAction = page.locator('.scan-action');
    await expect(scanAction).toHaveClass(/visible/, { timeout: 8_000 });
    await expect(scanAction.locator('p').first()).toHaveText(
      /Avviare la scansione della regione vicina per raccogliere materie prime/,
    );
    await expect(scanAction.locator('button.scan-action-button')).toHaveText('Avvia scansione?');
  });

  test('shows Italian mission board text after joining an in-progress mission', async ({ page }) => {
    const mock = new SocketIOMock(page);
    const gameShell = new GameShellPage(page);
    const missionBoardPage = new MissionBoardPage(page);
    await mock.setup();

    mock.on('character-list-request', () => ({
      event: 'character-list-response',
      data: {
        success: true,
        message: '',
        playerName: TEST_PLAYER,
        characters: [
          {
            id: 'char-it-2',
            characterName: 'Astra',
            level: 5,
            missions: [{ missionId: FIRST_TARGET_MISSION_ID, status: 'started' }],
          },
        ],
      },
    }));

    mock.on('mission-list-request', () => ({
      event: 'mission-list-response',
      data: {
        success: true,
        message: '',
        playerName: TEST_PLAYER,
        characterId: 'char-it-2',
        missions: [
          {
            missionId: FIRST_TARGET_MISSION_ID,
            status: 'started',
            startedAt: '2026-05-01T10:00:00.000Z',
            updatedAt: '2026-05-01T10:05:00.000Z',
          },
        ],
      },
    }));

    // In-progress join now fetches active ship before navigating away from character-list.
    mock.on('ship-list-request', () => ({
      event: 'ship-list-response',
      data: {
        success: true,
        message: '',
        playerName: TEST_PLAYER,
        characterId: 'char-it-2',
        ships: [
          {
            id: 'ship-it-2',
            name: 'Astra Pod',
            model: 'Scavenger Pod',
            tier: 1,
            status: 'ACTIVE',
            spatial: {
              solarSystemId: 'sol',
              frame: 'barycentric',
              positionKm: { x: 350000000, y: 0, z: 0 },
              epochMs: 1715000000000,
            },
          },
        ],
      },
    }));

    await loginWithItalianLocale(page, mock);

    await gameShell.joinGame();
    await expect(page).toHaveURL(/left:game-main/, { timeout: 10_000 });
    await expect(page.locator('.page-main h1')).toHaveText('Principale gioco');

    await gameShell.openMissionBoard();

    await expect(page).toHaveURL(/left:mission-board/, { timeout: 10_000 });
    await expect(missionBoardPage.heading).toHaveText('Bacheca missioni');
    await expect(page.locator('.page-main .subtitle')).toHaveText(
      'Missioni attive e completate per questo personaggio.',
    );
    await expect(page.locator('.ops-card h2')).toHaveText('Registro missioni');
    await expect(page.locator('.ops-card > p').first()).toHaveText(
      'Tutti i progressi missione registrati per questo personaggio.',
    );
  });
});
