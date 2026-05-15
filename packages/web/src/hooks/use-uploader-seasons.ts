import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchCollectionArchives,
  fetchUploaderCollections,
  pickVideosFields,
  useBilibiliVideosStore,
  type BilibiliSeasonVideo,
  type BilibiliVideo,
  type UploaderCollection,
  type UploaderCollectionSource,
} from '@shuoshuo-player/shared';

const COLLECTIONS_PAGE_SIZE = 20;
const ARCHIVES_PAGE_SIZE = 30;
/** 全量拉取的页间隔：避免短时间高频请求被 B 站风控 */
const COLLECTION_PAGE_SLEEP_MS = 200;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 合集 archives 自带 BilibiliVideo 必备字段（bvid/title/pic/created/play/length）。
 * 把它们 upsert 到 useBilibiliVideosStore，让后续「加入歌单」时 addFavVideoByBvids
 * 能从缓存命中而不必再调 B 站 view API（150 条 = 150 次 view + 150 次 toast 抽搐）。
 *
 * 仅写入 entities 中不存在的 bvid——已有 entity 通常来自投稿/收藏夹/view 接口，字段更全，
 * 不应被合集的精简字段（author='' 等空值）覆盖。
 */
function upsertSeasonArchivesIfMissing(archives: BilibiliSeasonVideo[]): void {
  if (archives.length === 0) return;
  const { entities, upsertMany } = useBilibiliVideosStore.getState();
  const missing = archives.filter((a) => !entities[a.bvid]);
  if (missing.length === 0) return;
  const mapped = pickVideosFields(missing, 'season') as BilibiliVideo[];
  upsertMany(mapped);
}

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
        upsertSeasonArchivesIfMissing(result.archives);
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

  /**
   * 按需触发拉取。
   *
   * @param opts.fromPage 起始页（默认 1）
   * @param opts.toPage   结束页（默认拉到 total 对应的最后一页）
   *
   * 拉取节奏：串行 for 循环，页之间 sleep 200ms，避免被 B 站风控。
   * 每页拉完立即 setState 让 UI 进度条平滑变化。
   * cancel() 期间已发的 HTTP 仍会跑完，但 setState 通过 guard.valid 拦截。
   */
  const trigger = useCallback(
    async (opts?: {
      fromPage?: number;
      toPage?: number;
    }): Promise<BilibiliSeasonVideo[] | null> => {
      if (!mid || !source || !collectionId) return null;
      const fromPage = Math.max(1, opts?.fromPage ?? 1);
      const id = guard.next();
      setState({ ...INITIAL_ALL_STATE, isLoading: true });
      const accumulated: BilibiliSeasonVideo[] = [];
      try {
        const first = await fetchCollectionArchives(
          mid,
          source,
          collectionId,
          fromPage,
          ARCHIVES_PAGE_SIZE,
        );
        if (!guard.valid(id)) return null;
        upsertSeasonArchivesIfMissing(first.archives);
        accumulated.push(...first.archives);
        const totalPages = Math.max(1, Math.ceil(first.total / ARCHIVES_PAGE_SIZE));
        const toPage = Math.min(opts?.toPage ?? totalPages, totalPages);
        // 范围内的实际条数（用于进度分母）：min(范围预期, 合集剩余)
        // 不能用 first.total 直接做分母——范围拉取 fromPage>1 时会让进度条永远到不了 100%
        const remoteRemaining = Math.max(0, first.total - (fromPage - 1) * ARCHIVES_PAGE_SIZE);
        const rangeTotal = Math.min((toPage - fromPage + 1) * ARCHIVES_PAGE_SIZE, remoteRemaining);
        // first.archives 为空或已是最后一页 → 收尾返回
        if (first.archives.length === 0 || fromPage >= toPage) {
          setState({
            isLoading: false,
            archives: accumulated.slice(),
            loaded: accumulated.length,
            total: rangeTotal,
            error: null,
            done: true,
          });
          return accumulated;
        }
        setState({
          isLoading: true,
          archives: accumulated.slice(),
          loaded: accumulated.length,
          total: rangeTotal,
          error: null,
          done: false,
        });
        for (let p = fromPage + 1; p <= toPage; p++) {
          await sleep(COLLECTION_PAGE_SLEEP_MS);
          if (!guard.valid(id)) return null; // cancel / unmount 早退
          const result = await fetchCollectionArchives(
            mid,
            source,
            collectionId,
            p,
            ARCHIVES_PAGE_SIZE,
          );
          if (!guard.valid(id)) return null;
          upsertSeasonArchivesIfMissing(result.archives);
          accumulated.push(...result.archives);
          setState((prev) => ({
            ...prev,
            archives: accumulated.slice(),
            loaded: accumulated.length,
          }));
          if (result.archives.length === 0) break; // 防御：B 站偶发返回空页提前止损
        }
        setState((prev) => ({
          ...prev,
          isLoading: false,
          done: true,
        }));
        return accumulated;
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
    },
    [mid, source, collectionId, guard],
  );

  /**
   * 主动中断当前拉取。
   *
   * 实现：guard.next() 让旧 fetchId 失效，剩余 sleep / await 完成后 valid() 返回 false，
   * 函数 return null 不再 setState；同时立即把 isLoading 置 false 让 UI 立刻响应。
   * 已拉部分保留在 archives 字段，供「加入歌单」等后续操作复用。
   *
   * 注：未中断在飞的 HTTP 请求（buildBilibiliApiCall 不支持 AbortSignal）。
   * 因为页间有 sleep，实际泄漏的请求至多 1 个。
   */
  const cancel = useCallback(() => {
    guard.next();
    setState((prev) => ({ ...prev, isLoading: false }));
  }, [guard]);

  return { ...state, trigger, cancel };
}
