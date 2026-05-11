import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { initializeApp } from './lib/init';
import './styles/globals.css';

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('未找到根节点 #root');
}

// 等待 store 持久化恢复完成后再渲染，避免初次渲染显示空状态后再瞬间切换
initializeApp()
  .catch((err) => {
    console.error('[shuoshuo] initializeApp 失败，使用空状态启动：', err);
  })
  .finally(() => {
    createRoot(rootEl).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  });
