import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  useLyricsStore,
  useCloudServiceStore,
  useUIStore,
  LyricApi,
  parseLRC,
  formatTimeLyric,
  textToDownload,
  createLyricFileLoader,
  filterInvalidFileNameChars,
  NoticeType,
  LYRIC_EDITOR_UNDO_STACK_MAX,
  type BilibiliVideo,
  type QQMusicSong,
  type SpiderAdapter,
} from '@shuoshuo-player/shared';
import { LyricToolbar } from './lyric-toolbar';
import { LyricTable, type LyricLine } from './lyric-table';
import { LyricSearchDialog } from '@/components/dialogs/lyric-search-dialog';
import { useUIShell } from '@/stores/ui-shell';

interface LyricEditorProps {
  currentVideo: BilibiliVideo | null;
  /** 当前播放进度（秒），来自 SPlayer */
  currentTime: number;
  /** 双击行触发 seek（秒） */
  onSeek?: (seconds: number) => void;
  onExit: () => void;
  /** 平台桥接 spider，存在则启用 QQ 音乐搜索 */
  spider?: SpiderAdapter;
}

/**
 * 撤销栈追加：超过 LYRIC_EDITOR_UNDO_STACK_MAX 时丢弃最早一条（FIFO）
 * 抽出为纯函数以便单元测试覆盖深度溢出场景
 */
export function appendLyricHistory(prev: LyricLine[][], snapshot: LyricLine[]): LyricLine[][] {
  const next = [...prev, snapshot];
  if (next.length > LYRIC_EDITOR_UNDO_STACK_MAX) next.shift();
  return next;
}

