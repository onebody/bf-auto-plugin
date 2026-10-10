/**
 * 参数编辑器元数据表 + 校验纯函数（无 chrome/DOM 依赖，可 Node 单测）
 * @module editor/param-metadata
 * @version 1.0.0
 *
 * 覆盖 mapToStructured 输出的结构化四区全部可编辑键（约 44 键），
 * 每键提供：中文名称 / 取值范围 / 步进 / 中文说明 / 对应 CLI 参数名。
 * 编辑器全程在结构化（UI）值域操作：
 *   - motorIdle=4 对应 CLI dshot_idle_value=400（÷100 映射已在 cli-parser 完成）
 *   - centerSens/maxRate 为 CLI rc_rate/srate ×10 的 UI 值
 *   - rates.mode 为只读标识（写回链路不消费），不在本表内
 */

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
