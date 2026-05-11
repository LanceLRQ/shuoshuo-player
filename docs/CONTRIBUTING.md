# 贡献指南（Contributing）

感谢你对**说说播放器 v2** 感兴趣！本文档汇集了开发、调试、构建、测试、提交所需的一切技术细节。开始之前，请先通读本文，并按需展开延伸文档。

> 简体中文 | [English](./CONTRIBUTING.en.md)

---

## 目录

- [一、技术栈](#一技术栈)
- [二、环境要求](#二环境要求)
- [三、仓库结构](#三仓库结构)
- [四、不可逾越的边界（架构红线）](#四不可逾越的边界架构红线)
- [五、开发流程](#五开发流程)
- [六、构建与产物](#六构建与产物)
- [七、测试与覆盖率](#七测试与覆盖率)
- [八、编码规范](#八编码规范)
- [九、提交规范](#九提交规范)
- [十、提交前 CI 自检清单](#十提交前-ci-自检清单)
- [十一、提 PR 注意事项](#十一提-pr-注意事项)
- [十二、危险操作清单](#十二危险操作清单)

---

## 一、技术栈

| 层 | 选型 | 备注 |
|---|---|---|
| 语言 | TypeScript（严格模式） | `strict: true`，禁用 `any` 兜底 |
| UI | React 19 + shadcn/ui + Tailwind CSS + lucide-react | 已弃用 MUI / Emotion |
| 路由 | React Router v7（Hash Router） | 路径 kebab-case，旧路径走 `<Navigate replace>` |
| 状态 | Zustand 5 | 单 root key `player_data` 持久化 + 节流写入 |
| 表单 | React Hook Form + Zod 4 | 校验在 schema 内集中 |
| 音频 | Howler.js | 全 8 回调齐备 |
| HTTP | Axios | **禁用 `1.14.1` 与 `0.30.4`**（供应链投毒） |
| 构建 | Vite 8 + Rollup（manualChunks 拆包） | Web 与 Desktop 共享 web 端构建链 |
| 桌面端 | Tauri v2（Rust） | IPC 命令 + Cookie 持久化 |
| 包管理 | pnpm 10 workspace | `packageManager` 字段已锁定 |
| 测试 | Vitest 4 + Testing Library | 全部 happy-dom 环境 |

## 二、环境要求

| 工具 | 最低版本 | 用途 |
|---|---|---|
| Node.js | ≥ 20 | 推荐 LTS |
| pnpm | ≥ 9 | 实测 10.28.2 |
| Rust 工具链 | latest stable | 仅桌面端开发 / 打包需要（[rustup](https://www.rust-lang.org/tools/install) 安装） |
| Chrome | 100+ | 加载未打包扩展 |
| 系统 | macOS / Windows / Linux | Tauri 跨平台均支持 |

## 三、仓库结构

```
shuoshuo-player/
├── packages/
│   ├── shared/                     跨平台共享层（不依赖任何平台 SDK）
│   │   ├── src/api/                Bilibili + 云服务 API 封装
│   │   ├── src/store/              Zustand store（持久化 + 节流）
│   │   ├── src/types/              全部公共类型
│   │   ├── src/constants/          常量集中
│   │   ├── src/utils/              纯函数工具
│   │   └── src/hooks/              跨平台 hook 占位
│   ├── web/                        Chrome 扩展 + Web 调试
│   │   ├── src/components/         业务组件 + shadcn/ui 二次包装
│   │   ├── src/pages/              路由页面（懒加载）
│   │   ├── src/lib/                平台适配器（chrome.storage / init）
│   │   ├── src/hooks/              web 专用 hook
│   │   ├── src/stores/             web 私有 store（ui-shell 弹窗状态）
│   │   ├── src/background/         Chrome MV3 service worker
│   │   ├── src/assets/             跨包公共图片素材（Tauri 端走 alias 复用）
│   │   ├── public/manifest.json    扩展声明
│   │   └── public/rules.json       4 条静态 DNR 规则
│   └── desktop/                    Tauri v2 桌面端（Rust + 复用 web 前端）
│       └── src-tauri/              Rust 命令（store / auth / spider / audio-proxy）
├── docs/                           公开文档（dev-guide / build-guide / 评估）
├── v1/                             旧版只读参考代码（不参与构建）
└── LICENSE                         MIT License + 项目附加条款
```

延伸阅读：
- [dev-guide.md](./dev-guide.md) — 完整开发指南
- [build-guide.md](./build-guide.md) — 构建与发布指南

## 四、不可逾越的边界（架构红线）

以下条款**不允许**被新代码违反：

1. **MUI / Emotion 不可引入** — 所有新组件用 shadcn/ui + Tailwind
2. **Electron 相关代码不再添加** — 桌面端统一走 Tauri；本地能力写 Tauri command（Rust）+ TypeScript 适配器
3. **CRA / Craco 不再使用** — 所有构建走 Vite
4. **JavaScript 仅出现在 v1/** — v2 工作区全部 `.ts` / `.tsx` / `.rs`
5. **v1 代码只读** — 不主动修改，迁移需显式授权
6. **`packages/shared` 不写平台代码** — 不允许 `import 'chrome'` 或 `@tauri-apps/api`，业务代码只面向 `PlatformBridge` / `StorageAdapter` / `AuthAdapter` / `SpiderAdapter` 接口
7. **Chrome 扩展产物 ≤ 10240 KiB（10 MiB 软警戒线）** — CI 在 PR / tag 时强校验
8. **Axios 黑名单**：`1.14.1` 与 `0.30.4` 禁用（供应链投毒）

## 五、开发流程

```bash
# 1. Fork + 克隆
git clone git@github.com:<your-name>/shuoshuo-player.git
cd shuoshuo-player

# 2. 安装依赖
pnpm install

# 3. 切分支（建议从 dev 切）
git checkout -b feat/your-topic

# 4a. Web / Chrome 扩展开发
pnpm dev:web                  # Vite dev server, 默认 http://localhost:3000
pnpm dev:extension            # 监听式产出扩展，可在 Chrome 中边改边热重载

# 4b. Tauri 桌面端开发
pnpm dev:desktop              # 首次会编译 Rust 依赖, 耗时较长

# 5. 单包过滤（如需）
pnpm --filter @shuoshuo-player/shared typecheck
pnpm --filter @shuoshuo-player/web build
pnpm --filter @shuoshuo-player/desktop tauri build
```

## 六、构建与产物

```bash
pnpm build:extension   # Chrome 扩展 → packages/web/dist-extension/
pnpm build:web         # 静态 Web 站点 → packages/web/dist/
pnpm build:desktop     # Tauri 安装包 → packages/desktop/src-tauri/target/release/bundle/
```

### 加载 Chrome 扩展

1. 运行 `pnpm build:extension`
2. Chrome → 扩展程序 → 打开「开发者模式」
3. 「加载已解压的扩展程序」→ 选择 `packages/web/dist-extension/`

详见 [build-guide.md](./build-guide.md)。

## 七、测试与覆盖率

```bash
pnpm test               # 全部单测（shared + web 并行）
pnpm test:shared        # 仅 shared 包
pnpm test:web           # 仅 web 包
pnpm test:watch         # shared 包 watch 模式
pnpm test:coverage      # 覆盖率报告（合并所有包）
```

**覆盖率门槛**：
- `packages/shared`：lines ≥ 60% / branches ≥ 55%
- 关键路径文件（`lib/` / `api/` / `store/`）：lines ≥ 80%

新增公共逻辑必须配套写测试；修改既有逻辑需保证现有测试不退化。

## 八、编码规范

### 命名

| 对象 | 规则 | 示例 |
|---|---|---|
| 文件 | kebab-case | `fav-card.tsx` / `cloud-service.ts` |
| 组件 | PascalCase | `FavCard` / `SPlayer` |
| Hook | `useXxx` | `useMusicPlayer` |
| Store hook | `useXxxStore` | `useBilibiliUserStore` |
| 常量 | SCREAMING_SNAKE_CASE | `LYRIC_EDITOR_UNDO_STACK_MAX` |
| 类型 / 接口 | PascalCase | `Video` / `LyricSnapshot` |
| 路径别名 | `@/` 当前包 src，`@shared/` packages/shared/src | — |

### TypeScript

- 严格模式（`strict: true`）开启
- 不允许 `any` 兜底，需要时用 `unknown` 或泛型
- 公共类型集中在 `packages/shared/src/types/`，**禁止业务代码重复定义**
- 跨平台共享代码不允许直接 import `chrome` 或 `@tauri-apps/api`

### 注释

- 仅在解释**为什么**（hidden constraints / workaround / 与外部协议对齐）时写
- 不写"做了什么"型注释（清晰的代码即可表达）
- 不写"AI 模型标识"、"Co-Authored-By"、版本号注释
- 注释语言遵循当前文件已有语言（中文文件保持中文注释）

### 静态资源

- **跨平台公共图片**放 `packages/web/src/assets/`，组件用 `import xxx from '@/assets/xxx.png'` 引入
- **禁止**通过 `<img src="/xxx.png">` 引用组件级图片 — Tauri 端无 publicDir 会 404
- Chrome 扩展 manifest 引用的 icon 才放 `packages/web/public/`

## 九、提交规范

遵循 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/)：

| 类型 | 用途 |
|---|---|
| `feat` | 新功能 |
| `fix` | bug 修复 |
| `refactor` | 重构（无功能变化） |
| `perf` | 性能优化 |
| `docs` | 文档变更 |
| `chore` | 构建 / 工具 / 依赖等杂项 |
| `test` | 测试相关 |

格式：`<type>(<scope>): <subject>`，例如：

```
feat(lyric-editor): 加 LRC 源代码编辑入口
fix(audio-proxy): 修复 Tauri 端老视频无法播放
perf(audio-cache): chunk 大小 4MB → 16MB
```

**约束**：
- `git add <file>` 与 `git commit` **分两步执行**（避免 index.lock 冲突）
- **禁止** `--no-verify` / `--no-gpg-sign`
- **禁止** 修改 git config

## 十、提交前 CI 自检清单

> CI 仅在 **PR** 与 **tag (`v*`)** 时触发。请在本地按顺序通过以下命令再提交：

```bash
pnpm install --frozen-lockfile   # 1. 锁文件一致性
pnpm lint                        # 2. ESLint
pnpm typecheck                   # 3. TS 类型检查（递归 -r）
pnpm test:coverage               # 4. 测试 + 覆盖率
pnpm build:extension             # 5. 扩展构建（含体积 ≤ 10240 KiB 校验）
```

扩展体积自检：

```bash
TOTAL_KIB=$(($(find packages/web/dist-extension -type f -print0 | xargs -0 wc -c | tail -1 | awk '{print $1}') / 1024))
echo "Extension: ${TOTAL_KIB} KiB"; [ "$TOTAL_KIB" -le 10240 ] || echo "❌ 超出 10240 KiB 预算"
```

任何一步失败 → 修复后再提交，不得跳过 hook。

## 十一、提 PR 注意事项

- 目标分支：默认 `dev`；放行版本由维护者从 `dev` → `main` 合入
- PR 标题用 Conventional Commits 风格
- PR 描述应包含：
  - **Summary**：核心改动 + 动机
  - **Test plan**：你测过哪些路径（B 站登录 / 收藏夹 / 歌词同步 / Tauri 启动等）
  - **Screenshots**（UI 改动时必须）
- 大改动建议拆分为多个原子 PR
- 涉及公共类型 / API 签名变更需在 PR 中标注影响面

## 十二、危险操作清单

下列操作**必须**在执行前与维护者确认，不得自动执行：

- 删除文件 / 分支 / 数据库表
- `git push --force`（特别是 main / master）
- `git reset --hard` / `git clean -f`
- `rm -rf`
- 跳过 git hook
- 升级 / 替换核心依赖（React / Vite / Tauri / Zustand）
- 清理未提交修改

---

如有疑问，欢迎在 [Issues](https://github.com/LanceLRQ/shuoshuo-player/issues) 提问或参与讨论。
