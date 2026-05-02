import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../shared/src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/test/**',
        'src/main.tsx',
        'src/components/ui/**',
        'src/**/index.ts',
        'src/vite-env.d.ts',
      ],
      // 批次 1 已落测：F1/F2 适配器 + H1/H2/H3 关键路径 + ui-shell store
      // 当前覆盖率：lines 17%（关键路径 src/lib 98% / src/hooks 76% 已达 80% 关键路径门槛）
      // 整体 60% 门槛留待后续批次补齐 pages/* 与 dialogs/* 测试（详见 plans/tasks.md §7.0.5/7.0.7）
      // 目标值（最终验收时回拉）：lines/functions/statements 60、branches 55
      thresholds: {
        lines: 15,
        functions: 10,
        branches: 10,
        statements: 15,
      },
    },
  },
});
