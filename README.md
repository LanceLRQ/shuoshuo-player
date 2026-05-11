# 说说播放器

> 简体中文 | [English](./README.en.md)

[![Release](https://img.shields.io/github/v/release/LanceLRQ/shuoshuo-player?include_prereleases&label=release&color=brightgreen)](https://github.com/LanceLRQ/shuoshuo-player/releases) [![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

“说说播放器”是一款基于 Bilibili 的第三方音乐播放器。此播放器为粉丝定制版本，可以将说宝或者其他 Up 主的 B 站视频投稿变成你的歌单。

"Shuoshuo Player" is a third-party music player based on Bilibili. This player is a customized version for fans, allowing you to turn "说说 Crystal" or other Bilibili creators' video submissions into your playlist.

![预览图](./docs/player_thumb.webp)

## 特性（Features）

- ✅ 拉取 UP 主投稿生成歌单
- ✅ 支持将直播切片 man 的视频列表生成歌单
- ✅ 支持以收藏夹生成歌单
- ✅ 支持歌词同步显示（支持手动创建）
- ✅ 支持数据导入导出
- ✅ 跨平台桌面应用（macOS / Windows / Linux），由 Tauri 提供
- ✅ 全新 UI 重构 + 粉色主题 + 亮 / 暗 / 自动模式（带亮度补偿）
- ✅ 自定义歌单：UP 主投稿、收藏夹、直播切片自由组合到一个歌单，重复的歌曲自动去重
- ✅ 更好用的歌词编辑器：边看原歌词边改、历史版本随时回退
- ☐ 更多功能请期待

## 安装

[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-%E5%AE%89%E8%A3%85-4285F4?logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/%E8%AF%B4%E8%AF%B4%E6%92%AD%E6%94%BE%E5%99%A8-%E6%B0%B4%E6%99%B6%E8%9F%B9%E5%AE%9A%E5%88%B6%E7%89%88/odfgnejgeebbccohpgjdmbklaoicndpb)

Chrome 浏览器扩展可直接从应用商店一键安装：[说说播放器（水晶蟹定制版）](https://chromewebstore.google.com/detail/%E8%AF%B4%E8%AF%B4%E6%92%AD%E6%94%BE%E5%99%A8-%E6%B0%B4%E6%99%B6%E8%9F%B9%E5%AE%9A%E5%88%B6%E7%89%88/odfgnejgeebbccohpgjdmbklaoicndpb)。

桌面端（macOS / Windows）请在 [GitHub Releases](https://github.com/LanceLRQ/shuoshuo-player/releases) 下载对应安装包。

> 当前版本处于 **1.x Beta 通道**，使用前请阅读下方 [1.x Beta 通道（预发布）](#1x-beta-通道预发布) 的注意事项。

## 1.x Beta 通道（预发布）

**当前版本属于 1.x Beta 通道**：2.0 正式版前的预发布阶段，可能存在已知缺陷。

### 发布形态

- **Chrome 扩展**：优先走 Web Store（自动更新）；Linux / Intel Mac 用户也用扩展兜底
- **桌面端**：仅提供 **macOS（Apple Silicon）** 与 **Windows x64**，可在 [GitHub Releases](https://github.com/LanceLRQ/shuoshuo-player/releases) 下载；**Beta 阶段未签名**，首次启动需要：
    - macOS：右键 .app → 打开 → 弹窗中再次点击"打开"
    - Windows：SmartScreen 拦截 → 更多信息 → 仍要运行
- **Windows Portable 版（实验性）**：除 `.exe / .msi` 安装包外，自 1.9.1 起额外提供 `*-portable-x64.zip`，解压即用、数据存放在程序同目录的 `data/` 文件夹。**注意事项**：
    - 请勿放到 `C:\Program Files\` 等系统受保护目录（无写入权限）
    - 首次启动若系统未装 WebView2 Runtime 仍会引导联网安装
    - B 站登录态由 WebView2 管理在系统目录，**复制到另一台电脑后需重新扫码登录**
    - portable 模式不支持自动更新，请手动到 Releases 下载新版本
    - 删除 `portable.txt` 即恢复为普通版行为；**正式使用仍推荐安装包版本**

### 镜像与更新

- **国内访问 GitHub 慢**：可用镜像下载安装包，与 GitHub Releases 字节一致（自带 `.sha256` 可校验），由 Cloudflare CDN 分发。地址结构：
    - 指定版本：`https://download.hutao.wiki/shuoshuo-player/releases/download/v<版本号>/<文件名>`
    - 最新版便利路径：`https://download.hutao.wiki/shuoshuo-player/releases/latest/download/<文件名>`
- **更新检查**：应用启动后会在 6 小时内自动检查一次新版本，发现后通过非阻断通知提示，可在「设置 → 关于」手动触发检查

## 快速开始

```bash
git clone https://github.com/LanceLRQ/shuoshuo-player.git
cd shuoshuo-player
pnpm install
pnpm dev:web        # Web / Chrome 扩展开发
pnpm dev:desktop    # Tauri 桌面端开发（需 Rust 工具链）
```

完整的开发、构建、测试、规范、提交流程详见 **[docs/CONTRIBUTING.md](./docs/CONTRIBUTING.md)** 与 [docs/dev-guide.md](docs/dev-guide.md) / [docs/build-guide.md](docs/build-guide.md)。

## 贡献

欢迎提 Issue / PR ！动手前请阅读 **[贡献指南 docs/CONTRIBUTING.md](./docs/CONTRIBUTING.md)**，其中包含：

- 技术栈与版本约束
- Monorepo 结构说明
- 不可逾越的架构红线
- 开发 / 构建 / 测试命令清单
- 编码与提交规范、CI 自检清单

## 技术支持

感谢以下开源项目：

- [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/) — 构建工具
- [Tauri](https://tauri.app/) — 跨平台桌面端框架
- [shadcn/ui](https://ui.shadcn.com/) + [Tailwind CSS](https://tailwindcss.com/) + [lucide-react](https://lucide.dev/) — UI 体系
- [Howler.js](https://howlerjs.com/) — 音频引擎
- [Zustand](https://zustand-demo.pmnd.rs/) — 状态管理
- [React Router](https://reactrouter.com/) — 路由
- [Axios](https://axios-http.com/) — HTTP 客户端
- [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/) — 表单与校验
- [Vitest](https://vitest.dev/) + [Testing Library](https://testing-library.com/) — 测试
- [pnpm](https://pnpm.io/) — workspace 包管理
- [Azusa-Player (NoxPlayer)](https://github.com/lovegaoshi/NoxPlayer) — 参考实现


## 隐私安全声明

云服务功能只用于我们提供播放器的一些公共服务（如 UP 主投稿的自动显示歌词、切片 man 信息展示）。

为了保护用户隐私，**我们不会收集任何个人信息，所有 B 站登录信息、视频数据均存储在本地。**

播放器的**歌单、播放功能均是模拟用户访问 B 站**，我们也不会在云端收集任何 B 站的视频信息。

播放器、云服务端均完全开源免费，仅供学习交流使用，**禁止将播放器用于任何商业用途，否则后果自负。**

## 项目协议

本项目基于 [MIT License](LICENSE) 许可证发行，以下协议是对于 MIT License 的补充，如有冲突，以以下协议为准。

词语约定：本协议中的"本项目"指 `shuoshuo-player` 项目；"使用者"指签署本协议的使用者；"官方音乐平台"指本项目内置的官方平台统称，包括哔哩哔哩动画（音源）、QQ 音乐（歌词搜索来源）等；"版权数据"指包括但不限于图像、音频、名字等在内的他人拥有所属版权的数据。

本项目的数据来源原理是从各官方音乐平台的公开服务器中拉取数据，经过对数据简单地筛选与合并后进行展示，因此本项目不对数据的准确性负责。

使用本项目的过程中可能会产生版权数据，对于这些版权数据，本项目不拥有它们的所有权，为了避免造成侵权，使用者务必在 24 小时内清除使用本项目的过程中所产生的版权数据。

本项目内的官方音乐平台别名为本项目内对官方音乐平台的一个称呼，不包含恶意，如果官方音乐平台觉得不妥，可联系本项目更改或移除。

本项目内使用的部分包括但不限于字体、图片等资源来源于互联网，如果出现侵权可联系本项目移除。

由于使用本项目产生的包括由于本协议或由于使用或无法使用本项目而引起的任何性质的任何直接、间接、特殊、偶然或结果性损害（包括但不限于因商誉损失、停工、计算机故障或故障引起的损害赔偿，或任何及所有其他商业损害或损失）由使用者负责。

本项目完全免费，且开源发布于 GitHub 面向全世界人用作对技术的学习交流，本项目不对项目内的技术可能存在违反当地法律法规的行为作保证，禁止在违反当地法律法规的情况下使用本项目，对于使用者在明知或不知当地法律法规不允许的情况下使用本项目所造成的任何违法违规行为由使用者承担，本项目不承担由此造成的任何直接、间接、特殊、偶然或结果性责任。

若你使用了本项目，将代表你接受以上协议。

音乐视频平台不易，请尊重版权，支持正版。
