const {
  app,
  BrowserWindow,
  ipcMain,
  desktopCapturer,
  systemPreferences,
  shell,
} = require('electron')
const path = require('path')

// ── Window ──────────────────────────────────────────────────────────────────
let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 660,
    minWidth: 380,
    minHeight: 580,
    resizable: true,
    title: 'SP Recorder',
    backgroundColor: '#0f0f17',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  })

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  mainWindow.setMenu(null)
}

// ── App lifecycle ─────────────────────────────────────────────────────────
app.whenReady().then(() => {
  // ── IPC: desktop sources (screen IDs for system audio capture) ───────────
  ipcMain.handle('get-desktop-sources', async () => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 1, height: 1 },
      })
      return { sources: sources.map((s) => ({ id: s.id, name: s.name })) }
    } catch (err) {
      return { sources: [], error: err.message }
    }
  })

  // ── IPC: macOS media permission requests ─────────────────────────────────
  ipcMain.handle('request-media-access', async (_, type) => {
    if (process.platform !== 'darwin') return true
    const status = systemPreferences.getMediaAccessStatus(type)
    if (status === 'granted') return true
    if (status === 'not-determined') {
      return await systemPreferences.askForMediaAccess(type)
    }
    return false
  })

  ipcMain.handle('get-media-access-status', async (_, type) => {
    if (process.platform !== 'darwin') return 'granted'
    return systemPreferences.getMediaAccessStatus(type)
  })

  // ── IPC: transcript-ai API calls (proxied from main to avoid CORS) ────────
  ipcMain.handle('transcript-api', async (_, { apiPath, method, body, token }) => {
    const BASE = 'https://transcript-ai-lime.vercel.app'
    try {
      const res = await fetch(`${BASE}${apiPath}`, {
        method: method ?? 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        ...(body != null ? { body: JSON.stringify(body) } : {}),
      })
      let data
      try { data = await res.json() } catch { data = {} }
      return { ok: res.ok, status: res.status, data }
    } catch (err) {
      return { ok: false, status: 0, data: {}, error: err.message }
    }
  })

  // ── IPC: upload audio file to Supabase signed URL ─────────────────────────
  ipcMain.handle('upload-audio', async (_, { signedUrl, buffer, contentType }) => {
    try {
      const res = await fetch(signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: Buffer.from(buffer),
      })
      return { ok: res.ok, status: res.status }
    } catch (err) {
      return { ok: false, status: 0, error: err.message }
    }
  })

  // ── IPC: open url in default browser ─────────────────────────────────────
  ipcMain.handle('open-external', async (_, url) => {
    await shell.openExternal(url)
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
