/**
 * 配置管理模块 - 飞机配置列表（钻取视图）+ 配置 CRUD + 连接飞机/读取参数/写入飞控
 * @module popup/modules/config-manager
 */

import { MessageAction } from '../../shared/message-protocol.js';
import { sendMessageToContent, showStatus, showConfirm } from '../popup.js';
import { ApiService } from '../../shared/api-service.js';
import { ConfigList } from '../components/config-list.js';

/**
 * 配置管理模块
 */
export const ConfigManager = {
  currentAircraft: null, // 当前钻取进入的飞机对象
  readData: null,        // 新建配置时 CLI 导出的数据（{mode, raw, structured, paramCount}）

  /**
   * 初始化配置管理模块
   */
  init() {
    console.log('[ConfigManager] 初始化（v2.0.0 - 配置列表钻取 + CRUD + 连接飞机）');

    this.listContainer = document.getElementById('config-list-container');
    this.aircraftView = document.getElementById('aircraft-view');
    this.configView = document.getElementById('config-view');
    this.btnBack = document.getElementById('btn-back-to-aircraft');
    this.btnNewConfig = document.getElementById('btn-new-config');

    // 初始化配置列表组件
    this.configList = new ConfigList(this.listContainer, {
      onWrite: (config) => this.handleWriteToFC(config),
      onRename: (config) => this.handleRenameConfig(config),
      onDelete: (config) => this.handleDeleteConfig(config)
    });

    if (this.btnBack) {
      this.btnBack.addEventListener('click', () => this.close());
    }
    if (this.btnNewConfig) {
      this.btnNewConfig.addEventListener('click', () => this.showCreateConfigOverlay());
    }
  },

  /**
   * 视图切换（飞机列表 ⇄ 配置列表）
   * @param {string} view - 'aircraft' | 'config'
   */
  showView(view) {
    if (!this.aircraftView || !this.configView) return;
    this.aircraftView.style.display = view === 'aircraft' ? 'block' : 'none';
    this.configView.style.display = view === 'config' ? 'block' : 'none';
  },

  /**
   * 进入某飞机的配置列表（钻取）
   * @param {object} aircraft - 飞机对象
   */
  open(aircraft) {
    this.currentAircraft = aircraft;
    const title = document.getElementById('config-aircraft-title');
    if (title) title.textContent = aircraft.title || '未命名飞机';
    this.showView('config');
    this.loadConfigs();
  },

  /**
   * 返回飞机列表
   */
  close() {
    this.currentAircraft = null;
    this.showView('aircraft');
  },

  /**
   * 加载当前飞机的配置列表
   */
  async loadConfigs() {
    if (!this.currentAircraft) return;

    const authStatus = await ApiService.checkAuthStatus();
    if (!authStatus.isAuthenticated) {
      this.configList.render([]);
      showStatus('config-status', '请先登录后再查看配置列表', 'info');
      return;
    }

    try {
      const result = await ApiService.getConfigFiles({ device_id: this.currentAircraft.id });
      const configs = Array.isArray(result) ? result : (result.items || result.data || []);
      this.configList.render(configs);
    } catch (error) {
      console.error('[ConfigManager] 加载配置列表失败:', error);

      if (error.message && error.message.includes('401')) {
        showStatus('config-status', '请先登录后再查看配置列表', 'info');
      } else if (error.message && error.message.includes('API 密钥')) {
        showStatus('config-status', '无法连接到服务器，请检查网络', 'error');
      } else {
        showStatus('config-status', `加载失败: ${error.message}`, 'error');
      }
    }
  },

  /**
   * 检查飞控连接；未连接时触发页面连接按钮并提示
   * @param {string} statusEl - 状态提示元素 ID
   * @returns {Promise<boolean>} 是否已连接
   */
  async ensureFCConnected(statusEl) {
    const check = await sendMessageToContent(MessageAction.CHECK_FC_CONNECTION, null);
    if (check.success && check.data && check.data.connected) {
      return true;
    }
    // 未连接 → 触发页面连接按钮，由用户在页面完成端口选择
    await sendMessageToContent(MessageAction.CLICK_CONNECT_BUTTON, null);
    showStatus(statusEl, '未检测到飞控连接，已在页面触发连接，请选择端口后重试', 'info');
    return false;
  },

  /**
   * 统一提取响应错误信息（automation-engine 的 error 可能是字符串）
   * @param {object} response - 消息响应对象
   * @returns {string} 错误信息
   */
  extractErrorMessage(response) {
    if (!response || !response.error) return '未知错误';
    if (typeof response.error === 'string') return response.error;
    return response.error.message || '未知错误';
  },

  /**
   * 读取模式选择对话框（dump/diff 互斥单选，dump 默认选中）
   * @returns {Promise<'dump'|'diff'|null>} 用户确认返回模式，取消返回 null
   */
  showReadModeDialog() {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'bf-plugin-confirm-overlay';

      const dialog = document.createElement('div');
      dialog.className = 'bf-plugin-confirm-dialog';

      const title = document.createElement('h3');
      title.className = 'bf-plugin-confirm-title';
      title.textContent = '选择参数导出模式';
      dialog.appendChild(title);

      const msg = document.createElement('p');
      msg.className = 'bf-plugin-confirm-message';
      msg.textContent = '请选择要导出的参数范围：';
      dialog.appendChild(msg);

      const options = document.createElement('div');
      options.className = 'bf-plugin-mode-options';
      const modes = [
        { value: 'dump', label: '全量参数（dump）', desc: '导出飞控全部参数' },
        { value: 'diff', label: '仅修改过的参数（diff）', desc: '只导出与默认值不同的参数' }
      ];
      let selected = 'dump';
      modes.forEach((m, i) => {
        const opt = document.createElement('label');
        opt.className = 'bf-plugin-mode-option';
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'bf-read-mode';
        radio.value = m.value;
        radio.checked = i === 0;
        radio.addEventListener('change', () => { selected = m.value; });
        const textWrap = document.createElement('span');
        textWrap.className = 'bf-plugin-mode-text';
        const t1 = document.createElement('strong');
        t1.textContent = m.label;
        const t2 = document.createElement('small');
        t2.textContent = m.desc;
        textWrap.appendChild(t1);
        textWrap.appendChild(t2);
        opt.appendChild(radio);
        opt.appendChild(textWrap);
        options.appendChild(opt);
      });
      dialog.appendChild(options);

      const buttons = document.createElement('div');
      buttons.className = 'bf-plugin-confirm-buttons';

      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'bf-plugin-button confirm-cancel';
      cancelBtn.textContent = '取消';
      cancelBtn.addEventListener('click', () => {
        overlay.remove();
        resolve(null);
      });
      buttons.appendChild(cancelBtn);

      const okBtn = document.createElement('button');
      okBtn.className = 'bf-plugin-button primary';
      okBtn.textContent = '确定';
      okBtn.addEventListener('click', () => {
        overlay.remove();
        resolve(selected);
      });
      buttons.appendChild(okBtn);

      dialog.appendChild(buttons);
      overlay.appendChild(dialog);
      document.body.appendChild(overlay);
    });
  },

  /**
   * 新建配置弹窗（含连接飞机 / 读取参数）
   */
  showCreateConfigOverlay() {
    if (!this.currentAircraft) return;
    this.readData = null;

    const overlay = document.createElement('div');
    overlay.className = 'bf-plugin-confirm-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'bf-plugin-confirm-dialog';

    const title = document.createElement('h3');
    title.className = 'bf-plugin-confirm-title';
    title.textContent = `新建配置 - ${this.currentAircraft.title || ''}`;
    dialog.appendChild(title);

    // 配置名称
    const nameGroup = document.createElement('div');
    nameGroup.className = 'bf-plugin-form-group';
    const nameLabel = document.createElement('label');
    nameLabel.className = 'bf-plugin-label';
    nameLabel.textContent = '配置名称';
    const nameInput = document.createElement('input');
    nameInput.className = 'bf-plugin-input';
    nameInput.placeholder = '请输入配置名称';
    nameGroup.appendChild(nameLabel);
    nameGroup.appendChild(nameInput);
    dialog.appendChild(nameGroup);

    // 参数分类
    const catGroup = document.createElement('div');
    catGroup.className = 'bf-plugin-form-group';
    const catLabel = document.createElement('label');
    catLabel.className = 'bf-plugin-label';
    catLabel.textContent = '分类';
    const catSelect = document.createElement('select');
    catSelect.className = 'bf-plugin-input';
    catSelect.innerHTML = `
      <option value="">请选择</option>
      <option value="PID">PID</option>
      <option value="Rates">Rates</option>
      <option value="滤波器">滤波器</option>
      <option value="电机">电机</option>
      <option value="综合">综合</option>
    `;
    catGroup.appendChild(catLabel);
    catGroup.appendChild(catSelect);
    dialog.appendChild(catGroup);

    // 连接飞机区（状态 + 按钮）
    const connGroup = document.createElement('div');
    connGroup.className = 'bf-plugin-form-group';
    const connLabel = document.createElement('label');
    connLabel.className = 'bf-plugin-label';
    connLabel.textContent = '连接飞机';
    const connRow = document.createElement('div');
    connRow.className = 'bf-plugin-inline-row';
    const connBtn = document.createElement('button');
    connBtn.className = 'bf-plugin-button small';
    connBtn.textContent = '连接飞机';
    const connState = document.createElement('span');
    connState.className = 'bf-plugin-conn-state';
    connState.textContent = '未连接';
    connRow.appendChild(connBtn);
    connRow.appendChild(connState);
    connGroup.appendChild(connLabel);
    connGroup.appendChild(connRow);
    dialog.appendChild(connGroup);

    // 读取参数区（按钮 + 状态）
    const readGroup = document.createElement('div');
    readGroup.className = 'bf-plugin-form-group';
    const readLabel = document.createElement('label');
    readLabel.className = 'bf-plugin-label';
    readLabel.textContent = '读取飞机参数';
    const readRow = document.createElement('div');
    readRow.className = 'bf-plugin-inline-row';
    const readBtn = document.createElement('button');
    readBtn.className = 'bf-plugin-button small';
    readBtn.textContent = '读取参数';
    readBtn.disabled = true; // 连接成功后可用
    const readState = document.createElement('span');
    readState.className = 'bf-plugin-conn-state';
    readState.textContent = '未读取';
    readRow.appendChild(readBtn);
    readRow.appendChild(readState);
    readGroup.appendChild(readLabel);
    readGroup.appendChild(readRow);
    dialog.appendChild(readGroup);

    // 操作按钮：取消关闭 / 确认提交
    const buttons = document.createElement('div');
    buttons.className = 'bf-plugin-confirm-buttons';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'bf-plugin-button confirm-cancel';
    cancelBtn.textContent = '取消关闭';
    cancelBtn.addEventListener('click', () => overlay.remove());
    buttons.appendChild(cancelBtn);

    const okBtn = document.createElement('button');
    okBtn.className = 'bf-plugin-button primary';
    okBtn.textContent = '确认提交';
    okBtn.addEventListener('click', async () => {
      // 提交前非空校验
      const name = nameInput.value.trim();
      if (!name) {
        showStatus('config-status', '请输入配置名称', 'error');
        nameInput.focus();
        return;
      }

      okBtn.disabled = true;
      try {
        await ApiService.createConfigFile({
          device_id: this.currentAircraft.id,
          name,
          param_category: catSelect.value || null,
          params_json: this.readData ? this.readData.structured : null,
          cli_commands: this.readData ? this.readData.raw : ''
        });
        // 成功后关闭弹窗并自动刷新列表（无页面重载）
        overlay.remove();
        const modeLabel = this.readData && this.readData.mode === 'diff' ? '增量diff' : '全量dump';
        showStatus('config-status', this.readData
          ? `配置已保存（${modeLabel}，${this.readData.paramCount} 参数）`
          : '配置已保存（未导出参数）', 'success');
        this.loadConfigs();
      } catch (error) {
        console.error('[ConfigManager] 保存配置失败:', error);
        showStatus('config-status', `保存失败: ${error.message}`, 'error');
        okBtn.disabled = false;
      }
    });
    buttons.appendChild(okBtn);

    dialog.appendChild(buttons);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    nameInput.focus();

    // 连接飞机：检测连接状态；未连接则触发页面连接按钮
    connBtn.addEventListener('click', async () => {
      connBtn.disabled = true;
      connState.textContent = '检测中...';
      try {
        const check = await sendMessageToContent(MessageAction.CHECK_FC_CONNECTION, null);
        if (check.success && check.data && check.data.connected) {
          connState.textContent = '已连接';
          readBtn.disabled = false;
        } else {
          await sendMessageToContent(MessageAction.CLICK_CONNECT_BUTTON, null);
          connState.textContent = '已触发页面连接，请选择端口后再点检查';
        }
      } catch (error) {
        console.error('[ConfigManager] 连接飞机失败:', error);
        connState.textContent = '连接失败: ' + error.message;
      } finally {
        connBtn.disabled = false;
      }
    });

    // 读取参数：先弹导出模式选择（dump/diff），确认后经 CLI 导出（连接成功后可用）
    readBtn.addEventListener('click', async () => {
      const mode = await this.showReadModeDialog();
      if (!mode) return; // 用户取消

      const modeLabel = mode === 'diff' ? '增量diff' : '全量dump';
      readBtn.disabled = true;
      okBtn.disabled = true;
      readState.textContent = `导出中（${modeLabel}），预计 10-60 秒...`;
      try {
        const response = await sendMessageToContent(MessageAction.AIRCRAFT_READ_FROM_PAGE, { mode });
        if (response.success && response.data) {
          this.readData = response.data;
          readState.textContent = `已导出 ${modeLabel}（${response.data.paramCount} 参数）`;
        } else {
          this.readData = null;
          readState.textContent = '导出失败: ' + this.extractErrorMessage(response);
        }
      } catch (error) {
        console.error('[ConfigManager] 读取参数失败:', error);
        this.readData = null;
        readState.textContent = '导出失败: ' + error.message;
      } finally {
        readBtn.disabled = false;
        okBtn.disabled = false;
      }
    });
  },

  /**
   * 配置改名弹窗
   * @param {object} config - 配置对象
   */
  handleRenameConfig(config) {
    const overlay = document.createElement('div');
    overlay.className = 'bf-plugin-confirm-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'bf-plugin-confirm-dialog';

    const title = document.createElement('h3');
    title.className = 'bf-plugin-confirm-title';
    title.textContent = `重命名配置 - ${config.name}`;
    dialog.appendChild(title);

    const input = document.createElement('input');
    input.className = 'bf-plugin-input';
    input.value = config.name;
    input.placeholder = '请输入新的配置名称';
    dialog.appendChild(input);

    const buttons = document.createElement('div');
    buttons.className = 'bf-plugin-confirm-buttons';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'bf-plugin-button confirm-cancel';
    cancelBtn.textContent = '取消';
    cancelBtn.addEventListener('click', () => overlay.remove());
    buttons.appendChild(cancelBtn);

    const okBtn = document.createElement('button');
    okBtn.className = 'bf-plugin-button primary';
    okBtn.textContent = '保存';
    okBtn.addEventListener('click', async () => {
      const newName = input.value.trim();
      if (!newName) {
        showStatus('config-status', '请输入配置名称', 'error');
        input.focus();
        return;
      }
      if (newName === config.name) {
        overlay.remove();
        return;
      }
      try {
        await ApiService.updateConfigFile(config.id, { name: newName });
        showStatus('config-status', '配置已重命名', 'success');
        overlay.remove();
        this.loadConfigs();
      } catch (error) {
        console.error('[ConfigManager] 配置改名失败:', error);
        showStatus('config-status', `改名失败: ${error.message}`, 'error');
      }
    });
    buttons.appendChild(okBtn);

    dialog.appendChild(buttons);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    input.focus();
  },

  /**
   * 处理删除配置
   * @param {object} config - 配置对象
   */
  async handleDeleteConfig(config) {
    const confirmed = await showConfirm('删除配置', `确定要删除配置 "${config.name}" 吗？其全部版本快照将一并删除。`);
    if (!confirmed) return;

    try {
      await ApiService.deleteConfigFile(config.id);
      showStatus('config-status', '配置已删除', 'success');
      this.loadConfigs();
    } catch (error) {
      console.error('[ConfigManager] 删除配置失败:', error);
      showStatus('config-status', `删除失败: ${error.message}`, 'error');
    }
  },

  /**
   * 将配置参数写入飞控（写入前检查连接；未连接则触发页面连接）
   * @param {object} config - 配置对象（列表精简数据）
   */
  async handleWriteToFC(config) {
    try {
      showStatus('config-status', '正在检查飞控连接...', 'info');
      const connected = await this.ensureFCConnected('config-status');
      if (!connected) return;

      // 列表响应不含大字段，先取详情
      const detail = await ApiService.getConfigFileById(config.id);
      const data = detail.data || detail;
      if (!data.params_json || typeof data.params_json !== 'object') {
        showStatus('config-status', '该配置没有参数数据，无法写入', 'error');
        return;
      }

      showStatus('config-status', '正在写入参数到飞控...', 'info');
      const response = await sendMessageToContent(MessageAction.AIRCRAFT_WRITE_TO_PAGE, {
        aircraft: data.params_json
      });
      if (response.success) {
        showStatus('config-status', '参数写入成功', 'success');
      } else {
        showStatus('config-status', `写入失败: ${this.extractErrorMessage(response)}`, 'error');
      }
    } catch (error) {
      console.error('[ConfigManager] 写入飞控失败:', error);
      showStatus('config-status', `写入失败: ${error.message}`, 'error');
    }
  }
};
