/**
 * 参数编辑器元数据表 + 校验纯函数（无 chrome/DOM 依赖，可 Node 单测）
 * @module editor/param-metadata
 * @version 1.3.0（新增 validateParamScript 脚本全量校验；parseParamScript 增语法错误行/忽略行/条目明细）
 *
 * 覆盖 mapToStructured 输出的结构化四区全部可编辑键（约 44 键），
 * 每键提供：中文名称 / 取值范围 / 步进 / 中文说明 / 对应 CLI 参数名。
 * 编辑器全程在结构化（UI）值域操作：
 *   - motorIdle=4 对应 CLI dshot_idle_value=400（÷100 映射已在 cli-parser 完成）
 *   - centerSens/maxRate 为 CLI rc_rate/srate ×10 的 UI 值
 *   - rates.mode 为只读标识（写回链路不消费），不在本表内
 */

import { structuredIdleToCli } from '../content/cli-parser.js';

/** PID 区键序（UI 列序：P / I / DMax / D衍生 / F） */
export const PID_KEYS = ['p', 'i', 'dmax', 'diff', 'f'];

/** PID 区元数据（三轴共用；cliPrefix 按轴拼接：${cliPrefix}_${axis}） */
export const PID_META = {
  p:    { label: 'P', cliPrefix: 'p', min: 0, max: 200, step: 1,
          desc: '比例增益，直接决定响应速度与杆量跟手度' },
  i:    { label: 'I', cliPrefix: 'i', min: 0, max: 200, step: 1,
          desc: '积分增益，抵抗外力与重量分布误差造成的姿态漂移' },
  dmax: { label: 'DMax', cliPrefix: 'd', min: 0, max: 100, step: 1,
          desc: 'D 项最大值，抑制 propwash 与快速机动的震荡' },
  diff: { label: 'D 衍生', cliPrefix: 'd_min', min: 0, max: 100, step: 1,
          desc: 'D 项下限，防止快速反打时 D 输出跌落过深' },
  f:    { label: 'F', cliPrefix: 'f', min: 0, max: 500, step: 1,
          desc: '前馈增益，提升快速打杆时的跟随性' }
};

/** Rates 区轴键序 */
export const RATES_KEYS = ['centerSens', 'maxRate', 'expo'];

/** Rates 区轴元数据（三轴共用；cliName 按轴拼接：${axis}_${cliSuffix}） */
export const RATES_META = {
  centerSens: { label: '中央灵敏度', cliSuffix: 'rc_rate', min: 0, max: 250, step: 1,
                desc: '摇杆中位附近的灵敏度（UI 值 = CLI rc_rate ×10）' },
  maxRate:    { label: '最大角速率', unit: '°/s', cliSuffix: 'srate', min: 0, max: 2000, step: 10,
                desc: '满杆时的角速率上限（UI 值 = CLI srate ×10）' },
  expo:       { label: 'Expo', cliSuffix: 'expo', min: 0, max: 1, step: 0.01,
                desc: '中位区曲线柔和程度，越大中位越柔和' }
};

/** Rates 区附加（非轴）键元数据 */
export const RATES_EXTRA_KEYS = ['throttleLimit', 'throttleExpo'];
export const RATES_EXTRA_META = {
  throttleLimit: { label: '油门限制', unit: '%', cliName: 'throttle_limit_percent', min: 25, max: 150, step: 1,
                   desc: '油门输出上限百分比，保护电调与电机' },
  throttleExpo:  { label: '油门 Expo', cliName: 'thr_expo', min: 0, max: 1, step: 0.01,
                   desc: '油门中位区柔和程度' }
};

