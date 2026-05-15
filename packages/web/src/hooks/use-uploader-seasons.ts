import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchCollectionArchives,
  fetchUploaderCollections,
  type BilibiliSeasonVideo,
  type UploaderCollection,
  type UploaderCollectionSource,
} from '@shuoshuo-player/shared';

const COLLECTIONS_PAGE_SIZE = 20;
const ARCHIVES_PAGE_SIZE = 30;

function errMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object' && 'message' in err) {
    const m = (err as { message: unknown }).message;
    if (typeof m === 'string') return m;
  }
  return '';
}

/** mountedRef + 单调递增 fetchId 拦截"已卸载或参数已变"的过期响应 */
function useFetchGuard() {
  const fetchIdRef = useRef(0);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  // useMemo 空 deps：保证返回引用稳定，避免被 useCallback deps 误判变化引发 effect 死循环
  return useMemo(
    () => ({
      next: () => ++fetchIdRef.current,
      valid: (id: number) => mountedRef.current && fetchIdRef.current === id,
    }),
    [],
  );
}

interface UseUploaderCollectionsState {
  items: UploaderCollection[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  isLoading: boolean;
  error: string | null;
}

const INITIAL_COLLECTIONS_STATE: UseUploaderCollectionsState = {
  items: [],
  total: 0,
  page: 1,
  pageSize: COLLECTIONS_PAGE_SIZE,
  hasMore: false,
  isLoading: false,
  error: null,
};

export function useUploaderCollections(mid: string | undefined) {
  const [state, setState] = useState<UseUploaderCollectionsState>(INITIAL_COLLECTIONS_STATE);
  const guard = useFetchGuard();

  const load = useCallback(
    async (targetPage: number) => {
      if (!mid) return;
      const id = guard.next();
      setState({ ...INITIAL_COLLECTIONS_STATE, page: targetPage, isLoading: true });
      try {
        const result = await fetchUploaderCollections(mid, targetPage, COLLECTIONS_PAGE_SIZE);
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
      setState(INITIAL_COLLECTIONS_STATE);
      return;
    }
    void load(1);
  }, [mid, load]);

  const setPage = useCallback((next: number) => void load(Math.max(1, next)), [load]);
  const refresh = useCallback(() => void load(state.page), [load, state.page]);

  return { ...state, setPage, refresh };
}

interface UseCollectionArchivesState {
  name: string;
  description: string;
  cover: string;
  archives: BilibiliSeasonVideo[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  isLoading: boolean;
  error: string | null;
}

const INITIAL_ARCHIVES_STATE: UseCollectionArchivesState = {
  name: '',
  description: '',
  cover: '',
  archives: [],
  total: 0,
  page: 1,
  pageSize: ARCHIVES_PAGE_SIZE,
  hasMore: false,
  isLoading: false,
  error: null,
};

/**
 * 拉取合集/系列内视频分页。
 *
 * series API 不返回 meta，由调用方从列表页传入的 collection 数据兜底（参数 fallbackMeta）。
 */
export function useCollectionArchives(
  mid: string | undefined,
  source: UploaderCollectionSource | undefined,
  collectionId: string | undefined,
  fallbackMeta?: { name: string; description: string; cover: string },
) {
  const [state, setState] = useState<UseCollectionArchivesState>(INITIAL_ARCHIVES_STATE);
  const guard = useFetchGuard();
  // 用 ref 持有 fallbackMeta，避免组件每次 render 传入新对象引用导致 load deps 变化 → effect 死循环
  const fallbackMetaRef = useRef(fallbackMeta);
  useEffect(() => {
    fallbackMetaRef.current = fallbackMeta;
  });

  const load = useCallback(
    async (targetPage: number) => {
      if (!mid || !source || !collectionId) return;
      const id = guard.next();
      setState({ ...INITIAL_ARCHIVES_STATE, page: targetPage, isLoading: true });
      try {
        const result = await fetchCollectionArchives(
          mid,
          source,
          collectionId,
          targetPage,
          ARCHIVES_PAGE_SIZE,
        );
        if (!guard.valid(id)) return;
        const fb = fallbackMetaRef.current;
        setState({
          name: result.name ?? fb?.name ?? '',
          description: result.description ?? fb?.description ?? '',
          cover: result.cover ?? fb?.cover ?? '',
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
    [mid, source, collectionId, guard],
  );

  useEffect(() => {
    if (!mid || !source || !collectionId) {
      setState(INITIAL_ARCHIVES_STATE);
      return;
    }
    void load(1);
  }, [mid, source, collectionId, load]);

  const setPage = useCallback((next: number) => void load(Math.max(1, next)), [load]);

  return { ...state, setPage };
}

interface UseCollectionAllArchivesState {
  isLoading: boolean;
  archives: BilibiliSeasonVideo[];
  loaded: number;
  total: number;
  error: string | null;
  done: boolean;
}

const INITIAL_ALL_STATE: UseCollectionAllArchivesState = {
  isLoading: false,
  archives: [],
  loaded: 0,
  total: 0,
  error: null,
  done: false,
};

/**
 * 按需触发的全量拉取（用于「以合集为歌单播放」/「全部加入歌单」按钮）。
 *
 * 策略：先取 page=1 拿到 total，再 Promise.all 并发拉剩余页。
 * client.ts 已对 B 站请求做 100ms 间隔限速，并发触发但底层串行排队。
 */
export function useCollectionAllArchives(
  mid: string | undefined,
  source: UploaderCollectionSource | undefined,
  collectionId: string | undefined,
) {
  const [state, setState] = useState<UseCollectionAllArchivesState>(INITIAL_ALL_STATE);
  const guard = useFetchGuard();

  useEffect(() => {
    setState(INITIAL_ALL_STATE);
  }, [mid, source, collectionId]);

  const trigger = useCallback(async (): Promise<BilibiliSeasonVideo[] | null> => {
    if (!mid || !source || !collectionId) return null;
    const id = guard.next();
    setState({ ...INITIAL_ALL_STATE, isLoading: true });
    try {
      const first = await fetchCollectionArchives(mid, source, collectionId, 1, ARCHIVES_PAGE_SIZE);
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
          fetchCollectionArchives(mid, source, collectionId, i + 2, ARCHIVES_PAGE_SIZE),
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
  }, [mid, source, collectionId, guard]);

  return { ...state, trigger };
}
