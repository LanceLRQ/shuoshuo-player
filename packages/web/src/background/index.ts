/// <reference types="chrome" />

/**
 * 关键约束：v1 在 onInstalled 中调用 updateDynamicRules 注入 3 条动态规则，
 * 字段与 manifest 引用的 rules.json 冲突；v2 完全依赖静态规则，
 * 此处禁止再调用 updateDynamicRules（参考 plans/phase-5 §5.1.1）。
 *
 * Wbi 密钥刷新策略：与 v1 一致，仅在 player 页面挂载时调一次 nav 接口
 * （wbi key 每日更新一次，单次会话内无需周期刷新；多次刷新反而可能触发风控）。
 */

chrome.runtime.onInstalled.addListener((details) => {
  console.info('[shuoshuo] background installed:', details.reason);
});

chrome.action.onClicked.addListener(() => {
  void chrome.tabs.create({ url: chrome.runtime.getURL('player.html') });
});

export {};
