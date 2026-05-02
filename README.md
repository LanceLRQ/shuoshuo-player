# 说说播放器 v2

> 基于 Bilibili 的第三方音乐播放器 — 把 UP 主投稿、收藏夹、直播切片转换为可循环播放的音频列表。

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## 特性

- 把 UP 主视频投稿当作音乐播放（自定义歌单、UP 主频道、B 站收藏夹）
- 同步歌词显示与编辑（撤销栈深 999、自定义偏移、云端同步）
- 直播切片管理与公开列表
- 亮色 / 暗色 / 自动主题（跟随系统）
- 跨平台：Chrome 扩展（Manifest V3）+ 桌面端（Tauri v2）

## 平台

| 平台 | 入口 | 状态 |
|---|---|---|
| Chrome 浏览器扩展 | `pnpm build:extension` → `packages/web/dist-extension/` | 可用 |
| 桌面端 (macOS / Windows / Linux) | `pnpm build:desktop` → Tauri 安装包 | Phase 6 进行中 |
| Web 调试 | `pnpm dev:web` → `localhost:3000` | 可用 |

## 技术栈

| 层 | 选型 |
|---|---|
| 语言 | TypeScript 6 严格模式 |
| UI | React 19 + shadcn/ui + Tailwind CSS + lucide-react |
| 路由 | React Router v7（Hash Router） |
| 状态 | Zustand 5 |
| 表单 | React Hook Form + Zod 4 |
| 音频 | Howler.js |
| HTTP | Axios |
| 构建 | Vite 8 + Rollup（manualChunks 拆包） |
| 桌面端 | Tauri v2（Rust） |
| 包管理 | pnpm 10 workspace |
| 测试 | Vitest 4 + Testing Library |

## 快速开始

### 环境要求

- Node.js >= 20
- pnpm >= 9
- Rust 工具链（仅桌面端开发需要）

### 安装

```bash
git clone https://github.com/LanceLRQ/shuoshuo-player.git
cd shuoshuo-player
pnpm install
```

### 开发

```bash
pnpm dev:web        # Vite dev server（Chrome 扩展开发推荐）
pnpm dev:desktop    # Tauri 桌面端窗口
```

### 构建

```bash
pnpm build:extension   # Chrome 扩展产物在 packages/web/dist-extension/
pnpm build:web         # 静态 Web 站点产物在 packages/web/dist/
pnpm build:desktop     # Tauri 安装包
```

详见 [docs/build-guide.md](docs/build-guide.md)。

### 加载 Chrome 扩展

1. 运行 `pnpm build:extension`
2. Chrome → 扩展程序 → 打开"开发者模式"
3. "加载已解压的扩展程序" → 选择 `packages/web/dist-extension/`

## 仓库结构

```
shuoshuo-player/
├── packages/
│   ├── shared/    跨平台共享逻辑（API / Store / Types / Utils / Hooks）
│   ├── web/       Chrome 扩展 + Web 调试入口
│   └── desktop/   Tauri v2 桌面端
├── docs/          公开文档
├── v1/            旧版只读参考代码（不参与构建）
└── LICENSE        MIT License + 项目附加条款
```

详见 [docs/dev-guide.md](docs/dev-guide.md)。

## 测试与质量

```bash
pnpm typecheck         # TypeScript 三包类型检查
pnpm lint              # ESLint
pnpm test              # 全部测试（shared 191 + web 71）
pnpm test:coverage     # 覆盖率报告
```

覆盖率目标：
- shared 包：lines ≥60% / branches ≥55%（已达标 61.74% / 57.81%）
- 关键路径文件（lib / api / store）：lines ≥80%

## 声明

本项目仅供学习交流使用，不得用于商业目的。详见 [LICENSE](LICENSE) 与项目附加条款。

数据来源于 Bilibili 公开 API；项目不存储任何用户凭据，所有 Cookie 由浏览器或 Tauri WebView 自身管理。
