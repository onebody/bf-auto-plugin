/**
 * 参数写入器 - 将参数写入 BetaFlight 页面
 * @module content/parameter-writer
 *
 * v1.2.0：新版 UI（app.betaflight.com v10.x）统一经由 bf-web-adapter 适配层写入
 * （含子页签切换与保存）。旧版选择器方法（writePID/writeRates/writeFilter/writeMotor）
 * 在新版页面全部失配且会静默吞错导致"假成功"，已停用不做降级，仅保留。
 */

import { waitForElement, inputText } from './dom-operator.js';
import { SELECTORS } from './selectors.js';
import * as BfWebAdapter from './bf-web-adapter.js';

/**
 * 参数写入器
 */
export const ParameterWriter = {
  /**
   * 写入所有参数（新版 UI 适配层，含保存）
   * @param {object} params - 所有参数
   * @param {function} onProgress - 进度回调
   * @returns {Promise<object>} 写入结果 {success, saved, sections, message}
   */
  async writeAll(params, onProgress) {
    // 注意：不做旧版选择器降级——旧版方法逐字段 .catch(() => {}) 静默吞错，
    // 在新版页面会什么都不写却报告成功，失败必须如实返回
    try {
      return await BfWebAdapter.writeAll(params, onProgress);
    } catch (error) {
      console.error('[ParameterWriter] 写入参数失败:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * 写入 PID 参数
   * @param {object} pid - PID 参数
   */
  async writePID(pid) {
    if (!pid) return;

    try {
      // 等待 PID 页面元素加载
      await waitForElement(SELECTORS.PID.ROLL_P, 5000).catch(() => null);

      // 写入 Roll PID
      if (pid.roll) {
        await inputText({ selector: SELECTORS.PID.ROLL_P, text: String(pid.roll.P) }).catch(() => {});
        await inputText({ selector: SELECTORS.PID.ROLL_I, text: String(pid.roll.I) }).catch(() => {});
        await inputText({ selector: SELECTORS.PID.ROLL_D, text: String(pid.roll.D) }).catch(() => {});
      }

      // 写入 Pitch PID
      if (pid.pitch) {
        await inputText({ selector: SELECTORS.PID.PITCH_P, text: String(pid.pitch.P) }).catch(() => {});
        await inputText({ selector: SELECTORS.PID.PITCH_I, text: String(pid.pitch.I) }).catch(() => {});
        await inputText({ selector: SELECTORS.PID.PITCH_D, text: String(pid.pitch.D) }).catch(() => {});
      }

      // 写入 Yaw PID
      if (pid.yaw) {
        await inputText({ selector: SELECTORS.PID.YAW_P, text: String(pid.yaw.P) }).catch(() => {});
        await inputText({ selector: SELECTORS.PID.YAW_I, text: String(pid.yaw.I) }).catch(() => {});
        await inputText({ selector: SELECTORS.PID.YAW_D, text: String(pid.yaw.D) }).catch(() => {});
      }

      console.log('[ParameterWriter] 写入 PID 成功:', pid);
    } catch (error) {
      console.error('[ParameterWriter] 写入 PID 失败:', error);
      throw error;
    }
  },

  /**
   * 写入 Rates 参数
   * @param {object} rates - Rates 参数
   */
  async writeRates(rates) {
    if (!rates) return;

    try {
      await waitForElement(SELECTORS.RATES.ROLL_RC_RATE, 5000).catch(() => null);

      // 写入 Roll Rates
      if (rates.roll) {
        await inputText({ selector: SELECTORS.RATES.ROLL_RC_RATE, text: String(rates.roll.rcRate) }).catch(() => {});
        await inputText({ selector: SELECTORS.RATES.ROLL_SUPER_RATE, text: String(rates.roll.superRate) }).catch(() => {});
        await inputText({ selector: SELECTORS.RATES.ROLL_EXPO, text: String(rates.roll.expo) }).catch(() => {});
      }

      // 写入 Pitch Rates
      if (rates.pitch) {
        await inputText({ selector: SELECTORS.RATES.PITCH_RC_RATE, text: String(rates.pitch.rcRate) }).catch(() => {});
        await inputText({ selector: SELECTORS.RATES.PITCH_SUPER_RATE, text: String(rates.pitch.superRate) }).catch(() => {});
        await inputText({ selector: SELECTORS.RATES.PITCH_EXPO, text: String(rates.pitch.expo) }).catch(() => {});
      }

      // 写入 Yaw Rates
      if (rates.yaw) {
        await inputText({ selector: SELECTORS.RATES.YAW_RC_RATE, text: String(rates.yaw.rcRate) }).catch(() => {});
        await inputText({ selector: SELECTORS.RATES.YAW_SUPER_RATE, text: String(rates.yaw.superRate) }).catch(() => {});
        await inputText({ selector: SELECTORS.RATES.YAW_EXPO, text: String(rates.yaw.expo) }).catch(() => {});
      }

      console.log('[ParameterWriter] 写入 Rates 成功:', rates);
    } catch (error) {
      console.error('[ParameterWriter] 写入 Rates 失败:', error);
      throw error;
    }
  },

  /**
   * 写入滤波器参数
   * @param {object} filter - 滤波器参数
   */
  async writeFilter(filter) {
    if (!filter) return;

    try {
      await waitForElement(SELECTORS.FILTER.GYRO_LOWPASS, 5000).catch(() => null);

      await inputText({ selector: SELECTORS.FILTER.GYRO_LOWPASS, text: String(filter.gyroLowpass) }).catch(() => {});
      await inputText({ selector: SELECTORS.FILTER.GYRO_NOTCH, text: String(filter.gyroNotch) }).catch(() => {});
      await inputText({ selector: SELECTORS.FILTER.DTERM_LOWPASS, text: String(filter.dTermLowpass) }).catch(() => {});

      console.log('[ParameterWriter] 写入滤波器成功:', filter);
    } catch (error) {
      console.error('[ParameterWriter] 写入滤波器失败:', error);
      throw error;
    }
  },

  /**
   * 写入电机参数
   * @param {object} motor - 电机参数
   */
  async writeMotor(motor) {
    if (!motor) return;

    try {
      await waitForElement(SELECTORS.MOTOR.MIN_THROTTLE, 5000).catch(() => null);

      await inputText({ selector: SELECTORS.MOTOR.MIN_THROTTLE, text: String(motor.minThrottle) }).catch(() => {});
      await inputText({ selector: SELECTORS.MOTOR.MAX_THROTTLE, text: String(motor.maxThrottle) }).catch(() => {});
      await inputText({ selector: SELECTORS.MOTOR.MIN_COMMAND, text: String(motor.minCommand) }).catch(() => {});

      console.log('[ParameterWriter] 写入电机成功:', motor);
    } catch (error) {
      console.error('[ParameterWriter] 写入电机失败:', error);
      throw error;
    }
  }
};
