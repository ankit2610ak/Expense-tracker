import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    fileParallelism: false,
    maxConcurrency: 1,
    env: {
      DATABASE_URL: ':memory:',
      JWT_SECRET: 'test-secret-key-for-vitest'
    }
  }
});
