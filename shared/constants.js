/**
 * 全局常量定义
 * @module shared/constants
 */

/** 插件版本号 */
export const PLUGIN_VERSION = '1.0.0';

/** 插件名称 */
export const PLUGIN_NAME = 'Betaflight助手';

/** 存储版本号（用于数据迁移） */
export const STORAGE_VERSION = '1.0.0';

/** BetaFlight 网页 URL */
export const BF_BASE_URL = 'https://app.betaflight.com';

/** DOM 操作默认超时时间（毫秒） */
export const DEFAULT_TIMEOUT = 5000;

/** DOM 操作轮询间隔（毫秒） */
export const POLL_INTERVAL = 100;

/** 日志面板最大日志条数 */
export const MAX_LOG_ENTRIES = 100;

/** 消息通信超时时间（毫秒） */
export const MESSAGE_TIMEOUT = 30000;

/** 账号密码 Base64 编码标识（用于区分是否已编码） */
export const PASSWORD_ENCODED_PREFIX = '_b64_';

/** 默认飞控参数值 */
export const DEFAULT_PID_VALUES = {
  roll: { P: 0, I: 0, D: 0 },
  pitch: { P: 0, I: 0, D: 0 },
  yaw: { P: 0, I: 0, D: 0 }
};

/** 默认 Rates 参数值 */
export const DEFAULT_RATES_VALUES = {
  roll: { rcRate: 0, superRate: 0, expo: 0 },
  pitch: { rcRate: 0, superRate: 0, expo: 0 },
  yaw: { rcRate: 0, superRate: 0, expo: 0 }
};

/** 默认滤波器参数值 */
export const DEFAULT_FILTER_VALUES = {
  gyroLowpass: 0,
  gyroNotch: 0,
  dTermLowpass: 0
};

/** 默认电机参数值 */
export const DEFAULT_MOTOR_VALUES = {
  minThrottle: 0,
  maxThrottle: 0,
  minCommand: 0
};

/** 用户角色定义 */
export const USER_ROLES = {
  COACH: 'coach',
  PILOT: 'pilot'
};

/** 教练手机号前缀（用于自动识别角色） */
export const COACH_PHONE_PREFIXES = ['199', '1888888', '1380000', '1666', '1777'];

/** 是否跳过认证（调试用） */
export const SKIP_AUTH = false;

/** 需要认证的 Tab 列表 */
export const AUTH_REQUIRED_TABS = ['account', 'pilots', 'aircrafts'];

/** API 服务基础配置 */
export const API_CONFIG = {
  BASE_URL: 'http://localhost:8000',
  TIMEOUT: 30000,
  RETRY_COUNT: 3
};

/**
 * 加密配置
 * 注意：ENCRYPTION_SECRET 必须与后端保持一致
 * 生产环境请通过环境变量或配置文件设置
 */
export const ENCRYPTION_CONFIG = {
  // AES-GCM 加密密钥（与后端 ENCRYPTION_SECRET 保持一致）
  // 生产环境必须修改此值！
  SECRET: 'drone-config-encryption-secret-change-in-production',
  // PBKDF2 迭代次数
  ITERATIONS: 100000,
  // 盐长度（字节）
  SALT_LENGTH: 16,
  // IV 长度（字节）
  IV_LENGTH: 12
};

/** 存储键名定义 */
export const STORAGE_KEYS = {
  ACCOUNT: 'bf_auto_account',
  PILOTS: 'bf_auto_pilots',
  AIRCRAFTS: 'bf_auto_aircrafts',
  PRESETS: 'bf_auto_presets',
  CRYPTO_KEY: 'bf_auto_crypto_key',
  SYSTEM_PRESETS: 'bf_auto_system_presets',
  BACKUP_HISTORY: 'bf_auto_backup_history',
  RESERVOIR_CONFIG: 'bf_auto_reservoir_config',
  AUTH_SESSION: 'bf_auto_auth_session',
  AIRCRAFT_CATEGORIES: 'bf_auto_aircraft_categories',
  AIRCRAFT_PARAMS_VERSIONS: 'bf_auto_aircraft_params_versions',
  PUSH_QUEUE_PREFIX: 'bf_auto_push_queue_',
  PILOT_OWN_AIRCRAFTS: 'bf_auto_pilot_aircrafts_',
  ACCESS_TOKEN: 'access_token'
};
