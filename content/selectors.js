/**
 * DOM 选择器配置
 * @module content/selectors
 * @version 1.1.0 - 统一选择器系统
 * 
 * 选择器验证说明：
 * 1. 使用 Chrome DevTools 检查 BetaFlight Configurator 页面元素
 * 2. 在 Console 中测试选择器: document.querySelector('选择器')
 * 3. 如果选择器失效，更新对应配置并测试
 * 4. BetaFlight Configurator 使用 Vue.js，注意动态渲染的元素
 */

/** 选择器版本号（用于版本更新时的迁移） */
export const SELECTOR_VERSION = '1.1.0';

/**
 * BetaFlight Configurator 页面 DOM 选择器
 * 
 * 选择器优先级：
 * 1. data-* 属性选择器（最稳定）
 * 2. ID 选择器
 * 3. Class 选择器
 * 4. 属性选择器（name, placeholder 等）
 * 5. 结构选择器（:last-child 等，最不稳定）
 * 
 * 注意：多个选择器用逗号分隔，会依次尝试直到找到元素
 */
export const SELECTORS = {
  /**
   * 登录页面选择器
   * 注意：BetaFlight Configurator 通常不需要登录，这里预留用于自定义门户
   */
  LOGIN: {
    EMAIL_INPUT: '#email, input[type="email"], input[name="email"], input[placeholder*="邮箱" i], input[placeholder*="email" i]',
    PASSWORD_INPUT: '#password, input[type="password"], input[name="password"], input[placeholder*="密码" i], input[placeholder*="password" i]',
    LOGIN_BUTTON: '#login-button, button[type="submit"], button.btn-primary, .login-button',
    ERROR_MESSAGE: '.error-message, .alert-danger, [role="alert"], .text-danger, .notification-error'
  },

  /**
   * 顶部导航选择器
   * BetaFlight Configurator 使用标签页导航
   */
  NAV: {
    DASHBOARD: 'a[href*="dashboard"], [data-tab="dashboard"], .nav-item:first-child',
    PID_TUNING: 'a[href*="pid"], [data-tab="pid"]',
    RATES: 'a[href*="rate"], [data-tab="rates"]',
    FILTERS: 'a[href*="filter"], [data-tab="filters"]',
    MOTORS: 'a[href*="motor"], [data-tab="motors"]',
    SAVE_BUTTON: '#save-button, button[type="submit"].btn-primary',
    // 用于检测页面是否加载完成
    PAGE_LOADED: '.tab-content, .page-content, main, #app'
  },

  /**
   * PID 调参页面选择器
   * BetaFlight Configurator PID Tuning 标签页
   * 
   * 选择器说明：
   * - 优先使用 data-field 属性（如果存在）
   * - 其次使用 name/id 属性组合
   * - 最后使用 placeholder 或 class
   */
  PID: {
    // Roll PID
    ROLL_P: '[data-field="pidProfile.roll_p"], input[name*="roll_p" i], input[id*="roll-p" i], .pid-roll-p, input[placeholder*="Roll P" i]',
    ROLL_I: '[data-field="pidProfile.roll_i"], input[name*="roll_i" i], input[id*="roll-i" i], .pid-roll-i, input[placeholder*="Roll I" i]',
    ROLL_D: '[data-field="pidProfile.roll_d"], input[name*="roll_d" i], input[id*="roll-d" i], .pid-roll-d, input[placeholder*="Roll D" i]',

    // Pitch PID
    PITCH_P: '[data-field="pidProfile.pitch_p"], input[name*="pitch_p" i], input[id*="pitch-p" i], .pid-pitch-p, input[placeholder*="Pitch P" i]',
    PITCH_I: '[data-field="pidProfile.pitch_i"], input[name*="pitch_i" i], input[id*="pitch-i" i], .pid-pitch-i, input[placeholder*="Pitch I" i]',
    PITCH_D: '[data-field="pidProfile.pitch_d"], input[name*="pitch_d" i], input[id*="pitch-d" i], .pid-pitch-d, input[placeholder*="Pitch D" i]',

    // Yaw PID
    YAW_P: '[data-field="pidProfile.yaw_p"], input[name*="yaw_p" i], input[id*="yaw-p" i], .pid-yaw-p, input[placeholder*="Yaw P" i]',
    YAW_I: '[data-field="pidProfile.yaw_i"], input[name*="yaw_i" i], input[id*="yaw-i" i], .pid-yaw-i, input[placeholder*="Yaw I" i]',
    YAW_D: '[data-field="pidProfile.yaw_d"], input[name*="yaw_d" i], input[id*="yaw-d" i], .pid-yaw-d, input[placeholder*="Yaw D" i]'
  },

  /**
   * Rates 页面选择器
   * BetaFlight Configurator Rates 标签页
   * 
   * 注意：Rates 可能有多种模式（Betaflight, RaceFlight, Kiss 等）
   * 选择器基于默认的 Betaflight 模式
   */
  RATES: {
    // Roll Rates
    ROLL_RC_RATE: '[data-field="rates.roll_rcRate"], input[name*="roll_rc_rate" i], input[id*="roll-rc-rate" i], .rate-roll-rc',
    ROLL_SUPER_RATE: '[data-field="rates.roll_superRate"], input[name*="roll_super" i], input[id*="roll-super-rate" i], .rate-roll-super',
    ROLL_EXPO: '[data-field="rates.roll_expo"], input[name*="roll_expo" i], input[id*="roll-expo" i], .rate-roll-expo',

    // Pitch Rates
    PITCH_RC_RATE: '[data-field="rates.pitch_rcRate"], input[name*="pitch_rc_rate" i], input[id*="pitch-rc-rate" i], .rate-pitch-rc',
    PITCH_SUPER_RATE: '[data-field="rates.pitch_superRate"], input[name*="pitch_super" i], input[id*="pitch-super-rate" i], .rate-pitch-super',
    PITCH_EXPO: '[data-field="rates.pitch_expo"], input[name*="pitch_expo" i], input[id*="pitch-expo" i], .rate-pitch-expo',

    // Yaw Rates
    YAW_RC_RATE: '[data-field="rates.yaw_rcRate"], input[name*="yaw_rc_rate" i], input[id*="yaw-rc-rate" i], .rate-yaw-rc',
    YAW_SUPER_RATE: '[data-field="rates.yaw_superRate"], input[name*="yaw_super" i], input[id*="yaw-super-rate" i], .rate-yaw-super',
    YAW_EXPO: '[data-field="rates.yaw_expo"], input[name*="yaw_expo" i], input[id*="yaw-expo" i], .rate-yaw-expo'
  },

  /**
   * 滤波器页面选择器
   * BetaFlight Configurator Filters 标签页
   */
  FILTER: {
    // Gyro 滤波器
    GYRO_LOWPASS: '[data-field="gyroLowpassHz"], input[name*="gyro_lowpass" i], input[id*="gyro-lowpass" i], .filter-gyro-lowpass',
    GYRO_NOTCH: '[data-field="gyroNotchHz"], input[name*="gyro_notch" i], input[id*="gyro-notch" i], .filter-gyro-notch',
    
    // D-Term 滤波器
    DTERM_LOWPASS: '[data-field="dtermLowpassHz"], input[name*="dterm_lowpass" i], input[id*="dterm-lowpass" i], .filter-dterm-lowpass',
    DTERM_NOTCH: '[data-field="dtermNotchHz"], input[name*="dterm_notch" i], input[id*="dterm-notch" i], .filter-dterm-notch'
  },

  /**
   * 电机页面选择器
   * BetaFlight Configurator Motors 标签页
   */
  MOTOR: {
    MIN_THROTTLE: '[data-field="motorConfig.minthrottle"], input[name*="min_throttle" i], input[id*="min-throttle" i], .motor-min-throttle',
    MAX_THROTTLE: '[data-field="motorConfig.maxthrottle"], input[name*="max_throttle" i], input[id*="max-throttle" i], .motor-max-throttle',
    MIN_COMMAND: '[data-field="motorConfig.mincommand"], input[name*="min_command" i], input[id*="min-command" i], .motor-min-command'
  },

  /**
   * 通用 UI 元素选择器
   */
  GENERAL: {
    LOADING: '.loading, .spinner, [aria-busy="true"], .progress-bar, .loading-overlay',
    NOTIFICATION: '.notification, .toast, .alert, [role="alert"], .snackbar',
    CONFIRM_BUTTON: 'button.btn-confirm, button.btn-primary, button[type="submit"]',
    CANCEL_BUTTON: 'button.btn-cancel',
    MODAL: '.modal, .dialog, [role="dialog"], .popup'
  },

  /**
   * 飞控连接相关选择器
   * BetaFlight Configurator 左上角端口选择区域
   * 
   * 连接检测逻辑：
   * 1. 检查 Disconnect 按钮是否可见 -> 已连接
   * 2. 检查 Connect 按钮是否可见 -> 未连接
   * 3. 检查状态文字内容
   * 4. 检查端口选择框状态
   */
  FC_CONNECTION: {
    // 连接按钮（未连接时显示）
    // 注意：:has-text() 是 Playwright 语法，原生 querySelector 会抛 SyntaxError，
    // 文本匹配一律用 JS 遍历实现（见 content-module 方案0）
    CONNECT_BUTTON: '#connect-button, button#connect, .connect-btn, button[title*="Connect" i], button[aria-label*="Connect" i], button[aria-label*="连接"]',

    // 断开连接按钮（已连接时显示）
    DISCONNECT_BUTTON: '#disconnect-button, button#disconnect, .disconnect-btn, button[title*="Disconnect" i], button[aria-label*="Disconnect" i], button[aria-label*="断开"]',

    // 端口选择下拉框
    PORT_SELECT: '#port-select, select#port, .port-selector select, #firmware-virtual-port, select[name*="port" i]',

    // 连接状态文字（某些版本显示 "PORT_CLOSED" 或端口名）
    STATUS_TEXT: '.port-status, .connection-status, #port-status, .header-bar .status, [class*="port-state"]',

    // 波特率选择
    BAUDRATE_SELECT: '#baudrate-select, select#baudrate, .baudrate-select select, select[name*="baudrate" i]',

    // 端口刷新按钮
    REFRESH_BUTTON: '#refresh-button, button#refresh, button[title*="Refresh" i]'
  }
};

