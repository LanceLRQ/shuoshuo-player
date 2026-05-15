import { fireEvent, render, screen } from '@testing-library/react';
import { usePlayerProfileStore, DEFAULT_COLLECTION_PLAY_BEHAVIOR } from '@shuoshuo-player/shared';
import { PlaybackSettings } from './playback';

function reset() {
  usePlayerProfileStore.setState({
    collectionPlayBehavior: DEFAULT_COLLECTION_PLAY_BEHAVIOR,
    autoPlayNextPage: false,
  });
}

describe('PlaybackSettings', () => {
  beforeEach(() => {
    reset();
  });

  describe('合集播放行为', () => {
    it('默认选中"替换当前播放队列"', () => {
      render(<PlaybackSettings />);
      const replace = screen.getByRole('radio', { name: /替换当前播放队列/ });
      expect(replace.getAttribute('data-state')).toBe('checked');
    });

    it('点击"追加到队列尾部"切换 store 字段为 append', () => {
      render(<PlaybackSettings />);
      fireEvent.click(screen.getByRole('radio', { name: /追加到队列尾部/ }));
      expect(usePlayerProfileStore.getState().collectionPlayBehavior).toBe('append');
    });

    it('append 状态下再点"替换"切回 replace', () => {
      usePlayerProfileStore.setState({ collectionPlayBehavior: 'append' });
      render(<PlaybackSettings />);
      fireEvent.click(screen.getByRole('radio', { name: /替换当前播放队列/ }));
      expect(usePlayerProfileStore.getState().collectionPlayBehavior).toBe('replace');
    });
  });

  describe('多 P 投稿连续播放（从 appearance 搬迁）', () => {
    it('开关默认关闭', () => {
      render(<PlaybackSettings />);
      const sw = screen.getByRole('switch', { name: /多 P 投稿连续播放/ }) as HTMLButtonElement;
      expect(sw.getAttribute('data-state')).toBe('unchecked');
    });

    it('点击 → 开启 store 字段；再点 → 关闭', () => {
      render(<PlaybackSettings />);
      const sw = screen.getByRole('switch', { name: /多 P 投稿连续播放/ }) as HTMLButtonElement;
      fireEvent.click(sw);
      expect(usePlayerProfileStore.getState().autoPlayNextPage).toBe(true);
      fireEvent.click(sw);
      expect(usePlayerProfileStore.getState().autoPlayNextPage).toBe(false);
    });
  });
});
