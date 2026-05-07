const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, Notification } = require('electron');
const path = require('path');
const zlib = require('zlib');

let win = null;
let tray = null;
let isQuitting = false;

// --- PNG generation for tray icon ---
function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function createPngChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const lengthBuffer = Buffer.alloc(4);
  lengthBuffer.writeUInt32BE(data.length, 0);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([lengthBuffer, typeBuffer, data, crcBuffer]);
}

function createTrayIconBuffer() {
  const SIZE = 32;
  const rawData = Buffer.alloc(SIZE * (1 + SIZE * 4));
  const cx = SIZE / 2, cy = SIZE / 2, r = SIZE / 2 - 2;

  for (let y = 0; y < SIZE; y++) {
    rawData[y * (1 + SIZE * 4)] = 0;
    for (let x = 0; x < SIZE; x++) {
      const offset = y * (1 + SIZE * 4) + 1 + x * 4;
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (dist <= r) {
        rawData[offset] = 231;
        rawData[offset + 1] = 76;
        rawData[offset + 2] = 60;
        rawData[offset + 3] = 255;
      } else if (dist <= r + 1.5) {
        // Anti-alias edge
        const alpha = Math.round(255 * (r + 1.5 - dist) / 1.5);
        rawData[offset] = 231;
        rawData[offset + 1] = 76;
        rawData[offset + 2] = 60;
        rawData[offset + 3] = alpha;
      } else {
        rawData[offset + 3] = 0;
      }
    }
  }

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(SIZE, 0);
  ihdrData.writeUInt32BE(SIZE, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 6;
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrChunk = createPngChunk('IHDR', ihdrData);
  const idatChunk = createPngChunk('IDAT', zlib.deflateSync(rawData));
  const iendChunk = createPngChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// --- Window ---
function createWindow() {
  win = new BrowserWindow({
    width: 960,
    height: 680,
    minWidth: 640,
    minHeight: 480,
    title: '番茄钟',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  win.loadFile('index.html');

  win.once('ready-to-show', () => {
    win.show();
  });

  win.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      win.hide();
    }
  });

  win.on('closed', () => {
    win = null;
  });
}

// --- System Tray ---
function createTray() {
  const iconBuffer = createTrayIconBuffer();
  const icon = nativeImage.createFromBuffer(iconBuffer);
  const trayIcon = icon.resize({ width: 16, height: 16 });

  tray = new Tray(trayIcon);
  tray.setToolTip('番茄钟');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: () => {
        const w = getOrCreateWindow();
        w.show();
        w.focus();
      },
    },
    {
      label: '重置计时',
      click: () => {
        const w = getOrCreateWindow();
        w.show();
        w.focus();
        w.webContents.send('tray-command', 'reset');
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    const w = getOrCreateWindow();
    if (w.isVisible()) {
      w.hide();
    } else {
      w.show();
      w.focus();
    }
  });
}

function getOrCreateWindow() {
  if (!win) {
    createWindow();
    createTray();
  }
  return win;
}

// --- IPC ---
ipcMain.on('update-tray', (_, text) => {
  if (tray) tray.setToolTip(text);
});

ipcMain.on('flash-window', () => {
  if (win) {
    win.flashFrame(true);
    if (Notification.isSupported()) {
      new Notification({ title: '番茄钟', body: '计时结束！' }).show();
    }
  }
});

// --- App lifecycle ---
app.whenReady().then(() => {
  createWindow();
  createTray();
});

app.on('window-all-closed', () => {});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('activate', () => {
  getOrCreateWindow().show();
});
