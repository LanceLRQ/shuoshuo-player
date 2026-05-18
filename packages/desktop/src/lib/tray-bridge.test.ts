const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

import { setTrayTrackLabel, setTrayPlayState } from './tray-bridge';

describe('tray-bridge', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  it('setTrayTrackLabel 透传 label 参数', async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    await setTrayTrackLabel('♪ 隐形的翅膀 - 张韶涵');
    expect(mockInvoke).toHaveBeenCalledWith('tray_set_track_label', {
      label: '♪ 隐形的翅膀 - 张韶涵',
    });
  });

  it('setTrayTrackLabel 空串也透传（Rust 侧识别为未在播放）', async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    await setTrayTrackLabel('');
    expect(mockInvoke).toHaveBeenCalledWith('tray_set_track_label', { label: '' });
  });

  it('setTrayPlayState 透传 isPlaying 参数', async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    await setTrayPlayState(true);
    expect(mockInvoke).toHaveBeenCalledWith('tray_set_play_state', { isPlaying: true });
    await setTrayPlayState(false);
    expect(mockInvoke).toHaveBeenCalledWith('tray_set_play_state', { isPlaying: false });
  });

  it('Rust 错误透传到 Promise.reject', async () => {
    mockInvoke.mockRejectedValueOnce('tray menu state not initialized');
    await expect(setTrayTrackLabel('x')).rejects.toBe('tray menu state not initialized');
  });
});
