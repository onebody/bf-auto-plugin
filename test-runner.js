// =====================================================
// Betaflight助手 Chrome 插件 - 综合验证测试
// 覆盖：角色跳转 / 后台 CRUD / 参数推送流程
// 运行: node _test_runner.js
// =====================================================
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname);

const results = [];
let passed = 0, failed = 0;

function log(ok, title, detail) {
  if (ok) { passed++; results.push({ pass: true, title, detail }); console.log('✅ ' + title); }
  else { failed++; results.push({ pass: false, title, detail }); console.log('❌ ' + title + ' -> ' + detail); }
}

function readFile(p) { return fs.readFileSync(path.join(ROOT, p), 'utf-8'); }
function exists(p) { return fs.existsSync(path.join(ROOT, p)); }

console.log('\n========== 【第一阶段：文件存在性与 manifest 校验】 ==========');
const requiredFiles = [
  'manifest.json',
  'popup/popup.html', 'popup/popup.js', 'popup/popup.css',
  'background/service-worker.js', 'background/auth-middleware.js',
  'background/storage-manager.js', 'background/backup-service.js',
  'background/system-presets.js', 'background/crypto-service.js',
  'content/content.js', 'content/dom-reader.js', 'content/dom-writer.js',
  'content/selector-map.js',
  'shared/constants.js',
  'admin/admin.html', 'admin/admin.js', 'admin/admin.css',
  'icons/icon16.png', 'icons/icon48.png', 'icons/icon128.png'
];
requiredFiles.forEach((f) => log(exists(f), `文件存在: ${f}`, '文件缺失'));

// manifest 校验
let manifest;
try {
  manifest = JSON.parse(readFile('manifest.json'));
  log(true, 'manifest.json: JSON 语法合法', '版本 ' + manifest.version);
  log(manifest.manifest_version === 3, 'manifest.json: 使用 MV3', '期望 3，实际 ' + manifest.manifest_version);
  log(manifest.background && manifest.background.service_worker, 'manifest.json: service_worker 声明',
    manifest.background?.service_worker || '缺失');
  log(manifest.background && manifest.background.type === 'module', 'manifest.json: background 声明 type: module',
    '支持 import/export');
  log(manifest.web_accessible_resources && manifest.web_accessible_resources.length >= 1,
    'manifest.json: web_accessible_resources 含 admin.html',
    JSON.stringify(manifest.web_accessible_resources));
  const wr = manifest.web_accessible_resources?.[0]?.resources || [];
  log(wr.includes('admin/admin.html'), 'manifest.json: web_accessible_resources 包含 admin/admin.html', wr.join(','));
  log(manifest.content_scripts && manifest.content_scripts.length >= 1, 'manifest.json: content_scripts 配置存在', '');
} catch (e) {
  log(false, 'manifest.json: JSON 解析失败', e.message);
}

console.log('\n========== 【第二阶段：JS 语法校验 (require)】 ==========');
const jsFiles = [
  'background/service-worker.js', 'background/auth-middleware.js',
  'background/storage-manager.js', 'background/backup-service.js',
  'background/system-presets.js', 'background/crypto-service.js',
  'popup/popup.js', 'admin/admin.js',
  'shared/constants.js',
  'content/dom-reader.js', 'content/dom-writer.js', 'content/content.js',
  'content/selector-map.js'
];
jsFiles.forEach((f) => {
  try {
    new Function(readFile(f).replace(/import[\s\S]*?from\s+['"][^'"]+['"];?/g, '/* import */')
      .replace(/export\s+(const|let|var|function|class|default|async|async\s+function)\s+/g, '$1 '));
    log(true, `语法校验: ${f}`, '');
  } catch (e) {
    log(false, `语法校验: ${f}`, e.message);
  }
});

console.log('\n========== 【第三阶段：角色跳转与登录流程】 ==========');
const authSrc = readFile('background/auth-middleware.js');
log(/postLoginRoutine[\s\S]*?chrome\.tabs\.create/.test(authSrc),
  'auth-middleware.js: 教练登录后调用 chrome.tabs.create 跳转后台',
  '包含 chrome.tabs.create');
