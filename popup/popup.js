/**
 * Popup 弹窗逻辑入口
 * @module popup/popup
 */

import { MessageSource, MessageTarget, MessageAction, createMessage } from '../shared/message-protocol.js';
import { AccountManager } from './modules/account-manager.js';
import { AircraftManager } from './modules/aircraft-manager.js';
import { ConfigManager } from './modules/config-manager.js';

let currentUser = null;
let pendingTab = null; // 用户登录前尝试访问的Tab

/**
 * 初始化 Popup
 */
async function init() {
  console.log('[Popup] 初始化弹窗（v1.2.0 - API 集成版本）');

  const isValidUrl = await checkValidUrl();
  if (!isValidUrl) {
    showInvalidUrlWarning();
    return;
  }

  initTabs();

  AccountManager.init();
  AircraftManager.init();
  ConfigManager.init();

  initFooterButtons();

  currentUser = await AccountManager.checkAuth();
  await updateAuthUI();
}

/**
 * 检查当前页面 URL 是否符合要求
 */
async function checkValidUrl() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length === 0) return false;

    const url = tabs[0].url;
    if (!url) return false;

    return url.startsWith('https://app.betaflight.com/');
  } catch (error) {
    console.error('[Popup] 检查 URL 失败:', error);
    return false;
  }
}

/**
 * 显示无效 URL 警告
 */
function showInvalidUrlWarning() {
  const content = document.querySelector('.bf-plugin-content');
  if (!content) return;

  content.innerHTML = `
    <div class="bf-plugin-section" style="text-align: center; padding: 40px 20px;">
      <div style="font-size: 48px; margin-bottom: 20px;">🚫</div>
      <h2 class="bf-plugin-section-title" style="color: #e74c3c;">插件使用受限</h2>
      <p style="color: #666; margin-top: 15px; line-height: 1.6;">
        本插件仅支持在 <strong>BetaFlight Configurator</strong> 页面使用
      </p>
      <p style="color: #999; font-size: 14px; margin-top: 10px;">
        请访问 <a href="https://app.betaflight.com/" target="_blank" style="color: #3498db;">https://app.betaflight.com/</a>
      </p>
    </div>
  `;
}

/**
 * 初始化 Tab 切换
 */
function initTabs() {
  const tabs = document.querySelectorAll('.bf-plugin-tab');
  const contents = document.querySelectorAll('.bf-plugin-tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', async () => {
      const targetTab = tab.dataset.tab;

      if (!currentUser && targetTab !== 'account') {
        pendingTab = targetTab;
        showStatus('login-status', '请先登录后再访问该功能', 'error');
        return;
      }

      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      contents.forEach(content => {
        content.classList.remove('active');
        if (content.id === `tab-${targetTab}`) {
          content.classList.add('active');
        }
      });

      if (targetTab === 'aircraft') {
        handleAircraftTabClick();
      }
    });
  });
}

/**
 * 更新认证 UI
 */
async function updateAuthUI() {
  const authPanel = document.getElementById('auth-panel');
  const profilePanel = document.getElementById('profile-panel');

  if (currentUser) {
    authPanel.style.display = 'none';
    profilePanel.style.display = 'block';

    document.getElementById('profile-phone').textContent = currentUser.phone || '未知';
    document.getElementById('profile-nickname').textContent = currentUser.nickname || '未知';
    document.getElementById('profile-role').textContent = currentUser.role === 'coach' ? '教练' : '飞手';

    if (pendingTab) {
      await switchToTab(pendingTab);
      pendingTab = null;
    }
  } else {
    authPanel.style.display = 'block';
    profilePanel.style.display = 'none';
    
    switchToTab('account');
  }

  updateTabVisibility();
  AircraftManager.setCurrentUser(currentUser);
  ConfigManager.setCurrentUser(currentUser);
}

/**
 * 切换到指定 Tab
 * @param {string} tabName - Tab 名称
 */
