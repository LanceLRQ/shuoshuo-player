import { useUIStore } from './ui';
import { NoticeType } from '../constants';

function reset() {
  useUIStore.setState({ notices: [] });
}

describe('useUIStore (notice 系统)', () => {
  beforeEach(reset);

  it('sendNotice 追加新 notice 并返回 id', () => {
    const id = useUIStore.getState().sendNotice({ message: 'hello' });
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);

    const n = useUIStore.getState().notices[0];
    expect(n.message).toBe('hello');
    expect(n.type).toBe(NoticeType.INFO);
    expect(n.vertical).toBe('top');
    expect(n.horizontal).toBe('center');
    expect(n.duration).toBeNull();
    expect(n.close).toBe(true);
    expect(n.action).toBeNull();
  });

  it('sendNotice 接受完整字段覆盖默认值', () => {
    const id = useUIStore.getState().sendNotice({
      id: 'my-id',
      message: 'msg',
      type: NoticeType.ERROR,
      vertical: 'bottom',
      horizontal: 'left',
      duration: 3000,
      close: false,
      action: { label: 'Undo', onClick: () => {} },
    });
    expect(id).toBe('my-id');
    const n = useUIStore.getState().notices[0];
    expect(n.type).toBe(NoticeType.ERROR);
    expect(n.vertical).toBe('bottom');
    expect(n.horizontal).toBe('left');
    expect(n.duration).toBe(3000);
    expect(n.close).toBe(false);
    expect(n.action?.label).toBe('Undo');
  });

  it('sendNotice 同 id 时替换原 notice（更新）', () => {
    useUIStore.getState().sendNotice({ id: 'fixed', message: 'first' });
    useUIStore.getState().sendNotice({ id: 'fixed', message: 'second' });
    const ns = useUIStore.getState().notices;
    expect(ns).toHaveLength(1);
    expect(ns[0].message).toBe('second');
  });

  it('sendNotice 多条并存按追加顺序', () => {
    useUIStore.getState().sendNotice({ message: 'a' });
    useUIStore.getState().sendNotice({ message: 'b' });
    useUIStore.getState().sendNotice({ message: 'c' });
    const ms = useUIStore.getState().notices.map((n) => n.message);
    expect(ms).toEqual(['a', 'b', 'c']);
  });

  it('removeNotice 按 id 删除指定 notice', () => {
    const id1 = useUIStore.getState().sendNotice({ message: 'a' });
    useUIStore.getState().sendNotice({ message: 'b' });
    useUIStore.getState().removeNotice(id1);
    expect(useUIStore.getState().notices).toHaveLength(1);
    expect(useUIStore.getState().notices[0].message).toBe('b');
  });

  it('removeNotice 删除不存在 id 不抛错', () => {
    useUIStore.getState().sendNotice({ message: 'a' });
    expect(() => useUIStore.getState().removeNotice('nonexistent')).not.toThrow();
    expect(useUIStore.getState().notices).toHaveLength(1);
  });

  it('clearNotices 清空所有 notice', () => {
    useUIStore.getState().sendNotice({ message: 'a' });
    useUIStore.getState().sendNotice({ message: 'b' });
    useUIStore.getState().clearNotices();
    expect(useUIStore.getState().notices).toEqual([]);
  });
});
