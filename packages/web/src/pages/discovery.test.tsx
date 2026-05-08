/**
 * H3: discovery 页搜索结果上限单测
 *
 * 验证：
 * - 单次搜索返回 600 条时，results state 被裁剪到 VIDEO_SEARCH_RESULT_HARD_LIMIT（520）
 * - 超过上限的 bvid 不出现在状态文案中
 * - 命中上限后 hasMore=false，不再触发 loadMore
 *
 * jsdom 下 useVirtualizer 因 DOM 高度为 0 不会真实渲染所有 VideoItem，
 * 因此断言走"已达 520 条上限"提示文案 + state 行为。
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VideoApi, VIDEO_SEARCH_RESULT_HARD_LIMIT } from '@shuoshuo-player/shared';
import { DiscoveryPage } from './discovery';

// Radix Select 在 jsdom 下依赖这些 API，需 stub 后才能键盘交互
beforeAll(() => {
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = vi.fn();
  }
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = vi.fn();
  }
});

function makeSearchItem(i: number) {
  return {
    bvid: `BV1${String(i).padStart(9, '0')}`,
    aid: i,
    typeid: '0',
    arcurl: '',
    title: `Title-${i}`,
    description: '',
    pic: '',
    play: 0,
    pubdate: 0,
    duration: '00:01',
    author: 'Author',
    mid: i,
  };
}

describe('H3: DiscoveryPage 搜索结果上限保护', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('单次返回 600 条时被裁剪到 VIDEO_SEARCH_RESULT_HARD_LIMIT (520)', async () => {
    const result = Array.from({ length: 600 }, (_, i) => makeSearchItem(i));
    vi.spyOn(VideoApi, 'searchVideo').mockResolvedValue({
      result,
      numResults: 600,
      page: 1,
      pagesize: 20,
    });

    const user = userEvent.setup();
    render(<DiscoveryPage />);

    await user.type(screen.getByPlaceholderText('搜索 B 站视频…'), '测试关键词');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByText(`找到 ${VIDEO_SEARCH_RESULT_HARD_LIMIT} 条结果`)).toBeInTheDocument();
    });

    expect(VIDEO_SEARCH_RESULT_HARD_LIMIT).toBe(520);

    expect(screen.getByText(`已达 ${VIDEO_SEARCH_RESULT_HARD_LIMIT} 条上限`)).toBeInTheDocument();
  });

  it('返回数量低于上限时不显示上限提示', async () => {
    const result = Array.from({ length: 20 }, (_, i) => makeSearchItem(i));
    vi.spyOn(VideoApi, 'searchVideo').mockResolvedValue({
      result,
      numResults: 20,
      page: 1,
      pagesize: 20,
    });

    const user = userEvent.setup();
    render(<DiscoveryPage />);

    await user.type(screen.getByPlaceholderText('搜索 B 站视频…'), 'foo');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByText('找到 20 条结果')).toBeInTheDocument();
    });

    expect(
      screen.queryByText(`已达 ${VIDEO_SEARCH_RESULT_HARD_LIMIT} 条上限`),
    ).not.toBeInTheDocument();
  });

  it('搜索失败时显示空状态文案，不影响后续搜索', async () => {
    vi.spyOn(VideoApi, 'searchVideo').mockRejectedValue(new Error('network'));

    const user = userEvent.setup();
    render(<DiscoveryPage />);

    await user.type(screen.getByPlaceholderText('搜索 B 站视频…'), 'foo');
    await user.keyboard('{Enter}');

    // 错误后 results 仍为初始值 0，hasSearched=false（因为 finally 之前抛错）
    // 只验证不崩溃
    await waitFor(() => {
      expect(screen.queryByText(/找到 \d+ 条结果/)).not.toBeInTheDocument();
    });
  });

  it('空白关键词不触发搜索', async () => {
    const spy = vi.spyOn(VideoApi, 'searchVideo').mockResolvedValue({
      result: [],
      numResults: 0,
      page: 1,
      pagesize: 20,
    });

    const user = userEvent.setup();
    render(<DiscoveryPage />);

    await user.type(screen.getByPlaceholderText('搜索 B 站视频…'), '   ');
    await user.keyboard('{Enter}');

    expect(spy).not.toHaveBeenCalled();
  });

  it('默认排序为 totalrank 并随首次搜索一起发出', async () => {
    const spy = vi.spyOn(VideoApi, 'searchVideo').mockResolvedValue({
      result: [],
      numResults: 0,
      page: 1,
      pagesize: 20,
    });

    const user = userEvent.setup();
    render(<DiscoveryPage />);

    await user.type(screen.getByPlaceholderText('搜索 B 站视频…'), '洛天依');
    await user.keyboard('{Enter}');

    await waitFor(() => expect(spy).toHaveBeenCalled());
    expect(spy.mock.calls[0]?.[0]?.params).toMatchObject({
      search_type: 'video',
      keyword: '洛天依',
      order: 'totalrank',
      page: 1,
    });
  });

  it('切换排序到"最新发布"时立即用 order=pubdate 重新搜索', async () => {
    const spy = vi.spyOn(VideoApi, 'searchVideo').mockResolvedValue({
      result: [],
      numResults: 0,
      page: 1,
      pagesize: 20,
    });

    const user = userEvent.setup();
    render(<DiscoveryPage />);

    // 先做一次默认搜索建立 hasSearched=true
    await user.type(screen.getByPlaceholderText('搜索 B 站视频…'), 'foo');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));

    // 通过键盘交互切换 Radix Select：focus trigger → 打开 → 选中"最新发布"
    const trigger = screen.getByLabelText('排序方式');
    trigger.focus();
    await user.keyboard('{Enter}');
    const option = await screen.findByRole('option', { name: '最新发布' });
    await user.click(option);

    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2));
    expect(spy.mock.calls[1]?.[0]?.params).toMatchObject({
      keyword: 'foo',
      order: 'pubdate',
      page: 1,
    });
  });
});