async function switchToTab(tabName) {
  const tabs = document.querySelectorAll('.bf-plugin-tab');
  const contents = document.querySelectorAll('.bf-plugin-tab-content');

  tabs.forEach(tab => {
    if (tab.dataset.tab === tabName) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  contents.forEach(content => {
    if (content.id === `tab-${tabName}`) {
      content.classList.add('active');
    } else {
      content.classList.remove('active');
    }
  });

  if (tabName === 'aircraft') {
    await handleAircraftTabClick();
  }
}

/**
 * 更新 Tab 可见性和底部按钮区域
 */
function updateTabVisibility() {
  const tabs = document.querySelectorAll('.bf-plugin-tab');
  const footer = document.querySelector('.bf-plugin-footer');
  
  tabs.forEach(tab => {
    const tabName = tab.dataset.tab;
    
    if (tabName === 'account') {
      tab.style.display = 'block';
    } else if (currentUser) {
      tab.style.display = 'block';
    } else {
      tab.style.display = 'none';
    }
  });
  
  if (footer) {
    footer.style.display = currentUser ? 'block' : 'none';
  }
}

/**
 * 处理飞机 Tab 点击事件
 */
async function handleAircraftTabClick() {
  console.log('[Popup] 切换到飞机 Tab');

  // 钻取视图复位：显示飞机列表
  ConfigManager.close();

  // 加载设备列表
  await AircraftManager.loadAircrafts();
}

/**
 * 显示自定义确认对话框
 */
export function showConfirm(title, message) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'bf-plugin-confirm-overlay';
    overlay.innerHTML = `
      <div class="bf-plugin-confirm-dialog">
        <h3 class="bf-plugin-confirm-title">${title}</h3>
        <p class="bf-plugin-confirm-message">${message}</p>
        <div class="bf-plugin-confirm-buttons">
          <button class="bf-plugin-button confirm-cancel">取消</button>
          <button class="bf-plugin-button primary confirm-ok">确认</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector('.confirm-cancel').addEventListener('click', () => {
      overlay.remove();
      resolve(false);
    });

    overlay.querySelector('.confirm-ok').addEventListener('click', () => {
      overlay.remove();
      resolve(true);
    });
  });
}

/**
 * 初始化底部按钮
 */
function initFooterButtons() {
  const btnExport = document.getElementById('btn-export-data');
  const btnImport = document.getElementById('btn-import-data');
  const btnClearAll = document.getElementById('btn-clear-all');

  btnExport.addEventListener('click', async () => {
    if (!currentUser) {
      showStatus('login-status', '请先登录后再执行此操作', 'error');
      return;
    }
    await handleExportData();
  });

  btnImport.addEventListener('click', async () => {
    if (!currentUser) {
      showStatus('login-status', '请先登录后再执行此操作', 'error');
      return;
    }
    await handleImportData();
  });

  btnClearAll.addEventListener('click', async () => {
    if (!currentUser) {
      showStatus('login-status', '请先登录后再执行此操作', 'error');
      return;
    }
    await handleClearAll();
  });
}

/**
 * 处理导出数据
 */
async function handleExportData() {
  try {
    const response = await sendMessageToBackground(MessageAction.DATA_EXPORT, null);
    if (response.success && response.data) {
      const json = JSON.stringify(response.data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bf-auto-tuning-data-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showStatus('aircraft-status', '数据导出成功', 'success');
    } else {
      showStatus('aircraft-status', '数据导出失败', 'error');
    }
  } catch (error) {
    console.error('[Popup] 导出数据失败:', error);
    showStatus('aircraft-status', `导出失败: ${error.message}`, 'error');
  }
}

/**
 * 处理导入数据
 */
async function handleImportData() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // 异常处理必须包在 async 回调体内：onchange 是异步触发的，
    // 外层 try/catch 捕获不到本回调中的 JSON.parse 等异常
    try {
      const text = await file.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        showStatus('aircraft-status', '导入失败: 文件不是有效的 JSON 格式', 'error');
        return;
      }

      const response = await sendMessageToBackground(MessageAction.DATA_IMPORT, data);
      if (response.success) {
        showStatus('aircraft-status', '数据导入成功', 'success');
        setTimeout(() => location.reload(), 1000);
      } else {
        showStatus('aircraft-status', `导入失败: ${response.error?.message}`, 'error');
      }
    } catch (error) {
      console.error('[Popup] 导入数据失败:', error);
      showStatus('aircraft-status', `导入失败: ${error.message}`, 'error');
    }
  };
  input.click();
}

/**
 * 处理清除所有数据
 */
async function handleClearAll() {
  const confirmed = await showConfirm('清除所有数据', '确定要清除所有数据吗？此操作不可恢复！');
  if (!confirmed) {
    return;
  }

  try {
    const response = await sendMessageToBackground(MessageAction.DATA_CLEAR, null);
    if (response.success) {
      showStatus('aircraft-status', '所有数据已清除', 'success');
      setTimeout(() => location.reload(), 1000);
    } else {
      showStatus('aircraft-status', '清除失败', 'error');
    }
  } catch (error) {
    console.error('[Popup] 清除数据失败:', error);
    showStatus('aircraft-status', `清除失败: ${error.message}`, 'error');
  }
}

/**
 * 向 Background 发送消息
 */
export async function sendMessageToBackground(action, payload) {
  return new Promise((resolve, reject) => {
    const message = createMessage(MessageSource.POPUP, MessageTarget.BACKGROUND, action, payload);
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

/**
 * 向 Content Script 发送消息
 */
export async function sendMessageToContent(action, payload) {
  return new Promise((resolve, reject) => {
    const message = createMessage(MessageSource.POPUP, MessageTarget.CONTENT, action, payload);
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

/**
 * 显示状态提示
 */
export function showStatus(elementId, message, type = 'info') {
  const element = document.getElementById(elementId);
  if (!element) return;

  element.textContent = message;
  element.className = `bf-plugin-status ${type}`;
  element.style.display = 'block';

  setTimeout(() => {
    element.style.display = 'none';
  }, 3000);
}

/**
 * 获取当前用户
 */
export function getCurrentUser() {
  return currentUser;
}

/**
 * 设置当前用户
 */
export function setCurrentUser(user) {
  currentUser = user;
}

/**
 * 刷新认证状态
 */
export async function refreshAuth() {
  currentUser = await AccountManager.checkAuth();
  await updateAuthUI();
  return currentUser;
}

document.addEventListener('DOMContentLoaded', init);