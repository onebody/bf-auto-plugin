/**
 * 脚本管理模块 - 配置脚本单入口页面：查看模式（只读）⇄ 编辑模式（在线编辑）页内切换
 * 查看模式：语法高亮 + 行号 + 内容搜索，完整可读
 * 编辑模式：行级语法校验 + 自动保存（防抖）+ 版本历史（查看/回滚），仅配置创建者（coach 本人）可进入
 * 由 ConfigManager 负责视图显隐编排（钻取体系内），本模块负责内容逻辑与模式切换
 * @module popup/modules/script-manager
 */

import { ApiService } from '../../shared/api-service.js';
import { showStatus, showConfirm } from '../popup.js';
import {
  structuredToScript, parseParamScript, applyScriptSets
} from '../../editor/param-metadata.js';
import { extraFromUnknown } from '../../editor/script-schema.js';

const AUTO_SAVE_DELAY = 1500; // 自动保存防抖（毫秒）

/**
 * 脚本管理模块
 */
export const ScriptManager = {
  currentUser: null, // 当前登录用户（含 id，用于 coach_id 权限比对）

  /**
   * 初始化（元素获取 + 事件绑定）
   */
  init() {
    console.log('[ScriptManager] 初始化（v2.0.0 - 脚本单入口：查看/编辑模式切换 + 版本历史 + 权限控制）');

    // 页面公共元素
    this.viewTitle = document.getElementById('script-view-title');
    this.viewMeta = document.getElementById('script-view-meta');
    this.viewPane = document.getElementById('script-view-pane'); // 查看模式区
    this.editPane = document.getElementById('script-edit-pane'); // 编辑模式区
    this.btnToggleMode = document.getElementById('btn-toggle-script-mode');

    // 查看模式元素
    this.viewGutter = document.getElementById('script-view-gutter');
    this.viewCode = document.getElementById('script-view-code');
    this.searchInput = document.getElementById('script-search-input');
    this.searchCount = document.getElementById('script-search-count');
    this.btnSearchPrev = document.getElementById('btn-script-search-prev');
    this.btnSearchNext = document.getElementById('btn-script-search-next');

    // 编辑模式元素
    this.editTa = document.getElementById('script-edit-ta');
    this.editSaveState = document.getElementById('script-edit-save-state');
    this.editDiag = document.getElementById('script-edit-diagnostics');
    this.btnToggleVersions = document.getElementById('btn-toggle-versions');
    this.versionsPanel = document.getElementById('script-versions-panel');
    this.versionsList = document.getElementById('script-versions-list');

    // 代码区滚动 → 行号同步
    if (this.viewCode) {
      this.viewCode.addEventListener('scroll', () => {
        if (this.viewGutter) this.viewGutter.scrollTop = this.viewCode.scrollTop;
      });
    }

    // 搜索：输入即搜 + 上一个/下一个
    if (this.searchInput) {
      this.searchInput.addEventListener('input', () => this.runSearch());
    }
    if (this.btnSearchPrev) {
      this.btnSearchPrev.addEventListener('click', () => this.jumpSearch(-1));
    }
    if (this.btnSearchNext) {
      this.btnSearchNext.addEventListener('click', () => this.jumpSearch(1));
    }

    // 查看 ⇄ 编辑模式切换（入口可见性由 open() 按创建者权限控制）
    if (this.btnToggleMode) {
      this.btnToggleMode.addEventListener('click', () => this.toggleMode());
    }

    // 版本历史面板开关
    if (this.btnToggleVersions) {
      this.btnToggleVersions.addEventListener('click', () => this.toggleVersions());
    }

    // 编辑器输入：即时校验 + 防抖自动保存
    if (this.editTa) {
      this.editTa.addEventListener('input', () => this.onEditorInput());
    }
  },

  /**
   * 设置当前用户（popup.js 登录态变化时调用）
   * @param {object|null} user - 用户对象（需含 id）
   */
  setCurrentUser(user) {
    this.currentUser = user;
  },

  /**
   * 编辑权限判定：配置创建者（coach_id）=== 当前登录用户 id
   * @param {object} data - 配置详情（ConfigFileResponse，含 coach_id）
   * @returns {boolean}
   */
  canEdit(data) {
    return !!(
      this.currentUser &&
      this.currentUser.id !== undefined &&
      this.currentUser.id !== null &&
      data && data.coach_id !== undefined && data.coach_id !== null &&
      Number(data.coach_id) === Number(this.currentUser.id)
    );
  },

  // ==================== 脚本页（单入口：查看/编辑模式） ====================

  /**
   * 打开脚本页（默认进入查看模式；编辑模式入口按创建者权限显隐）
   * 视图显隐由 ConfigManager 负责
   * @param {object} config - 配置对象（列表精简数据）
   */
  async open(config) {
    // 复位上一状态
    if (this.saveTimer) { clearTimeout(this.saveTimer); this.saveTimer = null; }
    this.saving = false;
    if (this.versionsPanel) this.versionsPanel.style.display = 'none';
    this.setSaveState('');

    const data = await this.loadDetail(config, 'script-view-status');
    if (!data) return;
    this.current = { config, data };

    const canEdit = this.canEdit(data);
    this.hasParams = !!(data.params_json && typeof data.params_json === 'object');
    this.editReadOnly = !canEdit;
    this.baseParams = JSON.parse(JSON.stringify(data.params_json || {})); // 校验/应用基准（只读副本）
    this.lastSavedText = structuredToScript(data.params_json || {});      // 与云端一致的基线文本
    this.lastSavedVersion = data.current_version;

    if (this.editTa) {
      this.editTa.value = this.lastSavedText;
      this.editTa.readOnly = this.editReadOnly;
    }

    this.renderMeta(this.viewMeta, data, canEdit);

    // 编辑模式入口：仅创建者本人且存在参数数据时可见
    if (this.btnToggleMode) {
      this.btnToggleMode.style.display = (canEdit && this.hasParams) ? '' : 'none';
    }
    if (!this.hasParams) {
      showStatus('script-view-status', '该配置暂无参数数据，无法编辑。请先在「新建配置」中完成「读取参数」CLI 导出。', 'info');
    }

    this.enterViewMode();
  },

  /**
   * 查看 ⇄ 编辑模式切换
   */
  async toggleMode() {
    if (!this.current) return;
    if (this.mode === 'edit') {
      await this.exitEditMode();
    } else {
      this.enterEditMode();
    }
  },

  /**
   * 进入查看模式（渲染高亮代码 + 搜索工具条，隐藏编辑区）
   */
  enterViewMode() {
    this.mode = 'view';
    if (this.viewPane) this.viewPane.style.display = 'block';
    if (this.editPane) this.editPane.style.display = 'none';
    if (this.btnToggleVersions) this.btnToggleVersions.style.display = 'none';
    if (this.versionsPanel) this.versionsPanel.style.display = 'none';
    if (this.btnToggleMode) this.btnToggleMode.textContent = '编辑模式';
    if (this.viewTitle) this.viewTitle.textContent = '脚本查看';

    // 重置搜索状态（查看/编辑往返后重新搜索）
    this.searchMarks = [];
    this.searchIndex = -1;
    if (this.searchInput) this.searchInput.value = '';
    if (this.searchCount) this.searchCount.textContent = '';

    // 渲染代码：编辑器文本优先（未保存的最新草稿也可见）
    const script = (this.editTa && this.editTa.value)
      || structuredToScript((this.current && this.current.data.params_json) || {});
    this.renderCode(script);
  },

  /**
   * 进入编辑模式（入口仅创建者可见，非创建者无法到达）
   */
  enterEditMode() {
    if (!this.current || this.editReadOnly) return;
    this.mode = 'edit';
    if (this.viewPane) this.viewPane.style.display = 'none';
    if (this.editPane) this.editPane.style.display = 'block';
    if (this.btnToggleVersions) this.btnToggleVersions.style.display = '';
    if (this.btnToggleMode) this.btnToggleMode.textContent = '查看模式';
    if (this.viewTitle) this.viewTitle.textContent = '脚本编辑';
    this.validateEditor(); // 初始校验（历史数据可能已越界）
  },

  /**
   * 退出编辑模式回到查看：先冲刷防抖中的未保存修改（校验通过才保存）
   */
  async exitEditMode() {
    if (this.saveTimer) { clearTimeout(this.saveTimer); this.saveTimer = null; }
    const text = this.editTa ? this.editTa.value : '';
    if (!this.editReadOnly && !this.saving && text !== this.lastSavedText) {
      const result = this.validateEditor();
      if (result.ok) await this.autoSave();
    }
    this.enterViewMode();
  },

  /**
   * 渲染元信息行
   * @param {HTMLElement} el - 元信息容器
   * @param {object} data - 配置详情
   * @param {boolean} canEdit - 当前用户是否可编辑
   */
  renderMeta(el, data, canEdit) {
    if (!el) return;
    const parts = [
      data.param_category || '未设置分类',
      `v${data.current_version}`,
      canEdit ? '创建者本人（可编辑）' : `创建者 #${data.coach_id}（只读）`
    ];
    if (data.updated_at) parts.push(`更新于 ${new Date(data.updated_at).toLocaleString()}`);
    el.textContent = parts.join(' | ');
  },

  /**
   * 渲染只读代码区（逐行构建 DOM，含语法高亮 token；内容源为纯文本，安全）
   * @param {string} script - 脚本文本
   */
  renderCode(script) {
    if (!this.viewCode || !this.viewGutter) return;
    this.viewCode.textContent = '';
    this.viewGutter.textContent = '';

    const lines = String(script).replace(/\n$/, '').split('\n');
    lines.forEach((raw, i) => {
      // 行号
      const no = document.createElement('div');
      no.textContent = String(i + 1);
      this.viewGutter.appendChild(no);

      // 代码行（token 上色）
      const lineEl = document.createElement('div');
      lineEl.appendChild(this.buildLineFragment(raw));
      this.viewCode.appendChild(lineEl);
    });
  },

  /**
   * 单行语法高亮：set <名> = <值> 分词上色，# 注释整行灰
   * @param {string} raw - 原始行文本
   * @returns {DocumentFragment}
   */
  buildLineFragment(raw) {
    const frag = document.createDocumentFragment();
    const appendToken = (text, cls) => {
      const span = document.createElement('span');
      if (cls) span.className = cls;
      span.textContent = text;
      frag.appendChild(span);
    };

    const trimmed = raw.trim();
    if (trimmed.startsWith('#')) {
      appendToken(raw, 'tok-comment');
      return frag;
    }

    const m = raw.match(/^(\s*)(set\s+)(\S+)(\s*=\s*)(.+)$/);
    if (m) {
      appendToken(m[1]);
      appendToken(m[2], 'tok-kw');
      appendToken(m[3], 'tok-name');
      appendToken(m[4], 'tok-op');
      appendToken(m[5], 'tok-value');
    } else {
      appendToken(raw, 'tok-other');
    }
    return frag;
  },

  // ==================== 查看页内容搜索 ====================

  /**
   * 执行搜索：遍历代码区文本节点，命中处插入 <mark>，统计并跳到第一个
   */
  runSearch() {
    this.clearSearchMarks();
    this.searchIndex = -1;
    const query = (this.searchInput ? this.searchInput.value : '').trim();
    if (!query || !this.viewCode) {
      if (this.searchCount) this.searchCount.textContent = '';
      return;
    }

    const lower = query.toLowerCase();
    const walker = document.createTreeWalker(this.viewCode, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    this.searchMarks = [];
    nodes.forEach(node => {
      const text = node.nodeValue;
      const lowerText = text.toLowerCase();
      let pos = lowerText.indexOf(lower);
      if (pos < 0) return;

      const frag = document.createDocumentFragment();
      let last = 0;
      while (pos >= 0) {
        if (pos > last) frag.appendChild(document.createTextNode(text.slice(last, pos)));
        const mark = document.createElement('mark');
        mark.className = 'sr-hit';
        mark.textContent = text.slice(pos, pos + query.length);
        frag.appendChild(mark);
        this.searchMarks.push(mark);
        last = pos + query.length;
        pos = lowerText.indexOf(lower, last);
      }
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      node.parentNode.replaceChild(frag, node);
    });

    this.updateSearchCount();
    if (this.searchMarks.length) this.jumpSearch(0);
  },

  /**
   * 上一个/下一个命中跳转
   * @param {number} dir - -1 上一个 / 1 下一个（0 表示跳到当前）
   */
  jumpSearch(dir) {
    if (!this.searchMarks || !this.searchMarks.length) return;
    if (this.searchIndex >= 0 && this.searchMarks[this.searchIndex]) {
      this.searchMarks[this.searchIndex].classList.remove('current');
    }
    const len = this.searchMarks.length;
    this.searchIndex = dir === 0
      ? (this.searchIndex < 0 ? 0 : this.searchIndex)
      : (this.searchIndex + dir + len) % len;
    const mark = this.searchMarks[this.searchIndex];
    mark.classList.add('current');
    mark.scrollIntoView({ block: 'center' });
    this.updateSearchCount();
  },

  /**
   * 更新命中计数显示（x/y）
   */
  updateSearchCount() {
    if (!this.searchCount) return;
    const len = this.searchMarks ? this.searchMarks.length : 0;
    this.searchCount.textContent = len
      ? `${this.searchIndex + 1}/${len}`
      : '0/0';
  },

  /**
   * 清除全部搜索高亮 mark（还原为纯文本节点）
   */
  clearSearchMarks() {
    if (!this.searchMarks) return;
    this.searchMarks.forEach(mark => {
      const parent = mark.parentNode; // replaceChild 后 mark 已脱离文档，先取父节点
      if (!parent) return;
      parent.replaceChild(document.createTextNode(mark.textContent), mark);
      parent.normalize(); // 合并相邻文本节点
    });
    this.searchMarks = [];
  },

  // ==================== 脚本编辑模式 ====================

  /**
   * 编辑器输入处理：即时校验 + 防抖自动保存
   */
  onEditorInput() {
    if (this.editReadOnly) return;
    const result = this.validateEditor();
    if (this.saveTimer) { clearTimeout(this.saveTimer); this.saveTimer = null; }

    if (!result.ok) {
      this.setSaveState('存在校验错误，已暂停自动保存', 'blocked');
      return;
    }
    const text = this.editTa.value;
    if (text === this.lastSavedText) {
      this.setSaveState('');
      return;
    }
    this.setSaveState('编辑中，稍后自动保存...', 'saving');
    this.saveTimer = setTimeout(() => this.autoSave(), AUTO_SAVE_DELAY);
  },

  /**
   * 行级语法校验：未识别参数=info 透传保存（不阻断，与参数编辑弹窗语义一致）；值非法=错误（阻断自动保存）
   * @returns {{ok: boolean, errors: Array, infos: Array, appliedCount: number, structured: object|null}}
   */
  validateEditor() {
    const text = this.editTa.value;
    // name → 末次出现行号（apply 语义为后者覆盖，定位到生效行）
    const lineOf = {};
    String(text).split(/\r?\n/).forEach((raw, i) => {
      const m = raw.trim().match(/^set\s+(\S+)\s*=/);
      if (m) lineOf[m[1]] = i + 1;
    });

    const { sets, unknown } = parseParamScript(text);
    const probe = JSON.parse(JSON.stringify(this.baseParams || {}));
    const { applied, failed } = applyScriptSets(sets, probe);
    // 未识别参数透传保存：extra 覆盖式重建（脚本为唯一事实来源，与弹窗 applyScriptToEdited 一致）
    probe.extra = extraFromUnknown(unknown);

    const errors = failed.map(f => ({
      level: 'error',
      text: `第 ${lineOf[f.name] || '?'} 行：${f.name} = ${f.value} 校验失败（${f.reason}）`
    }));
    const infos = unknown.map(u => ({
      level: 'info',
      text: `第 ${u.line} 行：未识别参数 "${u.name}"（将透传保存）`
    }));

    const result = {
      ok: errors.length === 0,
      errors,
      infos,
      appliedCount: applied.length,
      // 有已知合法项或透传项即可保存（结构化四区沿用基线，脚本未覆盖的键保持不变）
      structured: (applied.length > 0 || unknown.length > 0) ? probe : null
    };

    const notes = [...errors, ...infos];
    let summary;
    if (errors.length) {
      summary = `${errors.length} 处校验错误，${infos.length} 项透传`;
    } else if (infos.length) {
      summary = `语法校验通过（${applied.length} 项参数，${infos.length} 项透传保存）`;
    } else {
      summary = `语法校验通过（${applied.length} 项参数）`;
    }
    this.renderDiag(notes, summary);
    return result;
  },

  /**
   * 渲染行级诊断列表
   * @param {Array<{level:string,text:string}>} notes - 诊断项
   * @param {string} summary - 摘要行
   */
  renderDiag(notes, summary) {
    if (!this.editDiag) return;
    this.editDiag.textContent = '';
    if (summary) {
      const head = document.createElement('div');
      head.className = notes.some(n => n.level === 'error') ? 'diag-error'
        : notes.some(n => n.level === 'warn') ? 'diag-warn' : 'diag-ok';
      head.textContent = summary;
      this.editDiag.appendChild(head);
    }
    notes.forEach(n => {
      const item = document.createElement('div');
      item.className = n.level === 'error' ? 'diag-error'
        : n.level === 'info' ? 'diag-info' : 'diag-warn';
      item.textContent = n.text;
      this.editDiag.appendChild(item);
    });
  },

  /**
   * 自动保存：应用脚本到结构化参数 → updateConfigFile（云端生成新版本）
   * 仅在无校验错误且内容有实际变化时触发（由 onEditorInput 保证）
   */
  async autoSave() {
    if (this.editReadOnly || this.saving || !this.current) return;
    const result = this.validateEditor();
    const text = this.editTa.value;

    if (!result.ok || text === this.lastSavedText) return;
    if (!result.structured) {
      this.setSaveState('无可保存的参数（脚本为空或全部无效）', 'blocked');
      return;
    }

    this.saving = true;
    this.setSaveState('自动保存中...', 'saving');
    try {
      const resp = await ApiService.updateConfigFile(this.current.config.id, {
        params_json: result.structured,
        note: '脚本编辑自动保存'
      });
      const saved = resp && resp.data ? resp.data : resp;
      this.lastSavedText = text;
      if (saved && saved.current_version !== undefined) {
        this.lastSavedVersion = saved.current_version;
        this.current.data.current_version = saved.current_version;
      }
      if (this.current.data) this.current.data.updated_at = new Date().toISOString();
      const ver = this.lastSavedVersion !== undefined ? `v${this.lastSavedVersion}` : '';
      this.setSaveState(`已自动保存 ${ver} ${new Date().toLocaleTimeString()}`, 'saved');
      this.renderMeta(this.viewMeta, this.current.data, true);
      if (this.versionsPanel && this.versionsPanel.style.display !== 'none') {
        this.loadVersions(); // 面板打开中 → 刷新版本列表
      }
    } catch (error) {
      console.error('[ScriptManager] 自动保存失败:', error);
      this.setSaveState(`自动保存失败: ${error.message}（修改内容已保留，可继续编辑）`, 'blocked');
    } finally {
      this.saving = false;
      // 保存期间又有新输入 → 补一次保存
      if (this.editTa && this.editTa.value !== this.lastSavedText && this.validateEditor().ok) {
        this.saveTimer = setTimeout(() => this.autoSave(), AUTO_SAVE_DELAY);
      }
    }
  },

  /**
   * 更新自动保存状态行
   * @param {string} msg - 状态文本
   * @param {string} [cls] - saving/saved/blocked
   */
  setSaveState(msg, cls) {
    if (!this.editSaveState) return;
    this.editSaveState.textContent = msg;
    this.editSaveState.className = cls || '';
  },

  // ==================== 版本历史 ====================

  /**
   * 展开/收起版本历史面板
   */
  toggleVersions() {
    if (!this.versionsPanel) return;
    const show = this.versionsPanel.style.display === 'none';
    this.versionsPanel.style.display = show ? 'block' : 'none';
    if (show) this.loadVersions();
  },

  /**
   * 加载并渲染版本历史列表（新→旧）
   */
  async loadVersions() {
    if (!this.current || !this.versionsList) return;
    this.versionsList.textContent = '加载中...';
    try {
      const result = await ApiService.getConfigVersions(this.current.config.id);
      const versions = Array.isArray(result) ? result : (result.items || result.data || []);
      this.versionsList.textContent = '';
      if (!versions.length) {
        this.versionsList.innerHTML = '<div class="bf-plugin-empty">暂无版本记录</div>';
        return;
      }
      versions
        .sort((a, b) => b.version - a.version)
        .forEach(v => this.versionsList.appendChild(this.createVersionItem(v)));
    } catch (error) {
      console.error('[ScriptManager] 加载版本历史失败:', error);
      this.versionsList.textContent = '';
      this.versionsList.innerHTML = `<div class="bf-plugin-empty">加载失败: ${error.message}</div>`;
    }
  },

  /**
   * 创建版本历史条目（版本号 + 备注 + 时间 + 查看/回滚）
   * @param {object} v - 版本摘要（ConfigVersionSummaryResponse）
   * @returns {HTMLElement}
   */
  createVersionItem(v) {
    const item = document.createElement('div');
    item.className = 'bf-plugin-version-item';

    const no = document.createElement('span');
    no.className = 'ver-no';
    no.textContent = `v${v.version}`;

    const note = document.createElement('span');
    note.className = 'ver-note';
    note.textContent = v.note || '（无备注）';
    note.title = v.note || '';

    const time = document.createElement('span');
    time.className = 'ver-time';
    time.textContent = v.created_at ? new Date(v.created_at).toLocaleString() : '';

    const viewBtn = document.createElement('button');
    viewBtn.className = 'bf-plugin-button small';
    viewBtn.textContent = '查看';
    viewBtn.addEventListener('click', () => this.viewVersionDetail(v, item));

    const restoreBtn = document.createElement('button');
    restoreBtn.className = 'bf-plugin-button small primary';
    restoreBtn.textContent = '回滚';
    if (this.editReadOnly) {
      restoreBtn.disabled = true;
      restoreBtn.title = '无编辑权限，无法回滚';
    } else {
      restoreBtn.addEventListener('click', () => this.restoreVersion(v));
    }

    item.appendChild(no);
    item.appendChild(note);
    item.appendChild(time);
    item.appendChild(viewBtn);
    item.appendChild(restoreBtn);
    return item;
  },

  /**
   * 查看/收起某版本快照内容（行内展开，同款高亮渲染）
   * @param {object} v - 版本摘要
   * @param {HTMLElement} item - 条目元素
   */
  async viewVersionDetail(v, item) {
    // 已展开 → 收起
    const existed = item.nextElementSibling;
    if (existed && existed.classList.contains('bf-plugin-version-detail')) {
      existed.remove();
      return;
    }
    // 先收起其他展开项
    this.versionsList.querySelectorAll('.bf-plugin-version-detail').forEach(el => el.remove());

    const detail = document.createElement('div');
    detail.className = 'bf-plugin-version-detail';
    detail.textContent = '加载中...';
    item.parentNode.insertBefore(detail, item.nextElementSibling);

    try {
      const resp = await ApiService.getConfigVersionDetail(this.current.config.id, v.version);
      const data = resp && resp.data ? resp.data : resp;
      detail.textContent = '';
      const pre = document.createElement('div');
      if (!data || !data.params_json || typeof data.params_json !== 'object') {
        pre.textContent = '该版本无参数数据';
      } else {
        structuredToScript(data.params_json).replace(/\n$/, '').split('\n').forEach(raw => {
          const lineEl = document.createElement('div');
          lineEl.appendChild(this.buildLineFragment(raw));
          pre.appendChild(lineEl);
        });
      }
      detail.appendChild(pre);
    } catch (error) {
      console.error('[ScriptManager] 加载版本详情失败:', error);
      detail.textContent = `加载失败: ${error.message}`;
    }
  },

  /**
   * 回滚到指定版本（二次确认 → restore → 重载编辑器与元信息）
   * @param {object} v - 版本摘要
   */
  async restoreVersion(v) {
    if (!this.current) return;
    const confirmed = await showConfirm('回滚版本',
      `确定将配置 "${this.current.config.name}" 回滚到 v${v.version} 吗？回滚会生成新版本快照。`);
    if (!confirmed) return;

    showStatus('script-view-status', '回滚中...', 'info');
    try {
      await ApiService.restoreConfigVersion(this.current.config.id, v.version, `回滚到 v${v.version}`);
      // 重载详情并刷新编辑器内容
      const data = await this.loadDetail(this.current.config, 'script-view-status');
      if (data) {
        this.current.data = data;
        this.baseParams = JSON.parse(JSON.stringify(data.params_json || {}));
        this.lastSavedText = structuredToScript(data.params_json || {});
        this.lastSavedVersion = data.current_version;
        if (this.editTa) this.editTa.value = this.lastSavedText;
        this.renderMeta(this.viewMeta, data, this.canEdit(data));
        if (!this.editReadOnly) this.validateEditor();
      }
      this.loadVersions();
      showStatus('script-view-status', `已回滚到 v${v.version}`, 'success');
    } catch (error) {
      console.error('[ScriptManager] 回滚失败:', error);
      showStatus('script-view-status', `回滚失败: ${error.message}`, 'error');
    }
  },

  // ==================== 公共 ====================

  /**
   * 拉取配置详情（含 params_json / coach_id / current_version）
   * @param {object} config - 配置对象
   * @param {string} statusEl - 状态提示元素 ID
   * @returns {Promise<object|null>} 详情对象（失败返回 null）
   */
  async loadDetail(config, statusEl) {
    try {
      showStatus(statusEl, '正在加载配置详情...', 'info');
      const detail = await ApiService.getConfigFileById(config.id);
      const data = detail && detail.data ? detail.data : detail;
      if (!data) throw new Error('配置不存在或已被删除');
      return data;
    } catch (error) {
      console.error('[ScriptManager] 加载配置详情失败:', error);
      showStatus(statusEl, `加载失败: ${error.message}`, 'error');
      return null;
    }
  }
};
