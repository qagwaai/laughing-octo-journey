import { Page } from '@playwright/test';

export type SocketEventHandler = (data: unknown) => { event: string; data: unknown } | null;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function withRequestCorrelation(responseData: unknown, requestData: unknown): unknown {
  if (!isObject(responseData) || !isObject(requestData)) {
    return responseData;
  }

  const correlationId = requestData['correlationId'];
  const requestIdentity = requestData['requestIdentity'];

  const enriched: Record<string, unknown> = { ...responseData };
  if (enriched['correlationId'] == null && typeof correlationId === 'string' && correlationId.trim().length > 0) {
    enriched['correlationId'] = correlationId;
  }
  if (enriched['requestIdentity'] == null && isObject(requestIdentity)) {
    enriched['requestIdentity'] = requestIdentity;
  }

  return enriched;
}

function buildDefaultResponse(eventName: string, eventData: unknown): { event: string; data: unknown } | null {
  if (!isObject(eventData)) {
    return null;
  }

  if (
    eventName === 'character-bust-create' ||
    eventName === 'character-bust-update' ||
    eventName === 'character-bust-create-request' ||
    eventName === 'character-bust-update-request'
  ) {
    const descriptorInput = isObject(eventData['descriptor']) ? eventData['descriptor'] : null;
    const descriptor = {
      schemaVersion: 'sw-15-m0-v1',
      presetVersion: (descriptorInput?.['presetVersion'] as string | undefined) ?? 'sw-15-m2-a-v1',
      faceShape: (descriptorInput?.['faceShape'] as string | undefined) ?? 'oval',
      skinTone: (descriptorInput?.['skinTone'] as string | undefined) ?? 'medium',
      hairStyle: (descriptorInput?.['hairStyle'] as string | undefined) ?? 'short-crop',
      hairColor: (descriptorInput?.['hairColor'] as string | undefined) ?? 'brown',
      eyeStyle: (descriptorInput?.['eyeStyle'] as string | undefined) ?? 'almond',
      eyeColor: (descriptorInput?.['eyeColor'] as string | undefined) ?? 'green',
      expressionPreset: (descriptorInput?.['expressionPreset'] as string | undefined) ?? 'focused',
      apparelAccent: (descriptorInput?.['apparelAccent'] as string | undefined) ?? 'collar',
    };

    const responseEvent = eventName.endsWith('-request')
      ? `${eventName.slice(0, -'-request'.length)}-response`
      : `${eventName}-response`;

    return {
      event: responseEvent,
      data: {
        success: true,
        message: `${eventName} ok`,
        playerName: (eventData['playerName'] as string | undefined) ?? 'Pioneer',
        characterId: (eventData['characterId'] as string | undefined) ?? 'character-1',
        descriptor,
      },
    };
  }

  return null;
}

/**
 * Minimal socket.io v4 polling-transport mock for Playwright tests.
 *
 * Intercepts HTTP requests to the socket.io server URL and implements
 * just enough of the Engine.IO v4 polling protocol to keep the
 * socket.io-client connected and able to exchange events.
 *
 * Usage:
 *   const mock = new SocketIOMock(page);
 *   mock.on('login', (req) => ({ event: 'login-response', data: { success: true, ... } }));
 *   await mock.setup();
 *   // ... navigate and interact
 */
export class SocketIOMock {
  private readonly sid: string;
  private readonly namespaceSid: string;
  private readonly responseQueue: string[] = [];
  private pendingGetResolve: ((packet: string) => void) | null = null;
  private readonly handlers = new Map<string, SocketEventHandler>();
  private readonly debugEnabled = process.env['PW_SOCKET_MOCK_DEBUG'] === '1';

  constructor(
    private readonly page: Page,
    private readonly serverUrl = 'http://localhost:3000',
  ) {
    this.sid = `pw-mock-${Date.now()}`;
    this.namespaceSid = `pw-ns-${Date.now()}`;
  }

  private connectResolve: (() => void) | null = null;

  /**
   * Resolves once the socket.io namespace connect handshake has been fully
   * delivered to the browser (i.e. the '40' confirm packet has been sent via
   * route.fulfill). Awaiting this before interacting with the page guarantees
   * that socket.connected === true in the Angular app.
   */
  readonly connected: Promise<void> = new Promise<void>((resolve) => {
    this.connectResolve = resolve;
  });

  /** Register a handler that auto-responds when the client emits the given event. */
  on(event: string, handler: SocketEventHandler): this {
    this.handlers.set(event, handler);
    return this;
  }

  /** Manually push a server-initiated event to the client on the next poll. */
  push(event: string, data: unknown): void {
    const packet = `42["${event}",${JSON.stringify(data)}]`;
    if (this.pendingGetResolve) {
      const resolve = this.pendingGetResolve;
      this.pendingGetResolve = null;
      resolve(packet);
    } else {
      this.responseQueue.push(packet);
    }
  }

