import { FlaskConical } from 'lucide-react';
import { usePlayerProfileStore, type CollectionPlayBehavior } from '@shuoshuo-player/shared';
import { Card, CardHeader, CardDescription, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { SectionTitle } from './_components';

/**
 * 播放设置子页：集中托管「与播放行为相关」的偏好。
 *
 * 当前承载：
 * - 合集播放行为：「以合集为歌单播放」按钮按下后是替换队列还是追加到队列尾部
 * - 多 P 投稿连续播放（B4 实验项，自 v2 早期实装；本次从外观设置搬迁过来归位）
 *
 * 与外观设置（主题 / 主色 / 悬浮歌词）保持解耦：这里只放"播放器行为"维度的偏好，
 * 视觉表现类配置仍由 appearance.tsx 负责。
 */
export function PlaybackSettings() {
  const collectionPlayBehavior = usePlayerProfileStore((s) => s.collectionPlayBehavior);
  const setCollectionPlayBehavior = usePlayerProfileStore((s) => s.setCollectionPlayBehavior);
  const autoPlayNextPage = usePlayerProfileStore((s) => s.autoPlayNextPage);
  const setAutoPlayNextPage = usePlayerProfileStore((s) => s.setAutoPlayNextPage);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <SectionTitle>合集播放行为</SectionTitle>
          <CardDescription>
            点击 UP 主合集详情页「以合集为歌单播放」按钮时的队列策略，可随时切换。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={collectionPlayBehavior}
            onValueChange={(v) => setCollectionPlayBehavior(v as CollectionPlayBehavior)}
            className="flex flex-col gap-3"
          >
            <div className="flex min-w-0 items-start gap-2">
              <RadioGroupItem
                value="replace"
                id="collection-play-replace"
                className="mt-0.5 shrink-0"
              />
              <Label
                htmlFor="collection-play-replace"
                className="flex min-w-0 flex-1 cursor-pointer flex-col gap-0.5 text-sm font-normal"
              >
                <span>替换当前播放队列</span>
                <span className="text-xs text-muted-foreground">
                  原队列被合集全部歌曲替换，从第一首开始播。
                </span>
              </Label>
            </div>
            <div className="flex min-w-0 items-start gap-2">
              <RadioGroupItem
                value="append"
                id="collection-play-append"
                className="mt-0.5 shrink-0"
              />
              <Label
                htmlFor="collection-play-append"
                className="flex min-w-0 flex-1 cursor-pointer flex-col gap-0.5 text-sm font-normal"
              >
                <span>追加到队列尾部</span>
                <span className="text-xs text-muted-foreground">
                  合集追加到当前队列后面，从合集第一首立即播放。
                </span>
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <SectionTitle className="flex items-center gap-2">
            播放行为
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-normal text-amber-600 dark:text-amber-400">
              <FlaskConical className="h-3 w-3" />
              实验性
            </span>
          </SectionTitle>
          <CardDescription>多 P 投稿播放策略，可随时切换。</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="auto-play-next-page" className="cursor-pointer text-sm font-medium">
              多 P 投稿连续播放
            </Label>
            <Switch
              id="auto-play-next-page"
              checked={autoPlayNextPage}
              onCheckedChange={setAutoPlayNextPage}
              aria-label="多 P 投稿连续播放"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
