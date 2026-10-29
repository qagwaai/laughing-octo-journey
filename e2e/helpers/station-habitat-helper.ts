import { expect, type Page } from '@playwright/test';
import type { Scene } from 'three';

async function sampleHabitatMotion(page: Page, canvasSelector: string) {
  return page.evaluate(async (selector) => {
    const api = (window as Window & { ng: { getComponent: (element: Element) => unknown } }).ng;
    const canvas = document.querySelector(selector);
    if (!canvas) throw new Error('Station canvas is missing.');
    const component = api.getComponent(canvas) as { store: { snapshot: { scene: Scene } } };
    const scene = component.store.snapshot.scene;
    const ring = scene.getObjectByName('HabitatRing');
    if (!ring) throw new Error('Station habitat ring is missing.');
    const stationary = ['ComputeCore', 'DockingHead', 'SunShade', 'RadiatorHot_01', 'Slip_Outer_01'].map((name) => {
      const object = scene.getObjectByName(name);
      if (!object) throw new Error(`Station part ${name} is missing.`);
      return object;
    });
    const transforms = () => stationary.map((object) => [...object.position.toArray(), ...object.quaternion.toArray()]);
    // Start sampling after the renderer has observed any motion-preference change.
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const initial = ring.quaternion.clone();
    const startedAt = performance.now();
    const position = ring.position.toArray();
    const before = transforms();
    for (let frame = 0; frame < 8; frame++) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
    return {
      angle: ring.quaternion.angleTo(initial),
      elapsedMs: performance.now() - startedAt,
      axleUnmoved: JSON.stringify(position) === JSON.stringify(ring.position.toArray()),
      stationUnmoved: JSON.stringify(before) === JSON.stringify(transforms()),
    };
  }, canvasSelector);
}

export async function expectStationHabitatMotion(page: Page, canvasSelector: string) {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const moving = await sampleHabitatMotion(page, canvasSelector);
  expect(moving.angle).toBeGreaterThan(0.001);
  expect(moving.angle).toBeCloseTo((Math.PI * 2 * moving.elapsedMs) / 60_000, 2);
  expect(moving.axleUnmoved).toBe(true);
  expect(moving.stationUnmoved).toBe(true);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect((await sampleHabitatMotion(page, canvasSelector)).angle).toBeLessThan(1e-6);

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect((await sampleHabitatMotion(page, canvasSelector)).angle).toBeLessThan(1e-6);
  await page.evaluate(() => {
    Reflect.deleteProperty(document, 'hidden');
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect((await sampleHabitatMotion(page, canvasSelector)).angle).toBeGreaterThan(0.001);
}
