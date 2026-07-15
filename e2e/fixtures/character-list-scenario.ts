import { TEST_PLAYER, loginViaUI } from '../helpers/auth-helper';
import { CharacterListPage } from '../page-objects/character-list.page';
import { SocketIOMock } from './socket-mock';

export function characterListResponse(characters: object[]) {
  return {
    success: true,
    message: '',
    playerName: TEST_PLAYER,
    characters,
  };
}

function emptyCharacterListResponse() {
  return characterListResponse([]);
}

export { emptyCharacterListResponse };
export { characterListResponse };

export async function setupCharacterListTest(
  page: Parameters<typeof loginViaUI>[0],
  options: {
    autoLoadResponse?: object[] | null;
  } = {},
) {
  const mock = new SocketIOMock(page);
  await mock.setup();

  const responseData =
    options.autoLoadResponse !== null && options.autoLoadResponse !== undefined
      ? characterListResponse(options.autoLoadResponse)
      : emptyCharacterListResponse();

  mock.on('character-list-request', () => ({
    event: 'character-list-response',
    data: responseData,
  }));

  await loginViaUI(page, mock);

  return { mock, characterListPage: new CharacterListPage(page) };
}