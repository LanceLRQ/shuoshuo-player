import type { ComponentType, ReactNode } from 'react';

/**
 * 帮助弹层的通用展示件：被歌词编辑器 / 播放器等多处「使用说明」复用。
 * 仅负责排版（区块标题 + 条目列表），内容由各弹层以 HelpItem[] 注入。
 */

export interface HelpItem {
  /** 条目对应图标（功能型条目用，与界面按钮对应便于按图索骥）；可省略 */
  icon?: ComponentType<{ className?: string }>;
  /** 动作标记（按键 / 双击 / 拖动等），渲染为 Kbd；省略时左列直接显示标题 */
  action?: ReactNode;
  title: string;
  desc: string;
}

/** 行内按键 / 动作标记，统一视觉 */
export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[11px] font-medium text-foreground">
      {children}
    </kbd>
  );
}

export function HelpSection({ title, items }: { title: string; items: HelpItem[] }) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <ul className="space-y-2.5">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-3 text-sm">
            <span className="mt-0.5 flex w-32 shrink-0 items-center gap-1.5">
              {it.icon && <it.icon className="h-4 w-4 shrink-0 text-muted-foreground" />}
              {it.action ? <Kbd>{it.action}</Kbd> : <span className="font-medium">{it.title}</span>}
            </span>
            <span className="flex-1 text-muted-foreground">
              {it.action && <span className="font-medium text-foreground">{it.title}：</span>}
              {it.desc}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
