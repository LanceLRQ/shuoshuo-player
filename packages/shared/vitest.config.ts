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
      // 阈值随测试落地分批提升：当前仅覆盖"关键路径"（详见 plans/phase-7 §7.0.4）
      // 目标值（Phase 7 验收时回拉）：lines/functions/statements 60、branches 55
      thresholds: {
        lines: 35,
        functions: 35,
        branches: 25,
        statements: 35,
      },
    },
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, './src'),
    },
  },
});