log(/USER_ROLES\.COACH/.test(authSrc), 'auth-middleware.js: 区分 coach 角色', '');
log(/USER_ROLES\.STUDENT/.test(authSrc), 'auth-middleware.js: 区分 student 角色', '');
log(/role\s*===|===.*role|==.*role/.test(authSrc), 'auth-middleware.js: 角色判断逻辑存在', '');

const swSrc = readFile('background/service-worker.js');
log(/TRIGGER_ROLE_POST_LOGIN|trigger_role_post_login/i.test(swSrc),
  'service-worker.js: 处理 TRIGGER_ROLE_POST_LOGIN 消息', '');
log(/CHECK_AUTH|check_auth/i.test(swSrc), 'service-worker.js: 处理 CHECK_AUTH 消息', '');
log(/SAVE_ACCOUNT|save_account/i.test(swSrc), 'service-worker.js: 处理 SAVE_ACCOUNT 消息', '');

console.log('\n========== 【第四阶段：后台 CRUD 能力】 ==========');
const adminSrc = readFile('admin/admin.js');
['GET_STUDENTS', 'SAVE_STUDENT', 'DELETE_STUDENT', 'UPDATE_STUDENT',
 'GET_AIRCRAFTS', 'SAVE_AIRCRAFT', 'DELETE_AIRCRAFT', 'UPDATE_AIRCRAFT',
 'GET_CATEGORIES', 'SAVE_CATEGORY', 'DELETE_CATEGORY',
 'GET_PRESETS', 'SAVE_PRESET', 'DELETE_PRESET', 'RENAME_PRESET',
 'GET_SYSTEM_PRESETS', 'SAVE_SYSTEM_PRESET', 'DELETE_SYSTEM_PRESET',
 'READ_PARAMS', 'WRITE_PARAMS',
 'BACKUP_DUMP', 'BACKUP_DIFF', 'BACKUP_UPLOAD_RESERVOIR',
 'SAVE_RESERVOIR_CONFIG', 'EXPORT_ALL', 'IMPORT_ALL',
 'GET_BACKUP_HISTORY'].forEach((type) => {
  log(adminSrc.includes(`MESSAGE_TYPES.${type}`),
    `admin.js: 使用 MESSAGE_TYPES.${type}`,
    '存在于 admin.js');
});

console.log('\n========== 【第五阶段：参数推送流程】 ==========');
log(/PUSH_PARAMS_TO_STUDENT|push_params_to_student/i.test(adminSrc),
  'admin.js: 使用 PUSH_PARAMS_TO_STUDENT', '');
log(/GET_PUSH_QUEUE|get_push_queue/i.test(adminSrc),
  'admin.js: 使用 GET_PUSH_QUEUE', '');
log(/CONSUME_PUSH_QUEUE_ITEM|consume_push_queue_item/i.test(adminSrc),
  'admin.js: 使用 CONSUME_PUSH_QUEUE_ITEM', '');
log(/CLEAR_PUSH_QUEUE|clear_push_queue/i.test(adminSrc),
  'admin.js: 使用 CLEAR_PUSH_QUEUE', '');
log(/SAVE_AIRCRAFT_PARAMS|save_aircraft_params/i.test(adminSrc),
  'admin.js: 使用 SAVE_AIRCRAFT_PARAMS', '');
log(/LIST_AIRCRAFT_PARAMS_VERSIONS|list_aircraft_params_versions/i.test(adminSrc),
  'admin.js: 使用 LIST_AIRCRAFT_PARAMS_VERSIONS', '');

// storage-manager 的推送相关方法
const smSrc = readFile('background/storage-manager.js');
log(/pushParamsToStudent|push_params_to_student|PUSH_QUEUE_PREFIX/i.test(smSrc),
  'storage-manager.js: 存在 pushParamsToStudent / PUSH_QUEUE_PREFIX', '');
log(/generateCliScript|CLI/i.test(smSrc),
  'storage-manager.js: 存在 generateCliScript CLI 脚本生成', '');
log(/saveAircraftParams|aircraft_params/i.test(smSrc),
  'storage-manager.js: 存在 saveAircraftParams 参数版本保存', '');

console.log('\n========== 【第六阶段：学员端分类 / CLI 工具】 ==========');
const contentSrc = readFile('content/content.js');
log(/EXECUTE_CLI_SCRIPT|execute_cli_script|textarea|'cli'|'CLI'/.test(contentSrc),
  'content.js: 存在 CLI 脚本执行逻辑', '');
