/**
 * 参数编辑器整页逻辑
 * @module editor/editor
 * @version 1.0.0
 *
 * 数据流：
 *   云端 params_json（结构化四区） → 深拷贝为 editedStructured → 输入框编辑（实时校验，
 *   合法值合并进 editedStructured）→ 保存（下载 .json + 本地草稿）或写入飞控
 *     （二次确认 → 复用 AIRCRAFT_WRITE_TO_PAGE 链路，payload 为 {aircraft: editedStructured}）
 *
 * 消息复用：message-router 对 target=CONTENT 的消息按 URL 匹配 BF 标签页转发，
 * 不依赖发送方是否为活跃 tab，编辑器页直接 chrome.runtime.sendMessage 即可复用全链路。
 */

import { MessageSource, MessageTarget, MessageAction, createMessage } from '../shared/message-protocol.js';
import { ApiService } from '../shared/api-service.js';
import {
  PID_KEYS, PID_META, RATES_KEYS, RATES_META, RATES_EXTRA_KEYS, RATES_EXTRA_META,
  FILTER_KEYS, FILTER_META, MOTOR_KEYS, MOTOR_META,
  SECTION_TITLES, AXIS_LABELS, validateParamValue, cliNameOf
} from './param-metadata.js';

const AXES = ['roll', 'pitch', 'yaw'];

/** 全局状态 */
let configId = null;
let configDetail = null;       // 云端配置详情 {id, name, device_id, params_json, cli_commands}
let deviceName = '';
let cloudStructured = null;    // 云端原始结构化参数
let editedStructured = null;   // 当前编辑中的结构化参数（深拷贝）
let draftTimer = null;         // 草稿防抖定时器

// ==================== 初始化 ====================

async function init() {
  console.log('[Editor] 初始化参数编辑器 v1.0.0');

  const params = new URLSearchParams(location.search);
  configId = parseInt(params.get('configId'), 10);
  if (!Number.isFinite(configId) || configId <= 0) {
    showStatus('URL 缺少有效的 configId 参数', 'error');
    return;
  }

  bindToolbar();

  try {
    const detailResult = await ApiService.getConfigFileById(configId);
    configDetail = detailResult.data || detailResult;

    const devices = await loadDeviceMap();
    deviceName = devices[configDetail.device_id] || `#${configDetail.device_id}`;

    cloudStructured = configDetail.params_json || null;
    if (!cloudStructured || typeof cloudStructured !== 'object') {
      document.getElementById('editor-empty').style.display = 'block';
      setHeader();
      appendLog('加载成功，但该记录无参数数据');
      return;
    }

    editedStructured = structuredClone(cloudStructured);
    renderAll();
    setHeader();
    appendLog(`加载配置成功（${countEditableKeys(editedStructured)} 项参数）`);
    await checkDraft();
  } catch (error) {
    console.error('[Editor] 加载失败:', error);
    if (error.message && error.message.includes('401')) {
      showStatus('登录已过期，请重新打开插件并登录', 'error');
    } else {
      showStatus(`加载失败: ${error.message}`, 'error');
    }
    appendLog(`加载失败: ${error.message}`);
  }
}

/** 拉取设备列表并构建 id→名称映射 */
async function loadDeviceMap() {
  try {
    const result = await ApiService.getDevices({});
    const devices = Array.isArray(result) ? result : (result.items || result.data || []);
    const map = {};
    devices.forEach(d => { map[d.id] = d.title || d.name || `飞机#${d.id}`; });
    return map;
  } catch (error) {
    console.warn('[Editor] 拉取飞机列表失败（不影响编辑）:', error);
    return {};
  }
}

function setHeader() {
  const name = configDetail?.name || `配置#${configId}`;
  document.getElementById('editor-config-name').textContent = name;
  document.title = `参数编辑 - ${name} - Betaflight助手`;
  const subParts = [`配置 ID: ${configId}`, `所属飞机: ${deviceName || '未知'}`];
  if (cloudStructured) {
    subParts.push(`参数 ${countEditableKeys(cloudStructured)} 项`);
  }
  document.getElementById('editor-config-sub').textContent = subParts.join(' · ');
}

