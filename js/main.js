(function () {
  // --- Init modules ---
  const timer = createTimer();
  const taskManager = createTaskManager();
  const statsManager = createStatsManager();

  // --- Load settings ---
  const defaultSettings = {
    focusDuration: 25,
    shortBreakDuration: 5,
    longBreakDuration: 15,
    longBreakInterval: 4,
    autoStartBreaks: true,
    autoStartFocus: false,
    soundEnabled: true,
    notificationsEnabled: true,
  };
  let settings = { ...defaultSettings, ...load(STORAGE_KEYS.settings, {}) };

  function saveSettings() {
    save(STORAGE_KEYS.settings, settings);
  }

  function applySettings() {
    timer.setDurations(settings.focusDuration, settings.shortBreakDuration, settings.longBreakDuration);
    timer.setLongBreakInterval(settings.longBreakInterval);
  }

  applySettings();

  // --- State ---
  let activeTaskId = null;

  // --- Refresh UI ---
  function refreshAll() {
    const state = timer.getState();
    const mode = timer.getMode();
    renderTimer(timer.getRemainingSeconds(), timer.getTotalSeconds(), state, mode);
    renderModeTabs(mode);
    updateStartButton(mode, state);
    updatePomodoroCounter(timer.getPomodoroCount());

    const tasks = taskManager.getTasks();
    renderTaskList(tasks, activeTaskId);

    const todayCount = statsManager.getTodayCount();
    const weekData = statsManager.getWeekData();
    renderStats(todayCount, weekData);

    const activeTask = tasks.find(t => t.id === activeTaskId);
    renderCurrentTask(activeTask ? activeTask.title : null);
  }

  // --- Timer callbacks ---
  timer.onTick(function () {
    renderTimer(timer.getRemainingSeconds(), timer.getTotalSeconds(), timer.getState(), timer.getMode());
  });

  timer.onComplete(function () {
    const mode = timer.getMode();

    if (mode === TIMER_MODES.FOCUS) {
      timer.completeCycle();
      const pomodoroCount = timer.getPomodoroCount();

      // Record history
      statsManager.addRecord({
        taskId: activeTaskId,
        type: 'focus',
        startedAt: new Date(Date.now() - timer.getTotalSeconds() * 1000).toISOString(),
        completedAt: new Date().toISOString(),
        durationSeconds: timer.getTotalSeconds(),
        wasCompleted: true,
      });

      // Increment task
      taskManager.incrementPomodoro(activeTaskId);

      // Reset active task after completion
      activeTaskId = null;

      // Notification + sound
      if (settings.notificationsEnabled) {
        notify('🍅 专注时间结束！', '太棒了，休息一下吧。');
      }
      if (settings.soundEnabled) {
        playChime();
      }

      window.electronAPI?.flashWindow();

      // Determine next mode
      const interval = timer.getLongBreakInterval();
      const isLongBreak = pomodoroCount % interval === 0;
      const nextMode = isLongBreak ? TIMER_MODES.LONG_BREAK : TIMER_MODES.SHORT_BREAK;

      timer.setMode(nextMode);

      if (settings.autoStartBreaks) {
        timer.start();
      }
    } else {
      // Break completed
      statsManager.addRecord({
        taskId: null,
        type: mode === TIMER_MODES.SHORT_BREAK ? 'shortBreak' : 'longBreak',
        startedAt: new Date(Date.now() - timer.getTotalSeconds() * 1000).toISOString(),
        completedAt: new Date().toISOString(),
        durationSeconds: timer.getTotalSeconds(),
        wasCompleted: true,
      });

      if (settings.notificationsEnabled) {
        const label = mode === TIMER_MODES.SHORT_BREAK ? '短休' : '长休';
        notify('☕ ' + label + '结束！', '准备开始新的番茄吧。');
      }
      if (settings.soundEnabled) {
        playChime();
      }

      window.electronAPI?.flashWindow();

      timer.setMode(TIMER_MODES.FOCUS);

      if (settings.autoStartFocus) {
        timer.start();
      }
    }

    refreshAll();
  });

  // --- Event handlers ---
  dom.startBtn.addEventListener('click', function () {
    timer.start();
    refreshAll();
  });

  dom.pauseBtn.addEventListener('click', function () {
    timer.pause();
    refreshAll();
  });

  dom.resetBtn.addEventListener('click', function () {
    timer.reset();
    refreshAll();
  });

  // Mode tabs
  dom.modeTabs.addEventListener('click', function (e) {
    const tab = e.target.closest('.mode-tab');
    if (!tab) return;

    const modeMap = {
      focus: TIMER_MODES.FOCUS,
      shortBreak: TIMER_MODES.SHORT_BREAK,
      longBreak: TIMER_MODES.LONG_BREAK,
    };
    const newMode = modeMap[tab.dataset.mode];
    if (newMode) {
      timer.setMode(newMode);
      refreshAll();
    }
  });

  // Task input
  dom.taskInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      const title = dom.taskInput.value.trim();
      if (title) {
        taskManager.addTask(title);
        dom.taskInput.value = '';
        refreshAll();
      }
    }
  });

  dom.addTaskBtn.addEventListener('click', function () {
    const title = dom.taskInput.value.trim();
    if (title) {
      taskManager.addTask(title);
      dom.taskInput.value = '';
      refreshAll();
    }
  });

  // Task list actions
  dom.taskList.addEventListener('click', function (e) {
    const item = e.target.closest('.task-item');
    if (!item) return;

    const taskId = item.dataset.taskId;
    const action = e.target.closest('[data-action]')?.dataset.action;

    if (action === 'delete') {
      if (activeTaskId === taskId) activeTaskId = null;
      taskManager.deleteTask(taskId);
      refreshAll();
    } else if (action === 'complete') {
      taskManager.toggleComplete(taskId);
      refreshAll();
    } else {
      // Click on task item itself — set as active
      const task = taskManager.getTasks().find(t => t.id === taskId);
      if (task && !task.isCompleted) {
        activeTaskId = activeTaskId === taskId ? null : taskId;
        refreshAll();
      }
    }
  });

  // Settings
  dom.settingsBtn.addEventListener('click', function () {
    showSettings(settings);
  });

  dom.closeSettings.addEventListener('click', hideSettings);

  dom.settingsModal.addEventListener('click', function (e) {
    if (e.target === dom.settingsModal) hideSettings();
  });

  // Settings range sliders live update
  function bindRange(id, labelDom, suffix) {
    dom[id].addEventListener('input', function () {
      labelDom.textContent = this.value + ' ' + suffix;
    });
  }

  bindRange('focusDuration', dom.focusDurationLabel, '分钟');
  bindRange('shortBreakDuration', dom.shortBreakDurationLabel, '分钟');
  bindRange('longBreakDuration', dom.longBreakDurationLabel, '分钟');
  bindRange('longBreakInterval', dom.longBreakIntervalLabel, '个番茄');

  dom.saveSettings.addEventListener('click', function () {
    settings.focusDuration = parseInt(dom.focusDuration.value);
    settings.shortBreakDuration = parseInt(dom.shortBreakDuration.value);
    settings.longBreakDuration = parseInt(dom.longBreakDuration.value);
    settings.longBreakInterval = parseInt(dom.longBreakInterval.value);
    settings.autoStartBreaks = dom.autoStartBreaks.checked;
    settings.autoStartFocus = dom.autoStartFocus.checked;
    settings.soundEnabled = dom.soundEnabled.checked;
    settings.notificationsEnabled = dom.notificationsEnabled.checked;

    saveSettings();
    applySettings();
    timer.reset();
    timer.resetPomodoroCount();
    hideSettings();
    refreshAll();
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', function (e) {
    if (e.target.tagName === 'INPUT') return;

    if (e.code === 'Space') {
      e.preventDefault();
      const state = timer.getState();
      if (state === TIMER_STATES.RUNNING) {
        timer.pause();
      } else {
        timer.start();
      }
      refreshAll();
    } else if (e.code === 'KeyR') {
      timer.reset();
      refreshAll();
    } else if (e.code === 'KeyS' && !e.ctrlKey && !e.metaKey) {
      const state = timer.getState();
      if (state === TIMER_STATES.RUNNING || state === TIMER_STATES.PAUSED) {
        timer.skip();
        refreshAll();
      }
    }
  });

  // Page visibility — reduce updates when hidden
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) {
      // Force refresh when returning to the tab
      renderTimer(timer.getRemainingSeconds(), timer.getTotalSeconds(), timer.getState(), timer.getMode());
    }
  });

  // --- Electron tray commands ---
  window.electronAPI?.onTrayCommand(function (command) {
    if (command === 'reset') {
      timer.reset();
      refreshAll();
    }
  });

  // --- Init ---
  // Request notification permission on first click
  document.addEventListener('click', function requestPerm() {
    requestNotificationPermission();
  }, { once: true });

  refreshAll();
})();
