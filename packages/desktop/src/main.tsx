import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('未找到根节点 #root');
}

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
