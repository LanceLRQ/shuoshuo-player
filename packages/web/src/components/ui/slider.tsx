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
        // Track 用 foreground 的半透明派生：light 下是低透深色（更深 / 更可辨）；
        // dark 下是低透浅色（更亮 / 更可辨）。比原 bg-secondary 对比度更高，
        // 适配 footer / 设置页等浅底 + 暗底两种场景
        'relative grow overflow-hidden rounded-full bg-foreground opacity-5',
        orientation === 'horizontal' ? 'h-1.5 w-full' : 'h-full w-1.5',
      )}
    >
      <SliderPrimitive.Range
        className={cn('absolute bg-primary', orientation === 'horizontal' ? 'h-full' : 'w-full')}
      />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb className="block h-4 w-4 rounded-full border border-primary/50 bg-background shadow transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50" />
  </SliderPrimitive.Root>
));
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
