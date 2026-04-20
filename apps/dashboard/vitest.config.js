import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['@testing-library/jest-dom/vitest'],
    include: [
      '**/__tests__/**/*.test.js',
      '../../../packages/core/**/__tests__/**/*.test.js',
    ],
  },
});
