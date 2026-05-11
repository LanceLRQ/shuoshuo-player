import { useEffect, useState } from 'react';
import { parseLRC } from '@shuoshuo-player/shared';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export interface LyricSourceEditorDialogProps {
  open: boolean;
  /** 初始 LRC 文本（打开 Dialog 时由父组件序列化当前 lines 传入） */
  initialText: string;
  onClose: () => void;
  /** 保存回调，仅校验通过时触发；父组件用 initialText → parsed lines 替换主编辑器 */
  onSave: (text: string) => void;
}

/**
 * LRC 校验结果。
 * - ok=true：无需阻断，可保存
 * - ok=false：error 必填，UI 内联展示在保存按钮旁
 */
interface ValidateResult {
  ok: boolean;
  error?: string;
}

/** LRC 元信息标签（合法非歌词行），格式如 [ti:Title] / [offset:+200] */
const META_TAG_REGEX = /^\[(ti|ar|al|by|offset|length|re|ve):/i;
/** 单条时间戳：[mm:ss.xxx] 或 [mm:ss:xxx]，分秒位数容忍 1-3 位 */
const TIMESTAMP_PREFIX_REGEX = /^(?:\[\d{1,3}:\d{1,2}[.:]\d{1,3}\])+/;

/**
 * 逐行校验 + lrc-kit 二次确认。
 *
 * 规则：
 * - 空文本视为合法（用户清空歌词的正常路径）
 * - 空行 / 元信息标签行（[ti:] 等）跳过
 * - 其它行必须以一个或多个时间戳前缀开头，否则视为格式错误
 * - 全部前置规则通过后，仍要求 lrc-kit 至少能解析出 1 行有效歌词，避免
 *   "全是注释 / 标签但无实际歌词"的退化情况
 *
 * 错误信息只展示前 5 条，避免大文件错误列表撑爆 Dialog。
 */
export function validateLrcText(text: string): ValidateResult {
  if (!text.trim()) return { ok: true };

  const lines = text.split('\n');
  const errors: string[] = [];

  lines.forEach((raw, idx) => {
    const line = raw.trim();
    if (!line) return;
    if (META_TAG_REGEX.test(line)) return;
    if (TIMESTAMP_PREFIX_REGEX.test(line)) return;
    const preview = line.length > 30 ? `${line.slice(0, 30)}…` : line;
    errors.push(`第 ${idx + 1} 行：${preview}`);
  });

  if (errors.length > 0) {
    const head = errors.slice(0, 5).join('\n');
    const tail = errors.length > 5 ? `\n…还有 ${errors.length - 5} 行错误` : '';
    return { ok: false, error: `存在格式错误的歌词行：\n${head}${tail}` };
  }

  try {
    const parsed = parseLRC(text);
    const lyrics = (parsed as { lyrics?: Array<{ timestamp: number; content: string }> }).lyrics;
    if (!lyrics || lyrics.length === 0) {
      return { ok: false, error: '未识别到任何有效歌词行（仅元信息标签无法保存）' };
    }
  } catch (e) {
    return { ok: false, error: `解析失败：${(e as Error)?.message ?? '未知错误'}` };
  }

  return { ok: true };
}

export function LyricSourceEditorDialog({
  open,
  initialText,
  onClose,
  onSave,
}: LyricSourceEditorDialogProps) {
  const [text, setText] = useState(initialText);
  const [error, setError] = useState<string>('');

  // 每次打开 Dialog 时同步 initialText（避免上次未保存的草稿污染下次打开）
  useEffect(() => {
    if (open) {
      setText(initialText);
      setError('');
    }
  }, [open, initialText]);

  const handleSave = () => {
    const result = validateLrcText(text);
    if (!result.ok) {
      setError(result.error ?? '校验失败');
      return;
    }
    setError('');
    onSave(text);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>LRC 源代码编辑</DialogTitle>
          <DialogDescription>
            直接编辑 LRC 文本。保存时会进行格式校验，失败将拒绝替换当前歌词。
          </DialogDescription>
        </DialogHeader>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (error) setError('');
          }}
          spellCheck={false}
          className="h-[60vh] w-full resize-none rounded-md border bg-background p-3 font-mono text-xs leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="[00:01.23]示例歌词"
          aria-label="LRC 源代码"
        />
        {error && (
          <pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
            {error}
          </pre>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={handleSave}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
