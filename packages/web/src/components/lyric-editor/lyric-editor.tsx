import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  useLyricsStore,
  useCloudServiceStore,
  useUIStore,
  LyricApi,
  getPlatformBridge,
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
import { LyricCompareView } from './lyric-compare-view';
import { LyricSearchDialog } from '@/components/dialogs/lyric-search-dialog';
import { useUIShell } from '@/stores/ui-shell';

interface LyricEditorProps {
  currentVideo: BilibiliVideo | null;
  /** 当前播放进度（秒），来自 SPlayer */
  currentTime: number;
  /** 双击行触发 seek（秒） */
  onSeek?: (seconds: number) => void;
  onExit: () => void;
  /** 嵌入 Dialog 时由外层关闭按钮承担退出，避免双入口冗余 */
  hideExit?: boolean;
  /**
   * 平台桥接 spider，缺省时自动从 PlatformBridge 取（Tauri 端有，扩展 / Web 无）。
   * 显式传入时优先生效（便于测试桩注入 / 未来多 provider 场景）。
   */
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
  hideExit,
  spider: spiderOverride,
}: LyricEditorProps) {
  // 默认从 PlatformBridge 自取 spider；prop 传入则优先（向后兼容 + 测试桩）。
  // try/catch：bridge 未注入的单测环境（如 lyric-editor.test.tsx 测纯函数时）静默 fallback，
  // 避免抛错传染到无关用例。
  const spider = useMemo<SpiderAdapter | undefined>(() => {
    if (spiderOverride) return spiderOverride;
    try {
      return getPlatformBridge().spider;
    } catch {
      return undefined;
    }
  }, [spiderOverride]);
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
  // 暂存歌词（QQ 音乐搜索 / 文件加载产物）+ 对比视图状态。本地 state，不持久化到云端。
  // 切换曲目时一并清空，避免上一首的搜索结果污染当前曲目。
  const [suggested, setSuggested] = useState<LyricLine[]>([]);
  const [suggestedSelected, setSuggestedSelected] = useState<Set<number>>(new Set());
  const [viewMode, setViewMode] = useState<'single' | 'compare'>('single');
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
    // 暂存与视图模式也一并重置：上一首的搜索结果对当前曲目没有意义
    setSuggested([]);
    setSuggestedSelected(new Set());
    setViewMode('single');
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
          // bvid 寻址：upsert 语义，新增/更新都走同一端点；不依赖本地 cloudLyricId
          const resp = await LyricApi.saveLyric(currentVideo.bvid, {
            title: currentVideo.title || currentVideo.bvid,
            content,
          });
          const id = (resp as { id?: number })?.id;
          updateLyric({
            bvid: currentVideo.bvid,
            lyricText: content,
            offset: lyricEntry?.offset ?? 0,
            cloudLyricId: id ?? lyricEntry?.cloudLyricId,
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

  /**
   * 搜索 dialog 选定歌词后回调：
   *  - 主列表为空：直接填充（与 v1 行为一致，跳过对比步骤）
   *  - 主列表非空：注入暂存 + 自动切到 compare 视图，让用户决定覆盖 / 插入
   */
  const handleSearchPick = (lrc: string, _song: QQMusicSong) => {
    void _song;
    const parsed = parseInitial(lrc);
    if (lines.length === 0) {
      mutateLines(() => parsed);
      sendNotice({ type: NoticeType.SUCCESS, message: '已填充歌词', duration: 2000 });
      return;
    }
    setSuggested(parsed);
    setSuggestedSelected(new Set());
    setViewMode('compare');
    sendNotice({
      type: NoticeType.SUCCESS,
      message: `已加入暂存（${parsed.length} 行），可对比后覆盖或插入`,
      duration: 2500,
    });
  };

  // === 对比视图操作 ===

  /** 用整个暂存替换主列表（推入 history，可撤销还原） */
  const handleOverwriteFromSuggested = () => {
    if (suggested.length === 0) return;
    mutateLines(() => suggested.map((l) => ({ ...l })));
    sendNotice({ type: NoticeType.SUCCESS, message: '已用暂存覆盖当前歌词', duration: 2000 });
  };

  /** 把暂存中选中的行追加到主列表，按 timestamp 排序（与 v1 同语义） */
  const handleInsertSelectedFromSuggested = () => {
    if (suggestedSelected.size === 0) return;
    const picked = suggested.filter((_, idx) => suggestedSelected.has(idx));
    mutateLines((prev) => {
      const next = [...prev, ...picked.map((l) => ({ ...l }))];
      next.sort((a, b) => a.time - b.time);
      return next;
    });
    setSuggestedSelected(new Set());
    sendNotice({
      type: NoticeType.SUCCESS,
      message: `已插入 ${picked.length} 行`,
      duration: 2000,
    });
  };

  /** 把暂存所有行追加到主列表，按 timestamp 排序 */
  const handleInsertAllFromSuggested = () => {
    if (suggested.length === 0) return;
    mutateLines((prev) => {
      const next = [...prev, ...suggested.map((l) => ({ ...l }))];
      next.sort((a, b) => a.time - b.time);
      return next;
    });
    sendNotice({
      type: NoticeType.SUCCESS,
      message: `已插入全部 ${suggested.length} 行`,
      duration: 2000,
    });
  };

  /** 清空暂存并回到 single 视图 */
  const handleClearSuggested = () => {
    setSuggested([]);
    setSuggestedSelected(new Set());
    setViewMode('single');
  };

  // === 暂存列表选择 ===
  const handleSuggestedToggleSelect = (idx: number, selected: boolean) => {
    setSuggestedSelected((prev) => {
      const next = new Set(prev);
      if (selected) next.add(idx);
      else next.delete(idx);
      return next;
    });
  };

  const handleSuggestedToggleSelectAll = (selected: boolean) => {
    if (selected) setSuggestedSelected(new Set(suggested.map((_, i) => i)));
    else setSuggestedSelected(new Set());
  };

  /** 视图切换：仅 suggested 非空时可切（toolbar 已通过 canToggleView 限制按钮可见性） */
  const handleToggleViewMode = () => {
    if (suggested.length === 0) return;
    setViewMode((m) => (m === 'compare' ? 'single' : 'compare'));
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
        hideExit={hideExit}
        viewMode={viewMode}
        canToggleView={suggested.length > 0}
        onToggleViewMode={handleToggleViewMode}
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
      <div className="min-h-0 flex-1 overflow-hidden p-2">
        {viewMode === 'compare' && suggested.length > 0 ? (
          <LyricCompareView
            mainLines={lines}
            mainSelectedRows={selectedRows}
            currentMillisecond={currentMillisecond}
            onMainSeek={handleSeek}
            onMainToggleSelect={handleToggleSelect}
            onMainToggleSelectAll={handleToggleSelectAll}
            onMainUpdateLine={handleUpdateLine}
            suggestedLines={suggested}
            suggestedSelected={suggestedSelected}
            onSuggestedToggleSelect={handleSuggestedToggleSelect}
            onSuggestedToggleSelectAll={handleSuggestedToggleSelectAll}
            onSuggestedSeek={handleSeek}
            onOverwrite={handleOverwriteFromSuggested}
            onInsertSelected={handleInsertSelectedFromSuggested}
            onInsertAll={handleInsertAllFromSuggested}
            onClearSuggested={handleClearSuggested}
          />
        ) : (
          <LyricTable
            lines={lines}
            selectedRows={selectedRows}
            currentMillisecond={currentMillisecond}
            onSeek={handleSeek}
            onToggleSelect={handleToggleSelect}
            onToggleSelectAll={handleToggleSelectAll}
            onUpdateLine={handleUpdateLine}
          />
        )}
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
