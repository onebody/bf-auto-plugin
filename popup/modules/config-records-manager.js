/**
 * 配置记录管理模块 - 跨飞机的全部配置记录列表
 * 提供「参数编辑」整页入口（editor/editor.html?configId=N）与删除确认
 * @module popup/modules/config-records-manager
 */

import { ApiService } from '../../shared/api-service.js';
import { showStatus, showConfirm } from '../popup.js';

/**
 * 配置记录管理模块
 */
export const ConfigRecordsManager = {
  records: [],
  deviceMap: {}, // device_id → 飞机名

  /**
   * 初始化模块
   */
  init() {
    console.log('[ConfigRecordsManager] 初始化（v1.0.0 - 配置记录管理 + 参数编辑入口）');
    this.container = document.getElementById('config-records-container');
    this.statusEl = 'config-records-status';
  },

  /**
   * 加载全部配置记录（不带 device_id 即返回全部）
   */
  async loadRecords() {
    if (!this.container) return;

    const authStatus = await ApiService.checkAuthStatus();
    if (!authStatus.isAuthenticated) {
      this.render([]);
      showStatus(this.statusEl, '请先登录后再查看配置记录', 'info');
      return;
    }

    try {
      // 并行加载配置记录与飞机列表（构建 id→名称映射）
      const [recordsResult, devicesResult] = await Promise.all([
        ApiService.getConfigFiles({}),
        ApiService.getDevices({})
      ]);
      const records = Array.isArray(recordsResult) ? recordsResult : (recordsResult.items || recordsResult.data || []);
      const devices = Array.isArray(devicesResult) ? devicesResult : (devicesResult.items || devicesResult.data || []);

      this.deviceMap = {};
      devices.forEach(d => { this.deviceMap[d.id] = d.title || d.name || `飞机#${d.id}`; });

      this.records = records;
      this.render(records);
    } catch (error) {
      console.error('[ConfigRecordsManager] 加载配置记录失败:', error);

      if (error.message && error.message.includes('401')) {
        showStatus(this.statusEl, '请先登录后再查看配置记录', 'info');
      } else if (error.message && error.message.includes('API 密钥')) {
        showStatus(this.statusEl, '无法连接到服务器，请检查网络', 'error');
      } else {
        showStatus(this.statusEl, `加载失败: ${error.message}`, 'error');
      }
    }
  },

  /**
   * 渲染配置记录列表
   * @param {object[]} records - 配置记录数组（精简响应，不含大字段）
   */
  render(records) {
    this.container.innerHTML = '';

    if (!records || records.length === 0) {
      this.container.innerHTML = '<div class="bf-plugin-empty">暂无配置记录，可在「飞机」Tab 钻取后新建配置</div>';
      return;
    }

    records.forEach(record => {
      this.container.appendChild(this.createListItem(record));
    });
  },

  /**
   * 创建列表项
   * @param {object} record - 配置记录对象
   * @returns {HTMLElement} 列表项元素
   */
  createListItem(record) {
    const item = document.createElement('div');
    item.className = 'bf-plugin-list-item';

    // 头部（标题 + 操作按钮）
    const header = document.createElement('div');
    header.className = 'bf-plugin-list-item-header';

    const title = document.createElement('span');
    title.className = 'bf-plugin-list-item-title';
    title.textContent = record.name || `配置#${record.id}`;
    header.appendChild(title);

    const actions = document.createElement('div');
    actions.className = 'bf-plugin-list-item-actions';

    // 参数编辑按钮（列表为精简响应、无 params_json 字段，是否可编辑由编辑器页判定；
    // 无参数数据的记录打开后显示空态引导）
    const editBtn = document.createElement('button');
    editBtn.className = 'bf-plugin-list-item-action edit';
    editBtn.textContent = '参数编辑';
    editBtn.style.color = '#3498db';
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openParamEditor(record.id);
    });
    actions.appendChild(editBtn);

    // 删除按钮
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'bf-plugin-list-item-action delete';
    deleteBtn.textContent = '删除';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.handleDeleteRecord(record);
    });
    actions.appendChild(deleteBtn);

    header.appendChild(actions);
    item.appendChild(header);

    // 描述信息（所属飞机 / 版本 / 更新时间）
    const desc = document.createElement('div');
    desc.className = 'bf-plugin-list-item-desc';
    const parts = [
      `所属飞机: ${this.deviceMap[record.device_id] || `#${record.device_id}`}`
    ];
    if (record.current_version !== undefined && record.current_version !== null) {
      parts.push(`v${record.current_version}`);
    }
    if (record.updated_at) {
      parts.push(`更新于 ${new Date(record.updated_at).toLocaleString()}`);
    }
    desc.textContent = parts.join(' | ');
    item.appendChild(desc);

    return item;
  },

  /**
   * 打开参数编辑整页
   * @param {number} configId - 配置记录 ID
   */
  openParamEditor(configId) {
    const url = chrome.runtime.getURL(`editor/editor.html?configId=${configId}`);
    chrome.tabs.create({ url });
  },

  /**
   * 删除配置记录（含版本快照，需确认）
   * @param {object} record - 配置记录对象
   */
  async handleDeleteRecord(record) {
    const confirmed = await showConfirm(
      '删除配置记录',
      `确定要删除配置 "${record.name}" 吗？其全部版本快照将一并删除。`
    );
    if (!confirmed) return;

    try {
      await ApiService.deleteConfigFile(record.id);
      showStatus(this.statusEl, '配置记录已删除', 'success');
      await this.loadRecords();
    } catch (error) {
      console.error('[ConfigRecordsManager] 删除失败:', error);
      showStatus(this.statusEl, `删除失败: ${error.message}`, 'error');
    }
  }
};
