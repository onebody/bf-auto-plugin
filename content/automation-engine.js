/**
 * 自动化引擎 - 负责协调自动化操作流程
 * @module content/automation-engine
 */

import { ParameterReader } from './parameter-reader.js';
import { ParameterWriter } from './parameter-writer.js';
import { waitForElement, inputText, clickElement } from './dom-operator.js';
import { SELECTORS } from './selectors.js';

/**
 * 自动化引擎
 */
export const AutomationEngine = {
  /**
   * 执行登录自动化
   * @param {object} credentials - 登录凭证 { email, password }
   * @returns {Promise<object>} 执行结果
   */
  async login(credentials) {
    try {
      console.log('[AutomationEngine] 开始自动登录');

      // 等待并填写邮箱
      await inputText({
        selector: SELECTORS.LOGIN.EMAIL_INPUT,
        text: credentials.email,
        triggerEvents: true
      });

      // 等待并填写密码
      await inputText({
        selector: SELECTORS.LOGIN.PASSWORD_INPUT,
        text: credentials.password,
        triggerEvents: true
      });

      // 点击登录按钮
      await clickElement(SELECTORS.LOGIN.LOGIN_BUTTON);

      // 等待页面跳转
      await this.waitForNavigation();

      console.log('[AutomationEngine] 自动登录完成');
      return { success: true, message: '登录成功' };
    } catch (error) {
      console.error('[AutomationEngine] 自动登录失败:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * 执行读取参数自动化（实际实现，CLI dump/diff 导出）
   * @param {'dump'|'diff'} [mode] - dump=全量参数，diff=仅修改过的参数
   * @param {function} [onStatus] - 进度提示回调 (msg) => void
   * @returns {Promise<object>} 导出结果 { mode, raw, structured, paramCount, ... }
   */
  async readParametersFromPage(mode = 'dump', onStatus) {
    try {
      console.log('[AutomationEngine] 开始 CLI 参数导出 (mode=' + mode + ')');

      const params = await ParameterReader.readAll(mode, onStatus);

      console.log('[AutomationEngine] 参数导出完成:', params.mode, params.paramCount, '参数');
      return { success: true, data: params };
    } catch (error) {
      console.error('[AutomationEngine] 参数导出失败:', error);
      return { success: false, error: { message: error.message } };
    }
  },

  /**
   * 执行写入参数自动化（实际实现）
   * @param {object} params - 要写入的参数
   * @returns {Promise<object>} 执行结果
   */
  async writeParametersToPage(params) {
    try {
      console.log('[AutomationEngine] 开始写入参数到页面');

      // 使用 ParameterWriter 写入所有参数（适配层内部已含保存）
      const result = await ParameterWriter.writeAll(params, (current, total, message) => {
        console.log(`[AutomationEngine] 写入进度: ${message}`);
      });

      if (result.success) {
        // 适配层已保存时无需重复点击保存按钮
        if (!result.saved) {
          await this.saveConfiguration();
        }
        console.log('[AutomationEngine] 参数写入完成');
        return { success: true, message: '参数写入成功', sections: result.sections };
      } else {
        throw new Error(result.error || '写入失败');
      }
    } catch (error) {
      console.error('[AutomationEngine] 写入参数失败:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * 保存配置（点击保存按钮）
   */
  async saveConfiguration() {
    try {
      await clickElement(SELECTORS.NAV.SAVE_BUTTON);
      await sleep(1000); // 等待保存完成
      console.log('[AutomationEngine] 配置已保存');
    } catch (error) {
      console.warn('[AutomationEngine] 保存配置失败（可能不需要保存）:', error);
    }
  },

  /**
   * 等待页面跳转（检测 URL 变化或特定元素出现）
   * @param {string} [targetSelector] - 可选，跳转后应该出现的元素选择器
   * @param {number} timeout - 超时时间（毫秒），默认 10 秒
   */
  async waitForNavigation(targetSelector = null, timeout = 10000) {
    const startTime = Date.now();
    const initialUrl = window.location.href;
    
    return new Promise((resolve, reject) => {
      const check = () => {
        // 检查 URL 是否变化
        if (window.location.href !== initialUrl) {
          console.log('[AutomationEngine] 页面 URL 已变化');
          resolve();
          return;
        }
        
        // 如果提供了目标选择器，检查元素是否出现
        if (targetSelector) {
          const targetElement = document.querySelector(targetSelector);
          if (targetElement && targetElement.offsetParent !== null) {
            console.log(`[AutomationEngine] 目标元素已出现: ${targetSelector}`);
            resolve();
            return;
          }
        }
        
        // 检查是否超时
        if (Date.now() - startTime > timeout) {
          console.warn('[AutomationEngine] 等待页面跳转超时');
          resolve(); // 超时时也 resolve（不 block），让调用者决定下一步
          return;
        }
        
        // 继续等待
        setTimeout(check, 200);
      };
      
      check();
    });
  }
};

/**
 * 延迟指定时间
 * @param {number} ms - 延迟毫秒数
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