export function LyricEditor({
  currentVideo,
  currentTime,
  onSeek,
  onExit,
  spider,
}: LyricEditorProps) {
  const lyricEntry = useLyricsStore((s) =>
    currentVideo ? s.lyricMaps[currentVideo.bvid] : undefined,
  );
  const updateLyric = useLyricsStore((s) => s.updateLyric);
  const isAdmin = useCloudServiceStore((s) => s.isAdmin());
  const sendNotice = useUIStore((s) => s.sendNotice);
  const openConfirm = useUIShell((s) => s.openConfirm);

  const [lines, setLines] = useState<LyricLine[]>(() => parseInitial(lyricEntry?.lyricText ?? ''));
  const [history, setHistory] = useState<LyricLine[][]>([]);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [customStep, setCustomStep] = useState(500);
  const [searchOpen, setSearchOpen] = useState(false);
  // dirty 基线：以"进入编辑器/切换曲目/保存成功"时的序列化文本为参照
  // 选 serializeLrc 而非原 lyricText：原始文本可能含空行/格式差异，反序列化后再序列化更稳定
  // 必须是 state（不能是 ref）：保存后基线变化要触发 isDirty 重算，否则点保存后立刻退出仍会被拦截
  const [savedSerialized, setSavedSerialized] = useState<string>(() =>
    serializeLrc(parseInitial(lyricEntry?.lyricText ?? '')),
  );

  // 切换曲目时重置编辑状态
  useEffect(() => {
    const fresh = parseInitial(lyricEntry?.lyricText ?? '');
    setSavedSerialized(serializeLrc(fresh));
    setLines(fresh);
    setHistory([]);
    setSelectedRows(new Set());
  }, [currentVideo?.bvid]);

  const isDirty = useMemo(() => serializeLrc(lines) !== savedSerialized, [lines, savedSerialized]);

  const handleRequestExit = useCallback(() => {
    if (!isDirty) {
      onExit();
      return;
    }
    openConfirm({
      title: '退出编辑',
      description: '存在未保存的改动，是否放弃并退出？',
      confirmText: '放弃改动',
      cancelText: '继续编辑',
      destructive: true,
      onConfirm: () => onExit(),
    });
  }, [isDirty, onExit, openConfirm]);

  const pushHistory = useCallback((snapshot: LyricLine[]) => {
    setHistory((prev) => appendLyricHistory(prev, snapshot));
  }, []);

  const mutateLines = useCallback(
    (mutator: (current: LyricLine[]) => LyricLine[]) => {
      setLines((prev) => {
        pushHistory(prev);
        return mutator(prev);
      });
    },
    [pushHistory],
  );

  // === 工具栏回调 ===
  const handleShiftAll = (delta: number) => {
    mutateLines((prev) => prev.map((l) => ({ ...l, time: Math.max(0, l.time + delta) })));
  };

  const handleShiftSelected = (delta: number) => {
    mutateLines((prev) =>
      prev.map((l, idx) =>
        selectedRows.has(idx) ? { ...l, time: Math.max(0, l.time + delta) } : l,
      ),
    );
  };

  const handleInsertHere = () => {
    const timeMs = Math.floor(currentTime * 1000);
    mutateLines((prev) => {
      const next = [...prev, { time: timeMs, content: '' }];
      next.sort((a, b) => a.time - b.time);
      return next;
    });
  };

  const handleDeleteSelected = () => {
    if (selectedRows.size === 0) return;
    mutateLines((prev) => prev.filter((_, idx) => !selectedRows.has(idx)));
    setSelectedRows(new Set());
  };

  const handleClearSelection = () => setSelectedRows(new Set());

  const handleUndo = () => {
    setHistory((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      const last = next.pop();
      if (last) setLines(last);
      return next;
    });
  };

  const handleSaveLocal = () => {
    if (!currentVideo) return;
    const text = serializeLrc(lines);
    updateLyric({
      bvid: currentVideo.bvid,
      lyricText: text,
      offset: lyricEntry?.offset ?? 0,
      cloudLyricId: lyricEntry?.cloudLyricId,
    });
    // 保存即落盘，刷新 dirty 基线，否则退出时仍会被 isDirty 拦截
    setSavedSerialized(text);
    sendNotice({ type: NoticeType.SUCCESS, message: '已保存到本地', duration: 2000 });
  };

  const handleDownload = () => {
    if (!currentVideo) return;
    const text = serializeLrc(lines);
    const filename = `${filterInvalidFileNameChars(currentVideo.title || currentVideo.bvid)}.lrc`;
    textToDownload(text, filename);
  };

  const handleLoadFromFile = () => {
    createLyricFileLoader(
      (text) => {
        mutateLines(() => parseInitial(text));
        sendNotice({ type: NoticeType.SUCCESS, message: '已加载文件', duration: 2000 });
      },
      () => sendNotice({ type: NoticeType.ERROR, message: '文件读取失败', duration: 3000 }),
    );
  };

  const handleUploadCloud = () => {
    if (!isAdmin) {
      sendNotice({ type: NoticeType.WARN, message: '需要管理员权限', duration: 2000 });
      return;
    }
    if (!currentVideo) return;
    openConfirm({
      title: '上传歌词到云端',
      description: '上传后将覆盖云端记录，是否继续？',
      confirmText: '上传',
      destructive: true,
      onConfirm: async () => {
        const content = serializeLrc(lines);
        try {
          const cloudId = lyricEntry?.cloudLyricId;
          let resp;
          if (cloudId) {
            resp = await LyricApi.updateLyric(cloudId, { content });
          } else {
            resp = await LyricApi.createLyric({
              bvid: currentVideo.bvid,
              title: currentVideo.title || currentVideo.bvid,
              content,
            });
          }
          const id = (resp as { id?: number })?.id;
          updateLyric({
            bvid: currentVideo.bvid,
            lyricText: content,
            offset: lyricEntry?.offset ?? 0,
            cloudLyricId: id ?? cloudId,
          });
          // 上传成功 = 远端已持久化，与本地保存语义一致：刷新 dirty 基线
          setSavedSerialized(content);
          sendNotice({ type: NoticeType.SUCCESS, message: '上传成功', duration: 2000 });
        } catch (e) {
          const message = (e as { message?: string })?.message ?? '上传失败';
          sendNotice({ type: NoticeType.ERROR, message, duration: 3000 });
        }
      },
    });
  };

  const handleSearchPick = (lrc: string, _song: QQMusicSong) => {
    void _song;
    mutateLines(() => parseInitial(lrc));
    sendNotice({ type: NoticeType.SUCCESS, message: '已填充歌词', duration: 2000 });
  };

  // === 选择 ===
  const handleToggleSelect = (idx: number, selected: boolean) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (selected) next.add(idx);
      else next.delete(idx);
      return next;
    });
  };

  const handleToggleSelectAll = (selected: boolean) => {
    if (selected) setSelectedRows(new Set(lines.map((_, i) => i)));
    else setSelectedRows(new Set());
  };

  const handleUpdateLine = useCallback(
    (idx: number, line: LyricLine) => {
      mutateLines((prev) => {
        const next = [...prev];
        next[idx] = line;
        next.sort((a, b) => a.time - b.time);
        return next;
      });
    },
    [mutateLines],
  );

  const handleSeek = (timeMs: number) => onSeek?.(timeMs / 1000);

  const currentMillisecond = useMemo(
    () => Math.floor(currentTime * 1000) - (lyricEntry?.offset ?? 0),
    [currentTime, lyricEntry],
  );

  return (
    <div className="flex h-full flex-col">
      <LyricToolbar
        customStep={customStep}
        onCustomStepChange={setCustomStep}
        hasSelection={selectedRows.size > 0}
        hasHistory={history.length > 0}
        isAdmin={isAdmin}
        hasSpider={!!spider}
        onExit={handleRequestExit}
        onSearch={() => setSearchOpen(true)}
        onLoadFromFile={handleLoadFromFile}
        onSaveLocal={handleSaveLocal}
        onUploadCloud={handleUploadCloud}
        onDownloadLrc={handleDownload}
        onShiftAll={handleShiftAll}
        onShiftSelected={handleShiftSelected}
        onInsertHere={handleInsertHere}
        onDeleteSelected={handleDeleteSelected}
        onClearSelection={handleClearSelection}
        onUndo={handleUndo}
      />
      <div className="flex-1 overflow-hidden">
        <LyricTable
          lines={lines}
          selectedRows={selectedRows}
          currentMillisecond={currentMillisecond}
          onSeek={handleSeek}
          onToggleSelect={handleToggleSelect}
          onToggleSelectAll={handleToggleSelectAll}
          onUpdateLine={handleUpdateLine}
        />
      </div>
      <LyricSearchDialog
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        defaultKeyword={currentVideo?.title ?? ''}
        onPick={handleSearchPick}
        spider={spider}
      />
    </div>
  );
}

function parseInitial(text: string): LyricLine[] {
  if (!text) return [];
  try {
    const parsed = parseLRC(text);
    const lyrics = (parsed as { lyrics?: Array<{ timestamp: number; content: string }> }).lyrics;
    if (!lyrics) return [];
    return lyrics
      .map((it) => ({ time: Math.floor(it.timestamp * 1000), content: it.content }))
      .sort((a, b) => a.time - b.time);
  } catch {
    return [];
  }
}

function serializeLrc(lines: LyricLine[]): string {
  return lines.map((l) => `[${formatTimeLyric(l.time)}]${l.content}`).join('\n');
}