function bindToolbar() {
  document.getElementById('btn-save-local').addEventListener('click', handleSaveLocal);
  document.getElementById('btn-write-fc').addEventListener('click', handleWriteToFC);
  document.getElementById('btn-restore-draft').addEventListener('click', handleRestoreDraft);
  document.getElementById('btn-discard-draft').addEventListener('click', handleDiscardDraft);
}

// ==================== 渲染 ====================

function renderAll() {
  const container = document.getElementById('editor-sections');
  container.innerHTML = '';

  container.appendChild(buildSection('pid', buildPidRows));
  container.appendChild(buildSection('rates', buildRatesRows));
  container.appendChild(buildSection('filter', () => buildFlatRows('filter', FILTER_KEYS, FILTER_META)));
  container.appendChild(buildSection('motor', () => buildFlatRows('motor', MOTOR_KEYS, MOTOR_META)));

  // CLI 原始命令区（只读）
  const cliRaw = configDetail.cli_commands || '';
  if (cliRaw) {
    document.getElementById('cli-raw-pre').textContent = cliRaw;
  } else {
    document.getElementById('cli-raw-details').style.display = 'none';
  }
}

/**
 * 构建一个分区卡片
 * @param {string} section - 分区名
 * @param {function} rowsBuilder - 行构建函数，返回 HTMLElement[]
 */
function buildSection(section, rowsBuilder) {
  const card = document.createElement('div');
  card.className = 'editor-section';

  const title = document.createElement('h2');
  title.className = 'editor-section-title';
  title.textContent = SECTION_TITLES[section];
  card.appendChild(title);

  const table = document.createElement('table');
  table.className = 'editor-table';
  table.innerHTML = '<thead><tr><th style="width:22%">参数名称</th><th style="width:18%">当前值</th><th style="width:14%">取值范围</th><th>参数说明</th></tr></thead>';
  const tbody = document.createElement('tbody');
  rowsBuilder().forEach(row => tbody.appendChild(row));
  table.appendChild(tbody);
  card.appendChild(table);

  return card;
}

/** PID 区行：三轴分组 + 键行 */
function buildPidRows() {
  const rows = [];
  for (const axis of AXES) {
    const axisData = editedStructured.pid?.[axis];
    if (!axisData) continue;

    const groupRow = document.createElement('tr');
    groupRow.className = 'axis-group';
    const groupCell = document.createElement('td');
    groupCell.colSpan = 4;
    groupCell.textContent = AXIS_LABELS[axis];
    groupRow.appendChild(groupCell);
    rows.push(groupRow);

    for (const key of PID_KEYS) {
      if (axisData[key] === undefined) continue;
      rows.push(buildParamRow('pid', key, axis, axisData[key], PID_META[key], axis));
    }
  }
  return rows;
}

/** Rates 区行：三轴分组 + 油门附加 + mode 徽标 */
function buildRatesRows() {
  const rows = [];
  for (const axis of AXES) {
    const axisData = editedStructured.rates?.[axis];
    if (!axisData) continue;

    const groupRow = document.createElement('tr');
    groupRow.className = 'axis-group';
    const groupCell = document.createElement('td');
    groupCell.colSpan = 4;
    groupCell.textContent = AXIS_LABELS[axis];
    groupRow.appendChild(groupCell);
    rows.push(groupRow);

    for (const key of RATES_KEYS) {
      if (axisData[key] === undefined) continue;
      rows.push(buildParamRow('rates', key, axis, axisData[key], RATES_META[key], axis));
    }
  }

  const extra = editedStructured.rates || {};
  const extraKeys = RATES_EXTRA_KEYS.filter(k => extra[k] !== undefined);
  if (extraKeys.length) {
    const groupRow = document.createElement('tr');
    groupRow.className = 'axis-group';
    const groupCell = document.createElement('td');
    groupCell.colSpan = 4;
    groupCell.textContent = '油门附加设置';
    groupRow.appendChild(groupCell);
    rows.push(groupRow);

    for (const key of extraKeys) {
      rows.push(buildParamRow('rates', key, null, extra[key], RATES_EXTRA_META[key], null));
    }
  }

  // rates.mode 只读徽标（写回链路不消费）
  if (extra.mode !== undefined) {
    const title = document.createElement('span');
    title.className = 'editor-mode-badge';
    title.textContent = `Rates 模式: ${extra.mode}（只读）`;
    rows.push(wrapBadgeRow(title));
  }
  return rows;
}

