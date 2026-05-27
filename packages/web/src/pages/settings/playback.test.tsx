import { fireEvent, render, screen } from '@testing-library/react';
import {
  usePlayerProfileStore,
  useBilibiliUserStore,
  DEFAULT_COLLECTION_PLAY_BEHAVIOR,
  type BilibiliUserInfo,
} from '@shuoshuo-player/shared';
import { PlaybackSettings } from './playback';

const vipUser: BilibiliUserInfo = {
  isLogin: true,
  face: '',
  uname: 'vip',
  mid: 1,
  vipType: 1,
  vip_pay_type: 1,
  wbi_img: { img_url: '', sub_url: '' },
};

function reset() {
  usePlayerProfileStore.setState({
    collectionPlayBehavior: DEFAULT_COLLECTION_PLAY_BEHAVIOR,
    autoPlayNextPage: false,
    defaultAudioQuality: 'auto',
  });
  useBilibiliUserStore.setState({ isLogin: false, current: null });
}

describe('PlaybackSettings', () => {
  beforeEach(() => {
    reset();
  });

  describe('合集播放行为', () => {
    it('默认选中"替换当前播放列表"', () => {
      render(<PlaybackSettings />);
      const replace = screen.getByRole('radio', { name: /替换当前播放列表/ });
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
      fireEvent.click(screen.getByRole('radio', { name: /替换当前播放列表/ }));
      expect(usePlayerProfileStore.getState().collectionPlayBehavior).toBe('replace');
    });
  });

  describe('音频品质', () => {
    it('默认选中"自动（最高可用）"', () => {
      render(<PlaybackSettings />);
      const auto = screen.getByRole('radio', { name: /自动（最高可用）/ });
      expect(auto.getAttribute('data-state')).toBe('checked');
    });

    it('点击"高品质 192K"切换 store 字段为 high', () => {
      render(<PlaybackSettings />);
      fireEvent.click(screen.getByRole('radio', { name: /高品质 192K/ }));
      expect(usePlayerProfileStore.getState().defaultAudioQuality).toBe('high');
    });

    it('非大会员：Hi-Res / 杜比档位禁用', () => {
      render(<PlaybackSettings />);
      expect(
        (screen.getByRole('radio', { name: /Hi-Res 无损/ }) as HTMLButtonElement).disabled,
      ).toBe(true);
      expect(
        (screen.getByRole('radio', { name: /杜比全景声/ }) as HTMLButtonElement).disabled,
      ).toBe(true);
    });

    it('大会员：Hi-Res / 杜比档位可选', () => {
      useBilibiliUserStore.setState({ isLogin: true, current: vipUser });
      render(<PlaybackSettings />);
      expect(
        (screen.getByRole('radio', { name: /Hi-Res 无损/ }) as HTMLButtonElement).disabled,
      ).toBe(false);
      expect(
        (screen.getByRole('radio', { name: /杜比全景声/ }) as HTMLButtonElement).disabled,
      ).toBe(false);
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