/** 滤波器区键序与元数据（12 键，扁平结构） */
export const FILTER_KEYS = [
  'gyroLp1Static', 'gyroLp1Dynamic', 'gyroLp2Static',
  'gyroNotchCount', 'gyroNotchQ', 'gyroNotchMinHz', 'gyroNotchMaxHz',
  'dtermLp1Static', 'dtermLp1Dynamic', 'dtermLp1Expo', 'dtermLp2Static',
  'yawLpStatic'
];
export const FILTER_META = {
  gyroLp1Static:  { label: '陀螺仪 LP1 静态', unit: 'Hz', cliName: 'gyro_lpf1_static_hz', min: 0, max: 1000, step: 1,
                    desc: '陀螺仪一阶低通静态截止频率' },
  gyroLp1Dynamic: { label: '陀螺仪 LP1 动态上限', unit: 'Hz', cliName: 'gyro_lpf1_dyn_max_hz', min: 0, max: 1000, step: 1,
                    desc: '动态低通的最高截止频率（随油门滑动）' },
  gyroLp2Static:  { label: '陀螺仪 LP2 静态', unit: 'Hz', cliName: 'gyro_lpf2_static_hz', min: 0, max: 1000, step: 1,
                    desc: '陀螺仪二阶低通静态截止频率' },
  gyroNotchCount: { label: '动态陷波器数量', cliName: 'dyn_notch_count', min: 0, max: 5, step: 1, integer: true,
                    desc: 'RPM/FF 动态陷波滤波器级数' },
  gyroNotchQ:     { label: '动态陷波 Q 值', cliName: 'dyn_notch_q', min: 1, max: 500, step: 1, integer: true,
                    desc: '陷波器品质因数，越高滤波窗口越窄（CLI 默认 300）' },
  gyroNotchMinHz: { label: '动态陷波下限', unit: 'Hz', cliName: 'dyn_notch_min_hz', min: 0, max: 1000, step: 1,
                    desc: '动态陷波最低中心频率' },
  gyroNotchMaxHz: { label: '动态陷波上限', unit: 'Hz', cliName: 'dyn_notch_max_hz', min: 0, max: 1000, step: 1,
                    desc: '动态陷波最高中心频率' },
  dtermLp1Static:  { label: 'D 项 LP1 静态', unit: 'Hz', cliName: 'dterm_lpf1_static_hz', min: 0, max: 1000, step: 1,
                     desc: 'D 项一阶低通静态截止频率' },
  dtermLp1Dynamic: { label: 'D 项 LP1 动态上限', unit: 'Hz', cliName: 'dterm_lpf1_dyn_max_hz', min: 0, max: 1000, step: 1,
                     desc: 'D 项动态低通的最高截止频率' },
  dtermLp1Expo:    { label: 'D 项 LP1 Expo', cliName: 'dterm_lpf1_dyn_expo', min: 0, max: 10, step: 1, integer: true,
                     desc: 'D 项动态低通曲线指数（CLI 默认 5）' },
  dtermLp2Static:  { label: 'D 项 LP2 静态', unit: 'Hz', cliName: 'dterm_lpf2_static_hz', min: 0, max: 1000, step: 1,
                     desc: 'D 项二阶低通静态截止频率' },
  yawLpStatic:     { label: '偏航低通', unit: 'Hz', cliName: 'yaw_lowpass_hz', min: 0, max: 1000, step: 1,
                     desc: '偏航轴低通滤波截止频率' }
};

/** 电机区键序与元数据（6 键，扁平结构） */
export const MOTOR_KEYS = [
  'throttleBoost', 'motorOutputLimit', 'dynamicIdle',
  'vbatSagComp', 'thrustLinearization', 'motorIdle'
];
export const MOTOR_META = {
  throttleBoost:       { label: '油门加速', unit: '%', cliName: 'throttle_boost', min: 0, max: 100, step: 1,
                         desc: '快速推油门时的响应加成' },
  motorOutputLimit:    { label: '电机输出限制', unit: '%', cliName: 'motor_output_limit', min: 25, max: 100, step: 1,
                         desc: '限制电机最大输出功率，保护动力系统' },
  dynamicIdle:         { label: '动态怠速', unit: 'RPM', cliName: 'dyn_idle_min_rpm', min: 0, max: 10000, step: 100,
                         desc: '动态怠速的最低转速' },
  vbatSagComp:         { label: '压降补偿', unit: '%', cliName: 'vbat_sag_compensation', min: 0, max: 150, step: 1,
                         desc: '电池电压跌落时的补偿强度' },
  thrustLinearization: { label: '推力线性化', unit: '%', cliName: 'thrust_linear', min: 0, max: 48, step: 1,
                         desc: '推力输出曲线线性化程度，改善油门线性感' },
  motorIdle:           { label: '电机怠速', cliName: 'dshot_idle_value（÷100）', min: 0, max: 10, step: 0.1,
                         desc: '电机怠速占空比（UI 值 = CLI dshot_idle_value ÷100）' }
};

