import { expect, Page } from '@playwright/test';
import { SocketIOMock } from '../fixtures/socket-mock';

export const TEST_PLAYER = 'testplayer';
export const TEST_PASSWORD = 'testpassword123';
export const TEST_SESSION_KEY = 'test-session-key-abc123';

/**
 * Logs in via the login form using a mocked socket.io server, then waits
 * for Angular to navigate to the character-list left outlet.
 *
 * Precondition: `mock.setup()` must have been called and the login handler
 * must be registered on `mock` before calling this function.
 *
 * Postcondition: the page URL contains `left:character-list` and the
 * Angular SessionService holds the test session key.
 */
export async function loginViaUI(page: Page, mock: SocketIOMock): Promise<void> {
  const loginResponse = {
    success: true,
    message: 'Login successful',
    sessionKey: TEST_SESSION_KEY,
    playerId: 'player-id-001',
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

  await page.goto('/(left:login)');

  // Wait until the socket.io namespace-connect handshake has completed so that
  // socket.connected === true before the form is submitted.  Without this,
  // SocketService.emit() silently drops the login event.
  await mock.connected;
  await socketConnectedInApp;

  await page.locator('#playerName').fill(TEST_PLAYER);
  await page.locator('#password').fill(TEST_PASSWORD);
  await page.locator('button[type="submit"]').click();

  // Deliver a deterministic login response even if the emit happened just
  // before socket.connected flipped true.
  mock.push('login-response', loginResponse);

  // Wait for Angular SPA route change in the URL.
  await expect(page).toHaveURL(/left:character-list/, { timeout: 10_000 });
}
