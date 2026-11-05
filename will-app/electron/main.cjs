const { app, BrowserWindow, Menu, dialog, net, protocol, screen, session } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const { assetPath, devServerUrl, allowedNavigation } = require('./asset-path.cjs')

app.setName('Will PC')
app.setAppUserModelId('cn.will.demo')
const profile = process.env.WILL_USER_DATA_DIR || path.join(app.getPath('appData'), 'WillPC')
if (!path.isAbsolute(profile)) throw new Error('The application data directory must be absolute')
fs.mkdirSync(profile, { recursive: true })
app.setPath('userData', profile)
protocol.registerSchemesAsPrivileged([{
  scheme: 'will',
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
}])

const developmentUrl = !app.isPackaged && process.env.WILL_DEV_SERVER_URL
  ? devServerUrl(process.env.WILL_DEV_SERVER_URL) : null
const startUrl = developmentUrl || 'will://app/'
let window

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (window?.isMinimized()) window.restore()
    window?.show()
    window?.focus()
  })
  app.whenReady().then(async () => {
    const assets = path.join(__dirname, '../dist')
    protocol.handle('will', async request => {
      try {
        const response = await net.fetch(pathToFileURL(assetPath(request.url, assets)).href)
        const headers = new Headers(response.headers)
        headers.set('Content-Security-Policy', [
          "default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data:", "font-src 'self' data:", "connect-src 'self'",
          "object-src 'none'", "base-uri 'self'", "frame-src 'none'", "form-action 'none'",
        ].join('; '))
        return new Response(response.body, { status: response.status, headers })
      } catch {
        return new Response('Application asset unavailable', { status: 404 })
      }
    })
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
    session.defaultSession.setPermissionCheckHandler(() => false)
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { label: '文件', submenu: [{ label: '退出', role: 'quit' }] },
      { label: '编辑', submenu: [
        { label: '撤销', role: 'undo' }, { label: '重做', role: 'redo' }, { type: 'separator' },
        { label: '剪切', role: 'cut' }, { label: '复制', role: 'copy' }, { label: '粘贴', role: 'paste' },
        { label: '全选', role: 'selectAll' },
      ] },
      { label: '视图', submenu: [
        { label: '重新载入', role: 'reload' }, { type: 'separator' },
        { label: '实际大小', role: 'resetZoom' }, { label: '放大', role: 'zoomIn' }, { label: '缩小', role: 'zoomOut' },
        { type: 'separator' }, { label: '全屏', role: 'togglefullscreen' },
      ] },
      { label: '帮助', submenu: [{
        label: '关于 Will PC',
        click: () => dialog.showMessageBox(window, {
          type: 'info', title: 'Will PC', message: `Will PC ${app.getVersion()} · 展示版`,
          detail: 'AI 为本地规则模拟，无需服务端。安排保存在本机，提醒仅保存偏好，不发送通知。',
        }),
      }] },
    ]))
    const area = screen.getPrimaryDisplay().workAreaSize
    window = new BrowserWindow({
      width: Math.min(1440, area.width), height: Math.min(960, area.height),
      minWidth: Math.min(760, area.width), minHeight: Math.min(600, area.height),
      title: 'Will PC', backgroundColor: '#10151b', show: false,
      webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true },
    })
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    window.webContents.on('will-navigate', (event, url) => {
      if (!allowedNavigation(url, startUrl)) event.preventDefault()
    })
    window.webContents.on('will-attach-webview', event => event.preventDefault())
    window.once('ready-to-show', () => window.show())
    await window.loadURL(startUrl)
  }).catch(error => {
    console.error(error)
    dialog.showErrorBox('Will PC 无法启动', '请确认已完整解压展示包。开发模式请检查本地开发服务。\n' + error.message)
    app.exit(1)
  })
  app.on('window-all-closed', () => app.quit())
}
