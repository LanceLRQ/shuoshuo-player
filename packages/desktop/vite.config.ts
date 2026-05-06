import { defineConfig, type UserConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pkg = JSON.parse(
  readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'),
) as { version: string };

// Tauri v2 默认监听端口；首次开发时由 tauri.conf.json 通过 devUrl 指向此 server
const TAURI_DEV_HOST = process.env.TAURI_DEV_HOST;

export default defineConfig(async (): Promise<UserConfig> => ({
  plugins: [react()],
  // shared 层用 __DEV_LOG__ 控制 [WBI-DEBUG]/[BILI-API] 调试日志输出。
  // 该变量原由 web 端 vite define 注入；desktop 必须独立声明，否则编译产物中
  // 所有 `if (__DEV_LOG__)` 在 Tauri WebView 运行时抛 ReferenceError，
  // 进而导致 axios 拦截器/store catch 路径在第一次访问该变量时中断，
  // isInited setState 永不执行 → UI 卡 spinner。Tauri 端固定 false。
  define: {
    __DEV_LOG__: JSON.stringify(false),
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: {
      // 桌面端复用 packages/web 的所有页面/组件/store，因此 @ 直接指向 web/src，
      // 让 web 内部的 @/components/... 等 import 在 desktop 编译上下文下可解析
      '@': path.resolve(__dirname, '../web/src'),
      '@desktop': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../shared/src'),
      '@web': path.resolve(__dirname, '../web/src'),
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: TAURI_DEV_HOST ?? false,
    hmr: TAURI_DEV_HOST
      ? {
          protocol: 'ws',
          host: TAURI_DEV_HOST,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
  envPrefix: ['VITE_', 'TAURI_ENV_*'],
  build: {
    target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
    minify: process.env.TAURI_ENV_DEBUG ? false : 'oxc',
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
    outDir: 'dist',
    emptyOutDir: true,
  },
}));
