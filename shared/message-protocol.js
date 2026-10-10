/**
 * 消息协议定义
 * @module shared/message-protocol
 */

/**
 * 消息来源
 */
export const MessageSource = {
  POPUP: 'popup',
  BACKGROUND: 'background',
  CONTENT: 'content'
};

/**
 * 消息目标
 */
export const MessageTarget = {
  POPUP: 'popup',
  BACKGROUND: 'background',
  CONTENT: 'content'
};

/**
 * 消息动作（操作类型）
 */
export const MessageAction = {
  // 飞控连接相关（新增）
  CHECK_FC_CONNECTION: 'fc/checkConnection',
  CLICK_CONNECT_BUTTON: 'fc/clickConnect',

  // 飞机相关
  AIRCRAFT_LIST: 'aircraft/list',
  AIRCRAFT_ADD: 'aircraft/add',
  AIRCRAFT_UPDATE: 'aircraft/update',
  AIRCRAFT_DELETE: 'aircraft/delete',
  AIRCRAFT_READ_FROM_PAGE: 'aircraft/readFromPage',
  AIRCRAFT_WRITE_TO_PAGE: 'aircraft/writeToPage',
  AIRCRAFT_EXPORT: 'aircraft/export',

  // 预设相关
  PRESET_LIST: 'preset/list',
  PRESET_ADD: 'preset/add',
  PRESET_UPDATE: 'preset/update',
  PRESET_DELETE: 'preset/delete',
  PRESET_APPLY: 'preset/apply',
  PRESET_EXPORT: 'preset/export',

  // 自动化日志
  AUTOMATION_LOG: 'automation/log',

  // 数据管理
  DATA_EXPORT: 'data/export',
  DATA_IMPORT: 'data/import',
  DATA_CLEAR: 'data/clear'
};

/**
 * 创建标准消息对象
 * @param {string} source - 消息来源（MessageSource）
 * @param {string} target - 消息目标（MessageTarget）
 * @param {string} action - 消息动作（MessageAction）
 * @param {*} payload - 消息负载
 * @returns {object} 标准消息对象
 */
export function createMessage(source, target, action, payload = null) {
  return {
    source,
    target,
    action,
    payload,
    timestamp: Date.now()
  };
}

/**
 * 创建成功响应对象
 * @param {*} data - 响应数据
 * @returns {object} 成功响应对象
 */
export function createSuccessResponse(data = null) {
  return {
    success: true,
    data,
    error: null
  };
}

/**
 * 创建错误响应对象
 * @param {string} message - 错误消息
 * @returns {object} 错误响应对象
 */
export function createErrorResponse(message) {
  return {
    success: false,
    data: null,
    error: { message }
  };
}
