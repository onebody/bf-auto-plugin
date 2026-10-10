(function() {
  const USER_ROLES = {
    COACH: 'coach',
    PILOT: 'pilot'
  };

  const STORAGE_KEYS = {
    ACCOUNT: 'bf_auto_account',
    STUDENTS: 'bf_auto_pilots',
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
    STUDENT_OWN_AIRCRAFTS: 'bf_auto_pilot_aircrafts_'
  };

  const SENSITIVE_FIELDS = [
    'password', 'token', 'secret', 'apiKey', 'api_key',
    'accessToken', 'refreshToken', 'privateKey', 'auth_token',
    '水库密钥', 'authorization', 'credentials'
  ];

  const MESSAGE_TYPES = {
    SAVE_ACCOUNT: 'save_account',
    GET_ACCOUNT: 'get_account',
    CLEAR_ACCOUNT: 'clear_account',
    AUTO_LOGIN: 'auto_login',
    REGISTER_ACCOUNT: 'register_account',
    LOGIN_ACCOUNT: 'login_account',
    SUBMIT_FORM: 'submit_form',
    ENCRYPT_SENSITIVE: 'encrypt_sensitive',
    DECRYPT_SENSITIVE: 'decrypt_sensitive',
    API_POST: 'api_post',
    API_GET: 'api_get',
    SAVE_PILOT: 'save_pilot',
    GET_PILOTS: 'get_pilots',
    DELETE_PILOT: 'delete_pilot',
    UPDATE_PILOT: 'update_pilot',
    SAVE_AIRCRAFT: 'save_aircraft',
    GET_AIRCRAFTS: 'get_aircrafts',
    DELETE_AIRCRAFT: 'delete_aircraft',
    UPDATE_AIRCRAFT: 'update_aircraft',
    EXPORT_AIRCRAFT: 'export_aircraft',
    SAVE_PRESET: 'save_preset',
    GET_PRESETS: 'get_presets',
    DELETE_PRESET: 'delete_preset',
    RENAME_PRESET: 'rename_preset',
    EXPORT_PRESET: 'export_preset',
    EXPORT_ALL: 'export_all',
    IMPORT_ALL: 'import_all',
    READ_PARAMS: 'read_params',
    WRITE_PARAMS: 'write_params',
    APPLY_PRESET: 'apply_preset',
    BATCH_APPLY_PRESET: 'batch_apply_preset',
    OPERATION_LOG: 'operation_log',
    CHECK_AUTH: 'check_auth',
    REQUIRE_AUTH: 'require_auth',
    GET_SYSTEM_PRESETS: 'get_system_presets',
    SAVE_SYSTEM_PRESET: 'save_system_preset',
    DELETE_SYSTEM_PRESET: 'delete_system_preset',
    APPLY_SYSTEM_PRESET: 'apply_system_preset',
    BACKUP_DUMP: 'backup_dump',
    BACKUP_DIFF: 'backup_diff',
    BACKUP_UPLOAD_RESERVOIR: 'backup_upload_reservoir',
    GET_BACKUP_HISTORY: 'get_backup_history',
    SAVE_RESERVOIR_CONFIG: 'save_reservoir_config',
    GET_RESERVOIR_CONFIG: 'get_reservoir_config',
    GET_ROLE: 'get_role',
    SET_ROLE: 'set_role',
    TRIGGER_ROLE_POST_LOGIN: 'trigger_role_post_login',
    GET_CATEGORIES: 'get_categories',
    SAVE_CATEGORY: 'save_category',
    DELETE_CATEGORY: 'delete_category',
    SAVE_AIRCRAFT_PARAMS: 'save_aircraft_params',
    GET_AIRCRAFT_PARAMS: 'get_aircraft_params',
    LIST_AIRCRAFT_PARAMS_VERSIONS: 'list_aircraft_params_versions',
    APPLY_AIRCRAFT_PARAMS_VERSION: 'apply_aircraft_params_version',
    GENERATE_CLI_SCRIPT: 'generate_cli_script',
    EXECUTE_CLI_SCRIPT: 'execute_cli_script',
    CHECK_FC_CONNECTION: 'check_fc_connection',
    PUSH_PARAMS_TO_PILOT: 'push_params_to_pilot',
    GET_PUSH_QUEUE: 'get_push_queue',
    CONSUME_PUSH_QUEUE_ITEM: 'consume_push_queue_item',
    CLEAR_PUSH_QUEUE: 'clear_push_queue',
    NOTIFY_PILOT_PUSH: 'notify_pilot_push',
    GET_PILOT_AIRCRAFTS: 'get_pilot_aircrafts',
    SAVE_PILOT_AIRCRAFT: 'save_pilot_aircraft',
    DELETE_PILOT_AIRCRAFT: 'delete_pilot_aircraft'
  };

  const PRESET_TYPES = {
    RACING: 'racing',
    FREESTYLE: 'freestyle',
    INDOOR: 'indoor',
    CINEMATIC: 'cinematic',
    CUSTOM: 'custom',
    SYSTEM: 'system'
  };

  const COACH_EMAIL_SUFFIXES = [];

  const COACH_PHONE_PREFIXES = ['199', '1888888', '1380000', '1666', '1777'];

  const DEFAULT_CATEGORIES = [
    { id: 'cat_5inch', name: '5 寸', color: '#ff6b6b', builtIn: true },
    { id: 'cat_2inch', name: '室内 2 寸', color: '#4ecdc4', builtIn: true },
    { id: 'cat_soccer', name: '球机', color: '#ffe66d', builtIn: true },
    { id: 'cat_freestyle', name: '花飞机', color: '#a77dff', builtIn: true },
    { id: 'cat_other', name: '其它', color: '#95a5a6', builtIn: true }
  ];

  const MODEL_TYPES = {
    '2INCH': '2寸',
    '3INCH': '3寸',
    '5INCH': '5寸',
    SOCCER: '足球机'
  };

  const DEFAULT_PRESETS = [
    {
      id: 'preset_racing_001',
      name: '竞速模板',
      type: PRESET_TYPES.RACING,
      pid: { rollP: 50, rollI: 30, rollD: 18, pitchP: 50, pitchI: 30, pitchD: 18, yawP: 55, yawI: 35, yawD: 20 },
      rates: { rcRate: 90, rcExpo: 0, rates: 65, tpaRate: 0, tpaBreakpoint: 1500 },
      filter: { gyroLowpass: 360, dtermLowpass: 240, dtermNotch: 0 },
      motorConfig: { motorOutput: 1000 },
      createdAt: Date.now()
    },
    {
      id: 'preset_freestyle_001',
      name: '花飞模板',
      type: PRESET_TYPES.FREESTYLE,
      pid: { rollP: 45, rollI: 28, rollD: 15, pitchP: 45, pitchI: 28, pitchD: 15, yawP: 50, yawI: 32, yawD: 18 },
      rates: { rcRate: 100, rcExpo: 20, rates: 75, tpaRate: 30, tpaBreakpoint: 1200 },
      filter: { gyroLowpass: 250, dtermLowpass: 180, dtermNotch: 800 },
      motorConfig: { motorOutput: 1000 },
      createdAt: Date.now()
    },
    {
      id: 'preset_indoor_001',
      name: '室内机模板',
      type: PRESET_TYPES.INDOOR,
      pid: { rollP: 30, rollI: 20, rollD: 8, pitchP: 30, pitchI: 20, pitchD: 8, yawP: 35, yawI: 25, yawD: 10 },
      rates: { rcRate: 80, rcExpo: 10, rates: 50, tpaRate: 0, tpaBreakpoint: 1500 },
      filter: { gyroLowpass: 200, dtermLowpass: 150, dtermNotch: 0 },
      motorConfig: { motorOutput: 1000 },
      createdAt: Date.now()
    },
    {
      id: 'preset_cinematic_001',
      name: '航拍模板',
      type: PRESET_TYPES.CINEMATIC,
      pid: { rollP: 25, rollI: 15, rollD: 5, pitchP: 25, pitchI: 15, pitchD: 5, yawP: 30, yawI: 20, yawD: 8 },
      rates: { rcRate: 60, rcExpo: 0, rates: 40, tpaRate: 0, tpaBreakpoint: 1500 },
      filter: { gyroLowpass: 150, dtermLowpass: 100, dtermNotch: 0 },
      motorConfig: { motorOutput: 1000 },
      createdAt: Date.now()
    }
  ];

  const AUTH_REQUIRED_TABS = ['account', 'pilots', 'aircrafts'];

  const exports = {
    STORAGE_KEYS,
    MESSAGE_TYPES,
    PRESET_TYPES,
    MODEL_TYPES,
    DEFAULT_PRESETS,
    AUTH_REQUIRED_TABS,
    USER_ROLES,
    COACH_EMAIL_SUFFIXES,
    COACH_PHONE_PREFIXES,
    DEFAULT_CATEGORIES,
    SENSITIVE_FIELDS
  };

  if (typeof window !== 'undefined') {
    Object.assign(window, exports);
  }
  if (typeof self !== 'undefined' && typeof window === 'undefined') {
    Object.assign(self, exports);
  }
})();
