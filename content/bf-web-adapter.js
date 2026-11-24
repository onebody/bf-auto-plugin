/**
 * BetaFlight Web Configurator 新版 UI 适配层
 * @module content/bf-web-adapter
 * @version 3.0.0
 *
 * 适用：app.betaflight.com v10.x（Vue3 + Nuxt UI + Tailwind 重构版，经真机 FOXEERF722V3 / BTF 4.5.1 验证）
 *
 * v3.0.0 写入链路 CLI 化：参数读/写统一收敛到 CLI 页签，全部写入走唯一路径
 * `set <参数名> = <值>` 命令。v2 的五条差异化 DOM 写入路径（writePidTable /
 * writeRatesTable / writeFilterBlocks / writeMotorZone / writeMotorIdle，各自
 * 文本锚点 + 兄弟单元格定位）已整体移除——所有参数共用同一条管线：
 *
 *   structuredToWriteCommands（param-metadata：与脚本编辑器导入共用同一
 *   值域换算 CLI_MAP + validateParamValue 校验，发送前完成，失败不接触飞控）
 *     → navigateToCli → waitCliReady → clearCliOutput
 *     → 逐条发送 `set name = value`（runCliCommand，输出增量错误行扫描）
 *     → `save` 持久化（触发飞控重启断连，属预期副作用）
 *
 * 值域映射（motorIdle ×100、centerSens/maxRate ÷10 等）统一由 param-metadata
 * 的 CLI_MAP 换算表处理，与读取链 mapToStructured 严格互逆；CLI 运行时错误行
 * （Invalid / Unknown / ERROR）由 findCliErrorLines 统一扫描并反馈。
 *
 * 参数读取（v2.0.0 起）：统一通过 CLI 页签执行 dump（全量）/ diff（仅修改过的
 * 参数）命令导出，见 exportViaCli 与 cli-parser。
 *
 * 已知限制（v3.0.0）：
 *  - 写入作用于飞控「当前 profile / rateprofile」，切换配置需先在页面或经 CLI 完成
 *  - 每条 set 命令需等待输出稳定（约 1.2s），全量 44 键 + save 耗时约 1 分钟
 *  - save 触发飞控重启断连（预期副作用），configurator 通常会自动重连
 *  - minthrottle / maxthrottle / mincommand 等超出 CLI_MAP 覆盖面的参数不写入
 */

import { parseCliDump, mapToStructured, findCliErrorLines } from './cli-parser.js';
import { structuredToWriteCommands } from '../editor/param-metadata.js';

/* ============================ 文本锚点 ============================ */

const PAGE_TEXT = {
  navPid: ['PID 调参', 'PID Tuning'],
  navCli: ['命令行', 'CLI'],
  cliClear: ['清除输出历史记录', 'Clear output history']
};

/* ============================ 基础工具 ============================ */

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** 按文本（多候选，精确匹配）查找可见按钮 */
function findVisibleButton(texts) {
  const candidates = texts.map(t => t.toLowerCase());
  return [...document.querySelectorAll('button')].find(b => {
    if (b.offsetParent === null) return false;
    return candidates.includes(b.textContent.trim().toLowerCase());
  }) || null;
}

/**
 * 触发按钮点击。
 * 注意：新版 UI（Vue3 + Nuxt UI）的页签/按钮监听 pointer 事件，
 * 单纯 el.click() 合成事件不生效，必须派发完整事件序列。
 */
function pressButton(btn) {
  const opts = { bubbles: true, cancelable: true, view: window };
  btn.scrollIntoView({ block: 'center' });
  btn.dispatchEvent(new PointerEvent('pointerdown', opts));
  btn.dispatchEvent(new MouseEvent('mousedown', opts));
  btn.dispatchEvent(new PointerEvent('pointerup', opts));
  btn.dispatchEvent(new MouseEvent('mouseup', opts));
  btn.dispatchEvent(new MouseEvent('click', opts));
}

/* ============================ 导航 ============================ */

