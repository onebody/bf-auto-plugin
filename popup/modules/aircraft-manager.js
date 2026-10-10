/**
 * 飞机管理模块 - 对接后端飞机管理 API
 * @module popup/modules/aircraft-manager
 */

import { ConfigManager } from './config-manager.js';
import { showStatus, showConfirm } from '../popup.js';
import { AircraftList } from '../components/aircraft-list.js';
import { ApiService } from '../../shared/api-service.js';

/**
 * 飞机管理模块
 */
export const AircraftManager = {
  currentUser: null, // 当前登录用户信息

  /**
   * 初始化飞机管理模块
   */
  init() {
    console.log('[AircraftManager] 初始化（v1.6.0 - 条目点击钻取配置列表）');

    // 获取 DOM 元素
    this.listContainer = document.getElementById('aircraft-list-container');

    // 机库栏元素（钻取视图：顶部显示/切换所在机库）
    this.hangarSwitcher = document.getElementById('hangar-switcher');
    this.btnNewHangar = document.getElementById('btn-new-hangar');
    this.btnManageHangars = document.getElementById('btn-manage-hangars');
    this.btnNewAircraft = document.getElementById('btn-new-aircraft');
    this.currentHangarId = null; // 当前所在机库ID（null 时取默认机库）

    // 绑定事件
    if (this.hangarSwitcher) {
      this.hangarSwitcher.addEventListener('change', () => {
        this.currentHangarId = parseInt(this.hangarSwitcher.value, 10) || null;
        this.loadAircrafts();
      });
    }
    if (this.btnNewHangar) {
      this.btnNewHangar.addEventListener('click', () => this.showCreateHangarOverlay());
    }
    if (this.btnManageHangars) {
      this.btnManageHangars.addEventListener('click', () => this.showManageHangarsOverlay());
    }
    if (this.btnNewAircraft) {
      this.btnNewAircraft.addEventListener('click', () => this.showAircraftFormOverlay());
    }

    // 初始化飞机列表组件（点击条目 → 钻取进入该飞机的配置列表）
    this.aircraftList = new AircraftList(this.listContainer, {
      onSelect: (aircraft) => ConfigManager.open(aircraft),
      onEdit: (aircraft) => this.showAircraftFormOverlay(aircraft),
      onDelete: (aircraft) => this.handleDeleteAircraft(aircraft)
    });

    // 加载机库与飞机列表（先机库，保证飞机列表能显示机库归属）
    this.loadHangars().finally(() => this.loadAircrafts());
  },

  /**
   * 设置当前用户信息
   * @param {object} user - 当前用户对象
   */
  setCurrentUser(user) {
    this.currentUser = user;
  },

  /**
   * 加载飞机列表
   */
  async loadAircrafts() {
    // 检查用户认证状态
    const authStatus = await ApiService.checkAuthStatus();
    
    if (!authStatus.isAuthenticated) {
      this.aircraftList.render([]);
      
      if (!authStatus.hasToken) {
        showStatus('aircraft-status', '请先登录后再查看飞机列表', 'info');
      } else if (!authStatus.hasApiKey) {
        showStatus('aircraft-status', '无法连接到服务器，请检查网络', 'error');
      } else {
        showStatus('aircraft-status', '请先登录后再查看飞机列表', 'info');
      }
      return;
    }

    try {
      // 机库数据未就绪时先加载（用于列表显示机库归属）
      if (!Array.isArray(this.hangars)) {
        await this.loadHangars();
      }

      const result = await ApiService.getDevices();
      let devices = result.items || result.data || result || [];

      // 按当前所在机库过滤（钻取视图：机库进去直接是飞机列表）
      if (this.currentHangarId != null) {
        devices = devices.filter(d => d.hangar_id === this.currentHangarId);
      }

      // 构建机库 id → 名称映射传入列表组件
      const hangarMap = {};
      (this.hangars || []).forEach(h => { hangarMap[h.id] = h.name; });
      this.aircraftList.render(devices, hangarMap);
    } catch (error) {
      console.error('[AircraftManager] 加载飞机列表失败:', error);
      
      if (error.message && error.message.includes('401')) {
        showStatus('aircraft-status', '请先登录后再查看飞机列表', 'info');
      } else if (error.message && error.message.includes('API 密钥')) {
        showStatus('aircraft-status', '无法连接到服务器，请检查网络', 'error');
      } else {
        showStatus('aircraft-status', '加载失败: ' + error.message, 'error');
      }
    }
  },

  /**
   * 加载机库列表（填充切换栏 + 表单下拉；初始化默认所在机库）
   */
  async loadHangars() {
    if (!this.hangarSwitcher) return;

    const authStatus = await ApiService.checkAuthStatus();
    if (!authStatus.isAuthenticated) {
      this.hangars = [];
      this.hangarSwitcher.innerHTML = '<option value="">默认机库</option>';
      return;
    }

    try {
      const result = await ApiService.getHangars();
      const hangars = Array.isArray(result) ? result : (result.items || result.data || []);
      this.hangars = hangars;

      // 初始化/修正当前所在机库（优先默认机库；机库被删后自动回落）
      const validIds = new Set(hangars.map(h => h.id));
      if (this.currentHangarId == null || !validIds.has(this.currentHangarId)) {
        const defaultHangar = hangars.find(h => h.is_default);
        this.currentHangarId = defaultHangar ? defaultHangar.id : (hangars[0] ? hangars[0].id : null);
      }

      // 填充顶部机库切换栏
      this.hangarSwitcher.innerHTML = hangars.map(h =>
        `<option value="${h.id}">${h.name}${h.is_default ? '（默认）' : ''}</option>`).join('');
      if (this.currentHangarId != null) {
        this.hangarSwitcher.value = String(this.currentHangarId);
      }

      // 机库管理弹窗打开时同步刷新其列表
      this.renderManageHangarList(hangars);
    } catch (error) {
      console.error('[AircraftManager] 加载机库列表失败:', error);
      showStatus('aircraft-status', `机库加载失败: ${error.message}`, 'error');
    }
  },

  /**
   * 新建机库弹窗
   */
  showCreateHangarOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'bf-plugin-confirm-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'bf-plugin-confirm-dialog';

    const title = document.createElement('h3');
    title.className = 'bf-plugin-confirm-title';
    title.textContent = '新建机库';
    dialog.appendChild(title);

    const nameGroup = document.createElement('div');
    nameGroup.className = 'bf-plugin-form-group';
    const nameLabel = document.createElement('label');
    nameLabel.className = 'bf-plugin-label';
    nameLabel.textContent = '机库名称';
    const nameInput = document.createElement('input');
    nameInput.className = 'bf-plugin-input';
    nameInput.placeholder = '请输入机库名称';
    nameGroup.appendChild(nameLabel);
    nameGroup.appendChild(nameInput);
    dialog.appendChild(nameGroup);

    const descGroup = document.createElement('div');
    descGroup.className = 'bf-plugin-form-group';
    const descLabel = document.createElement('label');
    descLabel.className = 'bf-plugin-label';
    descLabel.textContent = '描述（可选）';
    const descInput = document.createElement('input');
    descInput.className = 'bf-plugin-input';
    descInput.placeholder = '请输入描述';
    descGroup.appendChild(descLabel);
    descGroup.appendChild(descInput);
    dialog.appendChild(descGroup);

    const buttons = document.createElement('div');
    buttons.className = 'bf-plugin-confirm-buttons';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'bf-plugin-button confirm-cancel';
    cancelBtn.textContent = '取消';
    cancelBtn.addEventListener('click', () => overlay.remove());
    buttons.appendChild(cancelBtn);

    const okBtn = document.createElement('button');
    okBtn.className = 'bf-plugin-button primary';
    okBtn.textContent = '创建';
    okBtn.addEventListener('click', async () => {
      const name = nameInput.value.trim();
      if (!name) {
        nameInput.focus();
        return;
      }
      try {
        await ApiService.createHangar({ name, description: descInput.value.trim() || null });
        showStatus('aircraft-status', `机库 "${name}" 创建成功`, 'success');
        overlay.remove();
        await this.loadHangars();
        this.loadAircrafts();
      } catch (error) {
        console.error('[AircraftManager] 创建机库失败:', error);
        showStatus('aircraft-status', `创建失败: ${error.message}`, 'error');
      }
    });
    buttons.appendChild(okBtn);

    dialog.appendChild(buttons);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    nameInput.focus();
  },

  /**
   * 机库管理弹窗（改名 / 删除）
   */
  showManageHangarsOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'bf-plugin-confirm-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'bf-plugin-confirm-dialog';
    dialog.style.maxHeight = '70vh';
    dialog.style.overflowY = 'auto';

    const title = document.createElement('h3');
    title.className = 'bf-plugin-confirm-title';
    title.textContent = '管理机库';
    dialog.appendChild(title);

    const list = document.createElement('div');
    list.id = 'hangar-manage-list';
    dialog.appendChild(list);
    this.renderManageHangarList(this.hangars || [], list);

    const buttons = document.createElement('div');
    buttons.className = 'bf-plugin-confirm-buttons';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'bf-plugin-button confirm-cancel';
    closeBtn.textContent = '关闭';
    closeBtn.addEventListener('click', () => overlay.remove());
    buttons.appendChild(closeBtn);
    dialog.appendChild(buttons);

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
  },

  /**
   * 渲染机库管理弹窗列表（行内改名 / 删除；默认机库不可删除）
   * @param {object[]} hangars - 机库数组
   * @param {HTMLElement} [list] - 列表容器（缺省取弹窗内元素）
   */
  renderManageHangarList(hangars, list) {
    list = list || document.getElementById('hangar-manage-list');
    if (!list) return;
    list.innerHTML = '';

    if (!hangars || hangars.length === 0) {
      list.innerHTML = '<div class="bf-plugin-empty">暂无机库，点击「新建机库」创建</div>';
      return;
    }

    hangars.forEach(hangar => {
      const item = document.createElement('div');
      item.className = 'bf-plugin-list-item';

      const header = document.createElement('div');
      header.className = 'bf-plugin-list-item-header';

      const title = document.createElement('span');
      title.className = 'bf-plugin-list-item-title';
      title.textContent = hangar.name + (hangar.is_default ? '（默认）' : '');
      header.appendChild(title);

      const actions = document.createElement('div');
      actions.className = 'bf-plugin-list-item-actions';

      const renameBtn = document.createElement('button');
      renameBtn.className = 'bf-plugin-list-item-action edit';
      renameBtn.textContent = '改名';
      renameBtn.addEventListener('click', () => this.showRenameHangarOverlay(hangar));
      actions.appendChild(renameBtn);

      if (!hangar.is_default) {
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'bf-plugin-list-item-action delete';
        deleteBtn.textContent = '删除';
        deleteBtn.addEventListener('click', () => this.handleDeleteHangar(hangar));
        actions.appendChild(deleteBtn);
      }

      header.appendChild(actions);
      item.appendChild(header);

      const desc = document.createElement('div');
      desc.className = 'bf-plugin-list-item-desc';
      desc.textContent = hangar.description || `创建于 ${new Date(hangar.created_at).toLocaleDateString()}`;
      item.appendChild(desc);

      list.appendChild(item);
    });
  },

  /**
   * 机库改名弹窗
   * @param {object} hangar - 机库对象
   */
  showRenameHangarOverlay(hangar) {
    const overlay = document.createElement('div');
    overlay.className = 'bf-plugin-confirm-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'bf-plugin-confirm-dialog';

    const title = document.createElement('h3');
    title.className = 'bf-plugin-confirm-title';
    title.textContent = `重命名机库 - ${hangar.name}`;
    dialog.appendChild(title);

    const input = document.createElement('input');
    input.className = 'bf-plugin-input';
    input.value = hangar.name;
    input.placeholder = '请输入新的机库名称';
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
      if (!newName || newName === hangar.name) {
        overlay.remove();
        return;
      }
      try {
        await ApiService.updateHangar(hangar.id, { name: newName });
        showStatus('aircraft-status', '机库已重命名', 'success');
        overlay.remove();
        await this.loadHangars();
        this.loadAircrafts();
      } catch (error) {
        console.error('[AircraftManager] 机库改名失败:', error);
        showStatus('aircraft-status', `改名失败: ${error.message}`, 'error');
      }
    });
    buttons.appendChild(okBtn);

    dialog.appendChild(buttons);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    input.focus();
  },

  /**
   * 处理删除机库
   * @param {object} hangar - 机库对象
   */
  async handleDeleteHangar(hangar) {
    const confirmed = await showConfirm('删除机库', `确定要删除机库 "${hangar.name}" 吗？`);
    if (!confirmed) return;

    try {
      await ApiService.deleteHangar(hangar.id);
      showStatus('aircraft-status', '机库已删除', 'success');
      // 删除的是当前所在机库时清空，loadHangars 会回落到默认机库
      if (this.currentHangarId === hangar.id) {
        this.currentHangarId = null;
      }
      await this.loadHangars();
      this.loadAircrafts();
    } catch (error) {
      console.error('[AircraftManager] 删除机库失败:', error);
      showStatus('aircraft-status', `删除失败: ${error.message}`, 'error');
    }
  },

  /**
   * 飞机表单弹窗（新建/编辑统一实现：布局一致，仅标题与初始数据不同）
   * @param {object|null} aircraft - 编辑时传入飞机对象；新建传 null
   */
  showAircraftFormOverlay(aircraft = null) {
    const isEdit = !!aircraft;
    const overlay = document.createElement('div');
    overlay.className = 'bf-plugin-confirm-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'bf-plugin-confirm-dialog';

    const title = document.createElement('h3');
    title.className = 'bf-plugin-confirm-title';
    title.textContent = isEdit ? '编辑飞机' : '新建飞机';
    dialog.appendChild(title);

    // 飞机名称
    const nameGroup = document.createElement('div');
    nameGroup.className = 'bf-plugin-form-group';
    const nameLabel = document.createElement('label');
    nameLabel.className = 'bf-plugin-label';
    nameLabel.textContent = '飞机名称';
    const nameInput = document.createElement('input');
    nameInput.className = 'bf-plugin-input';
    nameInput.placeholder = '请输入飞机名称';
    if (isEdit) nameInput.value = aircraft.title || '';
    nameGroup.appendChild(nameLabel);
    nameGroup.appendChild(nameInput);
    dialog.appendChild(nameGroup);

    // 所属机库
    const hangarGroup = document.createElement('div');
    hangarGroup.className = 'bf-plugin-form-group';
    const hangarLabel = document.createElement('label');
    hangarLabel.className = 'bf-plugin-label';
    hangarLabel.textContent = '所属机库';
    const hangarSelect = document.createElement('select');
    hangarSelect.className = 'bf-plugin-input';
    hangarSelect.innerHTML = (this.hangars || []).map(h =>
      `<option value="${h.id}">${h.name}${h.is_default ? '（默认）' : ''}</option>`).join('');
    const initHangarId = isEdit ? aircraft.hangar_id : this.currentHangarId;
    if (initHangarId != null) {
      hangarSelect.value = String(initHangarId);
    }
    hangarGroup.appendChild(hangarLabel);
    hangarGroup.appendChild(hangarSelect);
    dialog.appendChild(hangarGroup);

    // 操作按钮：确认提交 / 取消关闭
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
        showStatus('aircraft-status', '请输入飞机名称', 'error');
        nameInput.focus();
        return;
      }
      const hangarId = parseInt(hangarSelect.value, 10);
      if (!hangarId) {
        showStatus('aircraft-status', '请选择所属机库', 'error');
        return;
      }

      try {
        const device = { title: name, hangar_id: hangarId };
        if (isEdit) {
          await ApiService.updateDevice(aircraft.id, device);
          showStatus('aircraft-status', '飞机档案已更新', 'success');
        } else {
          await ApiService.createDevice(device);
          showStatus('aircraft-status', '飞机档案已保存', 'success');
        }
        // 成功后关闭弹窗并自动刷新列表（无页面重载）
        overlay.remove();
        this.loadAircrafts();
      } catch (error) {
        console.error('[AircraftManager] 保存飞机失败:', error);
        showStatus('aircraft-status', `保存失败: ${error.message}`, 'error');
      }
    });
    buttons.appendChild(okBtn);

    dialog.appendChild(buttons);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    nameInput.focus();
  },

  /**
   * 处理删除飞机
   */
  async handleDeleteAircraft(aircraft) {
    const confirmed = await showConfirm('删除飞机', `确定要删除飞机 "${aircraft.title}" 吗？`);
    if (!confirmed) {
      return;
    }

    try {
      await ApiService.deleteDevice(aircraft.id);
      showStatus('aircraft-status', '飞机已删除', 'success');
      this.loadAircrafts();
    } catch (error) {
      console.error('[AircraftManager] 删除飞机失败:', error);
      showStatus('aircraft-status', `删除失败: ${error.message}`, 'error');
    }
  }
};
