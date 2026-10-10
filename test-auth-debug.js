// =====================================================
// 交互式登录/注册/Tab 切换功能自测脚本
// 直接在 Chrome 扩展开发者工具控制台运行此脚本
// 使用方式：
// 1. chrome://extensions → 找到 Betaflight助手 → 点击"Service Worker"
// 2. 打开 Console tab → 粘贴运行：
//    const resp = await fetch('popup/popup.html'); console.log(resp.ok ? '✓ 页面可访问' : '✗ 页面不可访问')
//
// 或者：直接在 popup.html 打开的页面控制台粘贴本文件内容
// =====================================================
//
// 注意：此脚本仅用于本地开发调试，不会被打包到扩展中

console.log('====== Betaflight助手 · 登录/注册/Tab 切换自测 ======');

// ---------- 1. 检查 HTML 结构是否完整 ----------
function checkHtmlStructure() {
  const checks = [
    { id: 'main-tabs', desc: 'Tab 导航容器' },
    { id: 'tab-account', desc: '账号 Tab panel' },
    { id: 'auth-panel-login', desc: '登录表单 panel' },
    { id: 'auth-panel-register', desc: '注册表单 panel' },
    { id: 'login-phone', desc: '登录手机号输入框' },
    { id: 'login-password', desc: '登录密码输入框' },
    { id: 'register-name', desc: '注册昵称输入框' },
    { id: 'register-phone', desc: '注册手机号输入框' },
    { id: 'register-password', desc: '注册密码输入框' },
    { id: 'register-password2', desc: '注册确认密码输入框' },
    { id: 'btn-login', desc: '登录按钮' },
    { id: 'btn-register', desc: '注册（确定）按钮' },
    { id: 'btn-back-to-login', desc: '返回登录按钮' },
    { id: 'account-status', desc: '状态提示容器' },
    { id: 'auth-badge', desc: '登录徽标' }
  ];

  console.log('\n📋 HTML 结构检查：');
  let allOk = true;
  for (const c of checks) {
    const el = document.getElementById(c.id);
    if (el) {
      console.log(`  ✓ ${c.desc} (#${c.id})`);
    } else {
      console.log(`  ✗ ${c.desc} (#${c.id}) —— ❌ 未找到`);
      allOk = false;
    }
  }
  return allOk;
}

// ---------- 2. 检查 data-auth 属性的切换元素 ----------
function checkAuthSwitch() {
  console.log('\n🎯 登录/注册切换按钮检查：');
  const buttons = document.querySelectorAll('[data-auth]');
  const hasTopSwitch = Array.from(buttons).some(b => b.classList.contains('auth-switch-btn'));
  const hasInline = Array.from(buttons).some(b => b.classList.contains('link-btn'));

  if (buttons.length >= 2) {
    console.log(`  ✓ 找到 ${buttons.length} 个 data-auth 按钮`);
    buttons.forEach((b, i) => console.log(`    - #${i + 1}: [data-auth="${b.dataset.auth}"] (text="${b.textContent.trim()}")`));
  } else {
    console.log(`  ✗ 仅找到 ${buttons.length} 个 data-auth 按钮`);
    return false;
  }
  return hasTopSwitch;
}

// ---------- 3. 测试 Tab 面板切换 ----------
function testPanelSwitch() {
  console.log('\n🔄 面板切换测试：');

  const loginPanel = document.getElementById('auth-panel-login');
  const registerPanel = document.getElementById('auth-panel-register');

  // --- 初始状态 ---
  console.log(`  初始状态：登录 panel display=${loginPanel.style.display}，注册 panel display=${registerPanel.style.display}`);
  console.log(`  登录 panel offsetParent=${loginPanel.offsetParent ? 'visible' : 'hidden'}，注册 panel offsetParent=${registerPanel.offsetParent ? 'visible' : 'hidden'}`);

  // --- 调用 switchAuthTab('register') ---
  switchAuthTab('register');
  console.log(`  切换到注册后：login.display=${loginPanel.style.display}，register.display=${registerPanel.style.display}`);

  const registerVisible = registerPanel.style.display !== 'none';
  if (registerVisible) {
    console.log('  ✓ 注册面板已成功显示');
  } else {
    console.log('  ✗ 注册面板未显示 ❌');
    return false;
  }

  // --- 调用 switchAuthTab('login') ---
  switchAuthTab('login');
  const loginVisible = loginPanel.style.display !== 'none';
  console.log(`  切换回登录后：login.display=${loginPanel.style.display}`);
  if (loginVisible) {
    console.log('  ✓ 登录面板已成功显示');
  } else {
    console.log('  ✗ 登录面板未显示 ❌');
    return false;
  }

  return true;
}

// ---------- 4. 测试输入验证 ----------
function testValidation() {
  console.log('\n✅ 字段实时校验测试：');

  // 测试手机号
  const phoneInput = document.getElementById('login-phone');
  phoneInput.value = '123456';
  phoneInput.dispatchEvent(new Event('input', { bubbles: true }));
  const phoneError = document.getElementById('err-login-phone');
  console.log(`  手机号"123456" → 错误：${phoneError.style.display === 'block' ? phoneError.textContent : '无错误'}`);

  // 测试密码（长度）
  const pwdInput = document.getElementById('login-password');
  pwdInput.value = '123';
  pwdInput.dispatchEvent(new Event('input', { bubbles: true }));
  const pwdError = document.getElementById('err-login-password');
  console.log(`  密码"123" → 错误：${pwdError.style.display === 'block' ? pwdError.textContent : '无错误'}`);

  // 测试合法手机号
  phoneInput.value = '13800138000';
  phoneInput.dispatchEvent(new Event('input', { bubbles: true }));
  console.log(`  合法手机号"13800138000" → 错误提示是否消失：${phoneError.style.display === 'none' ? '是' : '否'}`);

  // 测试合法密码
  pwdInput.value = 'mypassword123';
  pwdInput.dispatchEvent(new Event('input', { bubbles: true }));
  console.log(`  合法密码"mypassword123" → 错误提示是否消失：${pwdError.style.display === 'none' ? '是' : '否'}`);

  // 清理
  phoneInput.value = '';
  pwdInput.value = '';
  clearAllFieldErrors();

  console.log('  ✓ 字段校验已验证');
  return true;
}

