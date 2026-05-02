# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目定位

**说说播放器（Shuoshuo Player）** 是一款基于 Bilibili 的第三方音乐播放器，将 UP 主的视频投稿、收藏夹、直播切片转换为音频播放列表。当前仓库正在进行 **v2 重构**：

- `v1/`：旧版只读参考代码，**禁止直接修改**。本堂主可以读取 v1 实现作为对照，但所有新增代码必须落在 v2 工作区
- `packages/`（v2 工作区）：基于 pnpm Monorepo 的 React + TypeScript + Tauri 实现
  - `packages/shared/`：跨平台共享逻辑（API、Store、Types、Utils、Hooks）
  - `packages/web/`：Chrome 扩展 (Manifest V3) + Web 调试入口
  - `packages/desktop/`：Tauri v2 桌面端
- `docs/`：用户文档与开发指南（项目根级，可入 git）
- `LICENSE`：MIT License + 项目附加条款

仓库根目录 `package.json` 即 v2 工作区根，v1 不参与 v2 构建，仅做架构对照。

## v2 技术栈与边界

### 技术栈

| 层 | 选型 |
|---|---|
| 语言 | TypeScript（严格模式） |
| UI | React 18 + shadcn/ui + Tailwind CSS + lucide-react |
| 路由 | React Router v6 (Hash Router) |
| 状态 | Zustand（保留持久化中间件） |
| 表单 | React Hook Form + Zod |
| 音频 | Howler.js |
| HTTP | Axios |
| 构建 | Vite |
| 桌面端 | Tauri v2（Rust） |
| 包管理 | pnpm workspace |

### 不可逾越的边界

1. **MUI / Emotion 不可引入**：v2 已弃用 MUI，所有新组件必须使用 shadcn/ui + Tailwind
2. **Electron 相关代码不再添加**：桌面端统一走 Tauri；如需调用本地能力，写 Tauri command（Rust）+ TypeScript 适配器
3. **CRA / Craco 不再使用**：所有构建走 Vite
4. **JavaScript 仅出现在 v1/**：v2 工作区文件全部 `.ts` / `.tsx` / `.rs`
5. **v1 代码只读**：v1 中的任何文件除非被显式要求迁移否则不修改
6. **响应式分包**：Chrome 扩展产物体积控制 < 1MB，Tauri 桌面端 < 10MB

## 仓库与开发命令

> v2 工作区初始化后下列命令生效；初始化前仅 `v1/` 目录可执行旧版命令。

### 根级（v2 Monorepo）

```bash
pnpm install                    # 安装所有依赖
pnpm dev:web                    # Web/Chrome 扩展开发模式（Vite dev）
pnpm dev:desktop                # Tauri 桌面端开发模式
pnpm build:web                  # Web 端构建
pnpm build:extension            # Chrome 扩展打包到 dist-extension/
pnpm build:desktop              # Tauri 桌面端打包
pnpm lint                       # ESLint 检查 packages/*/src
pnpm format                     # Prettier 格式化
```

### 包级别

```bash
pnpm --filter @shuoshuo-player/shared typecheck       # 仅检查 shared 类型
pnpm --filter @shuoshuo-player/web build              # 单独构建 web 包
pnpm --filter @shuoshuo-player/desktop tauri build    # 单独构建桌面端
```

### Chrome 扩展加载

1. `pnpm build:extension` → 产物在 `packages/web/dist-extension/`
2. Chrome → 扩展程序 → 开发者模式 → 加载已解压的扩展程序 → 选 `dist-extension/`

### v1 旧版（仅参考用，不日常运行）

旧版项目位于 `v1/shuoshuo-player`、`v1/shuoshuo-player-pc`、`v1/cloud-services`，依赖 `yarn` + CRA。**v2 开发禁止依赖 v1 任何脚本或产物**。

## 架构关键约束

### 平台桥接（Platform Bridge）

`packages/shared` 通过抽象接口（`StorageAdapter` / `AuthAdapter` / `SpiderAdapter`）暴露平台能力；具体实现由各平台包提供：

- `packages/web/src/lib/`：Chrome 扩展实现（chrome.storage / Cookie 由浏览器自动管理）
- `packages/desktop/src/lib/`：Tauri 实现（IPC 调用 Rust commands）

**业务代码只面向接口，不直接调用 `chrome.*` 或 `@tauri-apps/api`**。

### 状态管理与持久化

- 持久化 root key：`player_data`，统一节流写入（PERSIST_THROTTLE_MS 默认 1000ms）
- 持久化 store 列表通过 `PERSIST_KEYS` 常量声明
- 任何含 `isLoading` / 临时态的 store 都需提供 `persistSnapshot()` 钩子在持久化前清理瞬态字段
- 云服务 API baseURL 持久化 key：`cloud_api_base_url`（独立于 player_data，启动时早于任何云服务调用读取）

### 云服务 API 对接

后端为 **`shuoshuo-crystal/backend`**（Go + GORM + PostgreSQL，**与 v1 的 cloud-services 不兼容**）：

- 默认 baseURL：`https://shuoshuo.sikong.ren/api`，可被用户在前端"服务设置"页覆盖；空值 fallback 默认值
- 响应统一格式：`{ code: 0, data, message? }` 成功，`{ code: 4xxxxxxx, message, type?, payload? }` 错误（**不再有 `errno` 字段**）
- 鉴权：`Authorization: Bearer <token>`；密码修改后旧 token 通过 `session_key` 自动失效
- 角色枚举：`User=1`、`Admin=512`、`WebMaster=1024`，权限判定走位与运算 `(role & mask) === mask`
- 歌词管理改为 **数字 ID 寻址**（`POST /lyric/manage/:id`，`:id` 传字面量 `'new'` 表示创建）；上传字段名为 `content` 而非 v1 的 `lyric`
- 直播切片 `mid` 是 **字符串**（支持超大 UID）

