/// <reference types="chrome" />
import {
  WBI_REFRESH_ALARM_NAME,
  WBI_REFRESH_MESSAGE_TYPE,
} from '@shuoshuo-player/shared';

/**
 * 关键约束：v1 在 onInstalled 中调用 updateDynamicRules 注入 3 条动态规则，
 * 字段与 manifest 引用的 rules.json 冲突；v2 完全依赖静态规则，
 * 此处禁止再调用 updateDynamicRules（参考 plans/phase-5 §5.1.1）。
 */

chrome.runtime.onInstalled.addListener((details) => {
  console.info('[shuoshuo] background installed:', details.reason);
});

chrome.action.onClicked.addListener(() => {
  void chrome.tabs.create({ url: chrome.runtime.getURL('player.html') });
});

chrome.alarms?.create(WBI_REFRESH_ALARM_NAME, { periodInMinutes: 30 });

chrome.alarms?.onAlarm.addListener((alarm) => {
  if (alarm.name !== WBI_REFRESH_ALARM_NAME) return;
  // 没有活跃 player 页面时 sendMessage 会 reject，无需处理
  void chrome.runtime.sendMessage({ type: WBI_REFRESH_MESSAGE_TYPE }).catch(() => {
    /* noop */
  });
});

export {};
