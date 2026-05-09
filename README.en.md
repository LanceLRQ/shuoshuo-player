# Shuoshuo Player

> [简体中文](./README.md) | English

[![Version](https://img.shields.io/badge/version-2.0.0-brightgreen.svg)](./package.json) [![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

"Shuoshuo Player" is a third-party music player based on Bilibili. This player is a customized version for fans, allowing you to turn "说说 Crystal" or other Bilibili creators' video submissions into your playlist.

![Preview](./docs/player_thumb.webp)

## Features

- ✅ Build playlists from a creator's video uploads
- ✅ Build playlists from a live-slicer man's video list
- ✅ Build playlists from Bilibili favorite folders
- ✅ Lyric sync display (manual creation supported)
- ✅ Data import / export
- ✅ Cross-platform desktop app (macOS / Windows / Linux) powered by Tauri
- ✅ Brand-new UI + pink accent + light / dark / auto theme with brightness compensation
- ✅ Custom playlists — mix uploads / favorites / live slices, with per-video deduplication
- ✅ Lyric editor revamp — side-by-side diff, LRC source-code edit, history snapshots, undo stack of 999
- ☐ More to come

## Install

[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-Install-4285F4?logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/%E8%AF%B4%E8%AF%B4%E6%92%AD%E6%94%BE%E5%99%A8-%E6%B0%B4%E6%99%B6%E8%9F%B9%E5%AE%9A%E5%88%B6%E7%89%88/odfgnejgeebbccohpgjdmbklaoicndpb)

Install the Chrome extension directly from the Web Store: [Shuoshuo Player (Crystal Edition)](https://chromewebstore.google.com/detail/%E8%AF%B4%E8%AF%B4%E6%92%AD%E6%94%BE%E5%99%A8-%E6%B0%B4%E6%99%B6%E8%9F%B9%E5%AE%9A%E5%88%B6%E7%89%88/odfgnejgeebbccohpgjdmbklaoicndpb).

## Quick Start

```bash
git clone https://github.com/LanceLRQ/shuoshuo-player.git
cd shuoshuo-player
pnpm install
pnpm dev:web        # Web / Chrome extension dev
pnpm dev:desktop    # Tauri desktop dev (requires Rust toolchain)
```

For the full workflow — development, building, testing, conventions and contribution — see **[docs/CONTRIBUTING.en.md](./docs/CONTRIBUTING.en.md)** and the docs under `docs/`.

## Contributing

Issues and PRs are welcome! Before you start, please read **[docs/CONTRIBUTING.en.md](./docs/CONTRIBUTING.en.md)**, which covers:

- Tech stack & version constraints
- Monorepo layout
- Architectural red-lines that must NOT be crossed
- Development / build / test commands
- Coding & commit conventions, plus the local CI self-check checklist

## Tech Credits

Thanks to the following open-source projects:

- [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/) — build tool
- [Tauri](https://tauri.app/) — cross-platform desktop framework
- [shadcn/ui](https://ui.shadcn.com/) + [Tailwind CSS](https://tailwindcss.com/) + [lucide-react](https://lucide.dev/) — UI system
- [Howler.js](https://howlerjs.com/) — audio engine
- [Zustand](https://zustand-demo.pmnd.rs/) — state management
- [React Router](https://reactrouter.com/) — routing
- [Axios](https://axios-http.com/) — HTTP client
- [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/) — forms & validation
- [Vitest](https://vitest.dev/) + [Testing Library](https://testing-library.com/) — testing
- [pnpm](https://pnpm.io/) — workspace package manager
- [Azusa-Player (NoxPlayer)](https://github.com/lovegaoshi/NoxPlayer) — reference implementation


## Privacy Statement

The cloud service exists only to provide some public services for the player (e.g. automatic lyric display for a creator's uploads, live-slicer man profile display).

To protect user privacy, **we collect no personal information; all Bilibili login info and video data are stored locally.**

The player's **playlist and playback features simulate a user visiting Bilibili**, and we do not collect any Bilibili video information on the cloud side either.

Both the player and the cloud service are fully open-source and free, **for educational and non-commercial use only. Any commercial use is forbidden and at the user's own risk.**

## Project Terms

This project is released under the [MIT License](LICENSE). The following terms supplement the MIT License; in case of conflict, the terms below prevail.

> The Chinese version in [README.md](./README.md#项目协议) is the authoritative text; this English translation is provided for convenience only.

**Definitions** — In this agreement, "this project" refers to the `shuoshuo-player` project; "user" refers to the signatory of this agreement; "official music platform" refers to the collective name of the official platforms built into this project, including Bilibili (audio source) and QQ Music (lyric search source); "copyrighted data" refers to images, audio, names and any other data whose ownership belongs to others.

The data used by this project is fetched from the public servers of those official music platforms, then filtered and merged for display. This project does not guarantee the accuracy of such data.

Copyrighted data may be produced while using this project. The user does not own such data and must clear it within 24 hours of use to avoid infringement.

The aliases used inside this project for the official music platforms carry no malicious intent. If a platform finds them inappropriate, contact us to update or remove them.

Some assets used in this project (fonts, images, etc.) come from the Internet. If any of them infringe upon your rights, contact us to remove them.

The user assumes any direct, indirect, special, incidental or consequential damages (including loss of goodwill, work stoppage, computer failure or any commercial loss) arising from this agreement or the use / inability to use this project.

This project is fully free and open-sourced on GitHub for technical exchange worldwide. We do not warrant that the technologies herein comply with all local laws and regulations. Using this project in violation of local laws is forbidden, and the user bears full responsibility for any resulting illegal acts.

By using this project, you accept the terms above.

Music & video platforms work hard — please respect copyright and support the originals.
