import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pkg = JSON.parse(
  readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'),
) as { version: string };

export default defineConfig({
  // 与 vite.config.ts 的 define 对齐：测试默认走非 dev 路径，关闭调试日志
  define: {
    __DEV_LOG__: 'false',
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
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
      // Phase 7 批 11-14 完成 dialogs / layout / pages / lyric-editor / 卡片列表 14 个组件单测，
      // web 整体覆盖率从 17% 拉升到 60% lines 主目标达标。
      // branches 53.69% 暂时低于长期目标 55%，留待 §7.0.8 后续大文件（accounts/lyric-list/
      // live-slicer-men/s-player/lyric-editor）补齐时一同回拉到 55。
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 53,
        statements: 60,
      },
    },
  },
});
