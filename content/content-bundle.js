(() => {
  // shared/message-protocol.js
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

  // content/cli-parser.js
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

  // content/bf-web-adapter.js
  var PAGE_TEXT = {
    navPid: ["PID \u8C03\u53C2", "PID Tuning"],
    navMotors: ["\u7535\u673A", "Motors"],
    navCli: ["\u547D\u4EE4\u884C", "CLI"],
    subPid: ["PID \u914D\u7F6E\u6587\u4EF6\u8BBE\u7F6E", "PID profile settings"],
    subRates: ["Rate \u914D\u7F6E\u6587\u4EF6\u8BBE\u7F6E", "Rate profile settings"],
    subFilter: ["\u6EE4\u6CE2\u5668\u8BBE\u7F6E", "Filter settings"],
    save: ["\u4FDD\u5B58", "Save"],
    saveConfirm: ["\u786E\u8BA4", "\u786E\u5B9A", "\u597D", "OK", "Continue", "\u7EE7\u7EED", "\u91CD\u65B0\u542F\u52A8", "Restart"],
    cliClear: ["\u6E05\u9664\u8F93\u51FA\u5386\u53F2\u8BB0\u5F55", "Clear output history"]
  };
  var PID_AXIS = { roll: /^ROLL$/i, pitch: /^PITCH$/i, yaw: /^YAW$/i };
  var RATES_AXIS = { roll: /^横滚/, pitch: /^俯仰/, yaw: /^方向/ };
  var PID_COLS = 5;
  var RATES_COLS = 3;
  var FILTER_INPUTS = 12;
  var MOTOR_ZONE_INPUTS = 5;
  var TEXT_MOTOR_ZONE = "\u6CB9\u95E8\u548C\u7535\u673A\u8BBE\u7F6E";
  var TEXT_FILTER_GYRO = "\u9640\u87BA\u4EEA\u4F4E\u901A\u6EE4\u6CE2\u5668";
  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  function num2(v) {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }
  function visibleLeaves() {
    return [...document.querySelectorAll("*")].filter((e) => e.children.length === 0 && e.offsetParent !== null);
  }
  function findLeafByText(text) {
    return visibleLeaves().find((e) => e.textContent.trim() === text) || null;
  }
  function findLeafByRegex(re) {
    return visibleLeaves().find((e) => re.test(e.textContent.trim())) || null;
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
  async function setCellValue(inp, val) {
    inp.scrollIntoView({ block: "center" });
    inp.focus();
    inp.value = String(val);
    inp.dispatchEvent(new Event("input", { bubbles: true }));
    inp.dispatchEvent(new Event("change", { bubbles: true }));
    inp.blur();
    await sleep(50);
  }
  function cellOf(leaf, grid) {
    let n = leaf;
    while (n && n.parentElement !== grid) n = n.parentElement;
    return n;
  }
  function rowInputs(grid, axisRegex, count) {
    const leaf = [...grid.querySelectorAll("*")].find((e) => e.children.length === 0 && axisRegex.test(e.textContent.trim()));
    if (!leaf) throw new Error("\u8868\u683C\u8F74\u6807\u7B7E\u672A\u627E\u5230: " + axisRegex);
    const cell = cellOf(leaf, grid);
    if (!cell) throw new Error("\u8F74\u6807\u7B7E\u5355\u5143\u683C\u5B9A\u4F4D\u5931\u8D25");
    const inputs = [];
    let sib = cell.nextElementSibling;
    while (sib && inputs.length < count) {
      const inp = sib.querySelector("input");
      if (!inp) throw new Error("\u8F74\u884C\u5355\u5143\u683C\u7F3A\u5C11\u8F93\u5165\u6846");
      inputs.push(inp);
      sib = sib.nextElementSibling;
    }
    if (inputs.length < count) {
      throw new Error(`\u8F74\u884C\u8F93\u5165\u6846\u6570\u91CF\u4E0D\u8DB3: ${inputs.length}/${count}`);
    }
    return inputs;
  }
  function containerWithInputs(leaf, expectedInputs, maxLevels = 8) {
    let c = leaf.parentElement;
    for (let i = 0; i < maxLevels && c; i++) {
      if (c.querySelectorAll("input").length === expectedInputs) return c;
      c = c.parentElement;
    }
    return null;
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
  async function navigateToMotors() {
    await clickNav(PAGE_TEXT.navMotors, "\u7535\u673A");
  }
  async function switchSubTab(name) {
    const map = { pid: PAGE_TEXT.subPid, rates: PAGE_TEXT.subRates, filter: PAGE_TEXT.subFilter };
    const texts = map[name];
    if (!texts) throw new Error("\u672A\u77E5\u5B50\u9875\u7B7E: " + name);
    const btn = findVisibleButton(texts);
    if (!btn) throw new Error(`\u5B50\u9875\u7B7E\u6309\u94AE\u672A\u627E\u5230: ${texts[0]}`);
    pressButton(btn);
    await sleep(800);
  }
  async function tryClickSave() {
    const btn = findVisibleButton(PAGE_TEXT.save);
    if (!btn) return false;
    pressButton(btn);
    await sleep(1e3);
    const dlgBtn = [...document.querySelectorAll("button")].find((b) => b.offsetParent !== null && PAGE_TEXT.saveConfirm.includes(b.textContent.trim()));
    if (dlgBtn) {
      pressButton(dlgBtn);
      await sleep(500);
    }
    return true;
  }
  async function selectDropdownOption(trigger, label) {
    pressButton(trigger);
    await sleep(800);
    const opt = [...document.querySelectorAll('[role="option"]')].find((o) => o.offsetParent !== null && o.textContent.trim() === label);
    if (!opt) throw new Error(`\u4E0B\u62C9\u9009\u9879\u672A\u627E\u5230: ${label}`);
    opt.focus();
    opt.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Enter",
      keyCode: 13,
      bubbles: true,
      cancelable: true
    }));
    await sleep(600);
  }
  async function ensurePidEditable() {
    const grid = pidGrid();
    const disabledCount = [...grid.querySelectorAll("input")].filter((i) => i.disabled).length;
    if (!disabledCount) return;
    const blockLeaf = visibleLeaves().find((e) => e.textContent.trim() === "PID \u8C03\u53C2\u6ED1\u5757");
    if (!blockLeaf) throw new Error("PID \u8868\u88AB\u6ED1\u5757\u6A21\u5F0F\u9501\u5B9A\uFF0C\u4E14\u672A\u627E\u5230\u300CPID \u8C03\u53C2\u6ED1\u5757\u300D\u533A\u5757");
    let block = blockLeaf.parentElement;
    for (let i = 0; i < 6 && block; i++) {
      if (block.textContent.includes("\u6A21\u5F0F")) break;
      block = block.parentElement;
    }
    const trigger = [...block.querySelectorAll("button")].find((b) => b.offsetParent !== null && ["RP", "RPY", "\u5173\u95ED"].includes(b.textContent.trim()));
    if (!trigger) throw new Error("\u672A\u627E\u5230\u6ED1\u5757\u6A21\u5F0F\u4E0B\u62C9\u89E6\u53D1\u5668");
    await selectDropdownOption(trigger, "\u5173\u95ED");
    const still = [...pidGrid().querySelectorAll("input")].filter((i) => i.disabled).length;
    if (still) throw new Error(`\u6ED1\u5757\u6A21\u5F0F\u5173\u95ED\u5931\u8D25\uFF0CPID \u8868\u4ECD\u6709 ${still} \u4E2A\u7981\u7528\u8F93\u5165\u6846`);
  }
  function pidGrid() {
    const leaf = findLeafByRegex(PID_AXIS.roll);
    if (!leaf) throw new Error("PID \u8868 ROLL \u6807\u7B7E\u672A\u627E\u5230");
    const g = leaf.closest(".grid");
    if (!g) throw new Error("PID \u8868 grid \u5BB9\u5668\u672A\u627E\u5230");
    return g;
  }
  async function writePidTable(pid) {
    const grid = pidGrid();
    for (const [axis, re] of Object.entries(PID_AXIS)) {
      const a = pid[axis];
      if (!a || typeof a !== "object") continue;
      const inputs = rowInputs(grid, re, PID_COLS);
      const vals = [
        a.p ?? a.P,
        a.i ?? a.I,
        a.dmax ?? a.dMax ?? a.DMax,
        a.diff ?? a.d ?? a.D,
        a.f ?? a.F
      ];
      for (let i = 0; i < PID_COLS; i++) {
        if (vals[i] === void 0) continue;
        await setCellValue(inputs[i], vals[i]);
      }
    }
  }
  function ratesGrid() {
    const leaf = findLeafByRegex(RATES_AXIS.roll);
    if (!leaf) throw new Error("Rates \u8868\u300C\u6A2A\u6EDA\u300D\u6807\u7B7E\u672A\u627E\u5230");
    const g = leaf.closest(".grid");
    if (!g) throw new Error("Rates \u8868 grid \u5BB9\u5668\u672A\u627E\u5230");
    return g;
  }
  function throttleInputs() {
    const leaf = findLeafByText("\u6CB9\u95E8\u9650\u5236");
    if (leaf) {
      let c = leaf.parentElement;
      for (let i = 0; i < 6 && c; i++) {
        const inputs = [...c.querySelectorAll("input")].filter((x) => x.offsetParent !== null);
        if (inputs.length === 3) return inputs;
        c = c.parentElement;
      }
    }
    const all = [...document.querySelectorAll("input")].filter((i) => i.offsetParent !== null);
    if (all.length >= 3) return all.slice(-3);
    throw new Error("\u6CB9\u95E8\u9650\u5236\u533A\u5757\u672A\u627E\u5230");
  }
  async function writeRatesTable(rates) {
    const r = rates || {};
    const grid = ratesGrid();
    for (const [axis, re] of Object.entries(RATES_AXIS)) {
      const a = r[axis];
      if (!a || typeof a !== "object") continue;
      const inputs = rowInputs(grid, re, RATES_COLS);
      const vals = [
        a.centerSens ?? a.rcRate,
        a.maxRate ?? a.superRate,
        a.expo
      ];
      for (let i = 0; i < RATES_COLS; i++) {
        if (vals[i] === void 0) continue;
        await setCellValue(inputs[i], vals[i]);
      }
    }
    const t = throttleInputs();
    if (r.throttleLimit !== void 0) await setCellValue(t[0], r.throttleLimit);
    if (r.throttleMidPoint !== void 0) await setCellValue(t[1], r.throttleMidPoint);
    if (r.throttleExpo !== void 0) await setCellValue(t[2], r.throttleExpo);
  }
  function filterGrid() {
    const leaf = findLeafByText(TEXT_FILTER_GYRO);
    if (!leaf) throw new Error("\u6EE4\u6CE2\u5668\u300C\u9640\u87BA\u4EEA\u4F4E\u901A\u6EE4\u6CE2\u5668\u300D\u6807\u9898\u672A\u627E\u5230");
    const grid = containerWithInputs(leaf, FILTER_INPUTS);
    if (!grid) throw new Error(`\u6EE4\u6CE2\u5668\u53CC\u5217\u5BB9\u5668\uFF08${FILTER_INPUTS} inputs\uFF09\u672A\u627E\u5230`);
    return grid;
  }
  async function writeFilterBlocks(filter) {
    const f = filter || {};
    const grid = filterGrid();
    const inputs = [...grid.querySelectorAll("input")];
    if (inputs.length !== FILTER_INPUTS) {
      throw new Error(`\u6EE4\u6CE2\u5668\u5BB9\u5668\u9884\u671F ${FILTER_INPUTS} \u4E2A\u8F93\u5165\u6846\uFF0C\u5B9E\u9645 ${inputs.length}`);
    }
    const vals = [
      f.gyroLp1Static,
      f.gyroLp1Dynamic,
      f.gyroLp2Static,
      f.gyroNotchCount,
      f.gyroNotchQ,
      f.gyroNotchMinHz,
      f.gyroNotchMaxHz,
      f.dtermLp1Static,
      f.dtermLp1Dynamic,
      f.dtermLp1Expo,
      f.dtermLp2Static,
      f.yawLpStatic
    ];
    for (let i = 0; i < FILTER_INPUTS; i++) {
      if (vals[i] === void 0) continue;
      await setCellValue(inputs[i], vals[i]);
    }
  }
  function motorZoneEl() {
    const leaf = findLeafByText(TEXT_MOTOR_ZONE);
    if (!leaf) throw new Error(`\u300C${TEXT_MOTOR_ZONE}\u300D\u6807\u9898\u672A\u627E\u5230`);
    const el = containerWithInputs(leaf, MOTOR_ZONE_INPUTS, 6);
    if (!el) throw new Error(`\u300C${TEXT_MOTOR_ZONE}\u300D\u533A\u5757\uFF08${MOTOR_ZONE_INPUTS} inputs\uFF09\u672A\u627E\u5230`);
    return el;
  }
  async function writeMotorZone(motor) {
    const m = motor || {};
    const el = motorZoneEl();
    const inputs = [...el.querySelectorAll("input")];
    if (inputs.length !== MOTOR_ZONE_INPUTS) {
      throw new Error(`\u300C${TEXT_MOTOR_ZONE}\u300D\u9884\u671F ${MOTOR_ZONE_INPUTS} \u4E2A\u8F93\u5165\u6846\uFF0C\u5B9E\u9645 ${inputs.length}`);
    }
    const vals = [m.throttleBoost, m.motorOutputLimit, m.dynamicIdle, m.vbatSagComp, m.thrustLinearization];
    for (let i = 0; i < MOTOR_ZONE_INPUTS; i++) {
      if (vals[i] === void 0) continue;
      await setCellValue(inputs[i], vals[i]);
    }
  }
  function motorIdleInput() {
    const inputs = [...document.querySelectorAll("input")].filter((i) => i.offsetParent !== null);
    if (inputs.length !== 1) {
      throw new Error(`\u7535\u673A\u9875\u9884\u671F\u552F\u4E00\u6020\u901F\u8F93\u5165\u6846\uFF0C\u5B9E\u9645 ${inputs.length} \u4E2A`);
    }
    return inputs[0];
  }
  async function tryClickMotorSave() {
    const btn = [...document.querySelectorAll("button")].find((b) => b.offsetParent !== null && /^(保存并重启|保存|Save and Restart|Save)$/i.test(b.textContent.trim()));
    if (!btn) return false;
    pressButton(btn);
    await sleep(1e3);
    const dlgBtn = [...document.querySelectorAll("button")].find((b) => b.offsetParent !== null && PAGE_TEXT.saveConfirm.includes(b.textContent.trim()));
    if (dlgBtn) {
      pressButton(dlgBtn);
      await sleep(500);
    }
    return true;
  }
  async function writeMotorIdle(value) {
    await navigateToMotors();
    const inp = motorIdleInput();
    if (inp.disabled) {
      throw new Error("\u7535\u673A\u6020\u901F\u8F93\u5165\u6846\u88AB\u9875\u9762\u7981\u7528\uFF0C\u65E0\u6CD5\u5199\u5165");
    }
    await setCellValue(inp, value);
    if (num2(inp.value) !== num2(value)) {
      throw new Error(`\u7535\u673A\u6020\u901F\u5199\u5165\u88AB\u56DE\u6EDA\uFF08\u9875\u9762\u663E\u793A ${inp.value}\uFF0C\u671F\u671B ${value}\uFF09`);
    }
    const saved = await tryClickMotorSave();
    try {
      await ensurePidPage();
    } catch (e) {
      console.warn("[BfWebAdapter] \u4FDD\u5B58\u91CD\u542F\u540E\u8FD4\u56DE PID \u9875\u5931\u8D25\uFF08\u9884\u671F\u526F\u4F5C\u7528\uFF09: " + e.message);
    }
    return { value, saved };
  }
  async function writeAll(params, onProgress) {
    const p = params || {};
    const sections = [];
    const notify = (msg) => {
      if (onProgress) onProgress(0, 0, msg);
    };
    await ensurePidPage();
    if (p.pid || p.motor && ["throttleBoost", "motorOutputLimit", "dynamicIdle", "vbatSagComp", "thrustLinearization"].some((k) => p.motor && p.motor[k] !== void 0)) {
      await switchSubTab("pid");
      if (p.pid) {
        await ensurePidEditable();
        notify("\u5199\u5165 PID \u8868...");
        await writePidTable(p.pid);
        sections.push("PID\u8868");
      }
      if (p.motor && ["throttleBoost", "motorOutputLimit", "dynamicIdle", "vbatSagComp", "thrustLinearization"].some((k) => p.motor[k] !== void 0)) {
        notify("\u5199\u5165\u6CB9\u95E8\u548C\u7535\u673A\u8BBE\u7F6E...");
        await writeMotorZone(p.motor);
        sections.push("\u6CB9\u95E8\u7535\u673A\u8BBE\u7F6E");
      }
      notify("\u4FDD\u5B58 PID \u9875...");
      if (!await tryClickSave()) throw new Error("\u672A\u627E\u5230\u4FDD\u5B58\u6309\u94AE\uFF08PID \u9875\uFF09");
    }
    if (p.rates) {
      await switchSubTab("rates");
      notify("\u5199\u5165 Rates...");
      await writeRatesTable(p.rates);
      sections.push("Rates");
      notify("\u4FDD\u5B58 Rates \u9875...");
      if (!await tryClickSave()) throw new Error("\u672A\u627E\u5230\u4FDD\u5B58\u6309\u94AE\uFF08Rates \u9875\uFF09");
    }
    if (p.filter) {
      await switchSubTab("filter");
      notify("\u5199\u5165\u6EE4\u6CE2\u5668...");
      await writeFilterBlocks(p.filter);
      sections.push("\u6EE4\u6CE2\u5668");
      notify("\u4FDD\u5B58\u6EE4\u6CE2\u5668\u9875...");
      if (!await tryClickSave()) throw new Error("\u672A\u627E\u5230\u4FDD\u5B58\u6309\u94AE\uFF08\u6EE4\u6CE2\u5668\u9875\uFF09");
    }
    if (p.motor && p.motor.motorIdle !== void 0) {
      notify("\u5199\u5165\u7535\u673A\u6020\u901F...");
      const r = await writeMotorIdle(p.motor.motorIdle);
      if (!r.saved) {
        console.warn("[BfWebAdapter] \u7535\u673A\u9875\u65E0\u4FDD\u5B58\u6309\u94AE\uFF0C\u6020\u901F\u53EF\u80FD\u672A\u6301\u4E45\u5316");
      }
      sections.push("\u7535\u673A\u6020\u901F");
    }
    return { success: true, message: `\u5DF2\u5199\u5165: ${sections.join(", ")}`, sections, saved: true };
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

  // content/parameter-reader.js
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

  // content/selectors.js
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

  // shared/constants.js
  var DEFAULT_TIMEOUT = 5e3;
  var POLL_INTERVAL = 100;

  // content/dom-operator.js
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

  // content/parameter-writer.js
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

  // content/automation-engine.js
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

  // content/content-module.js
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
