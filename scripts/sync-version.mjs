#!/usr/bin/env node
/**
 * 版本号单源同步脚本
 *
 * 权威源：根 package.json 的 version 字段
 * 同步目标（5 处）：
 *   1. packages/shared/package.json    → version
 *   2. packages/web/package.json       → version
 *   3. packages/desktop/package.json   → version
 *   4. packages/web/public/manifest.json → version（Chrome MV3 manifest，仅接受 1-4 段数字）
 *   5. packages/desktop/src-tauri/tauri.conf.json → version
 *   6. packages/desktop/src-tauri/Cargo.toml → [package].version（正则替换）
 *
 * 模式：
 *   node scripts/sync-version.mjs           # 写入：将所有目标改成根版本
 *   node scripts/sync-version.mjs --check   # 校验：所有目标必须等于根版本，不一致 exit 1
 *
 * 设计要点：
 *   - JSON 文件保留原缩进与末尾换行，避免引入无意义 diff
 *   - Cargo.toml 仅替换 [package] 段下首个 `version = "..."`，避免误伤 dependencies 段
 *   - manifest.json 版本若含 SemVer 预发布段（如 1.9.0-beta.1）会主动拒绝并提示
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const ROOT_PKG = join(ROOT, 'package.json');

const JSON_TARGETS = [
  { path: join(ROOT, 'packages/shared/package.json'), key: 'version' },
  { path: join(ROOT, 'packages/web/package.json'), key: 'version' },
  { path: join(ROOT, 'packages/desktop/package.json'), key: 'version' },
  { path: join(ROOT, 'packages/web/public/manifest.json'), key: 'version' },
  { path: join(ROOT, 'packages/desktop/src-tauri/tauri.conf.json'), key: 'version' },
];

const CARGO_TOML = join(ROOT, 'packages/desktop/src-tauri/Cargo.toml');
const CARGO_LOCK = join(ROOT, 'packages/desktop/src-tauri/Cargo.lock');

const isCheckMode = process.argv.includes('--check');

const CHROME_MANIFEST_VERSION = /^\d+(\.\d+){0,3}$/;

/**
 * 读取根版本号
 */
function readRootVersion() {
  const pkg = JSON.parse(readFileSync(ROOT_PKG, 'utf-8'));
  if (typeof pkg.version !== 'string') {
    throw new Error(`root package.json missing string "version"`);
  }
  return pkg.version;
}

/**
 * 探测 JSON 文件原本的缩进字符（默认 2 空格）
 */
