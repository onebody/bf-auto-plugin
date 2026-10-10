/**
 * 全局状态管理器
 * @module background/state-manager
 */

import { STORAGE_KEY_GLOBAL_STATE } from '../shared/storage-keys.js';
import { getStorage, setStorage } from '../shared/utils.js';

/** 内存中的状态缓存 */
let stateCache = null;

/**
 * 初始化状态管理器
 */
export function initStateManager() {
  console.log('[StateManager] 初始化状态管理器');

  // 加载状态到缓存
  loadState().then(state => {
    stateCache = state;
    console.log('[StateManager] 状态已加载:', state);
  });
}

/**
 * 加载全局状态
 * @returns {Promise<object>} 全局状态
 */
async function loadState() {
  try {
    const state = await getStorage(STORAGE_KEY_GLOBAL_STATE);
    return state || { currentStudentId: null, version: '1.0.0' };
  } catch (error) {
    console.error('[StateManager] 加载状态失败:', error);
    return { currentStudentId: null, version: '1.0.0' };
  }
}

/**
 * 获取全局状态
 * @returns {Promise<object>} 全局状态
 */
export async function getState() {
  if (!stateCache) {
    stateCache = await loadState();
  }
  return stateCache;
}

/**
 * 更新全局状态
 * @param {object} updates - 要更新的字段
 * @returns {Promise<boolean>} 是否成功
 */
export async function updateState(updates) {
  try {
    const state = await getState();
    Object.assign(state, updates);
    stateCache = state;
    await setStorage(STORAGE_KEY_GLOBAL_STATE, state);
    console.log('[StateManager] 状态已更新:', state);
    return true;
  } catch (error) {
    console.error('[StateManager] 更新状态失败:', error);
    return false;
  }
}

/**
 * 获取当前选中的学员 ID
 * @returns {Promise<string|null>} 学员 ID 或 null
 */
export async function getCurrentStudentId() {
  const state = await getState();
  return state.currentStudentId;
}

/**
 * 设置当前选中的学员 ID
 * @param {string} studentId - 学员 ID
 * @returns {Promise<boolean>} 是否成功
 */
export async function setCurrentStudentId(studentId) {
  return await updateState({ currentStudentId: studentId });
}

/**
 * 清除全局状态（恢复默认）
 * @returns {Promise<boolean>} 是否成功
 */
export async function clearState() {
  stateCache = { currentStudentId: null, version: '1.0.0' };
  try {
    await setStorage(STORAGE_KEY_GLOBAL_STATE, stateCache);
    console.log('[StateManager] 状态已清除');
    return true;
  } catch (error) {
    console.error('[StateManager] 清除状态失败:', error);
    return false;
  }
}
