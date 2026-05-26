import * as React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { cn } from '@/lib/utils';

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> & {
    /** 自定义 thumb 图片（如播放进度条用角色图）；不传则用默认主色圆点 */
    thumbSrc?: string;
  }
>(({ className, orientation = 'horizontal', thumbSrc, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    orientation={orientation}
    className={cn(
      'relative flex touch-none select-none items-center bg-background border-t-[1px] border-t-foreground/32',
      orientation === 'horizontal' ? 'w-full' : 'h-full flex-col',
      className,
    )}
    {...props}
  >
    <SliderPrimitive.Track
      className={cn(
        // Track 用 foreground 的半透明派生（颜色级 alpha 而非 opacity 修饰符）：
        // 旧实现 `bg-foreground opacity-5` 会被 Range 继承，导致已播放/未播放视觉无差；
        // 改用 `bg-foreground/15` 仅影响背景色，Range 的 bg-primary 保持不透明对比清晰。
        // light 下是低透深色 / dark 下是低透浅色，适配 footer / 设置页等多场景
        'relative grow overflow-hidden rounded-full bg-foreground/15',
        orientation === 'horizontal' ? 'h-1.5 w-full' : 'h-full w-1.5',
      )}
    >
      <SliderPrimitive.Range
        // rounded-r-full：已播放部分右端做半圆收尾，与 Track 左侧圆角呼应，视觉更柔和
        className={cn(
          'absolute rounded-r-full bg-primary',
          orientation === 'horizontal' ? 'h-full' : 'w-full',
        )}
      />
    </SliderPrimitive.Track>
    {/* -mt-px 精确抵消 Root 的 border-t-[1px]：负 margin 等于 border 宽度，让 thumb 与 track
        居中对齐。早期用 -mt-0.5（-2px）过补偿了 1px，该固定像素在 Windows 分数 DPI 缩放下
        subpixel 舍入被放大，导致 thumb 明显偏离轨道；用 1px（=border 宽度）则按 DPI 成比例补偿。
        thumbSrc 模式：thumb 占位仍保持 h-4 w-4（不撑高 Root，保证 track 位置与对齐不变），
        图片以 absolute 居中溢出显示，命中区域与默认圆点一致。 */}
    {thumbSrc ? (
      <SliderPrimitive.Thumb className="-mt-px relative block h-4 w-4 rounded-full outline-none transition-colors focus:outline-none focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50">
        <img
          src={thumbSrc}
          alt=""
          draggable={false}
          className="pointer-events-none absolute left-1/2 top-1/2 h-6 w-6 max-w-none -translate-x-1/2 -translate-y-1/2 select-none object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]"
        />
      </SliderPrimitive.Thumb>
    ) : (
      <SliderPrimitive.Thumb className="-mt-px block h-4 w-4 rounded-full bg-primary shadow transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50" />
    )}
  </SliderPrimitive.Root>
));
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
