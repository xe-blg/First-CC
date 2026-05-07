const RING_CIRCUMFERENCE = 2 * Math.PI * 88; // ~552.92

// DOM cache
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const dom = {
  startBtn: $('#startBtn'),
  pauseBtn: $('#pauseBtn'),
  resetBtn: $('#resetBtn'),
  timerDisplay: $('#timerDisplay'),
  timerMinutes: $('#timerMinutes'),
  timerSeconds: $('#timerSeconds'),
  timerCard: $('.timer-card'),
  ringProgress: $('.ring-progress'),
  pomodoroCounter: $('#pomodoroCounter'),
  currentTaskLabel: $('#currentTaskLabel'),
  modeTabs: $('#modeTabs'),
  taskList: $('#taskList'),
  taskInput: $('#taskInput'),
  taskEmpty: $('#taskEmpty'),
  todayCount: $('#todayCount'),
  weekChart: $('#weekChart'),
  settingsModal: $('#settingsModal'),
  settingsBtn: $('#settingsBtn'),
  closeSettings: $('#closeSettings'),
  saveSettings: $('#saveSettings'),
  focusDuration: $('#focusDuration'),
  focusDurationLabel: $('#focusDurationLabel'),
  shortBreakDuration: $('#shortBreakDuration'),
  shortBreakDurationLabel: $('#shortBreakDurationLabel'),
  longBreakDuration: $('#longBreakDuration'),
  longBreakDurationLabel: $('#longBreakDurationLabel'),
  longBreakInterval: $('#longBreakInterval'),
  longBreakIntervalLabel: $('#longBreakIntervalLabel'),
  autoStartBreaks: $('#autoStartBreaks'),
  autoStartFocus: $('#autoStartFocus'),
  soundEnabled: $('#soundEnabled'),
  notificationsEnabled: $('#notificationsEnabled'),
};

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return {
    minutes: String(m).padStart(2, '0'),
    seconds: String(s).padStart(2, '0'),
  };
}

function renderTimer(remainingSec, totalSec, state, mode) {
  const { minutes, seconds } = formatTime(remainingSec);
  dom.timerMinutes.textContent = minutes;
  dom.timerSeconds.textContent = seconds;

  // Update ring
  const progress = totalSec > 0 ? 1 - remainingSec / totalSec : 0;
  const offset = RING_CIRCUMFERENCE * (1 - progress);
  dom.ringProgress.style.strokeDashoffset = offset;

  // Update ring color based on mode
  const colorVar = mode === 'focus' ? 'var(--color-focus)'
    : mode === 'shortBreak' ? 'var(--color-short-break)'
    : 'var(--color-long-break)';
  dom.ringProgress.style.stroke = colorVar;

  // Card state classes
  dom.timerCard.classList.remove('is-running', 'is-paused');
  if (state === 'running') dom.timerCard.classList.add('is-running');
  if (state === 'paused') dom.timerCard.classList.add('is-paused');

  // Button states
  const isActive = state === 'running' || state === 'paused';
  dom.startBtn.disabled = state === 'running';
  dom.pauseBtn.disabled = state !== 'running';

  // Update colon animation
  dom.timerDisplay.classList.toggle('is-paused', state === 'paused');

  setTabTitle(remainingSec, mode, state);

  // Update tray tooltip in Electron
  const { minutes: m, seconds: s } = formatTime(remainingSec);
  const modeLabel = mode === 'focus' ? '专注' : mode === 'shortBreak' ? '短休' : '长休';
  const stateIcon = state === 'running' ? '' : state === 'paused' ? '⏸ ' : '';
  window.electronAPI?.updateTray(`番茄钟 - ${stateIcon}${m}:${s} ${modeLabel}`);
}

function setTabTitle(remainingSec, mode, state) {
  const { minutes, seconds } = formatTime(remainingSec);
  const timeStr = `${minutes}:${seconds}`;
  const modeLabel = mode === 'focus' ? '专注' : mode === 'shortBreak' ? '短休' : '长休';

  let title;
  if (state === 'running') {
    title = `${timeStr} - ${modeLabel} | 番茄钟`;
  } else if (state === 'paused') {
    title = `⏸ ${timeStr} | 番茄钟`;
  } else {
    title = '番茄钟';
  }
  document.title = title;
}

function renderModeTabs(mode) {
  const tabs = dom.modeTabs.querySelectorAll('.mode-tab');
  tabs.forEach(tab => {
    tab.classList.toggle('active', tab.dataset.mode === mode);
  });
}

function updatePomodoroCounter(count) {
  dom.pomodoroCounter.textContent = `第 ${count + 1} 个番茄`;
}

function updateStartButton(mode, state) {
  const labels = {
    focus: '开始专注',
    shortBreak: '开始短休',
    longBreak: '开始长休',
  };
  if (state === 'paused') {
    dom.startBtn.textContent = '继续';
  } else {
    dom.startBtn.textContent = labels[mode] || '开始';
  }
}

