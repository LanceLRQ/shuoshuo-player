import * as React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { cn } from '@/lib/utils';

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, orientation = 'horizontal', ...props }, ref) => (
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
        className={cn('absolute bg-primary', orientation === 'horizontal' ? 'h-full' : 'w-full')}
      />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb className="-mt-0.5 block h-4 w-4 rounded-full bg-primary shadow transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50" />
  </SliderPrimitive.Root>
));
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
