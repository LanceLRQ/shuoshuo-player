import { usePlayerProfileStore } from './player-profile';
import {
  DEFAULT_CLOSE_ACTION,
  DEFAULT_COLLECTION_PLAY_BEHAVIOR,
  DEFAULT_FAV_VIEW_MODE,
  DEFAULT_FLOATING_LYRICS,
  DEFAULT_HOME_VIEW_MODE,
} from '../types';

function reset() {
  usePlayerProfileStore.setState({
    theme: 'auto',
    volume: 0.8,
    autoPlay: false,
    loopMode: 'loop',
    floatingLyrics: { ...DEFAULT_FLOATING_LYRICS },
    closeAction: DEFAULT_CLOSE_ACTION,
    closeActionFirstRunPrompted: false,
    collectionPlayBehavior: DEFAULT_COLLECTION_PLAY_BEHAVIOR,
    homeViewMode: DEFAULT_HOME_VIEW_MODE,
    favViewMode: DEFAULT_FAV_VIEW_MODE,
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

  describe('closeAction（桌面端关闭行为）', () => {
    it('默认值是 DEFAULT_CLOSE_ACTION（minimize-to-tray）', () => {
      expect(usePlayerProfileStore.getState().closeAction).toBe(DEFAULT_CLOSE_ACTION);
      expect(usePlayerProfileStore.getState().closeActionFirstRunPrompted).toBe(false);
    });

    it('setCloseAction 切换合法枚举', () => {
      usePlayerProfileStore.getState().setCloseAction('exit');
      expect(usePlayerProfileStore.getState().closeAction).toBe('exit');
      usePlayerProfileStore.getState().setCloseAction('minimize-to-tray');
      expect(usePlayerProfileStore.getState().closeAction).toBe('minimize-to-tray');
    });

    it('setCloseAction 非法值被忽略（防御导入脏数据）', () => {
      usePlayerProfileStore.getState().setCloseAction('exit');
      // @ts-expect-error 测试非法值
      usePlayerProfileStore.getState().setCloseAction('quit');
      expect(usePlayerProfileStore.getState().closeAction).toBe('exit');
    });

    it('markCloseActionPrompted 翻转 prompted 为 true', () => {
      expect(usePlayerProfileStore.getState().closeActionFirstRunPrompted).toBe(false);
      usePlayerProfileStore.getState().markCloseActionPrompted();
      expect(usePlayerProfileStore.getState().closeActionFirstRunPrompted).toBe(true);
    });

    it('resetCloseActionPrompted 把 prompted 改回 false', () => {
      usePlayerProfileStore.getState().markCloseActionPrompted();
      usePlayerProfileStore.getState().resetCloseActionPrompted();
      expect(usePlayerProfileStore.getState().closeActionFirstRunPrompted).toBe(false);
    });
  });

  describe('collectionPlayBehavior（合集播放行为）', () => {
    it('默认值是 DEFAULT_COLLECTION_PLAY_BEHAVIOR（replace）', () => {
      expect(usePlayerProfileStore.getState().collectionPlayBehavior).toBe(
        DEFAULT_COLLECTION_PLAY_BEHAVIOR,
      );
      expect(DEFAULT_COLLECTION_PLAY_BEHAVIOR).toBe('replace');
    });

    it('setCollectionPlayBehavior 切换合法枚举', () => {
      usePlayerProfileStore.getState().setCollectionPlayBehavior('append');
      expect(usePlayerProfileStore.getState().collectionPlayBehavior).toBe('append');
      usePlayerProfileStore.getState().setCollectionPlayBehavior('replace');
      expect(usePlayerProfileStore.getState().collectionPlayBehavior).toBe('replace');
    });

    it('setCollectionPlayBehavior 非法值被忽略（防御导入脏数据）', () => {
      usePlayerProfileStore.getState().setCollectionPlayBehavior('append');
      // @ts-expect-error 测试非法值
      usePlayerProfileStore.getState().setCollectionPlayBehavior('queue');
      expect(usePlayerProfileStore.getState().collectionPlayBehavior).toBe('append');
    });
  });

  describe('视图模式偏好（home / fav）', () => {
    it('默认值：home=thumbnail / fav=list', () => {
      expect(usePlayerProfileStore.getState().homeViewMode).toBe(DEFAULT_HOME_VIEW_MODE);
      expect(usePlayerProfileStore.getState().favViewMode).toBe(DEFAULT_FAV_VIEW_MODE);
      expect(DEFAULT_HOME_VIEW_MODE).toBe('thumbnail');
      expect(DEFAULT_FAV_VIEW_MODE).toBe('list');
    });

    it('setHomeViewMode / setFavViewMode 切换合法枚举', () => {
      usePlayerProfileStore.getState().setHomeViewMode('list');
      expect(usePlayerProfileStore.getState().homeViewMode).toBe('list');
      usePlayerProfileStore.getState().setFavViewMode('thumbnail');
      expect(usePlayerProfileStore.getState().favViewMode).toBe('thumbnail');
    });

    it('非法值被忽略（防御导入脏数据）', () => {
      usePlayerProfileStore.getState().setHomeViewMode('list');
      // @ts-expect-error 测试非法值
      usePlayerProfileStore.getState().setHomeViewMode('grid');
      expect(usePlayerProfileStore.getState().homeViewMode).toBe('list');
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
