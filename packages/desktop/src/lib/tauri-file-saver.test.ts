/**
 * TauriFileSaverAdapter 单测
 *
 * 验证流程：plugin-dialog.save() → invoke('save_text_file')
 *  - 用户取消（save 返回 null）→ 'cancelled'，不写盘
 *  - 用户确认 → invoke 写盘，返回 'saved'
 *  - extensions 透传给 plugin-dialog filters
 */

const mockSave = vi.fn();
const mockInvoke = vi.fn();

vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: (...args: unknown[]) => mockSave(...args),
}));
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

import { TauriFileSaverAdapter } from './tauri-file-saver';

describe('TauriFileSaverAdapter', () => {
  let adapter: TauriFileSaverAdapter;

  beforeEach(() => {
    mockSave.mockReset();
    mockInvoke.mockReset();
    adapter = new TauriFileSaverAdapter();
  });

  it('用户取消时返回 cancelled，不调 invoke 写盘', async () => {
    mockSave.mockResolvedValueOnce(null);
    const result = await adapter.saveText({ text: 'hello', defaultFilename: 'a.lrc' });
    expect(result).toBe('cancelled');
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('用户确认路径后 invoke save_text_file 写盘，返回 saved', async () => {
    mockSave.mockResolvedValueOnce('/Users/foo/song.lrc');
    mockInvoke.mockResolvedValueOnce(undefined);
    const result = await adapter.saveText({
      text: '[00:01]hi',
      defaultFilename: 'song.lrc',
      extensions: ['lrc'],
    });
    expect(result).toBe('saved');
    expect(mockInvoke).toHaveBeenCalledWith('save_text_file', {
      path: '/Users/foo/song.lrc',
      content: '[00:01]hi',
    });
  });

  it('extensions 透传到 plugin-dialog filters', async () => {
    mockSave.mockResolvedValueOnce(null);
    await adapter.saveText({
      text: '',
      defaultFilename: 'x.lrc',
      extensions: ['lrc', 'txt'],
    });
    const callArg = mockSave.mock.calls[0][0];
    expect(callArg.filters).toEqual([{ name: 'LRC/TXT', extensions: ['lrc', 'txt'] }]);
    expect(callArg.defaultPath).toBe('x.lrc');
  });

  it('未传 extensions 时 filters 不下发（让对话框无类型限制）', async () => {
    mockSave.mockResolvedValueOnce(null);
    await adapter.saveText({ text: '', defaultFilename: 'x' });
    expect(mockSave.mock.calls[0][0].filters).toBeUndefined();
  });

  it('Rust 写盘失败透传错误（暴露权限/磁盘问题，不静默）', async () => {
    mockSave.mockResolvedValueOnce('/tmp/x.lrc');
    mockInvoke.mockRejectedValueOnce(new Error('Permission denied'));
    await expect(adapter.saveText({ text: '', defaultFilename: 'x.lrc' })).rejects.toThrow(
      /Permission denied/,
    );
  });
});
