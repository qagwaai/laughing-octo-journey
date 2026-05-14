import { expect, test } from '@playwright/test';
import { SocketIOMock } from '../fixtures/socket-mock';
import { loginViaUI, TEST_PLAYER, TEST_SESSION_KEY } from '../helpers/auth-helper';
import { GameShellPage } from '../page-objects/game-shell.page';
import { LoginPage } from '../page-objects/login.page';
import { ViewerPage } from '../page-objects/viewer.page';

// ── Test data ──────────────────────────────────────────────────────────────

const SOL_SYSTEM: Partial<any> = {
  id: 'sol',
  displayName: 'Sol',
  source: 'curated',
  distanceParsec: 0,
  starCount: 1,
  primaryStar: {
    hygId: '0',
    spectralClass: 'G2V',
    colorHex: '#fff5b6',
    luminositySolar: 1.0,
  },
};

const ALPHA_CENTAURI_SYSTEM: Partial<any> = {
  id: 'alpha-centauri',
  displayName: 'Alpha Centauri',
  source: 'procedural',
  distanceParsec: 1.3,
  starCount: 3,
  primaryStar: {
    hygId: '71681',
    spectralClass: 'G2V',
    colorHex: '#fff5b6',
    luminositySolar: 1.1,
  },
};

const SIRIUS_SYSTEM: Partial<any> = {
  id: 'sirius',
  displayName: 'Sirius',
  source: 'curated',
  distanceParsec: 2.6,
  starCount: 1,
  primaryStar: {
    hygId: '32349',
    spectralClass: 'A1V',
    colorHex: '#f0f4ff',
    luminositySolar: 26.0,
  },
};

function solarSystemListResponse(systems: any[]) {
  return {
    success: true,
    message: '',
    playerName: TEST_PLAYER,
    solarSystems: systems,
  };
}

async function setupViewerListTest(page: any, systems: any[] = []) {
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
          id: 'char-viewer-1',
          characterName: 'Scout',
          level: 1,
          missions: [
            {
              missionId: 'first-target',
              status: 'in-progress',
            },
          ],
        },
      ],
    },
  }));

  await loginViaUI(page, mock);

  // Must join a game before viewer menu is enabled
  mock.on('game-join-request', () => null);
  const joinButton = gameShell.joinButton();
  await expect(joinButton).toBeVisible({ timeout: 10000 });
  await expect(joinButton).toBeEnabled({ timeout: 10000 });
  await gameShell.joinGame('Join Game');
  await expect(page).toHaveURL(/left:game-main/, { timeout: 10000 });

  mock.on('solar-system-list-request', () => ({
    event: 'solar-system-list-response',
    data: solarSystemListResponse(systems),
  }));

  return { mock };
}

// ── Tests ──────────────────────────────────────────────────────────────────

