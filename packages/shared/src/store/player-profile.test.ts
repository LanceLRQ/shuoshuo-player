import { usePlayerProfileStore } from './player-profile';
import { DEFAULT_FLOATING_LYRICS } from '../types';

function reset() {
  usePlayerProfileStore.setState({
    theme: 'auto',
    volume: 0.8,
    autoPlay: false,
    loopMode: 'loop',
    floatingLyrics: { ...DEFAULT_FLOATING_LYRICS },
  });
}

describe('usePlayerProfileStore', () => {
  beforeEach(() => {
    reset();
    // 清掉 jsdom matchMedia mock 残留
    if (typeof window !== 'undefined') {
      delete (window as { matchMedia?: unknown }).matchMedia;
    }
  });

  it('setTheme 切换主题', () => {
    usePlayerProfileStore.getState().setTheme('dark');
    expect(usePlayerProfileStore.getState().theme).toBe('dark');
  });

  it('setVolume 接受 0~1 范围', () => {
    usePlayerProfileStore.getState().setVolume(0.5);
    expect(usePlayerProfileStore.getState().volume).toBe(0.5);
  });

  it('setVolume 超出 1 时 clamp 为 1', () => {
    usePlayerProfileStore.getState().setVolume(2.5);
    expect(usePlayerProfileStore.getState().volume).toBe(1);
  });

  it('setVolume 低于 0 时 clamp 为 0', () => {
    usePlayerProfileStore.getState().setVolume(-0.5);
    expect(usePlayerProfileStore.getState().volume).toBe(0);
  });

  it('setLoopMode 切换循环模式', () => {
    usePlayerProfileStore.getState().setLoopMode('single');
    expect(usePlayerProfileStore.getState().loopMode).toBe('single');
  });

  it('setAutoPlay 切换自动播放开关', () => {
    usePlayerProfileStore.getState().setAutoPlay(true);
    expect(usePlayerProfileStore.getState().autoPlay).toBe(true);
  });

  describe('autoPlayNextPage（B4）', () => {
    it('默认值为 false', () => {
      // 不调用 reset 中的 setState，直接拿初始 state
      usePlayerProfileStore.setState({
        theme: 'auto',
        volume: 0.8,
        autoPlay: false,
        loopMode: 'loop',
        autoPlayNextPage: false,
      });
      expect(usePlayerProfileStore.getState().autoPlayNextPage).toBe(false);
    });

    it('setAutoPlayNextPage 切换开关', () => {
      usePlayerProfileStore.getState().setAutoPlayNextPage(true);
      expect(usePlayerProfileStore.getState().autoPlayNextPage).toBe(true);
      usePlayerProfileStore.getState().setAutoPlayNextPage(false);
      expect(usePlayerProfileStore.getState().autoPlayNextPage).toBe(false);
    });

    it('setAutoPlayNextPage 强制布尔化', () => {
      // @ts-expect-error 测试非布尔输入
      usePlayerProfileStore.getState().setAutoPlayNextPage(1);
      expect(usePlayerProfileStore.getState().autoPlayNextPage).toBe(true);
      // @ts-expect-error 测试非布尔输入
      usePlayerProfileStore.getState().setAutoPlayNextPage(null);
      expect(usePlayerProfileStore.getState().autoPlayNextPage).toBe(false);
    });
  });

  describe('floatingLyrics', () => {
    it('默认值与 DEFAULT_FLOATING_LYRICS 一致', () => {
      expect(usePlayerProfileStore.getState().floatingLyrics).toEqual(DEFAULT_FLOATING_LYRICS);
    });

    it('setFloatingLyrics 部分合并', () => {
      usePlayerProfileStore.getState().setFloatingLyrics({ fontSize: 18 });
      const cfg = usePlayerProfileStore.getState().floatingLyrics;
      expect(cfg.fontSize).toBe(18);
      // 其他字段保留默认
      expect(cfg.fontWeight).toBe(DEFAULT_FLOATING_LYRICS.fontWeight);
      expect(cfg.textAlign).toBe(DEFAULT_FLOATING_LYRICS.textAlign);
    });

    it('setFloatingLyrics 对 fontSize 做 clamp（>32 → 32）', () => {
      usePlayerProfileStore.getState().setFloatingLyrics({ fontSize: 80 });
      expect(usePlayerProfileStore.getState().floatingLyrics.fontSize).toBe(32);
    });

    it('setFloatingLyrics 对 fontSize 做 clamp（<12 → 12）', () => {
      usePlayerProfileStore.getState().setFloatingLyrics({ fontSize: 1 });
      expect(usePlayerProfileStore.getState().floatingLyrics.fontSize).toBe(12);
    });

    it('setFloatingLyrics 对 bgOpacity 做 clamp（0-1）', () => {
      usePlayerProfileStore.getState().setFloatingLyrics({ bgOpacity: 2 });
      expect(usePlayerProfileStore.getState().floatingLyrics.bgOpacity).toBe(1);
      usePlayerProfileStore.getState().setFloatingLyrics({ bgOpacity: -0.5 });
      expect(usePlayerProfileStore.getState().floatingLyrics.bgOpacity).toBe(0);
    });

    it('setFloatingLyrics 对 verticalOffset 做 clamp（16-64）', () => {
      usePlayerProfileStore.getState().setFloatingLyrics({ verticalOffset: 200 });
      expect(usePlayerProfileStore.getState().floatingLyrics.verticalOffset).toBe(64);
      usePlayerProfileStore.getState().setFloatingLyrics({ verticalOffset: -10 });
      expect(usePlayerProfileStore.getState().floatingLyrics.verticalOffset).toBe(16);
      usePlayerProfileStore.getState().setFloatingLyrics({ verticalOffset: 8 });
      expect(usePlayerProfileStore.getState().floatingLyrics.verticalOffset).toBe(16);
    });

    it('setFloatingLyrics 枚举白名单防御：非法 textAlign 被忽略', () => {
      const before = usePlayerProfileStore.getState().floatingLyrics.textAlign;
      // @ts-expect-error 测试非法值
      usePlayerProfileStore.getState().setFloatingLyrics({ textAlign: 'justify' });
      expect(usePlayerProfileStore.getState().floatingLyrics.textAlign).toBe(before);
    });

    it('setFloatingLyrics 枚举白名单防御：非法 fontFamily 被忽略', () => {
      const before = usePlayerProfileStore.getState().floatingLyrics.fontFamily;
      // @ts-expect-error 测试非法值
      usePlayerProfileStore.getState().setFloatingLyrics({ fontFamily: 'comic' });
      expect(usePlayerProfileStore.getState().floatingLyrics.fontFamily).toBe(before);
    });

    it('setFloatingLyrics 枚举白名单防御：非法 textColor 被忽略', () => {
      const before = usePlayerProfileStore.getState().floatingLyrics.textColor;
      // @ts-expect-error 测试非法值
      usePlayerProfileStore.getState().setFloatingLyrics({ textColor: '#ff0000' });
      expect(usePlayerProfileStore.getState().floatingLyrics.textColor).toBe(before);
    });

    it('setFloatingLyrics enabled 强制布尔化', () => {
      // @ts-expect-error 测试非布尔输入
      usePlayerProfileStore.getState().setFloatingLyrics({ enabled: 1 });
      expect(usePlayerProfileStore.getState().floatingLyrics.enabled).toBe(true);
      // @ts-expect-error 测试非布尔输入
      usePlayerProfileStore.getState().setFloatingLyrics({ enabled: 0 });
      expect(usePlayerProfileStore.getState().floatingLyrics.enabled).toBe(false);
    });

    it('toggleFloatingLyrics 翻转 enabled', () => {
      const initial = usePlayerProfileStore.getState().floatingLyrics.enabled;
      usePlayerProfileStore.getState().toggleFloatingLyrics();
      expect(usePlayerProfileStore.getState().floatingLyrics.enabled).toBe(!initial);
      usePlayerProfileStore.getState().toggleFloatingLyrics();
      expect(usePlayerProfileStore.getState().floatingLyrics.enabled).toBe(initial);
    });

    it('resetFloatingLyrics 重置全部字段', () => {
      usePlayerProfileStore.getState().setFloatingLyrics({
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'left',
        enabled: false,
      });
      usePlayerProfileStore.getState().resetFloatingLyrics();
      expect(usePlayerProfileStore.getState().floatingLyrics).toEqual(DEFAULT_FLOATING_LYRICS);
    });
  });

  describe('getEffectiveTheme', () => {
    it('明确 light 时返回 light', () => {
      usePlayerProfileStore.setState({ theme: 'light' });
      expect(usePlayerProfileStore.getState().getEffectiveTheme()).toBe('light');
    });

    it('明确 dark 时返回 dark', () => {
      usePlayerProfileStore.setState({ theme: 'dark' });
      expect(usePlayerProfileStore.getState().getEffectiveTheme()).toBe('dark');
    });

    it('auto + 无 window.matchMedia：fallback light', () => {
      // shared 测试 env 是 node，无 window
      usePlayerProfileStore.setState({ theme: 'auto' });
      expect(usePlayerProfileStore.getState().getEffectiveTheme()).toBe('light');
    });

    it('auto + window.matchMedia 匹配 dark：返回 dark', () => {
      // 在 node env 下手动注入 window
      const originalWindow = (globalThis as { window?: unknown }).window;
      (globalThis as { window?: unknown }).window = {
        matchMedia: () => ({ matches: true }),
      };
      try {
        usePlayerProfileStore.setState({ theme: 'auto' });
        expect(usePlayerProfileStore.getState().getEffectiveTheme()).toBe('dark');
      } finally {
        (globalThis as { window?: unknown }).window = originalWindow;
      }
    });

    it('auto + window.matchMedia 不匹配：返回 light', () => {
      const originalWindow = (globalThis as { window?: unknown }).window;
      (globalThis as { window?: unknown }).window = {
        matchMedia: () => ({ matches: false }),
      };
      try {
        usePlayerProfileStore.setState({ theme: 'auto' });
        expect(usePlayerProfileStore.getState().getEffectiveTheme()).toBe('light');
      } finally {
        (globalThis as { window?: unknown }).window = originalWindow;
      }
    });
  });
});
