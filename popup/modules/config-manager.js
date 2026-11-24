/**
 * 配置管理模块 - 飞机配置列表（钻取视图）+ 配置 CRUD + 连接飞机/读取参数/写入飞控
 * @module popup/modules/config-manager
 */

import { MessageAction } from '../../shared/message-protocol.js';
import { sendMessageToContent, showStatus, showConfirm } from '../popup.js';
import { ApiService } from '../../shared/api-service.js';
import { ConfigList } from '../components/config-list.js';
import { ScriptManager } from './script-manager.js';
import {
  validateParamValue,
  structuredToScript, applyScriptSets, validateParamScript
} from '../../editor/param-metadata.js';
import { buildScriptSchema, extraFromUnknown } from '../../editor/script-schema.js';

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
    console.log('[ConfigManager] 初始化（v2.2.0 - 配置列表钻取 + 脚本单入口查看/编辑）');

    this.listContainer = document.getElementById('config-list-container');
    this.aircraftView = document.getElementById('aircraft-view');
    this.configView = document.getElementById('config-view');
    this.scriptViewEl = document.getElementById('script-view');
    this.btnBack = document.getElementById('btn-back-to-aircraft');
    this.btnNewConfig = document.getElementById('btn-new-config');

    // 初始化脚本管理模块（内容逻辑）与配置列表组件
    ScriptManager.init();
    this.configList = new ConfigList(this.listContainer, {
      onEditParams: (config) => this.showParamEditOverlay(config),
      onWrite: (config) => this.handleWriteToFC(config),
      onScript: (config) => this.openScript(config),
      onRename: (config) => this.handleRenameConfig(config),
      onDelete: (config) => this.handleDeleteConfig(config)
    });

    if (this.btnBack) {
      this.btnBack.addEventListener('click', () => this.close());
    }
    if (this.btnNewConfig) {
      this.btnNewConfig.addEventListener('click', () => this.showCreateConfigOverlay());
    }

    // 脚本视图返回按钮 → 回到配置列表（刷新版本号）
    const btnBackView = document.getElementById('btn-back-to-config');
    if (btnBackView) {
      btnBackView.addEventListener('click', () => this.backToConfigList());
    }
  },

  /**
   * 设置当前用户（登录态变化时同步给脚本模块，用于编辑权限判定）
   * @param {object|null} user - 用户对象
   */
  setCurrentUser(user) {
    ScriptManager.setCurrentUser(user);
  },

  /**
   * 视图切换（飞机列表 ⇄ 配置列表 ⇄ 脚本页）
   * @param {string} view - 'aircraft' | 'config' | 'script'
   */
  showView(view) {
    const views = {
      aircraft: this.aircraftView,
      config: this.configView,
      script: this.scriptViewEl
    };
    for (const [name, el] of Object.entries(views)) {
      if (el) el.style.display = name === view ? 'block' : 'none';
    }
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
   * 从脚本视图返回配置列表（刷新以同步版本号）
   */
  backToConfigList() {
    if (!this.currentAircraft) { // 飞机上下文丢失（如刷新）→ 回飞机列表
      this.close();
      return;
    }
    this.showView('config');
    this.loadConfigs();
  },

  /**
   * 打开脚本页（单入口：默认查看模式，页内按权限切换编辑模式）
   * @param {object} config - 配置对象
   */
  openScript(config) {
    this.showView('script');
    ScriptManager.open(config);
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
   * 写入飞控二次确认弹窗（明确风险与影响范围，取消即终止）
   * @param {object} config - 配置对象（列表精简数据）
   * @param {number} paramCount - 将写入的参数项数
   * @returns {Promise<boolean>} 用户是否确认
   */
  showWriteConfirm(config, paramCount) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'bf-plugin-confirm-overlay';

      const dialog = document.createElement('div');
      dialog.className = 'bf-plugin-confirm-dialog';

      const title = document.createElement('h3');
      title.className = 'bf-plugin-confirm-title';
      title.textContent = '写入飞控确认';
      dialog.appendChild(title);

      const lines = [
        `即将把配置「${config.name}」（${config.param_category || '未设置分类'}，v${config.current_version}，共 ${paramCount} 项参数）写入飞控并逐页保存。`,
        '⚠ 风险提示：',
        '· 该操作将直接覆盖飞控当前配置，影响飞行特性，存在炸机风险；',
        '· 写入过程约需 15-90 秒，期间请勿断开 USB 或关闭页面；',
        '· 本次修改不会自动同步回云端配置记录。',
        '请确认当前环境安全（桨叶已拆除）后再继续。'
      ];
      lines.forEach(t => {
        const p = document.createElement('p');
        p.className = 'bf-plugin-confirm-message';
        p.textContent = t;
        dialog.appendChild(p);
      });

      const buttons = document.createElement('div');
      buttons.className = 'bf-plugin-confirm-buttons';

      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'bf-plugin-button confirm-cancel';
      cancelBtn.textContent = '取消';
      cancelBtn.addEventListener('click', () => {
        overlay.remove();
        resolve(false);
      });
      buttons.appendChild(cancelBtn);

      const okBtn = document.createElement('button');
      okBtn.className = 'bf-plugin-button primary';
      okBtn.textContent = '确认写入';
      okBtn.addEventListener('click', () => {
        overlay.remove();
        resolve(true);
      });
      buttons.appendChild(okBtn);

      dialog.appendChild(buttons);
      overlay.appendChild(dialog);
      document.body.appendChild(overlay);

      // 默认焦点在「取消」，降低误触风险
      cancelBtn.focus();
    });
  },

  /**
   * 在弹窗中添加一个参数行（label + 输入框 + 范围提示 + 错误提示）
   * 实时校验：合法值即时写回编辑副本；非法值标红阻断保存
   * @param {HTMLElement} container - 行容器
   * @param {string} labelText - 参数显示名
   * @param {object|null} meta - 参数元数据（min/max/step/integer/unit/desc）；
   *                              null = 透传自由文本模式（未知 CLI 参数，原样字符串保存）
   * @param {function} getValue - 读取当前值
   * @param {function} setValue - 写回合法值
   * @returns {object} 行状态对象（{input, meta, isValid()}）
   */
  appendParamRow(container, labelText, meta, getValue, setValue) {
    const item = document.createElement('div');
    item.className = 'bf-plugin-param-item';

    const row = document.createElement('div');
    row.className = 'bf-plugin-param-row';

    const label = document.createElement('label');
    label.textContent = labelText;
    label.title = (meta && meta.desc) || '';
    row.appendChild(label);

    const input = document.createElement('input');
    input.className = 'bf-plugin-input';
    input.value = getValue();
    input.title = (meta && meta.desc) || '';
    row.appendChild(input);

    const range = document.createElement('span');
    range.className = 'bf-plugin-param-range';
    range.textContent = !meta || !Number.isFinite(meta.min) || !Number.isFinite(meta.max)
      ? `不限${meta && meta.unit ? ' ' + meta.unit : ''}`
      : `${meta.min}–${meta.max}${meta.unit ? ' ' + meta.unit : ''}`;
    row.appendChild(range);
    item.appendChild(row);

    const err = document.createElement('div');
    err.className = 'bf-plugin-param-error';
    item.appendChild(err);

    const state = { input, meta, valid: true };
    const validate = () => {
      if (!meta) { // 透传参数：仅要求非空，CLI 值域原样字符串保存
        const s = input.value.trim();
        if (s) {
          state.valid = true;
          err.textContent = '';
          input.classList.remove('bf-plugin-param-input-invalid');
          setValue(s);
        } else {
          state.valid = false;
          err.textContent = '值不能为空';
          input.classList.add('bf-plugin-param-input-invalid');
        }
        return;
      }
      const r = validateParamValue(input.value, meta);
      if (r.ok) {
        state.valid = true;
        err.textContent = '';
        input.classList.remove('bf-plugin-param-input-invalid');
        setValue(r.value); // 合法值即时写回编辑副本（实时编辑）
      } else {
        state.valid = false;
        err.textContent = r.error;
        input.classList.add('bf-plugin-param-input-invalid');
      }
    };
    input.addEventListener('input', validate);
    input.addEventListener('blur', validate);
    validate(); // 初始值校验（历史数据可能越界）

    container.appendChild(item);
    return state;
  },

  /**
   * 参数编辑弹窗（当前页内在线查看与实时编辑，保存直接同步云端并刷新列表）
   * @param {object} config - 配置对象（列表精简数据）
   */
  async showParamEditOverlay(config) {
    // 拉取完整参数数据（列表响应不含大字段）
    showStatus('config-status', '正在加载参数数据...', 'info');
    let params;
    try {
      const detail = await ApiService.getConfigFileById(config.id);
      const data = detail.data || detail;
      params = data.params_json;
    } catch (error) {
      console.error('[ConfigManager] 加载参数失败:', error);
      showStatus('config-status', `加载失败: ${error.message}`, 'error');
      return;
    }
    if (typeof params === 'string') {
      // 异常边界：云端以 JSON 字符串存储时先行解析，解析失败按无数据处理
      try { params = JSON.parse(params); } catch (e) { params = null; }
    }
    if (!params || typeof params !== 'object') {
      showStatus('config-status', '该配置没有参数数据，无法编辑。请先在「新建配置」中完成「读取参数」CLI 导出。', 'error');
      return;
    }

    // 编辑副本（保存时整体提交，产生新版本快照）；深拷贝异常则终止，防止脏数据写回云端
    let edited;
    try {
      edited = JSON.parse(JSON.stringify(params));
    } catch (error) {
      console.error('[ConfigManager] 参数数据深拷贝失败:', error);
      showStatus('config-status', `参数数据异常，无法编辑: ${error.message}`, 'error');
      return;
    }
    const rowStates = []; // 全部行状态（保存前全量校验）

    const overlay = document.createElement('div');
    overlay.className = 'bf-plugin-confirm-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'bf-plugin-confirm-dialog';
    dialog.style.maxHeight = '70vh';
    dialog.style.overflowY = 'auto';

    const title = document.createElement('h3');
    title.className = 'bf-plugin-confirm-title';
    title.textContent = `参数编辑 - ${config.name}`;
    dialog.appendChild(title);

    const sub = document.createElement('p');
    sub.className = 'bf-plugin-confirm-message';
    sub.textContent = `${config.param_category || '未设置分类'} | v${config.current_version} | 可视化与脚本双向同步（实时校验），保存后生成新版本`;
    dialog.appendChild(sub);

    // 双视图页签：可视化编辑 | CLI 脚本（共享同一 edited 副本，双向同步）
    const tabBar = document.createElement('div');
    tabBar.className = 'bf-plugin-edit-tabs';
    const tabs = {};
    const views = {};
    for (const [key, label] of [['visual', '可视化编辑'], ['script', 'CLI 脚本']]) {
      const t = document.createElement('button');
      t.type = 'button';
      t.className = 'bf-plugin-edit-tab';
      t.textContent = label;
      t.addEventListener('click', () => switchTab(key));
      tabBar.appendChild(t);
      tabs[key] = t;
    }
    dialog.appendChild(tabBar);

    const body = document.createElement('div');
    dialog.appendChild(body);
    views.visual = body;

    const scriptView = document.createElement('div');
    scriptView.className = 'bf-plugin-script-view';
    scriptView.style.display = 'none';
    dialog.appendChild(scriptView);
    views.script = scriptView;

    const scriptTa = document.createElement('textarea');
    scriptTa.className = 'bf-plugin-script-ta';
    scriptTa.rows = 12;
    scriptTa.spellcheck = false;
    scriptView.appendChild(scriptTa);

    const scriptToolbar = document.createElement('div');
    scriptToolbar.className = 'bf-plugin-script-toolbar';
    const mkToolBtn = (label, cls) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bf-plugin-button small' + (cls ? ' ' + cls : '');
      b.textContent = label;
      scriptToolbar.appendChild(b);
      return b;
    };
    const applyBtn = mkToolBtn('应用脚本', 'primary');
    const importBtn = mkToolBtn('导入文件');
    const exportBtn = mkToolBtn('导出脚本');
    const copyBtn = mkToolBtn('复制脚本');
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.txt,.cli,.dump,.script';
    fileInput.style.display = 'none';
    scriptToolbar.appendChild(fileInput);
    scriptView.appendChild(scriptToolbar);

    const scriptStatus = document.createElement('div');
    scriptStatus.className = 'bf-plugin-status';
    scriptView.appendChild(scriptStatus);

    const scriptHint = document.createElement('div');
    scriptHint.className = 'bf-plugin-script-hint';
    scriptHint.textContent = '格式与 CLI dump 一致：set <参数名> = <值>（CLI 值域，如 set dshot_idle_value = 450 对应 UI 4.5）；# 为注释；输入时实时校验语法并定位错误行；切换页签或保存时自动双向同步（存在错误时拦截）；导出的脚本可直接粘贴到 Betaflight CLI 执行。';
    scriptView.appendChild(scriptHint);

    const addSectionTitle = (text) => {
      const el = document.createElement('div');
      el.className = 'bf-plugin-param-section-title';
      el.textContent = text;
      body.appendChild(el);
    };
    const addAxisTitle = (text) => {
      const el = document.createElement('div');
      el.className = 'bf-plugin-param-axis-title';
      el.textContent = text;
      body.appendChild(el);
    };
    const addRow = (labelText, meta, getValue, setValue) => {
      const st = this.appendParamRow(body, labelText, meta, getValue, setValue);
      rowStates.push(st);
    };
    const addReadOnlyRow = (labelText, value) => {
      const row = document.createElement('div');
      row.className = 'bf-plugin-param-row';
      const label = document.createElement('label');
      label.textContent = labelText;
      const span = document.createElement('span');
      span.className = 'bf-plugin-param-range';
      span.textContent = String(value);
      row.appendChild(label);
      row.appendChild(span);
      body.appendChild(row);
    };

    // ---- 可视化渲染（schema 驱动）----
    // 分区/参数项/渲染规则全部来自脚本解析结果（脚本 = 布局唯一事实来源）：
    //   edited → structuredToScript → buildScriptSchema → 动态表单。
    // 脚本变更（应用脚本/透传参数）后重新调用 buildVisual 即自动适配，
    // 无固定写死的四区配置，新增参数无需修改渲染代码。
    const getEditedValue = (item) => {
      const t = item.applyTarget;
      if (t.extra) { // 透传参数：读写 edited.extra（CLI 值域原样）
        return (edited.extra && edited.extra[t.extra] !== undefined) ? edited.extra[t.extra] : item.rawValue;
      }
      const holder = t.axis ? edited[t.section] && edited[t.section][t.axis] : edited[t.section];
      return holder ? holder[t.key] : ''; // schema 来自 edited 自身，holder 必存在；空值兜底触发校验提示
    };
    const setEditedValue = (item, v) => {
      const t = item.applyTarget;
      if (t.extra) {
        edited.extra = edited.extra || {};
        edited.extra[t.extra] = v;
        return;
      }
      if (t.axis) {
        edited[t.section] = edited[t.section] || {};
        edited[t.section][t.axis] = edited[t.section][t.axis] || {};
        edited[t.section][t.axis][t.key] = v;
      } else {
        edited[t.section] = edited[t.section] || {};
        edited[t.section][t.key] = v;
      }
    };
    // 脚本生成安全封装（异常边界：脏数据不中断页签切换/应用流程）
    const genScriptSafe = () => {
      try {
        return structuredToScript(edited);
      } catch (error) {
        console.error('[ConfigManager] 脚本生成失败:', error);
        return `# 参数数据异常，无法生成脚本：${error.message}`;
      }
    };
    const buildVisual = () => {
      body.innerHTML = '';
      rowStates.length = 0;
      let schema;
      try {
        schema = buildScriptSchema(structuredToScript(edited));
      } catch (error) {
        // 异常边界：参数数据异常时给出可操作的恢复指引，不让弹窗白屏/崩溃
        console.error('[ConfigManager] 可视化渲染失败:', error);
        const tip = document.createElement('div');
        tip.className = 'bf-plugin-status error';
        tip.style.display = 'block';
        tip.textContent = `参数数据异常，可视化渲染失败（${error.message}）。请切换到「CLI 脚本」检查内容，或关闭弹窗后重试。`;
        body.appendChild(tip);
        return;
      }
      for (const sec of schema.sections) {
        addSectionTitle(sec.title);
        let lastGroup;
        for (const item of sec.items) {
          if (item.group && item.group !== lastGroup) addAxisTitle(item.group);
          lastGroup = item.group;
          if (item.readonly) { addReadOnlyRow(item.label, item.uiValue); continue; }
          // known → 数值校验（UI 值域）；unknown → 自由文本透传（CLI 值域原样）
          addRow(item.label, item.known ? item.meta : null,
            () => getEditedValue(item), v => setEditedValue(item, v));
        }
      }
    };
    buildVisual(); // 初始渲染

    // ---- CLI 脚本视图逻辑（与可视化编辑共享 edited，双向同步） ----
    const setScriptStatus = (msg, cls) => {
      scriptStatus.textContent = msg;
      scriptStatus.className = 'bf-plugin-status' + (cls ? ' ' + cls : '');
    };

    let scriptDirty = false; // 脚本框是否有未同步进 edited 的编辑（双向同步闸门）

    // 实时语法校验：输入过程中即时检测，错误定位到行号与具体问题（150ms 防抖）
    let validateTimer = null;
    const liveValidate = (prefix = '') => {
      const rep = validateParamScript(scriptTa.value);
      if (rep.ok) {
        const parts = [`✓ 语法正确：${rep.setCount} 项参数将生效`];
        if (rep.unknownCount) parts.push(`${rep.unknownCount} 项未识别参数将透传保存`);
        if (rep.ignored) parts.push(`已忽略 ${rep.ignored} 行非参数内容`);
        setScriptStatus(prefix + parts.join('，'), 'success');
      } else {
        const detail = rep.errors.slice(0, 4).map(e => {
          const what = e.name !== undefined ? `"${e.name} = ${e.value}"` : `"${e.text}"`;
          return `第 ${e.line} 行 ${what}：${e.reason}`;
        });
        const more = rep.errors.length > 4 ? `；共 ${rep.errors.length} 处` : '';
        setScriptStatus(
          `${prefix}✗ 发现 ${rep.errors.length} 处语法问题：${detail.join('；')}${more}。修正后切换页签或保存时会自动同步`,
          'error');
      }
      return rep;
    };
    scriptTa.addEventListener('input', () => {
      scriptDirty = true;
      if (validateTimer) clearTimeout(validateTimer);
      validateTimer = setTimeout(() => liveValidate(), 150);
    });

    // 将脚本内容应用进 edited（已知合法项 + 未识别透传；调用方先经 validateParamScript 把关）
    const applyScriptToEdited = (rep) => {
      applyScriptSets(rep.sets, edited);
      edited.extra = extraFromUnknown(rep.unknown); // 覆盖式：脚本为唯一事实来源
      scriptDirty = false;
    };

    // 同步闸门：脚本有未应用编辑时先实时校验，全部合法才写入 edited；
    // 存在错误则留在脚本页并显示错误定位（防止改动被可视化重建静默丢弃）
    const syncScriptBeforeLeave = () => {
      if (!scriptDirty) return true;
      const rep = liveValidate();
      if (!rep.ok) {
        scriptTa.focus();
        return false;
      }
      applyScriptToEdited(rep);
      return true;
    };

    function switchTab(key) {
      if (key === 'visual' && !syncScriptBeforeLeave()) return; // 校验失败阻断切换，避免内容丢失
      for (const [k, v] of Object.entries(views)) v.style.display = k === key ? 'block' : 'none';
      for (const [k, t] of Object.entries(tabs)) t.classList.toggle('active', k === key);
      if (key === 'script' && !scriptDirty) { // 可视化 → 脚本同步（脚本无未应用编辑时才覆盖）
        scriptTa.value = genScriptSafe();
        scriptDirty = false;
        liveValidate(); // 初始反馈：语法正确提示
      }
      if (key === 'visual') buildVisual(); // 脚本应用后按最新 schema 重建（自动适配）
    }

    // 应用脚本 → 校验 → 合法项写入 edited（未识别透传）→ 按新脚本重建可视化；
    // 存在错误时保留原文继续修正（合法项已生效，错误项不应用），切换/保存仍被拦截直到修正
    applyBtn.addEventListener('click', () => {
      const rep = validateParamScript(scriptTa.value);
      const { applied } = applyScriptSets(rep.sets, edited);
      edited.extra = extraFromUnknown(rep.unknown);
      buildVisual();
      if (rep.ok) {
        scriptTa.value = genScriptSafe(); // 规范化（分区注释 + 排序）
        scriptDirty = false;
        const parts = [`已应用 ${applied.length} 项`];
        if (rep.unknownCount) {
          parts.push(`透传未识别参数 ${rep.unknownCount} 项（第 ${rep.unknown[0].line} 行 "${rep.unknown[0].name}" 等）`);
        }
        setScriptStatus(parts.join('；'), (applied.length || rep.unknownCount) ? 'success' : 'info');
      } else {
        scriptDirty = true;
        liveValidate(`已应用合法项 ${applied.length} 项；`);
      }
    });

    // 导入文件：仅填充脚本框并标记待同步，确认无误后「应用脚本」（或直接切换页签/保存触发同步）
    importBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
      const f = fileInput.files && fileInput.files[0];
      if (!f) return;
      scriptTa.value = await f.text();
      fileInput.value = '';
      scriptDirty = true;
      liveValidate(`已导入 ${f.name}；`);
    });

    // 导出脚本：下载 .cli 文件（可直接粘贴到 Betaflight CLI 执行）
    exportBtn.addEventListener('click', () => {
      const blob = new Blob([scriptTa.value], { type: 'text/plain' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${config.name}-v${config.current_version}-params.cli`;
      a.click();
      URL.revokeObjectURL(a.href);
      setScriptStatus('脚本已导出', 'success');
    });

    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(scriptTa.value);
        setScriptStatus('已复制到剪贴板', 'success');
      } catch (e) {
        setScriptStatus(`复制失败: ${e.message}`, 'error');
      }
    });

    // 弹窗内状态行（覆盖层之下 config-status 不可见）
    const dialogStatus = document.createElement('div');
    dialogStatus.className = 'bf-plugin-status';
    dialog.appendChild(dialogStatus);

    const buttons = document.createElement('div');
    buttons.className = 'bf-plugin-confirm-buttons';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'bf-plugin-button confirm-cancel';
    cancelBtn.textContent = '取消关闭';
    cancelBtn.addEventListener('click', () => overlay.remove());
    buttons.appendChild(cancelBtn);

    const okBtn = document.createElement('button');
    okBtn.className = 'bf-plugin-button primary';
    okBtn.textContent = '保存修改';
    okBtn.addEventListener('click', async () => {
      // 脚本未同步的编辑先校验并应用（否则脚本改动不参与保存，出现"保存了却不生效"）
      if (!syncScriptBeforeLeave()) {
        dialogStatus.textContent = 'CLI 脚本存在语法错误，已阻止保存（错误定位见「CLI 脚本」页签）';
        dialogStatus.className = 'bf-plugin-status error';
        if (views.script.style.display !== 'none') scriptTa.focus();
        return;
      }

      // 全量校验：任一非法值阻断保存并定位首个错误
      const firstInvalid = rowStates.find(s => !s.valid);
      if (firstInvalid) {
        dialogStatus.textContent = '存在非法参数值，请修正后再保存';
        dialogStatus.className = 'bf-plugin-status error';
        firstInvalid.input.focus();
        return;
      }

      // 保存二次确认（明确云端同步与版本影响）
      const confirmed = await showConfirm('保存参数修改',
        `即将把配置 "${config.name}" 的参数修改保存到云端，保存后自动生成新版本快照。是否继续？`);
      if (!confirmed) return;

      okBtn.disabled = true;
      cancelBtn.disabled = true;
      dialogStatus.textContent = '正在保存...';
      dialogStatus.className = 'bf-plugin-status info';
      try {
        const resp = await ApiService.updateConfigFile(config.id, {
          params_json: edited,
          note: '弹窗参数编辑'
        });
        const saved = resp && resp.data ? resp.data : resp;
        overlay.remove();
        const ver = saved && saved.current_version !== undefined ? `（新版本 v${saved.current_version}）` : '';
        showStatus('config-status', `参数已保存${ver}`, 'success');
        this.loadConfigs(); // 就地刷新列表，无需页面重载
      } catch (error) {
        console.error('[ConfigManager] 保存参数失败:', error);
        dialogStatus.textContent = `保存失败: ${error.message}`;
        dialogStatus.className = 'bf-plugin-status error';
        okBtn.disabled = false;
        cancelBtn.disabled = false;
      }
    });
    buttons.appendChild(okBtn);

    dialog.appendChild(buttons);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
  },

  /**
   * 将配置参数写入飞控（二次确认 → 检查连接 → 写入；取消则终止流程）
   * @param {object} config - 配置对象（列表精简数据）
   */
  async handleWriteToFC(config) {
    try {
      // 列表响应不含大字段，先取详情（用于确认弹窗展示影响范围与前置校验）
      showStatus('config-status', '正在读取配置详情...', 'info');
      const detail = await ApiService.getConfigFileById(config.id);
      const data = detail.data || detail;
      if (!data.params_json || typeof data.params_json !== 'object') {
        showStatus('config-status', '该配置没有参数数据，无法写入', 'error');
        return;
      }

      // 统计参数项数（四区结构：区→子组→键 或 区→键）
      let paramCount = 0;
      Object.values(data.params_json).forEach(section => {
        if (!section || typeof section !== 'object') return;
        Object.values(section).forEach(v => {
          paramCount += (v && typeof v === 'object') ? Object.keys(v).length : 1;
        });
      });

      // 写入飞控二次确认（明确风险与影响范围，取消即终止）
      const confirmed = await this.showWriteConfirm(config, paramCount);
      if (!confirmed) {
        showStatus('config-status', '已取消写入飞控操作', 'info');
        return;
      }

      showStatus('config-status', '正在检查飞控连接...', 'info');
      const connected = await this.ensureFCConnected('config-status');
      if (!connected) return;

      showStatus('config-status', `正在写入 ${paramCount} 项参数到飞控（全量约需 15-90 秒，请勿关闭页面）...`, 'info');
      const response = await sendMessageToContent(MessageAction.AIRCRAFT_WRITE_TO_PAGE, {
        aircraft: data.params_json
      });
      if (response.success) {
        showStatus('config-status', `参数写入成功（${paramCount} 项）。注意：修改不会自动同步回云端配置记录。`, 'success');
      } else {
        showStatus('config-status', `写入失败: ${this.extractErrorMessage(response)}`, 'error');
      }
    } catch (error) {
      console.error('[ConfigManager] 写入飞控失败:', error);
      showStatus('config-status', `写入失败: ${error.message}`, 'error');
    }
  }
};
