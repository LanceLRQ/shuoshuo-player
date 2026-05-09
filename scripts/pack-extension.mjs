#!/usr/bin/env node
/**
 * Chrome 扩展 zip 打包脚本（Web Store 上传用）
 *
 * 流程：
 *   1. 校验 packages/web/dist-extension/ 已生成（先跑 pnpm build:extension）
 *   2. 校验 manifest.json 中 version 与根 package.json 一致（防止漏跑 version:sync）
 *   3. 用系统 zip 命令把 dist-extension 整个目录打成
 *      release/shuoshuo-player-extension-v<version>.zip
 *   4. 同步生成 .sha256 校验文件，方便商店审核留痕
 *
 * 设计要点：
 *   - 用系统 zip 而非 Node 库：CI（ubuntu/macos）与开发机（macos）默认带 zip，避免新增依赖
 *   - cwd=dist-extension：zip 内部不带 dist-extension/ 前缀，符合 Chrome Web Store 解压要求
 *   - 失败 fail-fast：任何一步出错都 exit 1，由 CI 接住
 */
import { spawnSync } from 'node:child_process';
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const ROOT_PKG = join(ROOT, 'package.json');
const DIST = join(ROOT, 'packages/web/dist-extension');
const MANIFEST = join(DIST, 'manifest.json');
const RELEASE_DIR = join(ROOT, 'release');

function rel(p) {
  return relative(ROOT, p);
}

function fail(msg) {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

function readJson(p) {
  return JSON.parse(readFileSync(p, 'utf-8'));
}

async function sha256File(p) {
  return await new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(p);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

async function main() {
  const rootVersion = readJson(ROOT_PKG).version;
  if (typeof rootVersion !== 'string') fail('root package.json 缺失 string version 字段');

  if (!existsSync(DIST)) {
    fail(`扩展产物目录不存在：${rel(DIST)}\n请先运行 \`pnpm build:extension\``);
  }
  if (!existsSync(MANIFEST)) {
    fail(`manifest.json 不存在：${rel(MANIFEST)}`);
  }

  const manifestVersion = readJson(MANIFEST).version;
  if (manifestVersion !== rootVersion) {
    fail(
      `manifest.json version="${manifestVersion}" 与根 package.json version="${rootVersion}" 不一致\n` +
        `请先运行 \`pnpm version:sync\` 后重新 \`pnpm build:extension\``,
    );
  }

  // zip 命令检查
  const which = spawnSync('which', ['zip']);
  if (which.status !== 0) {
    fail('系统 zip 命令不可用，请安装 zip 后重试（macOS/Linux 默认自带；Windows 请用 WSL/Git Bash）');
  }

  if (!existsSync(RELEASE_DIR)) {
    mkdirSync(RELEASE_DIR, { recursive: true });
  }

  const zipName = `shuoshuo-player-extension-v${rootVersion}.zip`;
  const zipPath = join(RELEASE_DIR, zipName);

  // 已存在则先删，避免 zip 默认追加导致体积膨胀
  if (existsSync(zipPath)) rmSync(zipPath);

  // -r 递归 / -X 不写跨平台时的扩展属性 / "." 表示打包当前目录全部内容（不带顶层目录前缀）
  const zipResult = spawnSync('zip', ['-r', '-X', zipPath, '.'], {
    cwd: DIST,
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  if (zipResult.status !== 0) fail(`zip 打包失败（exit=${zipResult.status}）`);

  const size = statSync(zipPath).size;
  const sizeKiB = Math.round(size / 1024);
  // 软警戒线 10 MiB（与 ci.yml dist-extension 软警戒一致）
  if (sizeKiB > 10240) {
    console.warn(`⚠️  zip 体积 ${sizeKiB} KiB 超出 10240 KiB 软警戒线`);
  }

  const hash = await sha256File(zipPath);
  const shaPath = `${zipPath}.sha256`;
  writeFileSync(shaPath, `${hash}  ${zipName}\n`);

  console.log(`✅ 扩展 zip 打包完成`);
  console.log(`   文件：${rel(zipPath)} (${sizeKiB} KiB)`);
  console.log(`   sha256：${rel(shaPath)}`);
  console.log(`   ${hash}`);
  console.log(`\n上传 Chrome Web Store 后台即可：${zipName}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