/** 分区标题 */
export const SECTION_TITLES = {
  pid: 'PID 调参',
  rates: 'Rates 与油门',
  filter: '滤波器',
  motor: '油门和电机设置'
};

/** 轴显示名 */
export const AXIS_LABELS = {
  roll: 'Roll（横滚）',
  pitch: 'Pitch（俯仰）',
  yaw: 'Yaw（偏航）'
};

/**
 * 根据元数据推导数值精度（由 step 的小数位数）
 * @param {object} meta - 参数元数据
 * @returns {number} 小数位数
 */
export function inferPrecision(meta) {
  const stepStr = String(meta.step ?? 1);
  const dot = stepStr.indexOf('.');
  return dot === -1 ? 0 : stepStr.length - dot - 1;
}

/**
 * 校验单个参数值（纯函数，编辑器实时校验与保存/写入前全量校验共用）
 * @param {string|number} rawValue - 用户输入原始值
 * @param {object} meta - 参数元数据（min/max/step/integer）
 * @returns {{ok: true, value: number}|{ok: false, error: string}} 校验结果；
 *          ok 时 value 为按步进精度取整后的数值
 */
export function validateParamValue(rawValue, meta) {
  const s = String(rawValue ?? '').trim();
  if (!s) {
    return { ok: false, error: '值不能为空' };
  }
  const n = Number(s);
  if (!Number.isFinite(n)) {
    return { ok: false, error: '必须是数字' };
  }
  if (meta.integer && !Number.isInteger(n)) {
    return { ok: false, error: '必须是整数' };
  }
  if (n < meta.min || n > meta.max) {
    return { ok: false, error: `超出范围 ${meta.min}–${meta.max}` };
  }
  const p = inferPrecision(meta);
  const value = p > 0 ? Math.round(n * 10 ** p) / 10 ** p : Math.round(n);
  return { ok: true, value };
}

/**
 * 取分区键的 CLI 参数名
 * @param {string} section - 分区 'pid'|'rates'|'filter'|'motor'
 * @param {string} key - 参数键
 * @param {string} [axis] - 轴名（pid/rates 轴键必填）
 * @returns {string} CLI 参数名
 */
export function cliNameOf(section, key, axis) {
  if (section === 'pid') return `${PID_META[key].cliPrefix}_${axis}`;
  if (section === 'rates' && RATES_META[key]) return `${axis}_${RATES_META[key].cliSuffix}`;
  if (section === 'rates') return RATES_EXTRA_META[key].cliName;
  if (section === 'filter') return FILTER_META[key].cliName;
  if (section === 'motor') return MOTOR_META[key].cliName;
  return key;
}

/* ==================== CLI 脚本双向转换（脚本格式参数编辑器） ====================
 *
 * 脚本格式与 Betaflight CLI dump/diff 一致：`set <参数名> = <值>`（CLI 值域），
 * `#` 开头为注释。因此：
 *   - 导出的脚本文本可直接粘贴到 Betaflight CLI 页签真实执行
 *   - 从 dump/diff 复制的 set 行可直接粘贴导入
 * 值域差异（UI ↔ CLI）统一在 CLI_MAP 换算，与读取链 mapToStructured 严格互逆：
 *   - centerSens/maxRate：UI = CLI × 10（roll_rc_rate=13 ↔ 130）
 *   - motorIdle：UI = CLI ÷ 100（dshot_idle_value=450 ↔ 4.5，复用 structuredIdleToCli）
 * rates.mode 为只读标识，不参与脚本往返。
 */

/** UI/CLI 值域换算比例（rates 轴参数：UI = CLI × 10） */
const RATE_UI_SCALE = 10;
/** expo 值域换算：UI 为 0-1 小数，CLI 为 0-100 整数百分比（实机实证：set 0.35 被静默截断为 0） */
const EXPO_UI_SCALE = 100;

