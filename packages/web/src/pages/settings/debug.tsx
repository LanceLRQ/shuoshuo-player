import { Bug } from 'lucide-react';
import { CloudSettings } from './cloud';
import { V1DevSeederCard } from '@/components/migration/v1-dev-seeder-card';

/**
 * 调试 tab：仅 dev 模式（__DEV_LOG__=true）下编译进产物，prod 构建整块 DCE。
 * 汇集所有"仅开发者可见"的设置入口，避免污染正式发版的 UI。
 *
 * 当前承载：
 * - 水晶蟹小屋 API 地址（含桌面端解锁）
 * - v1 → v2 迁移测试种子卡片
 *
 * 后续新增 dev-only 设置统一进这里，不再散落到其他 tab。
 */
export function DebugSettings() {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-md border border-dashed border-amber-400 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
        <Bug className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          以下功能仅在开发模式（dev:web / dev:extension /
          dev:desktop）下可见，生产构建不会打包，普通用户看不到此 tab。
        </span>
      </div>
      <CloudSettings />
      <V1DevSeederCard />
    </div>
  );
}
