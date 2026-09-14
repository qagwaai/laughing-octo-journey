import { expect, Locator, Page } from '@playwright/test';

/**
 * Clicks a plain DOM control without going through Playwright's mouse pipeline.
 *
 * The game shell renders a live angular-three/WebGL scene whose animation loop
 * invalidates Angular signals on every frame. On CI there is no GPU, so Chromium
 * falls back to SwiftShader and that loop saturates the renderer main thread.
 * `locator.click()` — even with `force: true` — still asks the browser to scroll
 * the element into view, and that request can be starved indefinitely, which
 * surfaces as a click that hangs until the test timeout even though the element
 * is visible, enabled and attached.
 *
 * Dispatching the DOM event directly needs no scroll and no hit-testing, so it is
 * immune to that starvation. Callers are still expected to assert visibility and
 * enablement first, so the actionability guarantees are preserved explicitly.
 */
export async function dispatchClick(locator: Locator, timeout = 10_000): Promise<void> {
  await expect(locator).toBeVisible({ timeout });
  await locator.dispatchEvent('click', {}, { timeout });
}

/**
 * Dispatches a click and retries until `until` reports the click took effect.
 *
 * `dispatchEvent` trades one failure mode for another: it is immune to main-thread
 * starvation, but it does not inherit `locator.click()`'s auto-retry. If the target
 * detaches during an Angular re-render between resolution and dispatch, the event
 * lands on a stale node and is silently lost with no error. That surfaced as a
 * navigation that simply never happened.
 *
 * Re-resolving the locator on each attempt closes that gap, and checking `until`
 * first means a click that already worked costs no extra attempts.
 */
export async function dispatchClickUntil(
  locator: Locator,
  until: () => Promise<boolean>,
  timeout = 20_000,
): Promise<void> {
  // No upfront visibility gate: the caller has already asserted actionability where
  // it matters, and a second hard gate here can fail spuriously while the starved
  // main thread settles. The poll below re-resolves the locator each attempt anyway.
  await expect
    .poll(
      async () => {
        if (await until()) {
          return true;
        }
        try {
          await locator.dispatchEvent('click', {}, { timeout: 2_000 });
        } catch {
          // Element detached or not yet ready; the next poll re-resolves it.
        }
        return until();
      },
      { timeout, intervals: [150, 300, 500, 750, 1_000] },
    )
    .toBe(true);
}

/** Dispatches a click, retrying until the page URL matches `pattern`. */
export async function dispatchClickUntilUrl(
  page: Page,
  locator: Locator,
  pattern: RegExp,
  timeout = 20_000,
): Promise<void> {
  await dispatchClickUntil(locator, async () => pattern.test(page.url()), timeout);
}
