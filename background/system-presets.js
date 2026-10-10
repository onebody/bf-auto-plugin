import { STORAGE_KEYS, PRESET_TYPES } from '../shared/constants.js';

const DEFAULT_SYSTEM_PRESETS = [
  {
    id: 'system_coach_001',
    name: '教练 · 竞速全量配置',
    type: PRESET_TYPES.SYSTEM,
    isSystem: true,
    pid: { rollP: 52, rollI: 32, rollD: 20, pitchP: 52, pitchI: 32, pitchD: 20, yawP: 58, yawI: 38, yawD: 22 },
    rates: { rcRate: 95, rcExpo: 0, rates: 70, tpaRate: 0, tpaBreakpoint: 1500 },
    filter: { gyroLowpass: 380, dtermLowpass: 260, dtermNotch: 0 },
    motorConfig: { motorOutput: 1000 },
    updatedAt: Date.now(),
    version: 1
  },
  {
    id: 'system_coach_002',
    name: '教练 · 花飞全量配置',
    type: PRESET_TYPES.SYSTEM,
    isSystem: true,
    pid: { rollP: 48, rollI: 30, rollD: 16, pitchP: 48, pitchI: 30, pitchD: 16, yawP: 52, yawI: 34, yawD: 18 },
    rates: { rcRate: 105, rcExpo: 25, rates: 78, tpaRate: 30, tpaBreakpoint: 1200 },
    filter: { gyroLowpass: 260, dtermLowpass: 200, dtermNotch: 800 },
    motorConfig: { motorOutput: 1000 },
    updatedAt: Date.now(),
    version: 1
  }
];

class SystemPresetService {
  async getAll() {
    const result = await chrome.storage.local.get([STORAGE_KEYS.SYSTEM_PRESETS]);
    let presets = result[STORAGE_KEYS.SYSTEM_PRESETS];
    if (!presets || presets.length === 0) {
      presets = DEFAULT_SYSTEM_PRESETS;
      await chrome.storage.local.set({ [STORAGE_KEYS.SYSTEM_PRESETS]: presets });
    }
    return presets;
  }

  async save(presetData) {
    const presets = await this.getAll();
    const newPreset = {
      ...presetData,
      id: `system_${Date.now()}`,
      type: PRESET_TYPES.SYSTEM,
      isSystem: true,
      updatedAt: Date.now(),
      version: 1
    };
    presets.push(newPreset);
    await chrome.storage.local.set({ [STORAGE_KEYS.SYSTEM_PRESETS]: presets });
    return newPreset;
  }

  async update(presetId, updates) {
    const presets = await this.getAll();
    const idx = presets.findIndex(p => p.id === presetId);
    if (idx === -1) {
      throw new Error('系统预设不存在');
    }
    presets[idx] = {
      ...presets[idx],
      ...updates,
      updatedAt: Date.now(),
      version: (presets[idx].version || 1) + 1
    };
    await chrome.storage.local.set({ [STORAGE_KEYS.SYSTEM_PRESETS]: presets });
    return presets[idx];
  }

  async remove(presetId) {
    let presets = await this.getAll();
    presets = presets.filter(p => p.id !== presetId);
    await chrome.storage.local.set({ [STORAGE_KEYS.SYSTEM_PRESETS]: presets });
    return presets;
  }
}

export const systemPresetService = new SystemPresetService();