function wrapBadgeRow(el) {
  const tr = document.createElement('tr');
  const td = document.createElement('td');
  td.colSpan = 4;
  td.appendChild(el);
  tr.appendChild(td);
  return tr;
}

/** 滤波器/电机等扁平分区行 */
function buildFlatRows(section, keys, meta) {
  const data = editedStructured[section] || {};
  const rows = [];
  for (const key of keys) {
    if (data[key] === undefined) continue;
    rows.push(buildParamRow(section, key, null, data[key], meta[key], null));
  }
  return rows;
}

/**
 * 构建单参数行：名称（含 CLI 参数名）/ 当前值输入框 / 取值范围 / 说明
 */
function buildParamRow(section, key, axis, value, meta, axisForCli) {
  const tr = document.createElement('tr');
  tr.dataset.section = section;
  if (axis) tr.dataset.axis = axis;
  tr.dataset.key = key;

  // 参数名称
  const nameTd = document.createElement('td');
  nameTd.className = 'editor-param-name';
  const nameText = axis ? `${meta.label}` : meta.label;
  nameTd.appendChild(document.createTextNode(nameText));
  const cliSpan = document.createElement('span');
  cliSpan.className = 'editor-param-cli';
  cliSpan.textContent = cliNameOf(section, key, axisForCli);
  nameTd.appendChild(cliSpan);
  tr.appendChild(nameTd);

  // 当前值输入框 + 校验错误位
  const valueTd = document.createElement('td');
  const input = document.createElement('input');
  input.type = 'number';
  input.className = 'editor-param-input';
  input.value = String(value);
  input.step = meta.step;
  input.min = meta.min;
  input.max = meta.max;
  input.dataset.section = section;
  input.dataset.key = key;
  if (axis) input.dataset.axis = axis;
  valueTd.appendChild(input);

  const errorEl = document.createElement('span');
  errorEl.className = 'editor-param-error';
  valueTd.appendChild(errorEl);
  tr.appendChild(valueTd);

  // 取值范围
  const rangeTd = document.createElement('td');
  rangeTd.className = 'editor-param-range';
  rangeTd.textContent = `${meta.min} – ${meta.max}${meta.unit ? ' ' + meta.unit : ''}`;
  tr.appendChild(rangeTd);

  // 参数说明
  const descTd = document.createElement('td');
  descTd.className = 'editor-param-desc';
  descTd.textContent = meta.desc;
  tr.appendChild(descTd);

  // 实时校验：input 事件即校验，合法值合并进 editedStructured（非法值不合并）
  input.addEventListener('input', () => {
    const result = validateParamValue(input.value, meta);
    if (result.ok) {
      input.classList.remove('invalid');
      errorEl.textContent = '';
      mergeEditedValue(section, key, axis, result.value);
    } else {
      input.classList.add('invalid');
      errorEl.textContent = result.error;
    }
    scheduleDraftSave();
  });

  return tr;
}

/** 将合法编辑值合并进 editedStructured */
function mergeEditedValue(section, key, axis, value) {
  if (axis) {
    if (!editedStructured[section][axis]) editedStructured[section][axis] = {};
    editedStructured[section][axis][key] = value;
  } else {
    editedStructured[section][key] = value;
  }
}

/** 可编辑键总数（不含 rates.mode） */
function countEditableKeys(structured) {
  let n = 0;
  for (const axis of AXES) {
    n += Object.keys(structured.pid?.[axis] || {}).length;
    n += Object.keys(structured.rates?.[axis] || {}).length;
  }
  for (const k of RATES_EXTRA_KEYS) {
    if (structured.rates?.[k] !== undefined) n++;
  }
  n += FILTER_KEYS.filter(k => structured.filter?.[k] !== undefined).length;
  n += MOTOR_KEYS.filter(k => structured.motor?.[k] !== undefined).length;
  return n;
}

