import type { Page } from '@playwright/test';
import { loginViaUI } from '../helpers/auth-helper';
import { registerMissionCharacterList } from './mission-session-helpers';
import { SocketIOMock } from './socket-mock';

export async function setupMissionBoardTest(page: Page, characters: object[]): Promise<{ mock: SocketIOMock }> {
  const mock = new SocketIOMock(page);
  await mock.setup();

  registerMissionCharacterList(mock, characters);

  await loginViaUI(page, mock);

  return { mock };
}
