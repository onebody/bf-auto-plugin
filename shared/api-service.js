/**
 * API 服务层 - 封装所有后端接口调用（支持加密传输）
 * @module shared/api-service
 */

const BASE_URL = 'http://localhost:8002';
const ENCRYPTION_SECRET = 'drone-config-encryption-secret-change-in-production';

let apiKey = null;
let accessToken = null;

async function getApiKey() {
  if (apiKey) return apiKey;
  try {
    const response = await fetch(`${BASE_URL}/api/source-key`);
    if (!response.ok) {
      console.error('[ApiService] 获取 API 密钥失败，HTTP状态:', response.status);
      return null;
    }
    const data = await response.json();
    if (data && data.source_key) {
      apiKey = data.source_key;
      return apiKey;
    }
    console.error('[ApiService] 获取 API 密钥失败，响应格式错误:', data);
    return null;
  } catch (error) {
    console.error('[ApiService] 获取 API 密钥失败:', error);
    return null;
  }
}

async function getAccessToken() {
  if (accessToken) return accessToken;
  try {
    const result = await chrome.storage.local.get('access_token');
    accessToken = result.access_token || null;
    return accessToken;
  } catch (error) {
    console.error('[ApiService] 获取访问令牌失败:', error);
    return null;
  }
}

async function setAccessToken(token) {
  accessToken = token;
  await chrome.storage.local.set({ access_token: token });
}

async function clearAccessToken() {
  accessToken = null;
  await chrome.storage.local.remove('access_token');
}

/**
 * 本地解析 JWT 过期时间（读 payload.exp，不依赖后端）
 * 非 JWT 或无法解析时返回 false，交由后端判定
 */
function isTokenExpired(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp === 'number' && payload.exp * 1000 < Date.now();
  } catch {
    return false;
  }
}

// 分块 base64 转换：String.fromCharCode(...bytes) 一次传入过大数组会超出
// JS 引擎参数上限导致栈溢出（配置文件 JSON 可达数十 KB），必须分块处理
const BASE64_CHUNK_SIZE = 0x8000;

function bytesToBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += BASE64_CHUNK_SIZE) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + BASE64_CHUNK_SIZE));
  }
  return btoa(binary);
}

function base64ToBytes(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function aesEncrypt(data, secret) {
  const encoder = new TextEncoder();
  const dataBytes = encoder.encode(data);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const nonce = crypto.getRandomValues(new Uint8Array(12));

  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  ).then(keyMaterial => {
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );
  }).then(key => {
    return crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce },
      key,
      dataBytes
    );
  }).then(ciphertext => {
    const tagLength = 16;
    const tag = new Uint8Array(ciphertext, ciphertext.byteLength - tagLength, tagLength);
    const encryptedData = new Uint8Array(ciphertext, 0, ciphertext.byteLength - tagLength);
    
    const combined = new Uint8Array(16 + 12 + tagLength + encryptedData.length);
    combined.set(salt, 0);
    combined.set(nonce, 16);
    combined.set(tag, 16 + 12);
    combined.set(encryptedData, 16 + 12 + tagLength);

    return bytesToBase64(combined);
  });
}

function aesDecrypt(encryptedData, secret) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  
  try {
    const combined = base64ToBytes(encryptedData);
    
    if (combined.length < 16 + 12 + 16) {
      throw new Error('Invalid encrypted data format');
    }
    
    const salt = combined.slice(0, 16);
    const nonce = combined.slice(16, 16 + 12);
    const tag = combined.slice(16 + 12, 16 + 12 + 16);
    const ciphertext = combined.slice(16 + 12 + 16);
    
    const encryptedWithTag = new Uint8Array(ciphertext.length + tag.length);
    encryptedWithTag.set(ciphertext);
    encryptedWithTag.set(tag, ciphertext.length);
    
    return crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    ).then(keyMaterial => {
      return crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: 100000,
          hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );
    }).then(key => {
      return crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: nonce },
        key,
        encryptedWithTag
      );
    }).then(plaintext => {
      return decoder.decode(plaintext);
    });
  } catch (error) {
    throw new Error(`Decryption failed: ${error.message}`);
  }
}

