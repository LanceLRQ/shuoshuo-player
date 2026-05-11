# Contributing Guide

Thank you for your interest in **Shuoshuo Player v2**! This document gathers everything technical you need for development, debugging, building, testing and submitting PRs. Please read through it before you start.

> [简体中文](./CONTRIBUTING.md) | English

---

## Table of Contents

- [1. Tech Stack](#1-tech-stack)
- [2. Requirements](#2-requirements)
- [3. Repository Layout](#3-repository-layout)
- [4. Architectural Red-lines (must NOT cross)](#4-architectural-red-lines-must-not-cross)
- [5. Development Workflow](#5-development-workflow)
- [6. Building](#6-building)
- [7. Tests & Coverage](#7-tests--coverage)
- [8. Coding Conventions](#8-coding-conventions)
- [9. Commit Conventions](#9-commit-conventions)
- [10. Pre-commit CI Self-check](#10-pre-commit-ci-self-check)
- [11. Pull Request Notes](#11-pull-request-notes)
- [12. Dangerous Operations](#12-dangerous-operations)

---

## 1. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Language | TypeScript (strict mode) | `strict: true`, no `any` fallback |
| UI | React 19 + shadcn/ui + Tailwind CSS + lucide-react | MUI / Emotion are deprecated |
| Routing | React Router v7 (Hash Router) | kebab-case paths; legacy paths via `<Navigate replace>` |
| State | Zustand 5 | Single root key `player_data` persisted with throttled writes |
| Forms | React Hook Form + Zod 4 | Validation lives inside the schema |
| Audio | Howler.js | All 8 callbacks wired |
| HTTP | Axios | **`1.14.1` and `0.30.4` are banned** (supply-chain attack) |
| Bundler | Vite 8 + Rollup (`manualChunks` splitting) | Web & Desktop share the web build pipeline |
| Desktop | Tauri v2 (Rust) | IPC commands + Cookie persistence |
| Package manager | pnpm 10 workspace | Locked via the `packageManager` field |
| Testing | Vitest 4 + Testing Library | happy-dom environment |

## 2. Requirements

| Tool | Minimum | Purpose |
|---|---|---|
| Node.js | ≥ 20 | LTS recommended |
| pnpm | ≥ 9 | Tested with 10.28.2 |
| Rust toolchain | latest stable | Desktop dev / build only ([rustup](https://www.rust-lang.org/tools/install)) |
| Chrome | 100+ | Loading unpacked extension |
| OS | macOS / Windows / Linux | Tauri supports all three |

## 3. Repository Layout

```
shuoshuo-player/
├── packages/
│   ├── shared/                     Cross-platform layer (no platform SDK imports)
│   │   ├── src/api/                Bilibili + cloud API wrappers
│   │   ├── src/store/              Zustand stores (persistence + throttle)
│   │   ├── src/types/              All public types
│   │   ├── src/constants/          Centralized constants
│   │   ├── src/utils/              Pure utility functions
│   │   └── src/hooks/              Cross-platform hook stubs
│   ├── web/                        Chrome extension + Web debug
│   │   ├── src/components/         Business components + shadcn/ui wrappers
│   │   ├── src/pages/              Routed pages (lazy-loaded)
│   │   ├── src/lib/                Platform adapters (chrome.storage / init)
│   │   ├── src/hooks/              Web-only hooks
│   │   ├── src/stores/             Web-private store (UI shell dialogs)
│   │   ├── src/background/         Chrome MV3 service worker
│   │   ├── src/assets/             Cross-package shared images (Tauri reuses via alias)
│   │   ├── public/manifest.json    Extension manifest
│   │   └── public/rules.json       4 static DNR rules
│   └── desktop/                    Tauri v2 desktop (Rust + reuses web frontend)
│       └── src-tauri/              Rust commands (store / auth / spider / audio-proxy)
├── docs/                           Public docs (dev-guide / build-guide / evaluations)
├── v1/                             Legacy read-only reference (not part of build)
└── LICENSE                         MIT License + project addendum
```

Further reading:
- [dev-guide.md](./dev-guide.md) — full development guide
- [build-guide.md](./build-guide.md) — build & release guide

## 4. Architectural Red-lines (must NOT cross)

The following rules **must not** be violated by new code:

1. **No MUI / Emotion** — all new components use shadcn/ui + Tailwind
2. **No Electron** — desktop goes through Tauri only; native capabilities → Tauri command (Rust) + TypeScript adapter
3. **No CRA / Craco** — all builds go through Vite
4. **JavaScript only lives under `v1/`** — v2 workspace is `.ts` / `.tsx` / `.rs` only
5. **`v1/` is read-only** — do not modify unless explicitly migrating
6. **`packages/shared` does NOT import platform SDKs** — no `chrome` / `@tauri-apps/api`; business code targets `PlatformBridge` / `StorageAdapter` / `AuthAdapter` / `SpiderAdapter`
7. **Chrome extension bundle ≤ 10240 KiB (10 MiB soft warning)** — enforced by CI on PRs / tags
8. **Axios blacklist**: `1.14.1` and `0.30.4` (supply-chain attack)

## 5. Development Workflow

```bash
# 1. Fork + clone
git clone git@github.com:<your-name>/shuoshuo-player.git
cd shuoshuo-player

# 2. Install
pnpm install

# 3. Branch (recommended off `dev`)
git checkout -b feat/your-topic

# 4a. Web / Chrome extension dev
pnpm dev:web                  # Vite dev server, default http://localhost:3000
pnpm dev:extension            # Watch-mode extension build for hot reload

# 4b. Tauri desktop dev
pnpm dev:desktop              # First run compiles Rust deps (slow)

# 5. Per-package commands
pnpm --filter @shuoshuo-player/shared typecheck
pnpm --filter @shuoshuo-player/web build
pnpm --filter @shuoshuo-player/desktop tauri build
```

## 6. Building

```bash
pnpm build:extension   # Chrome extension → packages/web/dist-extension/
pnpm build:web         # Static web site → packages/web/dist/
pnpm build:desktop     # Tauri installer → packages/desktop/src-tauri/target/release/bundle/
```

### Loading the Chrome extension

1. Run `pnpm build:extension`
2. Chrome → Extensions → enable **Developer mode**
3. **Load unpacked** → select `packages/web/dist-extension/`

See [build-guide.md](./build-guide.md) for details.

## 7. Tests & Coverage

```bash
pnpm test               # All unit tests (shared + web in parallel)
pnpm test:shared        # shared only
pnpm test:web           # web only
pnpm test:watch         # shared in watch mode
pnpm test:coverage      # Coverage report (merged across packages)
```

**Coverage thresholds**:
- `packages/shared`: lines ≥ 60% / branches ≥ 55%
- Critical-path files (`lib/` / `api/` / `store/`): lines ≥ 80%

New shared logic must come with tests; existing logic changes must not regress test quality.

## 8. Coding Conventions

### Naming

| Target | Rule | Example |
|---|---|---|
| Files | kebab-case | `fav-card.tsx` / `cloud-service.ts` |
| Components | PascalCase | `FavCard` / `SPlayer` |
| Hooks | `useXxx` | `useMusicPlayer` |
| Store hooks | `useXxxStore` | `useBilibiliUserStore` |
| Constants | SCREAMING_SNAKE_CASE | `LYRIC_EDITOR_UNDO_STACK_MAX` |
| Types / Interfaces | PascalCase | `Video` / `LyricSnapshot` |
| Path alias | `@/` → current package src; `@shared/` → packages/shared/src | — |

### TypeScript

- Strict mode (`strict: true`) is on
- No `any` fallback — use `unknown` or generics
- Public types live in `packages/shared/src/types/`; **never** redefine them in business code
- Cross-platform code must not directly import `chrome` or `@tauri-apps/api`

### Comments

- Only when explaining **why** (hidden constraints / workarounds / external protocol alignment)
- No "what it does" comments — clear code already conveys that
- No "AI model identifier", `Co-Authored-By` or version-tag comments
- Comment language follows the existing language of the file (Chinese files keep Chinese comments)

### Static Assets

- **Cross-platform shared images** go to `packages/web/src/assets/`, imported via `import xxx from '@/assets/xxx.png'`
- **Do NOT** reference component-level images via `<img src="/xxx.png">` — Tauri has no publicDir and will 404
- Only icons referenced from the Chrome extension manifest belong in `packages/web/public/`

## 9. Commit Conventions

Follow [Conventional Commits](https://www.conventionalcommits.org/):

| Type | Use |
|---|---|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Refactor (no behavior change) |
| `perf` | Performance |
| `docs` | Documentation |
| `chore` | Build / tooling / deps |
| `test` | Tests |

Format: `<type>(<scope>): <subject>`, e.g.

```
feat(lyric-editor): add LRC source-code edit entry
fix(audio-proxy): fix legacy videos failing to play on Tauri
perf(audio-cache): chunk size 4MB → 16MB
```

**Constraints**:
- Run `git add <file>` and `git commit` **as separate steps** (avoid `index.lock` collisions)
- **No** `--no-verify` / `--no-gpg-sign`
- **Do not** modify git config

## 10. Pre-commit CI Self-check

> CI runs only on **PR** and **tag (`v*`)**. Before pushing, please pass these locally in order:

```bash
pnpm install --frozen-lockfile   # 1. Lockfile consistency
pnpm lint                        # 2. ESLint
pnpm typecheck                   # 3. TS typecheck (-r recursive)
pnpm test:coverage               # 4. Tests + coverage
pnpm build:extension             # 5. Extension build (incl. ≤ 10240 KiB size check)
```

Extension size sanity check:

```bash
TOTAL_KIB=$(($(find packages/web/dist-extension -type f -print0 | xargs -0 wc -c | tail -1 | awk '{print $1}') / 1024))
echo "Extension: ${TOTAL_KIB} KiB"; [ "$TOTAL_KIB" -le 10240 ] || echo "❌ Exceeds 10240 KiB budget"
```

If any step fails, fix the root cause before committing — do **not** skip hooks.

## 11. Pull Request Notes

- Default target branch: `dev`; releases are merged from `dev` → `main` by maintainers
- Title follows Conventional Commits style
- PR description should include:
  - **Summary** — core changes & motivation
  - **Test plan** — paths you tested (Bilibili login / favorites / lyric sync / Tauri startup, etc.)
  - **Screenshots** — required for UI changes
- Prefer multiple atomic PRs over one large PR
- Public type / API signature changes must call out the impact in the PR description

## 12. Dangerous Operations

The following must be **confirmed with maintainers** before execution — never automate:

- Deleting files / branches / database tables
- `git push --force` (especially on main / master)
- `git reset --hard` / `git clean -f`
- `rm -rf`
- Skipping git hooks
- Upgrading / replacing core dependencies (React / Vite / Tauri / Zustand)
- Discarding uncommitted changes

---

Questions? Feel free to open an [Issue](https://github.com/LanceLRQ/shuoshuo-player/issues) or join the discussion.
