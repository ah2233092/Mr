// Desktop app: runs the whole chat server inside the app and shows it in a window.
// No separate server, no Docker, no settings files — install, open, add AI keys.
const { app, BrowserWindow, shell, Menu, nativeTheme, dialog } = require('electron');
const path = require('node:path');
const net = require('node:net');
const { pathToFileURL } = require('node:url');

// Packaged: server + web files are shipped in resources/app. During development: the parent folder.
const APP_DIR = app.isPackaged ? path.join(process.resourcesPath, 'app') : path.join(__dirname, '..');
const PREFERRED_PORT = 3765; // stable port keeps your theme / model choices between launches

let win = null;
let baseUrl = null;

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(boot);
}

function freePort(port, attempts = 30) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => resolve(attempts > 0 ? freePort(port + 1, attempts - 1) : 0));
    srv.once('listening', () => srv.close(() => resolve(port)));
    srv.listen(port, '127.0.0.1');
  });
}

async function startServer() {
  // Optional backend settings file (never shown in the app), e.g. OMNIROUTE_PASSWORD=...
  const cfg = path.join(app.getPath('userData'), 'config.env');
  try { if (require('node:fs').existsSync(cfg)) process.loadEnvFile(cfg); } catch (e) { console.warn('config.env:', e.message); }
  const port = await freePort(PREFERRED_PORT);
  Object.assign(process.env, {
    SKIP_DOTENV: '1',
    DATA_DIR: process.env.DATA_DIR || path.join(app.getPath('userData'), 'data'),
    HOST: '127.0.0.1',
    PORT: String(port),
    APP_NAME: process.env.APP_NAME || 'ChatGPT',
    COOKIE_SECURE: 'false',
    TRUST_PROXY: 'false',
  });
  const server = await import(pathToFileURL(path.join(APP_DIR, 'server', 'index.js')).href);
  await server.start(port, '127.0.0.1');
  return `http://127.0.0.1:${port}`;
}

function createWindow() {
  win = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 380,
    minHeight: 520,
    title: process.env.APP_NAME,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#212121' : '#ffffff',
    icon: path.join(APP_DIR, 'public', 'icons', 'icon-512.png'),
    webPreferences: { contextIsolation: true, sandbox: true, spellcheck: true },
  });
  win.once('ready-to-show', () => win.show());
  // Links to other websites (e.g. "Get key") open in the normal browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(baseUrl)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(baseUrl)) { e.preventDefault(); shell.openExternal(url); }
  });
  win.on('closed', () => { win = null; });
  win.loadURL(baseUrl);
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(isMac ? [{ role: 'appMenu' }] : []),
    { role: 'editMenu' },
    { label: 'View', submenu: [{ role: 'reload' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }] },
    { role: 'windowMenu' },
  ]));
}

async function boot() {
  try {
    baseUrl = await startServer();
  } catch (e) {
    dialog.showErrorBox('Could not start', String(e?.stack || e));
    app.quit();
    return;
  }
  buildMenu();
  // The server runs inside the app, so no offline cache is needed: clear it so an
  // updated app always shows its new interface (login and settings are kept).
  try {
    const { session } = require('electron');
    await session.defaultSession.clearStorageData({ storages: ['serviceworkers', 'cachestorage'] });
    await session.defaultSession.clearCache();
  } catch (e) { console.warn('cache clear:', e.message); }
  createWindow();
  app.on('activate', () => { if (!win) createWindow(); });
}

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
