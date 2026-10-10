/**
 * BetaFlight Web Configurator 新版 UI 适配层
 * @module content/bf-web-adapter
 * @version 2.0.0
 *
 * 适用：app.betaflight.com v10.x（Vue3 + Nuxt UI + Tailwind 重构版，经真机 FOXEERF722V3 / BTF 4.5.1 验证）
 * 该版本 input 元素无 id/name/data-field/aria/placeholder 等稳定属性，
 * 属性选择器全部失效，因此统一采用「文本锚点 + 结构化定位」：
 *
 *  - 页面导航 / 子页签切换：可见按钮文本精确匹配（中英文备选）
 *  - PID 表（PID 配置文件设置子页签）：单个 grid 平铺，
 *    ROLL/PITCH/YAW 标签叶子 → 所在 grid → 其后 5 个兄弟单元格各含 1 个 input
 *    列序：P－比例 / I－积分 / D Max / D衍生项目 / F－前馈
 *  - Rates 表（Rate 配置文件设置子页签）：轴标签为「横滚 [A]/俯仰 [E]/方向 [R]」（带后缀，前缀匹配），
 *    其后 3 个兄弟单元格 = 中央灵敏度 / 最大角速率 / Expo；
 *    油门区独立 3 input（油门限制 / 油门中点 / 油门 Expo）
 *  - 滤波器（滤波器设置子页签）：双列容器固定 12 个 input 按序对位
 *    [陀螺LP1静态, 陀螺LP1动态, 陀螺LP2静态, 动态陷波数量, 陷波Q, 陷波最小Hz, 陷波最大Hz,
 *     DTerm LP1静态, DTerm LP1动态, DTerm LP1 Expo, DTerm LP2静态, 偏航LP静态]
 *  - 油门和电机设置（PID 子页签内区块）：标题叶子 → 向上找 5 input 容器按序对位
 *    [油门增压, 电机输出限制, 动态怠速, 电池压降补偿%, 推力线性化%]
 *  - 电机怠速（%）：电机页全页唯一 input（需左侧菜单导航到电机页）
 *
 * 参数读取（v2.0.0）：不再翻页读取页面展示数据，统一通过 CLI 页签执行
 * dump（全量）/ diff（仅修改过的参数）命令导出，见 exportViaCli 与 cli-parser。
 *
 * 已知限制（v1）：
 *  - 模式 / Rate 类型（Actual 等）为自定义下拉组件，不读写，保持飞控当前选择
 *  - minthrottle / maxthrottle / mincommand 新版 UI 不再提供（仅 CLI 可读写）
 *  - 滤波器输入框数量随类型下拉变化，仅适合同配置飞控间的读写回放
 */

import { parseCliDump, mapToStructured } from './cli-parser.js';

/* ============================ 文本锚点 ============================ */

const PAGE_TEXT = {
  navPid: ['PID 调参', 'PID Tuning'],
  navMotors: ['电机', 'Motors'],
  navCli: ['命令行', 'CLI'],
  subPid: ['PID 配置文件设置', 'PID profile settings'],
  subRates: ['Rate 配置文件设置', 'Rate profile settings'],
  subFilter: ['滤波器设置', 'Filter settings'],
  save: ['保存', 'Save'],
  saveConfirm: ['确认', '确定', '好', 'OK', 'Continue', '继续', '重新启动', 'Restart'],
  cliClear: ['清除输出历史记录', 'Clear output history']
};

const PID_AXIS = { roll: /^ROLL$/i, pitch: /^PITCH$/i, yaw: /^YAW$/i };
const RATES_AXIS = { roll: /^横滚/, pitch: /^俯仰/, yaw: /^方向/ };
const PID_COLS = 5;   // P / I / DMax / D衍生 / F
const RATES_COLS = 3; // 中央灵敏度 / 最大角速率 / Expo
const FILTER_INPUTS = 12;
const MOTOR_ZONE_INPUTS = 5;

const TEXT_MOTOR_ZONE = '油门和电机设置';
const TEXT_FILTER_GYRO = '陀螺仪低通滤波器';

