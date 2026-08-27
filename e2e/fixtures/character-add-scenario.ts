import { TEST_PLAYER, loginViaUI } from '../helpers/auth-helper';
import { CharacterListPage } from '../page-objects/character-list.page';
import { CharacterSetupPage } from '../page-objects/character-setup.page';
import { SocketIOMock } from './socket-mock';

function characterListResponse(characters: object[]) {
  return {
    success: true,
    message: '',
    playerName: TEST_PLAYER,
    characters,
  };
}

export { characterListResponse };

export function characterAddResponse(characterId: string, characterName: string) {
  return {
    success: true,
    message: 'Character created.',
    playerName: TEST_PLAYER,
    characterId,
    characterName,
  };
}

export async function setupCharacterAddTest(page: Parameters<typeof loginViaUI>[0]) {
  const mock = new SocketIOMock(page);
  await mock.setup();

  mock.on('character-list-request', () => ({
    event: 'character-list-response',
    data: characterListResponse([]),
  }));

  await loginViaUI(page, mock);

  return {
    mock,
    characterListPage: new CharacterListPage(page),
    characterSetupPage: new CharacterSetupPage(page),
  };
}