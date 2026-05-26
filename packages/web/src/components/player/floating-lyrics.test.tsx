import { render, screen } from '@testing-library/react';
import { usePlayerProfileStore, DEFAULT_FLOATING_LYRICS } from '@shuoshuo-player/shared';
import { FloatingLyrics } from './floating-lyrics';

function resetCfg() {
  usePlayerProfileStore.setState({
    theme: 'light',
    floatingLyrics: { ...DEFAULT_FLOATING_LYRICS },
  });
}

describe('FloatingLyrics', () => {
  beforeEach(() => {
    resetCfg();
  });

  it('visible=false 时不渲染', () => {
    const { container } = render(<FloatingLyrics line="hello" visible={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('line 为空字符串时不渲染', () => {
    const { container } = render(<FloatingLyrics line="" visible={true} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('visible+有 line 时渲染文本', () => {
    render(<FloatingLyrics line="这是一句歌词" visible={true} />);
    expect(screen.getByText('这是一句歌词')).toBeInTheDocument();
  });

  it('fontSize / fontWeight 写入 inline style', () => {
    usePlayerProfileStore.getState().setFloatingLyrics({ fontSize: 24, fontWeight: 'bold' });
    render(<FloatingLyrics line="x" visible={true} />);
    const p = screen.getByText('x');
    expect(p).toHaveStyle({ fontSize: '24px', fontWeight: '700' });
  });

  it('fontFamily=serif 时挂 font-serif class', () => {
    usePlayerProfileStore.getState().setFloatingLyrics({ fontFamily: 'serif' });
    render(<FloatingLyrics line="x" visible={true} />);
    expect(screen.getByText('x').className).toContain('font-serif');
  });

  it('fontFamily=mono 时挂 font-mono class', () => {
    usePlayerProfileStore.getState().setFloatingLyrics({ fontFamily: 'mono' });
    render(<FloatingLyrics line="x" visible={true} />);
    expect(screen.getByText('x').className).toContain('font-mono');
  });

  it('textAlign=left 时容器为 justify-start', () => {
    usePlayerProfileStore.getState().setFloatingLyrics({ textAlign: 'left' });
    render(<FloatingLyrics line="x" visible={true} />);
    expect(screen.getByTestId('floating-lyrics').className).toContain('justify-start');
  });

  it('textAlign=right 时容器为 justify-end', () => {
    usePlayerProfileStore.getState().setFloatingLyrics({ textAlign: 'right' });
    render(<FloatingLyrics line="x" visible={true} />);
    expect(screen.getByTestId('floating-lyrics').className).toContain('justify-end');
  });

  it('verticalOffset 通过 bottom:100% + translateY(-Npx) 上抬', () => {
    usePlayerProfileStore.getState().setFloatingLyrics({ verticalOffset: 16 });
    render(<FloatingLyrics line="x" visible={true} />);
    const el = screen.getByTestId('floating-lyrics');
    expect(el).toHaveStyle({ bottom: '100%' });
    expect(el).toHaveStyle({ transform: 'translateY(-16px)' });
  });

  it('textColor=white 时文字色为 #ffffff', () => {
    usePlayerProfileStore.getState().setFloatingLyrics({ textColor: 'white' });
    render(<FloatingLyrics line="x" visible={true} />);
    expect(screen.getByText('x')).toHaveStyle({ color: '#ffffff' });
  });

  it('textColor=black 时文字色为 #000000', () => {
    usePlayerProfileStore.getState().setFloatingLyrics({ textColor: 'black' });
    render(<FloatingLyrics line="x" visible={true} />);
    expect(screen.getByText('x')).toHaveStyle({ color: '#000000' });
  });

  it('背景跟随 --foreground 主题变量（亮色深底 / 暗色浅底反色）', () => {
    render(<FloatingLyrics line="x" visible={true} />);
    // 背景值恒为 hsl(var(--foreground))，反色由 CSS 变量在主题切换时生效，inline style 不变
    expect(screen.getByText('x').style.backgroundColor).toContain('--foreground');
  });

  it('bgOpacity 作为整体 opacity 同时影响文字与背景', () => {
    usePlayerProfileStore.getState().setFloatingLyrics({ bgOpacity: 0.3 });
    render(<FloatingLyrics line="x" visible={true} />);
    expect(screen.getByText('x')).toHaveStyle({ opacity: '0.3' });
  });
});
