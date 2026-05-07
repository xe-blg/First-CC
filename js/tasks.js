function createTaskManager() {
  let tasks = load(STORAGE_KEYS.tasks, []);
  let listeners = [];

  function notifyListeners() {
    listeners.forEach(fn => fn(tasks));
  }

  function persist() {
    save(STORAGE_KEYS.tasks, tasks);
    notifyListeners();
  }

  function generateId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  function addTask(title) {
    const task = {
      id: generateId(),
      title: title.trim(),
      createdAt: new Date().toISOString(),
      completedPomodoros: 0,
      isCompleted: false,
    };
    tasks.push(task);
    persist();
    return task;
  }

  function deleteTask(id) {
    tasks = tasks.filter(t => t.id !== id);
    persist();
  }

  function toggleComplete(id) {
    const task = tasks.find(t => t.id === id);
    if (task) {
      task.isCompleted = !task.isCompleted;
      persist();
    }
  }

  function getTasks() {
    return [...tasks];
  }

  function getActiveTask() {
    return tasks.find(t => !t.isCompleted) || null;
  }

  function incrementPomodoro(taskId) {
    if (!taskId) {
      // No active task — count to the first incomplete task
      const task = getActiveTask();
      if (task) {
        task.completedPomodoros++;
        persist();
        return task;
      }
      return null;
    }
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      task.completedPomodoros++;
      persist();
    }
    return task;
  }

  function onChange(fn) {
    listeners.push(fn);
  }

  return {
    addTask,
    deleteTask,
    toggleComplete,
    getTasks,
    getActiveTask,
    incrementPomodoro,
    onChange,
  };
}
