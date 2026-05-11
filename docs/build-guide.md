# 构建指南

## Chrome 扩展

### 打包

```bash
pnpm build:extension
```

产物在 `packages/web/dist-extension/`：

```
dist-extension/
├── manifest.json            扩展声明（含 16/48/128 三档图标 + 9 项 host_permissions）
├── rules.json               4 条静态 DNR 规则（bilivideo / y.qq.com / akamaized 改写请求头）
├── background.js            MV3 service worker
├── player.html              主入口
├── logo16.png / logo48.png / logo128.png
└── assets/
    ├── react-vendor-*.js    React 核心 + Router (~298 KB)
    ├── ui-vendor-*.js       Radix UI + lucide-react (~138 KB)
    ├── audio-*.js           Howler (~36 KB)
    ├── lrc-*.js             LRC 解析 (~23 KB)
    ├── player-*.js          主入口业务代码 (~189 KB)
    ├── src-*.js             跨页面共享业务代码 (~118 KB)
    ├── home / fav-list / discovery / ... (按页面拆分，每个 ~2-32 KB)
    └── assets/*.css         样式
```

总未压缩体积约 **1020 KiB（< 1 MB）**，gzip 后约 280 KB。

### 加载到 Chrome

1. 打开 `chrome://extensions`
2. 右上角开启"开发者模式"
3. 点击"加载已解压的扩展程序"，选择 `packages/web/dist-extension/` 目录
4. 点击扩展图标即打开 player 主窗口

### 验证 DNR 规则

```
chrome://net-internals/#events
```

播放音频时观察 `bilivideo.com` / `akamaized.net` 等域名请求，应携带改写后的 `Referer` 与 `User-Agent`（详见 `packages/web/public/rules.json`）。

### 体积分析

```bash
pnpm --filter @shuoshuo-player/web build:extension:analyze
```

stats.html 输出到 `packages/web/.analyze/extension-stats.html`，treemap 形式展示每个 chunk 的依赖来源，含 gzip / brotli 体积。

## Tauri 桌面端

### 环境

| 平台 | 额外要求 |
|---|---|
| macOS | Xcode Command Line Tools（`xcode-select --install`） |
| Windows | Visual Studio Build Tools（C++ 工作负载）+ WebView2 |
| Linux | `webkit2gtk-4.1` / `libssl-dev` / `librsvg2-dev`（Ubuntu/Debian） |

详见 [Tauri prerequisites](https://tauri.app/start/prerequisites/)。

### 打包

```bash
pnpm build:desktop
```

产物在 `packages/desktop/src-tauri/target/release/bundle/`：

| 平台 | 产物 |
|---|---|
| macOS | `.app` 应用包 + `.dmg` 安装镜像 |
| Windows | `.msi` 安装包 + `.exe` 便携版 |
| Linux | `.deb` / `.rpm` / AppImage |

### 跨平台交叉编译

> Tauri 默认只能为当前主机平台打包。跨平台需借助 GitHub Actions 或对应平台的 CI runner。

参考 [Tauri Cross-Platform Compilation](https://tauri.app/distribute/)。

## Web 静态站点（仅调试用）

```bash
pnpm build:web
```

产物在 `packages/web/dist/`，可挂在任意静态服务器调试 UI 流程。**不要直接发布给用户**：Web 模式没有 chrome.storage / DNR / Tauri Cookie 容器，B 站接口会因 CORS 与签名失败。

体积分析：

```bash
pnpm --filter @shuoshuo-player/web build:analyze
```

stats.html → `packages/web/.analyze/web-stats.html`。

## 开发模式 vs 生产模式差异

| 项 | dev:web | build / build:extension |
|---|---|---|
| 构建工具 | Vite dev server（ESM 实时编译） | Vite build（Rollup 拆包压缩） |
| 路由懒加载 | 立即解析 | 按需加载（用户访问时下载 chunk） |
| Manual chunks | 不生效 | 生效（react-vendor / ui-vendor / audio / lrc / zustand） |
| Source map | 行内 | 默认不生成（可在 vite.config 启用） |
| target | esnext | chrome88 |
| Console 输出 | 完整 | 默认保留（如需移除可用 `terser drop_console`） |

## 常见问题

### Q: 扩展加载后空白

A: 检查 Chrome 控制台。常见原因：

- manifest.json `host_permissions` 缺漏 `*://shuoshuo.sikong.ren/*`（云服务被阻断）
- service worker（background.js）启动失败：去 `chrome://extensions` 点 "service worker" 链接看错误日志

### Q: Tauri 启动时 Rust 编译卡住

A: 首次编译需下载所有 Cargo 依赖（约 800 MB），耗时 5-15 分钟取决于网络。后续增量 < 1 分钟。设置国内镜像可加速：参考 [tuna 镜像](https://mirrors.tuna.tsinghua.edu.cn/help/crates.io-index.git/)。

### Q: 产物 > 1 MB 想进一步瘦身

A: 优先级：

1. 跑一次 `build:extension:analyze` 看 treemap，找出大头依赖
2. 检查是否有意外引入的 `lodash`（应该用 `lodash-es` tree-shake）
3. logo128.png 用 `oxipng` / `pngquant` 无损压缩（当前 36 KB）
4. 评估是否能把 `dayjs` 替换为更轻的 `date-fns/light` 子集

## CI 工作流

参见 `.github/workflows/ci.yml`，每次 push / PR 自动跑：

- `pnpm typecheck` — 类型检查
- `pnpm lint` — ESLint
- `pnpm test:coverage` — 覆盖率报告（lcov + HTML，作为 artifact 上传）
- `pnpm build:extension` — 验证扩展产物可构建（dist-extension 体积留档）