/**
 * 获取选择器配置
 * @param {string} section - 配置节（LOGIN, NAV, PID, etc.）
 * @param {string} key - 选择器键名
 * @returns {string} DOM 选择器字符串
 */
export function getSelector(section, key) {
  try {
    return SELECTORS[section]?.[key] || '';
  } catch (error) {
    console.error(`[Selectors] 获取选择器失败 (${section}.${key}):`, error);
    return '';
  }
}

/**
 * 验证选择器是否能在当前页面找到元素
 * @param {string} section - 配置节
 * @param {string} key - 选择器键名
 * @param {number} timeout - 超时时间（毫秒）
 * @returns {Promise<{found: boolean, element: Element|null, selector: string}>}
 */
export async function validateSelector(section, key, timeout = 3000) {
  const selector = getSelector(section, key);
  if (!selector) {
    return { found: false, element: null, selector: '', error: '选择器未配置' };
  }

  const startTime = Date.now();
  const selectors = selector.split(',').map(s => s.trim());

  while (Date.now() - startTime < timeout) {
    for (const sel of selectors) {
      try {
        const element = document.querySelector(sel);
        if (element && element.offsetParent !== null) {
          return { found: true, element, selector: sel };
        }
      } catch (e) {
        // 选择器语法错误，继续尝试下一个
      }
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return { found: false, element: null, selector, error: '未找到匹配的元素' };
}

/**
 * 批量验证指定区域的所有选择器
 * @param {string} section - 配置节
 * @param {number} timeout - 每个选择器的超时时间（毫秒）
 * @returns {Promise<Object<string, {found: boolean, selector: string}>>}
 */
export async function validateSection(section, timeout = 2000) {
  const sectionSelectors = SELECTORS[section];
  if (!sectionSelectors) {
    console.warn(`[Selectors] 未知的选择器区域: ${section}`);
    return {};
  }

  const results = {};
  for (const key of Object.keys(sectionSelectors)) {
    const result = await validateSelector(section, key, timeout);
    results[key] = {
      found: result.found,
      selector: result.selector,
      error: result.error
    };
  }
  return results;
}
