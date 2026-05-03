import { defineConfig, type UserConfig, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * 第三方库分包策略
 * - react-vendor：React 核心 + Router
 * - ui-vendor：Radix UI 全家桶 + 图标库
 * - audio：Howler（仅 SPlayer 用，可独立 chunk）
 * - lrc：LRC 解析与显示（仅歌词流程用）
 * - zustand：状态管理库
 *
 * 函数形式而非对象形式，避免漏匹配 Radix 子包
 */
function manualChunks(id: string): string | undefined {
  if (!id.includes('node_modules')) return undefined;
  if (
    id.includes('/react-router') ||
    id.includes('/react-dom/') ||
    /node_modules\/react\//.test(id) ||
    id.includes('/scheduler/')
  ) {
    return 'react-vendor';
  }
  if (id.includes('/@radix-ui/') || id.includes('/lucide-react/')) {
    return 'ui-vendor';
  }
  if (id.includes('/howler/')) return 'audio';
  if (id.includes('/lrc-kit/') || id.includes('/react-lrc/')) return 'lrc';
  if (id.includes('/zustand/')) return 'zustand';
  return undefined;
}

export default defineConfig(({ mode }): UserConfig => {
  // 'extension' = 生产扩展构建；'extension-dev' = 开发 watch 模式（保留 console.debug）
  // 注意：不通过 NODE_ENV=development 区分，避免 axios/qs 等库走 dev path
  // 引入 Node 内置模块（util.inspect.custom 等）导致浏览器运行时报错
  const isExtension = mode === 'extension' || mode === 'extension-dev';
  const isExtensionDev = mode === 'extension-dev';
  // ANALYZE=1 启用：构建后 stats.html 可视化每个 chunk 的依赖来源
  const enableAnalyze = process.env.ANALYZE === '1';

  const plugins: PluginOption[] = [react()];
  if (enableAnalyze) {
    // 输出到 .analyze/* 避免污染 dist-extension/dist 产物（Chrome 扩展会按目录打包）
    plugins.push(
      visualizer({
        filename: path.resolve(
          __dirname,
          isExtension ? '.analyze/extension-stats.html' : '.analyze/web-stats.html',
        ),
        gzipSize: true,
        brotliSize: true,
        template: 'treemap',
      }) as PluginOption,
    );
  }

  return {
    plugins,
    // 编译期常量：__DEV_LOG__ = true 时保留 [WBI-DEBUG] 链路日志
    // 仅 dev:extension（mode=extension-dev）置 true；prod 构建时整段 if (false) {} 被 DCE
    define: {
      __DEV_LOG__: JSON.stringify(isExtensionDev),
    },
    // packages/web/public 内的 manifest.json / rules.json / logo*.png 由 Vite 默认 publicDir
    // 行为复制到 outDir 根（既适用 dev 也适用 build），扩展模式无需额外插件
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@shared': path.resolve(__dirname, '../shared/src'),
      },
    },
    build: {
      outDir: isExtension ? 'dist-extension' : 'dist',
      emptyOutDir: true,
      // Chrome 扩展 MV3 最低 Chrome 88，桌面同样基线（Tauri WebView 也支持）
      target: 'chrome88',
      cssCodeSplit: true,
      // 单 chunk 软警告 1 MB（仅 vite 构建告警，与扩展包体积阈值 10 MB 不同步）
      chunkSizeWarningLimit: 1000,
      rollupOptions: isExtension
        ? {
            input: {
              player: path.resolve(__dirname, 'player.html'),
              background: path.resolve(__dirname, 'src/background/index.ts'),
            },
            output: {
              manualChunks,
              entryFileNames: (chunkInfo) =>
                chunkInfo.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js',
              chunkFileNames: 'assets/[name]-[hash].js',
              assetFileNames: 'assets/[name]-[hash][extname]',
            },
          }
        : {
            input: {
              main: path.resolve(__dirname, 'index.html'),
            },
            output: { manualChunks },
          },
    },
    server: {
      port: 3000,
      strictPort: false,
    },
  };
});