/** CLI 参数名 → {section, key, axis?, toUi?, toCli?} 反查表（模块级构建一次） */
const CLI_MAP = (() => {
  const map = {};
  for (const axis of ['roll', 'pitch', 'yaw']) {
    for (const k of PID_KEYS) {
      map[`${PID_META[k].cliPrefix}_${axis}`] = { section: 'pid', key: k, axis };
    }
    for (const k of RATES_KEYS) {
      // centerSens/maxRate ×10 值域差（UI = CLI × 10）；expo ×100（UI 小数 → CLI 整数百分比）
      const scaled = k === 'centerSens' || k === 'maxRate';
      const expo = k === 'expo';
      map[`${axis}_${RATES_META[k].cliSuffix}`] = {
        section: 'rates', key: k, axis,
        toUi: scaled ? v => v * RATE_UI_SCALE : expo ? v => v / EXPO_UI_SCALE : undefined,
        toCli: scaled ? v => v / RATE_UI_SCALE : expo ? v => Math.round(v * EXPO_UI_SCALE) : undefined
      };
    }
  }
  for (const k of RATES_EXTRA_KEYS) {
    const expo = k === 'throttleExpo';
    map[RATES_EXTRA_META[k].cliName] = {
      section: 'rates', key: k,
      ...(expo ? { toUi: v => v / EXPO_UI_SCALE, toCli: v => Math.round(v * EXPO_UI_SCALE) } : {})
    };
  }
  for (const k of FILTER_KEYS) {
    map[FILTER_META[k].cliName] = { section: 'filter', key: k };
  }
  for (const k of MOTOR_KEYS) {
    map[k === 'motorIdle' ? 'dshot_idle_value' : MOTOR_META[k].cliName] =
      k === 'motorIdle'
        ? { section: 'motor', key: k, toUi: v => v / 100, toCli: structuredIdleToCli }
        : { section: 'motor', key: k };
  }
  return map;
})();

/** 非 motorIdle 时的分区元数据表反查 */
function metaOf(def) {
  if (def.axis) return def.section === 'pid' ? PID_META[def.key] : RATES_META[def.key];
  if (def.section === 'rates') return RATES_EXTRA_META[def.key];
  if (def.section === 'filter') return FILTER_META[def.key];
  return MOTOR_META[def.key];
}

/** 数值格式化：去除浮点噪声（0.30000000000000004 → 0.3） */
function fmtCliValue(v) {
  return String(Number(Number(v).toFixed(4)));
}

/**
 * 结构化参数 → CLI 参数表（仅输出结构化数据中实际存在的键，支持 diff 部分配置）
 * @param {object} structured - {pid, rates, filter, motor}（UI 值域）
 * @returns {Object<string,number>} CLI 参数表（CLI 值域）
 */
export function structuredToSets(structured) {
  const out = {};
  const s = structured || {};
  for (const [name, def] of Object.entries(CLI_MAP)) {
    let v;
    if (def.axis) v = s[def.section]?.[def.axis]?.[def.key];
    else v = s[def.section]?.[def.key];
    if (v === undefined || v === null || v === '') continue;
    out[name] = def.toCli ? def.toCli(Number(v)) : Number(v);
  }
  return out;
}

/**
 * 查询 CLI 参数名的渲染描述（脚本驱动动态渲染的元数据查询接口）
 * @param {string} name - CLI 参数名
 * @returns {object|null} {known,label,meta,unit,desc,group,toUi,toCli,applyTarget}；
 *          null = 未识别参数（脚本驱动渲染时作为透传项处理）
 */
export function describeCliName(name) {
  const def = CLI_MAP[name];
  if (!def) return null;
  const m = metaOf(def);
  return {
    known: true,
    label: m.label || name,
    meta: { min: m.min, max: m.max, step: m.step, integer: m.integer },
    unit: m.unit || '',
    desc: m.desc || '',
    group: def.axis ? AXIS_LABELS[def.axis] : null,
    toUi: def.toUi,
    toCli: def.toCli,
    applyTarget: def.axis
      ? { section: def.section, axis: def.axis, key: def.key }
      : { section: def.section, key: def.key }
  };
}

/**
 * 结构化参数 → CLI 脚本文本（含分区注释，可直接用于 Betaflight CLI）
 * @param {object} structured - {pid, rates, filter, motor, extra?}（UI 值域）；
 *          extra 为透传参数字典 {cliName: cliValue}（CLI 值域原样，脚本驱动动态渲染）
 * @returns {string} 脚本文本
 */
