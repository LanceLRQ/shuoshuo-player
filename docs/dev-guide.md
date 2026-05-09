# 开发深度参考（Dev Deep-Dive）

> 本文是 [CONTRIBUTING.md](./CONTRIBUTING.md) 的补充。基础环境、仓库结构、命令清单、规范、CI 自检请先看贡献指南；本文聚焦在**只在实战中才会踩到**的调试技巧、持久化机制、测试约定。

---

## 调试技巧

### Vite dev server

- 路由懒加载：每个页面独立 chunk，首次访问会延迟下载，可结合 DevTools → Network → JS 过滤观察
- 控制台输出：可通过 `localStorage.debug = '*'` 打开 zustand 状态变更日志（如运行时已挂载）

### Chrome 扩展

- `chrome://extensions` 开发者模式 → 「重新加载扩展程序」刷新代码改动
- `chrome://net-internals/#events` 可验证 4 条 DNR 规则是否生效（观察 `bilivideo.com` / `akamaized.net` 请求头改写）
- `chrome.storage.local` 内容：popup → DevTools → Application 标签页查看
- service worker（`background.js`）日志：`chrome://extensions` → 当前扩展 → 「检查视图：service worker」

### Tauri 桌面端

- 主窗口右键 →「检查元素」打开 DevTools，体验与 Chrome 一致
- Rust 端日志：`println!` / `tracing` 输出到 `pnpm dev:desktop` 终端
- Cookie 存储：`tauri-plugin-store` 写入 `bilibili_cookies.json`，路径取决于平台 app data dir
  - macOS: `~/Library/Application Support/<bundle-id>/`
  - Windows: `%APPDATA%/<bundle-id>/`
  - Linux: `~/.local/share/<bundle-id>/`

---

## 状态管理与持久化

> 完整设计权衡详见 [persistence-blob-evaluation.md](./persistence-blob-evaluation.md)。

| 项 | 取值 / 约定 |
|---|---|
| 持久化 root key | `player_data`（写入 `chrome.storage.local` 或 Tauri store） |
| 节流策略 | `PERSIST_THROTTLE_MS = 1000ms`，trailing throttle |
| 持久化白名单 | `bili_user_videos` / `bili_videos` / `playing_list` / `fav_list` / `ui_profile` / `lyrics` / `cloud_service` |
| 临时态清理 | 含 `isLoading` 等瞬态字段的 store **必须**实现 `persistSnapshot()` 钩子 |
| 云服务 baseURL | 独立 storage key `cloud_api_base_url`，启动时早于任何云服务调用恢复 |
| Tauri Store key 白名单 | 仅 `player_data` 与 `cloud_api_base_url` 允许，其他 key 在 Rust 端被拒绝 |

新增持久化字段时，记得：
1. 在 `PERSIST_KEYS` 常量中追加
2. 评估是否需要 `persistSnapshot()` 屏蔽瞬态字段
3. 评估单条数据规模：参考 `persistence-blob-evaluation.md` 中的阈值表

---

## 测试约定

| 项 | 约定 |
|---|---|
| 文件命名 | `*.test.ts` / `*.test.tsx`，与被测文件同目录 |
| Mock 实现 | `packages/shared/src/__mocks__/` 下按需添加 |
| 异步 / 节流 | 使用 `vi.useFakeTimers()` 控制节流相关用例（`PERSIST_THROTTLE_MS` 等） |
| 网络隔离 | 禁止真实 axios 出网，使用 `vi.spyOn` 或 `vi.mock` 拦截 |
| Howler mock | 用 `vi.hoisted` + `function` 关键字（`new Howl()` 需要 constructor 形态） |
| WBI 签名测试 | 不直接 mock `crypto.subtle`，调用真实 `buildBilibiliApiCall({ useWbi: true })` 验证 query 中的 `w_rid` 与 `wts` |
| 持久化测试 | hydrate / persist 双向覆盖；瞬态字段必须验证清理 |

执行命令清单见 [CONTRIBUTING.md §7](./CONTRIBUTING.md#七测试与覆盖率)。

---

## 平台桥接（Platform Bridge）

`packages/shared` 通过抽象接口暴露平台能力，业务代码**只面向接口**：

| 接口 | 职责 | Web 实现 | Tauri 实现 |
|---|---|---|---|
| `StorageAdapter` | KV 持久化 | `chrome.storage.local` | `tauri-plugin-store` |
| `AuthAdapter` | B 站登录、Cookie 管理 | 浏览器自带 | Tauri 命令 + 持久化 Cookie |
| `SpiderAdapter` | 跨域抓取（如 QQ 音乐歌词搜索） | 内容脚本 / DNR 改写 | Rust HTTP 客户端 |

新增平台能力的步骤：
1. 在 `packages/shared/src/types/` 定义接口
2. 业务代码通过 `getPlatformBridge()` 取实例
3. `packages/web/src/lib/` 与 `packages/desktop/src/lib/` 各写一份实现
4. 测试以 mock adapter 覆盖

---

## 路由约定

- Hash Router（`#/path`），路径用短横线（`/live-slicers` / `/cloud-services`）
- v1 旧路径（下划线）通过 `<Navigate replace>` 自动重定向到新路径
- 新增路由时同步保留兼容项，保证用户书签 / 浏览器历史不失效

---

## 静态资源约定

| 路径 | 用途 | 引用方式 | 跨平台 |
|---|---|---|---|
| `packages/web/public/` | Chrome 扩展 manifest 引用的 icon / 需要绝对 URL 的运行期资源 | 绝对路径 `/foo.png`（Vite publicDir 复制到产物） | ❌ Tauri 端无 publicDir，会 404 |
| `packages/web/src/assets/` | **跨包公共图片素材**（组件内嵌图片 / 图标） | `import xxx from '@/assets/xxx.png'` | ✅ Web / 扩展 / Tauri 通用 |
| `packages/desktop/src-tauri/icons/` | Tauri dock / 任务栏 / 安装包图标 | 仅 `tauri.conf.json` 引用，不进 webview | ❌ 仅打包用 |

**新增跨平台图片**统一放 `packages/web/src/assets/` 并通过 ES import 引入。**禁止**用 `<img src="/xxx.png">` 引用组件级图片。