/** 点击左侧菜单按钮 */
async function clickNav(texts, label) {
  const btn = findVisibleButton(texts);
  if (!btn) throw new Error(`左侧菜单未找到「${label}」入口`);
  pressButton(btn);
  await sleep(1000);
}

/** 确保当前处于 PID 调参 页（幂等，用作 CLI 操作后的导航恢复） */
async function ensurePidPage() {
  await clickNav(PAGE_TEXT.navPid, 'PID 调参');
}

/** 导航到 CLI（命令行）页 */
async function navigateToCli() {
  await clickNav(PAGE_TEXT.navCli, '命令行');
}

/* ============================ CLI 交互 ============================ */

/** CLI 输入框（页面上唯一可见的 textarea） */
function cliInput() {
  const ta = [...document.querySelectorAll('textarea')].find(t => t.offsetParent !== null);
  if (!ta) throw new Error('CLI 输入框未找到（飞控可能未连接）');
  return ta;
}

/** CLI 输出区全文 */
function cliOutputText() {
  const win = document.querySelector('div.cli-window');
  return win ? win.innerText : '';
}

/** 清空 CLI 输出历史（保证抓取内容仅含本次命令输出）；按钮缺失时跳过 */
async function clearCliOutput() {
  const btn = findVisibleButton(PAGE_TEXT.cliClear);
  if (btn) {
    pressButton(btn);
    await sleep(800);
  }
}

/**
 * 等待 CLI 就绪。
 * 实测：进入 CLI 页后浏览器会先「Building AutoComplete Cache ... Done!」，
 * 构建期间发送的命令会被静默吞掉（dump 丢失），必须等构建完成后再发命令。
 */
async function waitCliReady() {
  for (let i = 0; i < 24; i++) {
    await sleep(500);
    const t = cliOutputText();
    if (/Building AutoComplete Cache[\s\S]*Done!/.test(t)) {
      await sleep(300);
      return;
    }
    // 兜底：未见缓存构建迹象且提示符已出现（部分固件无该横幅）
    if (i >= 7 && /#\s*$/.test(t)) return;
  }
}

/**
 * 执行单条 CLI 命令并抓取本次输出。
 * 输出区为单块累积结构（所有输出追加在同一 wrapper 内），
 * 完成判定采用 innerText 长度连续 3 次稳定轮询（dump 实测 3-6s）。
 */
async function runCliCommand(cmd) {
  const preText = cliOutputText();
  const ta = cliInput();
  ta.focus();
  ta.value = cmd;
  ta.dispatchEvent(new Event('input', { bubbles: true }));
  await sleep(300);
  ta.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'Enter', keyCode: 13, bubbles: true, cancelable: true
  }));

  const lens = [];
  for (let i = 0; i < 120; i++) {
    await sleep(1000);
    lens.push(cliOutputText().length);
    if (lens.length >= 3 &&
        lens[lens.length - 1] === lens[lens.length - 2] &&
        lens[lens.length - 1] === lens[lens.length - 3]) break;
  }

  const text = cliOutputText();
  let delta = text;
  if (preText && text.startsWith(preText)) delta = text.slice(preText.length);
  if (!delta.trim()) throw new Error('CLI 无输出（命令未执行或飞控未连接）');
  return delta;
}

/* ============================ 参数写入（v3.0.0 统一 CLI 写入路径） ============================ */

/** 分区中文映射（写入结果报告用） */
const SECTION_LABELS = {
  pid: 'PID表',
  rates: 'Rates',
  filter: '滤波器',
  motor: '油门/电机设置'
};

/**
 * 写入全部参数并保存（v3.0.0：唯一写入路径 = CLI `set` 命令）。
 * @param {object} params - 结构化参数 {pid, rates, filter, motor}（UI 值域）
 * @param {function} [onProgress] - 进度回调 (current, total, message) => void
 * @returns {Promise<{success:boolean, message:string, sections:string[], saved:boolean}>}
 * @throws {Error} 参数校验失败（发送前统一校验，不接触飞控）
 *         或 CLI 运行时拒绝（统一错误行扫描反馈，含被拒命令与原文）
 */
