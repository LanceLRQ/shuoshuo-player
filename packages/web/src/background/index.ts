/// <reference types="chrome" />

// Phase 1 占位：完整实现位于 phase-5-chrome-extension.md
// 关键约束：不再调用 chrome.declarativeNetRequest.updateDynamicRules（仅依赖静态 rules.json）

chrome.runtime.onInstalled.addListener((details) => {
  console.info('[shuoshuo] background installed:', details.reason);
});

chrome.action.onClicked.addListener(() => {
  void chrome.tabs.create({ url: chrome.runtime.getURL('player.html') });
});

// WBI 密钥定时刷新（Phase 5 完整接入）
chrome.alarms?.create('wbi-refresh', { periodInMinutes: 30 });
chrome.alarms?.onAlarm.addListener((alarm) => {
  if (alarm.name === 'wbi-refresh') {
    void chrome.runtime.sendMessage({ type: 'wbi:refresh' }).catch(() => {
      // 接收端不存在时忽略
    });
  }
});

export {};
