import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  LiveSlicerApi,
  setPlatformBridge,
  resetPlatformBridge,
  useUIStore,
  type LiveSlicerMan,
} from '@shuoshuo-player/shared';
import { useUIShell } from '@/stores/ui-shell';
import { LiveSlicersPage } from './live-slicers';

vi.mock('@shuoshuo-player/shared', async () => {
  const actual = await vi.importActual<object>('@shuoshuo-player/shared');
  return {
    ...actual,
    LiveSlicerApi: {
      publicList: vi.fn(),
    },
  };
});

const mockedList = vi.mocked(LiveSlicerApi.publicList);

const SAMPLE: LiveSlicerMan[] = [
  {
    id: 1,
    mid: '999',
    name: '小切片',
    face: '',
    creator_uid: 0,
    created_at: 0,
    updated_at: 0,
  } as never,
  {
    id: 2,
    mid: '888',
    name: '另一个切片',
    face: '',
    creator_uid: 0,
    created_at: 0,
    updated_at: 0,
  } as never,
];

function reset() {
  useUIStore.setState({ notices: [] });
  useUIShell.setState({ favEditOpen: false });
  mockedList.mockReset();
  setPlatformBridge({
    type: 'web',
    storage: {
      getItem: vi.fn(async () => null),
      setItem: vi.fn(async () => {}),
      removeItem: vi.fn(async () => {}),
    },
    auth: {
      login: vi.fn(async () => {}),
      logout: vi.fn(async () => {}),
      onLoginSuccess: vi.fn(),
    },
    shell: { openExternal: vi.fn(async () => {}) },
  });
}

afterAll(() => resetPlatformBridge());

describe('LiveSlicersPage', () => {
  beforeEach(() => {
    reset();
  });

  it('挂载后调用 LiveSlicerApi.publicList(page=1,limit=100)', async () => {
    mockedList.mockResolvedValueOnce({ result: [], page: 1, page_size: 100, total: 0 } as never);
    render(<LiveSlicersPage />);

    await waitFor(() => {
      expect(mockedList).toHaveBeenCalledWith({ page: 1, limit: 100 });
    });
  });

  it('返回数据后渲染卡片列表', async () => {
    mockedList.mockResolvedValueOnce({
      result: SAMPLE,
      page: 1,
      page_size: 100,
      total: SAMPLE.length,
    } as never);
    render(<LiveSlicersPage />);

    expect(await screen.findByText('小切片')).toBeInTheDocument();
    expect(screen.getByText('另一个切片')).toBeInTheDocument();
    expect(screen.getByText('UID: 999')).toBeInTheDocument();
  });

  it('返回空列表显示"暂无切片管理员"', async () => {
    mockedList.mockResolvedValueOnce({ result: [], page: 1, page_size: 100, total: 0 } as never);
    render(<LiveSlicersPage />);

    expect(await screen.findByText('暂无切片管理员')).toBeInTheDocument();
  });

  it('API 失败时显示 ERROR 通知', async () => {
    mockedList.mockRejectedValueOnce(new Error('network'));
    render(<LiveSlicersPage />);

    await waitFor(() => {
      expect(
        useUIStore.getState().notices.find((n) => /获取切片管理员列表失败/.test(n.message)),
      ).toBeDefined();
    });
  });

  it('点击关注按钮 → openFavEdit 预填 UPLOADER + mid + name', async () => {
    mockedList.mockResolvedValueOnce({
      result: [SAMPLE[0]],
      page: 1,
      page_size: 100,
      total: 1,
    } as never);
    render(<LiveSlicersPage />);
    await screen.findByText('小切片');

    fireEvent.click(screen.getByRole('button', { name: /关注/ }));

    expect(useUIShell.getState().favEditOpen).toBe(true);
    expect(useUIShell.getState().favEditPrefill?.midInput).toBe('999');
    expect(useUIShell.getState().favEditPrefill?.name).toBe('小切片');
  });
});
