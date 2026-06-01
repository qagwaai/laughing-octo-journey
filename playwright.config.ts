import { defineConfig, devices } from '@playwright/test';

function parseWorkerCount(rawValue: string | undefined): number | undefined {
  if (!rawValue) {
    return undefined;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return undefined;
  }

  return parsed;
}

const workerCountFromEnv =
  parseWorkerCount(process.env['CI_PLAYWRIGHT_WORKERS']) ??
  parseWorkerCount(process.env['PLAYWRIGHT_WORKERS']) ??
  parseWorkerCount(process.env['CI_NODE_TOTAL']);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  workers: workerCountFromEnv ?? 2,
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry',
    video: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],
  webServer: {
    command: 'npm start',
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
  },
});
