import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type * as React from 'react';

/**
 * 歌词表「拖动框选 + Ctrl/Cmd/Shift 多选」交互 hook。
 *
 * 仅服务歌词编辑器三表（主表 / 暂存表 / 对比视图）。整行均可触发拖动框选；
 * 复选框、输入框、跳转按钮等交互元素通过 closest() 排除，由元素自身处理。
 * 长按超过 LONG_PRESS_MS 后才允许触发拖动，防止 cmd+click 等修饰键操作误触。
 *
 * 事件用 Mouse 而非 Pointer：jsdom 对 PointerEvent 支持有限，Mouse 交互等价且测试更稳。
 */

/** 拖动判定阈值（px）：未超过视为点击，交给修饰键单选逻辑 */
export const DRAG_THRESHOLD = 4;
/** 长按触发拖动的时间阈值（ms）：防止 cmd+click 时微小移动误触拖动 */
export const LONG_PRESS_MS = 200;
/** 边缘自动滚动触发带宽（px） */
export const AUTO_SCROLL_EDGE = 32;
/** 边缘自动滚动速度（px/帧） */
export const AUTO_SCROLL_SPEED = 12;
/**
 * 行内交互元素选择器：点中这些子元素时不触发整行的选中/拖动框选，
 * 交给元素自身处理（复选框 toggle、编辑输入框、跳播放按钮）。
 */
const INTERACTIVE_SELECTOR = '[role="checkbox"],input,textarea,[data-seek-btn]';

export interface RowRect {
  idx: number;
  top: number;
  bottom: number;
}

export interface SelectionRange {
  top: number;
  bottom: number;
}

/**
 * Y 轴矩形相交命中：整行选择，不判 X（选框只要纵向覆盖到行即命中）。
 * 抽为纯函数便于无 DOM 单测。
 */
export function computeHitRows(rowRects: RowRect[], sel: SelectionRange): Set<number> {
  const lo = Math.min(sel.top, sel.bottom);
  const hi = Math.max(sel.top, sel.bottom);
  const hit = new Set<number>();
  for (const r of rowRects) {
    if (r.bottom >= lo && r.top <= hi) hit.add(r.idx);
  }
  return hit;
}

/**
 * 修饰键单击的选择集变换（纯函数，便于单测）：
 *  - shift + 有锚点：选 [min(anchor,idx), max] 连续段（替换）
 *  - ctrl/cmd：toggle 该行（加/减选，即「反选」）
 *  - 普通：单选该行（替换整个选择集）
 */
export function applyModifierClick(
  prev: Set<number>,
  idx: number,
  anchor: number | null,
  mod: { ctrl: boolean; shift: boolean },
): Set<number> {
  if (mod.shift && anchor != null) {
    const lo = Math.min(anchor, idx);
    const hi = Math.max(anchor, idx);
    const next = new Set<number>();
    for (let i = lo; i <= hi; i++) next.add(i);
    return next;
  }
  if (mod.ctrl) {
    const next = new Set(prev);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    return next;
  }
  return new Set([idx]);
}

export interface MarqueeRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface UseRowRangeSelectionParams {
  selectedRows: Set<number>;
  setSelectedRows: (next: Set<number>) => void;
  /** 总行数：仅用于切曲（列表替换）时重置锚点 */
  rowCount: number;
  containerRef: RefObject<HTMLDivElement | null>;
  /** 编辑态（任一行 input 激活）时禁用拖动框选，防误操作；修饰键单选仍可用 */
  disabled?: boolean;
}

interface RowRangeSelectionApi {
  /** 挂到整行 TableRow：拖动框选起点 + 单击/修饰键选中（自动排除复选框/输入框/跳转按钮） */
  getRowHandlers: (idx: number) => {
    onMouseDown: (e: React.MouseEvent) => void;
    onClick: (e: React.MouseEvent) => void;
  };
  marquee: MarqueeRect | null;
  /** 给行/格 onDoubleClick 守卫：拖动刚结束时为 true，吞掉尾随的 click/dblclick */
  suppressNextClick: () => boolean;
}

