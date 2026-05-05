import type { Config } from 'tailwindcss';
import webConfig from '../web/tailwind.config';

// 桌面端 Vite 的 cwd 在 packages/desktop/，PostCSS 必须能在此目录找到 tailwind 配置。
// 复用 web 包的 theme/plugins，仅重写 content：扫描范围必须覆盖 web/src（页面与组件）
// 与 desktop/src 双源，否则 utility 会被 JIT 漏标。
const config: Config = {
  ...webConfig,
  content: [
    './src/**/*.{ts,tsx}',
    './index.html',
    '../web/src/**/*.{ts,tsx}',
    '../web/index.html',
    '../web/player.html',
  ],
};

export default config;
