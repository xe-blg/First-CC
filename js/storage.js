const STORAGE_KEYS = {
  tasks: 'pomodoro_tasks',
  history: 'pomodoro_history',
  settings: 'pomodoro_settings',
};

function load(key, defaultVal) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return defaultVal;
    return JSON.parse(raw);
  } catch {
    return defaultVal;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}
