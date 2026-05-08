import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FavListType, type ImportSummary } from '@shuoshuo-player/shared';
import { ImportDataDialog } from './import-data-dialog';

class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', MockResizeObserver);
  // Radix Dialog / Checkbox / RadioGroup 在 jsdom 下需要 PointerCapture stub
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = vi.fn();
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = vi.fn();
  }
});

function makeSummary(version: '1' | '2' = '2'): ImportSummary {
  return {
    version,
    lyricCount: 12,
    favList: [
      {
        id: 'fav-1',
        name: '我的最爱',
        type: FavListType.CUSTOM,
        bv_ids: ['BV1', 'BV2', 'BV3'],
        create_time: 1700000000,
        update_time: 1700000000,
      },
      {
        id: 'fav-2',
        name: '老番茄',
        type: FavListType.UPLOADER,
        mid: '283886865',
        bv_ids: [],
        create_time: 1700000000,
        update_time: 1700000000,
      },
      {
        id: 'fav-3',
        name: '摇滚乐',
        type: FavListType.BILI_FAV,
        biliFavFolderId: '123',
        bv_ids: [],
        create_time: 1700000000,
        update_time: 1700000000,
      },
    ],
  };
}

describe('ImportDataDialog', () => {
  it('渲染基础摘要：版本徽章 / 歌单数 / 歌词数', () => {
    render(
      <ImportDataDialog
        open={true}
        summary={makeSummary('2')}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByText('导入数据预览')).toBeInTheDocument();
    expect(screen.getByText('v2')).toBeInTheDocument();
    // 自定义类型显示视频条数；非自定义显示提示
    expect(screen.getByText('3 首')).toBeInTheDocument();
    expect(screen.getAllByText('-- 首（导入后请刷新）')).toHaveLength(2);
    // 摘要区数字（用 textContent 包含的方式断言；3 单独出现在多处，断言"歌词条目 12"更精确）
    expect(screen.getByText('歌词条目').nextSibling?.textContent).toBe('12');
    expect(screen.getByText('歌单总数').nextSibling?.textContent).toBe('3');
  });

  it('v1 版本显示 v1 旧版徽章', () => {
    render(
      <ImportDataDialog
        open={true}
        summary={makeSummary('1')}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByText('v1（旧版）')).toBeInTheDocument();
  });

  it('默认 mode=append 时所有歌单可勾选且全选', () => {
    render(
      <ImportDataDialog
        open={true}
        summary={makeSummary()}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    const checkboxes = screen.getAllByRole('checkbox', { name: /选择歌单/ });
    expect(checkboxes).toHaveLength(3);
    for (const cb of checkboxes) {
      expect(cb).not.toBeDisabled();
      expect(cb.getAttribute('data-state')).toBe('checked');
    }
  });

  it('切到 overwrite 模式：所有勾选 disabled 且强制 checked', async () => {
    const user = userEvent.setup();
    render(
      <ImportDataDialog
        open={true}
        summary={makeSummary()}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('radio', { name: /完全覆盖/ }));
    const checkboxes = screen.getAllByRole('checkbox', { name: /选择歌单/ });
    for (const cb of checkboxes) {
      expect(cb).toBeDisabled();
      expect(cb.getAttribute('data-state')).toBe('checked');
    }
  });

  it('点击取消触发 onCancel', async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(
      <ImportDataDialog
        open={true}
        summary={makeSummary()}
        onCancel={onCancel}
        onConfirm={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: '取消' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('点击确定触发 onConfirm(mode, selectedSet)，默认 append + 全选 3 项', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(
      <ImportDataDialog
        open={true}
        summary={makeSummary()}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />,
    );
    await user.click(screen.getByRole('button', { name: '确定导入' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    const [mode, selected] = onConfirm.mock.calls[0];
    expect(mode).toBe('append');
    expect([...selected].sort()).toEqual(['fav-1', 'fav-2', 'fav-3']);
  });

  it('取消勾选后确定，仅传剩余项', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(
      <ImportDataDialog
        open={true}
        summary={makeSummary()}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />,
    );
    // 取消第一项
    const firstCb = screen.getAllByRole('checkbox', { name: /选择歌单/ })[0];
    await user.click(firstCb);
    await user.click(screen.getByRole('button', { name: '确定导入' }));
    const [, selected] = onConfirm.mock.calls[0];
    expect([...selected].sort()).toEqual(['fav-2', 'fav-3']);
  });
});
