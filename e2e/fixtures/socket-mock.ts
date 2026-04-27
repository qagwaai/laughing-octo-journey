import { Page } from '@playwright/test';

export type SocketEventHandler = (data: unknown) => { event: string; data: unknown } | null;

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
                  if (this.debugEnabled) {
                    console.log(`[socket-mock] auto response: ${response.event}`);
                  }
                  this.push(response.event, response.data);
                }
              } else if (this.debugEnabled) {
                console.log(`[socket-mock] no handler registered for event: ${eventName}`);
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
