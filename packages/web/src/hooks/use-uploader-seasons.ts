import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchSeasonArchives,
  fetchUploaderSeasons,
  type BilibiliSeasonMeta,
  type BilibiliSeasonVideo,
  type UploaderSeason,
} from '@shuoshuo-player/shared';

const SEASONS_PAGE_SIZE = 20;
const ARCHIVES_PAGE_SIZE = 30;

/** B 站接口 throw 出的对象/Error 形态不一，统一提取人类可读 message；缺失返回空串由调用方兜底 */
function errMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object' && 'message' in err) {
    const m = (err as { message: unknown }).message;
    if (typeof m === 'string') return m;
  }
  return '';
}

/** 用 mountedRef + 单调递增 fetchId 拦截"已卸载或参数已变"的过期响应，避免回写过期 state */
function useFetchGuard() {
  const fetchIdRef = useRef(0);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  // useMemo 空 deps：保证返回引用稳定，避免被 useCallback deps 误判为变化引发 effect 死循环
  return useMemo(
    () => ({
      next: () => ++fetchIdRef.current,
      valid: (id: number) => mountedRef.current && fetchIdRef.current === id,
    }),
    [],
  );
}

interface UseUploaderSeasonsState {
  items: UploaderSeason[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  isLoading: boolean;
  error: string | null;
}

const INITIAL_SEASONS_STATE: UseUploaderSeasonsState = {
  items: [],
  total: 0,
  page: 1,
  pageSize: SEASONS_PAGE_SIZE,
  hasMore: false,
  isLoading: false,
  error: null,
};

export function useUploaderSeasons(mid: string | undefined) {
  const [state, setState] = useState<UseUploaderSeasonsState>(INITIAL_SEASONS_STATE);
  const guard = useFetchGuard();

  const load = useCallback(
    async (targetPage: number) => {
      if (!mid) return;
      const id = guard.next();
      // 重置 items / total 与 isLoading 合并为一次 setState，避免双 useEffect 触发两次 render
      setState({ ...INITIAL_SEASONS_STATE, page: targetPage, isLoading: true });
      try {
        const result = await fetchUploaderSeasons(mid, targetPage, SEASONS_PAGE_SIZE);
        if (!guard.valid(id)) return;
        setState({
          items: result.items,
          total: result.total,
          page: result.page,
          pageSize: result.pageSize,
          hasMore: result.hasMore,
          isLoading: false,
          error: null,
        });
      } catch (err) {
        if (!guard.valid(id)) return;
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: errMessage(err) || '加载合集列表失败',
        }));
      }
    },
    [mid, guard],
  );

  useEffect(() => {
    if (!mid) {
      setState(INITIAL_SEASONS_STATE);
      return;
    }
    void load(1);
  }, [mid, load]);

  const setPage = useCallback((next: number) => void load(Math.max(1, next)), [load]);
  const refresh = useCallback(() => void load(state.page), [load, state.page]);

  return { ...state, setPage, refresh };
}

interface UseSeasonArchivesState {
  meta: BilibiliSeasonMeta | null;
  archives: BilibiliSeasonVideo[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  isLoading: boolean;
  error: string | null;
}

const INITIAL_ARCHIVES_STATE: UseSeasonArchivesState = {
  meta: null,
  archives: [],
  total: 0,
  page: 1,
  pageSize: ARCHIVES_PAGE_SIZE,
  hasMore: false,
  isLoading: false,
  error: null,
};

export function useSeasonArchives(mid: string | undefined, seasonId: string | undefined) {
  const [state, setState] = useState<UseSeasonArchivesState>(INITIAL_ARCHIVES_STATE);
  const guard = useFetchGuard();

  const load = useCallback(
    async (targetPage: number) => {
      if (!mid || !seasonId) return;
      const id = guard.next();
      setState({ ...INITIAL_ARCHIVES_STATE, page: targetPage, isLoading: true });
      try {
        const result = await fetchSeasonArchives(mid, seasonId, targetPage, ARCHIVES_PAGE_SIZE);
        if (!guard.valid(id)) return;
        setState({
          meta: result.meta,
          archives: result.archives,
          total: result.total,
          page: result.page,
          pageSize: result.pageSize,
          hasMore: result.hasMore,
          isLoading: false,
          error: null,
        });
      } catch (err) {
        if (!guard.valid(id)) return;
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: errMessage(err) || '加载合集详情失败',
        }));
      }
    },
    [mid, seasonId, guard],
  );

  useEffect(() => {
    if (!mid || !seasonId) {
      setState(INITIAL_ARCHIVES_STATE);
      return;
    }
    void load(1);
  }, [mid, seasonId, load]);

  const setPage = useCallback((next: number) => void load(Math.max(1, next)), [load]);

  return { ...state, setPage };
}