export function useRowRangeSelection({
  selectedRows,
  setSelectedRows,
  rowCount,
  containerRef,
  disabled = false,
}: UseRowRangeSelectionParams): RowRangeSelectionApi {
  const anchorRef = useRef<number | null>(null);
  const dragModeRef = useRef<'replace' | 'append'>('replace');
  const dragBaseRef = useRef<Set<number>>(new Set());
  // 视口坐标起点：仅用于 DRAG_THRESHOLD 判定
  const startPointRef = useRef<{ x: number; y: number } | null>(null);
  // 内容坐标起点：mousedown 那一刻固定（含当时 scrollTop），命中以它为准，
  // 这样自动滚动时起点不随滚动漂移，选框向滚动方向正确扩展、不漏选滚出可视区的行。
  const startContentRef = useRef<{ x: number; y: number } | null>(null);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
  const movedRef = useRef(false);
  const suppressClickRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  // 长按拖动就绪标记：只有长按超过 LONG_PRESS_MS 后才允许触发拖动，防止 cmd+click 误触
  const dragReadyRef = useRef(false);
  const pressTimerRef = useRef<number | null>(null);
  // window 监听引用：卸载/禁用时移除，避免泄漏与回调打到已卸载组件
  const moveHandlerRef = useRef<((e: MouseEvent) => void) | null>(null);
  const upHandlerRef = useRef<(() => void) | null>(null);
  // 给 window 回调读最新 selectedRows，规避闭包陈旧
  const selectedRef = useRef(selectedRows);
  selectedRef.current = selectedRows;

  const [marquee, setMarquee] = useState<MarqueeRect | null>(null);

  const stopAutoScroll = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const removeWindowListeners = useCallback(() => {
    if (moveHandlerRef.current) window.removeEventListener('mousemove', moveHandlerRef.current);
    if (upHandlerRef.current) window.removeEventListener('mouseup', upHandlerRef.current);
    moveHandlerRef.current = null;
    upHandlerRef.current = null;
    // 清理长按计时器
    if (pressTimerRef.current != null) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  }, []);

  // 重算选框矩形 + 命中行。选框与命中统一用「容器内容坐标」消化滚动偏移。
  const updateMarqueeAndHit = useCallback(() => {
    const container = containerRef.current;
    const startContent = startContentRef.current;
    const cur = lastPointerRef.current;
    if (!container || !startContent || !cur) return;

    const cRect = container.getBoundingClientRect();
    const { scrollTop, scrollLeft } = container;
    // 当前点视口坐标 → 内容坐标；起点已是固定内容坐标
    const curContentY = cur.y - cRect.top + scrollTop;
    const curContentX = cur.x - cRect.left + scrollLeft;
    const selTop = Math.min(startContent.y, curContentY);
    const selBottom = Math.max(startContent.y, curContentY);
    const selLeft = Math.min(startContent.x, curContentX);
    const selRight = Math.max(startContent.x, curContentX);
    setMarquee({
      left: selLeft,
      top: selTop,
      width: selRight - selLeft,
      height: selBottom - selTop,
    });

    const rowRects: RowRect[] = [];
    container.querySelectorAll<HTMLElement>('[data-row]').forEach((el) => {
      const idx = Number(el.dataset.row);
      if (Number.isNaN(idx)) return;
      const r = el.getBoundingClientRect();
      rowRects.push({
        idx,
        top: r.top - cRect.top + scrollTop,
        bottom: r.bottom - cRect.top + scrollTop,
      });
    });
    const hit = computeHitRows(rowRects, { top: selTop, bottom: selBottom });

    if (dragModeRef.current === 'append') {
      setSelectedRows(new Set([...dragBaseRef.current, ...hit]));
    } else {
      setSelectedRows(hit);
    }
    if (anchorRef.current == null) {
      const first = [...hit][0];
      if (first != null) anchorRef.current = first;
    }
  }, [containerRef, setSelectedRows]);

  const maybeAutoScroll = useCallback(
    (clientY: number) => {
      const c = containerRef.current;
      if (!c) return;
      const cRect = c.getBoundingClientRect();
      let dir = 0;
      if (clientY < cRect.top + AUTO_SCROLL_EDGE) dir = -1;
      else if (clientY > cRect.bottom - AUTO_SCROLL_EDGE) dir = 1;
      if (dir === 0) {
        stopAutoScroll();
        return;
      }
      if (rafRef.current != null) return; // 已在滚，避免重复 RAF
      const step = () => {
        c.scrollTop += dir * AUTO_SCROLL_SPEED;
        updateMarqueeAndHit(); // 滚动后用 lastPointer 重算命中
        rafRef.current = requestAnimationFrame(step);
      };
      rafRef.current = requestAnimationFrame(step);
    },
    [containerRef, stopAutoScroll, updateMarqueeAndHit],
  );

  const onRowMouseDown = useCallback(
    (e: React.MouseEvent, idx: number) => {
      if (e.button !== 0) return; // 仅左键
      if (disabled) return; // 编辑态禁拖（onClick 修饰键单选不受限）
      // 点中复选框/输入框/跳转按钮时不起拖，交给元素自身
      if ((e.target as HTMLElement).closest(INTERACTIVE_SELECTOR)) return;
      void idx; // idx 仅用于语义对齐；命中由几何决定
      startPointRef.current = { x: e.clientX, y: e.clientY };
      // 固定起点的内容坐标（含起拖时 scrollTop），后续滚动不再改变它
      const c = containerRef.current;
      if (c) {
        const r = c.getBoundingClientRect();
        startContentRef.current = {
          x: e.clientX - r.left + c.scrollLeft,
          y: e.clientY - r.top + c.scrollTop,
        };
      }
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
      movedRef.current = false;
      dragReadyRef.current = false;
      dragModeRef.current = e.metaKey || e.ctrlKey ? 'append' : 'replace';
      dragBaseRef.current = new Set(selectedRef.current);

      // 长按计时器：只有超过 LONG_PRESS_MS 才允许触发拖动
      pressTimerRef.current = window.setTimeout(() => {
        dragReadyRef.current = true;
      }, LONG_PRESS_MS);

      const onMove = (ev: MouseEvent) => {
        const start = startPointRef.current;
        if (!start) return;
        lastPointerRef.current = { x: ev.clientX, y: ev.clientY };
        if (!movedRef.current) {
          const dist = Math.hypot(ev.clientX - start.x, ev.clientY - start.y);
          // 同时满足距离阈值和时间阈值才进入拖动模式
          if (dist < DRAG_THRESHOLD || !dragReadyRef.current) return;
          movedRef.current = true;
        }
        updateMarqueeAndHit();
        maybeAutoScroll(ev.clientY);
      };
      const onUp = () => {
        // 清理长按计时器
        if (pressTimerRef.current != null) {
          clearTimeout(pressTimerRef.current);
          pressTimerRef.current = null;
        }
        removeWindowListeners();
        stopAutoScroll();
        if (movedRef.current) {
          // 吞掉拖动尾随的 click/dblclick；微任务后复位，避免永久吞
          suppressClickRef.current = true;
          setTimeout(() => {
            suppressClickRef.current = false;
          }, 0);
        }
        movedRef.current = false;
        dragReadyRef.current = false;
        startPointRef.current = null;
        setMarquee(null);
      };
      moveHandlerRef.current = onMove;
      upHandlerRef.current = onUp;
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [
      containerRef,
      disabled,
      updateMarqueeAndHit,
      maybeAutoScroll,
      stopAutoScroll,
      removeWindowListeners,
    ],
  );

  const onRowClick = useCallback(
    (e: React.MouseEvent, idx: number) => {
      // 点中复选框/输入框/跳转按钮：交给元素自身，不触发整行单选
      if ((e.target as HTMLElement).closest(INTERACTIVE_SELECTOR)) return;
      if (suppressClickRef.current) {
        suppressClickRef.current = false;
        return;
      }
      const ctrl = e.metaKey || e.ctrlKey;
      const shift = e.shiftKey;
      setSelectedRows(
        applyModifierClick(selectedRef.current, idx, anchorRef.current, { ctrl, shift }),
      );
      // shift 连选保留原锚点（便于反复调整区间）；普通/ctrl 把锚点移到当前行
      if (!shift) anchorRef.current = idx;
      else if (anchorRef.current == null) anchorRef.current = idx;
    },
    [setSelectedRows],
  );

  const getRowHandlers = useCallback(
    (idx: number) => ({
      onMouseDown: (e: React.MouseEvent) => onRowMouseDown(e, idx),
      onClick: (e: React.MouseEvent) => onRowClick(e, idx),
    }),
    [onRowMouseDown, onRowClick],
  );

  const suppressNextClick = useCallback(() => suppressClickRef.current, []);

  // 切曲（列表整体替换）时重置锚点；editor 切曲已同步清空 selectedRows
  useEffect(() => {
    anchorRef.current = null;
  }, [rowCount]);

  // 编辑态切到 true：立即中止进行中的拖动，防误操作
  useEffect(() => {
    if (disabled) {
      removeWindowListeners();
      stopAutoScroll();
      movedRef.current = false;
      dragReadyRef.current = false;
      startPointRef.current = null;
      setMarquee(null);
    }
  }, [disabled, removeWindowListeners, stopAutoScroll]);

  // 卸载清理：移除 window 监听 + 取消 RAF
  useEffect(() => {
    return () => {
      removeWindowListeners();
      stopAutoScroll();
    };
  }, [removeWindowListeners, stopAutoScroll]);

  return { getRowHandlers, marquee, suppressNextClick };
}
