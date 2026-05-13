import {
  hslToRgb,
  relativeLuminance,
  computePrimaryForeground,
  computeEffectivePrimary,
  HSL_PATTERN,
} from './color';

describe('color utils', () => {
  describe('hslToRgb', () => {
    it('纯红', () => {
      const [r, g, b] = hslToRgb(0, 100, 50);
      expect(r).toBe(255);
      expect(g).toBe(0);
      expect(b).toBe(0);
    });

    it('纯绿', () => {
      const [r, g, b] = hslToRgb(120, 100, 50);
      expect(r).toBe(0);
      expect(g).toBe(255);
      expect(b).toBe(0);
    });

    it('纯蓝', () => {
      const [r, g, b] = hslToRgb(240, 100, 50);
      expect(r).toBe(0);
      expect(g).toBe(0);
      expect(b).toBe(255);
    });

    it('纯白 / 纯黑', () => {
      expect(hslToRgb(0, 0, 100)).toEqual([255, 255, 255]);
      expect(hslToRgb(0, 0, 0)).toEqual([0, 0, 0]);
    });

    it('默认主色 HSL(347, 100%, 70%) ≈ #FF6687', () => {
      const [r, g, b] = hslToRgb(347, 100, 70);
      expect(r).toBe(255);
      expect(g).toBeGreaterThanOrEqual(101);
      expect(g).toBeLessThanOrEqual(103);
      expect(b).toBeGreaterThanOrEqual(133);
      expect(b).toBeLessThanOrEqual(136);
    });
  });

  describe('relativeLuminance', () => {
    it('白色 = 1.0', () => {
      expect(relativeLuminance(255, 255, 255)).toBeCloseTo(1.0, 3);
    });

    it('黑色 = 0', () => {
      expect(relativeLuminance(0, 0, 0)).toBeCloseTo(0, 3);
    });

    it('绿色权重最高（绿 > 红 > 蓝）', () => {
      const lumGreen = relativeLuminance(0, 255, 0);
      const lumRed = relativeLuminance(255, 0, 0);
      const lumBlue = relativeLuminance(0, 0, 255);
      expect(lumGreen).toBeGreaterThan(lumRed);
      expect(lumRed).toBeGreaterThan(lumBlue);
    });

    it('黄色（255, 255, 0）感知亮度高（> 0.9）', () => {
      // 这是关键 case：HSL.L=50 但实际感知亮度 > 0.9
      // 旧 HSL.L 阈值会误判为「深色」给白字 → 黄底白字看不见
      expect(relativeLuminance(255, 255, 0)).toBeGreaterThan(0.9);
    });

    it('深红色（128, 0, 0）感知亮度低（< 0.1）', () => {
      expect(relativeLuminance(128, 0, 0)).toBeLessThan(0.1);
    });
  });

  describe('computePrimaryForeground', () => {
    it('默认粉 HSL(347, 100%, 70%) → 纯白字（实测 luminance ≈ 0.32，< 0.5 阈值）', () => {
      expect(computePrimaryForeground(347, 100, 70)).toBe(`0 0% 100%`);
    });

    it('浅粉 HSL(347, 100%, 78%) → 纯白字（实测 luminance ≈ 0.44，仍 < 0.5）', () => {
      expect(computePrimaryForeground(347, 100, 78)).toBe(`0 0% 100%`);
    });

    it('黄色 HSL(60, 100%, 50%) → 同色相深字（关键场景：旧 HSL.L 会误判为深色给白字）', () => {
      // luminance ≈ 0.93，远 > 0.5
      expect(computePrimaryForeground(60, 100, 50)).toBe(`60 100% 30%`);
    });

    it('浅绿 HSL(120, 60%, 70%) → 同色相深字', () => {
      expect(computePrimaryForeground(120, 60, 70)).toBe(`120 60% 30%`);
    });

    it('天蓝 HSL(200, 80%, 70%) → 同色相深字', () => {
      // 实测 luminance > 0.5
      expect(computePrimaryForeground(200, 80, 70)).toBe(`200 80% 30%`);
    });

    it('极浅粉 HSL(347, 100%, 90%) → 同色相深字（足够浅才能 > 0.5）', () => {
      expect(computePrimaryForeground(347, 100, 90)).toBe(`347 100% 30%`);
    });

    it('深红 HSL(0, 100%, 30%) → 纯白', () => {
      expect(computePrimaryForeground(0, 100, 30)).toBe(`0 0% 100%`);
    });

    it('深蓝 HSL(230, 80%, 35%) → 纯白', () => {
      expect(computePrimaryForeground(230, 80, 35)).toBe(`0 0% 100%`);
    });
  });

  describe('computeEffectivePrimary', () => {
    it('light 主题不动主色（无论亮度）', () => {
      expect(computeEffectivePrimary('230 80% 35%', 'light')).toBe('230 80% 35%');
      expect(computeEffectivePrimary('347 100% 70%', 'light')).toBe('347 100% 70%');
    });

    it('dark 主题 + 主色偏暗（luminance < 0.3）→ 提亮到 L=65', () => {
      // 深蓝 HSL(230, 80%, 35%) luminance ≈ 0.13
      expect(computeEffectivePrimary('230 80% 35%', 'dark')).toBe('230 80% 65%');
    });

    it('dark 主题 + 主色已足够亮（luminance ≥ 0.3）→ 不动', () => {
      // 默认粉 HSL(347, 100%, 70%) luminance ≈ 0.41
      expect(computeEffectivePrimary('347 100% 70%', 'dark')).toBe('347 100% 70%');
    });

    it('非 HSL 字符串原样返回（让调用方走 fallback）', () => {
      expect(computeEffectivePrimary('#FF6687', 'dark')).toBe('#FF6687');
      expect(computeEffectivePrimary('garbage', 'light')).toBe('garbage');
    });
  });

  describe('HSL_PATTERN', () => {
    it('匹配标准 HSL 字符串', () => {
      expect(HSL_PATTERN.test('347 100% 70%')).toBe(true);
      expect(HSL_PATTERN.test('120.5 60% 50.3%')).toBe(true);
    });

    it('拒绝非法格式', () => {
      expect(HSL_PATTERN.test('#FF6687')).toBe(false);
      expect(HSL_PATTERN.test('hsl(347, 100%, 70%)')).toBe(false);
      expect(HSL_PATTERN.test('347, 100%, 70%')).toBe(false);
      expect(HSL_PATTERN.test('')).toBe(false);
    });
  });
});
