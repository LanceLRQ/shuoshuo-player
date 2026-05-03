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
      // Phase 6 §6.X 重构后：init.ts 持久化套件下沉到 shared（约 50 行迁出到 100% 覆盖区域），
      // web 包绝对覆盖行数同步下降；总体仓库覆盖率不退步（shared 包反向提升至 66%）。
      // 整体 60% 门槛留待后续批次补齐 pages/* 与 dialogs/* 测试（详见 plans/tasks.md §7.0.5/7.0.7）
      // 目标值（最终验收时回拉）：lines/functions/statements 60、branches 55
      thresholds: {
        lines: 14,
        functions: 10,
        branches: 8,
        statements: 14,
      },
    },
  },
});
