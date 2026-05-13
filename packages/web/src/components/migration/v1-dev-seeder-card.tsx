import { useState } from 'react';
import { FlaskConical, RotateCcw, Upload } from 'lucide-react';
import { NoticeType, useUIStore } from '@shuoshuo-player/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useUIShell } from '@/stores/ui-shell';
import { resetAllStorage, seedV1FromExportJson } from '@/lib/v1-migration';

/**
 * 【仅开发模式】v1 → v2 迁移测试入口
 *
 * 使用场景：开发者本地用「加载已解压扩展程序」装 v2 时，由于 extension ID 与
 * 商店版本不同，无法继承真实 v1 用户的 chrome.storage.local 数据。本卡片提供
 * 上传 v1 导出 JSON 反向写入 storage 的能力，模拟「老用户升级」场景验证迁移流程。
 *
 * 守卫：调用方用 `__DEV_LOG__ && <V1DevSeederCard />`，prod 构建整块 DCE。
 */
export function V1DevSeederCard() {
  const sendNotice = useUIStore((s) => s.sendNotice);
  const openConfirm = useUIShell((s) => s.openConfirm);
  const [seeding, setSeeding] = useState(false);

  const handleSeedV1 = () => {
    if (seeding) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setSeeding(true);
      try {
        const text = await file.text();
        const json = JSON.parse(text) as Record<string, unknown>;
        const result = await seedV1FromExportJson(json);
        sendNotice({
          type: NoticeType.SUCCESS,
          message: `已写入 ${result.writtenKeys.length} 个 v1 key（${result.writtenKeys.join(', ')}），v2 现有设置已保留，即将刷新触发迁移`,
          duration: 2500,
        });
        setTimeout(() => window.location.reload(), 2500);
      } catch (err) {
        console.debug('[v1-migration-dev] seed failed', err);
        sendNotice({
          type: NoticeType.ERROR,
          message: `注入失败：${err instanceof Error ? err.message : String(err)}`,
          duration: 4000,
        });
        setSeeding(false);
      }
    };
    input.click();
  };

  const handleResetAll = () => {
    openConfirm({
      title: '清空所有 storage？',
      description:
        '会删除 chrome.storage.local 全部内容（v1 数据、v2 数据、永久放弃标志、登录态等），让扩展回到「首次安装」状态。仅供测试不同入口路径。',
      confirmText: '确认清空并刷新',
      destructive: true,
      onConfirm: async () => {
        try {
          await resetAllStorage();
          sendNotice({
            type: NoticeType.SUCCESS,
            message: '已清空所有 storage，即将刷新',
            duration: 1500,
          });
          setTimeout(() => window.location.reload(), 1500);
        } catch (err) {
          sendNotice({
            type: NoticeType.ERROR,
            message: `清空失败：${err instanceof Error ? err.message : String(err)}`,
            duration: 4000,
          });
        }
      },
    });
  };

  return (
    <Card className="border-dashed border-amber-400/60 bg-amber-50/40 dark:border-amber-700/60 dark:bg-amber-950/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FlaskConical className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          开发者工具：v1 → v2 迁移测试
          <Badge variant="outline" className="ml-1 border-amber-400 text-[10px] uppercase">
            DEV ONLY
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="space-y-2">
          <p className="text-muted-foreground">
            上传一份 v1 导出的 JSON，会反向写入 chrome.storage.local 的 v1 风格 key
            模拟「老用户升级」场景，并清掉「永久放弃」标志触发迁移弹层。v2 现有设置（播放器配置 /
            歌单等）会被保留，不会被覆盖。
          </p>
          <Button variant="outline" size="sm" onClick={handleSeedV1} disabled={seeding}>
            <Upload className="mr-2 h-4 w-4" />
            {seeding ? '注入中…' : '上传 v1 导出 JSON 模拟老用户'}
          </Button>
        </div>
        <div className="space-y-2 border-t border-amber-400/30 pt-3">
          <p className="text-muted-foreground">
            清空 chrome.storage.local 全部内容，让扩展回到「首次安装」状态（含 v1 数据 / v2 数据 /
            永久放弃标志）。
          </p>
          <Button variant="destructive" size="sm" onClick={handleResetAll}>
            <RotateCcw className="mr-2 h-4 w-4" />
            重置 storage
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
