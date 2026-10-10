/**
 * 存储键名定义
 * @module shared/storage-keys
 */

/** 账号信息存储键 */
export const STORAGE_KEY_ACCOUNT = 'bf_auto_account';

/** 学员列表存储键 */
export const STORAGE_KEY_STUDENTS = 'bf_auto_students';

/** 飞机列表存储键 */
export const STORAGE_KEY_AIRCRAFTS = 'bf_auto_aircrafts';

/** 预设模板列表存储键 */
export const STORAGE_KEY_PRESETS = 'bf_auto_presets';

/** 系统预设列表存储键 */
export const STORAGE_KEY_SYSTEM_PRESETS = 'bf_auto_system_presets';

/** 全局状态存储键 */
export const STORAGE_KEY_GLOBAL_STATE = 'bf_auto_global_state';

/** 加密密钥存储键 */
export const STORAGE_KEY_CRYPTO = 'bf_auto_crypto_key';

/** 备份历史存储键 */
export const STORAGE_KEY_BACKUP_HISTORY = 'bf_auto_backup_history';

/** 水库系统配置存储键 */
export const STORAGE_KEY_RESERVOIR_CONFIG = 'bf_auto_reservoir_config';

/** 认证会话存储键 */
export const STORAGE_KEY_AUTH_SESSION = 'bf_auto_auth_session';

/** 飞机分类存储键 */
export const STORAGE_KEY_AIRCRAFT_CATEGORIES = 'bf_auto_aircraft_categories';

/** 飞机参数版本存储键 */
export const STORAGE_KEY_AIRCRAFT_PARAMS_VERSIONS = 'bf_auto_aircraft_params_versions';

/** 操作日志存储键（暂不使用，日志仅内存存储） */
export const STORAGE_KEY_LOGS = 'bf_auto_logs';

/**
 * 推送队列键前缀（后面会加上用户手机号）
 * 完整键名如：bf_auto_push_queue_13800138000
 */
export const STORAGE_KEY_PUSH_QUEUE_PREFIX = 'bf_auto_push_queue_';

/** 学员飞机绑定关系存储键前缀 */
export const STORAGE_KEY_STUDENT_OWN_AIRCRAFTS = 'bf_auto_student_aircrafts_';

/**
 * 所有存储键名列表
 * @type {string[]}
 */
export const ALL_STORAGE_KEYS = [
  STORAGE_KEY_ACCOUNT,
  STORAGE_KEY_STUDENTS,
  STORAGE_KEY_AIRCRAFTS,
  STORAGE_KEY_PRESETS,
  STORAGE_KEY_SYSTEM_PRESETS,
  STORAGE_KEY_GLOBAL_STATE,
  STORAGE_KEY_CRYPTO,
  STORAGE_KEY_BACKUP_HISTORY,
  STORAGE_KEY_RESERVOIR_CONFIG,
  STORAGE_KEY_AUTH_SESSION,
  STORAGE_KEY_AIRCRAFT_CATEGORIES,
  STORAGE_KEY_AIRCRAFT_PARAMS_VERSIONS,
  STORAGE_KEY_LOGS
];

/**
 * 存储键名对象（兼容旧代码）
 * @type {Object}
 */
export const STORAGE_KEYS = {
  ACCOUNT: STORAGE_KEY_ACCOUNT,
  STUDENTS: STORAGE_KEY_STUDENTS,
  AIRCRAFTS: STORAGE_KEY_AIRCRAFTS,
  PRESETS: STORAGE_KEY_PRESETS,
  SYSTEM_PRESETS: STORAGE_KEY_SYSTEM_PRESETS,
  GLOBAL_STATE: STORAGE_KEY_GLOBAL_STATE,
  CRYPTO_KEY: STORAGE_KEY_CRYPTO,
  BACKUP_HISTORY: STORAGE_KEY_BACKUP_HISTORY,
  RESERVOIR_CONFIG: STORAGE_KEY_RESERVOIR_CONFIG,
  AUTH_SESSION: STORAGE_KEY_AUTH_SESSION,
  AIRCRAFT_CATEGORIES: STORAGE_KEY_AIRCRAFT_CATEGORIES,
  AIRCRAFT_PARAMS_VERSIONS: STORAGE_KEY_AIRCRAFT_PARAMS_VERSIONS,
  LOGS: STORAGE_KEY_LOGS
};
