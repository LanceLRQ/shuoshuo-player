import { render, screen } from '@testing-library/react';

describe('smoke: vitest + RTL works', () => {
  it('runs basic assertion', () => {
    expect(1 + 1).toBe(2);
  });

  it('renders DOM in jsdom', () => {
    render(<div>hello</div>);
    expect(screen.getByText('hello')).toBeInTheDocument();
  });
});
