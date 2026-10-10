import { STORAGE_KEYS } from '../shared/storage-keys.js';

const MAX_HISTORY = 20;

async function sha256(text) {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function deepDiff(a, b, path = '') {
  const diffs = [];
  if (a === b || JSON.stringify(a) === JSON.stringify(b)) return diffs;
  if (a === null || b === null || a === undefined || b === undefined) {
    diffs.push({ path, before: a, after: b });
    return diffs;
  }
  if (typeof a !== typeof b) {
    diffs.push({ path, before: a, after: b });
    return diffs;
  }
  if (typeof a !== 'object') {
    if (a !== b) diffs.push({ path, before: a, after: b });
    return diffs;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      diffs.push({ path, before: a, after: b });
    }
    return diffs;
  }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    diffs.push(...deepDiff(a[k], b[k], path ? `${path}.${k}` : k));
  }
  return diffs;
}

class BackupService {
  async dumpAll() {
    const [account, students, aircrafts, presets, systemPresets] = await Promise.all([
      this._safeGet(STORAGE_KEYS.ACCOUNT),
      this._safeGet(STORAGE_KEYS.STUDENTS),
      this._safeGet(STORAGE_KEYS.AIRCRAFTS),
      this._safeGet(STORAGE_KEYS.PRESETS),
      this._safeGet(STORAGE_KEYS.SYSTEM_PRESETS)
    ]);

    const payload = {
      version: '1.1.0',
      type: 'DUMP',
      exportTime: Date.now(),
      data: {
        account: account ? { email: account.email, lastLogin: account.lastLogin, password: '***' } : null,
        students: students || [],
        aircrafts: aircrafts || [],
        presets: presets || [],
        systemPresets: systemPresets || []
      }
    };

    payload.hash = await sha256(JSON.stringify(payload.data));

    await this._appendHistory({
      type: 'DUMP',
      time: payload.exportTime,
      hash: payload.hash,
      size: JSON.stringify(payload).length
    });

    return payload;
  }

  async diffAll() {
    const [current, history] = await Promise.all([
      this._collectCurrentSnapshot(),
      this.getHistory()
    ]);

    const lastDump = history.slice().reverse().find(h => h.type === 'DUMP');

    if (!lastDump || !lastDump.snapshot) {
      const payload = {
        version: '1.1.0',
        type: 'DIFF',
        exportTime: Date.now(),
        note: '无历史基线，已转为全量快照',
        data: current
      };
      payload.hash = await sha256(JSON.stringify(current));
      return payload;
    }

    const diff = {
      account: deepDiff(lastDump.snapshot.account || null, current.account || null, 'account'),
      students: deepDiff(lastDump.snapshot.students || [], current.students || [], 'students'),
      aircrafts: deepDiff(lastDump.snapshot.aircrafts || [], current.aircrafts || [], 'aircrafts'),
      presets: deepDiff(lastDump.snapshot.presets || [], current.presets || [], 'presets'),
      systemPresets: deepDiff(lastDump.snapshot.systemPresets || [], current.systemPresets || [], 'systemPresets')
    };

    const payload = {
      version: '1.1.0',
      type: 'DIFF',
      exportTime: Date.now(),
      baseTime: lastDump.time,
      changes: {
        totalChanges: Object.values(diff).flat().length,
        detail: diff
      },
      snapshot: current
    };
    payload.hash = await sha256(JSON.stringify(current));

    await this._appendHistory({
      type: 'DIFF',
      time: payload.exportTime,
      hash: payload.hash,
      size: JSON.stringify(payload).length,
      snapshot: current
    });

    return payload;
  }

  async uploadToReservoir(payload, endpoint) {
    if (!endpoint) {
      throw new Error('未配置水库系统地址');
    }
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'bf-auto-tuning',
        payload,
        submittedAt: Date.now()
      })
    });

    if (!response.ok) {
      throw new Error(`上传失败: HTTP ${response.status}`);
    }

    try {
      return await response.json();
    } catch {
      return { ok: true, status: response.status };
    }
  }

  async getHistory() {
    const result = await chrome.storage.local.get([STORAGE_KEYS.BACKUP_HISTORY]);
    return result[STORAGE_KEYS.BACKUP_HISTORY] || [];
  }

  async saveReservoirConfig(config) {
    await chrome.storage.local.set({
      [STORAGE_KEYS.RESERVOIR_CONFIG]: { ...config, updatedAt: Date.now() }
    });
    return config;
  }

  async getReservoirConfig() {
    const result = await chrome.storage.local.get([STORAGE_KEYS.RESERVOIR_CONFIG]);
    return result[STORAGE_KEYS.RESERVOIR_CONFIG] || { endpoint: '' };
  }

  async _collectCurrentSnapshot() {
    const [account, students, aircrafts, presets, systemPresets] = await Promise.all([
      this._safeGet(STORAGE_KEYS.ACCOUNT),
      this._safeGet(STORAGE_KEYS.STUDENTS),
      this._safeGet(STORAGE_KEYS.AIRCRAFTS),
      this._safeGet(STORAGE_KEYS.PRESETS),
      this._safeGet(STORAGE_KEYS.SYSTEM_PRESETS)
    ]);
    return {
      account: account ? { email: account.email, lastLogin: account.lastLogin } : null,
      students: students || [],
      aircrafts: aircrafts || [],
      presets: presets || [],
      systemPresets: systemPresets || []
    };
  }

  async _safeGet(key) {
    try {
      const result = await chrome.storage.local.get([key]);
      return result[key];
    } catch {
      return null;
    }
  }

  async _appendHistory(record) {
    const history = await this.getHistory();
    history.push(record);
    while (history.length > MAX_HISTORY) {
      history.shift();
    }
    await chrome.storage.local.set({ [STORAGE_KEYS.BACKUP_HISTORY]: history });
    return history;
  }
}

export const backupService = new BackupService();