// ==================== 校验 ====================

/**
 * 全量校验所有输入框（保存/写入前调用）
 * @returns {boolean} 是否全部合法；失败时定位并聚焦首个错误
 */
function validateAll() {
  const inputs = document.querySelectorAll('.editor-param-input');
  let firstInvalid = null;

  inputs.forEach(input => {
    const meta = metaForInput(input);
    if (!meta) return;
    const result = validateParamValue(input.value, meta);
    const errorEl = input.parentElement.querySelector('.editor-param-error');
    if (result.ok) {
      input.classList.remove('invalid');
      errorEl.textContent = '';
      mergeEditedValue(input.dataset.section, input.dataset.key, input.dataset.axis, result.value);
    } else {
      input.classList.add('invalid');
      errorEl.textContent = result.error;
      if (!firstInvalid) firstInvalid = input;
    }
  });

  if (firstInvalid) {
    firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
    firstInvalid.focus();
    appendLog('校验未通过，已阻断操作');
    showStatus('存在非法参数值，请修正后重试', 'error');
    return false;
  }
  return true;
}

/** 按 input 的 data 属性查元数据 */
function metaForInput(input) {
  const { section, key, axis } = input.dataset;
  if (!section || !key) return null;
  if (section === 'pid') return PID_META[key];
  if (section === 'rates') return RATES_META[key] || RATES_EXTRA_META[key];
  if (section === 'filter') return FILTER_META[key];
  if (section === 'motor') return MOTOR_META[key];
  return null;
}

// ==================== 本地保存（下载 + 草稿） ====================

