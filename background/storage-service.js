/**
 * 存储服务 - 封装 chrome.storage.local 操作
 * @module background/storage-service
 */

import { STORAGE_KEY_ACCOUNT, STORAGE_KEY_STUDENTS, STORAGE_KEY_AIRCRAFTS, STORAGE_KEY_PRESETS, STORAGE_KEY_GLOBAL_STATE } from '../shared/storage-keys.js';
import { getStorage, setStorage, removeStorage } from '../shared/utils.js';

/**
 * 读取账号信息
 * @returns {Promise<object|null>} 账号对象或 null
 */
export async function getAccount() {
  try {
    return await getStorage(STORAGE_KEY_ACCOUNT);
  } catch (error) {
    console.error('[StorageService] 读取账号失败:', error);
    return null;
  }
}

/**
 * 保存账号信息
 * @param {object} account - 账号对象 { email, password, autoLogin }
 * @returns {Promise<boolean>} 是否成功
 */
export async function saveAccount(account) {
  try {
    await setStorage(STORAGE_KEY_ACCOUNT, account);
    return true;
  } catch (error) {
    console.error('[StorageService] 保存账号失败:', error);
    return false;
  }
}

/**
 * 清除账号信息
 * @returns {Promise<boolean>} 是否成功
 */
export async function clearAccount() {
  try {
    await removeStorage(STORAGE_KEY_ACCOUNT);
    return true;
  } catch (error) {
    console.error('[StorageService] 清除账号失败:', error);
    return false;
  }
}

/**
 * 读取学员列表
 * @returns {Promise<object[]>} 学员数组
 */
export async function getStudents() {
  try {
    const students = await getStorage(STORAGE_KEY_STUDENTS);
    return students || [];
  } catch (error) {
    console.error('[StorageService] 读取学员列表失败:', error);
    return [];
  }
}

/**
 * 保存学员列表
 * @param {object[]} students - 学员数组
 * @returns {Promise<boolean>} 是否成功
 */
export async function saveStudents(students) {
  try {
    await setStorage(STORAGE_KEY_STUDENTS, students);
    return true;
  } catch (error) {
    console.error('[StorageService] 保存学员列表失败:', error);
    return false;
  }
}

/**
 * 读取飞机列表
 * @returns {Promise<object[]>} 飞机数组
 */
export async function getAircrafts() {
  try {
    const aircrafts = await getStorage(STORAGE_KEY_AIRCRAFTS);
    return aircrafts || [];
  } catch (error) {
    console.error('[StorageService] 读取飞机列表失败:', error);
    return [];
  }
}

/**
 * 保存飞机列表
 * @param {object[]} aircrafts - 飞机数组
 * @returns {Promise<boolean>} 是否成功
 */
export async function saveAircrafts(aircrafts) {
  try {
    await setStorage(STORAGE_KEY_AIRCRAFTS, aircrafts);
    return true;
  } catch (error) {
    console.error('[StorageService] 保存飞机列表失败:', error);
    return false;
  }
}

/**
 * 读取预设模板列表
 * @returns {Promise<object[]>} 预设数组
 */
export async function getPresets() {
  try {
    const presets = await getStorage(STORAGE_KEY_PRESETS);
    return presets || [];
  } catch (error) {
    console.error('[StorageService] 读取预设列表失败:', error);
    return [];
  }
}

/**
 * 保存预设模板列表
 * @param {object[]} presets - 预设数组
 * @returns {Promise<boolean>} 是否成功
 */
export async function savePresets(presets) {
  try {
    await setStorage(STORAGE_KEY_PRESETS, presets);
    return true;
  } catch (error) {
    console.error('[StorageService] 保存预设列表失败:', error);
    return false;
  }
}

/**
 * 读取全局状态
 * @returns {Promise<object|null>} 全局状态对象或 null
 */
export async function getGlobalState() {
  try {
    const state = await getStorage(STORAGE_KEY_GLOBAL_STATE);
    return state || { currentStudentId: null, version: '1.0.0' };
  } catch (error) {
    console.error('[StorageService] 读取全局状态失败:', error);
    return { currentStudentId: null, version: '1.0.0' };
  }
}

/**
 * 保存全局状态
 * @param {object} state - 全局状态对象
 * @returns {Promise<boolean>} 是否成功
 */
export async function saveGlobalState(state) {
  try {
    await setStorage(STORAGE_KEY_GLOBAL_STATE, state);
    return true;
  } catch (error) {
    console.error('[StorageService] 保存全局状态失败:', error);
    return false;
  }
}

/**
 * 清除所有插件数据
 * @returns {Promise<boolean>} 是否成功
 */
export async function clearAllData() {
  try {
    await removeStorage([STORAGE_KEY_ACCOUNT, STORAGE_KEY_STUDENTS, STORAGE_KEY_AIRCRAFTS, STORAGE_KEY_PRESETS, STORAGE_KEY_GLOBAL_STATE]);
    return true;
  } catch (error) {
    console.error('[StorageService] 清除所有数据失败:', error);
    return false;
  }
}

/**
 * 导出所有数据
 * @returns {Promise<object>} 所有数据的导出对象
 */
export async function exportAllData() {
  try {
    const account = await getAccount();
    const students = await getStudents();
    const aircrafts = await getAircrafts();
    const presets = await getPresets();
    const globalState = await getGlobalState();

    return {
      version: '1.0.0',
      exportDate: new Date().toISOString(),
      data: {
        account,
        students,
        aircrafts,
        presets,
        globalState
      }
    };
  } catch (error) {
    console.error('[StorageService] 导出数据失败:', error);
    return null;
  }
}

/**
 * 导入所有数据
 * @param {object} importData - 导入的数据对象
 * @returns {Promise<boolean>} 是否成功
 */
export async function importAllData(importData) {
  try {
    if (!importData || !importData.data) {
      throw new Error('无效的数据格式');
    }

    const { account, students, aircrafts, presets, globalState } = importData.data;

    if (account) await saveAccount(account);
    if (students) await saveStudents(students);
    if (aircrafts) await saveAircrafts(aircrafts);
    if (presets) await savePresets(presets);
    if (globalState) await saveGlobalState(globalState);

    return true;
  } catch (error) {
    console.error('[StorageService] 导入数据失败:', error);
    return false;
  }
}
