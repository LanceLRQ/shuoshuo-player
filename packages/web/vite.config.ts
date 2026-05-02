import { defineConfig, type UserConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }): UserConfig => {
  const isExtension = mode === 'extension';

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@shared': path.resolve(__dirname, '../shared/src'),
      },
    },
    build: {
      outDir: isExtension ? 'dist-extension' : 'dist',
      emptyOutDir: true,
      target: 'chrome88',
      cssCodeSplit: true,
      rollupOptions: isExtension
        ? {
            input: {
              player: path.resolve(__dirname, 'player.html'),
              background: path.resolve(__dirname, 'src/background/index.ts'),
            },
            output: {
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
          },
    },
    server: {
      port: 3000,
      strictPort: false,
    },
  };
});
