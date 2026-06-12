/// <reference types="vitest" />
import angular from '@analogjs/vite-plugin-angular';
import { defineConfig } from 'vite';

export default defineConfig(() => ({
  plugins: [angular()],
  resolve: {
    alias: {
      '@pmndrs/vanilla': '@pmndrs/vanilla/index.js',
      '@pmndrs/cannon-worker-api': '@pmndrs/cannon-worker-api/dist/index.js',
    },
  },
  ssr: {
    noExternal: [
      'three',
      '@pmndrs/vanilla',
      '@pmndrs/cannon-worker-api',
      'angular-three',
      'angular-three-postprocessing',
      'angular-three-cannon',
    ],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/testing/vitest-setup.ts'],
    include: ['src/**/*.vitest.ts'],
    server: {
      deps: {
        inline: [
          'three',
          /^three\/examples\/.+/,
          '@pmndrs/vanilla',
          /@pmndrs\/vanilla\/?.*/,
          '@pmndrs/cannon-worker-api',
          /@pmndrs\/cannon-worker-api\/?.*/,
          'angular-three-cannon',
        ],
      },
    },
    reporters: ['agent'],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage/vitest',
      reporter: ['text-summary', 'html'],
      thresholds: {
        statements: 80,
        branches: 68,
        functions: 80,
        lines: 80,
      },
    },
  },
}));
