import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Search, X, Loader2, AlertCircle, ListChecks, Plus } from 'lucide-react';
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
const ROW_HEIGHT = 108;

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

export function DiscoveryPage() {
  const [keyword, setKeyword] = useState('');
  const [order, setOrder] = useState<SearchOrder>('totalrank');
  const [results, setResults] = useState<BilibiliVideo[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const sendNotice = useUIStore((s) => s.sendNotice);
  const openAddToFav = useUIShell((s) => s.openAddToFav);
  const openAddToFavBatch = useUIShell((s) => s.openAddToFavBatch);

  // 批量选择模式
  const [selectMode, setSelectMode] = useState(false);
  const [selectedBvids, setSelectedBvids] = useState<Set<string>>(new Set());

  const parentRef = useRef<HTMLDivElement>(null);
  const isLoadingMoreRef = useRef(false);

  const doSearch = useCallback(
    // orderOverride 用于排序切换的同帧调用，避免 setState 异步导致首次重搜索仍走旧值
    async (resetPage: boolean, orderOverride?: SearchOrder) => {
      const trimmed = keyword.trim();
      if (!trimmed) return;

      const pn = resetPage ? 1 : page + 1;
      const orderToUse = orderOverride ?? order;
      setIsSearching(true);
      try {
        const data = await VideoApi.searchVideo({
          params: {
            search_type: 'video',
            keyword: trimmed,
            order: orderToUse,
            page: pn,
            pagesize: PAGE_SIZE,
          },
        });
        const videos = (data.result ?? []).map((it) => searchToVideo(it as SearchItem));

        const merged = resetPage ? videos : [...results, ...videos];
        // 硬上限保护（避免 B 站搜索 API 返回超大列表卡顿）
        const trimmedList = merged.slice(0, VIDEO_SEARCH_RESULT_HARD_LIMIT);

        setResults(trimmedList);
        setPage(pn);
        setHasMore(
          videos.length >= PAGE_SIZE && trimmedList.length < VIDEO_SEARCH_RESULT_HARD_LIMIT,
        );
        setHasSearched(true);
        // 重新搜索（resetPage）时清空选中，但保留批量模式
        if (resetPage) setSelectedBvids(new Set());
      } catch {
        sendNotice({
          type: NoticeType.ERROR,
          message: '搜索失败，请检查关键词或稍后再试',
          duration: 3000,
        });
      } finally {
        setIsSearching(false);
        isLoadingMoreRef.current = false;
      }
    },
    [keyword, page, results, sendNotice, order],
  );

  const handleOrderChange = useCallback(
    (value: string) => {
      const next = value as SearchOrder;
      setOrder(next);
      // 仅当已有搜索结果时切换排序立即重新搜索；否则只记录选择，等用户点搜索
      if (hasSearched && keyword.trim()) {
        void doSearch(true, next);
      }
    },
    [doSearch, hasSearched, keyword],
  );

  const handleClear = () => {
    setKeyword('');
    setResults([]);
    setPage(1);
    setHasMore(false);
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
    // 立即退出批量模式（dialog 自身管理后续流程）
    exitSelectMode();
  }, [selectedBvids, openAddToFavBatch, exitSelectMode]);

  // 虚拟列表
  const virtualizer = useVirtualizer({
    count: results.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5,
  });

  // 滚动接近底部时加载下一页
  useEffect(() => {
    const items = virtualizer.getVirtualItems();
    if (items.length === 0) return;
    const lastItem = items[items.length - 1];
    if (
      hasMore &&
      !isSearching &&
      !isLoadingMoreRef.current &&
      lastItem.index >= results.length - 5
    ) {
      isLoadingMoreRef.current = true;
      void doSearch(false);
    }
  }, [virtualizer, hasMore, isSearching, results.length, doSearch]);

  const handleAddToFav = useCallback(
    (video: BilibiliVideo) => {
      openAddToFav(video.bvid, { fromSearch: true });
    },
    [openAddToFav],
  );

  const reachedHardLimit = useMemo(
    () => results.length >= VIDEO_SEARCH_RESULT_HARD_LIMIT,
    [results.length],
  );

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
                void doSearch(true);
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
        <Button onClick={() => void doSearch(true)} disabled={!keyword.trim() || isSearching}>
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
      {hasSearched && !selectMode && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>找到 {results.length} 条结果</span>
          {reachedHardLimit && (
            <span className="text-amber-600">已达 {VIDEO_SEARCH_RESULT_HARD_LIMIT} 条上限</span>
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
        <div
          ref={parentRef}
          className="flex-1 overflow-auto rounded-md border"
          style={{ contain: 'strict' }}
        >
          <div
            style={{
              height: virtualizer.getTotalSize(),
              position: 'relative',
              width: '100%',
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const video = results[virtualRow.index];
              return (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <div className="px-2 py-1">
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
                </div>
              );
            })}
          </div>
          {isSearching && results.length > 0 && (
            <div className="flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              加载更多…
            </div>
          )}
        </div>
      )}
    </div>
  );
}
