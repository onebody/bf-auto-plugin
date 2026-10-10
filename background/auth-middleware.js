import { STORAGE_KEYS } from '../shared/storage-keys.js';
import { USER_ROLES, COACH_PHONE_PREFIXES, SKIP_AUTH } from '../shared/constants.js';

const AUTH_TTL_MS = 8 * 60 * 60 * 1000;

function detectRoleByPhone(phone) {
  if (!phone || typeof phone !== 'string') return USER_ROLES.STUDENT;
  const clean = phone.trim().replace(/\s|-/g, '');
  if (COACH_PHONE_PREFIXES.some(prefix => clean.startsWith(prefix))) return USER_ROLES.COACH;
  return USER_ROLES.STUDENT;
}

class AuthMiddleware {
  async checkAuth() {
    if (SKIP_AUTH) {
      return {
        authenticated: true,
        phone: '13900000000',
        role: USER_ROLES.STUDENT,
        name: '调试用户',
        detectedRole: USER_ROLES.STUDENT
      };
    }

    const result = await chrome.storage.local.get([STORAGE_KEYS.ACCOUNT, STORAGE_KEYS.AUTH_SESSION]);
    const account = result[STORAGE_KEYS.ACCOUNT];
    const session = result[STORAGE_KEYS.AUTH_SESSION];

    if (!account || !account.phone) {
      return { authenticated: false, reason: 'no_account' };
    }

    const detectedRole = this._detectRole(account.phone);
    const finalRole = account.role || detectedRole;

    if (finalRole && finalRole !== account.role) {
      account.role = finalRole;
      await chrome.storage.local.set({ [STORAGE_KEYS.ACCOUNT]: account });
    }

    const okSession = session && (Date.now() - (session.loginAt || 0)) < AUTH_TTL_MS
      && session.phone && session.phone === account.phone;
    const okLastLogin = account.lastLogin && (Date.now() - account.lastLogin) < AUTH_TTL_MS;

    if (okSession || okLastLogin) {
      return {
        authenticated: true,
        phone: account.phone,
        role: finalRole,
        name: account.name || `飞友${(account.phone || '').slice(-4)}`,
        detectedRole: finalRole
      };
    }

    return { authenticated: false, reason: 'expired', phone: account.phone, role: finalRole };
  }

  _detectRole(phone) {
    if (!phone || typeof phone !== 'string') return USER_ROLES.STUDENT;
    const clean = phone.trim().replace(/\s|-/g, '');
    if (COACH_PHONE_PREFIXES.some(prefix => clean.startsWith(prefix))) return USER_ROLES.COACH;
    return USER_ROLES.STUDENT;
  }

  async getRole() {
    const result = await chrome.storage.local.get([STORAGE_KEYS.ACCOUNT]);
    const account = result[STORAGE_KEYS.ACCOUNT];
    if (!account || !account.phone) return null;
    return account.role || this._detectRole(account.phone);
  }

  async setRole(role) {
    const result = await chrome.storage.local.get([STORAGE_KEYS.ACCOUNT]);
    const account = result[STORAGE_KEYS.ACCOUNT] || {};
    account.role = role || this._detectRole(account.phone);
    await chrome.storage.local.set({ [STORAGE_KEYS.ACCOUNT]: account });
    return { role: account.role, phone: account.phone };
  }

  async login(phone, _roleIgnored = null) {
    const result = await chrome.storage.local.get([STORAGE_KEYS.ACCOUNT]);
    let account = result[STORAGE_KEYS.ACCOUNT] || {};
    account.phone = phone || account.phone;
    account.lastLogin = Date.now();
    account.role = account.role || this._detectRole(account.phone);
    if (!account.name) account.name = `飞友${(account.phone || '').slice(-4)}`;
    await chrome.storage.local.set({
      [STORAGE_KEYS.ACCOUNT]: account,
      [STORAGE_KEYS.AUTH_SESSION]: { loginAt: Date.now(), phone: account.phone, role: account.role }
    });
    return { authenticated: true, phone: account.phone, role: account.role, name: account.name };
  }

  async logout() {
    await chrome.storage.local.remove([STORAGE_KEYS.AUTH_SESSION]);
    return { success: true };
  }

  async postLoginRoutine() {
    const auth = await this.checkAuth();
    if (!auth.authenticated) return { success: false, reason: 'not_authenticated' };

    if (auth.role === USER_ROLES.COACH) {
      const tab = await chrome.tabs.create({ url: chrome.runtime.getURL('admin/admin.html') });
      return { success: true, role: USER_ROLES.COACH, tabId: tab.id };
    }

    if (auth.role === USER_ROLES.STUDENT) {
      const queueKey = STORAGE_KEYS.PUSH_QUEUE_PREFIX + (auth.phone || '').trim().toLowerCase();
      const q = await chrome.storage.local.get([queueKey]);
      const queue = q[queueKey] || [];
      return { success: true, role: USER_ROLES.STUDENT, pendingPushes: queue.length };
    }

    return { success: true, role: null, needRoleSelection: true };
  }
}

export const authMiddleware = new AuthMiddleware();
