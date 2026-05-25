import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { BilibiliVideo } from '@shuoshuo-player/shared';
import { ThumbnailGridCard } from './thumbnail-grid-card';

/** 单卡最小理想宽度（px）：决定窄屏 2-3 列、宽屏 4-6 列的临界 */
const MIN_CARD_WIDTH = 180;
const MIN_COLS = 2;
const MAX_COLS = 6;
/** 列间距 / 行间距（px），对应 Tailwind gap-3 */
const GAP = 12;
const ROW_GAP = 12;
/**
 * 封面之外的卡片附加高度（px）：p-1 上下 8 + gap-1.5 6 + 标题 2 行(text-sm/leading-snug ≈ 38)。
 * 用于由列宽推导行高；偏差只影响滚动条总长，不影响功能（见组件文档）。
 */
const CARD_META_HEIGHT = 52;

export interface ThumbnailGridItem {
  video: BilibiliVideo;
  /** 用于 isPlaying 比对与播放：home 用纯 bvid，fav 用 trackId（可能含 :p<n>） */
  trackId: string;
  explicitPage?: number;
}

export interface VideoThumbnailGridProps {
  items: ThumbnailGridItem[];
  /** 当前播放 trackId，用于卡片高亮 */
  currentTrackId?: string;
  onItemClick: (item: ThumbnailGridItem) => void;
}

/**
 * 3:2 缩略图网格，按「行」虚拟化以支撑上千条投稿。
 *
 * 难点：响应式列数与虚拟化协调。列数必须用 JS 实测容器宽推导（虚拟化要确切列数算行数），
 * 不能只靠 CSS 断点。行高由列宽推导而非 measureElement —— 卡片封面 aspect-[3/2] + 标题
 * line-clamp-2 高度恒定，固定 estimateSize 比逐行测量更稳（避免切列数 / 图片异步 load 抖动）。
 */
export function VideoThumbnailGrid({
  items,
  currentTrackId,
  onItemClick,
}: VideoThumbnailGridProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      // 仅跨整数像素变化才 setState，避免亚像素抖动触发频繁重算
      setContainerWidth((prev) => (Math.abs(prev - w) >= 1 ? w : prev));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const cols = useMemo(() => {
    if (containerWidth <= 0) return MIN_COLS;
    const raw = Math.floor((containerWidth + GAP) / (MIN_CARD_WIDTH + GAP));
    return Math.min(MAX_COLS, Math.max(MIN_COLS, raw));
  }, [containerWidth]);

  const rowHeight = useMemo(() => {
    const colWidth =
      containerWidth > 0 ? (containerWidth - (cols - 1) * GAP) / cols : MIN_CARD_WIDTH;
    return colWidth * (2 / 3) + CARD_META_HEIGHT + ROW_GAP;
  }, [containerWidth, cols]);

  const rowCount = Math.ceil(items.length / cols);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    // 行 overscan 比单列小：每行已含多卡，3 行足够预渲染
    overscan: 3,
  });

  // 列数 / 行高变化后强制按新尺寸重算，否则窗口缩放后行位置错位（重叠或留白）
  useEffect(() => {
    virtualizer.measure();
  }, [virtualizer, rowHeight, cols]);

  const renderRow = useCallback(
    (rowIndex: number) => {
      const start = rowIndex * cols;
      const rowItems = items.slice(start, start + cols);
      return (
        <div
          className="grid"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: GAP }}
        >
          {rowItems.map((item) => (
            <ThumbnailGridCard
              key={item.trackId}
              video={item.video}
              explicitPage={item.explicitPage}
              isPlaying={currentTrackId === item.trackId}
              onClick={() => onItemClick(item)}
            />
          ))}
        </div>
      );
    },
    [items, cols, currentTrackId, onItemClick],
  );

  return (
    <div
      ref={parentRef}
      className="min-h-0 flex-1 overflow-auto rounded-md border p-2"
      style={{ contain: 'strict' }}
    >
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
        {virtualizer.getVirtualItems().map((vr) => (
          <div
            key={vr.key}
            data-index={vr.index}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${vr.start}px)`,
            }}
          >
            {renderRow(vr.index)}
          </div>
        ))}
      </div>
    </div>
  );
}
