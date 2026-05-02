/**
 * useUIShell 状态机测试（菜单 / 弹窗开关 / 弹窗预填字段）
 */
import { useUIShell } from './ui-shell';

function reset() {
  useUIShell.setState({
    menuOpen: true,
    cloudLoginOpen: false,
    favEditOpen: false,
    favEditTargetId: null,
    favEditPrefill: null,
    addSongOpen: false,
    addSongTargetFavId: null,
    addToFavOpen: false,
    addToFavBvid: null,
    addToFavExcludeId: null,
    addToFavFromSearch: false,
    confirmOpen: false,
    confirmConfig: null,
  });
}

describe('useUIShell', () => {
  beforeEach(reset);

  describe('menu', () => {
    it('toggleMenu 切换状态', () => {
      useUIShell.getState().toggleMenu();
      expect(useUIShell.getState().menuOpen).toBe(false);
      useUIShell.getState().toggleMenu();
      expect(useUIShell.getState().menuOpen).toBe(true);
    });

    it('setMenuOpen 显式设置', () => {
      useUIShell.getState().setMenuOpen(false);
      expect(useUIShell.getState().menuOpen).toBe(false);
    });
  });

  describe('cloudLogin', () => {
    it('open / close 互斥', () => {
      useUIShell.getState().openCloudLogin();
      expect(useUIShell.getState().cloudLoginOpen).toBe(true);
      useUIShell.getState().closeCloudLogin();
      expect(useUIShell.getState().cloudLoginOpen).toBe(false);
    });
  });

  describe('favEdit', () => {
    it('编辑现有歌单：写入 id', () => {
      useUIShell.getState().openFavEdit('fav-1');
      const s = useUIShell.getState();
      expect(s.favEditOpen).toBe(true);
      expect(s.favEditTargetId).toBe('fav-1');
      expect(s.favEditPrefill).toBeNull();
    });

    it('新建模式：id=null + prefill 字段', () => {
      useUIShell
        .getState()
        .openFavEdit(null, { type: 'UPLOADER' as never, midInput: '123', name: 'foo' });
      const s = useUIShell.getState();
      expect(s.favEditOpen).toBe(true);
      expect(s.favEditTargetId).toBeNull();
      expect(s.favEditPrefill).toMatchObject({ midInput: '123', name: 'foo' });
    });

    it('close 后清空所有字段', () => {
      useUIShell.getState().openFavEdit('fav-1', { name: 'foo' });
      useUIShell.getState().closeFavEdit();
      const s = useUIShell.getState();
      expect(s.favEditOpen).toBe(false);
      expect(s.favEditTargetId).toBeNull();
      expect(s.favEditPrefill).toBeNull();
    });
  });

  describe('addSong', () => {
    it('open 携带 favId', () => {
      useUIShell.getState().openAddSong('fav-2');
      const s = useUIShell.getState();
      expect(s.addSongOpen).toBe(true);
      expect(s.addSongTargetFavId).toBe('fav-2');
    });

    it('close 清空 favId', () => {
      useUIShell.getState().openAddSong('fav-2');
      useUIShell.getState().closeAddSong();
      expect(useUIShell.getState().addSongTargetFavId).toBeNull();
    });
  });

  describe('addToFav', () => {
    it('default 选项：excludeFavId/fromSearch 为默认值', () => {
      useUIShell.getState().openAddToFav('BV1');
      const s = useUIShell.getState();
      expect(s.addToFavOpen).toBe(true);
      expect(s.addToFavBvid).toBe('BV1');
      expect(s.addToFavExcludeId).toBeNull();
      expect(s.addToFavFromSearch).toBe(false);
    });

    it('自定义选项：excludeFavId + fromSearch', () => {
      useUIShell.getState().openAddToFav('BV1', { excludeFavId: 'fav-1', fromSearch: true });
      const s = useUIShell.getState();
      expect(s.addToFavExcludeId).toBe('fav-1');
      expect(s.addToFavFromSearch).toBe(true);
    });

    it('close 清空所有相关字段', () => {
      useUIShell.getState().openAddToFav('BV1', { fromSearch: true });
      useUIShell.getState().closeAddToFav();
      const s = useUIShell.getState();
      expect(s.addToFavOpen).toBe(false);
      expect(s.addToFavBvid).toBeNull();
      expect(s.addToFavExcludeId).toBeNull();
      expect(s.addToFavFromSearch).toBe(false);
    });
  });

  describe('confirm', () => {
    it('open 携带 config', () => {
      const onConfirm = vi.fn();
      useUIShell.getState().openConfirm({
        title: '删除？',
        description: 'desc',
        confirmText: '确定',
        destructive: true,
        onConfirm,
      });
      const s = useUIShell.getState();
      expect(s.confirmOpen).toBe(true);
      expect(s.confirmConfig?.title).toBe('删除？');
      expect(s.confirmConfig?.destructive).toBe(true);
    });

    it('close 清空 config', () => {
      useUIShell.getState().openConfirm({ title: 't', onConfirm: () => {} });
      useUIShell.getState().closeConfirm();
      const s = useUIShell.getState();
      expect(s.confirmOpen).toBe(false);
      expect(s.confirmConfig).toBeNull();
    });
  });
});
