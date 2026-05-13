import { render, screen } from '@testing-library/react';
import { useVideoPagePrefStore, type BilibiliVideo } from '@shuoshuo-player/shared';
import { PartBadge } from './part-badge';

const BASE: BilibiliVideo = {
  aid: 1,
  bvid: 'BV1Test00001',
  created: 0,
  length: '',
  pic: '',
  is_union_video: false,
  title: '',
  sub_title: '',
  play: 0,
  comment: 0,
  author: '',
  description: '',
};

describe('PartBadge: 多 P 投稿角标三态', () => {
  beforeEach(() => {
    useVideoPagePrefStore.setState({ defaultPage: {} });
  });

  it('单 P 投稿（videos=1 或缺失）不渲染', () => {
    const { container, rerender } = render(<PartBadge video={BASE} />);
    expect(container.firstChild).toBeNull();
    rerender(<PartBadge video={{ ...BASE, videos: 1 }} />);
    expect(container.firstChild).toBeNull();
  });

  it('多 P 无偏好：显示 "1/N"（中性灰底）', () => {
    render(<PartBadge video={{ ...BASE, videos: 4 }} />);
    const badge = screen.getByLabelText(/共 4P/);
    expect(badge).toHaveTextContent('1/4');
    expect(badge.className).toMatch(/bg-muted/);
  });

  it('多 P 有 defaultPage 偏好：显示 "{n}/{total}"（主色淡底）', () => {
    useVideoPagePrefStore.setState({ defaultPage: { [BASE.bvid]: 3 } });
    render(<PartBadge video={{ ...BASE, videos: 4 }} />);
    const badge = screen.getByLabelText(/默认播放分 P：P3/);
    expect(badge).toHaveTextContent('3/4');
    expect(badge.className).toMatch(/bg-primary\/15/);
  });

  it('显式 explicitPage：显示 "{n}/{total}"（主色边框），优先级高于默认偏好', () => {
    useVideoPagePrefStore.setState({ defaultPage: { [BASE.bvid]: 3 } });
    render(<PartBadge video={{ ...BASE, videos: 4 }} explicitPage={2} />);
    const badge = screen.getByLabelText(/显式分 P：P2/);
    expect(badge).toHaveTextContent('2/4');
    expect(badge.className).toMatch(/border-primary\/60/);
  });

  it('defaultPage 越界（> totalP）退化为 "1/N"（防御性）', () => {
    useVideoPagePrefStore.setState({ defaultPage: { [BASE.bvid]: 99 } });
    render(<PartBadge video={{ ...BASE, videos: 4 }} />);
    expect(screen.getByText('1/4')).toBeInTheDocument();
  });

  it('explicitPage=1 不渲染显式 P 标识，回退到默认/中性态', () => {
    // explicitPage=1 是冗余表达（TrackId 永远不会带 :p1），
    // 但组件应防御性处理：视为无显式 P
    render(<PartBadge video={{ ...BASE, videos: 3 }} explicitPage={1} />);
    expect(screen.getByText('1/3')).toBeInTheDocument();
  });
});