/* ============================ 基础工具 ============================ */

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function num(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

/** 页面上所有可见的叶子元素（无子元素） */
function visibleLeaves() {
  return [...document.querySelectorAll('*')].filter(e =>
    e.children.length === 0 && e.offsetParent !== null);
}

/** 按精确文本查找可见叶子元素 */
function findLeafByText(text) {
  return visibleLeaves().find(e => e.textContent.trim() === text) || null;
}

/** 按正则查找可见叶子元素 */
function findLeafByRegex(re) {
  return visibleLeaves().find(e => re.test(e.textContent.trim())) || null;
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

/**
 * 向输入框写入值（兼容 Vue 双向绑定）
 */
async function setCellValue(inp, val) {
  inp.scrollIntoView({ block: 'center' });
  inp.focus();
  inp.value = String(val);
  inp.dispatchEvent(new Event('input', { bubbles: true }));
  inp.dispatchEvent(new Event('change', { bubbles: true }));
  inp.blur();
  await sleep(50);
}

/** 从叶子元素向上找到 grid 的直接子单元格 */
function cellOf(leaf, grid) {
  let n = leaf;
  while (n && n.parentElement !== grid) n = n.parentElement;
  return n;
}

/**
 * 在 grid 中定位轴标签，收集其后 count 个兄弟单元格内的 input
 */
function rowInputs(grid, axisRegex, count) {
  const leaf = [...grid.querySelectorAll('*')].find(e =>
    e.children.length === 0 && axisRegex.test(e.textContent.trim()));
  if (!leaf) throw new Error('表格轴标签未找到: ' + axisRegex);

  const cell = cellOf(leaf, grid);
  if (!cell) throw new Error('轴标签单元格定位失败');

  const inputs = [];
  let sib = cell.nextElementSibling;
  while (sib && inputs.length < count) {
    const inp = sib.querySelector('input');
    if (!inp) throw new Error('轴行单元格缺少输入框');
    inputs.push(inp);
    sib = sib.nextElementSibling;
  }
  if (inputs.length < count) {
    throw new Error(`轴行输入框数量不足: ${inputs.length}/${count}`);
  }
  return inputs;
}

/** 从区块标题叶子向上找恰好含 expectedInputs 个 input 的容器 */
function containerWithInputs(leaf, expectedInputs, maxLevels = 8) {
  let c = leaf.parentElement;
  for (let i = 0; i < maxLevels && c; i++) {
    if (c.querySelectorAll('input').length === expectedInputs) return c;
    c = c.parentElement;
  }
  return null;
}

/* ============================ 导航与页签 ============================ */

/** 点击左侧菜单按钮 */
async function clickNav(texts, label) {
  const btn = findVisibleButton(texts);
  if (!btn) throw new Error(`左侧菜单未找到「${label}」入口`);
  pressButton(btn);
  await sleep(1000);
}

/** 确保当前处于 PID 调参 页（幂等） */
export async function ensurePidPage() {
  await clickNav(PAGE_TEXT.navPid, 'PID 调参');
}

/** 导航到 电机 页 */
export async function navigateToMotors() {
  await clickNav(PAGE_TEXT.navMotors, '电机');
}

/** 切换 PID 页内子页签 */
export async function switchSubTab(name) {
  const map = { pid: PAGE_TEXT.subPid, rates: PAGE_TEXT.subRates, filter: PAGE_TEXT.subFilter };
  const texts = map[name];
  if (!texts) throw new Error('未知子页签: ' + name);
  const btn = findVisibleButton(texts);
  if (!btn) throw new Error(`子页签按钮未找到: ${texts[0]}`);
  pressButton(btn);
  await sleep(800);
}

/** 点击保存按钮，并处理可能出现的确认/重启弹窗；无保存按钮返回 false */
export async function tryClickSave() {
  const btn = findVisibleButton(PAGE_TEXT.save);
  if (!btn) return false;
  pressButton(btn);
  await sleep(1000);
  const dlgBtn = [...document.querySelectorAll('button')].find(b =>
    b.offsetParent !== null && PAGE_TEXT.saveConfirm.includes(b.textContent.trim()));
  if (dlgBtn) {
    pressButton(dlgBtn);
    await sleep(500);
  }
  return true;
}

/**
 * reka-ui 下拉选择：合成 pointer 事件选择选项无效（选择逻辑不响应），
 * 可靠配方为 pressButton(触发器) 开菜单 → option.focus() → 合成 keydown Enter。
 */
async function selectDropdownOption(trigger, label) {
  pressButton(trigger);
  await sleep(800);
  const opt = [...document.querySelectorAll('[role="option"]')]
    .find(o => o.offsetParent !== null && o.textContent.trim() === label);
  if (!opt) throw new Error(`下拉选项未找到: ${label}`);
  opt.focus();
  opt.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'Enter', keyCode: 13, bubbles: true, cancelable: true
  }));
  await sleep(600);
}

