// 桌面端 App 是 web 包 App 的薄重导出。
// 路由 / 布局 / 弹窗 / 播放器全部跑在 packages/web/src/App.tsx 中，
// 让 Chrome 扩展端与 Tauri 桌面端共用同一份 UI 与状态管理代码。
export { default } from '@/App';
