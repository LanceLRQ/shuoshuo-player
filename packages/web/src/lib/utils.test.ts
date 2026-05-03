import { cn } from './utils';

describe('cn', () => {
  it('合并多个类名', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('过滤 falsy 值', () => {
    expect(cn('a', false, undefined, null, 'b')).toBe('a b');
  });

  it('支持对象语法（clsx）', () => {
    expect(cn({ a: true, b: false, c: true })).toBe('a c');
  });

  it('Tailwind 冲突类名后者优先（twMerge）', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });

  it('支持数组嵌套', () => {
    expect(cn(['a', 'b'], 'c')).toBe('a b c');
  });
});
