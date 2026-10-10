/**
 * 账户管理模块 - 对接后端认证 API
 * @module popup/modules/account-manager
 */

import { ApiService } from '../../shared/api-service.js';
import { showStatus, refreshAuth } from '../popup.js';

export const AccountManager = {
  async init() {
    this.bindEvents();
  },

  bindEvents() {
    const btnLogin = document.getElementById('btn-login');
    const btnRegister = document.getElementById('btn-register');
    const btnLogout = document.getElementById('btn-logout');
    const authTabLogin = document.getElementById('auth-tab-login');
    const authTabRegister = document.getElementById('auth-tab-register');

    if (btnLogin) {
      btnLogin.addEventListener('click', () => this.handleLogin());
    }

    if (btnRegister) {
      btnRegister.addEventListener('click', () => this.handleRegister());
    }

    if (btnLogout) {
      btnLogout.addEventListener('click', () => this.handleLogout());
    }

    if (authTabLogin) {
      authTabLogin.addEventListener('click', () => this.switchAuthTab('login'));
    }

    if (authTabRegister) {
      authTabRegister.addEventListener('click', () => this.switchAuthTab('register'));
    }
  },

  switchAuthTab(tab) {
    const authTabLogin = document.getElementById('auth-tab-login');
    const authTabRegister = document.getElementById('auth-tab-register');
    const authContentLogin = document.getElementById('auth-content-login');
    const authContentRegister = document.getElementById('auth-content-register');

    if (tab === 'login') {
      authTabLogin.classList.add('active');
      authTabRegister.classList.remove('active');
      authContentLogin.classList.add('active');
      authContentRegister.classList.remove('active');
    } else {
      authTabRegister.classList.add('active');
      authTabLogin.classList.remove('active');
      authContentRegister.classList.add('active');
      authContentLogin.classList.remove('active');
    }
  },

  async checkAuth() {
    try {
      const isAuthenticated = await ApiService.isAuthenticated();
      if (!isAuthenticated) return null;

      const user = await ApiService.getCurrentUser();
      if (user) {
        return user;
      }

      const result = await chrome.storage.local.get(['bf_auto_account']);
      return result.bf_auto_account || null;
    } catch (error) {
      console.error('[AccountManager] 检查认证状态失败:', error);
      return null;
    }
  },

  async handleLogin() {
    const phone = document.getElementById('login-phone').value.trim();
    const password = document.getElementById('login-password').value.trim();

    if (!phone || !password) {
      showStatus('login-status', '请输入手机号和密码', 'error');
      return;
    }

    try {
      showStatus('login-status', '登录中...', 'info');

      const result = await ApiService.login(phone, password);

      if (result.access_token) {
        await chrome.storage.local.set({
          bf_auto_account: {
            phone: result.user?.phone || phone,
            nickname: result.user?.nickname || '',
            role: result.user?.role || 'pilot'
          }
        });

        showStatus('login-status', '登录成功', 'success');
        await refreshAuth();
      } else {
        showStatus('login-status', '登录失败，请检查账号密码', 'error');
      }
    } catch (error) {
      console.error('[AccountManager] 登录失败:', error);
      showStatus('login-status', '登录失败: ' + error.message, 'error');
    }
  },

  async handleRegister() {
    const phone = document.getElementById('register-phone').value.trim();
    const nickname = document.getElementById('register-nickname').value.trim();
    const password = document.getElementById('register-password').value.trim();
    const role = document.getElementById('register-role').value;

    if (!phone || !nickname || !password) {
      showStatus('register-status', '请填写完整信息', 'error');
      return;
    }

    if (phone.length < 11) {
      showStatus('register-status', '请输入有效的手机号', 'error');
      return;
    }

    if (password.length < 6) {
      showStatus('register-status', '密码长度至少6位', 'error');
      return;
    }

    try {
      showStatus('register-status', '注册中...', 'info');

      const result = await ApiService.register(phone, nickname, password, role);

      if (result.id) {
        showStatus('register-status', '注册成功，请登录', 'success');
        this.switchAuthTab('login');
        document.getElementById('login-phone').value = phone;
      } else {
        showStatus('register-status', '注册失败', 'error');
      }
    } catch (error) {
      console.error('[AccountManager] 注册失败:', error);
      showStatus('register-status', '注册失败: ' + error.message, 'error');
    }
  },

  async handleLogout() {
    try {
      await ApiService.logout();
      await chrome.storage.local.remove(['bf_auto_account', 'access_token']);

      showStatus('login-status', '已退出登录', 'info');
      await refreshAuth();
    } catch (error) {
      console.error('[AccountManager] 退出登录失败:', error);
      showStatus('login-status', '退出登录失败: ' + error.message, 'error');
    }
  }
};