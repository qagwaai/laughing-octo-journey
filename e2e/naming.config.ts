import { defineConfig, devices } from '@playwright/test';
import base from '../playwright.config';

/** Supplemental readiness matrix; production project currently enables Chromium only. */
export default defineConfig({
  ...base,
  testDir: './tests',
  testMatch: 'viewer-naming.spec.ts',
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
