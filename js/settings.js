const STORAGE_KEY = 'guitar-tuner-settings';

const DEFAULTS = {
  a4Freq: 440,
  centsThreshold: 5,
  temperament: 'equal',
  temperamentKey: 'C',
  viewMode: 'gauge',
  customTunings: { guitar: {}, bass: {} },
};

let settings = { ...DEFAULTS, customTunings: { guitar: {}, bass: {} } };
const listeners = new Set();

export function initSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (stored) {
      settings = {
        ...DEFAULTS,
        ...stored,
        customTunings: {
          guitar: { ...DEFAULTS.customTunings.guitar, ...(stored.customTunings?.guitar || {}) },
          bass: { ...DEFAULTS.customTunings.bass, ...(stored.customTunings?.bass || {}) },
        },
      };
    }
  } catch { /* ignore corrupt data */ }
}

export function getSettings() {
  return { ...settings };
}

export function getA4Freq() {
  return settings.a4Freq;
}

export function getCentsThreshold() {
  return settings.centsThreshold;
}

export function getHysteresisExit() {
  return Math.round(settings.centsThreshold * 1.6);
}

export function setSetting(key, value) {
  if (!(key in DEFAULTS)) return;
  settings[key] = value;
  persist();
  notify();
}

export function onSettingsChange(fn) {
  listeners.add(fn);
}

export function offSettingsChange(fn) {
  listeners.delete(fn);
}

// Custom tuning CRUD
export function saveCustomTuning(instrument, key, tuningObj) {
  if (!settings.customTunings[instrument]) settings.customTunings[instrument] = {};
  settings.customTunings[instrument][key] = tuningObj;
  persist();
  notify();
}

export function deleteCustomTuning(instrument, key) {
  if (settings.customTunings[instrument]) {
    delete settings.customTunings[instrument][key];
    persist();
    notify();
  }
}

export function getCustomTunings(instrument) {
  return settings.customTunings[instrument] || {};
}

export function resetToDefaults() {
  settings = { ...DEFAULTS, customTunings: settings.customTunings };
  persist();
  notify();
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch { /* storage full, ignore */ }
}

function notify() {
  const snapshot = getSettings();
  listeners.forEach(fn => fn(snapshot));
}
