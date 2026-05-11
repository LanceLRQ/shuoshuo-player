// Windows-only portable 打包脚本
//
// 前置：tauri build --no-bundle 已产出 src-tauri/target/release/shuoshuo-player.exe
//
// 步骤：
// 1. 准备 staging/shuoshuo-player-{version}-portable-x64/
// 2. 拷 exe + 创建 portable.txt（空文件）+ 创建空 data/ + 写 README-PORTABLE.txt
// 3. zip 打包 → packages/desktop/release/shuoshuo-player-{version}-portable-x64.zip
// 4. 输出 .sha256 校验
//
// 跨平台备注：
// - 默认仅 Windows 执行；非 Windows 平台直接 skip（由 CI 矩阵驱动）
// - 设置 PORTABLE_PACK_FORCE=1 可在非 Windows 上跑（验证脚本逻辑）；此时若 exe 不存在则报错
import { execSync } from 'node:child_process';
import {
  mkdirSync,
  writeFileSync,
  copyFileSync,
  rmSync,
  statSync,
  readFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

if (process.platform !== 'win32' && !process.env.PORTABLE_PACK_FORCE) {
  console.log(
    '[pack-portable] skipped (non-Windows; set PORTABLE_PACK_FORCE=1 to override)',
  );
  process.exit(0);
}

const __dirname = resolve(fileURLToPath(import.meta.url), '..');
const desktopRoot = resolve(__dirname, '..');
const tauriRoot = join(desktopRoot, 'src-tauri');
const pkg = JSON.parse(
  readFileSync(join(desktopRoot, 'package.json'), 'utf8'),
);
const version = pkg.version;

const exeName = 'shuoshuo-player.exe';
const exePath = join(tauriRoot, 'target', 'release', exeName);
if (!statSync(exePath, { throwIfNoEntry: false })?.isFile()) {
  console.error(`[pack-portable] missing exe: ${exePath}`);
  console.error('[pack-portable] run "tauri build --no-bundle" first');
  process.exit(1);
}

const stageName = `shuoshuo-player-${version}-portable-x64`;
const releaseDir = join(desktopRoot, 'release');
const stageDir = join(releaseDir, stageName);
rmSync(stageDir, { recursive: true, force: true });
mkdirSync(join(stageDir, 'data'), { recursive: true });

copyFileSync(exePath, join(stageDir, exeName));
writeFileSync(join(stageDir, 'portable.txt'), '');
writeFileSync(
  join(stageDir, 'README-PORTABLE.txt'),
  [
    '说说播放器 - Portable 版',
    '',
    '此目录下的应用数据（设置、收藏、缓存）均存放在 data/ 子目录中，可整体复制到任意位置。',
    '',
    '注意事项：',
    '1. 请勿放到 C:\\Program Files\\ 等系统受保护目录（无写入权限）',
    '2. 首次启动时如系统未安装 Microsoft Edge WebView2 Runtime，会引导联网安装',
    '3. 删除 portable.txt 即恢复为安装版行为（数据写入 %APPDATA%）',
    '4. 【重要】B 站网页端 Cookie 仍由 WebView2 管理在系统目录，复制到另一台电脑后需重新扫码登录',
    '5. portable 模式不支持自动更新，请手动到 GitHub Releases 下载新版本',
  ].join('\r\n'),
);

const zipPath = join(releaseDir, `${stageName}.zip`);
rmSync(zipPath, { force: true });
if (process.platform === 'win32') {
  // Windows：用 PowerShell Compress-Archive
  execSync(
    `powershell -NoProfile -Command "Compress-Archive -Path '${stageDir}\\*' -DestinationPath '${zipPath}' -Force"`,
    { stdio: 'inherit' },
  );
} else {
  // 非 Windows（仅 PORTABLE_PACK_FORCE 验证用）：用 zip
  execSync(`cd "${releaseDir}" && zip -r "${stageName}.zip" "${stageName}"`, {
    stdio: 'inherit',
  });
}

const buf = readFileSync(zipPath);
const sha256 = createHash('sha256').update(buf).digest('hex');
writeFileSync(`${zipPath}.sha256`, `${sha256}  ${stageName}.zip\n`);
console.log(
  `[pack-portable] ${zipPath} (${buf.length} bytes, sha256=${sha256.slice(0, 16)}...)`,
);