log(/CHECK_FC_CONNECTION|check_fc_connection|connected|飞控/i.test(contentSrc),
  'content.js: 存在飞控连接检测', '');

const popupSrc = readFile('popup/popup.js');
log(/STUDENT_AIRCRAFTS|student_aircrafts/i.test(popupSrc),
  'popup.js: 存在学员飞机读取', '');
log(/category|分类/i.test(popupSrc),
  'popup.js: 存在分类分组显示', '');

console.log('\n========== 【第七阶段：常量定义完备性】 ==========');
const constantsSrc = readFile('shared/constants.js');
['COACH', 'STUDENT',
 'TRIGGER_ROLE_POST_LOGIN', 'GET_ROLE', 'SET_ROLE',
 'PUSH_PARAMS_TO_STUDENT', 'GET_PUSH_QUEUE', 'CONSUME_PUSH_QUEUE_ITEM', 'CLEAR_PUSH_QUEUE',
 'GET_CATEGORIES', 'SAVE_CATEGORY', 'DELETE_CATEGORY',
 'SAVE_AIRCRAFT_PARAMS', 'GET_AIRCRAFT_PARAMS', 'LIST_AIRCRAFT_PARAMS_VERSIONS',
 'EXECUTE_CLI_SCRIPT', 'CHECK_FC_CONNECTION',
 'GENERATE_CLI_SCRIPT',
 'AIRCRAFT_CATEGORIES', 'AIRCRAFT_PARAMS_VERSIONS', 'PUSH_QUEUE_PREFIX',
 'GET_STUDENT_AIRCRAFTS', 'SAVE_STUDENT_AIRCRAFT', 'DELETE_STUDENT_AIRCRAFT'].forEach((k) => {
  log(constantsSrc.includes(k), `constants.js: 包含 ${k}`, '');
});

console.log('\n========== 【第八阶段：HTML 引用完整性】 ==========');
const popupHtml = readFile('popup/popup.html');
log(popupHtml.includes('popup.js'), 'popup.html: 引用 popup.js', '');
log(popupHtml.includes('popup.css'), 'popup.html: 引用 popup.css', '');
log(popupHtml.includes('role-picker') || popupHtml.includes('account-role'),
  'popup.html: 包含角色选择器 (role-picker / account-role)', '');

const adminHtml = readFile('admin/admin.html');
log(adminHtml.includes('admin.js'), 'admin.html: 引用 admin.js', '');
log(adminHtml.includes('admin.css'), 'admin.html: 引用 admin.css', '');
log(adminHtml.includes('view-students') && adminHtml.includes('view-aircrafts'),
  'admin.html: 包含学员/飞机/参数视图', '');
log(adminHtml.includes('edit-params-modal'), 'admin.html: 包含参数编辑对话框', '');

console.log('\n========== 【第九阶段：Chrome API 兼容性检查】 ==========');
// content.js 不能使用 ES6 import，需要检查
log(!/^\s*import\s+/.test(contentSrc) && !/^\s*export\s+/m.test(contentSrc),
  'content/content.js: 不使用 ES6 import/export',
  'Chrome content script 不支持原生模块');
log(/chrome\.runtime\.onMessage|chrome\.runtime\.sendMessage/.test(swSrc),
  'service-worker.js: 使用 chrome.runtime.onMessage / sendMessage',
  '消息通讯存在');
log(/chrome\.storage\.local/.test(smSrc),
  'storage-manager.js: 使用 chrome.storage.local', '');

console.log('\n========== 【第十阶段：权限保护中间件】 ==========');
log(/AUTH_PROTECTED_TYPES|auth_protected_types|authMiddleware\.checkAuth/i.test(swSrc),
  'service-worker.js: 存在 AUTH_PROTECTED_TYPES 权限保护',
  '敏感操作需登录校验');

console.log('\n========================================');
console.log(`测试结果: ${passed} 通过 / ${failed} 失败 (共 ${passed + failed} 项)`);
console.log('========================================\n');

if (failed > 0) {
  console.log('失败项列表:');
  results.filter((r) => !r.pass).forEach((r) => console.log('  - ' + r.title + ' (' + r.detail + ')'));
  process.exit(1);
} else {
  console.log('🎉 所有测试通过！');
  process.exit(0);
}
