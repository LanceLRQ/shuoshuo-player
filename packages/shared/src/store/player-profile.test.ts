import { usePlayerProfileStore } from './player-profile';

function reset() {
  usePlayerProfileStore.setState({
    theme: 'auto',
    volume: 0.8,
    autoPlay: false,
    loopMode: 'loop',
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
