import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['../../packages/core/competitor-intel/__tests__/**/*.test.js'],
    testTimeout: 30000,
    env: {
      DATABASE_URL: 'postgresql://agentos:agentos2024secure@yamanote.proxy.rlwy.net:42145/agentos',
    },
  },
});