async function request(url, options = {}) {
  const defaultHeaders = {
    'Content-Type': 'application/json'
  };

  // 公开路径：不携带 API Key / JWT 加密头。注意不能用裸 '/' 前缀匹配，
  // 否则所有以 / 开头的 URL 都会被误判为公开路径，导致永不加密、永不带密钥
  const publicPaths = [
    '/api/auth/',
    '/api/source-key',
    '/api/audit-logs',
    '/api/usage',
    '/health'
  ];

  const isPublicPath = publicPaths.some(path => url.startsWith(path));
  const useEncryption = !isPublicPath;

  if (!isPublicPath) {
    const apiKeyVal = await getApiKey();
    if (apiKeyVal) {
      defaultHeaders['X-API-Key'] = apiKeyVal;
    }
    defaultHeaders['X-Encrypted'] = 'true';
  }

  const token = await getAccessToken();
  // 公开路径（登录/注册等）不携带 Authorization：避免残留的过期 token
  // 被附带后，登录接口的「密码错误」401 被误判为「登录已过期」
  if (token && !isPublicPath) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  let body = options.body;
  if (useEncryption && body) {
    body = await aesEncrypt(body, ENCRYPTION_SECRET);
    defaultHeaders['Content-Type'] = 'text/plain';
  }

  const response = await fetch(`${BASE_URL}${url}`, {
    ...options,
    method: options.method || (useEncryption ? 'POST' : 'GET'),
    headers: { ...defaultHeaders, ...(options.headers || {}) },
    body: body
  });

  // 204 No Content 无响应体（如 DELETE 接口）
  if (response.status === 204) {
    return null;
  }

  const isResponseEncrypted = response.headers.get('X-Encrypted') === 'true';
  let data;

  if (isResponseEncrypted) {
    const encryptedText = await response.text();
    const parsed = JSON.parse(encryptedText);
    const decryptedText = await aesDecrypt(parsed.data, ENCRYPTION_SECRET);
    data = JSON.parse(decryptedText);
  } else {
    try {
      data = await response.json();
    } catch {
      const text = await response.text();
      throw new Error(text || `HTTP ${response.status}`);
    }
  }

  if (!response.ok) {
    // 携带了已过期的 token 仍收到 401：清除失效凭证并统一提示（各模块 catch 可据此恢复登录 UI）
    if (response.status === 401 && token && isTokenExpired(token)) {
      await clearAccessToken();
      throw new Error('登录已过期，请重新登录');
    }
    throw new Error(data.detail || data.message || `HTTP ${response.status}`);
  }

  return data;
}

