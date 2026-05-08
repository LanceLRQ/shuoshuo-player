import { useMemo, useState, useCallback } from 'react';
import {
  Search,
  X,
  Loader2,
  AlertCircle,
  ListChecks,
  Plus,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  VideoApi,
  VIDEO_SEARCH_RESULT_HARD_LIMIT,
  useUIStore,
  NoticeType,
  type BilibiliVideo,
} from '@shuoshuo-player/shared';
import { useUIShell } from '@/stores/ui-shell';
import { VideoItem } from '@/components/video-item';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const PAGE_SIZE = 20;
// 由硬上限派生：520 / 20 = 26 页（B 站搜索结果硬上限折算）
const PAGES_HARD_LIMIT = Math.floor(VIDEO_SEARCH_RESULT_HARD_LIMIT / PAGE_SIZE);

// B 站 search/type 接口 order 参数枚举（视频搜索）
type SearchOrder = 'totalrank' | 'click' | 'pubdate' | 'dm' | 'stow' | 'scores';

const SEARCH_ORDER_OPTIONS: ReadonlyArray<{ value: SearchOrder; label: string }> = [
  { value: 'totalrank', label: '综合排序' },
  { value: 'click', label: '最多点击' },
  { value: 'pubdate', label: '最新发布' },
  { value: 'dm', label: '最多弹幕' },
  { value: 'stow', label: '最多收藏' },
  { value: 'scores', label: '最多评论' },
];

interface SearchItem {
  bvid: string;
  aid: number;
  title: string;
  description: string;
  pic: string;
  play: number;
  pubdate: number;
  duration: string;
  author: string;
  mid: number;
}

/** 把 B 站搜索结果映射为 BilibiliVideo（保留 <em> 标签供 htmlTitle 渲染） */
function searchToVideo(item: SearchItem): BilibiliVideo {
  return {
    aid: item.aid,
    bvid: item.bvid,
    created: item.pubdate ?? 0,
    length: item.duration ?? '',
    pic: item.pic ?? '',
    is_union_video: false,
    title: item.title ?? '',
    sub_title: '',
    play: item.play ?? 0,
    comment: 0,
    author: item.author ?? '',
    description: item.description ?? '',
    mid: item.mid,
  };
}

/**
 * 生成分页器页码窗口：当前页 ±2 + 首末页，相邻断档处填 'gap'。
 * 总页数 ≤ 7 时全部展开，避免出现单条 "1 … 2" 的尴尬窗口。
 */
function buildPageWindow(current: number, total: number): Array<number | 'gap'> {
  if (total <= 0) return [];
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const candidate = new Set<number>([
    1,
    total,
    current,
    current - 1,
    current + 1,
    current - 2,
    current + 2,
  ]);
  const sorted = [...candidate].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const out: Array<number | 'gap'> = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) out.push('gap');
    out.push(sorted[i]);
  }
  return out;
}