/**
 * 解除「PID 调参滑块」对 PID 表的编辑锁定。
 * 滑块模式 RP/RPY 会禁用其接管的 roll/pitch 表格单元格（input.disabled），
 * 直接写入会被 Vue 重渲染回滚，必须先把模式切到「关闭」。
 */
async function ensurePidEditable() {
  const grid = pidGrid();
  const disabledCount = [...grid.querySelectorAll('input')].filter(i => i.disabled).length;
  if (!disabledCount) return;

  const blockLeaf = visibleLeaves().find(e => e.textContent.trim() === 'PID 调参滑块');
  if (!blockLeaf) throw new Error('PID 表被滑块模式锁定，且未找到「PID 调参滑块」区块');
  let block = blockLeaf.parentElement;
  for (let i = 0; i < 6 && block; i++) {
    if (block.textContent.includes('模式')) break;
    block = block.parentElement;
  }
  const trigger = [...block.querySelectorAll('button')].find(b =>
    b.offsetParent !== null && ['RP', 'RPY', '关闭'].includes(b.textContent.trim()));
  if (!trigger) throw new Error('未找到滑块模式下拉触发器');

  await selectDropdownOption(trigger, '关闭');

  const still = [...pidGrid().querySelectorAll('input')].filter(i => i.disabled).length;
  if (still) throw new Error(`滑块模式关闭失败，PID 表仍有 ${still} 个禁用输入框`);
}

/* ============================ PID 表 ============================ */

function pidGrid() {
  const leaf = findLeafByRegex(PID_AXIS.roll);
  if (!leaf) throw new Error('PID 表 ROLL 标签未找到');
  const g = leaf.closest('.grid');
  if (!g) throw new Error('PID 表 grid 容器未找到');
  return g;
}

/**
 * 写入 PID 表（支持部分数据：缺失轴/缺失列自动跳过，供 diff 配置写回）
 */
export async function writePidTable(pid) {
  const grid = pidGrid();
  for (const [axis, re] of Object.entries(PID_AXIS)) {
    const a = pid[axis];
    if (!a || typeof a !== 'object') continue;
    const inputs = rowInputs(grid, re, PID_COLS);
    const vals = [
      a.p ?? a.P,
      a.i ?? a.I,
      a.dmax ?? a.dMax ?? a.DMax,
      a.diff ?? a.d ?? a.D,
      a.f ?? a.F
    ];
    for (let i = 0; i < PID_COLS; i++) {
      if (vals[i] === undefined) continue;
      await setCellValue(inputs[i], vals[i]);
    }
  }
}

/* ============================ Rates 表 ============================ */

function ratesGrid() {
  const leaf = findLeafByRegex(RATES_AXIS.roll);
  if (!leaf) throw new Error('Rates 表「横滚」标签未找到');
  const g = leaf.closest('.grid');
  if (!g) throw new Error('Rates 表 grid 容器未找到');
  return g;
}

/** 油门区 3 个输入框（油门限制 / 油门中点 / 油门 Expo） */
function throttleInputs() {
  const leaf = findLeafByText('油门限制');
  if (leaf) {
    let c = leaf.parentElement;
    for (let i = 0; i < 6 && c; i++) {
      const inputs = [...c.querySelectorAll('input')].filter(x => x.offsetParent !== null);
      if (inputs.length === 3) return inputs;
      c = c.parentElement;
    }
  }
  // 兜底：页面最后 3 个可见 input（油门区固定位于页尾）
  const all = [...document.querySelectorAll('input')].filter(i => i.offsetParent !== null);
  if (all.length >= 3) return all.slice(-3);
  throw new Error('油门限制区块未找到');
}

/**
 * 写入 Rates 表（支持部分数据：缺失轴/缺失字段自动跳过；
 * 油门中点在 BF 4.4 CLI 无对应参数，CLI 导出的配置不含该键时保持页面当前值）
 */
