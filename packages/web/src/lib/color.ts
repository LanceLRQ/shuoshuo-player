/**
 * 主色 / 颜色相关工具
 *
 * 设计要点：
 * - HSL → RGB → WCAG 相对亮度 → 智能选 foreground 色
 * - 解决 HSL.L 不能反映人眼感知亮度的问题（如黄色 L=50 但视觉上很亮）
 * - 阈值（FOREGROUND_LUM_THRESHOLD / DARK_BOOST_LUM_THRESHOLD）来自实测经验值，
 *   不是 WCAG 数学中点（WCAG 中点约 0.216，对应 sRGB 50% 灰）
 */

/** HSL 字符串解析正则：`H S% L%` 形式（与 globals.css 中 --primary 写法一致） */
export const HSL_PATTERN = /^([0-9.]+)\s+([0-9.]+)%\s+([0-9.]+)%$/;

/**
 * 「偏亮 vs 偏暗」前景色判定阈值（经验值，不是 WCAG 数学中点）
 * - luminance > 此值 → 视为偏亮主色，用同色相深字
 * - luminance ≤ 此值 → 视为偏暗主色，用纯白字
 */
export const FOREGROUND_LUM_THRESHOLD = 0.5;

/**
 * Dark 主题下「过暗主色」自动提亮的触发阈值（经验值）
 * - luminance < 此值且 dark 主题时，把主色 L 拉到 DARK_BOOST_TARGET_L
 */
export const DARK_BOOST_LUM_THRESHOLD = 0.3;

/** Dark 主题下提亮目标 L（保持 H/S，仅改 L） */
export const DARK_BOOST_TARGET_L = 65;

/** 同色相深字目标 L（用于偏亮主色背景上的文字） */
export const DEEP_FG_TARGET_L = 30;

/** HSL → RGB（h: 0-360, s/l: 0-100），返回 [r, g, b] 0-255 整数元组 */
export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const sN = s / 100;
  const lN = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sN * Math.min(lN, 1 - lN);
  const f = (n: number) => lN - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

/**
 * WCAG 相对亮度（0-1）：考虑人眼对绿色权重最高、蓝色最低
 * 公式见 https://www.w3.org/WAI/GL/wiki/Relative_luminance
 */
export function relativeLuminance(r: number, g: number, b: number): number {
  const lin = (c: number) => {
    const sRGB = c / 255;
    return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/**
 * 根据主色 HSL 选定 --primary-foreground：
 * - 偏亮主色（luminance > FOREGROUND_LUM_THRESHOLD）：返回同色相深字 `H S% 30%`
 * - 偏暗主色（luminance ≤ FOREGROUND_LUM_THRESHOLD）：返回纯白 `0 0% 100%`
 */
export function computePrimaryForeground(h: number, s: number, l: number): string {
  const [r, g, b] = hslToRgb(h, s, l);
  if (relativeLuminance(r, g, b) > FOREGROUND_LUM_THRESHOLD) {
    return `${h} ${s}% ${DEEP_FG_TARGET_L}%`;
  }
  return `0 0% 100%`;
}

/**
 * Dark 主题下若主色过暗自动提亮（保 H/S，L 拉到 DARK_BOOST_TARGET_L）
 * Light 主题或主色已足够亮时返回原值
 */
export function computeEffectivePrimary(
  primaryColor: string,
  effectiveTheme: 'light' | 'dark',
): string {
  const m = primaryColor.trim().match(HSL_PATTERN);
  if (!m) return primaryColor;
  const h = parseFloat(m[1]);
  const s = parseFloat(m[2]);
  const l = parseFloat(m[3]);
  if (effectiveTheme !== 'dark') return primaryColor;
  const [r, g, b] = hslToRgb(h, s, l);
  if (relativeLuminance(r, g, b) >= DARK_BOOST_LUM_THRESHOLD) return primaryColor;
  return `${h} ${s}% ${DARK_BOOST_TARGET_L}%`;
}
