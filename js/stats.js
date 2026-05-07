function createStatsManager() {
  let history = load(STORAGE_KEYS.history, []);

  function persist() {
    save(STORAGE_KEYS.history, history);
  }

  function addRecord(record) {
    history.push({
      id: generateHistoryId(),
      ...record,
    });
    persist();
  }

  function generateHistoryId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'h' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function getTodayCount() {
    const today = new Date().toDateString();
    return history.filter(r => {
      return r.type === 'focus' && r.wasCompleted &&
        new Date(r.completedAt).toDateString() === today;
    }).length;
  }

  function getWeekData() {
    const days = [];
    const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
    const today = new Date();
    const todayStr = today.toDateString();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toDateString();
      const count = history.filter(r => {
        return r.type === 'focus' && r.wasCompleted &&
          new Date(r.completedAt).toDateString() === dateStr;
      }).length;
      days.push({
        label: dayNames[d.getDay()],
        count,
        isToday: dateStr === todayStr,
      });
    }
    return days;
  }

  return {
    addRecord,
    getTodayCount,
    getWeekData,
  };
}
