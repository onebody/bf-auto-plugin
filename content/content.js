/**
 * Content Script 入口
 * @module content/content
 * @version v1.1.0 - 仅保留飞控连接和参数读写功能
 */

import { MessageSource, MessageTarget, MessageAction } from '../shared/message-protocol.js';
import { AutomationEngine } from './automation-engine.js';
import { waitForElement, inputText, clickElement } from './dom-operator.js';
import { SELECTORS } from './selectors.js';

/**
 * 初始化 Content Script
 */
function init() {
  console.log('[Content] BetaFlight Auto Tuning Content Script 已加载 (v1.1.0)');

  // 初始化消息监听
  initMessageListener();

  // 注入日志面板
  injectLogPanel();
}

/**
 * 初始化消息监听（接收来自 Background 的消息）
 */
function initMessageListener() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message, sender, sendResponse);
    return true; // 保持消息通道开放
  });
}

/**
 * 处理收到的消息
 * @param {object} message - 消息对象
 * @param {object} sender - 发送者信息
 * @param {function} sendResponse - 响应回调函数
 */
async function handleMessage(message, sender, sendResponse) {
  try {
    const { source, target, action, payload } = message;

    console.log(`[Content] 收到消息: ${action} (from=${source})`);

    // 只处理目标是 content 的消息
    if (target !== MessageTarget.CONTENT) {
      sendResponse({ success: false, error: { message: '消息目标不是 content' } });
      return;
    }

    let result;

    switch (action) {
      case MessageAction.CHECK_FC_CONNECTION:
        result = await handleCheckFCConnection();
        break;

      case MessageAction.CLICK_CONNECT_BUTTON:
        result = await handleClickConnectButton();
        break;

      case MessageAction.AIRCRAFT_READ_FROM_PAGE:
        result = await handleReadFromPage(payload);
        break;

      case MessageAction.AIRCRAFT_WRITE_TO_PAGE:
        result = await handleWriteToPage(payload);
        break;

      case MessageAction.AUTOMATION_LOG:
        result = await handleLog(payload);
        break;

      default:
        result = { success: false, error: { message: `未知的消息动作: ${action}` } };
    }

    sendResponse(result);
  } catch (error) {
    console.error('[Content] 处理消息失败:', error);
    sendResponse({ success: false, error: { message: error.message } });
  }
}

/**
 * 处理检查飞控连接状态
 * @returns {Promise<object>} 连接状态结果
 */
async function handleCheckFCConnection() {
  try {
    console.log('[Content] 检测飞控连接状态...');

    // 方案1：检查是否存在"Disconnect"按钮（已连接）
    const disconnectBtn = document.querySelector(SELECTORS.FC_CONNECTION.DISCONNECT_BUTTON);
    if (disconnectBtn && disconnectBtn.offsetParent !== null) {
      const details = `已连接（检测到 Disconnect 按钮: ${disconnectBtn.textContent.trim()}）`;
      console.log('[Content] ' + details);
      return { success: true, data: { connected: true, details } };
    }

    // 方案2：检查是否存在"Connect"按钮（未连接）
    const connectBtn = document.querySelector(SELECTORS.FC_CONNECTION.CONNECT_BUTTON);
    if (connectBtn && connectBtn.offsetParent !== null) {
      const details = `未连接（检测到 Connect 按钮: ${connectBtn.textContent.trim()}）`;
      console.log('[Content] ' + details);
      return { success: true, data: { connected: false, details } };
    }

    // 方案3：检查状态文字
    const statusText = document.querySelector(SELECTORS.FC_CONNECTION.STATUS_TEXT);
    if (statusText) {
      const text = statusText.textContent.toLowerCase();
      if (text.includes('port_close') || text.includes('未连接') || text.includes('disconnected')) {
        const details = `未连接（状态文字: ${statusText.textContent.trim()}）`;
        console.log('[Content] ' + details);
        return { success: true, data: { connected: false, details } };
      } else if (text.includes('com') || text.includes('tty') || text.includes('connected')) {
        const details = `已连接（状态文字: ${statusText.textContent.trim()}）`;
        console.log('[Content] ' + details);
        return { success: true, data: { connected: true, details } };
      }
    }

    // 方案4：检查端口选择下拉框（如果存在，说明未连接）
    const portSelect = document.querySelector(SELECTORS.FC_CONNECTION.PORT_SELECT);
    if (portSelect && portSelect.offsetParent !== null) {
      const details = '未连接（检测到端口选择框）';
      console.log('[Content] ' + details);
      return { success: true, data: { connected: false, details } };
    }

    // 无法确定（可能页面未完全加载）
    const details = '无法确定连接状态（未检测到连接/断开按钮）';
    console.warn('[Content] ' + details);
    return { success: true, data: { connected: false, details, uncertain: true } };

  } catch (error) {
    console.error('[Content] 检测飞控连接失败:', error);
    return { success: false, error: { message: error.message } };
  }
}

