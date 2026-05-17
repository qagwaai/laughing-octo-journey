import { io } from 'socket.io-client';

const SERVER_URL = process.env.CATALOG_SERVER_URL ?? 'http://localhost:3000';
const TIMEOUT_MS = Number(process.env.CATALOG_TIMEOUT_MS ?? 10000);
const PLAYER_NAME = process.env.CATALOG_PLAYER_NAME ?? 'testplayer';
const PASSWORD = process.env.CATALOG_PASSWORD ?? 'testpassword123';
const EMAIL = process.env.CATALOG_EMAIL ?? `${PLAYER_NAME}@example.com`;
const TARGET_ITEM_TYPE = process.env.CATALOG_ITEM_TYPE ?? 'hull-patch-kit';

const LOGIN_EVENT = 'login';
const LOGIN_RESPONSE_EVENT = 'login-response';
const REGISTER_EVENT = 'register';
const REGISTER_RESPONSE_EVENT = 'register-response';
const MARKET_LIST_REQUEST_EVENT = 'market-list-request';
const MARKET_LIST_RESPONSE_EVENT = 'market-list-response';
const MARKET_INVENTORY_LIST_REQUEST_EVENT = 'market-inventory-list-request';
const MARKET_INVENTORY_LIST_RESPONSE_EVENT = 'market-inventory-list-response';
const ITEM_LIST_BY_CONTAINER_REQUEST_EVENT = 'item-list-by-container-request';
const ITEM_LIST_BY_CONTAINER_RESPONSE_EVENT = 'item-list-by-container-response';
const INVALID_SESSION_EVENT = 'invalid-session';

const socket = io(SERVER_URL, {
  reconnection: false,
  timeout: TIMEOUT_MS,
});

const timeoutHandle = setTimeout(() => {
  console.error(`Timed out after ${TIMEOUT_MS}ms waiting for socket workflow.`);
  socket.disconnect();
  process.exit(1);
}, TIMEOUT_MS + 1000);

function waitForEvent(eventName, timeoutMs = TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(eventName, onEvent);
      reject(new Error(`Timed out waiting for ${eventName}`));
    }, timeoutMs);

    const onEvent = (payload) => {
      clearTimeout(timer);
      resolve(payload);
    };

    socket.once(eventName, onEvent);
  });
}

async function emitAndWait(requestEvent, responseEvent, payload, timeoutMs = TIMEOUT_MS) {
  const responsePromise = waitForEvent(responseEvent, timeoutMs);
  socket.emit(requestEvent, payload);
  return responsePromise;
}

function getLoginSession(response) {
  return typeof response?.sessionKey === 'string' && response.sessionKey.trim()
    ? response.sessionKey.trim()
    : null;
}

function isPlayerNotRegistered(response) {
  if (!response || response.success) {
    return false;
  }

  const reason = String(response.reason ?? '').toUpperCase();
  if (reason === 'PLAYER_NOT_REGISTERED') {
    return true;
  }

  const message = String(response.message ?? '').toLowerCase();
  return message.includes('not registered');
}

function findTargetItem(items, targetItemType) {
  return items.find((item) => String(item?.itemType ?? '').toLowerCase() === targetItemType.toLowerCase()) ?? null;
}

