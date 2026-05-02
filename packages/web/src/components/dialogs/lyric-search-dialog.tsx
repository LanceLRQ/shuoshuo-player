import { useState } from 'react';
import { Search } from 'lucide-react';
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
  const [previewing, setPreviewing] = useState<string | null>(null);
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

  const handlePick = async (song: QQMusicSong) => {
    if (!spider) return;
    setPreviewing(song.mid);
    try {
      const lrc = await spider.getLRC(song.mid);
      if (!lrc) {
        sendNotice({ type: NoticeType.WARN, message: '未获取到歌词', duration: 2000 });
        return;
      }
      onPick(lrc, song);
      onClose();
    } catch {
      sendNotice({ type: NoticeType.ERROR, message: '歌词获取失败', duration: 3000 });
    } finally {
      setPreviewing(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>QQ 音乐歌词搜索</DialogTitle>
          <DialogDescription>选择匹配项后将自动填充到歌词编辑器</DialogDescription>
        </DialogHeader>
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
                disabled={previewing === song.mid}
                className="flex items-center justify-between rounded-md border border-input px-3 py-2 text-left transition-colors hover:bg-accent disabled:opacity-50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{song.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {song.singer.map((s) => s.name).join(' / ')} · {song.album.name}
                  </p>
                </div>
                {previewing === song.mid && (
                  <span className="ml-2 text-xs text-muted-foreground">加载中…</span>
                )}
              </button>
            ))}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
