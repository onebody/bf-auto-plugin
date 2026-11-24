/**
 * 配置列表组件
 * @module popup/components/config-list
 */

/**
 * 配置列表组件类
 */
export class ConfigList {
  /**
   * 构造函数
   * @param {HTMLElement} container - 列表容器元素
   * @param {object} options - 配置选项
   * @param {function} options.onEditParams - 参数编辑回调
   * @param {function} options.onScript - 脚本页回调（单入口：查看/编辑页内切换）
   * @param {function} options.onWrite - 写入飞控回调
   * @param {function} options.onRename - 改名回调
   * @param {function} options.onDelete - 删除回调
   */
  constructor(container, options = {}) {
    this.container = container;
    this.options = options;
    this.configs = [];
  }

  /**
   * 渲染配置列表
   * @param {object[]} configs - 配置数组（精简响应，不含大字段）
   */
  render(configs) {
    this.configs = configs || [];
    this.container.innerHTML = '';

    if (!this.configs || this.configs.length === 0) {
      this.container.innerHTML = '<div class="bf-plugin-empty">暂无配置，点击「新建配置」创建</div>';
      return;
    }

    this.configs.forEach(config => {
      this.container.appendChild(this.createListItem(config));
    });
  }

  /**
   * 创建列表项
   * @param {object} config - 配置对象
   * @returns {HTMLElement} 列表项元素
   */
  createListItem(config) {
    const item = document.createElement('div');
    item.className = 'bf-plugin-list-item';

    // 头部（标题 + 操作按钮）
    const header = document.createElement('div');
    header.className = 'bf-plugin-list-item-header';

    const title = document.createElement('span');
    title.className = 'bf-plugin-list-item-title';
    title.textContent = config.name;
    header.appendChild(title);

    const actions = document.createElement('div');
    actions.className = 'bf-plugin-list-item-actions';

    // 参数编辑按钮（弹窗内在线编辑参数）
    const editParamsBtn = document.createElement('button');
    editParamsBtn.className = 'bf-plugin-list-item-action edit-params';
    editParamsBtn.textContent = '参数编辑';
    editParamsBtn.style.color = '#3498db';
    editParamsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.options.onEditParams) {
        this.options.onEditParams(config);
      }
    });
    actions.appendChild(editParamsBtn);

    // 脚本按钮（单入口：进入脚本页，页内按创建者权限切换查看/编辑模式）
    const scriptBtn = document.createElement('button');
    scriptBtn.className = 'bf-plugin-list-item-action script';
    scriptBtn.textContent = '脚本';
    scriptBtn.style.color = '#16a085';
    scriptBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.options.onScript) {
        this.options.onScript(config);
      }
    });
    actions.appendChild(scriptBtn);

    // 写入飞控按钮
    const writeBtn = document.createElement('button');
    writeBtn.className = 'bf-plugin-list-item-action';
    writeBtn.textContent = '写入飞控';
    writeBtn.style.color = '#4CAF50';
    writeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.options.onWrite) {
        this.options.onWrite(config);
      }
    });
    actions.appendChild(writeBtn);

    // 改名按钮
    const renameBtn = document.createElement('button');
    renameBtn.className = 'bf-plugin-list-item-action edit';
    renameBtn.textContent = '改名';
    renameBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.options.onRename) {
        this.options.onRename(config);
      }
    });
    actions.appendChild(renameBtn);

    // 删除按钮
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'bf-plugin-list-item-action delete';
    deleteBtn.textContent = '删除';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.options.onDelete) {
        this.options.onDelete(config);
      }
    });
    actions.appendChild(deleteBtn);

    header.appendChild(actions);
    item.appendChild(header);

    // 描述信息（分类 / 版本 / 生效状态 / 更新时间）
    const desc = document.createElement('div');
    desc.className = 'bf-plugin-list-item-desc';
    const parts = [
      config.param_category || '未设置分类',
      `v${config.current_version}`
    ];
    if (config.is_active) {
      parts.push('生效中');
    }
    parts.push(`更新于 ${new Date(config.updated_at).toLocaleDateString()}`);
    desc.textContent = parts.join(' | ');
    item.appendChild(desc);

    return item;
  }
}
