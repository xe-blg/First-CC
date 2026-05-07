let notificationPermission = 'default';

function requestNotificationPermission() {
  if (!('Notification' in window)) return;
  Notification.requestPermission().then(perm => {
    notificationPermission = perm;
  });
}

function notify(title, body) {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🍅</text></svg>' });
  }
}

function playChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;

    function tone(freq, start, duration, volume) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(volume, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration);
    }

    tone(880, now, 0.15, 0.3);
    tone(1100, now + 0.12, 0.3, 0.25);
    tone(660, now + 0.3, 0.15, 0.2);
    tone(880, now + 0.42, 0.4, 0.2);
  } catch {
    // AudioContext unavailable — silently skip
  }
}
