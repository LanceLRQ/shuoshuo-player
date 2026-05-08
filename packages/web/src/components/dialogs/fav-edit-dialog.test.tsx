import { fireEvent, render, screen, waitFor, act } from '@testing-library/react';
import { useFavListStore, useUIStore, FavListType, UserApi } from '@shuoshuo-player/shared';
import { useUIShell } from '@/stores/ui-shell';
import { FavEditDialog } from './fav-edit-dialog';

// jsdom 不提供 ResizeObserver，Radix RadioGroup 依赖此 API
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', MockResizeObserver);
});
afterAll(() => {
  vi.unstubAllGlobals();
});

function reset() {
  useUIShell.setState({
    favEditOpen: false,
    favEditTargetId: null,
    favEditPrefill: null,
  });
  useFavListStore.setState({ list: [] });
  useUIStore.setState({ notices: [] });
}

describe('FavEditDialog', () => {
  beforeEach(() => {
    reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('未打开时不渲染', () => {
    render(<FavEditDialog />);
    expect(screen.queryByText('创建歌单')).not.toBeInTheDocument();
  });

  it('新建模式：默认 custom 类型 + 不显示 UID/folder 输入', () => {
    render(<FavEditDialog />);
    act(() => useUIShell.getState().openFavEdit());

    expect(screen.getByText('创建歌单')).toBeInTheDocument();
    expect(screen.getByLabelText('歌单名称')).toBeInTheDocument();
    expect(screen.queryByLabelText(/UP 主 UID/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/收藏夹 ID/)).not.toBeInTheDocument();
  });

  it('选 uploader 类型 → 显示 UID 输入', async () => {
    render(<FavEditDialog />);
    act(() => useUIShell.getState().openFavEdit());

    fireEvent.click(screen.getByLabelText('UP 主投稿'));
    await waitFor(() => {
      expect(screen.getByLabelText(/UP 主 UID/)).toBeInTheDocument();
    });
  });

  it('选 bili_fav 类型 → 显示收藏夹列表区域', async () => {
    render(<FavEditDialog />);
    act(() => useUIShell.getState().openFavEdit());

    fireEvent.click(screen.getByLabelText('B 站收藏夹'));
    await waitFor(() => {
      expect(screen.getByText('选择 B 站收藏夹')).toBeInTheDocument();
    });
  });

  it('提交空名称 → 校验错误"请输入歌单名称"', async () => {
    render(<FavEditDialog />);
    act(() => useUIShell.getState().openFavEdit());

    fireEvent.click(screen.getByRole('button', { name: '创建' }));

    await waitFor(() => {
      expect(screen.getByText('请输入歌单名称')).toBeInTheDocument();
    });
  });

  it('创建 CUSTOM 歌单成功 → addFavList + 通知 + 关闭', async () => {
    const addFavList = vi.fn(() => ({ id: 'new-1' }) as never);
    useFavListStore.setState({ addFavList });

    render(<FavEditDialog />);
    act(() => useUIShell.getState().openFavEdit());

    fireEvent.change(screen.getByLabelText('歌单名称'), { target: { value: 'My Songs' } });
    fireEvent.click(screen.getByRole('button', { name: '创建' }));

    await waitFor(() => {
      expect(addFavList).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'My Songs',
          type: FavListType.CUSTOM,
          bv_ids: [],
        }),
      );
    });
    expect(useUIShell.getState().favEditOpen).toBe(false);
  });

  it('UPLOADER 类型 UID 校验失败时不调用 addFavList', async () => {
    const addFavList = vi.fn();
    useFavListStore.setState({ addFavList });

    render(<FavEditDialog />);
    act(() => useUIShell.getState().openFavEdit());
    fireEvent.click(screen.getByLabelText('UP 主投稿'));

    // UPLOADER 模式不显示名称字段，midInput 留空直接提交
    fireEvent.click(screen.getByRole('button', { name: '创建' }));

    await waitFor(() => {
      expect(screen.getByText(/请输入有效的 UP 主 UID/)).toBeInTheDocument();
    });
    expect(addFavList).not.toHaveBeenCalled();
  });

  it('UPLOADER 类型 UID 合法 → 用 UP 主昵称作为歌单名', async () => {
    const addFavList = vi.fn(() => ({ id: 'u1' }) as never);
    useFavListStore.setState({ addFavList });
    vi.spyOn(UserApi, 'getUserSpaceInfo').mockResolvedValue({
      name: 'Alice',
      mid: 123456,
    } as never);

    render(<FavEditDialog />);
    act(() => useUIShell.getState().openFavEdit());
    fireEvent.click(screen.getByLabelText('UP 主投稿'));

    await waitFor(() => screen.getByLabelText(/UP 主 UID/));
    fireEvent.change(screen.getByLabelText(/UP 主 UID/), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: '创建' }));

    await waitFor(() => {
      expect(addFavList).toHaveBeenCalledWith(
        expect.objectContaining({
          type: FavListType.UPLOADER,
          mid: '123456',
          name: 'Alice',
        }),
      );
    });
  });

  it('BILI_FAV 类型未选择收藏夹时不调用 addFavList', async () => {
    const addFavList = vi.fn();
    useFavListStore.setState({ addFavList });

    render(<FavEditDialog />);
    act(() => useUIShell.getState().openFavEdit());
    fireEvent.click(screen.getByLabelText('B 站收藏夹'));

    // BILI_FAV 模式不显示名称输入；列表为空时直接提交，应触发"未选择收藏夹"校验
    fireEvent.click(screen.getByRole('button', { name: '创建' }));

    await waitFor(() => {
      expect(screen.getByText(/请从下方列表选择一个收藏夹/)).toBeInTheDocument();
    });
    expect(addFavList).not.toHaveBeenCalled();
  });

  it('addFavList 返回 null → ERROR 通知 + 不关闭对话框', async () => {
    const addFavList = vi.fn(() => null);
    useFavListStore.setState({ addFavList });

    render(<FavEditDialog />);
    act(() => useUIShell.getState().openFavEdit());

    fireEvent.change(screen.getByLabelText('歌单名称'), { target: { value: 'X' } });
    fireEvent.click(screen.getByRole('button', { name: '创建' }));

    await waitFor(() => {
      expect(useUIStore.getState().notices.find((n) => /创建失败/.test(n.message))).toBeDefined();
    });
    expect(useUIShell.getState().favEditOpen).toBe(true);
  });

  it('编辑模式：仅显示名称字段（type/mid 不可改）+ modFavList 调用', async () => {
    const modFavList = vi.fn();
    useFavListStore.setState({
      list: [
        {
          id: 'fav-x',
          name: '旧名称',
          type: FavListType.UPLOADER,
          mid: '999',
          bv_ids: [],
          create_time: 0,
          update_time: 0,
        } as never,
      ],
      modFavList,
    });

    render(<FavEditDialog />);
    act(() => useUIShell.getState().openFavEdit('fav-x'));

    expect(screen.getByText('编辑歌单')).toBeInTheDocument();
    // 编辑模式下不显示类型 radio
    expect(screen.queryByLabelText('UP 主投稿')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('歌单名称'), { target: { value: '新名称' } });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(modFavList).toHaveBeenCalledWith('fav-x', '新名称');
    });
    expect(useUIShell.getState().favEditOpen).toBe(false);
  });

  it('点击取消关闭对话框', async () => {
    render(<FavEditDialog />);
    act(() => useUIShell.getState().openFavEdit());

    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    await waitFor(() => {
      expect(useUIShell.getState().favEditOpen).toBe(false);
    });
  });

  it('prefill 模式：UPLOADER 预填 UID 且不显示名称字段', () => {
    render(<FavEditDialog />);
    act(() =>
      useUIShell.getState().openFavEdit(null, {
        type: FavListType.UPLOADER,
        midInput: '283886865',
        name: '预填名',
      }),
    );

    // UPLOADER 模式不展示名称输入框（自动用 UP 主昵称）
    expect(screen.queryByLabelText('歌单名称')).not.toBeInTheDocument();
    // UID 输入框应被预填
    const midInput = screen.getByLabelText(/UP 主 UID/) as HTMLInputElement;
    expect(midInput.value).toBe('283886865');
  });
});