test.describe('Viewer — Solar System List', () => {
  test('loads and displays solar system list after navigation to viewer', async ({ page }) => {
    await setupViewerListTest(page, [SOL_SYSTEM, ALPHA_CENTAURI_SYSTEM, SIRIUS_SYSTEM]);
    const viewerPage = new ViewerPage(page);

    // Navigate to Viewer from the left menu
    await new GameShellPage(page).openViewer();

    // Wait for the system list to render
    const systemList = viewerPage.systemList;
    await expect(systemList).toHaveCount(1);

    // Verify all systems are displayed
    const items = page.locator('.solar-system-item');
    await expect(items).toHaveCount(3);

    // Verify Sol system displays (use specific span selector to avoid ambiguity)
    const solNameSpan = page.locator('.solar-system-item__name:has-text("Sol")');
    await expect(solNameSpan).toBeVisible();
    const solItemButton = solNameSpan.locator('..');
    await expect(solItemButton).toContainText('Distance (pc): 0.00');
    await expect(solItemButton).toContainText('G2V');

    // Verify Alpha Centauri system displays (use specific span selector)
    const alphaCentauriNameSpan = page.locator('.solar-system-item__name:has-text("Alpha Centauri")');
    await expect(alphaCentauriNameSpan).toBeVisible();
    const alphaCentauriItemButton = alphaCentauriNameSpan.locator('..');
    await expect(alphaCentauriItemButton).toContainText('Distance (pc): 1.30');

    // Verify Sirius system displays (use specific span selector)
    const siriusNameSpan = page.locator('.solar-system-item__name:has-text("Sirius")');
    await expect(siriusNameSpan).toBeVisible();
    const siriusItemButton = siriusNameSpan.locator('..');
    await expect(siriusItemButton).toContainText('Distance (pc): 2.60');
  });

  test('displays loading state while fetching solar systems', async ({ page }) => {
    const mock = new SocketIOMock(page);
    const gameShell = new GameShellPage(page);
    const viewerPage = new ViewerPage(page);
    await mock.setup();

    mock.on('character-list-request', () => ({
      event: 'character-list-response',
      data: {
        success: true,
        message: '',
        playerName: TEST_PLAYER,
        characters: [
          {
            id: 'char-viewer-1',
            characterName: 'Scout',
            level: 1,
            missions: [
              {
                missionId: 'first-target',
                status: 'in-progress',
              },
            ],
          },
        ],
      },
    }));

    await loginViaUI(page, mock);

    // Must join a game before viewer menu is enabled
    mock.on('game-join-request', () => null);
    const joinButton = gameShell.joinButton();
    await expect(joinButton).toBeVisible({ timeout: 10000 });
    await expect(joinButton).toBeEnabled({ timeout: 10000 });
    await gameShell.joinGame('Join Game');
    await expect(page).toHaveURL(/left:game-main/, { timeout: 10000 });

    // Register the response handler but delay the response to catch the loading state
    let resolveResponse: any;
    const delayedResponse = new Promise((resolve) => {
      resolveResponse = resolve;
    });

    mock.on('solar-system-list-request', async () => {
      await delayedResponse;
      return {
        event: 'solar-system-list-response',
        data: solarSystemListResponse([SOL_SYSTEM]),
      };
    });

    // Navigate to Viewer and verify loading state is shown
    await gameShell.openViewer();

    // Confirm loading state before resolving the delayed response
    const loadingState = viewerPage.loadingState;
    await expect(loadingState).toHaveCount(1, { timeout: 5000 });

    // Resolve the delayed response
    resolveResponse();
  });

  test('displays empty state when no systems are returned', async ({ page }) => {
    await setupViewerListTest(page, []);
    const gameShell = new GameShellPage(page);
    const viewerPage = new ViewerPage(page);

    await gameShell.openViewer();

    const emptyState = viewerPage.emptyState;
    await expect(emptyState).toBeVisible();
    // Match actual i18n string
    await expect(emptyState).toContainText('No solar systems available.');

    const systemList = viewerPage.systemList;
    await expect(systemList).not.toBeVisible();
  });

  test('displays error when system list request fails', async ({ page }) => {
    const mock = new SocketIOMock(page);
    const gameShell = new GameShellPage(page);
    const viewerPage = new ViewerPage(page);
    await mock.setup();

    mock.on('character-list-request', () => ({
      event: 'character-list-response',
      data: {
        success: true,
        message: '',
        playerName: TEST_PLAYER,
        characters: [
          {
            id: 'char-viewer-1',
            characterName: 'Scout',
            level: 1,
            missions: [
              {
                missionId: 'first-target',
                status: 'in-progress',
              },
            ],
          },
        ],
      },
    }));

    await loginViaUI(page, mock);

    // Must join a game before viewer menu is enabled
    mock.on('game-join-request', () => null);
    const joinButton = gameShell.joinButton();
    await expect(joinButton).toBeVisible({ timeout: 10000 });
    await expect(joinButton).toBeEnabled({ timeout: 10000 });
    await gameShell.joinGame('Join Game');
    await expect(page).toHaveURL(/left:game-main/, { timeout: 10000 });

    mock.on('solar-system-list-request', () => ({
      event: 'solar-system-list-response',
      data: {
        success: false,
        message: 'Database connection error',
        playerName: TEST_PLAYER,
        solarSystems: [],
      },
    }));

    await gameShell.openViewer();

    const errorState = page.locator('[data-testid="viewer-error"]');
    await expect(errorState).toBeVisible();
    await expect(errorState).toContainText('Database connection error');

    const systemList = viewerPage.systemList;
    await expect(systemList).not.toBeVisible();
  });

  test('navigates to scene view when system is selected', async ({ page }) => {
    const { mock } = await setupViewerListTest(page, [SOL_SYSTEM]);
    const gameShell = new GameShellPage(page);
    const viewerPage = new ViewerPage(page);

    await gameShell.openViewer();

    // Set up the scene response handler for when the user selects a system
    mock.on('solar-system-get-request', () => ({
      event: 'solar-system-get-response',
      data: {
        success: true,
        message: '',
        playerName: TEST_PLAYER,
        solarSystemId: 'sol',
        solarSystem: SOL_SYSTEM,
        bodies: [],
      },
    }));

    // Select the Sol system
    await viewerPage.selectSystem('Sol');

    // Verify navigation to the scene view
    await expect(page).toHaveURL(/right:viewer-scene/);
  });

  test('[locale] displays viewer list in Italian locale', async ({ page }) => {
    const mock = new SocketIOMock(page);
    const gameShell = new GameShellPage(page);
    const loginPage = new LoginPage(page);
    const viewerPage = new ViewerPage(page);
    await mock.setup();

    // Register character-list handler
    mock.on('character-list-request', () => ({
      event: 'character-list-response',
      data: {
        success: true,
        message: '',
        playerName: TEST_PLAYER,
        characters: [
          {
            id: 'char-viewer-1',
            characterName: 'Scout',
            level: 1,
            missions: [
              {
                missionId: 'first-target',
                status: 'in-progress',
              },
            ],
            preferredLocale: 'it',
          },
        ],
      },
    }));

    // Login with Italian locale by navigating to login with locale param
    const loginResponse = {
      success: true,
      message: 'Login successful',
      sessionKey: TEST_SESSION_KEY,
      playerId: 'player-id-001',
      preferredLocale: 'it',
    };

    mock.on('login', () => ({
      event: 'login-response',
      data: loginResponse,
    }));

    const socketConnectedInApp = page
      .waitForEvent('console', {
        predicate: (msg) => msg.type() === 'log' && msg.text().includes('Socket connected:'),
        timeout: 10_000,
      })
      .catch(() => null);

    await page.goto('/(left:login)?locale=it');
    await mock.connected;
    await socketConnectedInApp;

    await loginPage.playerNameInput.fill(TEST_PLAYER);
    await loginPage.passwordInput.fill('testpassword123');
    await loginPage.submitButton.click();

    mock.push('login-response', loginResponse);
    await expect(page).toHaveURL(/left:character-list/, { timeout: 10_000 });

    // Must join a game before viewer menu is enabled
    mock.on('game-join-request', () => null);
    const joinButton = gameShell.joinButton();
    await expect(joinButton).toBeVisible({ timeout: 10000 });
    await expect(joinButton).toBeEnabled({ timeout: 10000 });
    await gameShell.joinGame('Join Game');
    await expect(page).toHaveURL(/left:game-main/, { timeout: 10000 });

    // Register solar system list handler
    mock.on('solar-system-list-request', () => ({
      event: 'solar-system-list-response',
      data: solarSystemListResponse([SOL_SYSTEM, ALPHA_CENTAURI_SYSTEM]),
    }));

    // Navigate to Viewer (use English label which is set first, more reliable)
    await gameShell.openViewer();

    // Verify system list displays
    const systemList = viewerPage.systemList;
    await expect(systemList).toBeVisible();

    // Check that system names are displayed (names are same in both locales)
    const solName = page.locator('.solar-system-item__name:has-text("Sol")');
    await expect(solName).toBeVisible();
  });
});
