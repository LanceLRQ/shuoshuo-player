import { useState } from 'react';
import { ArrowLeft, Search } from 'lucide-react';
import { useUIStore, NoticeType, type QQMusicSong } from '@shuoshuo-player/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

/**
 * QQ 音乐歌词搜索弹窗（仅桌面端可用，依赖 SpiderAdapter）。
 *
 * 受控组件：由调用方（歌词编辑器）传入 open / onClose / onPick 回调。
 * spider 通过 props 注入，避免组件直接 import @tauri-apps/api。
 */
interface LyricSearchDialogProps {
  open: boolean;
  onClose: () => void;
  /** 默认搜索关键词（一般是当前曲目标题） */
  defaultKeyword?: string;
  /** 选中歌曲时回调，参数为 LRC 文本 */
  onPick: (lrc: string, song: QQMusicSong) => void;
  /** 平台桥接 spider，无则按钮置灰 */
  spider?: {
    searchSong: (keyword: string, limit?: number) => Promise<QQMusicSong[]>;
    getLRC: (mid: string) => Promise<string>;
  };
}

/** 预览态：选中某首后拿到 LRC 文本，等待用户确认才注入编辑器 */
interface PreviewState {
  song: QQMusicSong;
  lrc: string;
}

export function LyricSearchDialog({
  open,
  onClose,
  defaultKeyword = '',
  onPick,
  spider,
}: LyricSearchDialogProps) {
  const [keyword, setKeyword] = useState(defaultKeyword);
  const [results, setResults] = useState<QQMusicSong[]>([]);
  const [searching, setSearching] = useState(false);
  /** 正在拉 LRC 的歌曲 mid（按钮 loading 标识） */
  const [loadingMid, setLoadingMid] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const sendNotice = useUIStore((s) => s.sendNotice);

  const handleSearch = async () => {
    if (!spider) {
      sendNotice({
        type: NoticeType.WARN,
        message: 'QQ 音乐搜索仅在桌面端可用',
        duration: 3000,
      });
      return;
    }
    if (!keyword.trim()) return;
    setSearching(true);
    setResults([]);
    try {
      const list = await spider.searchSong(keyword.trim(), 30);
      setResults(list);
    } catch {
      sendNotice({ type: NoticeType.ERROR, message: '搜索失败', duration: 3000 });
    } finally {
      setSearching(false);
    }
  };

  /** 点列表项 → 拉 LRC → 进入预览态（不立即 onPick，等用户在预览界面确认） */
  const handlePick = async (song: QQMusicSong) => {
    if (!spider) return;
    setLoadingMid(song.mid);
    try {
      const lrc = await spider.getLRC(song.mid);
      if (!lrc) {
        sendNotice({ type: NoticeType.WARN, message: '未获取到歌词', duration: 2000 });
        return;
      }
      setPreview({ song, lrc });
    } catch {
      sendNotice({ type: NoticeType.ERROR, message: '歌词获取失败', duration: 3000 });
    } finally {
      setLoadingMid(null);
    }
  };

  /** 预览态确认 → 注入编辑器并关闭 */
  const handleConfirmUse = () => {
    if (!preview) return;
    onPick(preview.lrc, preview.song);
    setPreview(null);
    onClose();
  };

  /** 预览态返回列表（保留搜索结果，仅清当前预览） */
  const handleBackToList = () => setPreview(null);

  /** 外层关闭：保留 keyword/results 给下次打开复用，但清理预览态避免残留 */
  const handleDialogClose = () => {
    setPreview(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : handleDialogClose())}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{preview ? `预览：${preview.song.name}` : 'QQ 音乐歌词搜索'}</DialogTitle>
          <DialogDescription>
            {preview
              ? '确认无误后点击"使用"覆盖当前歌词，或返回重选'
              : '选中匹配项后会先预览歌词内容，确认无误才注入编辑器'}
          </DialogDescription>
        </DialogHeader>

        {preview ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {preview.song.singer.map((s) => s.name).join(' / ')} · {preview.song.album.name}
            </p>
            <ScrollArea className="h-[40vh] rounded-md border">
              <pre className="whitespace-pre-wrap px-3 py-2 font-mono text-xs leading-relaxed">
                {preview.lrc}
              </pre>
            </ScrollArea>
          </div>
        ) : (
          <>
            <div className="flex gap-2">
              <Input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="输入歌曲名 / 歌手"
                disabled={searching}
              />
              <Button onClick={handleSearch} disabled={searching || !keyword.trim()}>
                <Search className="mr-1 h-4 w-4" />
                {searching ? '搜索中' : '搜索'}
              </Button>
            </div>
            <ScrollArea className="h-[40vh]">
              <div className="flex flex-col gap-1 pr-3">
                {results.length === 0 && !searching && (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    输入关键词后开始搜索
                  </p>
                )}
                {results.map((song) => (
                  <button
                    key={song.mid}
                    type="button"
                    onClick={() => handlePick(song)}
                    disabled={loadingMid === song.mid}
                    className="flex items-center justify-between rounded-md border border-input px-3 py-2 text-left transition-colors hover:bg-accent disabled:opacity-50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{song.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {song.singer.map((s) => s.name).join(' / ')} · {song.album.name}
                      </p>
                    </div>
                    {loadingMid === song.mid && (
                      <span className="ml-2 text-xs text-muted-foreground">加载中…</span>
                    )}
                  </button>
                ))}
              </div>
            </ScrollArea>
          </>
        )}

        <DialogFooter>
          {preview ? (
            <>
              <Button variant="outline" onClick={handleBackToList}>
                <ArrowLeft className="mr-1 h-4 w-4" />
                返回
              </Button>
              <Button onClick={handleConfirmUse}>使用</Button>
            </>
          ) : (
            <Button variant="outline" onClick={handleDialogClose}>
              关闭
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