interface UseSeasonAllArchivesState {
  isLoading: boolean;
  archives: BilibiliSeasonVideo[];
  /** 已拉取条数（hasMore=false 时与 total 一致） */
  loaded: number;
  /** 合集总视频数（首页响应即知，用于按钮进度文案 X/Y） */
  total: number;
  error: string | null;
  /** 本次全量拉取是否成功收尾 */
  done: boolean;
}

const INITIAL_ALL_STATE: UseSeasonAllArchivesState = {
  isLoading: false,
  archives: [],
  loaded: 0,
  total: 0,
  error: null,
  done: false,
};

/**
 * 按需触发的全量拉取。
 *
 * 拉取策略：先取 page=1 拿到 total，再 Promise.all 并发拉剩余页。
 * client.ts 已对 B 站请求做 100ms 间隔限速（rateLimitGate），并发 Promise.all
 * 在客户端层并行触发但底层串行排队，省去逐 await 的额外 render 往返。
 * 单页失败立即停止，已拉的部分保留供 UI 决策。
 */
export function useSeasonAllArchives(mid: string | undefined, seasonId: string | undefined) {
  const [state, setState] = useState<UseSeasonAllArchivesState>(INITIAL_ALL_STATE);
  const guard = useFetchGuard();

  useEffect(() => {
    setState(INITIAL_ALL_STATE);
  }, [mid, seasonId]);

  const trigger = useCallback(async (): Promise<BilibiliSeasonVideo[] | null> => {
    if (!mid || !seasonId) return null;
    const id = guard.next();
    setState({ ...INITIAL_ALL_STATE, isLoading: true });
    try {
      const first = await fetchSeasonArchives(mid, seasonId, 1, ARCHIVES_PAGE_SIZE);
      if (!guard.valid(id)) return null;
      if (!first.hasMore || first.archives.length === 0) {
        setState({
          isLoading: false,
          archives: first.archives,
          loaded: first.archives.length,
          total: first.total,
          error: null,
          done: true,
        });
        return first.archives;
      }
      setState({
        isLoading: true,
        archives: first.archives,
        loaded: first.archives.length,
        total: first.total,
        error: null,
        done: false,
      });
      const totalPages = Math.max(1, Math.ceil(first.total / ARCHIVES_PAGE_SIZE));
      const rest = await Promise.all(
        Array.from({ length: totalPages - 1 }, (_, i) =>
          fetchSeasonArchives(mid, seasonId, i + 2, ARCHIVES_PAGE_SIZE),
        ),
      );
      if (!guard.valid(id)) return null;
      const all = first.archives.concat(...rest.map((r) => r.archives));
      setState({
        isLoading: false,
        archives: all,
        loaded: all.length,
        total: first.total,
        error: null,
        done: true,
      });
      return all;
    } catch (err) {
      if (!guard.valid(id)) return null;
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: errMessage(err) || '拉取合集失败',
        done: false,
      }));
      return null;
    }
  }, [mid, seasonId, guard]);

  return { ...state, trigger };
}
