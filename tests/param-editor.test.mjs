/**
 * 参数编辑器单元测试（Node 原生 test runner，无 chrome/DOM 依赖）
 * 运行：node bf-auto-plugin/tests/param-editor.test.mjs
 * @module tests/param-editor
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  PID_KEYS, PID_META, RATES_KEYS, RATES_META, RATES_EXTRA_KEYS, RATES_EXTRA_META,
  FILTER_KEYS, FILTER_META, MOTOR_KEYS, MOTOR_META,
  validateParamValue, cliNameOf, inferPrecision
} from '../editor/param-metadata.js';
import { parseCliDump, mapToStructured } from '../content/cli-parser.js';

describe('元数据完备性', () => {
  test('四区键数符合预期（pid 5 / rates 轴 3 + 附加 2 / filter 12 / motor 6）', () => {
    assert.equal(PID_KEYS.length, 5);
    assert.equal(RATES_KEYS.length, 3);
    assert.equal(RATES_EXTRA_KEYS.length, 2);
    assert.equal(FILTER_KEYS.length, 12);
    assert.equal(MOTOR_KEYS.length, 6);
    // 总可编辑键 = 3 轴 × (5 + 3) + 2 附加 + 12 + 6 = 44
    assert.equal(3 * (PID_KEYS.length + RATES_KEYS.length) + RATES_EXTRA_KEYS.length
      + FILTER_KEYS.length + MOTOR_KEYS.length, 44);
  });

  test('每条元数据字段齐全且范围合法（min<=max、step>0、label/desc 非空）', () => {
    // 去重后的元数据条数 = 5 + 3 + 2 + 12 + 6 = 28（44 为键实例数，pid/rates 三轴共用元数据）
    const allMetas = [
      ...PID_KEYS.map(k => PID_META[k]),
      ...RATES_KEYS.map(k => RATES_META[k]),
      ...RATES_EXTRA_KEYS.map(k => RATES_EXTRA_META[k]),
      ...FILTER_KEYS.map(k => FILTER_META[k]),
      ...MOTOR_KEYS.map(k => MOTOR_META[k])
    ];
    assert.equal(allMetas.length, 28);
    for (const m of allMetas) {
      assert.ok(m.label, `label 缺失: ${JSON.stringify(m)}`);
      assert.ok(m.desc, `desc 缺失: ${m.label}`);
      assert.ok(Number.isFinite(m.min) && Number.isFinite(m.max), `范围非法: ${m.label}`);
      assert.ok(m.min <= m.max, `min>max: ${m.label}`);
      assert.ok(m.step > 0, `step 非法: ${m.label}`);
    }
  });

  test('真机校准值对照（motorIdle 0-10、centerSens 0-250、maxRate 0-2000）', () => {
    assert.equal(MOTOR_META.motorIdle.min, 0);
    assert.equal(MOTOR_META.motorIdle.max, 10);
    assert.equal(RATES_META.centerSens.min, 0);
    assert.equal(RATES_META.centerSens.max, 250);
    assert.equal(RATES_META.maxRate.max, 2000);
    assert.equal(MOTOR_META.vbatSagComp.max, 150);
    assert.equal(MOTOR_META.thrustLinearization.max, 48);
  });

  test('真机默认值必须落在元数据范围内（dyn_notch_q 默认 300）', () => {
    // 回归防护：dyn_notch_q 的 BF 默认值是 300，元数据曾误标 0-10 导致真机数据校验失败
    assert.ok(FILTER_META.gyroNotchQ.min <= 300 && FILTER_META.gyroNotchQ.max >= 300,
      `gyroNotchQ 范围 [${FILTER_META.gyroNotchQ.min}, ${FILTER_META.gyroNotchQ.max}] 必须覆盖默认值 300`);
    assert.ok(validateParamValue('300', FILTER_META.gyroNotchQ).ok, 'dyn_notch_q=300 必须校验通过');
  });
});

describe('validateParamValue 校验纯函数', () => {
  const meta = { min: 0, max: 200, step: 1 };
  const intMeta = { min: 0, max: 5, step: 1, integer: true };
  const expoMeta = { min: 0, max: 1, step: 0.01 };

  test('合法值通过并按精度取整', () => {
    assert.deepEqual(validateParamValue('45', meta), { ok: true, value: 45 });
    assert.deepEqual(validateParamValue(45.0, meta), { ok: true, value: 45 });
    assert.deepEqual(validateParamValue(' 42.6 ', meta), { ok: true, value: 43 }); // 整数步进取整
    assert.deepEqual(validateParamValue('0.333', expoMeta), { ok: true, value: 0.33 }); // 两位小数
    assert.deepEqual(validateParamValue(0.7, expoMeta), { ok: true, value: 0.7 });
  });

  test('空值拒绝', () => {
    assert.equal(validateParamValue('', meta).ok, false);
    assert.equal(validateParamValue('   ', meta).ok, false);
    assert.equal(validateParamValue(null, meta).ok, false);
    assert.equal(validateParamValue(undefined, meta).ok, false);
  });

  test('非数字拒绝', () => {
    const r = validateParamValue('abc', meta);
    assert.equal(r.ok, false);
    assert.match(r.error, /数字/);
  });

  test('越界拒绝并提示范围', () => {
    const hi = validateParamValue('999', meta);
    assert.equal(hi.ok, false);
    assert.match(hi.error, /0–200/);
    const lo = validateParamValue('-5', meta);
    assert.equal(lo.ok, false);
    assert.match(lo.error, /0–200/);
  });

  test('整数约束拒绝小数', () => {
    const r = validateParamValue('2.5', intMeta);
    assert.equal(r.ok, false);
    assert.match(r.error, /整数/);
    assert.equal(validateParamValue('3', intMeta).ok, true);
  });

  test('边界值恰好在范围内可通过', () => {
    assert.deepEqual(validateParamValue('0', meta), { ok: true, value: 0 });
    assert.deepEqual(validateParamValue('200', meta), { ok: true, value: 200 });
  });
});

describe('cliNameOf CLI 参数名映射', () => {
  test('pid 轴键按 cliPrefix 拼接（dmax→d_x、diff→d_min_x）', () => {
    assert.equal(cliNameOf('pid', 'p', 'roll'), 'p_roll');
    assert.equal(cliNameOf('pid', 'dmax', 'pitch'), 'd_pitch');
    assert.equal(cliNameOf('pid', 'diff', 'yaw'), 'd_min_yaw');
    assert.equal(cliNameOf('pid', 'f', 'roll'), 'f_roll');
  });

  test('rates 轴键按轴前缀拼接', () => {
    assert.equal(cliNameOf('rates', 'centerSens', 'pitch'), 'pitch_rc_rate');
    assert.equal(cliNameOf('rates', 'maxRate', 'yaw'), 'yaw_srate');
    assert.equal(cliNameOf('rates', 'expo', 'roll'), 'roll_expo');
  });

  test('附加/滤波器/电机键直取 cliName', () => {
    assert.equal(cliNameOf('rates', 'throttleLimit', null), 'throttle_limit_percent');
    assert.equal(cliNameOf('rates', 'throttleExpo', null), 'thr_expo');
    assert.equal(cliNameOf('filter', 'gyroNotchQ', null), 'dyn_notch_q');
    assert.equal(cliNameOf('motor', 'motorIdle', null), 'dshot_idle_value（÷100）');
  });
});

describe('mapToStructured 与编辑器键集对齐（集成）', () => {
  // 模拟 dump 输出的代表性 CLI 参数（真机校准格式）
  const sets = {
    p_roll: '45', i_roll: '80', d_roll: '46', d_min_roll: '30', f_roll: '120',
    p_pitch: '47', i_pitch: '84', d_pitch: '48', d_min_pitch: '32', f_pitch: '125',
    p_yaw: '55', i_yaw: '90', f_yaw: '90',
    roll_rc_rate: '7', roll_srate: '67', roll_expo: '0.2',
    pitch_rc_rate: '7', pitch_srate: '67', pitch_expo: '0.2',
    yaw_rc_rate: '10', yaw_srate: '90', yaw_expo: '0.1',
    throttle_limit_percent: '100', thr_expo: '0',
    rates_type: 'ACTUAL',
    gyro_lpf1_static_hz: '250', gyro_lpf1_dyn_max_hz: '500', gyro_lpf2_static_hz: '500',
    dyn_notch_count: '3', dyn_notch_q: '3', dyn_notch_min_hz: '100', dyn_notch_max_hz: '600',
    dterm_lpf1_static_hz: '150', dterm_lpf1_dyn_max_hz: '300', dterm_lpf1_dyn_expo: '5',
    dterm_lpf2_static_hz: '150', yaw_lowpass_hz: '100',
    throttle_boost: '30', motor_output_limit: '100', dyn_idle_min_rpm: '0',
    vbat_sag_compensation: '100', thrust_linear: '20', dshot_idle_value: '400'
  };
  const structured = mapToStructured(parseCliDump(
    Object.entries(sets).map(([k, v]) => `set ${k} = ${v}`).join('\n') + '\nbatch end\n'
  ).sets);

  test('映射输出的每个键都能在编辑器元数据中找到（无未收录键）', () => {
    for (const axis of ['roll', 'pitch', 'yaw']) {
      for (const [k, v] of Object.entries(structured.pid[axis] || {})) {
        assert.ok(PID_META[k], `pid.${axis}.${k} 未收录`);
        assert.ok(Number.isFinite(v));
      }
      for (const [k, v] of Object.entries(structured.rates[axis] || {})) {
        assert.ok(RATES_META[k], `rates.${axis}.${k} 未收录`);
        assert.ok(Number.isFinite(v));
      }
    }
    for (const [k, v] of Object.entries(structured.filter)) {
      assert.ok(FILTER_META[k], `filter.${k} 未收录`);
      assert.ok(Number.isFinite(v));
    }
    for (const [k, v] of Object.entries(structured.motor)) {
      assert.ok(MOTOR_META[k], `motor.${k} 未收录`);
      assert.ok(Number.isFinite(v));
    }
  });

  test('所有映射值都落在编辑器元数据范围内', () => {
    const check = (v, m, path) => {
      assert.ok(v >= m.min && v <= m.max, `${path}=${v} 超出 [${m.min}, ${m.max}]`);
    };
    for (const axis of ['roll', 'pitch', 'yaw']) {
      for (const [k, v] of Object.entries(structured.pid[axis] || {})) check(v, PID_META[k], `pid.${axis}.${k}`);
      for (const [k, v] of Object.entries(structured.rates[axis] || {})) check(v, RATES_META[k], `rates.${axis}.${k}`);
    }
    for (const [k, v] of Object.entries(structured.filter)) check(v, FILTER_META[k], `filter.${k}`);
    for (const [k, v] of Object.entries(structured.motor)) check(v, MOTOR_META[k], `motor.${k}`);
  });

  test('真机校准映射值抽查（motorIdle=4、centerSens=70、maxRate=670、mode 标识）', () => {
    assert.equal(structured.motor.motorIdle, 4);      // dshot_idle_value 400 ÷ 100
    assert.equal(structured.rates.roll.centerSens, 70);   // 7 × 10
    assert.equal(structured.rates.roll.maxRate, 670);     // 67 × 10
    assert.equal(structured.rates.mode, 'actual');
    // mode 不属于可编辑键集
    assert.ok(!RATES_META.mode && !RATES_EXTRA_META.mode);
  });
});

describe('inferPrecision', () => {
  test('按 step 推导小数位', () => {
    assert.equal(inferPrecision({ step: 1 }), 0);
    assert.equal(inferPrecision({ step: 0.1 }), 1);
    assert.equal(inferPrecision({ step: 0.01 }), 2);
    assert.equal(inferPrecision({ step: 100 }), 0);
  });
});
