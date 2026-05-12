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

## [1.9.1] - 2026-05-10

详见 GitHub Releases：<https://github.com/LanceLRQ/shuoshuo-player/releases/tag/v1.9.1>

## 历史版本

更早版本仅在 GitHub Releases 中记录，未维护本文件。
