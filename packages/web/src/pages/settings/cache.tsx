import { useEffect, useState, useCallback } from 'react';
import { Trash2, RefreshCw, AlertTriangle, FolderOpen, RotateCcw } from 'lucide-react';
import {
  getPlatformBridge,
  useUIStore,
  NoticeType,
  type AudioCacheStats,
} from '@shuoshuo-player/shared';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';

const MIN_GB = 0.25; // 256 MB（与 Rust USER_CAP_MIN 一致）
const MAX_GB = 50; // 50 GB（与 Rust USER_CAP_MAX 一致）
const DEFAULT_GB = 1;

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
          <CardTitle>音频缓存</CardTitle>
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

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>当前用量</CardTitle>
          <CardDescription>
            B 站音频本地缓存（AES-128 加密 + machine-id 派生 key，跨机器不可解）。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {stats ? (
            <>
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-muted-foreground">已用 / 上限</span>
                <span className="font-mono">
                  {formatSize(stats.current_bytes)} / {formatSize(stats.max_bytes)}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${usagePercent}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>缓存条目：{stats.entry_count}</span>
                <Button variant="ghost" size="sm" onClick={() => void refresh()} disabled={loading}>
                  <RefreshCw className="mr-1 h-3.5 w-3.5" />
                  刷新
                </Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">加载中…</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>缓存目录</CardTitle>
          <CardDescription>
            自定义音频缓存的存储位置。修改后**清空旧目录缓存**并保存新路径，
            <span className="font-medium">重启应用后生效</span>。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">当前路径</Label>
            <code className="block break-all rounded bg-muted px-3 py-2 text-xs">
              {cacheDir || '加载中…'}
            </code>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => void handlePickDir()} disabled={loading}>
              <FolderOpen className="mr-1 h-4 w-4" />
              选择目录…
            </Button>
            <Button variant="ghost" onClick={() => void handleResetDir()} disabled={loading}>
              <RotateCcw className="mr-1 h-4 w-4" />
              恢复默认
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>容量上限</CardTitle>
          <CardDescription>范围 256 MB – 50 GB。降低上限会立即驱逐最旧的缓存项。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <Label className="text-xs text-muted-foreground">目标容量</Label>
              <span className="font-mono text-sm">{draftGB.toFixed(2)} GB</span>
            </div>
            <Slider
              min={MIN_GB}
              max={MAX_GB}
              step={0.25}
              value={[draftGB]}
              onValueChange={(v) => setDraftGB(v[0] ?? DEFAULT_GB)}
            />
          </div>
          <Button
            onClick={() => void handleSaveMax()}
            disabled={loading || !stats || gbToBytes(draftGB) === stats.max_bytes}
          >
            应用
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>清空缓存</CardTitle>
          <CardDescription>
            删除所有本地音频缓存文件 + 索引。下次播放需重新从 B 站下载。
          </CardDescription>
        </CardHeader>
        <CardContent>
          {confirmingClear ? (
            <div className="space-y-3">
              <p className="text-sm text-destructive">
                确定要清空所有缓存吗？{stats ? formatSize(stats.current_bytes) : '?'} 数据将被删除。
              </p>
              <div className="flex gap-2">
                <Button variant="destructive" onClick={() => void handleClear()} disabled={loading}>
                  <Trash2 className="mr-1 h-4 w-4" />
                  确认清空
                </Button>
                <Button
                  variant="outline"
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
              onClick={() => setConfirmingClear(true)}
              disabled={loading || !stats || stats.entry_count === 0}
            >
              <Trash2 className="mr-1 h-4 w-4" />
              清空全部缓存
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
