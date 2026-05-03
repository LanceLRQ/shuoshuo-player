/**
 * A6: cookie-strip 单测
 *
 * 与 Rust 端 commands::auth::tests 平行，确保前后端行为一致：
 * 任何写入 bilibili_cookies.json 的 cookie，session 必须为 false。
 */

import { stripSession, stripSessions, type BilibiliCookie } from './cookie-strip';

function rec(name: string, session?: boolean): BilibiliCookie {
  return { name, value: 'v', domain: '.bilibili.com', path: '/', session };
}

describe('stripSession', () => {
  it('session=true → false', () => {
    const c = rec('SESSDATA', true);
    stripSession(c);
    expect(c.session).toBe(false);
  });

  it('session=false 保持 false（幂等）', () => {
    const c = rec('buvid3', false);
    stripSession(c);
    expect(c.session).toBe(false);
  });

  it('session=undefined 设为 false', () => {
    const c = rec('DedeUserID');
    stripSession(c);
    expect(c.session).toBe(false);
  });

  it('返回原对象引用（就地修改）', () => {
    const c = rec('x', true);
    expect(stripSession(c)).toBe(c);
  });
});

describe('stripSessions', () => {
  it('批量剥离所有 session 标记', () => {
    const cookies = [rec('SESSDATA', true), rec('buvid3', true), rec('DedeUserID', false)];
    stripSessions(cookies);
    expect(cookies.every((c) => c.session === false)).toBe(true);
  });

  it('空数组不抛错', () => {
    expect(() => stripSessions([])).not.toThrow();
  });

  it('返回原数组引用', () => {
    const cookies = [rec('a', true)];
    expect(stripSessions(cookies)).toBe(cookies);
  });
});
