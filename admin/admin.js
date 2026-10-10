/**
 * 管理页面逻辑
 * @module admin/admin.js
 */

/**
 * 初始化管理页面
 */
function init() {
  console.log('[Admin] 初始化管理页面');

  // 加载数据概览
  loadDataOverview();

  // 初始化 Tab 切换
  initTabs();

  // 绑定按钮事件
  document.getElementById('btn-export-all').addEventListener('click', handleExportAll);
  document.getElementById('btn-import-data').addEventListener('click', handleImportData);
  document.getElementById('btn-clear-all').addEventListener('click', handleClearAll);
}

/**
 * 加载数据概览
 */
async function loadDataOverview() {
  try {
    const data = await chrome.storage.local.get(null);

    // 更新统计数据
    document.getElementById('stat-account').textContent = data.account ? '已设置' : '未设置';
    document.getElementById('stat-students').textContent = data.students ? data.students.length : 0;
    document.getElementById('stat-aircrafts').textContent = data.aircrafts ? data.aircrafts.length : 0;
    document.getElementById('stat-presets').textContent = data.presets ? data.presets.length : 0;
  } catch (error) {
    console.error('[Admin] 加载数据概览失败:', error);
  }
}

/**
 * 初始化 Tab 切换
 */
function initTabs() {
  const tabs = document.querySelectorAll('.bf-admin-tab');
  const display = document.getElementById('data-display');

  tabs.forEach(tab => {
    tab.addEventListener('click', async () => {
      // 更新 Tab 激活状态
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // 加载对应数据
      const target = tab.dataset.target;
      await loadDataForTab(target);
    });
  });

  // 默认加载账号数据
  loadDataForTab('account-data');
}

/**
 * 加载 Tab 数据
 * @param {string} target - 目标数据类型
 */
async function loadDataForTab(target) {
  const display = document.getElementById('data-display');

  try {
    let data;
    switch (target) {
      case 'account-data':
        data = await chrome.storage.local.get('account');
        break;
      case 'students-data':
        data = await chrome.storage.local.get('students');
        break;
      case 'aircrafts-data':
        data = await chrome.storage.local.get('aircrafts');
        break;
      case 'presets-data':
        data = await chrome.storage.local.get('presets');
        break;
      default:
        data = null;
    }

    display.textContent = JSON.stringify(data, null, 2);
  } catch (error) {
    console.error('[Admin] 加载数据失败:', error);
    display.textContent = `加载失败: ${error.message}`;
  }
}

/**
 * 处理导出所有数据
 */
async function handleExportAll() {
  try {
    const data = await chrome.storage.local.get(null);
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `bf-auto-tuning-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();

    URL.revokeObjectURL(url);
    alert('数据导出成功！');
  } catch (error) {
    console.error('[Admin] 导出数据失败:', error);
    alert(`导出失败: ${error.message}`);
  }
}

/**
 * 处理导入数据
 */
async function handleImportData() {
  try {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const text = await file.text();
      const data = JSON.parse(text);

      // 确认导入
      if (!confirm('导入将覆盖现有数据，确定继续吗？')) {
        return;
      }

      // 写入数据
      await chrome.storage.local.set(data);

      alert('数据导入成功！');
      location.reload();
    };

    input.click();
  } catch (error) {
    console.error('[Admin] 导入数据失败:', error);
    alert(`导入失败: ${error.message}`);
  }
}

/**
 * 处理清除所有数据
 */
async function handleClearAll() {
  if (!confirm('确定要清除所有数据吗？此操作不可恢复！')) {
    return;
  }

  if (!confirm('再次确认：清除所有数据？')) {
    return;
  }

  try {
    await chrome.storage.local.clear();
    alert('所有数据已清除！');
    location.reload();
  } catch (error) {
    console.error('[Admin] 清除数据失败:', error);
    alert(`清除失败: ${error.message}`);
  }
}

// DOM 加载完成后初始化
document.addEventListener('DOMContentLoaded', init);
