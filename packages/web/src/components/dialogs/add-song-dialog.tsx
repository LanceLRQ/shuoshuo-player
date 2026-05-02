import { useState } from 'react';
import { useFavListStore, useUIStore, NoticeType } from '@shuoshuo-player/shared';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useUIShell } from '@/stores/ui-shell';

const BV_REGEX = /BV[a-zA-Z0-9]{10}/g;

/**
 * 手动添加歌曲弹窗：
 * - 支持粘贴多个 BV 号或 B 站视频 URL，自动用正则提取
 * - 调用 fav-list store 的 addFavVideoByBvids 进行带进度通知的批量添加
 */
export function AddSongDialog() {
  const open = useUIShell((s) => s.addSongOpen);
  const targetFavId = useUIShell((s) => s.addSongTargetFavId);
  const close = useUIShell((s) => s.closeAddSong);
  const addByBvids = useFavListStore((s) => s.addFavVideoByBvids);
  const sendNotice = useUIStore((s) => s.sendNotice);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const matches = Array.from(new Set(text.match(BV_REGEX) ?? []));

  const handleSubmit = async () => {
    if (!targetFavId) return;
    if (matches.length === 0) {
      sendNotice({ type: NoticeType.WARN, message: '未识别到有效的 BV 号', duration: 2000 });
      return;
    }
    setSubmitting(true);
    try {
      await addByBvids(targetFavId, matches);
      setText('');
      close();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : close())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>添加歌曲</DialogTitle>
          <DialogDescription>
            粘贴一个或多个 BV 号 / B 站视频链接，每行一个或用空格分隔
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="bv-text">BV 号 / 视频链接</Label>
          <Textarea
            id="bv-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder="BV1xx411c7mD&#10;https://www.bilibili.com/video/BV1xx411c7mD"
            disabled={submitting}
          />
          <p className="text-xs text-muted-foreground">已识别 {matches.length} 个 BV 号</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={submitting}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || matches.length === 0}>
            {submitting ? '添加中…' : `添加 ${matches.length} 首`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
