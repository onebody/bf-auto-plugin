/**
 * 飞手管理模块 - 对接后端飞手管理 API
 * @module popup/modules/pilot-manager
 */

import { ApiService } from '../../shared/api-service.js';
import { showStatus, showConfirm } from '../popup.js';

export const PilotManager = {
  pilots: [],

  async init() {
    this.bindEvents();
    this.updatePilotListVisibility(null);
  },

  bindEvents() {
    const btnAddPilot = document.getElementById('btn-add-pilot');
    const btnRefreshPilots = document.getElementById('btn-refresh-pilots');

    if (btnAddPilot) {
      btnAddPilot.addEventListener('click', () => this.handleAddPilot());
    }

    if (btnRefreshPilots) {
      btnRefreshPilots.addEventListener('click', () => this.loadPilots());
    }
  },

  updatePilotListVisibility(user) {
    const pilotsTab = document.querySelector('.bf-plugin-tab[data-tab="pilots"]');
    if (pilotsTab) {
      if (user && user.role === 'coach') {
        pilotsTab.style.display = 'block';
      } else if (!user) {
        pilotsTab.style.display = 'block';
      } else {
        pilotsTab.style.display = 'none';
      }
    }
  },

  async loadPilots() {
    // 检查用户认证状态
    const authStatus = await ApiService.checkAuthStatus();
    
    if (!authStatus.isAuthenticated) {
      this.pilots = [];
      this.renderPilotList();
      
      if (!authStatus.hasToken) {
        showStatus('pilot-status', '请先登录后再查看飞手列表', 'info');
      } else if (!authStatus.hasApiKey) {
        showStatus('pilot-status', '无法连接到服务器，请检查网络', 'error');
      } else {
        showStatus('pilot-status', '请先登录后再查看飞手列表', 'info');
      }
      return;
    }

    try {
      const result = await ApiService.getPilots();
      this.pilots = result.items || result.data || result || [];
      this.renderPilotList();
    } catch (error) {
      console.error('[PilotManager] 加载飞手列表失败:', error);
      
      if (error.message && error.message.includes('401')) {
        showStatus('pilot-status', '请先登录后再查看飞手列表', 'info');
      } else if (error.message && error.message.includes('API 密钥')) {
        showStatus('pilot-status', '无法连接到服务器，请检查网络', 'error');
      } else {
        showStatus('pilot-status', '加载失败: ' + error.message, 'error');
      }
    }
  },

  renderPilotList() {
    const container = document.getElementById('pilot-list-container');
    if (!container) return;

    if (this.pilots.length === 0) {
      container.innerHTML = '<div class="bf-plugin-empty">暂无飞手数据</div>';
      return;
    }

    container.innerHTML = this.pilots.map(pilot => `
      <div class="bf-plugin-list-item" data-id="${pilot.id}">
        <div class="bf-plugin-list-item-header">
          <span class="bf-plugin-list-item-title">${pilot.name || pilot.nickname || '未命名'}</span>
          <div class="bf-plugin-list-item-actions">
            <button class="bf-plugin-list-item-action edit" onclick="PilotManager.handleEditPilot('${pilot.id}')">编辑</button>
            <button class="bf-plugin-list-item-action delete" onclick="PilotManager.handleDeletePilot('${pilot.id}')">删除</button>
          </div>
        </div>
        <div class="bf-plugin-list-item-desc">
          ${pilot.phone ? `手机号: ${pilot.phone}` : ''}
          ${pilot.phone && pilot.notes ? ' | ' : ''}
          ${pilot.notes ? `备注: ${pilot.notes}` : ''}
        </div>
      </div>
    `).join('');
  },

  async handleAddPilot() {
    const name = document.getElementById('pilot-name').value.trim();
    const phone = document.getElementById('pilot-phone').value.trim();
    const notes = document.getElementById('pilot-note').value.trim();

    if (!name) {
      showStatus('pilot-status', '请输入飞手名称', 'error');
      return;
    }

    try {
      showStatus('pilot-status', '添加中...', 'info');

      if (!phone) {
        showStatus('pilot-status', '请输入手机号', 'error');
        return;
      }

      const result = await ApiService.createPilot({
        name,
        phone,
        notes: notes || null
      });

      if (result.id) {
        showStatus('pilot-status', '添加成功', 'success');
        this.clearPilotForm();
        await this.loadPilots();
      } else {
        showStatus('pilot-status', '添加失败', 'error');
      }
    } catch (error) {
      console.error('[PilotManager] 添加飞手失败:', error);
      showStatus('pilot-status', '添加失败: ' + error.message, 'error');
    }
  },

  async handleEditPilot(pilotId) {
    const pilot = this.pilots.find(s => s.id === pilotId);
    if (!pilot) return;

    document.getElementById('pilot-name').value = pilot.name || '';
    document.getElementById('pilot-phone').value = pilot.phone || '';
    document.getElementById('pilot-note').value = pilot.notes || '';

    const btnAdd = document.getElementById('btn-add-pilot');
    btnAdd.textContent = '保存修改';
    btnAdd.onclick = async () => {
      const name = document.getElementById('pilot-name').value.trim();
      const phone = document.getElementById('pilot-phone').value.trim();
      const notes = document.getElementById('pilot-note').value.trim();

      if (!name) {
        showStatus('pilot-status', '请输入飞手名称', 'error');
        return;
      }

      try {
        showStatus('pilot-status', '更新中...', 'info');

        await ApiService.updatePilot(pilotId, {
          name,
          phone: phone || null,
          notes: notes || null
        });

        showStatus('pilot-status', '更新成功', 'success');
        this.clearPilotForm();
        btnAdd.textContent = '添加飞手';
        btnAdd.onclick = () => this.handleAddPilot();
        await this.loadPilots();
      } catch (error) {
        console.error('[PilotManager] 更新飞手失败:', error);
        showStatus('pilot-status', '更新失败: ' + error.message, 'error');
        btnAdd.textContent = '添加飞手';
        btnAdd.onclick = () => this.handleAddPilot();
      }
    };
  },

  async handleDeletePilot(pilotId) {
    const confirmed = await showConfirm('删除飞手', '确定要删除该飞手吗？');
    if (!confirmed) return;

    try {
      await ApiService.deletePilot(pilotId);
      showStatus('pilot-status', '删除成功', 'success');
      await this.loadPilots();
    } catch (error) {
      console.error('[PilotManager] 删除飞手失败:', error);
      showStatus('pilot-status', '删除失败: ' + error.message, 'error');
    }
  },

  clearPilotForm() {
    document.getElementById('pilot-name').value = '';
    document.getElementById('pilot-phone').value = '';
    document.getElementById('pilot-note').value = '';
  },

  getPilots() {
    return this.pilots;
  }
};

window.PilotManager = PilotManager;