export async function writeRatesTable(rates) {
  const r = rates || {};
  const grid = ratesGrid();
  for (const [axis, re] of Object.entries(RATES_AXIS)) {
    const a = r[axis];
    if (!a || typeof a !== 'object') continue;
    const inputs = rowInputs(grid, re, RATES_COLS);
    const vals = [
      a.centerSens ?? a.rcRate,
      a.maxRate ?? a.superRate,
      a.expo
    ];
    for (let i = 0; i < RATES_COLS; i++) {
      if (vals[i] === undefined) continue;
      await setCellValue(inputs[i], vals[i]);
    }
  }
  const t = throttleInputs();
  if (r.throttleLimit !== undefined) await setCellValue(t[0], r.throttleLimit);
  if (r.throttleMidPoint !== undefined) await setCellValue(t[1], r.throttleMidPoint);
  if (r.throttleExpo !== undefined) await setCellValue(t[2], r.throttleExpo);
}

/* ============================ 滤波器 ============================ */

function filterGrid() {
  const leaf = findLeafByText(TEXT_FILTER_GYRO);
  if (!leaf) throw new Error('滤波器「陀螺仪低通滤波器」标题未找到');
  const grid = containerWithInputs(leaf, FILTER_INPUTS);
  if (!grid) throw new Error(`滤波器双列容器（${FILTER_INPUTS} inputs）未找到`);
  return grid;
}

/**
 * 写入滤波器（支持部分数据：12 键按序对位，undefined 字段自动跳过，供 diff 配置写回）
 */
export async function writeFilterBlocks(filter) {
  const f = filter || {};
  const grid = filterGrid();
  const inputs = [...grid.querySelectorAll('input')];
  if (inputs.length !== FILTER_INPUTS) {
    throw new Error(`滤波器容器预期 ${FILTER_INPUTS} 个输入框，实际 ${inputs.length}`);
  }
  const vals = [
    f.gyroLp1Static, f.gyroLp1Dynamic, f.gyroLp2Static,
    f.gyroNotchCount, f.gyroNotchQ, f.gyroNotchMinHz, f.gyroNotchMaxHz,
    f.dtermLp1Static, f.dtermLp1Dynamic, f.dtermLp1Expo,
    f.dtermLp2Static, f.yawLpStatic
  ];
  for (let i = 0; i < FILTER_INPUTS; i++) {
    if (vals[i] === undefined) continue;
    await setCellValue(inputs[i], vals[i]);
  }
}

/* ============================ 油门和电机设置（PID 页区块） ============================ */

function motorZoneEl() {
  const leaf = findLeafByText(TEXT_MOTOR_ZONE);
  if (!leaf) throw new Error(`「${TEXT_MOTOR_ZONE}」标题未找到`);
  const el = containerWithInputs(leaf, MOTOR_ZONE_INPUTS, 6);
  if (!el) throw new Error(`「${TEXT_MOTOR_ZONE}」区块（${MOTOR_ZONE_INPUTS} inputs）未找到`);
  return el;
}

/**
 * 写入油门和电机设置（支持部分数据：缺失字段自动跳过，供 diff 配置写回）
 */
export async function writeMotorZone(motor) {
  const m = motor || {};
  const el = motorZoneEl();
  const inputs = [...el.querySelectorAll('input')];
  if (inputs.length !== MOTOR_ZONE_INPUTS) {
    throw new Error(`「${TEXT_MOTOR_ZONE}」预期 ${MOTOR_ZONE_INPUTS} 个输入框，实际 ${inputs.length}`);
  }
  const vals = [m.throttleBoost, m.motorOutputLimit, m.dynamicIdle, m.vbatSagComp, m.thrustLinearization];
  for (let i = 0; i < MOTOR_ZONE_INPUTS; i++) {
    if (vals[i] === undefined) continue;
    await setCellValue(inputs[i], vals[i]);
  }
}

/* ============================ 电机页怠速 ============================ */

function motorIdleInput() {
  const inputs = [...document.querySelectorAll('input')].filter(i => i.offsetParent !== null);
  if (inputs.length !== 1) {
    throw new Error(`电机页预期唯一怠速输入框，实际 ${inputs.length} 个`);
  }
  return inputs[0];
}

/**
 * 电机页专用保存：该页保存按钮文本为「保存并重启」（非精确「保存」），
 * 点击后飞控会重启导致串口断连（属正常副作用，配置urator 通常会自动重连）。
 */
