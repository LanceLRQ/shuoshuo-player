/// <reference types="chrome" />

/**
 * Chrome 扩展 Background Service Worker
 *
 * 职责：
 * 1. 点击扩展图标 → 打开 player.html
 * 2. 通过 chrome.alarms 每 30 分钟广播 wbi:refresh，提示前端刷新 WBI 密钥
 *
 * 与 v1 差异：v1 在 onInstalled 中 updateDynamicRules 注入 3 条动态规则，
 * 与 manifest 引用的 rules.json 字段不一致且会冲突；v2 完全依赖静态规则，
 * 此处不再调用 updateDynamicRules。
 */

const WBI_REFRESH_ALARM = 'wbi-refresh';

chrome.runtime.onInstalled.addListener((details) => {
  console.info('[shuoshuo] background installed:', details.reason);
});

chrome.action.onClicked.addListener(() => {
  void chrome.tabs.create({ url: chrome.runtime.getURL('player.html') });
});

chrome.alarms?.create(WBI_REFRESH_ALARM, { periodInMinutes: 30 });

chrome.alarms?.onAlarm.addListener((alarm) => {
  if (alarm.name !== WBI_REFRESH_ALARM) return;
  // 没有活跃 player 页面时 sendMessage 会 reject，无需处理
  void chrome.runtime.sendMessage({ type: 'wbi:refresh' }).catch(() => {
    /* noop */
  });
});

export {};
