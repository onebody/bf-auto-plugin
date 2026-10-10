/**
 * 日志查看组件
 * @module popup/components/log-viewer
 */

/**
 * 日志查看组件类
 */
export class LogViewer {
  /**
   * 构造函数
   * @param {HTMLElement} container - 容器元素
   */
  constructor(container) {
    this.container = container;
    this.logs = [];
    this.init();
  }

  /**
   * 初始化组件
   */
  init() {
    this.container.innerHTML = `
      <div class="bf-plugin-log-viewer">
        <div class="bf-plugin-log-header">
          <h3>操作日志</h3>
          <button class="bf-plugin-button small" id="btn-clear-log">清除</button>
        </div>
        <div class="bf-plugin-log-content" id="log-content"></div>
      </div>
    `;

    // 绑定事件
    document.getElementById('btn-clear-log').addEventListener('click', () => {
      this.clear();
    });
  }

  /**
   * 添加日志
   * @param {string} level - 日志级别（info/success/error）
   * @param {string} message - 日志消息
   */
  add(level, message) {
    const log = {
      timestamp: new Date().toISOString(),
      level,
      message
    };

    this.logs.push(log);

    // 保留最近 100 条
    if (this.logs.length > 100) {
      this.logs.shift();
    }

    this.renderLog(log);
  }

  /**
   * 渲染单条日志
   * @param {object} log - 日志对象
   */
  renderLog(log) {
    const content = document.getElementById('log-content');
    if (!content) return;

    const item = document.createElement('div');
    item.className = `bf-plugin-log-item ${level}`;
    item.innerHTML = `<span class="bf-plugin-log-time">${new Date(log.timestamp).toLocaleTimeString()}</span>
                     <span class="bf-plugin-log-message">${log.message}</span>`;

    content.appendChild(item);
    content.scrollTop = content.scrollHeight;
  }

  /**
   * 清除所有日志
   */
  clear() {
    this.logs = [];
    const content = document.getElementById('log-content');
    if (content) {
      content.innerHTML = '';
    }
  }

  /**
   * 导出日志
   * @returns {string} 日志文本
   */
  export() {
    return this.logs.map(log => `[${log.timestamp}] [${log.level}] ${log.message}`).join('\n');
  }
}
