import { useState, useEffect, useRef } from 'react';
import { Sun, Moon, Monitor, RotateCcw } from 'lucide-react';
import { usePlayerProfileStore, DEFAULT_PRIMARY_COLOR } from '@shuoshuo-player/shared';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

const THEME_OPTIONS: Array<{
  value: 'light' | 'dark' | 'auto';
  label: string;
  icon: typeof Sun;
}> = [
  { value: 'light', label: '亮色', icon: Sun },
  { value: 'dark', label: '暗色', icon: Moon },
  { value: 'auto', label: '跟随系统', icon: Monitor },
];

/** 预设主色（HSL 字符串格式） */
const PRESET_COLORS: Array<{ name: string; hsl: string }> = [
  { name: '默认粉', hsl: DEFAULT_PRIMARY_COLOR },
  { name: '蓝', hsl: '221.2 83.2% 53.3%' },
  { name: '玫粉', hsl: '346 77% 49%' },
  { name: '橙', hsl: '24.6 95% 53.1%' },
  { name: '草绿', hsl: '142.1 76.2% 36.3%' },
  { name: '紫', hsl: '262.1 83.3% 57.8%' },
  { name: '青', hsl: '188 95% 37%' },
];

/** 简易把 HSL 字符串渲染为 CSS hsl() 颜色（用于色块预览） */
function hslToCss(hsl: string): string {
  return `hsl(${hsl})`;
}

/**
 * 按色相返回"可分辨"的 lightness 上限。
 * 黄/黄绿（H≈30–100）感知亮度最高，相同 L 下视觉最淡；
 * 该区间夹紧 L<=70（黄峰 H=60 时 55），让按钮在浅底上仍可识别。
 * 其他色相返回 90（基本不夹紧）。
 */
function maxLForHue(h: number): number {
  const h360 = ((h % 360) + 360) % 360;
  if (h360 >= 30 && h360 <= 100) {
    // 30→70 → 60→55 → 100→70 三段折线，黄峰最严
    if (h360 <= 60) return 70 - ((h360 - 30) * 15) / 30;
    return 55 + ((h360 - 60) * 15) / 40;
  }
  return 90;
}

export function AppearanceSettings() {
  const theme = usePlayerProfileStore((s) => s.theme);
  const setTheme = usePlayerProfileStore((s) => s.setTheme);
  const primaryColor = usePlayerProfileStore((s) => s.primaryColor);
  const setPrimaryColor = usePlayerProfileStore((s) => s.setPrimaryColor);
  const resetPrimaryColor = usePlayerProfileStore((s) => s.resetPrimaryColor);

  const [hueDraft, setHueDraft] = useState<number>(() => parseHue(primaryColor));
  // 用户期望的"基础亮度"。色轮拖动时 L 仅做色相补偿夹紧不写回该值，
  // 离开黄/黄绿区段后会自动恢复到此基础亮度。
  const [baseLightness, setBaseLightness] = useState<number>(() => parseSL(primaryColor).l);
  // 标记最近一次由本组件主动写入 store 的字符串，
  // 用于在 useEffect 中区分"外部更新"（应同步 baseLightness）与"色轮 / L 滑块自身更新"。
  const lastSelfWritten = useRef<string>(primaryColor);

  useEffect(() => {
    setHueDraft(parseHue(primaryColor));
    if (primaryColor !== lastSelfWritten.current) {
      setBaseLightness(parseSL(primaryColor).l);
    }
  }, [primaryColor]);

  // 计算并写入主色字符串：以 baseL 为期望亮度，按 maxLForHue 夹紧。
  const writePrimary = (h: number, baseL: number) => {
    const { s } = parseSL(primaryColor);
    const lAdj = Math.min(baseL, maxLForHue(h));
    const next = `${h} ${s}% ${Math.round(lAdj * 10) / 10}%`;
    lastSelfWritten.current = next;
    setPrimaryColor(next);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>主题</CardTitle>
          <CardDescription>切换亮色 / 暗色 / 跟随系统。</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {THEME_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const active = theme === opt.value;
              return (
                <Button
                  key={opt.value}
                  variant={active ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTheme(opt.value)}
                >
                  <Icon className="mr-1.5 h-4 w-4" />
                  {opt.label}
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>主色</CardTitle>
          <CardDescription>
            UI 强调色（按钮 / 链接 / 焦点环）。配置即时生效，重启保留。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">预设</Label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((p) => (
                <button
                  key={p.hsl}
                  type="button"
                  onClick={() => setPrimaryColor(p.hsl)}
                  className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs transition-colors ${
                    primaryColor === p.hsl
                      ? 'border-primary ring-2 ring-primary/30'
                      : 'border-border hover:border-muted-foreground'
                  }`}
                >
                  <span
                    className="h-4 w-4 rounded-full border border-border"
                    style={{ backgroundColor: hslToCss(p.hsl) }}
                  />
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="primary-hue" className="text-xs text-muted-foreground">
              色相微调（{hueDraft}°）
            </Label>
            <input
              id="primary-hue"
              type="range"
              min={0}
              max={360}
              value={hueDraft}
              onChange={(e) => {
                const h = Number(e.target.value);
                setHueDraft(h);
                writePrimary(h, baseLightness);
              }}
              className="h-3 w-full cursor-pointer appearance-none rounded-full"
              style={{
                background:
                  'linear-gradient(90deg,hsl(0 80% 55%),hsl(60 80% 55%),hsl(120 80% 55%),hsl(180 80% 55%),hsl(240 80% 55%),hsl(300 80% 55%),hsl(360 80% 55%))',
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="primary-lightness" className="text-xs text-muted-foreground">
              亮度调节（{Math.round(baseLightness)}%）
            </Label>
            <input
              id="primary-lightness"
              type="range"
              min={10}
              max={95}
              step={1}
              value={Math.round(baseLightness)}
              onChange={(e) => {
                const l = Number(e.target.value);
                setBaseLightness(l);
                writePrimary(hueDraft, l);
              }}
              className="h-3 w-full cursor-pointer appearance-none rounded-full"
              style={{
                background: `linear-gradient(90deg,hsl(${hueDraft} 80% 15%),hsl(${hueDraft} 80% 50%),hsl(${hueDraft} 80% 90%))`,
              }}
            />
          </div>

          <div className="flex items-center gap-3">
            <span
              className="h-8 w-8 rounded-full border border-border"
              style={{ backgroundColor: hslToCss(primaryColor) }}
              aria-label="当前主色预览"
            />
            <code className="rounded bg-muted px-2 py-1 text-xs">{primaryColor}</code>
            <Button
              variant="outline"
              size="sm"
              onClick={resetPrimaryColor}
              disabled={primaryColor === DEFAULT_PRIMARY_COLOR}
            >
              <RotateCcw className="mr-1 h-3.5 w-3.5" />
              恢复默认
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** 从 "H S% L%" 字符串解析 H 值 */
function parseHue(hsl: string): number {
  const m = hsl.trim().match(/^([0-9.]+)/);
  return m ? Math.round(parseFloat(m[1])) : 221;
}

/** 解析 saturation / lightness（兜底回默认值） */
function parseSL(hsl: string): { s: number; l: number } {
  const m = hsl.trim().match(/^[0-9.]+\s+([0-9.]+)%\s+([0-9.]+)%$/);
  if (!m) return { s: 83, l: 53 };
  return { s: parseFloat(m[1]), l: parseFloat(m[2]) };
}