async function run() {
  console.log(`Connected to ${SERVER_URL} as ${socket.id}`);

  socket.once(INVALID_SESSION_EVENT, () => {
    throw new Error('Server emitted invalid-session during validation.');
  });

  let loginResponse = await emitAndWait(LOGIN_EVENT, LOGIN_RESPONSE_EVENT, {
    playerName: PLAYER_NAME,
    password: PASSWORD,
  });

  if (isPlayerNotRegistered(loginResponse)) {
    console.log(`Player ${PLAYER_NAME} not registered. Attempting registration.`);
    const registerResponse = await emitAndWait(REGISTER_EVENT, REGISTER_RESPONSE_EVENT, {
      playerName: PLAYER_NAME,
      email: EMAIL,
      password: PASSWORD,
    });

    if (!registerResponse?.success) {
      throw new Error(`Registration failed: ${registerResponse?.message ?? 'Unknown error'}`);
    }

    loginResponse = {
      ...loginResponse,
      success: true,
      sessionKey: registerResponse.sessionKey,
    };
  }

  if (!loginResponse?.success) {
    throw new Error(`Login failed: ${loginResponse?.message ?? 'Unknown error'}`);
  }

  const sessionKey = getLoginSession(loginResponse);
  if (!sessionKey) {
    throw new Error('Login succeeded but no sessionKey was returned.');
  }

  const marketListResponse = await emitAndWait(
    MARKET_LIST_REQUEST_EVENT,
    MARKET_LIST_RESPONSE_EVENT,
    {
      playerName: PLAYER_NAME,
      sessionKey,
    },
    TIMEOUT_MS,
  );

  if (!marketListResponse?.success) {
    throw new Error(`Market list failed: ${marketListResponse?.message ?? 'Unknown error'}`);
  }

  const markets = Array.isArray(marketListResponse?.markets) ? marketListResponse.markets : [];
  if (!markets.length) {
    throw new Error('No markets returned by market-list-response.');
  }

  let totalEntriesExamined = 0;
  for (const market of markets) {
    console.log(`Checking market ${market.marketId} (${market.marketName ?? 'Unnamed'}) in ${market.solarSystemId}.`);

    let inventoryItems = [];
    try {
      const marketInventoryResponse = await emitAndWait(
        MARKET_INVENTORY_LIST_REQUEST_EVENT,
        MARKET_INVENTORY_LIST_RESPONSE_EVENT,
        {
          playerName: PLAYER_NAME,
          sessionKey,
          marketId: market.marketId,
          solarSystemId: market.solarSystemId,
          offset: 0,
          limit: 500,
        },
        TIMEOUT_MS,
      );

      if (marketInventoryResponse?.success) {
        inventoryItems = Array.isArray(marketInventoryResponse.inventory) ? marketInventoryResponse.inventory : [];
      } else {
        console.warn(`market-inventory-list-response failed: ${marketInventoryResponse?.message ?? 'Unknown error'}`);
      }
    } catch (error) {
      console.warn(`market-inventory-list-response unavailable: ${error.message}`);
    }

    if (!inventoryItems.length) {
      const itemListByContainerResponse = await emitAndWait(
        ITEM_LIST_BY_CONTAINER_REQUEST_EVENT,
        ITEM_LIST_BY_CONTAINER_RESPONSE_EVENT,
        {
          playerName: PLAYER_NAME,
          sessionKey,
          containerType: 'market',
          containerId: market.marketId,
        },
        TIMEOUT_MS,
      );

      if (!itemListByContainerResponse?.success) {
        throw new Error(`Item list by container failed: ${itemListByContainerResponse?.message ?? 'Unknown error'}`);
      }

      inventoryItems = Array.isArray(itemListByContainerResponse.items) ? itemListByContainerResponse.items : [];
    }

    totalEntriesExamined += inventoryItems.length;
    const match = findTargetItem(inventoryItems, TARGET_ITEM_TYPE);
    if (match) {
      console.log(`Found ${TARGET_ITEM_TYPE} in ${market.marketId}: ${match.displayName ?? match.itemType}`);
      console.log(`Inventory entries examined: ${totalEntriesExamined}`);
      process.exitCode = 0;
      return;
    }
  }

  console.log(`Inventory entries examined: ${totalEntriesExamined}`);
  console.log(`${TARGET_ITEM_TYPE} is missing from all returned market inventories.`);
  process.exitCode = 2;
}

socket.on('connect', () => {
  run()
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    })
    .finally(() => {
      clearTimeout(timeoutHandle);
      socket.disconnect();
    });
});

socket.on('connect_error', (error) => {
  clearTimeout(timeoutHandle);
  console.error(`Socket connection error: ${error.message}`);
  process.exit(1);
});

socket.on('disconnect', () => {
  clearTimeout(timeoutHandle);
});
