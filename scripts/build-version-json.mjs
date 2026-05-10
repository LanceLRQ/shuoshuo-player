#!/usr/bin/env node
/**
 * 生成 release/version.json，作为 update-checker 的镜像端点 manifest
 *
 * 由 .github/workflows/release.yml 在 publish-release job 中调用，
 * 输出的 version.json 会随其他 release asset 一起上传到 GitHub Release，
 * 并通过 download.hutao.wiki 的镜像反代供客户端拉取。
 *
 * 数据源：
 *   - version：根 package.json 的 version 字段
 *   - tag：环境变量 GITHUB_REF_NAME（CI 中即 push 的 tag 名）
 *   - commit：环境变量 GITHUB_SHA 的前 7 位
 *   - pub_date：当前时间（CI 跑的瞬间）
 *
 * 本地测试：
 *   GITHUB_REF_NAME=v1.9.1 GITHUB_SHA=abc1234deadbeef pnpm build:version-json
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const ROOT_PKG = join(ROOT, 'package.json');
const RELEASE_DIR = join(ROOT, 'release');
const OUTPUT = join(RELEASE_DIR, 'version.json');

const REPO = 'LanceLRQ/shuoshuo-player';

function rel(p) {
  return relative(ROOT, p);
}

function fail(msg) {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

function main() {
  const pkg = JSON.parse(readFileSync(ROOT_PKG, 'utf-8'));
  const version = pkg.version;
  if (typeof version !== 'string') fail('root package.json 缺失 version 字段');

  // CI 中 GITHUB_REF_NAME 即 tag（如 v1.9.1）；本地测试需要手动 export
  const tag = process.env.GITHUB_REF_NAME || `v${version}`;
  const sha = (process.env.GITHUB_SHA || '').slice(0, 7);

  // 通道派生：1.x → beta，2.x+ → stable
  const channel = /^1\./.test(version) ? 'beta' : 'stable';

  const releaseUrl = `https://github.com/${REPO}/releases/tag/${tag}`;
  const mirrorUrl = `https://download.hutao.wiki/shuoshuo-player/releases/tag/${tag}`;

  const manifest = {
    version,
    tag,
    channel,
    pub_date: new Date().toISOString(),
    commit: sha,
    release_url: releaseUrl,
    mirror_url: mirrorUrl,
    notes_url: releaseUrl,
  };

  if (!existsSync(RELEASE_DIR)) {
    mkdirSync(RELEASE_DIR, { recursive: true });
  }

  writeFileSync(OUTPUT, JSON.stringify(manifest, null, 2) + '\n');

  console.log(`✅ 生成 ${rel(OUTPUT)}`);
  console.log(JSON.stringify(manifest, null, 2));
}

main();
