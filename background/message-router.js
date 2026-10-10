/**
 * 消息路由器 - 负责转发和分发消息
 * @module background/message-router
 * @version v1.1.0 - 仅保留飞机和预设模块
 */

import { MessageSource, MessageTarget, MessageAction } from '../shared/message-protocol.js';
import * as storageService from './storage-service.js';
import { getActiveTab } from './service-worker.js';

/**
 * 初始化消息监听
 */
export function initMessageListener() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message, sender, sendResponse);
    return true; // 保持消息通道开放，支持异步响应
  });
}

/**
 * 处理收到的消息
 * @param {object} message - 消息对象
 * @param {object} sender - 发送者信息
 * @param {function} sendResponse - 响应回调函数
 */
async function handleMessage(message, sender, sendResponse) {
  try {
    const { source, target, action, payload } = message;

    console.log(`[MessageRouter] 收到消息: ${action} (from=${source}, to=${target})`);

    // 如果目标是 background，直接处理
    if (target === MessageTarget.BACKGROUND) {
      const result = await handleBackgroundMessage(action, payload);
      sendResponse(result);
      return;
    }

    // 如果目标是 content script，转发给 content script
    if (target === MessageTarget.CONTENT) {
      const tab = await getActiveTab();
      if (!tab) {
        sendResponse({ success: false, error: { message: '未找到活跃的 BetaFlight 标签页' } });
        return;
      }

      chrome.tabs.sendMessage(tab.id, message, (response) => {
        if (chrome.runtime.lastError) {
          sendResponse({ success: false, error: { message: chrome.runtime.lastError.message } });
        } else {
          sendResponse(response);
        }
      });
      return;
    }

    // 如果目标是 popup，直接返回（popup 发送的消息不需要转发到 popup）
    sendResponse({ success: false, error: { message: `未知的消息目标: ${target}` } });
  } catch (error) {
    console.error('[MessageRouter] 处理消息失败:', error);
    sendResponse({ success: false, error: { message: error.message } });
  }
}

/**
 * 处理 Background 自身的消息
 * @param {string} action - 消息动作
 * @param {*} payload - 消息负载
 * @returns {Promise<object>} 处理结果
 */
async function handleBackgroundMessage(action, payload) {
  try {
    switch (action) {
      // 飞机相关
      case MessageAction.AIRCRAFT_LIST:
        return await handleAircraftList(payload);

      case MessageAction.AIRCRAFT_ADD:
        return await handleAircraftAdd(payload);

      case MessageAction.AIRCRAFT_UPDATE:
        return await handleAircraftUpdate(payload);

      case MessageAction.AIRCRAFT_DELETE:
        return await handleAircraftDelete(payload);

      // 预设相关
      case MessageAction.PRESET_LIST:
        return { success: true, data: await storageService.getPresets() };

      case MessageAction.PRESET_ADD:
        return await handlePresetAdd(payload);

      case MessageAction.PRESET_UPDATE:
        return await handlePresetUpdate(payload);

      case MessageAction.PRESET_DELETE:
        return await handlePresetDelete(payload);

      // 数据管理
      case MessageAction.DATA_EXPORT:
        return { success: true, data: await storageService.exportAllData() };

      case MessageAction.DATA_IMPORT:
        return { success: true, data: await storageService.importAllData(payload) };

      case MessageAction.DATA_CLEAR:
        return { success: true, data: await storageService.clearAllData() };

      default:
        return { success: false, error: { message: `未知的消息动作: ${action}` } };
    }
  } catch (error) {
    console.error(`[MessageRouter] 处理动作失败 (action=${action}):`, error);
    return { success: false, error: { message: error.message } };
  }
}

/**
 * 处理获取飞机列表
 * @param {object} payload - 包含 studentId（可选）
 * @returns {Promise<object>} 处理结果
 */
async function handleAircraftList(payload) {
  const aircrafts = await storageService.getAircrafts();
  if (payload && payload.studentId) {
    return { success: true, data: aircrafts.filter(a => a.studentId === payload.studentId) };
  }
  return { success: true, data: aircrafts };
}

/**
 * 处理添加飞机
 * @param {object} aircraft - 飞机对象
 * @returns {Promise<object>} 处理结果
 */
async function handleAircraftAdd(aircraft) {
  const aircrafts = await storageService.getAircrafts();
  aircrafts.push(aircraft);
  const success = await storageService.saveAircrafts(aircrafts);
  return { success, data: aircrafts };
}

/**
 * 处理更新飞机
 * @param {object} aircraft - 更新后的飞机对象
 * @returns {Promise<object>} 处理结果
 */
async function handleAircraftUpdate(aircraft) {
  const aircrafts = await storageService.getAircrafts();
  const index = aircrafts.findIndex(a => a.id === aircraft.id);
  if (index === -1) {
    return { success: false, error: { message: '飞机不存在' } };
  }
  aircrafts[index] = aircraft;
  const success = await storageService.saveAircrafts(aircrafts);
  return { success, data: aircrafts };
}

/**
 * 处理删除飞机
 * @param {object} payload - 包含 aircraftId
 * @returns {Promise<object>} 处理结果
 */
async function handleAircraftDelete(payload) {
  const aircrafts = await storageService.getAircrafts();
  const filtered = aircrafts.filter(a => a.id !== payload.aircraftId);
  const success = await storageService.saveAircrafts(filtered);
  return { success, data: filtered };
}

/**
 * 处理添加预设
 * @param {object} preset - 预设对象
 * @returns {Promise<object>} 处理结果
 */
async function handlePresetAdd(preset) {
  const presets = await storageService.getPresets();
  presets.push(preset);
  const success = await storageService.savePresets(presets);
  return { success, data: presets };
}

/**
 * 处理更新预设
 * @param {object} preset - 更新后的预设对象
 * @returns {Promise<object>} 处理结果
 */
async function handlePresetUpdate(preset) {
  const presets = await storageService.getPresets();
  const index = presets.findIndex(p => p.id === preset.id);
  if (index === -1) {
    return { success: false, error: { message: '预设不存在' } };
  }
  presets[index] = preset;
  const success = await storageService.savePresets(presets);
  return { success, data: presets };
}

/**
 * 处理删除预设
 * @param {object} payload - 包含 presetId
 * @returns {Promise<object>} 处理结果
 */
async function handlePresetDelete(payload) {
  const presets = await storageService.getPresets();
  const filtered = presets.filter(p => p.id !== payload.presetId);
  const success = await storageService.savePresets(filtered);
  return { success, data: filtered };
}
