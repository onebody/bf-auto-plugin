/**
 * 预设列表组件
 * @module popup/components/preset-list
 */

/**
 * 预设列表组件类
 */
export class PresetList {
  /**
   * 构造函数
   * @param {HTMLElement} container - 列表容器元素
   * @param {object} options - 配置选项
   */
  constructor(container, options = {}) {
    this.container = container;
    this.options = options;
    this.presets = [];
  }

  /**
   * 渲染预设列表
   * @param {object[]} presets - 预设数组
   */
  render(presets) {
    this.presets = presets;
    this.container.innerHTML = '';

    if (!presets || presets.length === 0) {
      this.container.innerHTML = '<div class="bf-plugin-empty">暂无预设，请先保存预设</div>';
      return;
    }

    presets.forEach(preset => {
      const item = this.createListItem(preset);
      this.container.appendChild(item);
    });
  }

  /**
   * 创建列表项
   * @param {object} preset - 预设对象
   * @returns {HTMLElement} 列表项元素
   */
  createListItem(preset) {
    const item = document.createElement('div');
    item.className = 'bf-plugin-list-item';

    // 头部
    const header = document.createElement('div');
    header.className = 'bf-plugin-list-item-header';

    const title = document.createElement('span');
    title.className = 'bf-plugin-list-item-title';
    title.textContent = preset.title;
    header.appendChild(title);

    const actions = document.createElement('div');
    actions.className = 'bf-plugin-list-item-actions';

    // 应用按钮
    const applyBtn = document.createElement('button');
    applyBtn.className = 'bf-plugin-list-item-action';
    applyBtn.textContent = '应用';
    applyBtn.style.color = '#4CAF50';
    applyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.options.onApply) {
        this.options.onApply(preset);
      }
    });
    actions.appendChild(applyBtn);

    // 编辑按钮
    const editBtn = document.createElement('button');
    editBtn.className = 'bf-plugin-list-item-action edit';
    editBtn.textContent = '编辑';
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.options.onEdit) {
        this.options.onEdit(preset);
      }
    });
    actions.appendChild(editBtn);

    // 删除按钮
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'bf-plugin-list-item-action delete';
    deleteBtn.textContent = '删除';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.options.onDelete) {
        this.options.onDelete(preset);
      }
    });
    actions.appendChild(deleteBtn);

    header.appendChild(actions);
    item.appendChild(header);

    // 描述
    const desc = document.createElement('div');
    desc.className = 'bf-plugin-list-item-desc';
    desc.textContent = `${preset.param_category || '未分类'} | ${preset.usage_scope || '通用'}`;
    item.appendChild(desc);

    // 点击选中
    item.addEventListener('click', () => {
      if (this.options.onSelect) {
        this.options.onSelect(preset);
      }
    });

    return item;
  }
}