export async function writeAll(params, onProgress) {
  const p = params || {};
  const notify = (msg) => { if (onProgress) onProgress(0, 0, msg); };

  // 1. 统一换算 + 校验（与脚本编辑器导入共用同一实现；失败快速返回）
  notify('生成 CLI 写入命令...');
  const { commands, sections } = structuredToWriteCommands(p);
  if (!commands.length) {
    return { success: true, message: '无可写入参数', sections: [], saved: true };
  }

  // 2. 进入 CLI 并等待就绪（AutoComplete 缓存构建完成）
  notify('进入命令行页...');
  await navigateToCli();
  notify('等待命令行就绪...');
  await waitCliReady();
  await clearCliOutput();

  // 3. 逐条发送 set 命令，统一扫描输出错误行
  const total = commands.length;
  for (let i = 0; i < total; i++) {
    const cmd = commands[i];
    if (onProgress) onProgress(i + 1, total, `写入参数 (${i + 1}/${total}): ${cmd}`);
    const delta = await runCliCommand(cmd);
    const errs = findCliErrorLines(delta);
    if (errs.length) {
      throw new Error(`CLI 拒绝命令「${cmd}」: ${errs.join(' | ')}`);
    }
  }

  // 4. save 持久化（飞控重启断连属预期副作用，与电机页保存行为一致）
  if (onProgress) onProgress(total, total, '执行 save 保存（飞控将重启断连）...');
  const saveDelta = await runCliCommand('save');
  const saveErrs = findCliErrorLines(saveDelta);
  if (saveErrs.length) {
    throw new Error(`CLI 拒绝命令「save」: ${saveErrs.join(' | ')}`);
  }

  // 5. 导航恢复（重启后 configurator 退回欢迎页；失败不影响已保存结果）
  try {
    await ensurePidPage();
  } catch (e) {
    console.warn('[BfWebAdapter] save 重启后返回 PID 页失败（预期副作用）: ' + e.message);
  }

  return {
    success: true,
    message: `已通过 CLI 写入 ${total} 项参数并保存`,
    sections: sections.map(k => SECTION_LABELS[k] || k),
    saved: true
  };
}

/* ============================ CLI 参数导出 ============================ */

/**
 * 通过 CLI 页签导出飞控参数（v2.0.0 统一读取路径）。
 * @param {'dump'|'diff'} mode - dump=全量参数，diff=仅修改过的参数
 * @param {function} [onStatus] - 进度提示回调 (msg) => void
 * @returns {Promise<{mode:string, raw:string, structured:object,
 *   paramCount:number, profile:number|null, rateprofile:number|null}>}
 *
 * 注意：离开 CLI 页签会自动发送 exit 导致飞控重启断连（预期副作用），
 * 导出完成后主动返回 PID 页；后续写入走 ensureFCConnected 重连流程。
 */
export async function exportViaCli(mode = 'dump', onStatus) {
  const cmd = mode === 'diff' ? 'diff' : 'dump';
  const notify = (msg) => { if (onStatus) onStatus(msg); };

  notify('进入命令行页...');
  await navigateToCli();
  notify('等待命令行就绪...');
  await waitCliReady();
  await clearCliOutput();

  notify(`执行 ${cmd} 命令并抓取输出...`);
  const raw = await runCliCommand(cmd);

  notify('解析参数...');
  const parsed = parseCliDump(raw);
  const structured = mapToStructured(parsed.sets);

  // 离开 CLI（触发 exit → 飞控重启断连，属预期副作用；失败不阻塞导出结果）
  try {
    await ensurePidPage();
  } catch (e) {
    console.warn('[BfWebAdapter] 导出后返回 PID 页失败（预期副作用）: ' + e.message);
  }

  return {
    mode: cmd,
    raw,
    structured,
    paramCount: parsed.setCount,
    profile: parsed.profile,
    rateprofile: parsed.rateprofile
  };
}
