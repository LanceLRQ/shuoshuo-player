# Changelog

本文件记录说说播放器 v2 工作区的发布历史。版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)，格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/)。

> 1.x 区间为 **Beta**；2.0+ 起进入稳定版。

## [1.9.2] - 待发布

### 新增

- **悬浮歌词独立开关与样式自定义**：footer 上方的当前歌词条重塑为可配置的"悬浮歌词"模块，与全屏歌词页解耦。
  - 右下角 Music 按钮改为 `Captions` 图标，控制悬浮歌词的显示/隐藏，状态持久化
  - 抽出 `FloatingLyrics` 子组件；配置项扩展至 `PlayerProfile.floatingLyrics` 子对象（8 字段：启用 / 字号 / 字重 / 字体族 / 对齐 / 垂直偏移 / 文字色 / 不透明度）
  - 设置 → 外观新增「悬浮歌词」Card：包含开关、字号 12-32 滑块、字重 / 字体族 / 对齐按钮组、垂直偏移 16-64 px 滑块、4 预设文字色（跟随主色 / 白 / 黑 / 次要文字）、整体不透明度 0-100%、实时预览（复用真组件）、恢复默认
  - 持久化老用户兼容：`ui_profile` hydrate 时 spread `DEFAULT_FLOATING_LYRICS` 兜底，缺字段不会崩
- **多 P 投稿分 P 选择器支持多选加歌单**：可一次性把多个 P 加入歌单；多 P 条目在播放队列 / 歌单中的显示与写入语义统一
- **B 站投稿分 P 支持**：多 P 视频可选择具体分 P 播放，UI 提供 P 选择器 Popover；持久化用户上次选的 P
- **「我的收藏」系统级歌单**：左下角收藏按钮可一键加入；左侧栏 UI 重排
- **VideoItem 交互升级**：双击 / 封面单击直接播放，右侧按钮改为收藏占位（解决误触播放问题）

### 变更

- 左下角播放器封面成为**唯一**全屏歌词入口；hover 时显示 `Expand` 图标 + 50% 黑色蒙层提示
- 悬浮歌词定位改用 `bottom: 100% + transform: translateY(-Npx)` 二段定位，规避 grid + overflow 嵌套场景下 `calc(100% + Npx)` 可能失效的问题

### 修复

- 修复快速切歌时旧曲目 `Howl` 实例未及时 unload 导致的**双音频并发播放**竞态
- 收藏夹歌单页若干显示问题；`FavCard` 体验优化

### 内部

- 持久化注册表 `STORE_PERSIST_REGISTRY` 中 `ui_profile` hydrate 升级为显式合并 default，避免新增字段对老数据的破坏
- 新增 `floating-lyrics.test.tsx`、补强 `player-profile.test.ts` / `persist.test.ts` / `appearance.test.tsx` 用例覆盖
- 测试规模：shared 431 + web 489 + desktop 73 = **993 用例**全过；Chrome 扩展产物 1339 KiB（10240 预算的 13%）

## [1.9.1] - 2026-05-11

### 新增

- **启动检查更新 + 顶部通知 + 设置页「关于」**：客户端启动时拉取最新版本信息，发现新版在 TopBar 显示通知；设置页「关于」展示版本号、更新通道、镜像链接、协议与项目简介
- **跨平台 HTTP 抽象 `PlatformBridge.http`**：shared 包新增版本比较工具 + update API；Chrome 扩展 / Tauri / Web 三端各自实现 http adapter 与权限声明
- **关于页布局优化**：Chrome 扩展专属商店入口；项目简介、协议与开发者链接
- **Windows portable 版**（v1.9.1 Windows）：单文件可执行 + 哨兵触发 + 数据同目录 + 静态 CRT 编译；正式 portable 支持 `--debug` 运行时开启 DevTools；新增 `build:portable:dev` 调试包（DevTools 自启 + 控制台日志可见）
- **网络故障兜底**：`fetchMusicUrl` 增加重试机制、错误分类、跨平台文件日志

### 变更

- `scripts/deploy.sh` 重命名为 `scripts/release.sh`，避开 pnpm 内置 `pnpm deploy` 子命令冲突
- `build:portable` 改用 Tauri v2 的 `--no-bundle`（旧 `--bundles none` 在 v2 已被 msi/nsis 强校验阻断）
- README 镜像 URL 提示拆为「指定版本」与「latest」两种结构；安装区块新增国内镜像入口