/**
 * 处理点击连接按钮
 * @returns {Promise<object>} 操作结果
 */
async function handleClickConnectButton() {
  try {
    console.log('[Content] 点击连接按钮...');

    // 查找连接按钮
    const connectBtn = await waitForElement(SELECTORS.FC_CONNECTION.CONNECT_BUTTON, 3000);
    
    if (!connectBtn) {
      return { 
        success: false, 
        error: { message: '未找到连接按钮，请确认页面已加载完成' } 
      };
    }

    // 点击连接按钮
    connectBtn.click();
    console.log('[Content] 已点击连接按钮');

    // 等待可能出现的端口选择对话框
    await sleep(500);

    return { 
      success: true, 
      data: { 
        message: '已点击连接按钮，请在页面上选择端口并确认连接' 
      } 
    };

  } catch (error) {
    console.error('[Content] 点击连接按钮失败:', error);
    return { success: false, error: { message: error.message } };
  }
}

/**
 * 处理从页面读取参数
 * @param {object} payload - 读取选项
 * @returns {Promise<object>} 读取到的参数
 */
async function handleReadFromPage(payload) {
  try {
    const result = await AutomationEngine.readParametersFromPage();
    return result;
  } catch (error) {
    console.error('[Content] 从页面读取参数失败:', error);
    return { success: false, error: { message: error.message } };
  }
}

/**
 * 处理写入参数到页面
 * @param {object} payload - 要写入的参数
 * @returns {Promise<object>} 处理结果
 */
async function handleWriteToPage(payload) {
  try {
    const { aircraft } = payload;
    const result = await AutomationEngine.writeParametersToPage(aircraft);
    return result;
  } catch (error) {
    console.error('[Content] 写入参数到页面失败:', error);
    return { success: false, error: { message: error.message } };
  }
}

/**
 * 处理日志消息
 * @param {object} payload - 日志内容
 * @returns {Promise<object>} 处理结果
 */
async function handleLog(payload) {
  try {
    const { level, message } = payload;
    console.log(`[Automation ${level}] ${message}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: { message: error.message } };
  }
}

/**
 * 注入日志面板
 */
function injectLogPanel() {
  // 检查是否已经注入
  if (document.getElementById('bf-log-panel')) {
    return;
  }

  // 创建日志面板容器
  const panel = document.createElement('div');
  panel.id = 'bf-log-panel';
  panel.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 300px;
    max-height: 400px;
    background: white;
    border: 1px solid #ddd;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 99999;
    overflow: hidden;
    font-size: 12px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;

  // 面板标题
  const header = document.createElement('div');
  header.style.cssText = `
    background: #4CAF50;
    color: white;
    padding: 8px 12px;
    font-weight: 600;
    display: flex;
    justify-content: space-between;
    align-items: center;
  `;
  header.innerHTML = '<span>Betaflight助手 日志</span><span style="cursor:pointer;" id="bf-log-close">×</span>';

  // 日志内容区域
  const content = document.createElement('div');
  content.id = 'bf-log-content';
  content.style.cssText = `
    padding: 8px;
    max-height: 350px;
    overflow-y: auto;
  `;

  panel.appendChild(header);
  panel.appendChild(content);
  document.body.appendChild(panel);

  // 关闭按钮事件
  document.getElementById('bf-log-close').addEventListener('click', () => {
    panel.style.display = 'none';
  });

  // 提供全局访问接口
  window.BFLog = {
    add(level, message) {
      const logEntry = document.createElement('div');
      logEntry.style.cssText = `margin-bottom:4px;padding:4px;background:${level === 'error' ? '#ffebee' : level === 'success' ? '#e8f5e9' : '#f5f5f5'};border-radius:2px;`;
      logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
      content.appendChild(logEntry);
      // 保留最近 100 条
      while (content.children.length > 100) {
        content.removeChild(content.firstChild);
      }
      content.scrollTop = content.scrollHeight;
    },
    clear() {
      content.innerHTML = '';
    },
    export() {
      return Array.from(content.children).map(el => el.textContent).join('\n');
    }
  };

  console.log('[Content] 日志面板已注入');
}

/**
 * 延迟指定时间
 * @param {number} ms - 延迟毫秒数
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 启动 Content Script
init();
