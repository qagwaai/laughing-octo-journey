import { expect, Page } from '@playwright/test';

type ShipHangarReadinessState = 'idle' | 'loading' | 'loaded' | 'empty' | 'error';

interface ShipHangarReadinessSnapshot {
  state: ShipHangarReadinessState;
  requestGeneration: number;
  shipCount: number;
  error: string | null;
  routeContext: {
    playerName: string | null;
    characterId: string | null;
    shipId: string | null;
  };
  lastSuccessfulLoad: {
    requestGeneration: number;
    shipCount: number;
    loadedAtEpochMs: number;
  } | null;
  updatedAtEpochMs: number;
}

interface Sw13AppTestReadinessSnapshot {
  version: 'sw13.v1';
  hangar: ShipHangarReadinessSnapshot;
}

export class ShipHangarPage {
  constructor(private readonly page: Page) {}

  get shipItems() {
    return this.page.locator('.ship-item');
  }

  shipItem(index: number) {
    return this.shipItems.nth(index);
  }

  shipItemByName(name: string) {
    return this.page.locator('.ship-item').filter({ hasText: name }).first();
  }

  activeShipControlButton(index: number) {
    return this.shipItem(index).locator('button.inventory-link').nth(3);
  }

  activeShipControlButtonByName(name: string) {
    return this.shipItemByName(name).locator('button.inventory-link').nth(3);
  }

  setActiveShipButton(index: number) {
    return this.activeShipControlButton(index);
  }

  activeShipButton(index: number) {
    return this.activeShipControlButton(index);
  }

  get shipBadgeName() {
    return this.page.locator('app-character-ship-badge .ship-badge-name');
  }

  async getReadinessSnapshot() {
    return this.page.evaluate(() => {
      const api = (
        window as Window & {
          __sw13AppTestReadiness?: {
            version: 'sw13.v1';
            getSnapshot: () => Sw13AppTestReadinessSnapshot;
          };
        }
      ).__sw13AppTestReadiness;

      return api?.version === 'sw13.v1' ? api.getSnapshot() : null;
    });
  }

  async waitForLoadedReadiness(options: { minimumShipCount?: number; timeout?: number } = {}) {
    const minimumShipCount = options.minimumShipCount ?? 1;

    await expect
      .poll(
        async () => {
          const snapshot = await this.getReadinessSnapshot();
          return snapshot
            ? {
                version: snapshot.version,
                state: snapshot.hangar.state,
                shipCount: snapshot.hangar.shipCount,
                lastSuccessfulShipCount: snapshot.hangar.lastSuccessfulLoad?.shipCount ?? null,
                error: snapshot.hangar.error,
              }
            : null;
        },
        { timeout: options.timeout ?? 15_000 },
      )
      .toMatchObject({
        version: 'sw13.v1',
        state: 'loaded',
        shipCount: expect.any(Number),
        lastSuccessfulShipCount: expect.any(Number),
        error: null,
      });

    await expect
      .poll(async () => (await this.getReadinessSnapshot())?.hangar.shipCount ?? 0, {
        timeout: options.timeout ?? 15_000,
      })
      .toBeGreaterThanOrEqual(minimumShipCount);
  }
}
