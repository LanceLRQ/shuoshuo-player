import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * 设置页统一的模块标题：渲染为 `<h3>` 元素，字号比 shadcn 默认 CardTitle（text-2xl）小一档。
 *
 * 设置页同屏可见多个 Card 分组，CardTitle 默认 text-2xl 过于喧宾夺主；
 * 用 h3 + text-base 让模块标题与 CardDescription / 内容形成更平衡的视觉层级。
 *
 * 仅在 packages/web/src/pages/settings/ 下使用；其他页面（home / fav-list 等）继续使用 CardTitle。
 */
export const SectionTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn('text-base font-semibold leading-tight tracking-tight', className)}
    {...props}
  />
));
SectionTitle.displayName = 'SectionTitle';
