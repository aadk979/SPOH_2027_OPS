import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    environment: 'node',
    // Each test file builds its own in-memory database; PGlite start-up takes ~1s.
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