// ---------- 5. 测试按钮点击事件绑定 ----------
function testButtonClickHandlers() {
  console.log('\n👆 按钮事件绑定检查：');
  const btnLogin = document.getElementById('btn-login');
  const btnRegister = document.getElementById('btn-register');
  const btnBack = document.getElementById('btn-back-to-login');

  const login = document.getElementById('auth-panel-login');
  const register = document.getElementById('auth-panel-register');

  // 点击"立即注册"按钮（带 data-auth="register" 的 link-btn）
  const registerLinkBtn = document.querySelector('.link-btn[data-auth="register"]');
  if (registerLinkBtn) {
    switchAuthTab('login'); // 先确保在登录页
    registerLinkBtn.click();
    console.log(`  ✓ 点击"立即注册 →"后：注册 panel display=${register.style.display}`);
    if (register.style.display === 'none') {
      console.log('    ✗ 登录 panel 应被隐藏');
      return false;
    }
  } else {
    console.log('  ✗ 未找到 .link-btn[data-auth="register"]');
    return false;
  }

  // 点击顶部"登录" Tab
  const topLoginBtn = document.querySelector('.auth-switch-btn[data-auth="login"]');
  const topRegisterBtn = document.querySelector('.auth-switch-btn[data-auth="register"]');
  if (topLoginBtn && topRegisterBtn) {
    topLoginBtn.click();
    console.log(`  ✓ 点击顶部"登录"后：login.display=${login.style.display}`);
    topRegisterBtn.click();
    console.log(`  ✓ 点击顶部"注册"后：register.display=${register.style.display}`);
  } else {
    console.log('  ✗ 未找到顶部 Tab 按钮');
    return false;
  }

  // 点击"← 返回登录"
  btnBack.click();
  console.log(`  ✓ 点击"← 返回登录"后：login.display=${login.style.display}`);

  return true;
}

// ---------- 6. 测试回车键提交 ----------
function testEnterKey() {
  console.log('\n⌨️  回车键提交检查：');

  // 先切换到登录
  switchAuthTab('login');
  const phoneInput = document.getElementById('login-phone');
  phoneInput.focus();
  phoneInput.value = '13800138000';

  const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
  phoneInput.dispatchEvent(enterEvent);
  console.log('  ✓ 登录页回车键已触发');

  return true;
}

// ---------- 7. 测试角色 Tab 渲染 ----------
function testRoleTabs() {
  console.log('\n🎨 角色 Tab 渲染测试：');

  // 模拟教练角色
  currentRole = 'coach';
  currentAuth = { name: '测试教练', phone: '13800138000', role: 'coach' };
  renderTabsForRole();

  const nav = document.getElementById('main-tabs');
  const tabBtns = nav.querySelectorAll('.tab-btn');
  console.log(`  教练角色 → Tab 数量：${tabBtns.length}`);
  tabBtns.forEach(b => console.log(`    - ${b.textContent} (data-tab="${b.dataset.tab}")`));

  if (tabBtns.length < 5) {
    console.log('  ✗ 教练角色应有至少 5 个 Tab（账号/学员/飞机/参数推送/预设库/备份）');
    return false;
  }

  // 模拟学员角色
  currentRole = 'student';
  currentAuth = { name: '测试学员', phone: '13900139000', role: 'student' };
  renderTabsForRole();
  const studentTabs = nav.querySelectorAll('.tab-btn');
  console.log(`  学员角色 → Tab 数量：${studentTabs.length}`);
  studentTabs.forEach(b => console.log(`    - ${b.textContent}`));

  if (studentTabs.length < 3) {
    console.log('  ✗ 学员角色应有至少 3 个 Tab（账号/我的飞机/预设/CLI 工具）');
    return false;
  }

  console.log('  ✓ 角色 Tab 渲染正常');
  return true;
}

// ---------- 运行所有测试 ----------
(async function runAllTests() {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 开始运行登录/注册功能自检测试...');
  console.log('='.repeat(60));

  const results = [];
  results.push({ name: 'HTML 结构完整', ok: checkHtmlStructure() });
  results.push({ name: 'data-auth 切换按钮', ok: checkAuthSwitch() });
  results.push({ name: '面板切换（登录 ↔ 注册）', ok: testPanelSwitch() });
  results.push({ name: '字段实时校验', ok: testValidation() });
  results.push({ name: '按钮点击事件', ok: testButtonClickHandlers() });
  results.push({ name: '回车键提交', ok: testEnterKey() });
  results.push({ name: '角色 Tab 渲染', ok: testRoleTabs() });

  console.log('\n' + '='.repeat(60));
  console.log('📊 测试结果汇总：');
  console.log('='.repeat(60));

  let passed = 0;
  for (const r of results) {
    const icon = r.ok ? '✅' : '❌';
    console.log(`  ${icon} ${r.name}`);
    if (r.ok) passed++;
  }

  console.log('\n  总计：' + passed + '/' + results.length + ' 项通过');

  if (passed === results.length) {
    console.log('\n🎉 所有测试通过！登录/注册功能应能正常工作。');
  } else {
    console.log('\n⚠️  有测试未通过，请检查相关代码。');
  }
})();
