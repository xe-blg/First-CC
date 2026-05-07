const TIMER_STATES = { IDLE: 'idle', RUNNING: 'running', PAUSED: 'paused' };
const TIMER_MODES = { FOCUS: 'focus', SHORT_BREAK: 'shortBreak', LONG_BREAK: 'longBreak' };

const DEFAULT_DURATIONS = {
  focus: 25 * 60,
  shortBreak: 5 * 60,
  longBreak: 15 * 60,
};

const LONG_BREAK_INTERVAL = 4;

function createTimer() {
  let state = TIMER_STATES.IDLE;
  let mode = TIMER_MODES.FOCUS;
  let durations = { ...DEFAULT_DURATIONS };
  let longBreakInterval = LONG_BREAK_INTERVAL;
  let endTimestamp = null;
  let remainingMs = durations.focus * 1000;
  let pomodoroCount = 0;
  let tickCallback = null;
  let completeCallback = null;
  let rafId = null;
  let lastTickTime = 0;

  function getTotalMs() {
    return durations[mode] * 1000;
  }

  function getRemainingMs() {
    if (state === TIMER_STATES.RUNNING && endTimestamp !== null) {
      return Math.max(0, endTimestamp - Date.now());
    }
    return remainingMs;
  }

  function getRemainingSeconds() {
    return Math.ceil(getRemainingMs() / 1000);
  }

  function getTotalSeconds() {
    return durations[mode];
  }

  function getProgress() {
    const total = getTotalMs();
    if (total === 0) return 1;
    return 1 - getRemainingMs() / total;
  }

  function stopTickLoop() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function tick() {
    if (state !== TIMER_STATES.RUNNING) {
      stopTickLoop();
      return;
    }

    const now = Date.now();
    const remaining = getRemainingMs();

    // Only invoke callback every 250ms to avoid needless DOM writes
    if (now - lastTickTime >= 250) {
      lastTickTime = now;
      if (tickCallback) tickCallback(getRemainingSeconds());
    }

    if (remaining <= 0) {
      stopTickLoop();
      state = TIMER_STATES.IDLE;
      remainingMs = 0;
      endTimestamp = null;
      if (tickCallback) tickCallback(0);
      if (completeCallback) completeCallback();
      return;
    }

    rafId = requestAnimationFrame(tick);
  }

  function start() {
    if (state === TIMER_STATES.RUNNING) return;

    if (state === TIMER_STATES.IDLE) {
      remainingMs = getTotalMs();
    }

    endTimestamp = Date.now() + remainingMs;
    lastTickTime = Date.now();
    state = TIMER_STATES.RUNNING;
    if (tickCallback) tickCallback(getRemainingSeconds());
    rafId = requestAnimationFrame(tick);
  }

  function pause() {
    if (state !== TIMER_STATES.RUNNING) return;
    stopTickLoop();
    remainingMs = getRemainingMs();
    endTimestamp = null;
    state = TIMER_STATES.PAUSED;
    if (tickCallback) tickCallback(getRemainingSeconds());
  }

  function reset() {
    stopTickLoop();
    state = TIMER_STATES.IDLE;
    endTimestamp = null;
    remainingMs = getTotalMs();
    if (tickCallback) tickCallback(getRemainingSeconds());
  }

  function skip() {
    stopTickLoop();
    state = TIMER_STATES.IDLE;
    endTimestamp = null;
    // Trigger complete logic
    if (mode === TIMER_MODES.FOCUS) {
      pomodoroCount++;
    }
    if (completeCallback) completeCallback();
  }

  function completeCycle() {
    if (mode === TIMER_MODES.FOCUS) {
      pomodoroCount++;
    }
  }

  function setMode(newMode) {
    mode = newMode;
    stopTickLoop();
    state = TIMER_STATES.IDLE;
    endTimestamp = null;
    remainingMs = getTotalMs();
    if (tickCallback) tickCallback(getRemainingSeconds());
  }

  function setDurations(focus, shortBreak, longBreak) {
    durations.focus = focus * 60;
    durations.shortBreak = shortBreak * 60;
    durations.longBreak = longBreak * 60;
    if (state === TIMER_STATES.IDLE) {
      remainingMs = getTotalMs();
      if (tickCallback) tickCallback(getRemainingSeconds());
    }
  }

  function setLongBreakInterval(interval) {
    longBreakInterval = interval;
  }

  function getPomodoroCount() {
    return pomodoroCount;
  }

  function resetPomodoroCount() {
    pomodoroCount = 0;
  }

  function getLongBreakInterval() {
    return longBreakInterval;
  }

  function onTick(cb) { tickCallback = cb; }
  function onComplete(cb) { completeCallback = cb; }

  return {
    getState: () => state,
    getMode: () => mode,
    getRemainingMs,
    getRemainingSeconds,
    getTotalSeconds,
    getProgress,
    getPomodoroCount,
    getLongBreakInterval,
    start,
    pause,
    reset,
    skip,
    setMode,
    setDurations,
    setLongBreakInterval,
    completeCycle,
    resetPomodoroCount,
    onTick,
    onComplete,
  };
}
