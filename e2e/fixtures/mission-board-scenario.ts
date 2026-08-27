import type { Page } from '@playwright/test';
import { SocketIOMock } from './socket-mock';
import { loginViaUI } from '../helpers/auth-helper';
import { registerMissionCharacterList } from './mission-session-helpers';

export async function setupMissionBoardTest(page: Page, characters: object[]): Promise<{ mock: SocketIOMock }> {
  const mock = new SocketIOMock(page);
  await mock.setup();

  registerMissionCharacterList(mock, characters);

  await loginViaUI(page, mock);

  return { mock };
}