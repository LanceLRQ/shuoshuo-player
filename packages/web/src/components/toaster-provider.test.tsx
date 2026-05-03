import { render, act } from '@testing-library/react';
import { useUIStore, NoticeType } from '@shuoshuo-player/shared';
import { ToasterProvider, useNotice } from './toaster-provider';

const toastMock = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fn: any = vi.fn();
  fn.success = vi.fn();
  fn.warning = vi.fn();
  fn.error = vi.fn();
  fn.info = vi.fn();
  fn.dismiss = vi.fn();
  return fn;
});

vi.mock('sonner', () => ({
  Toaster: () => null,
  toast: toastMock,
}));

function reset() {
  useUIStore.setState({ notices: [] });
  toastMock.success.mockClear();
  toastMock.warning.mockClear();
  toastMock.error.mockClear();
  toastMock.info.mockClear();
  toastMock.dismiss.mockClear();
}

describe('ToasterProvider', () => {
  beforeEach(() => {
    reset();
  });

  it('SUCCESS 类型派发 toast.success', () => {
    render(<ToasterProvider />);
    act(() => {
      useUIStore.getState().sendNotice({
        type: NoticeType.SUCCESS,
        message: '操作成功',
      });
    });
    expect(toastMock.success).toHaveBeenCalledWith(
      '操作成功',
      expect.objectContaining({ id: expect.any(String) }),
    );
  });

  it('WARN 类型派发 toast.warning', () => {
    render(<ToasterProvider />);
    act(() => {
      useUIStore.getState().sendNotice({
        type: NoticeType.WARN,
        message: '注意',
      });
    });
    expect(toastMock.warning).toHaveBeenCalledWith('注意', expect.any(Object));
  });

  it('ERROR 类型派发 toast.error', () => {
    render(<ToasterProvider />);
    act(() => {
      useUIStore.getState().sendNotice({
        type: NoticeType.ERROR,
        message: '失败',
      });
    });
    expect(toastMock.error).toHaveBeenCalledWith('失败', expect.any(Object));
  });

  it('INFO 类型派发 toast.info（默认分支）', () => {
    render(<ToasterProvider />);
    act(() => {
      useUIStore.getState().sendNotice({
        type: NoticeType.INFO,
        message: 'i',
      });
    });
    expect(toastMock.info).toHaveBeenCalledWith('i', expect.any(Object));
  });

  it('removed notice 触发 toast.dismiss', () => {
    render(<ToasterProvider />);
    let id = '';
    act(() => {
      id = useUIStore.getState().sendNotice({
        type: NoticeType.SUCCESS,
        message: 'x',
      });
    });
    act(() => {
      useUIStore.getState().removeNotice(id);
    });
    expect(toastMock.dismiss).toHaveBeenCalledWith(id);
  });

  it('duration === null 时映射为 Infinity（不自动关闭）', () => {
    render(<ToasterProvider />);
    act(() => {
      useUIStore.getState().sendNotice({
        type: NoticeType.SUCCESS,
        message: 'persistent',
        duration: null,
      });
    });
    const args = toastMock.success.mock.calls[0];
    expect(args[1]).toMatchObject({ duration: Infinity });
  });
});

describe('useNotice', () => {
  beforeEach(() => {
    reset();
  });

  it('暴露 info/success/warning/error 四个方法，调用后写入 useUIStore', () => {
    let api: ReturnType<typeof useNotice> | null = null;
    function Capture() {
      api = useNotice();
      return null;
    }
    render(<Capture />);

    api!.success('done');
    api!.warning('careful');
    api!.error('boom');
    api!.info('fyi');

    const types = useUIStore.getState().notices.map((n) => n.type);
    expect(types).toContain(NoticeType.SUCCESS);
    expect(types).toContain(NoticeType.WARN);
    expect(types).toContain(NoticeType.ERROR);
    expect(types).toContain(NoticeType.INFO);
  });
});
