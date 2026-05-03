import { useRiskControlStore } from './risk-control';

describe('useRiskControlStore', () => {
  beforeEach(() => {
    useRiskControlStore.setState({ open: false, voucher: null, bvid: null });
  });

  it('初始状态：open=false / voucher=null / bvid=null', () => {
    const s = useRiskControlStore.getState();
    expect(s.open).toBe(false);
    expect(s.voucher).toBeNull();
    expect(s.bvid).toBeNull();
  });

  it('openRiskControl(voucher, bvid) 写入完整字段', () => {
    useRiskControlStore.getState().openRiskControl('voucher_xxx', 'BV1Test');
    const s = useRiskControlStore.getState();
    expect(s.open).toBe(true);
    expect(s.voucher).toBe('voucher_xxx');
    expect(s.bvid).toBe('BV1Test');
  });

  it('closeRiskControl 重置全部字段', () => {
    useRiskControlStore.getState().openRiskControl('v', 'BV');
    useRiskControlStore.getState().closeRiskControl();
    const s = useRiskControlStore.getState();
    expect(s.open).toBe(false);
    expect(s.voucher).toBeNull();
    expect(s.bvid).toBeNull();
  });
});