async function tryClickMotorSave() {
  const btn = [...document.querySelectorAll('button')].find(b =>
    b.offsetParent !== null && /^(保存并重启|保存|Save and Restart|Save)$/i.test(b.textContent.trim()));
  if (!btn) return false;
  pressButton(btn);
  await sleep(1000);
  const dlgBtn = [...document.querySelectorAll('button')].find(b =>
    b.offsetParent !== null && PAGE_TEXT.saveConfirm.includes(b.textContent.trim()));
  if (dlgBtn) {
    pressButton(dlgBtn);
    await sleep(500);
  }
  return true;
}

/** 导航到电机页写入怠速并保存，随后返回 PID 页 */
export async function writeMotorIdle(value) {
  await navigateToMotors();
  const inp = motorIdleInput();
  if (inp.disabled) {
    throw new Error('电机怠速输入框被页面禁用，无法写入');
  }
  await setCellValue(inp, value);
  if (num(inp.value) !== num(value)) {
    throw new Error(`电机怠速写入被回滚（页面显示 ${inp.value}，期望 ${value}）`);
  }
  const saved = await tryClickMotorSave();
  try {
    await ensurePidPage();
  } catch (e) {
    // 「保存并重启」后飞控重启，configurator 会退回欢迎页，暂时找不到 PID 导航。
    // 保存已生效，此处仅是导航恢复，留待下次写入/读取时的 ensurePidPage 处理。
    console.warn('[BfWebAdapter] 保存重启后返回 PID 页失败（预期副作用）: ' + e.message);
  }
  return { value, saved };
}

/* ============================ 全量写入编排 ============================ */

/**
 * 写入全部参数（新版 UI）并保存
 * 写入顺序：PID 页（PID表+油门电机区）→ Rates → 滤波器 → 电机页怠速
 * ⚠️ 新版 UI 的保存按钮按子页签生效：只在当前子页签保存该页签的修改，
 * 因此每个子页签写完后必须立刻各自点击保存，最后统一保存会丢失其它页签的修改。
 */
export async function writeAll(params, onProgress) {
  const p = params || {};
  const sections = [];
  const notify = (msg) => { if (onProgress) onProgress(0, 0, msg); };

  await ensurePidPage();

  if (p.pid || (p.motor && ['throttleBoost', 'motorOutputLimit', 'dynamicIdle', 'vbatSagComp', 'thrustLinearization']
      .some(k => p.motor && p.motor[k] !== undefined))) {
    await switchSubTab('pid');
    if (p.pid) {
      await ensurePidEditable();
      notify('写入 PID 表...');
      await writePidTable(p.pid);
      sections.push('PID表');
    }
    if (p.motor && ['throttleBoost', 'motorOutputLimit', 'dynamicIdle', 'vbatSagComp', 'thrustLinearization']
        .some(k => p.motor[k] !== undefined)) {
      notify('写入油门和电机设置...');
      await writeMotorZone(p.motor);
      sections.push('油门电机设置');
    }
    notify('保存 PID 页...');
    if (!(await tryClickSave())) throw new Error('未找到保存按钮（PID 页）');
  }

  if (p.rates) {
    await switchSubTab('rates');
    notify('写入 Rates...');
    await writeRatesTable(p.rates);
    sections.push('Rates');
    notify('保存 Rates 页...');
    if (!(await tryClickSave())) throw new Error('未找到保存按钮（Rates 页）');
  }

  if (p.filter) {
    await switchSubTab('filter');
    notify('写入滤波器...');
    await writeFilterBlocks(p.filter);
    sections.push('滤波器');
    notify('保存滤波器页...');
    if (!(await tryClickSave())) throw new Error('未找到保存按钮（滤波器页）');
  }

  if (p.motor && p.motor.motorIdle !== undefined) {
    notify('写入电机怠速...');
    const r = await writeMotorIdle(p.motor.motorIdle);
    if (!r.saved) {
      console.warn('[BfWebAdapter] 电机页无保存按钮，怠速可能未持久化');
    }
    sections.push('电机怠速');
  }

  return { success: true, message: `已写入: ${sections.join(', ')}`, sections, saved: true };
}

/* ============================ CLI 参数导出 ============================ */

/** 导航到 CLI（命令行）页 */
export async function navigateToCli() {
  await clickNav(PAGE_TEXT.navCli, '命令行');
}

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
