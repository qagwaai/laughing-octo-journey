/// <reference types="vitest" />
import angular from '@analogjs/vite-plugin-angular';
import { defineConfig } from 'vite';

export default defineConfig(() => ({
  plugins: [angular()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/testing/vitest-setup.ts'],
    include: ['src/**/*.vitest.ts'],
    reporters: ['default'],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage/vitest',
      reporter: ['text-summary', 'html'],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 85,
      },
    },
  },
}));
