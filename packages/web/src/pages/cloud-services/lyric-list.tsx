import { useCallback, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import {
  Search,
  X,
  Plus,
  Edit3,
  History,
  Trash2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import {
  LyricApi,
  useLyricsStore,
  useUIStore,
  NoticeType,
  pickCloudList,
  pickCloudListTotal,
  type CloudLyric,
  type CloudAccount,
  type LyricSnapshot,
  type BilibiliVideo,
} from '@shuoshuo-player/shared';
import { useUIShell } from '@/stores/ui-shell';
import { LyricEditor } from '@/components/lyric-editor/lyric-editor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

const PAGE_SIZE = 20;

/** 把 CloudLyric 包装成最小有效 BilibiliVideo（仅 LyricEditor 需要 bvid + title） */
function toVirtualVideo(lyric: CloudLyric): BilibiliVideo {
  return {
    aid: 0,
    bvid: lyric.bvid,
    created: 0,
    length: '',
    pic: '',
    is_union_video: false,
    title: lyric.title,
    sub_title: '',
    play: 0,
    comment: 0,
    author: '',
    description: '',
  };
}

export function LyricListPage() {
  const sendNotice = useUIStore((s) => s.sendNotice);
  const openConfirm = useUIShell((s) => s.openConfirm);
  const updateLyric = useLyricsStore((s) => s.updateLyric);

  const [list, setList] = useState<CloudLyric[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [pendingKeyword, setPendingKeyword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // 编辑/创建/历史 三个 Dialog
  const [editingLyric, setEditingLyric] = useState<CloudLyric | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createBvid, setCreateBvid] = useState('');
  const [createTitle, setCreateTitle] = useState('');
  const [historyTarget, setHistoryTarget] = useState<CloudLyric | null>(null);
  const [historyList, setHistoryList] = useState<LyricSnapshot[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

  const fetchList = useCallback(
    async (targetPage: number, targetKeyword: string) => {
      setIsLoading(true);
      try {
        const resp = await LyricApi.getLyricList({
          page: targetPage,
          limit: PAGE_SIZE,
          keyword: targetKeyword || undefined,
        });
        const items = pickCloudList<CloudLyric>(resp, {
          entityKey: 'lyric',
          resultKey: 'lyrics',
        });
        setList(items);
        setTotal(pickCloudListTotal(resp, items.length));
      } catch (e) {
        const message = (e as { message?: string })?.message ?? '加载歌词列表失败';
        sendNotice({ type: NoticeType.ERROR, message, duration: 3000 });
      } finally {
        setIsLoading(false);
      }
    },
    [sendNotice],
  );

  useEffect(() => {
    void fetchList(page, keyword);
  }, [fetchList, page, keyword]);

  const handleSearch = () => {
    setPage(1);
    setKeyword(pendingKeyword.trim());
  };

  const handleClearSearch = () => {
    setPendingKeyword('');
    setKeyword('');
    setPage(1);
  };

  const handleOpenEdit = (lyric: CloudLyric) => {
    // 把云端内容写入 lyricMaps，让 LyricEditor 内部 useLyricsStore 取到初始值
    updateLyric({
      bvid: lyric.bvid,
      lyricText: lyric.content,
      offset: 0,
      cloudLyricId: lyric.id,
    });
    setEditingLyric(lyric);
  };

  const handleCloseEdit = () => {
    setEditingLyric(null);
    // 编辑窗口关闭后刷新当前页（更新时间会变）
    void fetchList(page, keyword);
  };

  const handleDelete = (lyric: CloudLyric) => {
    openConfirm({
      title: '删除歌词',
      description: `确认删除 ${lyric.bvid}（${lyric.title}）的歌词？此操作不可撤销。`,
      destructive: true,
      onConfirm: async () => {
        try {
          await LyricApi.deleteLyric(lyric.id);
          sendNotice({ type: NoticeType.SUCCESS, message: '已删除', duration: 2000 });
          // 删除后若当前页只剩一条且非首页，回退一页
          if (list.length === 1 && page > 1) {
            setPage(page - 1);
          } else {
            void fetchList(page, keyword);
          }
        } catch (e) {
          const message = (e as { message?: string })?.message ?? '删除失败';
          sendNotice({ type: NoticeType.ERROR, message, duration: 3000 });
        }
      },
    });
  };

  const handleOpenHistory = async (lyric: CloudLyric) => {
    setHistoryTarget(lyric);
    setHistoryList([]);
    setHistoryLoading(true);
    try {
      const resp = await LyricApi.getLyricHistory(lyric.id);
      const snapshots = pickCloudList<LyricSnapshot>(resp, {
        entityKey: 'lyric_snapshot',
        resultKey: 'lyric_snapshots',
      });
      // entities.account 字典里只放摘要字段（id/nick_name/avatar/role），按 author_id 反查注入
      const accounts = resp?.entities?.account as Record<string, Partial<CloudAccount>> | undefined;
      const joined = snapshots.map((snap) =>
        snap.author_id != null && accounts?.[String(snap.author_id)]
          ? { ...snap, author: accounts[String(snap.author_id)] as CloudAccount }
          : snap,
      );
      setHistoryList(joined);
    } catch (e) {
      const message = (e as { message?: string })?.message ?? '加载历史失败';
      sendNotice({ type: NoticeType.ERROR, message, duration: 3000 });
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleCreate = async () => {
    const bvid = createBvid.trim();
    if (!bvid.match(/^BV[a-zA-Z0-9]{10}$/)) {
      sendNotice({
        type: NoticeType.WARN,
        message: 'BVID 格式不正确（应为 BV + 10 位字符）',
        duration: 3000,
      });
      return;
    }
    try {
      await LyricApi.createLyric({
        bvid,
        title: createTitle.trim() || bvid,
        content: '',
      });
      sendNotice({ type: NoticeType.SUCCESS, message: '已创建', duration: 2000 });
      setCreateOpen(false);
      setCreateBvid('');
      setCreateTitle('');
      void fetchList(page, keyword);
    } catch (e) {
      const message = (e as { message?: string })?.message ?? '创建失败';
      sendNotice({ type: NoticeType.ERROR, message, duration: 3000 });
    }
  };

  return (
    <div className="space-y-4">
      {/* 工具栏 */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索 BV 号或标题"
            value={pendingKeyword}
            onChange={(e) => setPendingKeyword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSearch();
              }
            }}
            className="pl-9"
          />
          {pendingKeyword && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
              onClick={handleClearSearch}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
        <Button onClick={handleSearch} disabled={isLoading}>
          <Search className="h-4 w-4" />
        </Button>
        <Button variant="outline" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />
          新建
        </Button>
      </div>

      {/* 表格 */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">BV 号</TableHead>
              <TableHead>标题</TableHead>
              <TableHead className="w-[160px] whitespace-nowrap">创建 / 更新</TableHead>
              <TableHead className="w-[120px] text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-32 text-center text-sm text-muted-foreground">
                  <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" />
                  加载中…
                </TableCell>
              </TableRow>
            ) : list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-32 text-center text-sm text-muted-foreground">
                  <AlertCircle className="mx-auto mb-2 h-4 w-4" />
                  暂无歌词
                </TableCell>
              </TableRow>
            ) : (
              list.map((lyric) => (
                <TableRow key={lyric.id}>
                  <TableCell className="font-mono text-xs">{lyric.bvid}</TableCell>
                  <TableCell className="max-w-md truncate" title={lyric.title}>
                    {lyric.title}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {/* Unix 秒时间戳，dayjs 默认毫秒，必须 *1000 否则解析为 1970 */}
                    <div>{dayjs(lyric.created_at * 1000).format('YYYY-MM-DD HH:mm')}</div>
                    <div className="text-[10px] opacity-70">
                      {dayjs(lyric.updated_at * 1000).format('YYYY-MM-DD HH:mm')}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {/* whitespace-nowrap + flex-end 防止小屏下三按钮换行成田字 */}
                    <div className="flex items-center justify-end gap-0.5 whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleOpenEdit(lyric)}
                        title="编辑"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => void handleOpenHistory(lyric)}
                        title="历史快照"
                      >
                        <History className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(lyric)}
                        title="删除"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* 分页 */}
      {total > 0 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            共 {total} 条 / 第 {page} / {totalPages} 页
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft className="h-3 w-3" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || isLoading}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      {/* 编辑弹窗 — 嵌入完整 LyricEditor */}
      <Dialog open={!!editingLyric} onOpenChange={(o) => !o && handleCloseEdit()}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>编辑歌词 — {editingLyric?.bvid}</DialogTitle>
            <DialogDescription>{editingLyric?.title}</DialogDescription>
          </DialogHeader>
          {editingLyric && (
            <div className="h-[60vh]">
              <LyricEditor
                currentVideo={toVirtualVideo(editingLyric)}
                currentTime={0}
                onExit={handleCloseEdit}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 创建弹窗 */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建歌词</DialogTitle>
            <DialogDescription>输入 BV 号；创建后可在列表中点击"编辑"补充内容。</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="BV1xxxxxxxxx"
              value={createBvid}
              onChange={(e) => setCreateBvid(e.target.value)}
            />
            <Input
              placeholder="标题（可选，缺省时与 BVID 相同）"
              value={createTitle}
              onChange={(e) => setCreateTitle(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button onClick={() => void handleCreate()}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 历史快照弹窗 */}
      <Dialog open={!!historyTarget} onOpenChange={(o) => !o && setHistoryTarget(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>历史快照 — {historyTarget?.bvid}</DialogTitle>
            <DialogDescription>最多展示 10 条最近的快照（按时间倒序）</DialogDescription>
          </DialogHeader>
          {historyLoading ? (
            <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              加载中…
            </div>
          ) : historyList.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
              暂无历史快照
            </div>
          ) : (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-3">
                {historyList.map((snap) => (
                  <div key={snap.id} className="rounded-md border p-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{dayjs(snap.created_at * 1000).format('YYYY-MM-DD HH:mm:ss')}</span>
                      {(snap.author?.nick_name || snap.author?.user_name) && (
                        <span>by {snap.author.nick_name || snap.author.user_name}</span>
                      )}
                    </div>
                    <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-xs">
                      {snap.content || '（空内容）'}
                    </pre>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
