/**
 * 编译期常量，由 vite.config.ts 的 define 注入。
 * - dev:extension（mode=extension-dev）→ true，保留 [WBI-DEBUG] 调试日志
 * - 其他构建（生产、测试、普通 web）→ false，if 块整段（含字符串字面量）被 DCE
 *
 * 不复用 import.meta.env.DEV：避免必须设置 NODE_ENV=development
 * 触发 axios/qs 等库走 dev path 引入 Node 内置模块。
 */
declare const __DEV_LOG__: boolean;
