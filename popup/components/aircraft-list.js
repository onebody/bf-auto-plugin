/**
 * 飞机列表组件
 * @module popup/components/aircraft-list
 */

/**
 * 飞机列表组件类
 */
export class AircraftList {
  /**
   * 构造函数
   * @param {HTMLElement} container - 列表容器元素
   * @param {object} options - 配置选项
   * @param {function} options.onSelect - 点击条目打开配置列表回调
   * @param {function} options.onEdit - 编辑回调
   * @param {function} options.onDelete - 删除回调
   */
  constructor(container, options = {}) {
    this.container = container;
    this.options = options;
    this.aircrafts = [];
    this.hangarMap = {}; // 机库 id → 名称映射
  }

  /**
   * 渲染飞机列表
   * @param {object[]} aircrafts - 飞机数组
   * @param {Object<number, string>} [hangarMap] - 机库 id → 名称映射，用于显示机库归属
   */
  render(aircrafts, hangarMap) {
    this.aircrafts = aircrafts;
    this.hangarMap = hangarMap || {};
    this.container.innerHTML = '';

    if (!aircrafts || aircrafts.length === 0) {
      this.container.innerHTML = '<div class="bf-plugin-empty">暂无飞机，点击「新建飞机」创建</div>';
      return;
    }

    aircrafts.forEach(aircraft => {
      const item = this.createListItem(aircraft);
      this.container.appendChild(item);
    });
  }

  /**
   * 创建列表项（点击条目进入该飞机的配置列表）
   * @param {object} aircraft - 飞机对象
   * @returns {HTMLElement} 列表项元素
   */
  createListItem(aircraft) {
    const item = document.createElement('div');
    item.className = 'bf-plugin-list-item';

    // 头部（标题 + 操作按钮）
    const header = document.createElement('div');
    header.className = 'bf-plugin-list-item-header';

    const title = document.createElement('span');
    title.className = 'bf-plugin-list-item-title';
    title.textContent = aircraft.title;
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
        this.options.onEdit(aircraft);
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
        this.options.onDelete(aircraft);
      }
    });
    actions.appendChild(deleteBtn);

    header.appendChild(actions);
    item.appendChild(header);

    // 描述信息（含机库归属）
    const desc = document.createElement('div');
    desc.className = 'bf-plugin-list-item-desc';
    const hangarName = aircraft.hangar_id != null ? this.hangarMap[aircraft.hangar_id] : null;
    const hangarLabel = hangarName ? `机库：${hangarName}` : '未设置机库';
    desc.textContent = `${hangarLabel} | ${aircraft.category || '未设置分类'} | 更新于 ${new Date(aircraft.updated_at).toLocaleDateString()}`;
    item.appendChild(desc);

    // 点击条目 → 打开该飞机的配置列表
    item.addEventListener('click', () => {
      if (this.options.onSelect) {
        this.options.onSelect(aircraft);
      }
    });

    return item;
  }
}