function renderCurrentTask(taskTitle) {
  dom.currentTaskLabel.textContent = taskTitle ? `当前任务：${taskTitle}` : '当前任务：无';
}

function renderTaskList(tasks, activeTaskId) {
  dom.taskList.innerHTML = '';
  dom.taskEmpty.style.display = tasks.length === 0 ? 'block' : 'none';

  const incomplete = tasks.filter(t => !t.isCompleted);
  const completed = tasks.filter(t => t.isCompleted);
  const sorted = [...incomplete, ...completed];

  sorted.forEach(task => {
    const li = document.createElement('li');
    li.className = 'task-item';
    if (task.id === activeTaskId) li.classList.add('active');
    if (task.isCompleted) li.classList.add('completed');
    li.dataset.taskId = task.id;

    li.innerHTML = `
      <button class="task-complete-btn" data-action="complete" title="${task.isCompleted ? '取消完成' : '标记完成'}">
        ${task.isCompleted ? '↩' : '✓'}
      </button>
      <span class="task-item-title">${escapeHtml(task.title)}</span>
      ${task.completedPomodoros > 0 ? `<span class="task-pomodoro-badge">${task.completedPomodoros} 🍅</span>` : ''}
      <button class="task-delete-btn" data-action="delete" title="删除">✕</button>
    `;
    dom.taskList.appendChild(li);
  });
}

function renderStats(todayCount, weekData) {
  dom.todayCount.textContent = todayCount;
  renderWeekChart(weekData);
}

function renderWeekChart(weekData) {
  const container = dom.weekChart;
  const maxVal = Math.max(...weekData.map(d => d.count), 1);

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 280 100');

  const barWidth = 28;
  const gap = 10;
  const totalWidth = weekData.length * (barWidth + gap) - gap;
  const startX = (280 - totalWidth) / 2;
  const chartHeight = 75;

  weekData.forEach((d, i) => {
    const x = startX + i * (barWidth + gap);
    const barHeight = Math.max(3, (d.count / maxVal) * chartHeight);
    const y = chartHeight - barHeight + 4;

    // Bar
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', x);
    rect.setAttribute('y', y);
    rect.setAttribute('width', barWidth);
    rect.setAttribute('height', barHeight);
    rect.setAttribute('rx', 4);
    rect.setAttribute('fill', d.isToday ? 'var(--color-focus)' : 'var(--color-border)');
    // We can't use CSS vars in SVG directly without inline styles
    rect.style.fill = d.isToday ? '#e74c3c' : '#dfe6e9';
    svg.appendChild(rect);

    // Count label
    const countText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    countText.setAttribute('x', x + barWidth / 2);
    countText.setAttribute('y', y - 5);
    countText.setAttribute('text-anchor', 'middle');
    countText.setAttribute('font-size', '11');
    countText.setAttribute('font-family', 'inherit');
    countText.setAttribute('fill', d.count > 0 ? '#2c3e50' : '#bdc3c7');
    countText.textContent = d.count;
    svg.appendChild(countText);

    // Day label
    const dayText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    dayText.setAttribute('x', x + barWidth / 2);
    dayText.setAttribute('y', chartHeight + 18);
    dayText.setAttribute('text-anchor', 'middle');
    dayText.setAttribute('font-size', '11');
    dayText.setAttribute('font-family', 'inherit');
    dayText.setAttribute('fill', d.isToday ? '#e74c3c' : '#7f8c8d');
    dayText.setAttribute('font-weight', d.isToday ? '600' : '400');
    dayText.textContent = d.label;
    svg.appendChild(dayText);
  });

  container.innerHTML = '';
  container.appendChild(svg);
}

function showSettings(settings) {
  dom.focusDuration.value = settings.focusDuration;
  dom.shortBreakDuration.value = settings.shortBreakDuration;
  dom.longBreakDuration.value = settings.longBreakDuration;
  dom.longBreakInterval.value = settings.longBreakInterval;
  dom.autoStartBreaks.checked = settings.autoStartBreaks;
  dom.autoStartFocus.checked = settings.autoStartFocus;
  dom.soundEnabled.checked = settings.soundEnabled;
  dom.notificationsEnabled.checked = settings.notificationsEnabled;

  dom.focusDurationLabel.textContent = `${settings.focusDuration} 分钟`;
  dom.shortBreakDurationLabel.textContent = `${settings.shortBreakDuration} 分钟`;
  dom.longBreakDurationLabel.textContent = `${settings.longBreakDuration} 分钟`;
  dom.longBreakIntervalLabel.textContent = `${settings.longBreakInterval} 个番茄`;

  dom.settingsModal.classList.remove('hidden');
}

function hideSettings() {
  dom.settingsModal.classList.add('hidden');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
