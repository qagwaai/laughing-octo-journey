import type { Page } from '@playwright/test';
import { SocketIOMock } from './socket-mock';
import { loginViaUI, TEST_PLAYER } from '../helpers/auth-helper';

function characterListResponse(characters: object[]) {
  return {
    success: true,
    message: '',
    playerName: TEST_PLAYER,
    characters,
  };
}

export async function setupMissionBoardTest(page: Page, characters: object[]): Promise<{ mock: SocketIOMock }> {
  const mock = new SocketIOMock(page);
  await mock.setup();

  mock.on('character-list-request', () => ({
    event: 'character-list-response',
    data: characterListResponse(characters),
  }));

  await loginViaUI(page, mock);

  return { mock };
}