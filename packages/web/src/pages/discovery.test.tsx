/**
 * discovery 页搜索行为单测
 *
 * 覆盖：
 * - 总条数 / 分页器文案 与硬上限 (VIDEO_SEARCH_RESULT_HARD_LIMIT=1000，折合 50 页) 的渲染
 * - 排序下拉默认值 / 切换重新搜索
 * - 翻页：点击下一页用 page=2 重新搜索
 * - 批量选择联动：切换页码 / 切换排序时清空已选
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

describe('DiscoveryPage 搜索 / 分页 / 批量选择', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('numResults>硬上限时夹到 50 页并显示最多展示提示', async () => {
    const result = Array.from({ length: 20 }, (_, i) => makeSearchItem(i));
    vi.spyOn(VideoApi, 'searchVideo').mockResolvedValue({
      result,
      numResults: 1500,
      page: 1,
      pagesize: 20,
    });

    const user = userEvent.setup();
    render(<DiscoveryPage />);

    await user.type(screen.getByPlaceholderText('搜索 B 站视频…'), '测试关键词');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByText(/共\s*1500\s*条结果/)).toBeInTheDocument();
    });
    // 总页数夹到硬上限 = 1000 / 20 = 50
    expect(screen.getByText(/第\s*1\s*\/\s*50\s*页/)).toBeInTheDocument();
    expect(VIDEO_SEARCH_RESULT_HARD_LIMIT).toBe(1000);
    expect(
      screen.getByText(`（最多展示 ${VIDEO_SEARCH_RESULT_HARD_LIMIT} 条）`),
    ).toBeInTheDocument();
  });

  it('返回数量为 1 页时不显示最多展示提示且分页器隐藏', async () => {
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
      expect(screen.getByText(/共\s*20\s*条结果/)).toBeInTheDocument();
    });
    expect(screen.getByText(/第\s*1\s*\/\s*1\s*页/)).toBeInTheDocument();
    expect(screen.queryByText(/最多展示/)).not.toBeInTheDocument();
    // 总页数为 1 时分页导航不渲染
    expect(screen.queryByLabelText('下一页')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('上一页')).not.toBeInTheDocument();
  });

  it('搜索失败时不影响后续搜索，无总条数文案', async () => {
    vi.spyOn(VideoApi, 'searchVideo').mockRejectedValue(new Error('network'));

    const user = userEvent.setup();
    render(<DiscoveryPage />);

    await user.type(screen.getByPlaceholderText('搜索 B 站视频…'), 'foo');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.queryByText(/共\s*\d+\s*条结果/)).not.toBeInTheDocument();
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

    await user.type(screen.getByPlaceholderText('搜索 B 站视频…'), 'foo');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));

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

  it('点击下一页时用 page=2 重新搜索', async () => {
    const result1 = Array.from({ length: 20 }, (_, i) => makeSearchItem(i));
    const result2 = Array.from({ length: 20 }, (_, i) => makeSearchItem(i + 100));
    const spy = vi
      .spyOn(VideoApi, 'searchVideo')
      .mockResolvedValueOnce({ result: result1, numResults: 100, page: 1, pagesize: 20 })
      .mockResolvedValueOnce({ result: result2, numResults: 100, page: 2, pagesize: 20 });

    const user = userEvent.setup();
    render(<DiscoveryPage />);

    await user.type(screen.getByPlaceholderText('搜索 B 站视频…'), 'foo');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));

    await user.click(screen.getByLabelText('下一页'));
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2));
    expect(spy.mock.calls[1]?.[0]?.params).toMatchObject({
      keyword: 'foo',
      order: 'totalrank',
      page: 2,
    });
    // 当前页号已切到 2 页
    await waitFor(() => {
      expect(screen.getByText(/第\s*2\s*\/\s*5\s*页/)).toBeInTheDocument();
    });
  });

  it('切换页码时自动清空批量选择', async () => {
    const result1 = Array.from({ length: 20 }, (_, i) => makeSearchItem(i));
    const result2 = Array.from({ length: 20 }, (_, i) => makeSearchItem(i + 100));
    vi.spyOn(VideoApi, 'searchVideo')
      .mockResolvedValueOnce({ result: result1, numResults: 100, page: 1, pagesize: 20 })
      .mockResolvedValueOnce({ result: result2, numResults: 100, page: 2, pagesize: 20 });

    const user = userEvent.setup();
    render(<DiscoveryPage />);

    await user.type(screen.getByPlaceholderText('搜索 B 站视频…'), 'foo');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(screen.getByText(/共\s*100\s*条/)).toBeInTheDocument());

    // 进入批量模式 → 选中第一条
    await user.click(screen.getByTitle('批量选择'));
    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[0]);
    expect(screen.getByRole('button', { name: /添加到歌单 \(1\)/ })).toBeInTheDocument();

    // 切到下一页：已选应清零，selectMode 仍保留
    await user.click(screen.getByLabelText('下一页'));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /添加到歌单 \(0\)/ })).toBeInTheDocument();
    });
  });

  it('切换排序时自动清空批量选择', async () => {
    const result1 = Array.from({ length: 20 }, (_, i) => makeSearchItem(i));
    const result2 = Array.from({ length: 20 }, (_, i) => makeSearchItem(i + 100));
    vi.spyOn(VideoApi, 'searchVideo')
      .mockResolvedValueOnce({ result: result1, numResults: 100, page: 1, pagesize: 20 })
      .mockResolvedValueOnce({ result: result2, numResults: 100, page: 1, pagesize: 20 });

    const user = userEvent.setup();
    render(<DiscoveryPage />);

    await user.type(screen.getByPlaceholderText('搜索 B 站视频…'), 'foo');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(screen.getByText(/共\s*100\s*条/)).toBeInTheDocument());

    await user.click(screen.getByTitle('批量选择'));
    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[0]);
    expect(screen.getByRole('button', { name: /添加到歌单 \(1\)/ })).toBeInTheDocument();

    const trigger = screen.getByLabelText('排序方式');
    trigger.focus();
    await user.keyboard('{Enter}');
    const option = await screen.findByRole('option', { name: '最新发布' });
    await user.click(option);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /添加到歌单 \(0\)/ })).toBeInTheDocument();
    });
  });
});
