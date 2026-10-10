/**
 * 工具函数
 * @module shared/utils
 */

/**
 * 生成唯一 ID
 * @returns {string} 唯一 ID 字符串
 */
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

/**
 * 获取当前时间戳字符串
 * @returns {string} ISO 格式的时间字符串
 */
export function getCurrentTimestamp() {
  return new Date().toISOString();
}

/**
 * 安全地解析 JSON
 * @param {string} str - JSON 字符串
 * @param {*} defaultValue - 解析失败时的默认返回值
 * @returns {*} 解析结果或默认值
 */
export function safeJsonParse(str, defaultValue = null) {
  try {
    return JSON.parse(str);
  } catch (error) {
    return defaultValue;
  }
}

/**
 * 安全地序列化 JSON
 * @param {*} obj - 要序列化的对象
 * @param {string} defaultValue - 序列化失败时的默认返回值
 * @returns {string} JSON 字符串或默认值
 */
export function safeJsonStringify(obj, defaultValue = '{}') {
  try {
    return JSON.stringify(obj);
  } catch (error) {
    return defaultValue;
  }
}

/**
 * 延迟指定时间
 * @param {number} ms - 延迟毫秒数
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 安全地读取 Chrome 存储
 * @param {string} key - 存储键名
 * @returns {Promise<*>} 存储的值，不存在时返回 null
 */
export async function getStorage(key) {
  try {
    const result = await chrome.storage.local.get(key);
    return result[key] ?? null;
  } catch (error) {
    console.error(`[Utils] 读取存储失败 (key=${key}):`, error);
    return null;
  }
}

/**
 * 安全地写入 Chrome 存储
 * @param {string} key - 存储键名
 * @param {*} value - 要存储的值
 * @returns {Promise<boolean>} 是否成功
 */
export async function setStorage(key, value) {
  try {
    await chrome.storage.local.set({ [key]: value });
    return true;
  } catch (error) {
    console.error(`[Utils] 写入存储失败 (key=${key}):`, error);
    return false;
  }
}

/**
 * 安全地删除 Chrome 存储
 * @param {string|string[]} keys - 要删除的键名或键名数组
 * @returns {Promise<boolean>} 是否成功
 */
export async function removeStorage(keys) {
  try {
    await chrome.storage.local.remove(keys);
    return true;
  } catch (error) {
    console.error(`[Utils] 删除存储失败 (keys=${keys}):`, error);
    return false;
  }
}

/**
 *  Base64 编码字符串（用于密码存储）
 * @param {string} str - 原始字符串
 * @returns {string} Base64 编码后的字符串
 */
export function encodePassword(password) {
  return btoa(password);
}

/**
 * Base64 解码字符串（用于密码读取）
 * @param {string} encoded - Base64 编码后的字符串
 * @returns {string} 原始字符串
 */
export function decodePassword(encoded) {
  return atob(encoded);
}
