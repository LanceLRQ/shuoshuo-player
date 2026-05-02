import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/__mocks__/**',
        'src/**/__fixtures__/**',
        'src/index.ts',
        'src/**/index.ts',
      ],
      // Phase 7 验收门槛（与 plans/phase-7 §7.0.5 对齐）
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 55,
        statements: 60,
      },
    },
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, './src'),
    },
  },
});
