import { isValidElement } from 'react';
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

  it('opts 暴露 onAutoClose / onDismiss，调用后从 store 移除该 notice', () => {
    render(<ToasterProvider />);
    let id = '';
    act(() => {
      id = useUIStore.getState().sendNotice({
        type: NoticeType.SUCCESS,
        message: 'auto-cleanup',
        duration: 1000,
      });
    });
    expect(useUIStore.getState().notices).toHaveLength(1);
    const opts = toastMock.success.mock.calls[0][1];
    expect(typeof opts.onAutoClose).toBe('function');
    expect(typeof opts.onDismiss).toBe('function');

    // 模拟 sonner duration 到期
    act(() => opts.onAutoClose());
    expect(useUIStore.getState().notices.find((n) => n.id === id)).toBeUndefined();
  });

  it('onDismiss 触发亦走 removeNotice（覆盖手动关闭与 toast.dismiss 路径）', () => {
    render(<ToasterProvider />);
    let id = '';
    act(() => {
      id = useUIStore.getState().sendNotice({
        type: NoticeType.INFO,
        message: 'manual-dismiss',
      });
    });
    const opts = toastMock.info.mock.calls[0][1];
    act(() => opts.onDismiss());
    expect(useUIStore.getState().notices.find((n) => n.id === id)).toBeUndefined();
  });

  it('连续 N 条通知 + 自动关闭：notices 不会无限累积', () => {
    render(<ToasterProvider />);
    const ids: string[] = [];
    act(() => {
      for (let i = 0; i < 5; i++) {
        ids.push(
          useUIStore.getState().sendNotice({
            type: NoticeType.SUCCESS,
            message: `m${i}`,
            duration: 100,
          }),
        );
      }
    });
    expect(useUIStore.getState().notices).toHaveLength(5);
    // 每条都派发一次 toast.success，且每次 opts 带 onAutoClose
    for (let i = 0; i < 5; i++) {
      const opts = toastMock.success.mock.calls[i][1];
      act(() => opts.onAutoClose());
    }
    expect(useUIStore.getState().notices).toHaveLength(0);
  });

  it('notice.actions 存在时，action 渲染为多按钮 ReactNode', () => {
    render(<ToasterProvider />);
    act(() => {
      useUIStore.getState().sendNotice({
        type: NoticeType.INFO,
        message: 'multi',
        actions: [
          { label: 'A', onClick: vi.fn() },
          { label: 'B', onClick: vi.fn() },
        ],
      });
    });
    const opts = toastMock.info.mock.calls[0][1];
    expect(isValidElement(opts.action)).toBe(true);
  });

  it('仅 notice.action 时回退为单 action 对象（非 ReactNode）', () => {
    render(<ToasterProvider />);
    act(() => {
      useUIStore.getState().sendNotice({
        type: NoticeType.INFO,
        message: 'single',
        action: { label: 'X', onClick: vi.fn() },
      });
    });
    const opts = toastMock.info.mock.calls[0][1];
    expect(isValidElement(opts.action)).toBe(false);
    expect(opts.action).toMatchObject({ label: 'X' });
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