export function structuredToScript(structured) {
  const sets = structuredToSets(structured);
  const lines = ['# 由参数编辑器自动生成（CLI 值域，可直接粘贴到 Betaflight CLI 执行）'];
  for (const sec of ['pid', 'rates', 'filter', 'motor']) {
    const names = Object.keys(sets).filter(n => CLI_MAP[n].section === sec);
    if (!names.length) continue;
    lines.push(`# ---- ${SECTION_TITLES[sec]} ----`);
    for (const n of names) lines.push(`set ${n} = ${fmtCliValue(sets[n])}`);
  }
  const extra = structured && structured.extra && typeof structured.extra === 'object'
    ? Object.entries(structured.extra).filter(([, v]) => v !== undefined && v !== null && v !== '')
    : [];
  if (extra.length) {
    lines.push('# ---- 其他参数 ----');
    for (const [n, v] of extra) lines.push(`set ${n} = ${v}`);
  }
  return lines.join('\n') + '\n';
}

/**
 * 解析 CLI 脚本文本（容错：忽略空行/注释/非 set 行，如 dump 粘贴带入的
 * board_name、resource 等行；保留行号用于错误定位）
 * @param {string} text - 脚本文本
 * @returns {{sets: Object<string,string>, unknown: Array<{line:number,name:string,value:string}>,
 *            items: Array<{line:number,name:string,value:string,known:boolean}>,
 *            errors: Array<{line:number,text:string,reason:string}>, ignored: number}}
 *          sets=可识别的参数表（未换算值域，后者覆盖）；unknown=无法识别的 set 参数名（带行号）；
 *          items=全部格式合法 set 行明细（脚本顺序，含行号/known 标记，重复名保留多次出现）；
 *          errors=set 命令语法错误行（形似 set 但残缺，如缺参数名/缺值/缺 "="）；ignored=静默忽略的非 set 行数
 */
export function parseParamScript(text) {
  const sets = {};
  const unknown = [];
  const items = [];
  const errors = [];
  let ignored = 0;
  String(text || '').split(/\r?\n/).forEach((raw, i) => {
    const lineNo = i + 1;
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    const m = line.match(/^set\s+(\S+)\s*=\s*(.+)$/);
    if (!m) {
      if (/^set(\s|$)/.test(line)) {
        // 形似 set 命令但格式残缺 → 语法错误（实时校验定位用）；dump 样板行仍静默忽略
        let reason;
        if (/^set\s*$/.test(line) || /^set\s*=/.test(line)) reason = '缺少参数名';
        else if (!line.includes('=')) reason = '缺少 "=" 和值';
        else if (/^set\s+\S+\s*=\s*$/.test(line)) reason = '缺少参数值';
        else reason = '格式应为：set 参数名 = 值';
        errors.push({ line: lineNo, text: line, reason });
      } else {
        ignored++;
      }
      return;
    }
    const name = m[1];
    const value = m[2].trim();
    items.push({ line: lineNo, name, value, known: !!CLI_MAP[name] });
    if (CLI_MAP[name]) sets[name] = value;
    else unknown.push({ line: lineNo, name, value });
  });
  return { sets, unknown, items, errors, ignored };
}

/**
 * 将 CLI 参数表校验并应用到结构化参数（就地修改，分区/轴对象缺失时自动创建）
 * @param {Object<string,string>} sets - parseParamScript 输出的参数表（CLI 值域原始字符串）
 * @param {object} structured - 目标结构化参数（就地修改）
 * @returns {{applied: string[], failed: Array<{name,value,reason,line?}>}}
 */
export function applyScriptSets(sets, structured) {
  const applied = [];
  const failed = [];
  for (const [name, rawValue] of Object.entries(sets || {})) {
    const def = CLI_MAP[name];
    if (!def) { // parseParamScript 已过滤，此处为防御
      failed.push({ name, value: rawValue, reason: '未识别的参数' });
      continue;
    }
    const parsed = parseFloat(rawValue);
    const uiRaw = def.toUi ? def.toUi(parsed) : parsed;
    const r = validateParamValue(uiRaw, metaOf(def));
    if (!r.ok) {
      failed.push({ name, value: rawValue, reason: r.error });
      continue;
    }
    if (def.axis) {
      structured[def.section] = structured[def.section] || {};
      structured[def.section][def.axis] = structured[def.section][def.axis] || {};
      structured[def.section][def.axis][def.key] = r.value;
    } else {
      structured[def.section] = structured[def.section] || {};
      structured[def.section][def.key] = r.value;
    }
    applied.push(name);
  }
  return { applied, failed };
}

