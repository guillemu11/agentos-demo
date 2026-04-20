import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['../../packages/core/crypto/__tests__/**/*.test.js'],
  },
});
