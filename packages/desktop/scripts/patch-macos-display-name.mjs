#!/usr/bin/env node
/**
 * macOS 打包后 Info.plist 注入 CFBundleDisplayName
 *
 * 背景：tauri.conf.json 的 productName 同时影响 .app 文件名 与 Dock/Finder 显示名。
 * 我们希望 .app 文件名保持英文（shuoshuo-player.app），但 Dock 鼠标悬停 / 启动台 /
 * 应用菜单 / Finder 显示中文「说说播放器」。
 *
 * macOS Info.plist 优先级（实际显示名）：CFBundleDisplayName > CFBundleName > 文件名。
 * Tauri v2 bundle 配置未暴露 CFBundleDisplayName，这里通过 plutil 在打包后注入。
 *
 * 注：dev 模式（cargo run）没有 .app 包，Dock 显示的是 binary 名（shuoshuo-player）—
 * 这是 macOS 行为限制，无法绕过。仅打包产物 (.app/.dmg) 受本脚本影响。
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DISPLAY_NAME = '说说播放器';

if (process.platform !== 'darwin') {
  // 非 macOS（Windows/Linux）打包路径不走 Info.plist，直接跳过
  process.exit(0);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE_DIR = join(__dirname, '../src-tauri/target/release/bundle/macos');

if (!existsSync(BUNDLE_DIR)) {
  console.warn(`[patch-macos-display-name] bundle dir not found, skip: ${BUNDLE_DIR}`);
  process.exit(0);
}

const apps = readdirSync(BUNDLE_DIR).filter((name) => name.endsWith('.app'));
if (apps.length === 0) {
  console.warn('[patch-macos-display-name] no .app under bundle dir, skip');
  process.exit(0);
}

let failed = 0;
for (const app of apps) {
  const plist = join(BUNDLE_DIR, app, 'Contents/Info.plist');
  if (!existsSync(plist)) {
    console.warn(`[patch-macos-display-name] Info.plist missing for ${app}, skip`);
    continue;
  }
  const r = spawnSync(
    'plutil',
    ['-replace', 'CFBundleDisplayName', '-string', DISPLAY_NAME, plist],
    { stdio: 'inherit' },
  );
  if (r.status !== 0) {
    console.error(`[patch-macos-display-name] plutil failed for ${app} (status=${r.status})`);
    failed += 1;
    continue;
  }
  console.log(
    `[patch-macos-display-name] ✅ ${app} → CFBundleDisplayName=${DISPLAY_NAME}`,
  );
}

if (failed > 0) process.exit(1);