/**
 * 脚本文本全量校验（编辑器实时校验与应用/保存前闸门共用；纯函数，不修改任何状态）
 * 校验范围：set 语法完整性（parseParamScript.errors）+ 已知参数值域
 * （与 applyScriptSets 完全同一换算/校验逻辑，行号定位到生效行）
 * @param {string} text - 脚本文本
 * @returns {{ok: boolean,
 *            errors: Array<{line:number,reason:string,name?:string,value?:string,text?:string}>,
 *            valueErrors: Array<{line:number,name:string,value:string,reason:string}>,
 *            setCount: number, appliedCount: number, unknownCount: number, ignored: number,
 *            sets: Object<string,string>, unknown: Array<{line:number,name:string,value:string}>}}
 *          ok=无语法错误且已知参数值全部合法；errors=语法+值错误合并（按行号升序）
 */
export function validateParamScript(text) {
  const { sets, unknown, items, errors, ignored } = parseParamScript(text);
  // 已知参数值校验：复用 applyScriptSets 的换算与 validateParamValue 校验（丢弃态对象，不影响调用方）
  const lineOf = {};
  for (const it of items) if (it.known) lineOf[it.name] = it.line; // 后者覆盖 → 定位生效行
  const { applied, failed } = applyScriptSets(sets, {});
  const valueErrors = failed.map(f => ({
    line: lineOf[f.name] || null, name: f.name, value: f.value, reason: f.reason
  }));
  const all = [...errors, ...valueErrors].sort((a, b) => (a.line || 0) - (b.line || 0));
  return {
    ok: all.length === 0,
    errors: all,
    valueErrors,
    setCount: items.length,
    appliedCount: applied.length,
    unknownCount: unknown.length,
    ignored,
    sets,
    unknown
  };
}

/**
 * 结构化参数 → CLI 写入命令序列（v3.0.0 写入链路唯一入口，纯函数可 Node 单测）。
 * 与脚本编辑器导入复用完全相同的转换/校验实现（要求：所有参数同一处理模式）：
 *   structuredToScript（UI 值域 → CLI 值域 + 统一格式化）
 *   → parseParamScript（统一解析，含行号）
 *   → applyScriptSets（统一 validateParamValue 校验）
 * @param {object} structured - {pid, rates, filter, motor}（UI 值域）
 * @returns {{commands: string[], names: string[], sections: string[]}}
 *          commands = 可直接发送到 Betaflight CLI 的 `set` 命令行（按 PID→Rates→
 *          滤波器→电机 分区序，不含注释行）；
 *          names = 命令对应参数名（与 commands 等长同序）；
 *          sections = 实际含写入参数的分区名列表（'pid'|'rates'|'filter'|'motor'）
 * @throws {Error} 任一参数未识别或校验失败（含参数名/行号/原因，统一错误格式）；
 *          校验在发送前完成，失败时不接触飞控
 */
export function structuredToWriteCommands(structured) {
  const extra = structured && structured.extra && typeof structured.extra === 'object'
    ? Object.entries(structured.extra).filter(([n, v]) => n && v !== undefined && v !== null && v !== '')
    : [];
  const extraNames = new Set(extra.map(([n]) => n));
  const script = structuredToScript(structured);
  const { sets, unknown } = parseParamScript(script);
  // extra 透传参数在脚本中表现为 unknown（无内置映射），属合法；仅其余 unknown 报错
  const realUnknown = unknown.filter(u => !extraNames.has(u.name));
  if (realUnknown.length) {
    const u = realUnknown[0];
    throw new Error(`未识别的 CLI 参数: ${u.name}（脚本第 ${u.line} 行）`);
  }
  const { failed } = applyScriptSets(sets, {});
  if (failed.length) {
    const f = failed[0];
    throw new Error(`参数校验失败: ${f.name} = ${f.value}（${f.reason}）`);
  }
  const commands = String(script).split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'));
  const names = Object.keys(sets);
  const secSet = new Set();
  for (const n of names) secSet.add(CLI_MAP[n].section);
  // extra 透传命令追加在尾部（已在 script 文本中的 set 行由上方 filter 收集，
  // 此处同步 names/sections 元数据）
  if (extraNames.size) {
    const extraInScript = commands
      .map(l => l.match(/^set\s+(\S+)\s*=/))
      .filter(Boolean)
      .map(m => m[1])
      .filter(n => extraNames.has(n));
    for (const n of extraInScript) names.push(n);
    secSet.add('extra');
  }
  return { commands, names, sections: [...secSet] };
}
