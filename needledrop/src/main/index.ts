import { app, BrowserWindow, Menu, net, session, shell } from 'electron'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { registerIpc } from './ipc'
import { createJsonFetcher, SlidingWindowLimiter } from './providers/http'
import { DEEZER_BASE, DeezerProvider } from './providers/deezer'
import { ITUNES_BASE, ItunesProvider } from './providers/itunes'
import { MusicService } from './services/music-service'
import { loadWindowState, trackWindowState } from './window-state'

let mainWindow: BrowserWindow | null = null

// Test hook: lets the end-to-end suite point providers at a local fake server.
// Ignored in packaged builds so users can never be redirected.
const devOverride = (name: string): string | undefined => (app.isPackaged ? undefined : process.env[name])

function createMusicService(): MusicService {
  // net.fetch uses Chromium's network stack: system proxy and certificate store included.
  const fetchImpl = net.fetch.bind(net) as unknown as typeof fetch
  const deezer = new DeezerProvider(
    devOverride('NEEDLEDROP_DEEZER_BASE') ?? DEEZER_BASE,
    createJsonFetcher({ provider: 'deezer', label: 'Deezer', limiter: new SlidingWindowLimiter(40, 5000), fetchImpl })
  )
  const itunes = new ItunesProvider(
    devOverride('NEEDLEDROP_ITUNES_BASE') ?? ITUNES_BASE,
    createJsonFetcher({ provider: 'itunes', label: 'Apple iTunes', limiter: new SlidingWindowLimiter(18, 60_000), fetchImpl })
  )
  return new MusicService([deezer, itunes])
}

function createWindow(): void {
  const saved = loadWindowState()
  // Packaged Windows builds use the icon embedded in the exe; this file only exists when running from source.
  const iconPath = join(__dirname, '../../build/icon.png')
  const win = new BrowserWindow({
    width: saved.width,
    height: saved.height,
    ...(saved.x !== undefined && saved.y !== undefined ? { x: saved.x, y: saved.y } : {}),
    minWidth: 1000,
    minHeight: 680,
    show: false,
    title: 'Needledrop',
    backgroundColor: '#15111d',
    autoHideMenuBar: true,
    ...(existsSync(iconPath) ? { icon: iconPath } : {}),
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#15111d', symbolColor: '#f4eee6', height: 36 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      // Games start audio without a click (autoplay of the next song in a match).
      autoplayPolicy: 'no-user-gesture-required'
    }
  })
  mainWindow = win
  trackWindowState(win)
  if (saved.maximized) win.maximize()
  win.once('ready-to-show', () => win.show())
  win.on('closed', () => {
    mainWindow = null
  })

  // F11 toggles fullscreen (the menu bar is removed, so there is no built-in shortcut).
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen())
      event.preventDefault()
    }
  })

  // The app never navigates away from itself; links open in the user's browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event, url) => {
    const dev = process.env['ELECTRON_RENDERER_URL']
    if (!(dev && url.startsWith(dev))) event.preventDefault()
  })

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (!app.isPackaged && devUrl) void win.loadURL(devUrl)
  else void win.loadFile(join(__dirname, '../renderer/index.html'))
}

async function setupAutoUpdate(): Promise<void> {
  // Installed (NSIS) builds update from GitHub Releases. The portable exe never self-updates.
  if (!app.isPackaged || process.env['PORTABLE_EXECUTABLE_FILE']) return
  try {
    const { autoUpdater } = await import('electron-updater')
    autoUpdater.on('error', (err) => console.warn('[update]', err?.message ?? err))
    await autoUpdater.checkForUpdatesAndNotify()
  } catch (err) {
    console.warn('[update] skipped:', err instanceof Error ? err.message : err)
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  void app.whenReady().then(() => {
    Menu.setApplicationMenu(null)
    session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false))
    registerIpc(createMusicService(), () => mainWindow)
    createWindow()
    void setupAutoUpdate()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
