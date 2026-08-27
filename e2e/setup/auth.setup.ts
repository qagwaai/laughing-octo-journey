import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test as setup } from '@playwright/test';
import { SocketIOMock } from '../fixtures/socket-mock';
import { loginViaUI } from '../helpers/auth-helper';

const authStatePath = resolve(__dirname, '..', '.auth', 'user.json');

setup('authenticate via UI and persist storage state', async ({ page }) => {
  const mock = new SocketIOMock(page);
  await mock.setup();

  await loginViaUI(page, mock);

  mkdirSync(dirname(authStatePath), { recursive: true });
  await page.context().storageState({ path: authStatePath });
});