export const ApiService = {
  BASE_URL,

  async getApiKey() {
    return await getApiKey();
  },

  async register(phone, nickname, password, role = 'pilot') {
    return await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ phone, nickname, password, role })
    });
  },

  async login(phone, password) {
    const result = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ phone, password })
    });
    if (result.access_token) {
      await setAccessToken(result.access_token);
    }
    return result;
  },

  async logout() {
    await clearAccessToken();
    return { success: true };
  },

  async getPilots() {
    return await request('/api/pilots/list', {
      method: 'POST',
      body: JSON.stringify({})
    });
  },

  async createPilot(data) {
    return await request('/api/pilots', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async getPilotById(pilotId) {
    return await request('/api/pilots/detail', {
      method: 'POST',
      body: JSON.stringify({ pilot_id: pilotId })
    });
  },

  async updatePilot(pilotId, data) {
    return await request('/api/pilots/update', {
      method: 'POST',
      body: JSON.stringify({ pilot_id: pilotId, ...data })
    });
  },

  async deletePilot(pilotId) {
    return await request(`/api/pilots/${pilotId}`, {
      method: 'DELETE'
    });
  },

  async getDeviceTypes() {
    return await request('/api/device-types/list', {
      method: 'POST',
      body: JSON.stringify({})
    });
  },

  async createDeviceType(data) {
    return await request('/api/device-types', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async getDeviceTypeById(typeId) {
    return await request('/api/device-types/detail', {
      method: 'POST',
      body: JSON.stringify({ type_id: typeId })
    });
  },

  async updateDeviceType(typeId, data) {
    return await request('/api/device-types/update', {
      method: 'POST',
      body: JSON.stringify({ type_id: typeId, ...data })
    });
  },

  async deleteDeviceType(typeId) {
    return await request(`/api/device-types/${typeId}`, {
      method: 'DELETE'
    });
  },

  async getDevices(params = {}) {
    return await request('/api/devices/list', {
      method: 'POST',
      body: JSON.stringify(params)
    });
  },

  async createDevice(data) {
    return await request('/api/devices', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async getDeviceById(deviceId) {
    return await request('/api/devices/detail', {
      method: 'POST',
      body: JSON.stringify({ device_id: deviceId })
    });
  },

  async updateDevice(deviceId, data) {
    return await request('/api/devices/update', {
      method: 'POST',
      body: JSON.stringify({ device_id: deviceId, ...data })
    });
  },

  async deleteDevice(deviceId) {
    return await request(`/api/devices/${deviceId}`, {
      method: 'DELETE'
    });
  },

  async getDeviceParams(params = {}) {
    return await request('/api/device-params/list', {
      method: 'POST',
      body: JSON.stringify(params)
    });
  },

  async createDeviceParam(data) {
    return await request('/api/device-params', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async getDeviceParamById(paramId) {
    return await request('/api/device-params/detail', {
      method: 'POST',
      body: JSON.stringify({ param_id: paramId })
    });
  },

  async updateDeviceParam(paramId, data) {
    return await request('/api/device-params/update', {
      method: 'POST',
      body: JSON.stringify({ param_id: paramId, ...data })
    });
  },

  async deleteDeviceParam(paramId) {
    return await request(`/api/device-params/${paramId}`, {
      method: 'DELETE'
    });
  },

  // ==================== 机库管理 ====================

  async getHangars() {
    return await request('/api/hangars/list', {
      method: 'POST',
      body: JSON.stringify({})
    });
  },

  async createHangar(data) {
    return await request('/api/hangars', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateHangar(hangarId, data) {
    return await request('/api/hangars/update', {
      method: 'POST',
      body: JSON.stringify({ hangar_id: hangarId, ...data })
    });
  },

  async deleteHangar(hangarId) {
    return await request(`/api/hangars/${hangarId}`, {
      method: 'DELETE'
    });
  },

  // ==================== 配置文件管理 ====================

  async getConfigFiles(params = {}) {
    return await request('/api/config-files/list', {
      method: 'POST',
      body: JSON.stringify(params)
    });
  },

  async createConfigFile(data) {
    return await request('/api/config-files', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async getConfigFileById(configFileId) {
    return await request('/api/config-files/detail', {
      method: 'POST',
      body: JSON.stringify({ config_file_id: configFileId })
    });
  },

  async updateConfigFile(configFileId, data) {
    return await request('/api/config-files/update', {
      method: 'POST',
      body: JSON.stringify({ config_file_id: configFileId, ...data })
    });
  },

  async setActiveConfigFile(configFileId) {
    return await request('/api/config-files/set-active', {
      method: 'POST',
      body: JSON.stringify({ config_file_id: configFileId })
    });
  },

  async deleteConfigFile(configFileId) {
    return await request(`/api/config-files/${configFileId}`, {
      method: 'DELETE'
    });
  },

  // ==================== 配置版本管理 ====================

  async getConfigVersions(configFileId) {
    return await request('/api/config-files/versions/list', {
      method: 'POST',
      body: JSON.stringify({ config_file_id: configFileId })
    });
  },

  async getConfigVersionDetail(configFileId, version) {
    return await request('/api/config-files/versions/detail', {
      method: 'POST',
      body: JSON.stringify({ config_file_id: configFileId, version })
    });
  },

  async restoreConfigVersion(configFileId, version, note = null) {
    return await request('/api/config-files/versions/restore', {
      method: 'POST',
      body: JSON.stringify({ config_file_id: configFileId, version, note })
    });
  },

  async getAuditLogs(params = {}) {
    return await request('/api/audit-logs', {
      method: 'GET'
    });
  },

  /**
   * 检查是否已认证（有有效 token）
   */
  async isAuthenticated() {
    const token = await getAccessToken();
    return !!token && !isTokenExpired(token);
  },

  /**
   * 获取当前登录用户信息（从本地存储）
   */
  async getCurrentUser() {
    try {
      const result = await chrome.storage.local.get(['bf_auto_account']);
      return result.bf_auto_account || null;
    } catch (error) {
      console.error('[ApiService] 获取用户信息失败:', error);
      return null;
    }
  },

  /**
   * 检查认证状态，返回详细状态
   * @returns {{isAuthenticated: boolean, hasToken: boolean, hasApiKey: boolean}}
   */
  async checkAuthStatus() {
    const token = await getAccessToken();
    const key = await getApiKey();
    return {
      isAuthenticated: !!token && !isTokenExpired(token),
      hasToken: !!token,
      hasApiKey: !!key
    };
  }
};