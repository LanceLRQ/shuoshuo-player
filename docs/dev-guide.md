# 开发指南

## 环境要求

| 工具 | 版本 | 备注 |
|---|---|---|
| Node.js | ≥ 20 | LTS 推荐 |
| pnpm | ≥ 9 | 仓库使用 pnpm 10 workspace |
| Rust | stable | 仅桌面端（Tauri）开发需要，[安装指南](https://www.rust-lang.org/tools/install) |
| 系统 | macOS / Windows / Linux | Tauri 桌面端跨平台均支持 |

## 仓库结构

```
shuoshuo-player/
├── packages/
│   ├── shared/                     跨平台共享层
│   │   ├── src/api/                Bilibili + 云服务 API 封装
│   │   ├── src/store/              Zustand store（持久化 + 节流）
│   │   ├── src/types/              全部公共类型
│   │   ├── src/constants/          常量集中（ERROR_CODES / 阈值 / 默认值）
│   │   ├── src/utils/              纯函数工具
│   │   └── src/hooks/              跨平台 hook 占位
│   ├── web/                        Chrome 扩展 + Web 调试
│   │   ├── src/components/         业务组件 + shadcn/ui 二次包装
│   │   ├── src/pages/              路由页面（懒加载）
│   │   ├── src/lib/                平台适配器（chrome.storage / init）
│   │   ├── src/hooks/              web 专用 hook（useMusicPlayer 等）
│   │   ├── src/stores/             web 私有 store（ui-shell 弹窗状态）
│   │   ├── src/background/         Chrome MV3 service worker
│   │   ├── public/manifest.json    扩展声明
│   │   └── public/rules.json       4 条静态 DNR 规则
│   └── desktop/                    Tauri v2 桌面端（Rust + 前端复用 web）
├── docs/                           公开文档
├── v1/                             旧版参考代码（只读）
└── LICENSE                         MIT
```

## 启动开发

### Web / Chrome 扩展

```bash
pnpm install              # 首次或依赖变化后
pnpm dev:web              # 默认 http://localhost:3000
```

`pnpm dev:web` 启动 Vite dev server，自动热更新。Chrome 扩展功能（如 chrome.storage / DNR 规则）需要打包后加载扩展才能验证（详见 docs/build-guide.md §加载 Chrome 扩展）。

### Tauri 桌面端

```bash
pnpm dev:desktop          # 启动 Tauri 桌面窗口（Rust 编译 ~ 30s 首次）
```

首次启动会下载 Rust 依赖并编译 native binary，后续增量编译较快。

## 关键约束

> 这些约束在 `CLAUDE.md` 与 `plans/` 中也有详细说明，开发时务必遵守。

- **MUI / Emotion 不可引入**：v2 已弃用 MUI，所有新组件用 shadcn/ui + Tailwind
- **Electron 相关代码不再添加**：桌面端统一走 Tauri
- **JavaScript 仅出现在 v1/**：v2 工作区文件全部 `.ts` / `.tsx` / `.rs`
- **v1 代码只读**：v1 中的任何文件除非显式被要求迁移，否则不修改
- **业务代码面向接口**：不直接调用 `chrome.*` 或 `@tauri-apps/api`，走 `PlatformBridge` 抽象
- **共享层不写平台代码**：`packages/shared` 不允许 import `chrome` 或 `@tauri-apps/api`
- **Axios 版本黑名单**：禁用 `axios@1.14.1` 与 `axios@0.30.4`（供应链投毒）

## 常用命令

| 命令 | 作用 |
|---|---|
| `pnpm install` | 安装所有依赖（含 workspace） |
| `pnpm dev:web` | Vite dev server |
| `pnpm dev:desktop` | Tauri 桌面端 |
| `pnpm typecheck` | 三包 TypeScript 检查 |
| `pnpm lint` | ESLint |
| `pnpm format` | Prettier 格式化 |
| `pnpm test` | 全部单测（shared + web 并行） |
| `pnpm test:coverage` | 覆盖率报告（HTML + lcov） |
| `pnpm test:shared` | 仅 shared 包测试 |
| `pnpm test:web` | 仅 web 包测试 |
| `pnpm --filter <pkg> <cmd>` | 在指定包下执行命令 |

## 调试技巧

### Vite dev server

- 路由懒加载：每个页面单独 chunk，首次访问会延迟加载
- 控制台输出：开启 `localStorage.debug = '*'` 查看 zustand 状态变更（如已配置）

### Chrome 扩展

- `chrome://extensions` 打开开发者模式，"重新加载扩展程序"刷新代码变更
- `chrome://net-internals` 可验证 4 条 DNR 规则是否生效
- `chrome.storage.local` 可在 popup DevTools → Application 标签页查看
- service worker（background.js）日志：扩展页面 → 检查视图：service worker

### Tauri 桌面端

- 主窗口右键 → 检查元素，与浏览器 DevTools 完全一致
- Rust 端日志：`println!` 出现在终端 `pnpm dev:desktop` 输出
- Cookie 存储：`tauri-plugin-store` 写入 `bilibili_cookies.json`，路径见各平台 app data dir

## 状态管理与持久化

- 持久化 root key：`player_data`（chrome.storage.local 或 Tauri store）
- 节流写入：`PERSIST_THROTTLE_MS = 1000ms`，trailing throttle
- 持久化白名单：`PERSIST_KEYS = [bili_user_videos, bili_videos, playing_list, fav_list, ui_profile, lyrics, cloud_service]`
- 含 `isLoading` / 临时态的 store 必须实现 `persistSnapshot()` 钩子
- 云服务 baseURL：独立 storage key `cloud_api_base_url`（早于云服务调用恢复）

## 测试约定

| 项 | 约定 |
|---|---|
| 文件命名 | `*.test.ts` / `*.test.tsx`，与被测文件同目录 |
| Mock 实现 | `packages/shared/src/__mocks__/`（按需添加） |
| 异步默认 | 使用 `vi.useFakeTimers()` 控制节流相关用例 |
| 网络隔离 | 禁止真实 axios 出网，使用 `vi.spyOn` 或 `vi.mock` |
| Howler mock | 用 `vi.hoisted` + `function` 关键字（`new Howl()` 需要 constructor 形态） |

详见 `plans/phase-7-testing-optimization.md` §7.0（私有文档，仅本地查阅）。

## 提交规范

- Conventional Commits：`feat: …` / `fix: …` / `refactor: …` / `test: …` / `perf: …` / `docs: …` / `chore: …`
- 不在没有用户明确要求时执行 `git commit` / `git push`
- 不使用 `--no-verify` / `--no-gpg-sign`
- `git add` 与 `git commit` 分两步执行（避免 index.lock 冲突）