export function DiscoveryPage() {
  const [keyword, setKeyword] = useState('');
  const [order, setOrder] = useState<SearchOrder>('totalrank');
  const [results, setResults] = useState<BilibiliVideo[]>([]);
  const [page, setPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const sendNotice = useUIStore((s) => s.sendNotice);
  const openAddToFav = useUIShell((s) => s.openAddToFav);
  const openAddToFavBatch = useUIShell((s) => s.openAddToFavBatch);

  // 批量选择
  const [selectMode, setSelectMode] = useState(false);
  const [selectedBvids, setSelectedBvids] = useState<Set<string>>(new Set());

  // 总页数：以 numResults / PAGE_SIZE 上取整，再夹到 PAGES_HARD_LIMIT (26)
  const totalPages = useMemo(() => {
    if (totalResults <= 0) return 0;
    return Math.min(Math.ceil(totalResults / PAGE_SIZE), PAGES_HARD_LIMIT);
  }, [totalResults]);

  const doSearch = useCallback(
    // orderOverride 用于排序切换的同帧调用，避免 setState 异步导致首次重搜索仍走旧值
    async (targetPage: number, orderOverride?: SearchOrder) => {
      const trimmed = keyword.trim();
      if (!trimmed) return;

      const orderToUse = orderOverride ?? order;
      setIsSearching(true);
      try {
        const data = await VideoApi.searchVideo({
          params: {
            search_type: 'video',
            keyword: trimmed,
            order: orderToUse,
            page: targetPage,
            pagesize: PAGE_SIZE,
          },
        });
        const videos = (data.result ?? []).map((it) => searchToVideo(it as SearchItem));
        setResults(videos);
        setPage(targetPage);
        setTotalResults(data.numResults ?? 0);
        setHasSearched(true);
        // 翻页 / 重新搜索 / 排序切换 一律清空已选，避免跨页混淆；selectMode 由用户主动控制
        setSelectedBvids(new Set());
      } catch {
        sendNotice({
          type: NoticeType.ERROR,
          message: '搜索失败，请检查关键词或稍后再试',
          duration: 3000,
        });
      } finally {
        setIsSearching(false);
      }
    },
    [keyword, order, sendNotice],
  );

  const handleOrderChange = useCallback(
    (value: string) => {
      const next = value as SearchOrder;
      setOrder(next);
      if (hasSearched && keyword.trim()) {
        void doSearch(1, next);
      }
    },
    [doSearch, hasSearched, keyword],
  );

  const handlePageChange = useCallback(
    (target: number) => {
      if (target < 1 || target > totalPages || target === page || isSearching) return;
      void doSearch(target);
    },
    [doSearch, isSearching, page, totalPages],
  );

  const handleClear = () => {
    setKeyword('');
    setResults([]);
    setPage(1);
    setTotalResults(0);
    setHasSearched(false);
    setSelectMode(false);
    setSelectedBvids(new Set());
  };

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedBvids(new Set());
  }, []);

  const toggleSelect = useCallback((bvid: string) => {
    setSelectedBvids((prev) => {
      const next = new Set(prev);
      if (next.has(bvid)) next.delete(bvid);
      else next.add(bvid);
      return next;
    });
  }, []);

  const allSelected = useMemo(
    () => results.length > 0 && selectedBvids.size === results.length,
    [results.length, selectedBvids.size],
  );

  const toggleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelectedBvids(new Set());
    } else {
      setSelectedBvids(new Set(results.map((v) => v.bvid)));
    }
  }, [allSelected, results]);

  const handleBatchAddToFav = useCallback(() => {
    if (selectedBvids.size === 0) return;
    const bvids = Array.from(selectedBvids);
    openAddToFavBatch(bvids, { fromSearch: true });
    exitSelectMode();
  }, [selectedBvids, openAddToFavBatch, exitSelectMode]);

  const handleAddToFav = useCallback(
    (video: BilibiliVideo) => {
      openAddToFav(video.bvid, { fromSearch: true });
    },
    [openAddToFav],
  );

  const pageWindow = useMemo(() => buildPageWindow(page, totalPages), [page, totalPages]);
  const exceedHardLimit = totalResults > VIDEO_SEARCH_RESULT_HARD_LIMIT;

  return (
    <div className="flex h-full flex-col gap-4">
      {/* 搜索框 */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索 B 站视频…"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void doSearch(1);
              }
            }}
            className="pl-9"
          />
          {keyword && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
              onClick={handleClear}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
        <Button onClick={() => void doSearch(1)} disabled={!keyword.trim() || isSearching}>
          {isSearching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
        </Button>
        <Select value={order} onValueChange={handleOrderChange} disabled={isSearching}>
          <SelectTrigger className="w-32" aria-label="排序方式">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SEARCH_ORDER_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant={selectMode ? 'default' : 'outline'}
          size="icon"
          title={selectMode ? '退出批量选择' : '批量选择'}
          disabled={!hasSearched || results.length === 0}
          onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
        >
          <ListChecks className="h-4 w-4" />
        </Button>
      </div>

      {/* 状态栏 / 批量工具栏 */}
      {hasSearched && !selectMode && totalResults > 0 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            共 {totalResults} 条结果 · 第 {page} / {totalPages} 页
          </span>
          {exceedHardLimit && (
            <span className="text-muted-foreground/80">
              （最多展示 {VIDEO_SEARCH_RESULT_HARD_LIMIT} 条）
            </span>
          )}
        </div>
      )}
      {hasSearched && selectMode && (
        <div className="flex items-center justify-between gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={exitSelectMode}>
              <X className="h-3 w-3" />
            </Button>
            <span className="text-muted-foreground">
              已选 <span className="font-medium text-foreground">{selectedBvids.size}</span> /{' '}
              {results.length} 条
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={toggleSelectAll}>
              {allSelected ? '取消全选' : '全选'}
            </Button>
            <Button size="sm" disabled={selectedBvids.size === 0} onClick={handleBatchAddToFav}>
              <Plus className="mr-1 h-3 w-3" />
              添加到歌单 ({selectedBvids.size})
            </Button>
          </div>
        </div>
      )}

      {/* 结果列表 */}
      {!hasSearched ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
          <Search className="h-6 w-6" />
          输入关键词，按 Enter 搜索 B 站视频
        </div>
      ) : results.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
          <AlertCircle className="h-6 w-6" />
          没有找到关键词为"{keyword}"的视频
        </div>
      ) : (
        <div className="flex-1 overflow-auto rounded-md border">
          {results.map((video) => (
            <div key={video.bvid} className="px-2 py-1">
              <VideoItem
                video={video}
                showAuthor
                htmlTitle
                fromSearch
                onAddToFav={handleAddToFav}
                selectMode={selectMode}
                selected={selectedBvids.has(video.bvid)}
                onToggleSelect={toggleSelect}
              />
            </div>
          ))}
          {isSearching && (
            <div className="flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              加载中…
            </div>
          )}
        </div>
      )}

      {/* 分页器 */}
      {hasSearched && totalPages > 1 && (
        <nav
          aria-label="搜索结果分页"
          className="flex items-center justify-center gap-1 pt-1 text-sm"
        >
          <Button
            variant="outline"
            size="icon"
            aria-label="上一页"
            disabled={page <= 1 || isSearching}
            onClick={() => handlePageChange(page - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {pageWindow.map((node, idx) =>
            node === 'gap' ? (
              <span key={`gap-${idx}`} className="px-1 text-muted-foreground" aria-hidden="true">
                …
              </span>
            ) : (
              <Button
                key={node}
                variant={node === page ? 'default' : 'outline'}
                size="icon"
                aria-label={`第 ${node} 页`}
                aria-current={node === page ? 'page' : undefined}
                disabled={isSearching}
                onClick={() => handlePageChange(node)}
              >
                {node}
              </Button>
            ),
          )}
          <Button
            variant="outline"
            size="icon"
            aria-label="下一页"
            disabled={page >= totalPages || isSearching}
            onClick={() => handlePageChange(page + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </nav>
      )}
    </div>
  );
}