### 修复

- 修复 Windows WebView2 音频代理：改用 http 映射而非自定义 URI scheme（自定义 scheme 在 WebView2 下被拦截）
- 修复播放栏滚动、弹窗溢出、banner 切换三处 UI 缺陷

### CI / 发版

- 一键发版脚本：交互式输入版本 → `pnpm version:sync` 同步 7 处 → 提交 + tag + push → 触发 release.yml
- `publish-release` job 生成 `version.json`（update-checker 客户端拉取的 manifest）+ README 一行说明
- 移除 Linux 桌面端矩阵，桌面端产物仅出 **macOS ARM64** + **Windows x64**

## [1.9.0] - 2026-05-09

> v2 重构后首个 Beta 发布版本（标签 `v1.9.0-rc.1`），1.x 区间整体为 Beta 通道。

### 新增

- **「水晶蟹小屋」云服务模块**：原 cloud-services 更名为水晶蟹小屋，登录入口下沉到模块着陆页；着陆页视觉与交互打磨
- **B 站退出登录功能**：恢复 v1 中的退出登录交互；Tauri 端 WebView Cookie 残留问题修复
- **数据导入导出升级**：导出加 `version` 标识；导入支持版本识别、v1 迁移、三态合并（skip / replace / merge）
- **搜索发现页能力扩展**：批量选择 → 复选框模式批量入歌单；搜索结果改用分页器并放开硬上限到 B 站官方 1000 条 / 50 页；显示 UP 主图标并新增排序下拉
- **歌单卡片头像差异化**：自定义歌单 → 首张视频封面 + 首字渐变兜底；B 站收藏夹歌单头像也走相同兜底；UPLOADER 类型同步
- **收藏夹编辑对话框对齐 v1**：类型置顶；BILI_FAV 类型可下拉选择收藏夹列表；自动命名
- **Chrome 扩展加白 mountaintoys.cn**：支持音乐合作伙伴版权曲播放
- **顶栏与导入对话框显示 Beta 徽章**：明示 1.x 为 Beta 通道
- **全平台图标更换**：macOS Dock 显示中文名「说说播放器」

### 变更

- 顶栏导出改为统一走 `objectToDownload` 跨平台路由；移除下拉菜单中的主题模式区块（已迁移到设置页）
- 导入对话框合并模式收紧为 `skip / replace` + UI 紧凑化
- README 重构 + 新增 CONTRIBUTING（中英双语）；特性文案改为用户视角表述

### 修复

- 修复 Tauri 端老视频无法播放：content-type 规范化 + CORS 头补全 + 音质降级 fallback
- 修复 mountaintoys.cn 第三方源接入 Tauri 代理（端口剥离）
- 修复自定义歌单导入后显示为空：把 `bili_videos` 纳入导入并按 union 模式合并
- 修复 UPLOADER / BILI_FAV 顶部播放按钮永远 disabled；按钮改 outline 视觉
- 修复 `bili-user-videos` 重入：store action 入口加 `isLoading` 防重入
- 修复播放队列列表项截断、清空按钮重叠等若干视觉缺陷
- 修复 desktop `__DEV_LOG__` 按 vite mode 切换（恢复 dev 模式调试日志可见性）

### 性能

- 切歌冷启动延迟减少 1-2 秒（`fetchMusicUrl` 链路重排）
- 音频代理 chunk 大小 4 MB → 16 MB，覆盖 5 分钟内主流码率单 chunk 命中
- 音频缓存加密 AES-128-CBC → **ChaCha20**：dev 模式下 chunk 解码从 ~1 s 降到 ~10 ms
- 未缓存歌曲首块响应延迟降低 ~60 ms

### 内部 / CI

- 引入**版本单源同步**：根 `package.json` 为单源，`pnpm version:sync` 同步到 7 处（manifest / Cargo.toml / tauri.conf.json 等）
- 扩展打包脚本规范化：产物体积上限 10240 KiB
- 拆分 `ci.yml`：PR 跑 lint/typecheck/test，tag 触发 Release 流程

## 历史版本

更早版本（v1.8.x 及之前）仅在 GitHub Releases 中记录，未维护本文件。
