/**
 * 预设管理模块 - 对接后端参数管理 API
 * @module popup/modules/preset-manager
 */

import { MessageAction } from '../../shared/message-protocol.js';
import { generateId, getCurrentTimestamp } from '../../shared/utils.js';
import { sendMessageToBackground, sendMessageToContent, showStatus, showConfirm } from '../popup.js';
import { PresetList } from '../components/preset-list.js';
import { ApiService } from '../../shared/api-service.js';

/**
 * 预设管理模块
 */
export const PresetManager = {
  currentParams: null, // 当前页面参数

  /**
   * 初始化预设管理模块
   */
  init() {
    console.log('[PresetManager] 初始化');

    // 获取 DOM 元素
    this.nameInput = document.getElementById('preset-name');
    this.categorySelect = document.getElementById('preset-category');
    this.btnSave = document.getElementById('btn-save-as-preset');
    this.btnApply = document.getElementById('btn-apply-preset');
    this.listContainer = document.getElementById('preset-list-container');

    // 绑定事件
    this.btnSave.addEventListener('click', () => this.handleSaveAsPreset());
    this.btnApply.addEventListener('click', () => this.handleApplyPreset());

    // 初始化预设列表组件
    this.presetList = new PresetList(this.listContainer, {
      onSelect: (preset) => this.handleSelectPreset(preset),
      onEdit: (preset) => this.handleEditPreset(preset),
      onDelete: (preset) => this.handleDeletePreset(preset),
      onApply: (preset) => this.handleApplyPresetToPage(preset)
    });

    // 加载预设列表（需要在用户登录后调用）
    // this.loadPresets();
    this.loadDeviceOptions();
    this.loadDeviceTypeOptions();
  },

  /**
   * 加载飞机类型下拉选项
   */
  async loadDeviceTypeOptions() {
    try {
      const result = await ApiService.getDeviceTypes();
      const typeList = result.items || result.data || result || [];
      const select = document.getElementById('preset-device-type');
      if (!select) return;
      select.innerHTML = '<option value="">请选择</option>' +
        typeList.map(t => `<option value="${t.name}">${t.name}</option>`).join('');
    } catch (error) {
      console.error('[PresetManager] 加载飞机类型列表失败:', error);
    }
  },

  /**
   * 加载设备下拉选项（用于关联设备）
   */
  async loadDeviceOptions() {
    try {
      const devices = await ApiService.getDevices();
      const deviceList = devices.items || devices.data || devices || [];
      const select = document.getElementById('preset-device');
      if (!select) return;
      select.innerHTML = '<option value="">请选择关联设备</option>' +
        deviceList.map(d => `<option value="${d.id}">${d.title}</option>`).join('');
    } catch (error) {
      console.error('[PresetManager] 加载设备列表失败:', error);
    }
  },

  /**
   * 加载预设列表
   */
  async loadPresets() {
    // 检查用户认证状态
    const authStatus = await ApiService.checkAuthStatus();
    
    if (!authStatus.isAuthenticated) {
      this.presetList.render([]);
      
      if (!authStatus.hasToken) {
        showStatus('preset-status', '请先登录后再查看预设', 'info');
      } else if (!authStatus.hasApiKey) {
        showStatus('preset-status', '无法连接到服务器，请检查网络', 'error');
      } else {
        showStatus('preset-status', '请先登录后再查看预设', 'info');
      }
      return;
    }

    try {
      const result = await ApiService.getDeviceParams();
      const presets = result.items || result.data || result || [];
      this.presetList.render(presets);
    } catch (error) {
      console.error('[PresetManager] 加载预设列表失败:', error);
      
      if (error.message && error.message.includes('401')) {
        showStatus('preset-status', '请先登录后再查看预设', 'info');
      } else if (error.message && error.message.includes('API 密钥')) {
        showStatus('preset-status', '无法连接到服务器，请检查网络', 'error');
      } else {
        showStatus('preset-status', '加载失败: ' + error.message, 'error');
      }
    }
  },

  /**
   * 处理保存为预设
   */
  async handleSaveAsPreset() {
    const name = this.nameInput.value.trim();
    const category = this.categorySelect.value;
    const deviceType = document.getElementById('preset-device-type')?.value;

    if (!name) {
      showStatus('preset-status', '请输入预设名称', 'error');
      return;
    }

    if (!this.currentParams) {
      showStatus('preset-status', '请先读取页面参数', 'error');
      return;
    }

    try {
      const preset = {
        title: name,
        cli_commands: JSON.stringify(this.currentParams),
        usage_scope: deviceType || '通用',
        param_category: category || '综合',
        device_id: parseInt(document.getElementById('preset-device')?.value) || null
      };

      await ApiService.createDeviceParam(preset);
      showStatus('preset-status', '预设已保存', 'success');
      this.nameInput.value = '';
      this.categorySelect.value = '';
      
      const deviceTypeSelect = document.getElementById('preset-device-type');
      if (deviceTypeSelect) deviceTypeSelect.value = '';
      
      this.loadPresets();
    } catch (error) {
      console.error('[PresetManager] 保存预设失败:', error);
      showStatus('preset-status', `保存失败: ${error.message}`, 'error');
    }
  },

  /**
   * 处理应用预设
   */
  async handleApplyPreset() {
    // 这里可以打开一个选择框让用户选择要应用的预设
    console.log('[PresetManager] 应用预设');
  },

  /**
   * 处理选择预设
   */
  handleSelectPreset(preset) {
    console.log('[PresetManager] 选中预设:', preset.title);
  },

  /**
   * 处理编辑预设
   */
  handleEditPreset(preset) {
    this.nameInput.value = preset.title;
    this.categorySelect.value = preset.param_category || '';
    
    const deviceTypeSelect = document.getElementById('preset-device-type');
    if (deviceTypeSelect) deviceTypeSelect.value = preset.usage_scope || '';
    
    this.currentParams = typeof preset.cli_commands === 'string' ? JSON.parse(preset.cli_commands) : preset.cli_commands;
    showStatus('preset-status', `正在编辑: ${preset.title}`, 'info');
  },

  /**
   * 处理删除预设
   */
  async handleDeletePreset(preset) {
    const confirmed = await showConfirm('删除预设', `确定要删除预设 "${preset.title}" 吗？`);
    if (!confirmed) {
      return;
    }

    try {
      await ApiService.deleteDeviceParam(preset.id);
      showStatus('preset-status', '预设已删除', 'success');
      this.loadPresets();
    } catch (error) {
      console.error('[PresetManager] 删除预设失败:', error);
      showStatus('preset-status', `删除失败: ${error.message}`, 'error');
    }
  },

  /**
   * 处理将预设应用到页面
   */
  async handleApplyPresetToPage(preset) {
    try {
      showStatus('preset-status', '正在应用预设到页面...', 'info');

      const presetData = {
        ...preset,
        cli_commands: typeof preset.cli_commands === 'string' ? JSON.parse(preset.cli_commands) : preset.cli_commands
      };

      const response = await sendMessageToContent(MessageAction.PRESET_APPLY, {
        preset: presetData
      });
      if (response.success) {
        showStatus('preset-status', '预设应用成功', 'success');
      } else {
        showStatus('preset-status', `应用失败: ${response.error?.message}`, 'error');
      }
    } catch (error) {
      console.error('[PresetManager] 应用预设失败:', error);
      showStatus('preset-status', `应用失败: ${error.message}`, 'error');
    }
  }
};
