/**
 * 飞手列表组件
 * @module popup/components/pilot-list
 */

/**
 * 飞手列表组件类
 */
export class PilotList {
  /**
   * 构造函数
   * @param {HTMLElement} container - 列表容器元素
   * @param {object} options - 配置选项
   * @param {function} options.onSelect - 选中回调
   * @param {function} options.onEdit - 编辑回调
   * @param {function} options.onDelete - 删除回调
   */
  constructor(container, options = {}) {
    this.container = container;
    this.options = options;
    this.pilots = [];
    this.activeId = null;
  }

  /**
   * 渲染飞手列表
   * @param {object[]} pilots - 飞手数组
   */
  render(pilots) {
    this.pilots = pilots;
    this.container.innerHTML = '';

    if (!pilots || pilots.length === 0) {
      this.container.innerHTML = '<div class="bf-plugin-empty">暂无飞手，请添加</div>';
      return;
    }

    pilots.forEach(pilot => {
      const item = this.createListItem(pilot);
      this.container.appendChild(item);
    });
  }

  /**
   * 创建列表项
   * @param {object} pilot - 飞手对象
   * @returns {HTMLElement} 列表项元素
   */
  createListItem(pilot) {
    const item = document.createElement('div');
    item.className = 'bf-plugin-list-item';
    if (pilot.id === this.activeId) {
      item.classList.add('active');
    }

    // 头部（标题 + 操作按钮）
    const header = document.createElement('div');
    header.className = 'bf-plugin-list-item-header';

    const title = document.createElement('span');
    title.className = 'bf-plugin-list-item-title';
    title.textContent = pilot.name;
    header.appendChild(title);

    const actions = document.createElement('div');
    actions.className = 'bf-plugin-list-item-actions';

    // 编辑按钮
    const editBtn = document.createElement('button');
    editBtn.className = 'bf-plugin-list-item-action edit';
    editBtn.textContent = '编辑';
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.options.onEdit) {
        this.options.onEdit(pilot);
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
        this.options.onDelete(pilot);
      }
    });
    actions.appendChild(deleteBtn);

    header.appendChild(actions);
    item.appendChild(header);

    // 描述信息
    const desc = document.createElement('div');
    desc.className = 'bf-plugin-list-item-desc';
    desc.textContent = `${pilot.phone || '无电话'} | ${pilot.droneType || '未设置类型'}`;
    item.appendChild(desc);

    // 点击选中
    item.addEventListener('click', () => {
      if (this.options.onSelect) {
        this.options.onSelect(pilot);
      }
    });

    return item;
  }

  /**
   * 设置活跃飞手
   * @param {string} pilotId - 飞手 ID
   */
  setActive(pilotId) {
    this.activeId = pilotId;
    // 重新渲染以更新 active 状态
    this.render(this.pilots);
  }
}
