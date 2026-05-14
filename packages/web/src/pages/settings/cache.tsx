import { useEffect, useState, useCallback } from 'react';
import { Trash2, RefreshCw, AlertTriangle, FolderOpen, RotateCcw } from 'lucide-react';
import {
  getPlatformBridge,
  useUIStore,
  NoticeType,
  type AudioCacheStats,
} from '@shuoshuo-player/shared';
import { Card, CardHeader, CardDescription, CardContent } from '@/components/ui/card';
import { SectionTitle } from './_components';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

const MIN_GB = 0.25; // 256 MB（与 Rust USER_CAP_MIN 一致）
const MAX_GB = 50; // 50 GB（与 Rust USER_CAP_MAX 一致）
const DEFAULT_GB = 1;
const USAGE_WARN_PERCENT = 90; // ≥ 90% 用量进度条染色提醒

function bytesToGB(bytes: number): number {
  return bytes / (1024 * 1024 * 1024);
}

function gbToBytes(gb: number): number {
  return Math.round(gb * 1024 * 1024 * 1024);
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/**
 * 单 Card 仪表盘式布局：
 * - Header：标题 + 简介 + 右上角刷新按钮
 * - Hero：突出"已用 / 上限"大数字 + 高对比进度条 + 条目数 / 百分比
 * - Section 1：容量上限（滑块 + 应用）
 * - Section 2：缓存目录（路径 + 选择/恢复）
 * - Section 3：危险区域（清空缓存，含二次确认）
 *
 * 子模块之间用 `<Separator />` 分隔，整体保持单 Card 视觉边界。
 */
export function CacheSettings() {
  const sendNotice = useUIStore((s) => s.sendNotice);
  const [stats, setStats] = useState<AudioCacheStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [draftGB, setDraftGB] = useState<number>(DEFAULT_GB);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [cacheDir, setCacheDir] = useState<string>('');

  const cache = getPlatformBridge().audioCache;

  const refresh = useCallback(async () => {
    if (!cache) return;
    try {
      const [next, dir] = await Promise.all([cache.getStats(), cache.getDir()]);
      setStats(next);
      setDraftGB(Number(bytesToGB(next.max_bytes).toFixed(2)));
      setCacheDir(dir);
    } catch (err) {
      sendNotice({
        type: NoticeType.ERROR,
        message: `获取缓存统计失败：${String(err)}`,
        duration: 3000,
      });
    }
  }, [cache, sendNotice]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // PC 端 bridge 必有 audioCache；非 Tauri 进入此页是路由守卫漏判 → 兜底提示
  if (!cache) {
    return (
      <Card>
        <CardHeader>
          <SectionTitle>音频缓存</SectionTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>缓存管理仅在桌面端可用。</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleSaveMax = async () => {
    setLoading(true);
    try {
      const next = await cache.setMaxBytes(gbToBytes(draftGB));
      setStats(next);
      sendNotice({
        type: NoticeType.SUCCESS,
        message: `容量已设为 ${draftGB.toFixed(2)} GB`,
        duration: 2000,
      });
    } catch (err) {
      sendNotice({
        type: NoticeType.ERROR,
        message: `设置失败：${String(err)}`,
        duration: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    setLoading(true);
    try {
      await cache.clear();
      await refresh();
      sendNotice({
        type: NoticeType.SUCCESS,
        message: '缓存已清空',
        duration: 2000,
      });
      setConfirmingClear(false);
    } catch (err) {
      sendNotice({
        type: NoticeType.ERROR,
        message: `清空失败：${String(err)}`,
        duration: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePickDir = async () => {
    if (!cache) return;
    setLoading(true);
    try {
      const picked = await cache.pickDir(cacheDir);
      if (!picked || picked === cacheDir) return;
      await cache.setDir(picked);
      sendNotice({
        type: NoticeType.SUCCESS,
        message: '缓存路径已保存，重启应用后生效（旧路径缓存已清空）',
        duration: 5000,
      });
      // 不立即 refresh dir：root 仍是旧值；下次启动后 getDir 才返回新值
      setStats(null);
    } catch (err) {
      sendNotice({
        type: NoticeType.ERROR,
        message: `修改路径失败：${String(err)}`,
        duration: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetDir = async () => {
    if (!cache) return;
    setLoading(true);
    try {
      await cache.setDir(null);
      sendNotice({
        type: NoticeType.SUCCESS,
        message: '已恢复默认缓存路径，重启应用后生效（旧路径缓存已清空）',
        duration: 5000,
      });
      setStats(null);
    } catch (err) {
      sendNotice({
        type: NoticeType.ERROR,
        message: `恢复默认失败：${String(err)}`,
        duration: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  const usagePercent = stats ? Math.min(100, (stats.current_bytes / stats.max_bytes) * 100) : 0;
  const hasUnsavedMax = !!stats && gbToBytes(draftGB) !== stats.max_bytes;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1.5">
          <SectionTitle>音频缓存</SectionTitle>
          <CardDescription>
            B 站音频本地缓存（AES-128 加密 + machine-id 派生 key，跨机器不可解）。
          </CardDescription>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => void refresh()}
          disabled={loading}
          aria-label="刷新缓存统计"
          className="h-8 w-8 shrink-0"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Hero 用量仪表盘：突出主视觉，让用户一眼看到当前状态 */}
        <div className="rounded-lg border bg-muted/30 p-4">
          {stats ? (
            <div className="space-y-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-lg font-semibold tracking-tight tabular-nums">
                  {formatSize(stats.current_bytes)} / {formatSize(stats.max_bytes)}
                </span>
                <span
                  className={cn(
                    'text-sm font-medium tabular-nums',
                    usagePercent >= USAGE_WARN_PERCENT
                      ? 'text-destructive'
                      : 'text-muted-foreground',
                  )}
                >
                  {usagePercent.toFixed(0)}%
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    usagePercent >= USAGE_WARN_PERCENT ? 'bg-destructive' : 'bg-primary',
                  )}
                  style={{ width: `${usagePercent}%` }}
                />
              </div>
              <div className="text-xs text-muted-foreground">缓存条目：{stats.entry_count}</div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">加载中…</p>
          )}
        </div>

        <Separator />

        {/* Section: 容量上限 */}
        <section className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-sm font-medium">容量上限</h3>
            <span className="font-mono text-sm tabular-nums">{draftGB.toFixed(2)} GB</span>
          </div>
          <Slider
            min={MIN_GB}
            max={MAX_GB}
            step={0.25}
            value={[draftGB]}
            onValueChange={(v) => setDraftGB(v[0] ?? DEFAULT_GB)}
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground tabular-nums">
            <span>256 MB</span>
            <span>50 GB</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">降低上限会立即驱逐最旧的缓存项。</p>
            <Button
              size="sm"
              onClick={() => void handleSaveMax()}
              disabled={loading || !hasUnsavedMax}
            >
              应用
            </Button>
          </div>
        </section>

        <Separator />

        {/* Section: 缓存目录 */}
        <section className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-sm font-medium">缓存目录</h3>
            <span className="text-xs text-muted-foreground">重启应用后生效</span>
          </div>
          <code className="block break-all rounded-md bg-muted px-3 py-2 font-mono text-xs">
            {cacheDir || '加载中…'}
          </code>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handlePickDir()}
              disabled={loading}
            >
              <FolderOpen className="mr-1 h-4 w-4" />
              选择目录…
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void handleResetDir()}
              disabled={loading}
            >
              <RotateCcw className="mr-1 h-4 w-4" />
              恢复默认
            </Button>
          </div>
        </section>

        <Separator />

        {/* Section: 清空缓存（保留 destructive 按钮视觉，但去掉单独的"危险区域"标题层级） */}
        <section className="space-y-3">
          <p className="text-xs text-muted-foreground">
            清空全部本地音频缓存文件与索引；下次播放需重新从 B 站下载。
          </p>
          {confirmingClear ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 space-y-3">
              <p className="text-sm text-destructive">
                确定要清空所有缓存吗？{stats ? formatSize(stats.current_bytes) : '?'} 数据将被删除。
              </p>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => void handleClear()}
                  disabled={loading}
                >
                  <Trash2 className="mr-1 h-4 w-4" />
                  确认清空
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmingClear(false)}
                  disabled={loading}
                >
                  取消
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmingClear(true)}
              disabled={loading || !stats || stats.entry_count === 0}
              className="border-destructive/40 text-destructive hover:bg-destructive/5 hover:text-destructive"
            >
              <Trash2 className="mr-1 h-4 w-4" />
              清空全部缓存
            </Button>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
