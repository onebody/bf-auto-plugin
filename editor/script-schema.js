/**
 * script-schema.js — 脚本驱动的动态可视化 schema 解析（纯函数，无 DOM 依赖，可 Node 单测）
 *
 * 渲染管线：结构化参数 → structuredToScript → 脚本文本 → buildScriptSchema → 动态表单
 * 脚本是可视化布局的单一事实来源：
 *   - `# ---- 分区名 ----` 注释  → 可视化分区（顺序/命名/数量跟随脚本）
 *   - `set NAME = VALUE` 行     → 参数项（known 用内置元数据，unknown 透传 extra）
 *   - `# @param NAME key=value` → 渲染规则（label/range/step/unit/desc/readonly/group），
 *     优先级：脚本规则 > 内置元数据 > 通用兜底
 * 脚本变更后重新调用 buildScriptSchema 即可自动适配，无需修改渲染代码。
 */

import { describeCliName, AXIS_LABELS } from './param-metadata.js';

/** 未知透传参数的通用校验元数据（无界数值，保留 4 位小数精度） */
const GENERIC_META = { min: -Infinity, max: Infinity, step: 0.0001 };

/** 解析 @param 规则行：`# @param NAME label=x range=a-b step=n unit=u desc=d readonly group=g` */
function parseRule(line) {
  const m = line.match(/^#\s*@param\s+(\S+)\s*(.*)$/);
  if (!m) return null;
  const rule = { name: m[1], readonly: false };
  for (const kv of m[2].matchAll(/(\w+)(?:=([^\s]*))?/g)) {
    const [, k, v] = kv;
    if (k === 'readonly') rule.readonly = v === undefined ? true : v !== 'false'; // 裸 flag 或 readonly=true/false
    else if (v !== undefined) rule[k] = v; // 裸未知词忽略
  }
  return rule;
}

/** 规则 range=a-b → {min, max}；非法声明忽略该键 */
function parseRange(str) {
  const m = String(str || '').match(/^(-?[\d.]+)\s*-\s*(-?[\d.]+)$/);
  if (!m) return null;
  const min = Number(m[1]), max = Number(m[2]);
  return Number.isFinite(min) && Number.isFinite(max) && min <= max ? { min, max } : null;
}

/**
 * 解析脚本文本 → 动态渲染 schema
 * @param {string} text - CLI 脚本文本（set 行 + 分区注释 + @param 渲染规则注释）
 * @returns {{sections: Array<{title, items: Array}>, paramCount: number}}
 *          items 项结构：
 *          {
 *            cliName, rawValue,            // 脚本原始值（CLI 域字符串）
 *            known,                        // 是否内置已识别参数
 *            label, meta, unit, desc,      // 渲染与校验元数据（meta 为 UI 值域）
 *            group,                        // 轴分组显示名（null = 不分组）
 *            readonly,
 *            uiValue,                      // UI 域初始值（known 经 toUi 换算；透传项=原始值）
 *            applyTarget,                  // known: {section,axis?,key}；透传: {extra: cliName}
 *            line                          // 脚本行号（诊断用）
 *          }
 */
export function buildScriptSchema(text) {
  const lines = String(text || '').split(/\r?\n/);
  // 第一遍：收集 @param 渲染规则（作用于同名 set 行，与位置无关）
  const rules = {};
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith('#')) {
      const rule = parseRule(line);
      if (rule) rules[rule.name] = rule;
    }
  }
  // 第二遍：set 行 → 参数项；分区注释 → 分区边界
  const FALLBACK_TITLE = '未分区参数';
  const sections = [];
  let cur = null;
  const ensureSection = (title) => {
    cur = sections.find(s => s.title === title);
    if (!cur) { cur = { title, items: [] }; sections.push(cur); }
  };
  ensureSection(FALLBACK_TITLE);
  const seen = new Set(); // 同名参数后者覆盖（与 parseParamScript 语义一致）
  const paramCount = { n: 0 };
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    if (line.startsWith('#')) {
      const sec = line.match(/^#\s*----\s*(.+?)\s*----\s*$/);
      if (sec) ensureSection(sec[1]);
      return;
    }
    const m = line.match(/^set\s+(\S+)\s*=\s*(.+)$/);
    if (!m) return; // 非 set 行（dump 样板）静默忽略
    const [, name, rawValue] = m;
    const desc = describeCliName(name);
    const rule = rules[name] || {};
    const range = rule.range ? parseRange(rule.range) : null;
    const knownMeta = desc ? desc.meta : null;
    const item = {
      cliName: name,
      rawValue,
      label: rule.label || (desc && desc.label) || name,
      meta: {
        min: range ? range.min : (knownMeta ? knownMeta.min : GENERIC_META.min),
        max: range ? range.max : (knownMeta ? knownMeta.max : GENERIC_META.max),
        step: rule.step !== undefined && Number.isFinite(Number(rule.step))
          ? Number(rule.step)
          : (knownMeta ? knownMeta.step : GENERIC_META.step),
        integer: knownMeta ? !!knownMeta.integer : false
      },
      unit: rule.unit !== undefined ? rule.unit : (desc ? desc.unit : ''),
      desc: rule.desc || (desc ? desc.desc : ''),
      group: rule.group !== undefined
        ? (rule.group || null)
        : (desc ? desc.group : null),
      readonly: !!rule.readonly,
      known: !!desc,
      applyTarget: desc ? desc.applyTarget : { extra: name },
      line: i + 1
    };
    if (desc && desc.toUi) {
      const n = Number(rawValue);
      item.uiValue = Number.isFinite(n) ? desc.toUi(n) : rawValue;
    } else {
      item.uiValue = rawValue;
    }
    paramCount.n++;
    if (seen.has(name)) {
      // 后者覆盖：移除旧项（保留脚本内最后出现位置与值）
      for (const s of sections) {
        const idx = s.items.findIndex(it => it.cliName === name);
        if (idx !== -1) { s.items.splice(idx, 1); break; }
      }
    }
    seen.add(name);
    cur.items.push(item);
  });
  // 空的兜底分区不输出
  const out = sections.filter(s => s.items.length);
  return { sections: out, paramCount: paramCount.n };
}

/**
 * 将脚本 unknown 项构建为透传 extra 字典（覆盖式，与脚本内容一致）
 * @param {Array<{name,value}>} unknown - parseParamScript 输出的未识别参数
 * @returns {Object<string,string>} {cliName: cliValue}
 */
export function extraFromUnknown(unknown) {
  const out = {};
  for (const u of unknown || []) out[u.name] = u.value;
  return out;
}

/** 轴分组显示名（渲染层 group 回退用） */
export { AXIS_LABELS };
