import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // 与 web/vite.config.ts 的 define 对齐：测试默认走非 dev 路径，关闭调试日志
  define: {
    __DEV_LOG__: 'false',
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/lib/**/*.ts'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/main.tsx', 'src/App.tsx'],
      // 桌面端适配器是关键路径（store / auth / spider），目标 80%+
      // Phase 6 批 2-4 期间逐步落齐 G1/G2 单测
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
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../shared/src'),
    },
  },
});
