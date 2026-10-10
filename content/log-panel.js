/**
 * 日志面板 - 注入到 BetaFlight 页面的悬浮日志面板
 * @module content/log-panel
 */

/**
 * 初始化日志面板
 * 此函数会在 Content Script 中被调用，注入日志面板到页面
 */
export function initLogPanel() {
  // 检查是否已经注入
  if (document.getElementById('bf-log-panel')) {
    console.log('[LogPanel] 日志面板已存在');
    return;
  }

  console.log('[LogPanel] 开始注入日志面板');

  // 创建面板容器
  const panel = createPanel();
  document.body.appendChild(panel);

  // 提供全局访问接口
  window.BFLog = {
    /**
     * 添加日志
     * @param {string} level - 日志级别（info/success/error）
     * @param {string} message - 日志消息
     */
    add(level, message) {
      addLogEntry(level, message);
    },

    /**
     * 清除所有日志
     */
    clear() {
      const content = document.getElementById('bf-log-content');
      if (content) {
        content.innerHTML = '';
      }
    },

    /**
     * 导出日志
     * @returns {string} 日志文本
     */
    export() {
      const content = document.getElementById('bf-log-content');
      if (!content) return '';
      return Array.from(content.children)
        .map(el => el.textContent)
        .join('\n');
    }
  };

  console.log('[LogPanel] 日志面板注入完成');
}

/**
 * 创建面板 DOM 结构
 * @returns {HTMLElement} 面板元素
 */
function createPanel() {
  const panel = document.createElement('div');
  panel.id = 'bf-log-panel';
  panel.className = 'bf-log-panel';

  // 面板 HTML 结构
  panel.innerHTML = `
    <div class="bf-log-header">
      <span class="bf-log-title">Betaflight助手 日志</span>
      <div class="bf-log-controls">
        <button class="bf-log-btn" id="bf-log-clear">清除</button>
        <button class="bf-log-btn" id="bf-log-close">关闭</button>
      </div>
    </div>
    <div class="bf-log-content" id="bf-log-content"></div>
  `;

  // 绑定事件
  panel.querySelector('#bf-log-clear').addEventListener('click', () => {
    window.BFLog.clear();
  });

  panel.querySelector('#bf-log-close').addEventListener('click', () => {
    panel.style.display = 'none';
  });

  return panel;
}

/**
 * 添加日志条目
 * @param {string} level - 日志级别
 * @param {string} message - 日志消息
 */
function addLogEntry(level, message) {
  const content = document.getElementById('bf-log-content');
  if (!content) return;

  const entry = document.createElement('div');
  entry.className = `bf-log-entry ${level}`;
  entry.innerHTML = `
    <span class="bf-log-time">${new Date().toLocaleTimeString()}</span>
    <span class="bf-log-level">[${level.toUpperCase()}]</span>
    <span class="bf-log-message">${message}</span>
  `;

  content.appendChild(entry);

  // 保留最近 100 条
  while (content.children.length > 100) {
    content.removeChild(content.firstChild);
  }

  // 自动滚动到底部
  content.scrollTop = content.scrollHeight;
}