### B 站 API 与 WBI 签名

- 所有 WBI 加密请求统一走 `buildBilibiliApiCall({ useWbi: true })`，**禁止手写签名逻辑**
- WBI 密钥在 `useBilibiliUserStore.getLoginUserInfo()` 时从 `nav` 接口的 `wbi_img` 提取并通过 `setWbiInfo()` 注入
- 长时间运行（> 30 分钟）需触发刷新：Chrome 扩展走 `chrome.alarms`，桌面端走前端 `setInterval`

### 路由

Hash Router，路径用短横线（`/live-slicers` / `/cloud-services`）。v1 旧路径（下划线）通过 `<Navigate replace>` 自动重定向到新路径，添加新路由时同步保留兼容项。

## 代码规范与约定

### 命名

- 文件：kebab-case（`fav-card.tsx` / `cloud-service.ts`）
- 组件：PascalCase（`FavCard`、`SPlayer`）
- Hook：`useXxx`；Store hook：`useXxxStore`
- 常量：SCREAMING_SNAKE_CASE
- 类型/接口：PascalCase；泛型 `T` / `TItem`
- 路径别名：`@/` 指向当前包 `src/`，`@shared/` 指向 `packages/shared/src/`

### TypeScript

- 严格模式开启（`strict: true`），不允许 `any` 兜底（必要时用 `unknown` 或泛型）
- 公共类型集中在 `packages/shared/src/types/`，**不允许在业务代码中重复定义**
- 跨平台共享代码不允许直接 import `chrome` 或 `@tauri-apps/api`

### 注释

- 仅在解释**为什么**（hidden constraints / workaround / 与外部协议对齐）时写注释
- 不写"做了什么"型注释（识别清晰的代码即可表达）
- 不写"AI 模型标识"、"Co-Authored-By"、版本号注释
- 注释语言遵循当前文件已有语言（中文文件保持中文注释）

### 提交

- 不在没有用户明确要求时执行 `git commit` / `git push`
- 不使用 `--no-verify` / `--no-gpg-sign`
- 不修改 git config
- `git add <file>` 与 `git commit` 分两步执行（避免 index.lock 冲突）
- 提交信息遵循 conventional commits 风格（feat / fix / refactor / docs / chore）

### 危险动作前必须停下来确认

- 删除文件 / 分支 / 数据库表
- 强制推送（特别是 main / master）
- 跳过 hook
- `rm -rf` / `git reset --hard`
- 清理未提交修改

## 工作流核心原则

1. **复杂任务先输出任务分级**：`简单 / 中等 / 复杂` 三档，依据修改的文件数与新增方法数判定（详见用户全局规则 `~/.claude/CLAUDE.md`）
2. **新任务独立评估复杂度**：禁止沿用上一任务的复杂度结论
3. **代码诊断**（LSP）：修改 TypeScript / Rust 代码后必须运行；Error 必修，Warning 评估
4. **代码简化审查**：中等以上任务交付前需审查冗余、重复、过度抽象
5. **临时文件清理**：交付前移除 `console.log` / `dd()` / 调试代码
6. **影响范围检测**：修改公共类型、常量、API 签名时，需排查所有引用点
