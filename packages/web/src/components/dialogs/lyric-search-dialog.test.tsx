import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useUIStore, type QQMusicSong } from '@shuoshuo-player/shared';
import { LyricSearchDialog } from './lyric-search-dialog';

const SAMPLE_SONG: QQMusicSong = {
  mid: 'm001',
  name: '夜空中最亮的星',
  singer: [{ name: '逃跑计划', mid: 's1' }],
  album: { name: '世界', mid: 'a1' },
};

function makeSpider() {
  return {
    searchSong: vi.fn(async () => [SAMPLE_SONG]),
    getLRC: vi.fn(async () => '[00:00.00]Hello'),
  };
}

describe('LyricSearchDialog', () => {
  beforeEach(() => {
    useUIStore.setState({ notices: [] });
  });

  it('open=false 时不渲染', () => {
    render(<LyricSearchDialog open={false} onClose={vi.fn()} onPick={vi.fn()} />);
    expect(screen.queryByText('QQ 音乐歌词搜索')).not.toBeInTheDocument();
  });

  it('打开时显示 default keyword + 占位提示', () => {
    render(<LyricSearchDialog open onClose={vi.fn()} onPick={vi.fn()} defaultKeyword="夜空" />);
    const input = screen.getByPlaceholderText('输入歌曲名 / 歌手') as HTMLInputElement;
    expect(input.value).toBe('夜空');
    expect(screen.getByText('输入关键词后开始搜索')).toBeInTheDocument();
  });

  it('点击搜索 → spider.searchSong + 渲染结果', async () => {
    const spider = makeSpider();
    render(
      <LyricSearchDialog
        open
        onClose={vi.fn()}
        onPick={vi.fn()}
        defaultKeyword="夜空"
        spider={spider}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /搜索$/ }));

    await waitFor(() => {
      expect(spider.searchSong).toHaveBeenCalledWith('夜空', 30);
    });
    expect(await screen.findByText('夜空中最亮的星')).toBeInTheDocument();
  });

  it('Enter 键触发搜索', async () => {
    const spider = makeSpider();
    render(
      <LyricSearchDialog
        open
        onClose={vi.fn()}
        onPick={vi.fn()}
        defaultKeyword="夜空"
        spider={spider}
      />,
    );

    fireEvent.keyDown(screen.getByPlaceholderText('输入歌曲名 / 歌手'), {
      key: 'Enter',
    });
    await waitFor(() => {
      expect(spider.searchSong).toHaveBeenCalled();
    });
  });

  it('选中歌曲 → spider.getLRC → 进入预览态（不立即 onPick / onClose）', async () => {
    const spider = makeSpider();
    const onPick = vi.fn();
    const onClose = vi.fn();
    render(
      <LyricSearchDialog
        open
        onClose={onClose}
        onPick={onPick}
        defaultKeyword="夜空"
        spider={spider}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /搜索$/ }));
    await screen.findByText('夜空中最亮的星');

    fireEvent.click(screen.getByText('夜空中最亮的星').closest('button')!);

    // 拉到 LRC 后进入预览态：标题切换，LRC 文本可见
    await screen.findByText('预览：夜空中最亮的星');
    expect(screen.getByText('[00:00.00]Hello')).toBeInTheDocument();
    expect(spider.getLRC).toHaveBeenCalledWith('m001');
    // 关键不变量：未点"使用"前不触发 onPick / onClose
    expect(onPick).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('预览态点"使用" → onPick + onClose', async () => {
    const spider = makeSpider();
    const onPick = vi.fn();
    const onClose = vi.fn();
    render(
      <LyricSearchDialog
        open
        onClose={onClose}
        onPick={onPick}
        defaultKeyword="夜空"
        spider={spider}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /搜索$/ }));
    await screen.findByText('夜空中最亮的星');
    fireEvent.click(screen.getByText('夜空中最亮的星').closest('button')!);
    await screen.findByText('预览：夜空中最亮的星');

    fireEvent.click(screen.getByRole('button', { name: '使用' }));
    expect(onPick).toHaveBeenCalledWith('[00:00.00]Hello', SAMPLE_SONG);
    expect(onClose).toHaveBeenCalled();
  });

  it('预览态点"返回" → 清预览回搜索结果，不触发 onPick / onClose', async () => {
    const spider = makeSpider();
    const onPick = vi.fn();
    const onClose = vi.fn();
    render(
      <LyricSearchDialog
        open
        onClose={onClose}
        onPick={onPick}
        defaultKeyword="夜空"
        spider={spider}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /搜索$/ }));
    await screen.findByText('夜空中最亮的星');
    fireEvent.click(screen.getByText('夜空中最亮的星').closest('button')!);
    await screen.findByText('预览：夜空中最亮的星');

    fireEvent.click(screen.getByRole('button', { name: /返回/ }));
    // 回到搜索结果界面：标题切回，结果列表仍在
    expect(screen.getByText('QQ 音乐歌词搜索')).toBeInTheDocument();
    expect(screen.getByText('夜空中最亮的星')).toBeInTheDocument();
    expect(onPick).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('spider 缺失时点击搜索给出 WARN 通知（桌面端独占）', () => {
    render(<LyricSearchDialog open onClose={vi.fn()} onPick={vi.fn()} defaultKeyword="x" />);

    fireEvent.click(screen.getByRole('button', { name: /搜索$/ }));

    const warn = useUIStore.getState().notices.find((n) => /仅在桌面端可用/.test(n.message));
    expect(warn).toBeDefined();
  });

  it('keyword 为空时按钮 disabled', () => {
    render(<LyricSearchDialog open onClose={vi.fn()} onPick={vi.fn()} />);
    expect(screen.getByRole('button', { name: /搜索$/ })).toBeDisabled();
  });

  it('搜索失败显示 ERROR 通知', async () => {
    const spider = {
      searchSong: vi.fn(async () => {
        throw new Error('network');
      }),
      getLRC: vi.fn(),
    };
    render(
      <LyricSearchDialog
        open
        onClose={vi.fn()}
        onPick={vi.fn()}
        defaultKeyword="x"
        spider={spider}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /搜索$/ }));
    await waitFor(() => {
      expect(useUIStore.getState().notices.find((n) => /搜索失败/.test(n.message))).toBeDefined();
    });
  });

  it('歌词获取空字符串时显示 WARN 通知 + 不调 onPick', async () => {
    const spider = {
      searchSong: vi.fn(async () => [SAMPLE_SONG]),
      getLRC: vi.fn(async () => ''),
    };
    const onPick = vi.fn();
    render(
      <LyricSearchDialog
        open
        onClose={vi.fn()}
        onPick={onPick}
        defaultKeyword="x"
        spider={spider}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /搜索$/ }));
    await screen.findByText('夜空中最亮的星');
    fireEvent.click(screen.getByText('夜空中最亮的星').closest('button')!);

    await waitFor(() => {
      expect(
        useUIStore.getState().notices.find((n) => /未获取到歌词/.test(n.message)),
      ).toBeDefined();
    });
    expect(onPick).not.toHaveBeenCalled();
  });
});