async function handleSaveLocal() {
  if (!editedStructured) return;
  if (!validateAll()) return;

  const exportData = {
    type: 'bf-config-export',
    configId,
    name: configDetail?.name || `配置#${configId}`,
    deviceName,
    savedAt: new Date().toISOString(),
    structured: editedStructured,
    cliRaw: configDetail?.cli_commands || null
  };

  // 1) 下载 .json 文件（chrome.downloads，需 downloads 权限）
  try {
    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const safeName = (exportData.name).replace(/[\\/:*?"<>|]/g, '_');
    const filename = `bf-config-${safeName}-${new Date().toISOString().slice(0, 10)}.json`;
    const downloadId = await chrome.downloads.download({ url, filename, saveAs: true });
    URL.revokeObjectURL(url);
    if (downloadId !== undefined) {
      appendLog(`已保存到本地文件: ${filename}`);
      showStatus('已保存到本地文件', 'success');
    } else {
      appendLog('用户取消了保存对话框');
      showStatus('已取消保存（草稿仍保留修改）', 'info');
    }
  } catch (error) {
    console.error('[Editor] 下载失败:', error);
    if (String(error.message || error).toLowerCase().includes('cancel')) {
      appendLog('用户取消了保存对话框');
      showStatus('已取消保存（草稿仍保留修改）', 'info');
    } else {
      appendLog(`保存本地文件失败: ${error.message}`);
      showStatus(`保存失败: ${error.message}`, 'error');
    }
  }

  // 2) 同步写入本地草稿（无论下载是否取消，修改都进草稿）
  await saveDraft();
}

/** 立即保存草稿到 chrome.storage.local */
async function saveDraft() {
  if (!editedStructured) return;
  const key = draftKey();
  const payload = { structured: editedStructured, savedAt: new Date().toISOString() };
  try {
    await chrome.storage.local.set({ [key]: payload });
    appendLog('本地草稿已自动保存');
  } catch (error) {
    console.error('[Editor] 草稿保存失败:', error);
  }
}

/** 输入防抖保存草稿（800ms） */
function scheduleDraftSave() {
  clearTimeout(draftTimer);
  draftTimer = setTimeout(saveDraft, 800);
}

/** 草稿存储键 */
function draftKey() {
  return `bf-editor-draft-${configId}`;
}

/** 页面加载后检查是否有未应用草稿 */
async function checkDraft() {
  try {
    const result = await chrome.storage.local.get(draftKey());
    const draft = result[draftKey()];
    if (!draft || !draft.structured) return;

    if (JSON.stringify(draft.structured) === JSON.stringify(cloudStructured)) {
      // 草稿与云端一致（上次保存后未再编辑），无需提示
      return;
    }

    const banner = document.getElementById('draft-banner');
    const savedAt = new Date(draft.savedAt).toLocaleString();
    banner.textContent = `检测到未应用的本地草稿（保存于 ${savedAt}），可恢复或丢弃。`;
    banner.style.display = 'block';
    document.getElementById('btn-restore-draft').style.display = 'inline-block';
    document.getElementById('btn-discard-draft').style.display = 'inline-block';
    appendLog('检测到未应用的本地草稿');
  } catch (error) {
    console.error('[Editor] 草稿检查失败:', error);
  }
}

/** 恢复草稿 */
async function handleRestoreDraft() {
  try {
    const result = await chrome.storage.local.get(draftKey());
    const draft = result[draftKey()];
    if (!draft || !draft.structured) {
      showStatus('草稿不存在', 'error');
      return;
    }
    editedStructured = structuredClone(draft.structured);
    renderAll();
    hideDraftBanner();
    appendLog(`已恢复本地草稿（保存于 ${new Date(draft.savedAt).toLocaleString()}）`);
    showStatus('草稿已恢复', 'success');
  } catch (error) {
    console.error('[Editor] 恢复草稿失败:', error);
    showStatus(`恢复草稿失败: ${error.message}`, 'error');
  }
}

/** 丢弃草稿（回滚到云端数据） */
async function handleDiscardDraft() {
  try {
    await chrome.storage.local.remove(draftKey());
    editedStructured = structuredClone(cloudStructured);
    renderAll();
    hideDraftBanner();
    appendLog('已丢弃本地草稿，回滚到云端数据');
    showStatus('草稿已丢弃', 'info');
  } catch (error) {
    console.error('[Editor] 丢弃草稿失败:', error);
    showStatus(`丢弃草稿失败: ${error.message}`, 'error');
  }
}

function hideDraftBanner() {
  document.getElementById('draft-banner').style.display = 'none';
  document.getElementById('btn-restore-draft').style.display = 'none';
  document.getElementById('btn-discard-draft').style.display = 'none';
}

// ==================== 写入飞控（二次确认） ====================

async function handleWriteToFC() {
  if (!editedStructured) return;
  if (!validateAll()) return;

  const totalKeys = countEditableKeys(editedStructured);
  if (totalKeys === 0) {
    showStatus('没有可写入的参数', 'error');
    return;
  }

  // 二次确认弹窗（requirement 4：明确风险与影响范围，取消即终止）
  const confirmed = await showWriteConfirm(totalKeys);
  if (!confirmed) {
    appendLog('用户取消写入飞控');
    showStatus('已取消写入飞控操作', 'info');
    return;
  }

  appendLog(`确认写入飞控（${totalKeys} 项参数），开始检查连接...`);
  setButtonsDisabled(true);
  showStatus('正在检查飞控连接...', 'info');

  try {
    const connected = await ensureFCConnected();
    if (!connected) {
      setButtonsDisabled(false);
      return;
    }

    showStatus(`正在写入 ${totalKeys} 项参数到飞控（全量约需 15-90 秒，请勿关闭页面）...`, 'info');
    appendLog(`开始写入参数（${totalKeys} 项）...`);
    const response = await sendMessageToContent(MessageAction.AIRCRAFT_WRITE_TO_PAGE, {
      aircraft: editedStructured
    });

    if (response && response.success) {
      appendLog(`参数写入成功（${totalKeys} 项）`);
      showStatus(`参数写入成功（${totalKeys} 项）。注意：修改不会自动同步回云端配置记录。`, 'success');
    } else {
      const msg = extractError(response);
      appendLog(`参数写入失败: ${msg}`);
      showStatus(`写入失败: ${msg}`, 'error');
    }
  } catch (error) {
    console.error('[Editor] 写入飞控失败:', error);
    appendLog(`参数写入失败: ${error.message}`);
    showStatus(`写入失败: ${error.message}`, 'error');
  } finally {
    setButtonsDisabled(false);
  }
}

/**
 * 写入飞控二次确认弹窗
 * @param {number} totalKeys - 将写入的参数项数
 * @returns {Promise<boolean>} 用户是否确认
 */
function showWriteConfirm(totalKeys) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'editor-confirm-overlay';
    overlay.innerHTML = `
      <div class="editor-confirm-dialog">
        <h3 class="editor-confirm-title">写入飞控确认</h3>
        <p class="editor-confirm-message">即将把 ${totalKeys} 项参数写入飞控并逐页保存。

⚠ 风险提示：
· 该操作将直接覆盖飞控当前配置，影响飞行特性，存在炸机风险；
· 写入过程约需 15-90 秒，期间请勿断开 USB 或关闭页面；
· 本次修改不会自动同步回云端配置记录。

请确认当前环境安全（桨叶已拆除）后再继续。</p>
        <div class="editor-confirm-buttons">
          <button class="editor-button" id="editor-write-cancel">取消</button>
          <button class="editor-button danger" id="editor-write-ok">确认写入</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    // 默认焦点在「取消」，降低误触风险
    overlay.querySelector('#editor-write-cancel').focus();
    overlay.querySelector('#editor-write-cancel').addEventListener('click', () => {
      overlay.remove();
      resolve(false);
    });
    overlay.querySelector('#editor-write-ok').addEventListener('click', () => {
      overlay.remove();
      resolve(true);
    });
  });
}

/**
 * 检查飞控连接；未连接时触发页面连接按钮并提示（与 ConfigManager.ensureFCConnected 语义一致）
 * @returns {Promise<boolean>} 是否已连接
 */
async function ensureFCConnected() {
  const check = await sendMessageToContent(MessageAction.CHECK_FC_CONNECTION, null);
  if (check && check.success && check.data && check.data.connected) {
    return true;
  }
  // 未连接 → 触发 BF 页面连接按钮，由用户在页面完成端口选择后重试
  try {
    await sendMessageToContent(MessageAction.CLICK_CONNECT_BUTTON, null);
  } catch (error) {
    console.warn('[Editor] 触发连接按钮失败:', error);
  }
  appendLog('飞控未连接，已在 BF 页面触发连接按钮');
  showStatus('未检测到飞控连接，已在页面触发连接，请选择端口后重试写入', 'error');
  return false;
}

// ==================== 消息与工具 ====================

/** 向 Content Script 发送消息（编辑器页复用 background 转发链路） */
function sendMessageToContent(action, payload) {
  return new Promise((resolve, reject) => {
    const message = createMessage(MessageSource.POPUP, MessageTarget.CONTENT, action, payload);
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

/** 统一提取响应错误信息（automation-engine 的 error 可能是字符串） */
function extractError(response) {
  if (!response || !response.error) return '未知错误';
  if (typeof response.error === 'string') return response.error;
  return response.error.message || '未知错误';
}

/** 操作日志（可追溯性） */
function appendLog(text) {
  const list = document.getElementById('editor-log-list');
  if (!list) return;
  const item = document.createElement('div');
  item.className = 'editor-log-item';
  const time = document.createElement('time');
  time.textContent = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  item.appendChild(time);
  item.appendChild(document.createTextNode(text));
  list.insertBefore(item, list.firstChild);
}

/** 状态条提示 */
function showStatus(message, type = 'info') {
  const el = document.getElementById('editor-status');
  if (!el) return;
  el.textContent = message;
  el.className = `editor-status ${type}`;
  el.style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/** 操作期间禁用工具栏按钮，防止并发操作 */
function setButtonsDisabled(disabled) {
  ['btn-save-local', 'btn-write-fc'].forEach(id => {
    document.getElementById(id).disabled = disabled;
  });
}

document.addEventListener('DOMContentLoaded', init);