  /**
   * Clears any queued packets so a reused live page starts from a clean mock state.
   * Flushes any pending GET long-poll with a server ping so the polling cycle
   * continues cleanly instead of silently hanging until the 25 s keepalive fires.
   */
  reset(): void {
    this.responseQueue.length = 0;
    if (this.pendingGetResolve) {
      const resolve = this.pendingGetResolve;
      this.pendingGetResolve = null;
      resolve('2'); // server ping — client will pong and issue a fresh GET poll
    }
  }

  private enqueue(packet: string): void {
    if (this.debugEnabled) {
      console.log(`[socket-mock] enqueue packet: ${packet}`);
    }
    if (this.pendingGetResolve) {
      const resolve = this.pendingGetResolve;
      this.pendingGetResolve = null;
      resolve(packet);
    } else {
      this.responseQueue.push(packet);
    }
  }

  /** Returns next queued packet(s), or waits up to 25 s before sending a server ping. */
  private dequeueOrWait(): Promise<string> {
    if (this.responseQueue.length > 0) {
      return Promise.resolve(this.responseQueue.splice(0).join('\x1e'));
    }
    return new Promise<string>((resolve) => {
      const timer = setTimeout(() => {
        if (this.pendingGetResolve === resolve) {
          this.pendingGetResolve = null;
        }
        resolve('2'); // server ping as keepalive — client will pong via POST
      }, 25_000);
      this.pendingGetResolve = (packet: string) => {
        clearTimeout(timer);
        resolve(packet);
      };
    });
  }

  /**
   * Install route interceptors on `page`. Call this before any navigation.
   */
  async setup(): Promise<void> {
    await this.page.route(`${this.serverUrl}/socket.io/**`, async (route) => {
      const req = route.request();
      const method = req.method();
      const url = new URL(req.url());
      const hasSid = url.searchParams.has('sid');

      // ── Initial Engine.IO handshake (no sid yet) ────────────────────────
      if (method === 'GET' && !hasSid) {
        // Clear stale polling state from any prior connection (e.g. page.reload()).
        // Without this, the stale pendingGetResolve would consume the new namespace-
        // connect '40' packet, leaving the new socket in a disconnected state.
        this.responseQueue.length = 0;
        this.pendingGetResolve = null;
        await route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'text/plain; charset=UTF-8' },
          body: `0{"sid":"${this.sid}","upgrades":[],"pingInterval":300000,"pingTimeout":20000,"maxPayload":1000000}`,
        });
        return;
      }

      // ── Client POST (emitting events, pong, namespace connect) ──────────
      if (method === 'POST' && hasSid) {
        const body = req.postData() ?? '';

        // Engine.IO polling POST bodies may contain multiple packets separated
        // by record separator (0x1e), e.g. "40\x1e42[...]".
        for (const packet of body.split('\x1e')) {
          if (packet === '40') {
            // Socket.IO namespace connect request → queue confirmation
            this.enqueue(`40{"sid":"${this.namespaceSid}"}`);
            if (this.debugEnabled) {
              console.log('[socket-mock] received namespace connect request (40)');
            }
            continue;
          }

          if (packet === '3') {
            // Client pong in response to server ping — no action needed
            continue;
          }

          if (packet.startsWith('42')) {
            // Client emitting a socket.io event
            try {
              const [eventName, eventData] = JSON.parse(packet.slice(2)) as [string, unknown];
              if (this.debugEnabled) {
                console.log(`[socket-mock] client event: ${eventName} data=${JSON.stringify(eventData)}`);
              }
              const handler = this.handlers.get(eventName);
              if (handler) {
                const response = handler(eventData);
                if (response !== null) {
                  const responseData = withRequestCorrelation(response.data, eventData);
                  if (this.debugEnabled) {
                    console.log(`[socket-mock] auto response: ${response.event}`);
                  }
                  this.push(response.event, responseData);
                }
              } else {
                const response = buildDefaultResponse(eventName, eventData);
                if (response !== null) {
                  const responseData = withRequestCorrelation(response.data, eventData);
                  if (this.debugEnabled) {
                    console.log(`[socket-mock] default response: ${response.event}`);
                  }
                  this.push(response.event, responseData);
                } else if (this.debugEnabled) {
                  console.log(`[socket-mock] no handler registered for event: ${eventName}`);
                }
              }
            } catch {
              // ignore malformed packets
            }
          }
        }

        await route.fulfill({ status: 200, body: 'ok' });
        return;
      }

      // ── Client GET (polling for server messages) ─────────────────────────
      if (method === 'GET' && hasSid) {
        const packet = await this.dequeueOrWait();
        await route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'text/plain; charset=UTF-8' },
          body: packet,
        });
        // Resolve connected promise once the namespace-connect reply ('40') has
        // been delivered to the browser.
        if (packet.startsWith('40')) {
          this.connectResolve?.();
          this.connectResolve = null;
        }
        return;
      }

      // Anything else (CORS preflight, etc.) — let it through
      await route.continue();
    });
  }
}
