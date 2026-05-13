import { useState } from 'react';
import {
  buildMerged,
  getPlatformBridge,
  NoticeType,
  PERSIST_DATA_KEY,
  useUIStore,
  type ImportPayload,
  type MergeMode,
  type ParsedImport,
} from '@shuoshuo-player/shared';
import { ImportDataDialog } from '@/components/dialogs/import-data-dialog';
import { clearV1Storage } from '@/lib/v1-migration';

interface ChoosingFlowProps {
  parsed: ParsedImport;
  onCancel: () => void;
  onCompleted: () => void;
}

/**
 * 复用主界面 ImportDataDialog 完成歌单勾选 + 合并模式选择，
 * 但接管 onConfirm/onCancel：
 * - onConfirm：buildMerged 写回 player_data → clearV1Storage → markCompleted → reload
 * - onCancel：退回主提示弹层（让用户重新选「稍后再说」/「永久放弃」）
 *
 * ParsedImport extends ImportSummary，所以可直接作为 summary prop 透传。
 */
export function ChoosingFlow({ parsed, onCancel, onCompleted }: ChoosingFlowProps) {
  const sendNotice = useUIStore((s) => s.sendNotice);
  const [importing, setImporting] = useState(false);

  const handleConfirm = async (mode: MergeMode, selectedFavIds: Set<string>) => {
    if (importing) return;
    setImporting(true);

    // 第一步：合并并写回 v2 player_data（关键步骤，失败 = 数据未写入）
    try {
      const { storage } = getPlatformBridge();
      const raw = await storage.getItem(PERSIST_DATA_KEY);
      const all = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      const merged = buildMerged(
        {
          fav_list: all.fav_list as never,
          lyrics: all.lyrics as never,
          bili_videos: all.bili_videos as never,
          favorites: all.favorites as never,
        },
        parsed.payload as ImportPayload,
        mode,
        selectedFavIds,
      );
      // 仅写回 fav_list / lyrics / bili_videos / favorites；其他持久化项保持现状
      const next = {
        ...all,
        fav_list: merged.fav_list,
        lyrics: merged.lyrics,
        bili_videos: merged.bili_videos,
        favorites: merged.favorites,
      };
      await storage.setItem(PERSIST_DATA_KEY, JSON.stringify(next));
    } catch (err) {
      // 写数据失败 → 数据未持久化，直接报错让用户重试。重试不会产生重复（buildMerged 未生效）
      console.debug('[v1-migration] write merged data failed', err);
      sendNotice({ type: NoticeType.ERROR, message: '迁移失败，请重试', duration: 3000 });
      setImporting(false);
      return;
    }

    // 数据已成功写入 → 此后任何失败都不应让用户重试整个迁移（否则 buildMerged 会把已合并数据再合并一次造成歌单条目重复）
    onCompleted();

    // 第二步：清理 v1 storage（非关键）。失败时降级为「成功 + 清理失败」提示，仍 reload
    try {
      await clearV1Storage();
      sendNotice({
        type: NoticeType.SUCCESS,
        message: '旧数据迁移成功，即将刷新',
        duration: 1500,
      });
    } catch (err) {
      console.debug('[v1-migration] clearV1Storage failed (data already migrated)', err);
      sendNotice({
        type: NoticeType.WARN,
        message: '迁移已完成，但旧数据清理失败；下次启动可能仍会提示，到时选「永久放弃」即可',
        duration: 4000,
      });
    }

    setTimeout(() => window.location.reload(), 1500);
  };

  return (
    <ImportDataDialog
      open
      summary={parsed}
      onCancel={importing ? () => {} : onCancel}
      onConfirm={handleConfirm}
    />
  );
}
