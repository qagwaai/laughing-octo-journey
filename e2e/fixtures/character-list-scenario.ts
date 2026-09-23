import { TEST_PLAYER, loginViaUI } from '../helpers/auth-helper';
import { CharacterListPage } from '../page-objects/character-list.page';
import { SocketEventHandler, SocketIOMock } from './socket-mock';

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

/** Descriptor matching an actual seeded portrait asset under public/images/portraits. */
export const SAMPLE_BUST_DESCRIPTOR = {
  presetVersion: 'sw-15-m2-a-v1',
  faceShape: 'oval',
  skinTone: 'medium',
  hairStyle: 'short-crop',
  hairColor: 'brown',
  eyeStyle: 'almond',
  eyeColor: 'green',
  expressionPreset: 'focused',
  apparelAccent: 'collar',
  facialHair: 'none',
  scar: 'none',
  tattoo: 'none',
};

export function characterBustReadResponse(characterId: string, descriptor: object | null = SAMPLE_BUST_DESCRIPTOR) {
  return {
    success: descriptor !== null,
    message: descriptor !== null ? '' : 'Bust not found.',
    playerName: TEST_PLAYER,
    characterId,
    ...(descriptor !== null ? { descriptor } : {}),
  };
}

export { characterListResponse, emptyCharacterListResponse };

export async function setupCharacterListTest(
  page: Parameters<typeof loginViaUI>[0],
  options: {
    autoLoadResponse?: object[] | null;
    /**
     * Registered for 'character-bust-read-request' before login/navigation so it is
     * guaranteed to be in place before CharacterListPage's automatic post-load bust
     * fetch fires. Registering this handler only after setupCharacterListTest resolves
     * is racy: the bust-read requests can already have been sent (and silently dropped
     * by the mock, which does not retry) by the time a test calls mock.on(...) itself.
     */
    onBustReadRequest?: SocketEventHandler;
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

  if (options.onBustReadRequest) {
    mock.on('character-bust-read-request', options.onBustReadRequest);
  }

  await loginViaUI(page, mock);

  return { mock, characterListPage: new CharacterListPage(page) };
}
