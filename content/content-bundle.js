(() => {
  // bf-auto-plugin/shared/message-protocol.js
  var MessageTarget = {
    POPUP: "popup",
    BACKGROUND: "background",
    CONTENT: "content"
  };
  var MessageAction = {
    // 飞控连接相关（新增）
    CHECK_FC_CONNECTION: "fc/checkConnection",
    CLICK_CONNECT_BUTTON: "fc/clickConnect",
    // 飞机相关
    AIRCRAFT_LIST: "aircraft/list",
    AIRCRAFT_ADD: "aircraft/add",
    AIRCRAFT_UPDATE: "aircraft/update",
    AIRCRAFT_DELETE: "aircraft/delete",
    AIRCRAFT_READ_FROM_PAGE: "aircraft/readFromPage",
    AIRCRAFT_WRITE_TO_PAGE: "aircraft/writeToPage",
    AIRCRAFT_EXPORT: "aircraft/export",
    // 预设相关
    PRESET_LIST: "preset/list",
    PRESET_ADD: "preset/add",
    PRESET_UPDATE: "preset/update",
    PRESET_DELETE: "preset/delete",
    PRESET_APPLY: "preset/apply",
    PRESET_EXPORT: "preset/export",
    // 自动化日志
    AUTOMATION_LOG: "automation/log",
    // 数据管理
    DATA_EXPORT: "data/export",
    DATA_IMPORT: "data/import",
    DATA_CLEAR: "data/clear"
  };

  // bf-auto-plugin/content/cli-parser.js
  function parseCliDump(text) {
    const lines = String(text || "").split(/\r?\n/);
    const sets = {};
    const blocks = [];
    let profile = null;
    let rateprofile = null;
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      let m = line.match(/^profile\s+(\d+)$/);
      if (m) {
        profile = parseInt(m[1], 10);
        continue;
      }
      m = line.match(/^rateprofile\s+(\d+)$/);
      if (m) {
        rateprofile = parseInt(m[1], 10);
        continue;
      }
      m = line.match(/^set\s+(\S+)\s*=\s*(.+)$/);
      if (m) {
        sets[m[1]] = m[2].trim();
        continue;
      }
      blocks.push(line);
    }
    return { sets, blocks, profile, rateprofile, setCount: Object.keys(sets).length };
  }
  function num(v) {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : void 0;
  }
  function structuredIdleToCli(value) {
    return Math.round((Number(value) || 0) * 100);
  }
  var FILTER_KEYS = {
    gyroLp1Static: "gyro_lpf1_static_hz",
    gyroLp1Dynamic: "gyro_lpf1_dyn_max_hz",
    gyroLp2Static: "gyro_lpf2_static_hz",
    gyroNotchCount: "dyn_notch_count",
    gyroNotchQ: "dyn_notch_q",
    gyroNotchMinHz: "dyn_notch_min_hz",
    gyroNotchMaxHz: "dyn_notch_max_hz",
    dtermLp1Static: "dterm_lpf1_static_hz",
    dtermLp1Dynamic: "dterm_lpf1_dyn_max_hz",
    dtermLp1Expo: "dterm_lpf1_dyn_expo",
    dtermLp2Static: "dterm_lpf2_static_hz",
    yawLpStatic: "yaw_lowpass_hz"
  };
  function mapToStructured(sets) {
    const s = sets || {};
    const pid = {};
    const rates = {};
    const filter = {};
    const motor = {};
    for (const axis of ["roll", "pitch", "yaw"]) {
      const a = {};
      if (s["p_" + axis] !== void 0) a.p = num(s["p_" + axis]);
      if (s["i_" + axis] !== void 0) a.i = num(s["i_" + axis]);
      if (s["d_" + axis] !== void 0) a.dmax = num(s["d_" + axis]);
      if (s["d_min_" + axis] !== void 0) a.diff = num(s["d_min_" + axis]);
      if (s["f_" + axis] !== void 0) a.f = num(s["f_" + axis]);
      if (Object.keys(a).length) pid[axis] = a;
    }
    for (const axis of ["roll", "pitch", "yaw"]) {
      const a = {};
      if (s[axis + "_rc_rate"] !== void 0) a.centerSens = num(s[axis + "_rc_rate"]) * 10;
      if (s[axis + "_srate"] !== void 0) a.maxRate = num(s[axis + "_srate"]) * 10;
      if (s[axis + "_expo"] !== void 0) a.expo = num(s[axis + "_expo"]);
      if (Object.keys(a).length) rates[axis] = a;
    }
    if (s.throttle_limit_percent !== void 0) rates.throttleLimit = num(s.throttle_limit_percent);
    if (s.thr_expo !== void 0) rates.throttleExpo = num(s.thr_expo);
    if (Object.keys(rates).length) {
      rates.mode = (s.rates_type || "actual").toLowerCase();
    }
    for (const [key, cliName] of Object.entries(FILTER_KEYS)) {
      if (s[cliName] !== void 0) filter[key] = num(s[cliName]);
    }
    if (s.throttle_boost !== void 0) motor.throttleBoost = num(s.throttle_boost);
    if (s.motor_output_limit !== void 0) motor.motorOutputLimit = num(s.motor_output_limit);
    if (s.dyn_idle_min_rpm !== void 0) motor.dynamicIdle = num(s.dyn_idle_min_rpm);
    if (s.vbat_sag_compensation !== void 0) motor.vbatSagComp = num(s.vbat_sag_compensation);
    if (s.thrust_linear !== void 0) motor.thrustLinearization = num(s.thrust_linear);
    if (s.dshot_idle_value !== void 0) motor.motorIdle = num(s.dshot_idle_value) / 100;
    const out = {};
    if (Object.keys(pid).length) out.pid = pid;
    if (Object.keys(rates).length) out.rates = rates;
    if (Object.keys(filter).length) out.filter = filter;
    if (Object.keys(motor).length) out.motor = motor;
    return out;
  }
  function findCliErrorLines(delta) {
    return String(delta || "").split(/\r?\n/).map((l) => l.trim()).filter((l) => l && /error|invalid|unknown/i.test(l));
  }

  // bf-auto-plugin/editor/param-metadata.js
  var PID_KEYS = ["p", "i", "dmax", "diff", "f"];
  var PID_META = {
    p: {
      label: "P",
      cliPrefix: "p",
      min: 0,
      max: 200,
      step: 1,
      desc: "\u6BD4\u4F8B\u589E\u76CA\uFF0C\u76F4\u63A5\u51B3\u5B9A\u54CD\u5E94\u901F\u5EA6\u4E0E\u6746\u91CF\u8DDF\u624B\u5EA6"
    },
    i: {
      label: "I",
      cliPrefix: "i",
      min: 0,
      max: 200,
      step: 1,
      desc: "\u79EF\u5206\u589E\u76CA\uFF0C\u62B5\u6297\u5916\u529B\u4E0E\u91CD\u91CF\u5206\u5E03\u8BEF\u5DEE\u9020\u6210\u7684\u59FF\u6001\u6F02\u79FB"
    },
    dmax: {
      label: "DMax",
      cliPrefix: "d",
      min: 0,
      max: 100,
      step: 1,
      desc: "D \u9879\u6700\u5927\u503C\uFF0C\u6291\u5236 propwash \u4E0E\u5FEB\u901F\u673A\u52A8\u7684\u9707\u8361"
    },
    diff: {
      label: "D \u884D\u751F",
      cliPrefix: "d_min",
      min: 0,
      max: 100,
      step: 1,
      desc: "D \u9879\u4E0B\u9650\uFF0C\u9632\u6B62\u5FEB\u901F\u53CD\u6253\u65F6 D \u8F93\u51FA\u8DCC\u843D\u8FC7\u6DF1"
    },
    f: {
      label: "F",
      cliPrefix: "f",
      min: 0,
      max: 500,
      step: 1,
      desc: "\u524D\u9988\u589E\u76CA\uFF0C\u63D0\u5347\u5FEB\u901F\u6253\u6746\u65F6\u7684\u8DDF\u968F\u6027"
    }
  };
  var RATES_KEYS = ["centerSens", "maxRate", "expo"];
  var RATES_META = {
    centerSens: {
      label: "\u4E2D\u592E\u7075\u654F\u5EA6",
      cliSuffix: "rc_rate",
      min: 0,
      max: 250,
      step: 1,
      desc: "\u6447\u6746\u4E2D\u4F4D\u9644\u8FD1\u7684\u7075\u654F\u5EA6\uFF08UI \u503C = CLI rc_rate \xD710\uFF09"
    },
    maxRate: {
      label: "\u6700\u5927\u89D2\u901F\u7387",
      unit: "\xB0/s",
      cliSuffix: "srate",
      min: 0,
      max: 2e3,
      step: 10,
      desc: "\u6EE1\u6746\u65F6\u7684\u89D2\u901F\u7387\u4E0A\u9650\uFF08UI \u503C = CLI srate \xD710\uFF09"
    },
    expo: {
      label: "Expo",
      cliSuffix: "expo",
      min: 0,
      max: 1,
      step: 0.01,
      desc: "\u4E2D\u4F4D\u533A\u66F2\u7EBF\u67D4\u548C\u7A0B\u5EA6\uFF0C\u8D8A\u5927\u4E2D\u4F4D\u8D8A\u67D4\u548C"
    }
  };
  var RATES_EXTRA_KEYS = ["throttleLimit", "throttleExpo"];
  var RATES_EXTRA_META = {
    throttleLimit: {
      label: "\u6CB9\u95E8\u9650\u5236",
      unit: "%",
      cliName: "throttle_limit_percent",
      min: 25,
      max: 150,
      step: 1,
      desc: "\u6CB9\u95E8\u8F93\u51FA\u4E0A\u9650\u767E\u5206\u6BD4\uFF0C\u4FDD\u62A4\u7535\u8C03\u4E0E\u7535\u673A"
    },
    throttleExpo: {
      label: "\u6CB9\u95E8 Expo",
      cliName: "thr_expo",
      min: 0,
      max: 1,
      step: 0.01,
      desc: "\u6CB9\u95E8\u4E2D\u4F4D\u533A\u67D4\u548C\u7A0B\u5EA6"
    }
  };
  var FILTER_KEYS2 = [
    "gyroLp1Static",
    "gyroLp1Dynamic",
    "gyroLp2Static",
    "gyroNotchCount",
    "gyroNotchQ",
    "gyroNotchMinHz",
    "gyroNotchMaxHz",
    "dtermLp1Static",
    "dtermLp1Dynamic",
    "dtermLp1Expo",
    "dtermLp2Static",
    "yawLpStatic"
  ];
  var FILTER_META = {
    gyroLp1Static: {
      label: "\u9640\u87BA\u4EEA LP1 \u9759\u6001",
      unit: "Hz",
      cliName: "gyro_lpf1_static_hz",
      min: 0,
      max: 1e3,
      step: 1,
      desc: "\u9640\u87BA\u4EEA\u4E00\u9636\u4F4E\u901A\u9759\u6001\u622A\u6B62\u9891\u7387"
    },
    gyroLp1Dynamic: {
      label: "\u9640\u87BA\u4EEA LP1 \u52A8\u6001\u4E0A\u9650",
      unit: "Hz",
      cliName: "gyro_lpf1_dyn_max_hz",
      min: 0,
      max: 1e3,
      step: 1,
      desc: "\u52A8\u6001\u4F4E\u901A\u7684\u6700\u9AD8\u622A\u6B62\u9891\u7387\uFF08\u968F\u6CB9\u95E8\u6ED1\u52A8\uFF09"
    },
    gyroLp2Static: {
      label: "\u9640\u87BA\u4EEA LP2 \u9759\u6001",
      unit: "Hz",
      cliName: "gyro_lpf2_static_hz",
      min: 0,
      max: 1e3,
      step: 1,
      desc: "\u9640\u87BA\u4EEA\u4E8C\u9636\u4F4E\u901A\u9759\u6001\u622A\u6B62\u9891\u7387"
    },
    gyroNotchCount: {
      label: "\u52A8\u6001\u9677\u6CE2\u5668\u6570\u91CF",
      cliName: "dyn_notch_count",
      min: 0,
      max: 5,
      step: 1,
      integer: true,
      desc: "RPM/FF \u52A8\u6001\u9677\u6CE2\u6EE4\u6CE2\u5668\u7EA7\u6570"
    },
    gyroNotchQ: {
      label: "\u52A8\u6001\u9677\u6CE2 Q \u503C",
      cliName: "dyn_notch_q",
      min: 1,
      max: 500,
      step: 1,
      integer: true,
      desc: "\u9677\u6CE2\u5668\u54C1\u8D28\u56E0\u6570\uFF0C\u8D8A\u9AD8\u6EE4\u6CE2\u7A97\u53E3\u8D8A\u7A84\uFF08CLI \u9ED8\u8BA4 300\uFF09"
    },
    gyroNotchMinHz: {
      label: "\u52A8\u6001\u9677\u6CE2\u4E0B\u9650",
      unit: "Hz",
      cliName: "dyn_notch_min_hz",
      min: 0,
      max: 1e3,
      step: 1,
      desc: "\u52A8\u6001\u9677\u6CE2\u6700\u4F4E\u4E2D\u5FC3\u9891\u7387"
    },
    gyroNotchMaxHz: {
      label: "\u52A8\u6001\u9677\u6CE2\u4E0A\u9650",
      unit: "Hz",
      cliName: "dyn_notch_max_hz",
      min: 0,
      max: 1e3,
      step: 1,
      desc: "\u52A8\u6001\u9677\u6CE2\u6700\u9AD8\u4E2D\u5FC3\u9891\u7387"
    },
    dtermLp1Static: {
      label: "D \u9879 LP1 \u9759\u6001",
      unit: "Hz",
      cliName: "dterm_lpf1_static_hz",
      min: 0,
      max: 1e3,
      step: 1,
      desc: "D \u9879\u4E00\u9636\u4F4E\u901A\u9759\u6001\u622A\u6B62\u9891\u7387"
    },
    dtermLp1Dynamic: {
      label: "D \u9879 LP1 \u52A8\u6001\u4E0A\u9650",
      unit: "Hz",
      cliName: "dterm_lpf1_dyn_max_hz",
      min: 0,
      max: 1e3,
      step: 1,
      desc: "D \u9879\u52A8\u6001\u4F4E\u901A\u7684\u6700\u9AD8\u622A\u6B62\u9891\u7387"
    },
    dtermLp1Expo: {
      label: "D \u9879 LP1 Expo",
      cliName: "dterm_lpf1_dyn_expo",
      min: 0,
      max: 10,
      step: 1,
      integer: true,
      desc: "D \u9879\u52A8\u6001\u4F4E\u901A\u66F2\u7EBF\u6307\u6570\uFF08CLI \u9ED8\u8BA4 5\uFF09"
    },
    dtermLp2Static: {
      label: "D \u9879 LP2 \u9759\u6001",
      unit: "Hz",
      cliName: "dterm_lpf2_static_hz",
      min: 0,
      max: 1e3,
      step: 1,
      desc: "D \u9879\u4E8C\u9636\u4F4E\u901A\u9759\u6001\u622A\u6B62\u9891\u7387"
    },
    yawLpStatic: {
      label: "\u504F\u822A\u4F4E\u901A",
      unit: "Hz",
      cliName: "yaw_lowpass_hz",
      min: 0,
      max: 1e3,
      step: 1,
      desc: "\u504F\u822A\u8F74\u4F4E\u901A\u6EE4\u6CE2\u622A\u6B62\u9891\u7387"
    }
  };
  var MOTOR_KEYS = [
    "throttleBoost",
    "motorOutputLimit",
    "dynamicIdle",
    "vbatSagComp",
    "thrustLinearization",
    "motorIdle"
  ];
  var MOTOR_META = {
    throttleBoost: {
      label: "\u6CB9\u95E8\u52A0\u901F",
      unit: "%",
      cliName: "throttle_boost",
      min: 0,
      max: 100,
      step: 1,
      desc: "\u5FEB\u901F\u63A8\u6CB9\u95E8\u65F6\u7684\u54CD\u5E94\u52A0\u6210"
    },
    motorOutputLimit: {
      label: "\u7535\u673A\u8F93\u51FA\u9650\u5236",
      unit: "%",
      cliName: "motor_output_limit",
      min: 25,
      max: 100,
      step: 1,
      desc: "\u9650\u5236\u7535\u673A\u6700\u5927\u8F93\u51FA\u529F\u7387\uFF0C\u4FDD\u62A4\u52A8\u529B\u7CFB\u7EDF"
    },
    dynamicIdle: {
      label: "\u52A8\u6001\u6020\u901F",
      unit: "RPM",
      cliName: "dyn_idle_min_rpm",
      min: 0,
      max: 1e4,
      step: 100,
      desc: "\u52A8\u6001\u6020\u901F\u7684\u6700\u4F4E\u8F6C\u901F"
    },
    vbatSagComp: {
      label: "\u538B\u964D\u8865\u507F",
      unit: "%",
      cliName: "vbat_sag_compensation",
      min: 0,
      max: 150,
      step: 1,
      desc: "\u7535\u6C60\u7535\u538B\u8DCC\u843D\u65F6\u7684\u8865\u507F\u5F3A\u5EA6"
    },
    thrustLinearization: {
      label: "\u63A8\u529B\u7EBF\u6027\u5316",
      unit: "%",
      cliName: "thrust_linear",
      min: 0,
      max: 48,
      step: 1,
      desc: "\u63A8\u529B\u8F93\u51FA\u66F2\u7EBF\u7EBF\u6027\u5316\u7A0B\u5EA6\uFF0C\u6539\u5584\u6CB9\u95E8\u7EBF\u6027\u611F"
    },
    motorIdle: {
      label: "\u7535\u673A\u6020\u901F",
      cliName: "dshot_idle_value\uFF08\xF7100\uFF09",
      min: 0,
      max: 10,
      step: 0.1,
      desc: "\u7535\u673A\u6020\u901F\u5360\u7A7A\u6BD4\uFF08UI \u503C = CLI dshot_idle_value \xF7100\uFF09"
    }
  };
  var SECTION_TITLES = {
    pid: "PID \u8C03\u53C2",
    rates: "Rates \u4E0E\u6CB9\u95E8",
    filter: "\u6EE4\u6CE2\u5668",
    motor: "\u6CB9\u95E8\u548C\u7535\u673A\u8BBE\u7F6E"
  };
  function inferPrecision(meta) {
    const stepStr = String(meta.step ?? 1);
    const dot = stepStr.indexOf(".");
    return dot === -1 ? 0 : stepStr.length - dot - 1;
  }
  function validateParamValue(rawValue, meta) {
    const s = String(rawValue ?? "").trim();
    if (!s) {
      return { ok: false, error: "\u503C\u4E0D\u80FD\u4E3A\u7A7A" };
    }
    const n = Number(s);
    if (!Number.isFinite(n)) {
      return { ok: false, error: "\u5FC5\u987B\u662F\u6570\u5B57" };
    }
    if (meta.integer && !Number.isInteger(n)) {
      return { ok: false, error: "\u5FC5\u987B\u662F\u6574\u6570" };
    }
    if (n < meta.min || n > meta.max) {
      return { ok: false, error: `\u8D85\u51FA\u8303\u56F4 ${meta.min}\u2013${meta.max}` };
    }
    const p = inferPrecision(meta);
    const value = p > 0 ? Math.round(n * 10 ** p) / 10 ** p : Math.round(n);
    return { ok: true, value };
  }
  var RATE_UI_SCALE = 10;
  var EXPO_UI_SCALE = 100;
  var CLI_MAP = (() => {
    const map = {};
    for (const axis of ["roll", "pitch", "yaw"]) {
      for (const k of PID_KEYS) {
        map[`${PID_META[k].cliPrefix}_${axis}`] = { section: "pid", key: k, axis };
      }
      for (const k of RATES_KEYS) {
        const scaled = k === "centerSens" || k === "maxRate";
        const expo = k === "expo";
        map[`${axis}_${RATES_META[k].cliSuffix}`] = {
          section: "rates",
          key: k,
          axis,
          toUi: scaled ? (v) => v * RATE_UI_SCALE : expo ? (v) => v / EXPO_UI_SCALE : void 0,
          toCli: scaled ? (v) => v / RATE_UI_SCALE : expo ? (v) => Math.round(v * EXPO_UI_SCALE) : void 0
        };
      }
    }
    for (const k of RATES_EXTRA_KEYS) {
      const expo = k === "throttleExpo";
      map[RATES_EXTRA_META[k].cliName] = {
        section: "rates",
        key: k,
        ...expo ? { toUi: (v) => v / EXPO_UI_SCALE, toCli: (v) => Math.round(v * EXPO_UI_SCALE) } : {}
      };
    }
    for (const k of FILTER_KEYS2) {
      map[FILTER_META[k].cliName] = { section: "filter", key: k };
    }
    for (const k of MOTOR_KEYS) {
      map[k === "motorIdle" ? "dshot_idle_value" : MOTOR_META[k].cliName] = k === "motorIdle" ? { section: "motor", key: k, toUi: (v) => v / 100, toCli: structuredIdleToCli } : { section: "motor", key: k };
    }
    return map;
  })();
  function metaOf(def) {
    if (def.axis) return def.section === "pid" ? PID_META[def.key] : RATES_META[def.key];
    if (def.section === "rates") return RATES_EXTRA_META[def.key];
    if (def.section === "filter") return FILTER_META[def.key];
    return MOTOR_META[def.key];
  }
  function fmtCliValue(v) {
    return String(Number(Number(v).toFixed(4)));
  }
  function structuredToSets(structured) {
    const out = {};
    const s = structured || {};
    for (const [name, def] of Object.entries(CLI_MAP)) {
      let v;
      if (def.axis) v = s[def.section]?.[def.axis]?.[def.key];
      else v = s[def.section]?.[def.key];
      if (v === void 0 || v === null || v === "") continue;
      out[name] = def.toCli ? def.toCli(Number(v)) : Number(v);
    }
    return out;
  }
  function structuredToScript(structured) {
    const sets = structuredToSets(structured);
    const lines = ["# \u7531\u53C2\u6570\u7F16\u8F91\u5668\u81EA\u52A8\u751F\u6210\uFF08CLI \u503C\u57DF\uFF0C\u53EF\u76F4\u63A5\u7C98\u8D34\u5230 Betaflight CLI \u6267\u884C\uFF09"];
    for (const sec of ["pid", "rates", "filter", "motor"]) {
      const names = Object.keys(sets).filter((n) => CLI_MAP[n].section === sec);
      if (!names.length) continue;
      lines.push(`# ---- ${SECTION_TITLES[sec]} ----`);
      for (const n of names) lines.push(`set ${n} = ${fmtCliValue(sets[n])}`);
    }
    const extra = structured && structured.extra && typeof structured.extra === "object" ? Object.entries(structured.extra).filter(([, v]) => v !== void 0 && v !== null && v !== "") : [];
    if (extra.length) {
      lines.push("# ---- \u5176\u4ED6\u53C2\u6570 ----");
      for (const [n, v] of extra) lines.push(`set ${n} = ${v}`);
    }
    return lines.join("\n") + "\n";
  }
  function parseParamScript(text) {
    const sets = {};
    const unknown = [];
    String(text || "").split(/\r?\n/).forEach((raw, i) => {
      const line = raw.trim();
      if (!line || line.startsWith("#")) return;
      const m = line.match(/^set\s+(\S+)\s*=\s*(.+)$/);
      if (!m) return;
      const name = m[1];
      if (CLI_MAP[name]) sets[name] = m[2].trim();
      else unknown.push({ line: i + 1, name, value: m[2].trim() });
    });
    return { sets, unknown };
  }
  function applyScriptSets(sets, structured) {
    const applied = [];
    const failed = [];
    for (const [name, rawValue] of Object.entries(sets || {})) {
      const def = CLI_MAP[name];
      if (!def) {
        failed.push({ name, value: rawValue, reason: "\u672A\u8BC6\u522B\u7684\u53C2\u6570" });
        continue;
      }
      const parsed = parseFloat(rawValue);
      const uiRaw = def.toUi ? def.toUi(parsed) : parsed;
      const r = validateParamValue(uiRaw, metaOf(def));
      if (!r.ok) {
        failed.push({ name, value: rawValue, reason: r.error });
        continue;
      }
      if (def.axis) {
        structured[def.section] = structured[def.section] || {};
        structured[def.section][def.axis] = structured[def.section][def.axis] || {};
        structured[def.section][def.axis][def.key] = r.value;
      } else {
        structured[def.section] = structured[def.section] || {};
        structured[def.section][def.key] = r.value;
      }
      applied.push(name);
    }
    return { applied, failed };
  }
  function structuredToWriteCommands(structured) {
    const extra = structured && structured.extra && typeof structured.extra === "object" ? Object.entries(structured.extra).filter(([n, v]) => n && v !== void 0 && v !== null && v !== "") : [];
    const extraNames = new Set(extra.map(([n]) => n));
    const script = structuredToScript(structured);
    const { sets, unknown } = parseParamScript(script);
    const realUnknown = unknown.filter((u) => !extraNames.has(u.name));
    if (realUnknown.length) {
      const u = realUnknown[0];
      throw new Error(`\u672A\u8BC6\u522B\u7684 CLI \u53C2\u6570: ${u.name}\uFF08\u811A\u672C\u7B2C ${u.line} \u884C\uFF09`);
    }
    const { failed } = applyScriptSets(sets, {});
    if (failed.length) {
      const f = failed[0];
      throw new Error(`\u53C2\u6570\u6821\u9A8C\u5931\u8D25: ${f.name} = ${f.value}\uFF08${f.reason}\uFF09`);
    }
    const commands = String(script).split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
    const names = Object.keys(sets);
    const secSet = /* @__PURE__ */ new Set();
    for (const n of names) secSet.add(CLI_MAP[n].section);
    if (extraNames.size) {
      const extraInScript = commands.map((l) => l.match(/^set\s+(\S+)\s*=/)).filter(Boolean).map((m) => m[1]).filter((n) => extraNames.has(n));
      for (const n of extraInScript) names.push(n);
      secSet.add("extra");
    }
    return { commands, names, sections: [...secSet] };
  }

  // bf-auto-plugin/content/bf-web-adapter.js
  var PAGE_TEXT = {
    navPid: ["PID \u8C03\u53C2", "PID Tuning"],
    navCli: ["\u547D\u4EE4\u884C", "CLI"],
    cliClear: ["\u6E05\u9664\u8F93\u51FA\u5386\u53F2\u8BB0\u5F55", "Clear output history"]
  };
  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  function findVisibleButton(texts) {
    const candidates = texts.map((t) => t.toLowerCase());
    return [...document.querySelectorAll("button")].find((b) => {
      if (b.offsetParent === null) return false;
      return candidates.includes(b.textContent.trim().toLowerCase());
    }) || null;
  }
  function pressButton(btn) {
    const opts = { bubbles: true, cancelable: true, view: window };
    btn.scrollIntoView({ block: "center" });
    btn.dispatchEvent(new PointerEvent("pointerdown", opts));
    btn.dispatchEvent(new MouseEvent("mousedown", opts));
    btn.dispatchEvent(new PointerEvent("pointerup", opts));
    btn.dispatchEvent(new MouseEvent("mouseup", opts));
    btn.dispatchEvent(new MouseEvent("click", opts));
  }
  async function clickNav(texts, label) {
    const btn = findVisibleButton(texts);
    if (!btn) throw new Error(`\u5DE6\u4FA7\u83DC\u5355\u672A\u627E\u5230\u300C${label}\u300D\u5165\u53E3`);
    pressButton(btn);
    await sleep(1e3);
  }
  async function ensurePidPage() {
    await clickNav(PAGE_TEXT.navPid, "PID \u8C03\u53C2");
  }
  async function navigateToCli() {
    await clickNav(PAGE_TEXT.navCli, "\u547D\u4EE4\u884C");
  }
  function cliInput() {
    const ta = [...document.querySelectorAll("textarea")].find((t) => t.offsetParent !== null);
    if (!ta) throw new Error("CLI \u8F93\u5165\u6846\u672A\u627E\u5230\uFF08\u98DE\u63A7\u53EF\u80FD\u672A\u8FDE\u63A5\uFF09");
    return ta;
  }
  function cliOutputText() {
    const win = document.querySelector("div.cli-window");
    return win ? win.innerText : "";
  }
  async function clearCliOutput() {
    const btn = findVisibleButton(PAGE_TEXT.cliClear);
    if (btn) {
      pressButton(btn);
      await sleep(800);
    }
  }
  async function waitCliReady() {
    for (let i = 0; i < 24; i++) {
      await sleep(500);
      const t = cliOutputText();
      if (/Building AutoComplete Cache[\s\S]*Done!/.test(t)) {
        await sleep(300);
        return;
      }
      if (i >= 7 && /#\s*$/.test(t)) return;
    }
  }
  async function runCliCommand(cmd) {
    const preText = cliOutputText();
    const ta = cliInput();
    ta.focus();
    ta.value = cmd;
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    await sleep(300);
    ta.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Enter",
      keyCode: 13,
      bubbles: true,
      cancelable: true
    }));
    const lens = [];
    for (let i = 0; i < 120; i++) {
      await sleep(1e3);
      lens.push(cliOutputText().length);
      if (lens.length >= 3 && lens[lens.length - 1] === lens[lens.length - 2] && lens[lens.length - 1] === lens[lens.length - 3]) break;
    }
    const text = cliOutputText();
    let delta = text;
    if (preText && text.startsWith(preText)) delta = text.slice(preText.length);
    if (!delta.trim()) throw new Error("CLI \u65E0\u8F93\u51FA\uFF08\u547D\u4EE4\u672A\u6267\u884C\u6216\u98DE\u63A7\u672A\u8FDE\u63A5\uFF09");
    return delta;
  }
  var SECTION_LABELS = {
    pid: "PID\u8868",
    rates: "Rates",
    filter: "\u6EE4\u6CE2\u5668",
    motor: "\u6CB9\u95E8/\u7535\u673A\u8BBE\u7F6E"
  };
  async function writeAll(params, onProgress) {
    const p = params || {};
    const notify = (msg) => {
      if (onProgress) onProgress(0, 0, msg);
    };
    notify("\u751F\u6210 CLI \u5199\u5165\u547D\u4EE4...");
    const { commands, sections } = structuredToWriteCommands(p);
    if (!commands.length) {
      return { success: true, message: "\u65E0\u53EF\u5199\u5165\u53C2\u6570", sections: [], saved: true };
    }
    notify("\u8FDB\u5165\u547D\u4EE4\u884C\u9875...");
    await navigateToCli();
    notify("\u7B49\u5F85\u547D\u4EE4\u884C\u5C31\u7EEA...");
    await waitCliReady();
    await clearCliOutput();
    const total = commands.length;
    for (let i = 0; i < total; i++) {
      const cmd = commands[i];
      if (onProgress) onProgress(i + 1, total, `\u5199\u5165\u53C2\u6570 (${i + 1}/${total}): ${cmd}`);
      const delta = await runCliCommand(cmd);
      const errs = findCliErrorLines(delta);
      if (errs.length) {
        throw new Error(`CLI \u62D2\u7EDD\u547D\u4EE4\u300C${cmd}\u300D: ${errs.join(" | ")}`);
      }
    }
    if (onProgress) onProgress(total, total, "\u6267\u884C save \u4FDD\u5B58\uFF08\u98DE\u63A7\u5C06\u91CD\u542F\u65AD\u8FDE\uFF09...");
    const saveDelta = await runCliCommand("save");
    const saveErrs = findCliErrorLines(saveDelta);
    if (saveErrs.length) {
      throw new Error(`CLI \u62D2\u7EDD\u547D\u4EE4\u300Csave\u300D: ${saveErrs.join(" | ")}`);
    }
    try {
      await ensurePidPage();
    } catch (e) {
      console.warn("[BfWebAdapter] save \u91CD\u542F\u540E\u8FD4\u56DE PID \u9875\u5931\u8D25\uFF08\u9884\u671F\u526F\u4F5C\u7528\uFF09: " + e.message);
    }
    return {
      success: true,
      message: `\u5DF2\u901A\u8FC7 CLI \u5199\u5165 ${total} \u9879\u53C2\u6570\u5E76\u4FDD\u5B58`,
      sections: sections.map((k) => SECTION_LABELS[k] || k),
      saved: true
    };
  }
  async function exportViaCli(mode = "dump", onStatus) {
    const cmd = mode === "diff" ? "diff" : "dump";
    const notify = (msg) => {
      if (onStatus) onStatus(msg);
    };
    notify("\u8FDB\u5165\u547D\u4EE4\u884C\u9875...");
    await navigateToCli();
    notify("\u7B49\u5F85\u547D\u4EE4\u884C\u5C31\u7EEA...");
    await waitCliReady();
    await clearCliOutput();
    notify(`\u6267\u884C ${cmd} \u547D\u4EE4\u5E76\u6293\u53D6\u8F93\u51FA...`);
    const raw = await runCliCommand(cmd);
    notify("\u89E3\u6790\u53C2\u6570...");
    const parsed = parseCliDump(raw);
    const structured = mapToStructured(parsed.sets);
    try {
      await ensurePidPage();
    } catch (e) {
      console.warn("[BfWebAdapter] \u5BFC\u51FA\u540E\u8FD4\u56DE PID \u9875\u5931\u8D25\uFF08\u9884\u671F\u526F\u4F5C\u7528\uFF09: " + e.message);
    }
    return {
      mode: cmd,
      raw,
      structured,
      paramCount: parsed.setCount,
      profile: parsed.profile,
      rateprofile: parsed.rateprofile
    };
  }

  // bf-auto-plugin/content/parameter-reader.js
  var ParameterReader = {
    /**
     * 导出飞控参数（CLI dump/diff）
     * @param {'dump'|'diff'} [mode] - dump=全量参数，diff=仅修改过的参数
     * @param {function} [onStatus] - 进度提示回调 (msg) => void
     * @returns {Promise<{mode:string, raw:string, structured:object,
     *   paramCount:number, profile:number|null, rateprofile:number|null}>}
     */
    async readAll(mode = "dump", onStatus) {
      const result = await exportViaCli(mode, onStatus);
      console.log("[ParameterReader] CLI \u5BFC\u51FA\u5B8C\u6210:", result.mode, result.paramCount, "\u53C2\u6570");
      return result;
    }
  };

  // bf-auto-plugin/content/selectors.js
  var SELECTORS = {
    /**
     * 登录页面选择器
     * 注意：BetaFlight Configurator 通常不需要登录，这里预留用于自定义门户
     */
    LOGIN: {
      EMAIL_INPUT: '#email, input[type="email"], input[name="email"], input[placeholder*="\u90AE\u7BB1" i], input[placeholder*="email" i]',
      PASSWORD_INPUT: '#password, input[type="password"], input[name="password"], input[placeholder*="\u5BC6\u7801" i], input[placeholder*="password" i]',
      LOGIN_BUTTON: '#login-button, button[type="submit"], button.btn-primary, .login-button',
      ERROR_MESSAGE: '.error-message, .alert-danger, [role="alert"], .text-danger, .notification-error'
    },
    /**
     * 顶部导航选择器
     * BetaFlight Configurator 使用标签页导航
     */
    NAV: {
      DASHBOARD: 'a[href*="dashboard"], [data-tab="dashboard"], .nav-item:first-child',
      PID_TUNING: 'a[href*="pid"], [data-tab="pid"]',
      RATES: 'a[href*="rate"], [data-tab="rates"]',
      FILTERS: 'a[href*="filter"], [data-tab="filters"]',
      MOTORS: 'a[href*="motor"], [data-tab="motors"]',
      SAVE_BUTTON: '#save-button, button[type="submit"].btn-primary',
      // 用于检测页面是否加载完成
      PAGE_LOADED: ".tab-content, .page-content, main, #app"
    },
    /**
     * PID 调参页面选择器
     * BetaFlight Configurator PID Tuning 标签页
     * 
     * 选择器说明：
     * - 优先使用 data-field 属性（如果存在）
     * - 其次使用 name/id 属性组合
     * - 最后使用 placeholder 或 class
     */
    PID: {
      // Roll PID
      ROLL_P: '[data-field="pidProfile.roll_p"], input[name*="roll_p" i], input[id*="roll-p" i], .pid-roll-p, input[placeholder*="Roll P" i]',
      ROLL_I: '[data-field="pidProfile.roll_i"], input[name*="roll_i" i], input[id*="roll-i" i], .pid-roll-i, input[placeholder*="Roll I" i]',
      ROLL_D: '[data-field="pidProfile.roll_d"], input[name*="roll_d" i], input[id*="roll-d" i], .pid-roll-d, input[placeholder*="Roll D" i]',
      // Pitch PID
      PITCH_P: '[data-field="pidProfile.pitch_p"], input[name*="pitch_p" i], input[id*="pitch-p" i], .pid-pitch-p, input[placeholder*="Pitch P" i]',
      PITCH_I: '[data-field="pidProfile.pitch_i"], input[name*="pitch_i" i], input[id*="pitch-i" i], .pid-pitch-i, input[placeholder*="Pitch I" i]',
      PITCH_D: '[data-field="pidProfile.pitch_d"], input[name*="pitch_d" i], input[id*="pitch-d" i], .pid-pitch-d, input[placeholder*="Pitch D" i]',
      // Yaw PID
      YAW_P: '[data-field="pidProfile.yaw_p"], input[name*="yaw_p" i], input[id*="yaw-p" i], .pid-yaw-p, input[placeholder*="Yaw P" i]',
      YAW_I: '[data-field="pidProfile.yaw_i"], input[name*="yaw_i" i], input[id*="yaw-i" i], .pid-yaw-i, input[placeholder*="Yaw I" i]',
      YAW_D: '[data-field="pidProfile.yaw_d"], input[name*="yaw_d" i], input[id*="yaw-d" i], .pid-yaw-d, input[placeholder*="Yaw D" i]'
    },
    /**
     * Rates 页面选择器
     * BetaFlight Configurator Rates 标签页
     * 
     * 注意：Rates 可能有多种模式（Betaflight, RaceFlight, Kiss 等）
     * 选择器基于默认的 Betaflight 模式
     */
    RATES: {
      // Roll Rates
      ROLL_RC_RATE: '[data-field="rates.roll_rcRate"], input[name*="roll_rc_rate" i], input[id*="roll-rc-rate" i], .rate-roll-rc',
      ROLL_SUPER_RATE: '[data-field="rates.roll_superRate"], input[name*="roll_super" i], input[id*="roll-super-rate" i], .rate-roll-super',
      ROLL_EXPO: '[data-field="rates.roll_expo"], input[name*="roll_expo" i], input[id*="roll-expo" i], .rate-roll-expo',
      // Pitch Rates
      PITCH_RC_RATE: '[data-field="rates.pitch_rcRate"], input[name*="pitch_rc_rate" i], input[id*="pitch-rc-rate" i], .rate-pitch-rc',
      PITCH_SUPER_RATE: '[data-field="rates.pitch_superRate"], input[name*="pitch_super" i], input[id*="pitch-super-rate" i], .rate-pitch-super',
      PITCH_EXPO: '[data-field="rates.pitch_expo"], input[name*="pitch_expo" i], input[id*="pitch-expo" i], .rate-pitch-expo',
      // Yaw Rates
      YAW_RC_RATE: '[data-field="rates.yaw_rcRate"], input[name*="yaw_rc_rate" i], input[id*="yaw-rc-rate" i], .rate-yaw-rc',
      YAW_SUPER_RATE: '[data-field="rates.yaw_superRate"], input[name*="yaw_super" i], input[id*="yaw-super-rate" i], .rate-yaw-super',
      YAW_EXPO: '[data-field="rates.yaw_expo"], input[name*="yaw_expo" i], input[id*="yaw-expo" i], .rate-yaw-expo'
    },
    /**
     * 滤波器页面选择器
     * BetaFlight Configurator Filters 标签页
     */
    FILTER: {
      // Gyro 滤波器
      GYRO_LOWPASS: '[data-field="gyroLowpassHz"], input[name*="gyro_lowpass" i], input[id*="gyro-lowpass" i], .filter-gyro-lowpass',
      GYRO_NOTCH: '[data-field="gyroNotchHz"], input[name*="gyro_notch" i], input[id*="gyro-notch" i], .filter-gyro-notch',
      // D-Term 滤波器
      DTERM_LOWPASS: '[data-field="dtermLowpassHz"], input[name*="dterm_lowpass" i], input[id*="dterm-lowpass" i], .filter-dterm-lowpass',
      DTERM_NOTCH: '[data-field="dtermNotchHz"], input[name*="dterm_notch" i], input[id*="dterm-notch" i], .filter-dterm-notch'
    },
    /**
     * 电机页面选择器
     * BetaFlight Configurator Motors 标签页
     */
    MOTOR: {
      MIN_THROTTLE: '[data-field="motorConfig.minthrottle"], input[name*="min_throttle" i], input[id*="min-throttle" i], .motor-min-throttle',
      MAX_THROTTLE: '[data-field="motorConfig.maxthrottle"], input[name*="max_throttle" i], input[id*="max-throttle" i], .motor-max-throttle',
      MIN_COMMAND: '[data-field="motorConfig.mincommand"], input[name*="min_command" i], input[id*="min-command" i], .motor-min-command'
    },
    /**
     * 通用 UI 元素选择器
     */
    GENERAL: {
      LOADING: '.loading, .spinner, [aria-busy="true"], .progress-bar, .loading-overlay',
      NOTIFICATION: '.notification, .toast, .alert, [role="alert"], .snackbar',
      CONFIRM_BUTTON: 'button.btn-confirm, button.btn-primary, button[type="submit"]',
      CANCEL_BUTTON: "button.btn-cancel",
      MODAL: '.modal, .dialog, [role="dialog"], .popup'
    },
    /**
     * 飞控连接相关选择器
     * BetaFlight Configurator 左上角端口选择区域
     * 
     * 连接检测逻辑：
     * 1. 检查 Disconnect 按钮是否可见 -> 已连接
     * 2. 检查 Connect 按钮是否可见 -> 未连接
     * 3. 检查状态文字内容
     * 4. 检查端口选择框状态
     */
    FC_CONNECTION: {
      // 连接按钮（未连接时显示）
      // 注意：:has-text() 是 Playwright 语法，原生 querySelector 会抛 SyntaxError，
      // 文本匹配一律用 JS 遍历实现（见 content-module 方案0）
      CONNECT_BUTTON: '#connect-button, button#connect, .connect-btn, button[title*="Connect" i], button[aria-label*="Connect" i], button[aria-label*="\u8FDE\u63A5"]',
      // 断开连接按钮（已连接时显示）
      DISCONNECT_BUTTON: '#disconnect-button, button#disconnect, .disconnect-btn, button[title*="Disconnect" i], button[aria-label*="Disconnect" i], button[aria-label*="\u65AD\u5F00"]',
      // 端口选择下拉框
      PORT_SELECT: '#port-select, select#port, .port-selector select, #firmware-virtual-port, select[name*="port" i]',
      // 连接状态文字（某些版本显示 "PORT_CLOSED" 或端口名）
      STATUS_TEXT: '.port-status, .connection-status, #port-status, .header-bar .status, [class*="port-state"]',
      // 波特率选择
      BAUDRATE_SELECT: '#baudrate-select, select#baudrate, .baudrate-select select, select[name*="baudrate" i]',
      // 端口刷新按钮
      REFRESH_BUTTON: '#refresh-button, button#refresh, button[title*="Refresh" i]'
    }
  };

  // bf-auto-plugin/shared/constants.js
  var DEFAULT_TIMEOUT = 5e3;
  var POLL_INTERVAL = 100;

  // bf-auto-plugin/content/dom-operator.js
  async function waitForElement(selector, timeout = DEFAULT_TIMEOUT) {
    const startTime = Date.now();
    const selectors = selector.split(",").map((s) => s.trim());
    while (Date.now() - startTime < timeout) {
      for (const sel of selectors) {
        const element = document.querySelector(sel);
        if (element && element.offsetParent !== null) {
          return element;
        }
      }
      await sleep2(POLL_INTERVAL);
    }
    throw new Error(`\u7B49\u5F85\u5143\u7D20\u8D85\u65F6 (selector=${selector}, timeout=${timeout}ms)`);
  }
  function findElementByText(baseSelector, text, exactMatch = false) {
    const elements = document.querySelectorAll(baseSelector);
    const searchText = text.toLowerCase();
    for (let el of elements) {
      const elText = el.textContent.trim().toLowerCase();
      if (exactMatch) {
        if (elText === searchText) return el;
      } else {
        if (elText.includes(searchText)) return el;
      }
    }
    return null;
  }
  async function inputText({ selector, text, triggerEvents = true, timeout = DEFAULT_TIMEOUT }) {
    try {
      const element = await waitForElement(selector, timeout);
      element.focus();
      element.value = text;
      if (triggerEvents) {
        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
      }
      element.blur();
      console.log(`[DOMOperator] \u8F93\u5165\u6587\u672C\u6210\u529F (selector=${selector}, text=${text})`);
    } catch (error) {
      console.error(`[DOMOperator] \u8F93\u5165\u6587\u672C\u5931\u8D25 (selector=${selector}):`, error);
      throw error;
    }
  }
  async function clickElement(selector, timeout = DEFAULT_TIMEOUT, buttonText = null) {
    try {
      let element;
      if (buttonText) {
        element = findElementByText(selector, buttonText, false);
      }
      if (!element) {
        element = await waitForElement(selector, timeout);
      }
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      await sleep2(100);
      element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
      element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      console.log(`[DOMOperator] \u70B9\u51FB\u5143\u7D20\u6210\u529F (selector=${selector})`);
    } catch (error) {
      console.error(`[DOMOperator] \u70B9\u51FB\u5143\u7D20\u5931\u8D25 (selector=${selector}):`, error);
      throw error;
    }
  }
  function sleep2(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // bf-auto-plugin/content/parameter-writer.js
  var ParameterWriter = {
    /**
     * 写入所有参数（新版 UI 适配层，含保存）
     * @param {object} params - 所有参数
     * @param {function} onProgress - 进度回调
     * @returns {Promise<object>} 写入结果 {success, saved, sections, message}
     */
    async writeAll(params, onProgress) {
      try {
        return await writeAll(params, onProgress);
      } catch (error) {
        console.error("[ParameterWriter] \u5199\u5165\u53C2\u6570\u5931\u8D25:", error);
        return { success: false, error: error.message };
      }
    },
    /**
     * 写入 PID 参数
     * @param {object} pid - PID 参数
     */
    async writePID(pid) {
      if (!pid) return;
      try {
        await waitForElement(SELECTORS.PID.ROLL_P, 5e3).catch(() => null);
        if (pid.roll) {
          await inputText({ selector: SELECTORS.PID.ROLL_P, text: String(pid.roll.P) }).catch(() => {
          });
          await inputText({ selector: SELECTORS.PID.ROLL_I, text: String(pid.roll.I) }).catch(() => {
          });
          await inputText({ selector: SELECTORS.PID.ROLL_D, text: String(pid.roll.D) }).catch(() => {
          });
        }
        if (pid.pitch) {
          await inputText({ selector: SELECTORS.PID.PITCH_P, text: String(pid.pitch.P) }).catch(() => {
          });
          await inputText({ selector: SELECTORS.PID.PITCH_I, text: String(pid.pitch.I) }).catch(() => {
          });
          await inputText({ selector: SELECTORS.PID.PITCH_D, text: String(pid.pitch.D) }).catch(() => {
          });
        }
        if (pid.yaw) {
          await inputText({ selector: SELECTORS.PID.YAW_P, text: String(pid.yaw.P) }).catch(() => {
          });
          await inputText({ selector: SELECTORS.PID.YAW_I, text: String(pid.yaw.I) }).catch(() => {
          });
          await inputText({ selector: SELECTORS.PID.YAW_D, text: String(pid.yaw.D) }).catch(() => {
          });
        }
        console.log("[ParameterWriter] \u5199\u5165 PID \u6210\u529F:", pid);
      } catch (error) {
        console.error("[ParameterWriter] \u5199\u5165 PID \u5931\u8D25:", error);
        throw error;
      }
    },
    /**
     * 写入 Rates 参数
     * @param {object} rates - Rates 参数
     */
    async writeRates(rates) {
      if (!rates) return;
      try {
        await waitForElement(SELECTORS.RATES.ROLL_RC_RATE, 5e3).catch(() => null);
        if (rates.roll) {
          await inputText({ selector: SELECTORS.RATES.ROLL_RC_RATE, text: String(rates.roll.rcRate) }).catch(() => {
          });
          await inputText({ selector: SELECTORS.RATES.ROLL_SUPER_RATE, text: String(rates.roll.superRate) }).catch(() => {
          });
          await inputText({ selector: SELECTORS.RATES.ROLL_EXPO, text: String(rates.roll.expo) }).catch(() => {
          });
        }
        if (rates.pitch) {
          await inputText({ selector: SELECTORS.RATES.PITCH_RC_RATE, text: String(rates.pitch.rcRate) }).catch(() => {
          });
          await inputText({ selector: SELECTORS.RATES.PITCH_SUPER_RATE, text: String(rates.pitch.superRate) }).catch(() => {
          });
          await inputText({ selector: SELECTORS.RATES.PITCH_EXPO, text: String(rates.pitch.expo) }).catch(() => {
          });
        }
        if (rates.yaw) {
          await inputText({ selector: SELECTORS.RATES.YAW_RC_RATE, text: String(rates.yaw.rcRate) }).catch(() => {
          });
          await inputText({ selector: SELECTORS.RATES.YAW_SUPER_RATE, text: String(rates.yaw.superRate) }).catch(() => {
          });
          await inputText({ selector: SELECTORS.RATES.YAW_EXPO, text: String(rates.yaw.expo) }).catch(() => {
          });
        }
        console.log("[ParameterWriter] \u5199\u5165 Rates \u6210\u529F:", rates);
      } catch (error) {
        console.error("[ParameterWriter] \u5199\u5165 Rates \u5931\u8D25:", error);
        throw error;
      }
    },
    /**
     * 写入滤波器参数
     * @param {object} filter - 滤波器参数
     */
    async writeFilter(filter) {
      if (!filter) return;
      try {
        await waitForElement(SELECTORS.FILTER.GYRO_LOWPASS, 5e3).catch(() => null);
        await inputText({ selector: SELECTORS.FILTER.GYRO_LOWPASS, text: String(filter.gyroLowpass) }).catch(() => {
        });
        await inputText({ selector: SELECTORS.FILTER.GYRO_NOTCH, text: String(filter.gyroNotch) }).catch(() => {
        });
        await inputText({ selector: SELECTORS.FILTER.DTERM_LOWPASS, text: String(filter.dTermLowpass) }).catch(() => {
        });
        console.log("[ParameterWriter] \u5199\u5165\u6EE4\u6CE2\u5668\u6210\u529F:", filter);
      } catch (error) {
        console.error("[ParameterWriter] \u5199\u5165\u6EE4\u6CE2\u5668\u5931\u8D25:", error);
        throw error;
      }
    },
    /**
     * 写入电机参数
     * @param {object} motor - 电机参数
     */
    async writeMotor(motor) {
      if (!motor) return;
      try {
        await waitForElement(SELECTORS.MOTOR.MIN_THROTTLE, 5e3).catch(() => null);
        await inputText({ selector: SELECTORS.MOTOR.MIN_THROTTLE, text: String(motor.minThrottle) }).catch(() => {
        });
        await inputText({ selector: SELECTORS.MOTOR.MAX_THROTTLE, text: String(motor.maxThrottle) }).catch(() => {
        });
        await inputText({ selector: SELECTORS.MOTOR.MIN_COMMAND, text: String(motor.minCommand) }).catch(() => {
        });
        console.log("[ParameterWriter] \u5199\u5165\u7535\u673A\u6210\u529F:", motor);
      } catch (error) {
        console.error("[ParameterWriter] \u5199\u5165\u7535\u673A\u5931\u8D25:", error);
        throw error;
      }
    }
  };

  // bf-auto-plugin/content/automation-engine.js
  var AutomationEngine = {
    /**
     * 执行登录自动化
     * @param {object} credentials - 登录凭证 { email, password }
     * @returns {Promise<object>} 执行结果
     */
    async login(credentials) {
      try {
        console.log("[AutomationEngine] \u5F00\u59CB\u81EA\u52A8\u767B\u5F55");
        await inputText({
          selector: SELECTORS.LOGIN.EMAIL_INPUT,
          text: credentials.email,
          triggerEvents: true
        });
        await inputText({
          selector: SELECTORS.LOGIN.PASSWORD_INPUT,
          text: credentials.password,
          triggerEvents: true
        });
        await clickElement(SELECTORS.LOGIN.LOGIN_BUTTON);
        await this.waitForNavigation();
        console.log("[AutomationEngine] \u81EA\u52A8\u767B\u5F55\u5B8C\u6210");
        return { success: true, message: "\u767B\u5F55\u6210\u529F" };
      } catch (error) {
        console.error("[AutomationEngine] \u81EA\u52A8\u767B\u5F55\u5931\u8D25:", error);
        return { success: false, error: error.message };
      }
    },
    /**
     * 执行读取参数自动化（实际实现，CLI dump/diff 导出）
     * @param {'dump'|'diff'} [mode] - dump=全量参数，diff=仅修改过的参数
     * @param {function} [onStatus] - 进度提示回调 (msg) => void
     * @returns {Promise<object>} 导出结果 { mode, raw, structured, paramCount, ... }
     */
    async readParametersFromPage(mode = "dump", onStatus) {
      try {
        console.log("[AutomationEngine] \u5F00\u59CB CLI \u53C2\u6570\u5BFC\u51FA (mode=" + mode + ")");
        const params = await ParameterReader.readAll(mode, onStatus);
        console.log("[AutomationEngine] \u53C2\u6570\u5BFC\u51FA\u5B8C\u6210:", params.mode, params.paramCount, "\u53C2\u6570");
        return { success: true, data: params };
      } catch (error) {
        console.error("[AutomationEngine] \u53C2\u6570\u5BFC\u51FA\u5931\u8D25:", error);
        return { success: false, error: { message: error.message } };
      }
    },
    /**
     * 执行写入参数自动化（实际实现）
     * @param {object} params - 要写入的参数
     * @returns {Promise<object>} 执行结果
     */
    async writeParametersToPage(params) {
      try {
        console.log("[AutomationEngine] \u5F00\u59CB\u5199\u5165\u53C2\u6570\u5230\u9875\u9762");
        const result = await ParameterWriter.writeAll(params, (current, total, message) => {
          console.log(`[AutomationEngine] \u5199\u5165\u8FDB\u5EA6: ${message}`);
        });
        if (result.success) {
          if (!result.saved) {
            await this.saveConfiguration();
          }
          console.log("[AutomationEngine] \u53C2\u6570\u5199\u5165\u5B8C\u6210");
          return { success: true, message: "\u53C2\u6570\u5199\u5165\u6210\u529F", sections: result.sections };
        } else {
          throw new Error(result.error || "\u5199\u5165\u5931\u8D25");
        }
      } catch (error) {
        console.error("[AutomationEngine] \u5199\u5165\u53C2\u6570\u5931\u8D25:", error);
        return { success: false, error: error.message };
      }
    },
    /**
     * 保存配置（点击保存按钮）
     */
    async saveConfiguration() {
      try {
        await clickElement(SELECTORS.NAV.SAVE_BUTTON);
        await sleep3(1e3);
        console.log("[AutomationEngine] \u914D\u7F6E\u5DF2\u4FDD\u5B58");
      } catch (error) {
        console.warn("[AutomationEngine] \u4FDD\u5B58\u914D\u7F6E\u5931\u8D25\uFF08\u53EF\u80FD\u4E0D\u9700\u8981\u4FDD\u5B58\uFF09:", error);
      }
    },
    /**
     * 等待页面跳转（检测 URL 变化或特定元素出现）
     * @param {string} [targetSelector] - 可选，跳转后应该出现的元素选择器
     * @param {number} timeout - 超时时间（毫秒），默认 10 秒
     */
    async waitForNavigation(targetSelector = null, timeout = 1e4) {
      const startTime = Date.now();
      const initialUrl = window.location.href;
      return new Promise((resolve, reject) => {
        const check = () => {
          if (window.location.href !== initialUrl) {
            console.log("[AutomationEngine] \u9875\u9762 URL \u5DF2\u53D8\u5316");
            resolve();
            return;
          }
          if (targetSelector) {
            const targetElement = document.querySelector(targetSelector);
            if (targetElement && targetElement.offsetParent !== null) {
              console.log(`[AutomationEngine] \u76EE\u6807\u5143\u7D20\u5DF2\u51FA\u73B0: ${targetSelector}`);
              resolve();
              return;
            }
          }
          if (Date.now() - startTime > timeout) {
            console.warn("[AutomationEngine] \u7B49\u5F85\u9875\u9762\u8DF3\u8F6C\u8D85\u65F6");
            resolve();
            return;
          }
          setTimeout(check, 200);
        };
        check();
      });
    }
  };
  function sleep3(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // bf-auto-plugin/content/content-module.js
  function init() {
    if (window.__BF_CONTENT_LOADED__) {
      console.log("[Content] \u5DF2\u52A0\u8F7D\uFF0C\u8DF3\u8FC7\u91CD\u590D\u6CE8\u5165");
      return;
    }
    window.__BF_CONTENT_LOADED__ = true;
    console.log("[Content] BetaFlight Auto Tuning Content Script \u5DF2\u52A0\u8F7D (v1.1.0)");
    initMessageListener();
    injectLogPanel();
  }
  function initMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      handleMessage(message, sender, sendResponse);
      return true;
    });
  }
  async function handleMessage(message, sender, sendResponse) {
    try {
      const { source, target, action, payload } = message;
      console.log(`[Content] \u6536\u5230\u6D88\u606F: ${action} (from=${source})`);
      if (target !== MessageTarget.CONTENT) {
        sendResponse({ success: false, error: { message: "\u6D88\u606F\u76EE\u6807\u4E0D\u662F content" } });
        return;
      }
      let result;
      switch (action) {
        case MessageAction.CHECK_FC_CONNECTION:
          result = await handleCheckFCConnection();
          break;
        case MessageAction.CLICK_CONNECT_BUTTON:
          result = await handleClickConnectButton();
          break;
        case MessageAction.AIRCRAFT_READ_FROM_PAGE:
          result = await handleReadFromPage(payload);
          break;
        case MessageAction.AIRCRAFT_WRITE_TO_PAGE:
          result = await handleWriteToPage(payload);
          break;
        case MessageAction.AUTOMATION_LOG:
          result = await handleLog(payload);
          break;
        default:
          result = { success: false, error: { message: `\u672A\u77E5\u7684\u6D88\u606F\u52A8\u4F5C: ${action}` } };
      }
      sendResponse(result);
    } catch (error) {
      console.error("[Content] \u5904\u7406\u6D88\u606F\u5931\u8D25:", error);
      sendResponse({ success: false, error: { message: error.message } });
    }
  }
  async function handleCheckFCConnection() {
    try {
      console.log("[Content] \u68C0\u6D4B\u98DE\u63A7\u8FDE\u63A5\u72B6\u6001...");
      const visibleButtons = [...document.querySelectorAll("button")].filter((b) => b.offsetParent !== null);
      const btnLabel = (b) => ((b.textContent || "") + " " + (b.getAttribute("aria-label") || "")).trim();
      const disconnectBtn = visibleButtons.find((b) => /断开|disconnect/i.test(btnLabel(b)));
      if (disconnectBtn) {
        const details2 = `\u5DF2\u8FDE\u63A5\uFF08\u65B0\u7248UI\u68C0\u6D4B\u5230\u65AD\u5F00\u6309\u94AE: ${btnLabel(disconnectBtn).slice(0, 24)}\uFF09`;
        console.log("[Content] " + details2);
        return { success: true, data: { connected: true, details: details2 } };
      }
      const connectBtn = visibleButtons.find((b) => /^(连接|Connect)$/i.test(b.textContent.trim()) || /^(连接|Connect)$/i.test((b.getAttribute("aria-label") || "").trim()));
      if (connectBtn) {
        const details2 = "\u672A\u8FDE\u63A5\uFF08\u65B0\u7248UI\u68C0\u6D4B\u5230\u8FDE\u63A5\u6309\u94AE\uFF09";
        console.log("[Content] " + details2);
        return { success: true, data: { connected: false, details: details2 } };
      }
      const disconnectBtnLegacy = document.querySelector(SELECTORS.FC_CONNECTION.DISCONNECT_BUTTON);
      if (disconnectBtnLegacy && disconnectBtnLegacy.offsetParent !== null) {
        const details2 = `\u5DF2\u8FDE\u63A5\uFF08\u68C0\u6D4B\u5230 Disconnect \u6309\u94AE: ${disconnectBtnLegacy.textContent.trim()}\uFF09`;
        console.log("[Content] " + details2);
        return { success: true, data: { connected: true, details: details2 } };
      }
      const connectBtnLegacy = document.querySelector(SELECTORS.FC_CONNECTION.CONNECT_BUTTON);
      if (connectBtnLegacy && connectBtnLegacy.offsetParent !== null) {
        const details2 = `\u672A\u8FDE\u63A5\uFF08\u68C0\u6D4B\u5230 Connect \u6309\u94AE: ${connectBtnLegacy.textContent.trim()}\uFF09`;
        console.log("[Content] " + details2);
        return { success: true, data: { connected: false, details: details2 } };
      }
      const statusText = document.querySelector(SELECTORS.FC_CONNECTION.STATUS_TEXT);
      if (statusText) {
        const text = statusText.textContent.toLowerCase();
        if (text.includes("port_close") || text.includes("\u672A\u8FDE\u63A5") || text.includes("disconnected")) {
          const details2 = `\u672A\u8FDE\u63A5\uFF08\u72B6\u6001\u6587\u5B57: ${statusText.textContent.trim()}\uFF09`;
          console.log("[Content] " + details2);
          return { success: true, data: { connected: false, details: details2 } };
        } else if (text.includes("com") || text.includes("tty") || text.includes("connected")) {
          const details2 = `\u5DF2\u8FDE\u63A5\uFF08\u72B6\u6001\u6587\u5B57: ${statusText.textContent.trim()}\uFF09`;
          console.log("[Content] " + details2);
          return { success: true, data: { connected: true, details: details2 } };
        }
      }
      const portSelect = document.querySelector(SELECTORS.FC_CONNECTION.PORT_SELECT);
      if (portSelect && portSelect.offsetParent !== null) {
        const details2 = "\u672A\u8FDE\u63A5\uFF08\u68C0\u6D4B\u5230\u7AEF\u53E3\u9009\u62E9\u6846\uFF09";
        console.log("[Content] " + details2);
        return { success: true, data: { connected: false, details: details2 } };
      }
      const details = "\u65E0\u6CD5\u786E\u5B9A\u8FDE\u63A5\u72B6\u6001\uFF08\u672A\u68C0\u6D4B\u5230\u8FDE\u63A5/\u65AD\u5F00\u6309\u94AE\uFF09";
      console.warn("[Content] " + details);
      return { success: true, data: { connected: false, details, uncertain: true } };
    } catch (error) {
      console.error("[Content] \u68C0\u6D4B\u98DE\u63A7\u8FDE\u63A5\u5931\u8D25:", error);
      return { success: false, error: { message: error.message } };
    }
  }
  async function handleClickConnectButton() {
    try {
      console.log("[Content] \u70B9\u51FB\u8FDE\u63A5\u6309\u94AE...");
      const visibleButtons = [...document.querySelectorAll("button")].filter((b) => b.offsetParent !== null);
      const connectBtnNew = visibleButtons.find((b) => /^(连接|Connect)$/i.test(b.textContent.trim()) || /^(连接|Connect)$/i.test((b.getAttribute("aria-label") || "").trim()));
      if (connectBtnNew) {
        connectBtnNew.click();
        console.log("[Content] \u5DF2\u70B9\u51FB\u8FDE\u63A5\u6309\u94AE\uFF08\u65B0\u7248UI\uFF09");
        await sleep4(500);
        return {
          success: true,
          data: {
            message: "\u5DF2\u70B9\u51FB\u8FDE\u63A5\u6309\u94AE\uFF0C\u8BF7\u5728\u9875\u9762\u4E0A\u9009\u62E9\u7AEF\u53E3\u5E76\u786E\u8BA4\u8FDE\u63A5"
          }
        };
      }
      const connectBtn = await waitForElement(SELECTORS.FC_CONNECTION.CONNECT_BUTTON, 3e3);
      if (!connectBtn) {
        return {
          success: false,
          error: { message: "\u672A\u627E\u5230\u8FDE\u63A5\u6309\u94AE\uFF0C\u8BF7\u786E\u8BA4\u9875\u9762\u5DF2\u52A0\u8F7D\u5B8C\u6210" }
        };
      }
      connectBtn.click();
      console.log("[Content] \u5DF2\u70B9\u51FB\u8FDE\u63A5\u6309\u94AE");
      await sleep4(500);
      return {
        success: true,
        data: {
          message: "\u5DF2\u70B9\u51FB\u8FDE\u63A5\u6309\u94AE\uFF0C\u8BF7\u5728\u9875\u9762\u4E0A\u9009\u62E9\u7AEF\u53E3\u5E76\u786E\u8BA4\u8FDE\u63A5"
        }
      };
    } catch (error) {
      console.error("[Content] \u70B9\u51FB\u8FDE\u63A5\u6309\u94AE\u5931\u8D25:", error);
      return { success: false, error: { message: error.message } };
    }
  }
  async function handleReadFromPage(payload) {
    try {
      const mode = payload && payload.mode === "diff" ? "diff" : "dump";
      const result = await AutomationEngine.readParametersFromPage(mode);
      return result;
    } catch (error) {
      console.error("[Content] \u4ECE\u9875\u9762\u8BFB\u53D6\u53C2\u6570\u5931\u8D25:", error);
      return { success: false, error: { message: error.message } };
    }
  }
  async function handleWriteToPage(payload) {
    try {
      const { aircraft } = payload;
      const result = await AutomationEngine.writeParametersToPage(aircraft);
      return result;
    } catch (error) {
      console.error("[Content] \u5199\u5165\u53C2\u6570\u5230\u9875\u9762\u5931\u8D25:", error);
      return { success: false, error: { message: error.message } };
    }
  }
  async function handleLog(payload) {
    try {
      const { level, message } = payload;
      console.log(`[Automation ${level}] ${message}`);
      return { success: true };
    } catch (error) {
      return { success: false, error: { message: error.message } };
    }
  }
  function injectLogPanel() {
    if (document.getElementById("bf-log-panel")) {
      return;
    }
    const panel = document.createElement("div");
    panel.id = "bf-log-panel";
    panel.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 300px;
    max-height: 400px;
    background: white;
    border: 1px solid #ddd;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 99999;
    overflow: hidden;
    font-size: 12px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;
    const header = document.createElement("div");
    header.style.cssText = `
    background: #4CAF50;
    color: white;
    padding: 8px 12px;
    font-weight: 600;
    display: flex;
    justify-content: space-between;
    align-items: center;
  `;
    header.innerHTML = '<span>Betaflight\u52A9\u624B \u65E5\u5FD7</span><span style="cursor:pointer;" id="bf-log-close">\xD7</span>';
    const content = document.createElement("div");
    content.id = "bf-log-content";
    content.style.cssText = `
    padding: 8px;
    max-height: 350px;
    overflow-y: auto;
  `;
    panel.appendChild(header);
    panel.appendChild(content);
    document.body.appendChild(panel);
    document.getElementById("bf-log-close").addEventListener("click", () => {
      panel.style.display = "none";
    });
    window.BFLog = {
      add(level, message) {
        const logEntry = document.createElement("div");
        logEntry.style.cssText = `margin-bottom:4px;padding:4px;background:${level === "error" ? "#ffebee" : level === "success" ? "#e8f5e9" : "#f5f5f5"};border-radius:2px;`;
        logEntry.textContent = `[${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] ${message}`;
        content.appendChild(logEntry);
        while (content.children.length > 100) {
          content.removeChild(content.firstChild);
        }
        content.scrollTop = content.scrollHeight;
      },
      clear() {
        content.innerHTML = "";
      },
      export() {
        return Array.from(content.children).map((el) => el.textContent).join("\n");
      }
    };
    console.log("[Content] \u65E5\u5FD7\u9762\u677F\u5DF2\u6CE8\u5165");
  }
  function sleep4(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  init();
})();