function detectIndent(raw) {
  const m = raw.match(/^[\{\[]\n([ \t]+)/);
  return m?.[1] ?? '  ';
}

/**
 * 同步 / 校验 JSON 文件
 */
function processJson(target, expected, mode) {
  const raw = readFileSync(target.path, 'utf-8');
  const obj = JSON.parse(raw);
  const current = obj[target.key];
  if (current === expected) return { changed: false };

  if (mode === 'check') {
    return {
      changed: false,
      mismatch: { path: target.path, key: target.key, current, expected },
    };
  }

  const indent = detectIndent(raw);
  const trailingNewline = raw.endsWith('\n');
  obj[target.key] = expected;
  let next = JSON.stringify(obj, null, indent);
  if (trailingNewline) next += '\n';
  writeFileSync(target.path, next);
  return { changed: true, before: current, after: expected };
}

/**
 * 同步 / 校验 Cargo.toml 的 [package] 段 version
 */
function processCargo(expected, mode) {
  const raw = readFileSync(CARGO_TOML, 'utf-8');
  // 仅在 [package] 段（文件首段）内替换 version = "..."，避免误伤 dependencies / build-dependencies 段
  const startIdx = raw.indexOf('[package]');
  if (startIdx === -1) {
    throw new Error(`Cargo.toml missing [package] section: ${CARGO_TOML}`);
  }
  // 下一个 section 头：行首 `[`，从 [package] 之后开始找
  const afterHeader = startIdx + '[package]'.length;
  const remainder = raw.slice(afterHeader);
  const nextSectionRel = remainder.search(/\n\[/);
  const endIdx = nextSectionRel === -1 ? raw.length : afterHeader + nextSectionRel;
  const section = raw.slice(startIdx, endIdx);
  const versionMatch = section.match(/^version\s*=\s*"([^"]*)"/m);
  if (!versionMatch) {
    throw new Error(`Cargo.toml [package] section missing version field`);
  }
  const current = versionMatch[1];
  if (current === expected) return { changed: false };

  if (mode === 'check') {
    return {
      changed: false,
      mismatch: { path: CARGO_TOML, key: '[package].version', current, expected },
    };
  }

  const newSection = section.replace(
    /^version\s*=\s*"[^"]*"/m,
    `version = "${expected}"`,
  );
  const next = raw.slice(0, startIdx) + newSection + raw.slice(endIdx);
  writeFileSync(CARGO_TOML, next);
  return { changed: true, before: current, after: expected };
}

/**
 * 同步 / 校验 Cargo.lock 中 shuoshuo-player crate 的 version
 *
 * Cargo.lock 中每个 crate 形如：
 *   [[package]]
 *   name = "shuoshuo-player"
 *   version = "1.9.0"
 *   ...
 * 严格匹配 name 紧邻的 version 行，避免改到其他 crate
 */
function processCargoLock(expected, mode) {
  if (!existsSync(CARGO_LOCK)) {
    // 首次构建前 Cargo.lock 可能不存在，跳过
    return { changed: false };
  }
  const raw = readFileSync(CARGO_LOCK, 'utf-8');
  // 匹配 name = "shuoshuo-player"\nversion = "..."
  const re = /(name\s*=\s*"shuoshuo-player"\s*\nversion\s*=\s*")([^"]*)(")/;
  const m = raw.match(re);
  if (!m) {
    // 仓库内未生成 shuoshuo-player crate 条目，跳过（极少见）
    return { changed: false };
  }
  const current = m[2];
  if (current === expected) return { changed: false };

  if (mode === 'check') {
    return {
      changed: false,
      mismatch: { path: CARGO_LOCK, key: 'shuoshuo-player.version', current, expected },
    };
  }
  const next = raw.replace(re, `$1${expected}$3`);
  writeFileSync(CARGO_LOCK, next);
  return { changed: true, before: current, after: expected };
}

function rel(p) {
  return relative(ROOT, p);
}

function main() {
  const expected = readRootVersion();

  // Chrome 扩展 manifest version 仅支持 1-4 段数字，预发布段（-beta.1）会被 Chrome Web Store 拒绝
  if (!CHROME_MANIFEST_VERSION.test(expected)) {
    console.error(
      `❌ 根 package.json version="${expected}" 不符合 Chrome MV3 manifest 规范（仅 1-4 段数字）`,
    );
    console.error(`   如需预发布通道，请使用 1.9.0 / 1.9.1 / 1.9.0.1 等纯数字格式`);
    process.exit(1);
  }

  const mode = isCheckMode ? 'check' : 'write';
  const mismatches = [];
  const changes = [];

  for (const target of JSON_TARGETS) {
    const r = processJson(target, expected, mode);
    if (r.mismatch) mismatches.push(r.mismatch);
    if (r.changed) changes.push({ path: target.path, before: r.before, after: r.after });
  }

  const cargoR = processCargo(expected, mode);
  if (cargoR.mismatch) mismatches.push(cargoR.mismatch);
  if (cargoR.changed) changes.push({ path: CARGO_TOML, before: cargoR.before, after: cargoR.after });

  const lockR = processCargoLock(expected, mode);
  if (lockR.mismatch) mismatches.push(lockR.mismatch);
  if (lockR.changed) changes.push({ path: CARGO_LOCK, before: lockR.before, after: lockR.after });

  if (mode === 'check') {
    if (mismatches.length === 0) {
      const totalChecked = JSON_TARGETS.length + 1 + (existsSync(CARGO_LOCK) ? 1 : 0);
      console.log(`✅ 版本号一致（${expected}），共 ${totalChecked} 个目标全部对齐`);
      process.exit(0);
    }
    console.error(`❌ 版本号不一致：根版本 = ${expected}，但以下文件偏离：`);
    for (const m of mismatches) {
      console.error(`   - ${rel(m.path)} (${m.key}) = "${m.current}"，期望 "${m.expected}"`);
    }
    console.error(`\n修复方式：运行 \`pnpm version:sync\` 自动同步`);
    process.exit(1);
  }

  if (changes.length === 0) {
    console.log(`✅ 所有目标已与根版本（${expected}）保持一致，无需写入`);
    return;
  }

  console.log(`✅ 已同步根版本 ${expected} 到 ${changes.length} 个文件：`);
  for (const c of changes) {
    console.log(`   - ${rel(c.path)}: ${c.before} → ${c.after}`);
  }
  console.log(`\n提示：记得 \`git add\` 这些文件后一并提交`);
}

main();
