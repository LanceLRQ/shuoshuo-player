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
      // 迁移成功 → 清理 v1 storage（避免下次启动再触发）
      await clearV1Storage();
      onCompleted();
      sendNotice({
        type: NoticeType.SUCCESS,
        message: '旧数据迁移成功，即将刷新',
        duration: 1500,
      });
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      console.debug('[v1-migration] import failed', err);
      sendNotice({ type: NoticeType.ERROR, message: '迁移失败，请重试', duration: 3000 });
      setImporting(false);
    }
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
