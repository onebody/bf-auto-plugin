/**
 * Background Service Worker - 插件后台服务主文件
 * @module background/service-worker
 */

import { initMessageListener } from './message-router.js';
import { initStateManager } from './state-manager.js';

/**
 * 初始化 Background Service Worker
 */
function init() {
  console.log('[ServiceWorker] Betaflight助手 后台服务已启动');

  // 初始化消息监听
  initMessageListener();

  // 初始化状态管理器
  initStateManager();

  // 监听插件安装事件
  chrome.runtime.onInstalled.addListener(handleInstalled);

  // 监听标签页更新事件
  chrome.tabs.onUpdated.addListener(handleTabUpdated);
}

/**
 * 处理插件安装事件
 * @param {object} details - 安装详情
 */
function handleInstalled(details) {
  console.log(`[ServiceWorker] 插件已安装/更新: ${details.reason}`);
  if (details.reason === 'install') {
    console.log('[ServiceWorker] 首次安装，执行初始化操作');
  }
}

/**
 * 处理标签页更新事件
 * @param {number} tabId - 标签页 ID
 * @param {object} changeInfo - 变化信息
 * @param {object} tab - 标签页对象
 */
function handleTabUpdated(tabId, changeInfo, tab) {
  // 可以在这里处理 BetaFlight 页面加载完成后的操作
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('app.betaflight.com')) {
    console.log('[ServiceWorker] BetaFlight 页面已加载完成');
  }
}

/**
 * 获取当前活跃的 BetaFlight 标签页
 * @returns {Promise<object|null>} 标签页对象或 null
 */
export async function getActiveTab() {
  try {
    const tabs = await chrome.tabs.query({ url: 'https://app.betaflight.com/*' });
    return tabs.length > 0 ? tabs[0] : null;
  } catch (error) {
    console.error('[ServiceWorker] 获取活跃标签页失败:', error);
    return null;
  }
}

/**
 * 向 Content Script 发送消息
 * @param {object} message - 消息对象
 * @returns {Promise<object>} 响应结果
 */
export async function sendToContentScript(message) {
  const tab = await getActiveTab();
  if (!tab) {
    return { success: false, error: { message: '未找到活跃的 BetaFlight 标签页' } };
  }

  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tab.id, message, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ success: false, error: { message: chrome.runtime.lastError.message } });
      } else {
        resolve(response);
      }
    });
  });
}

// 启动后台服务
init();
