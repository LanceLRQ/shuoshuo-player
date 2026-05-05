import { useState, useEffect } from 'react';
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
  { name: '默认蓝', hsl: DEFAULT_PRIMARY_COLOR },
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

export function AppearanceSettings() {
  const theme = usePlayerProfileStore((s) => s.theme);
  const setTheme = usePlayerProfileStore((s) => s.setTheme);
  const primaryColor = usePlayerProfileStore((s) => s.primaryColor);
  const setPrimaryColor = usePlayerProfileStore((s) => s.setPrimaryColor);
  const resetPrimaryColor = usePlayerProfileStore((s) => s.resetPrimaryColor);

  const [hueDraft, setHueDraft] = useState<number>(() => parseHue(primaryColor));

  useEffect(() => {
    setHueDraft(parseHue(primaryColor));
  }, [primaryColor]);

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
                // 保持当前 saturation/lightness，只换 hue
                const { s, l } = parseSL(primaryColor);
                setPrimaryColor(`${h} ${s}% ${l}%`);
              }}
              className="h-3 w-full cursor-pointer appearance-none rounded-full"
              style={{
                background:
                  'linear-gradient(90deg,hsl(0 80% 55%),hsl(60 80% 55%),hsl(120 80% 55%),hsl(180 80% 55%),hsl(240 80% 55%),hsl(300 80% 55%),hsl(360 80% 55%))',
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
