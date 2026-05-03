/**
 * Cookie 持久化前的 session 标记剥离工具（v1 main.js 第 38-54 行行为镜像）
 *
 * 与 Rust 端 commands/auth.rs 中 strip_session/strip_sessions 行为一致：
 * 任何要写入 bilibili_cookies.json 的 cookie，session 字段必须为 false，
 * 否则关闭应用后 WebView 会 GC 掉 session cookie 造成登录态丢失。
 *
 * 前端镜像主要用于：
 * - tauri-auth-adapter 在调用 Rust 命令前的兜底校验
 * - 测试边界条件（无需起 Rust 进程即可验证 strip 逻辑）
 */

export interface BilibiliCookie {
  name: string;
  value: string;
  domain?: string | null;
  path?: string | null;
  session?: boolean;
}

/** 单条 cookie 就地剥离 session 标记 */
export function stripSession(cookie: BilibiliCookie): BilibiliCookie {
  cookie.session = false;
  return cookie;
}

/** 批量剥离一组 cookie 的 session 标记 */
export function stripSessions(cookies: BilibiliCookie[]): BilibiliCookie[] {
  for (const c of cookies) stripSession(c);
  return cookies;
}
