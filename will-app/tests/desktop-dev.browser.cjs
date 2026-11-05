const assert = require('node:assert/strict')
const { spawn } = require('node:child_process')
const fs = require('node:fs/promises')
const net = require('node:net')
const path = require('node:path')
const { chromium } = require(process.env.WILL_PLAYWRIGHT_MODULE || 'playwright')

async function freePort() {
  const server = net.createServer()
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  await new Promise(resolve => server.close(resolve))
  return port
}
async function main() {
  const debugPort = await freePort()
  const profile = path.resolve(__dirname, '../../release/desktop-dev', Date.now().toString())
  const root = path.resolve(__dirname, '..')
  const port = Number(process.env.WILL_DEV_PORT || 5177)
  let log = ''
  const child = spawn(process.execPath, ['scripts/desktop-dev.mjs', `--remote-debugging-port=${debugPort}`], {
    cwd: root, windowsHide: true,
    env: { ...process.env, WILL_USER_DATA_DIR: profile, WILL_DEV_PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let exited = false
  const done = new Promise(resolve => child.once('exit', code => { exited = true; resolve(code) }))
  child.stdout.on('data', chunk => { log += chunk })
  child.stderr.on('data', chunk => { log += chunk })
  let browser
  try {
    const deadline = Date.now() + 25000
    while (Date.now() < deadline) {
      if (exited) throw new Error(log)
      try {
        const response = await fetch(`http://127.0.0.1:${debugPort}/json/version`, { signal: AbortSignal.timeout(500) })
        if (response.ok) break
      } catch { /* Wait for the actual Electron debugging endpoint. */ }
      await new Promise(resolve => setTimeout(resolve, 200))
    }
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${debugPort}`)
    const context = browser.contexts()[0]
    const page = context.pages()[0] || await context.waitForEvent('page')
    await page.getByRole('heading', { name: '我的工作台', exact: true }).waitFor()
    assert.equal(page.url(), `http://127.0.0.1:${port}/`)
    await page.getByRole('button', { name: 'AI 助手', exact: true }).click()
    await page.getByRole('dialog', { name: 'AI 助手' }).getByText('本地模拟', { exact: true }).waitFor()
    await page.evaluate(() => window.close())
    const code = await Promise.race([done, new Promise((_, reject) => setTimeout(() => reject(new Error('Development process did not stop')), 5000))])
    assert.equal(code, 0)
    await assert.rejects(fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(1000) }))
    const result = { testedAt: new Date().toISOString(), status: 'passed', devUrl: `http://127.0.0.1:${port}/`,
      checks: ['Vite 和 Electron 一条命令启动', '桌面实际显示首页与本地模拟 AI 面板', '关闭窗口后 Electron 与 Vite 均退出，端口释放'],
      log }
    await fs.writeFile(path.resolve(root, '../docs/demo-acceptance/2026-11-07/dev-results.json'), JSON.stringify(result, null, 2) + '\n')
    console.log(JSON.stringify(result, null, 2))
  } finally {
    if (browser) await browser.close().catch(() => {})
    if (!exited) child.kill()
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
