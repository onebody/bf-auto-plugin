/**
 * Betaflight CLI 文本解析器（纯函数，无 DOM 依赖，可 Node 单测）
 * @module content/cli-parser
 * @version 1.0.0
 *
 * 输入为 CLI 页签命令（dump/diff）的原始输出文本，格式经真机
 * （HGLR ZEUSF722_AIO / Betaflight 4.4.0 / app.betaflight.com v10.6.2）校准：
 *
 *   # dump                              ← 命令回显（# 开头，忽略）
 *   # Betaflight / STM32F7X2 ... 4.4.0  ← 注释行（忽略）
 *   batch start                         ← 批次标记（落入 blocks）
 *   board_name ZEUSF722_AIO             ← 非 set 命令行（落入 blocks）
 *   resource BEEPER 1 C13               ← 非 set 命令行（落入 blocks）
 *   profile 2                           ← profile 分节切换
 *   set p_roll = 45                     ← 参数行 → sets{p_roll: '45'}
 *   rateprofile 1                       ← rateprofile 分节切换
 *   batch end                           ← 批次结束（落入 blocks）
 *
 * 「应用到页面」结构化映射（mapToStructured）全部经真机 dump 值 × UI 显示值对照校准：
 *   - pid:   UI 列序 [P, I, DMax, D衍生, F] ↔ CLI [p_x, i_x, d_x, d_min_x, f_x]
 *            （注意：UI 第3列对应 d_x，第4列「D衍生项目」对应 d_min_x，非直觉）
 *   - rates: UI 中央灵敏度/最大角速率 = CLI rc_rate/srate × 10（7↔70、67↔670 实证）
 *            油门限制 ← throttle_limit_percent(×1)；油门Expo ← thr_expo
 *            油门中点在 BF 4.4 CLI 中无对应参数，不映射（写入时跳过该输入框）
 *   - filter: UI「LP1动态」对应 CLI *_lpf1_dyn_max_hz（非 dyn_min）；偏航LP ← yaw_lowpass_hz
 *   - motor: 电机页怠速 = dshot_idle_value ÷ 100（4↔400、5↔500 经 diff 实证）
 */

/**
 * 解析 CLI 输出文本
 * @param {string} text - CLI 输出原文
 * @returns {{ sets: Object<string,string>, blocks: string[], profile: number|null,
 *             rateprofile: number|null, setCount: number }}
 */
export function parseCliDump(text) {
  const lines = String(text || '').split(/\r?\n/);
  const sets = {};
  const blocks = [];
  let profile = null;
  let rateprofile = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    let m = line.match(/^profile\s+(\d+)$/);
    if (m) { profile = parseInt(m[1], 10); continue; }

    m = line.match(/^rateprofile\s+(\d+)$/);
    if (m) { rateprofile = parseInt(m[1], 10); continue; }

    m = line.match(/^set\s+(\S+)\s*=\s*(.+)$/);
    if (m) { sets[m[1]] = m[2].trim(); continue; }

    blocks.push(line);
  }

  return { sets, blocks, profile, rateprofile, setCount: Object.keys(sets).length };
}

/** 安全数值转换：非有限值返回 undefined（调用方据此跳过写入） */
function num(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : undefined;
}

/** 滤波器 UI 12 输入框 ↔ CLI 参数名映射（顺序对位） */
const FILTER_KEYS = {
  gyroLp1Static: 'gyro_lpf1_static_hz',
  gyroLp1Dynamic: 'gyro_lpf1_dyn_max_hz',
  gyroLp2Static: 'gyro_lpf2_static_hz',
  gyroNotchCount: 'dyn_notch_count',
  gyroNotchQ: 'dyn_notch_q',
  gyroNotchMinHz: 'dyn_notch_min_hz',
  gyroNotchMaxHz: 'dyn_notch_max_hz',
  dtermLp1Static: 'dterm_lpf1_static_hz',
  dtermLp1Dynamic: 'dterm_lpf1_dyn_max_hz',
  dtermLp1Expo: 'dterm_lpf1_dyn_expo',
  dtermLp2Static: 'dterm_lpf2_static_hz',
  yawLpStatic: 'yaw_lowpass_hz'
};

/**
 * 将 CLI sets 映射为与既有「应用到页面」链路兼容的结构化参数
 * { pid, rates, filter, motor }——只包含 CLI 输出中实际存在的键，
 * 缺失键不产生 0 值（diff 模式 / 部分参数场景写入时按 undefined 跳过）
 * @param {Object<string,string>} sets - parseCliDump 解析出的参数表
 * @returns {object} 结构化参数
 */
export function mapToStructured(sets) {
  const s = sets || {};
  const pid = {};
  const rates = {};
  const filter = {};
  const motor = {};

  // PID 表：UI 列序 [P, I, DMax(←d_x), D衍生(←d_min_x), F]
  for (const axis of ['roll', 'pitch', 'yaw']) {
    const a = {};
    if (s['p_' + axis] !== undefined) a.p = num(s['p_' + axis]);
    if (s['i_' + axis] !== undefined) a.i = num(s['i_' + axis]);
    if (s['d_' + axis] !== undefined) a.dmax = num(s['d_' + axis]);
    if (s['d_min_' + axis] !== undefined) a.diff = num(s['d_min_' + axis]);
    if (s['f_' + axis] !== undefined) a.f = num(s['f_' + axis]);
    if (Object.keys(a).length) pid[axis] = a;
  }

  // Rates 表：rc_rate/srate × 10（真机校准）
  for (const axis of ['roll', 'pitch', 'yaw']) {
    const a = {};
    if (s[axis + '_rc_rate'] !== undefined) a.centerSens = num(s[axis + '_rc_rate']) * 10;
    if (s[axis + '_srate'] !== undefined) a.maxRate = num(s[axis + '_srate']) * 10;
    if (s[axis + '_expo'] !== undefined) a.expo = num(s[axis + '_expo']);
    if (Object.keys(a).length) rates[axis] = a;
  }
  if (s.throttle_limit_percent !== undefined) rates.throttleLimit = num(s.throttle_limit_percent);
  if (s.thr_expo !== undefined) rates.throttleExpo = num(s.thr_expo);
  if (Object.keys(rates).length) {
    // 与既有 readAll schema 保持一致（mode 字段写回链路不消费，仅作标识）
    rates.mode = (s.rates_type || 'actual').toLowerCase();
  }

  // 滤波器 12 项
  for (const [key, cliName] of Object.entries(FILTER_KEYS)) {
    if (s[cliName] !== undefined) filter[key] = num(s[cliName]);
  }

  // 油门和电机设置 + 电机页怠速（dshot_idle_value ÷ 100）
  if (s.throttle_boost !== undefined) motor.throttleBoost = num(s.throttle_boost);
  if (s.motor_output_limit !== undefined) motor.motorOutputLimit = num(s.motor_output_limit);
  if (s.dyn_idle_min_rpm !== undefined) motor.dynamicIdle = num(s.dyn_idle_min_rpm);
  if (s.vbat_sag_compensation !== undefined) motor.vbatSagComp = num(s.vbat_sag_compensation);
  if (s.thrust_linear !== undefined) motor.thrustLinearization = num(s.thrust_linear);
  if (s.dshot_idle_value !== undefined) motor.motorIdle = num(s.dshot_idle_value) / 100;

  const out = {};
  if (Object.keys(pid).length) out.pid = pid;
  if (Object.keys(rates).length) out.rates = rates;
  if (Object.keys(filter).length) out.filter = filter;
  if (Object.keys(motor).length) out.motor = motor;
  return out;
}
