import { expect, Page } from '@playwright/test';
import { SocketIOMock } from '../fixtures/socket-mock';

export const TEST_PLAYER = 'testplayer';
export const TEST_PASSWORD = 'testpassword123';
export const TEST_SESSION_KEY = 'test-session-key-abc123';

const SOCKET_CONNECTION_TIMEOUT_MS = 10_000;

/**
 * Opens the login route and waits for the mock's authoritative namespace handshake.
 */
export async function openLoginAndWaitForSocket(page: Page, mock: SocketIOMock): Promise<void> {
  await page.goto('/(left:login)');

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const connectionTimeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(
        new Error(`Socket.IO mock did not complete its namespace connection within ${SOCKET_CONNECTION_TIMEOUT_MS}ms`),
      );
    }, SOCKET_CONNECTION_TIMEOUT_MS);
  });

  try {
    await Promise.race([mock.connected, connectionTimeout]);
  } finally {
    clearTimeout(timeoutId);
  }
}

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

  // Wait until the socket.io namespace-connect handshake has completed so that
  // socket.connected === true before the form is submitted.  Without this,
  // SocketService.emit() silently drops the login event.
  await openLoginAndWaitForSocket(page, mock);

  await page.locator('#playerName').fill(TEST_PLAYER);
  await page.locator('#password').fill(TEST_PASSWORD);

  // Prefer keyboard submit to avoid transient pointer interception from overlays.
  await page.locator('#password').press('Enter');

  // Deliver a deterministic login response even if the emit happened just
  // before socket.connected flipped true.
  mock.push('login-response', loginResponse);

  try {
    await expect(page).toHaveURL(/left:character-list/, { timeout: 5_000 });
    return;
  } catch {
    // Some forms only submit on explicit button click; keep a click fallback.
    await page.locator('button[type="submit"]').click({ timeout: 5_000 });
    mock.push('login-response', loginResponse);
  }

  // Wait for Angular SPA route change in the URL.
  await expect(page).toHaveURL(/left:character-list/, { timeout: 10_000 });
}
