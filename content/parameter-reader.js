/**
 * 参数读取器 - 从 BetaFlight 页面导出参数
 * @module content/parameter-reader
 *
 * v2.0.0：不再翻页读取页面展示数据（pid/rates/filter/motor 局部值），
 * 统一通过 CLI 页签执行 dump（全量）/ diff（仅修改过的参数）命令导出，
 * 返回结构化参数 + CLI 原文双份数据，供云端双字段存储。
 */

import * as BfWebAdapter from './bf-web-adapter.js';

/**
 * 参数读取器
 */
export const ParameterReader = {
  /**
   * 导出飞控参数（CLI dump/diff）
   * @param {'dump'|'diff'} [mode] - dump=全量参数，diff=仅修改过的参数
   * @param {function} [onStatus] - 进度提示回调 (msg) => void
   * @returns {Promise<{mode:string, raw:string, structured:object,
   *   paramCount:number, profile:number|null, rateprofile:number|null}>}
   */
  async readAll(mode = 'dump', onStatus) {
    const result = await BfWebAdapter.exportViaCli(mode, onStatus);
    console.log('[ParameterReader] CLI 导出完成:', result.mode, result.paramCount, '参数');
    return result;
  }
};
