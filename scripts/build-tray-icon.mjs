#!/usr/bin/env node
/**
 * 生成 macOS 菜单栏托盘 template 图标
 *
 * 输入：packages/desktop/src-tauri/icons/icon.png（bundle 主图标）
 * 输出：packages/desktop/src-tauri/icons/tray-template.png（32×32，黑色 + alpha）
 *
 * 设计思路（用户原话"灰度+保留亮色，扣掉暗色"的工程实现）：
 *   1. resize 到 32×32（macOS 菜单栏 status item 标准点尺寸）
 *   2. 取每个像素的 alpha（图标本身是透明背景）和 luminance（兜底，处理无 alpha 的图标）
 *   3. 输出 RGBA：R=G=B=0（纯黑），A = 原 alpha × (luminance / 255 后高对比映射)
 *      - 亮色像素（白色 / 主色） → 高 alpha（实心）
 *      - 暗色像素 → 低 alpha（趋透明）
 *      - 完全透明像素 → A=0
 *   4. 写出 PNG
 *
 * macOS template image 规范：
 *   - 像素仅可为黑色 + alpha；系统按菜单栏明暗自动反色
 *   - light menubar → 渲染为黑色 logo
 *   - dark menubar → 系统自动反色为白色 logo
 *
 * 触发：
 *   pnpm build:tray-icon
 *
 * 何时跑：logo 变更后人工跑一次；产物 commit 进 git；不挂 Tauri 构建流水线避免额外依赖
 */
import sharp from 'sharp';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const INPUT = join(ROOT, 'packages/desktop/src-tauri/icons/icon.png');
const OUTPUT = join(ROOT, 'packages/desktop/src-tauri/icons/tray-template.png');

const SIZE = 32; // macOS menubar 推荐 32×32（@2x 自动适配 retina）

async function main() {
  const start = Date.now();

  // 1) resize + 取原始 RGBA 像素
  const { data, info } = await sharp(INPUT)
    .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (info.channels !== 4) {
    throw new Error(`expected 4 channels (RGBA), got ${info.channels}`);
  }

  // 2) 逐像素重写：黑色 + 加权 alpha（保留 logo 形状与轮廓）
  const out = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    // Rec. 601 luminance（人眼亮度感知加权）
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

    // alpha 合成：原 alpha 作为遮罩，luminance 作为权重
    // 亮色像素（logo 主体）→ alpha 高；暗色边缘 → alpha 低（自然羽化）
    const weighted = Math.round((a * luminance) / 255);

    out[i] = 0; // R
    out[i + 1] = 0; // G
    out[i + 2] = 0; // B
    out[i + 3] = weighted; // A
  }

  // 3) 写出 PNG
  await sharp(out, {
    raw: { width: SIZE, height: SIZE, channels: 4 },
  })
    .png()
    .toFile(OUTPUT);

  const elapsed = Date.now() - start;
  console.log(`OK  ${relative(ROOT, OUTPUT)}  (${SIZE}x${SIZE}, ${elapsed}ms)`);
}

main().catch((err) => {
  console.error('FAIL build-tray-icon:', err);
  process.exit(1);
});
