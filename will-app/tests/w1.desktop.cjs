const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { _electron } = require(process.env.WILL_PLAYWRIGHT_MODULE || 'playwright')

const root = path.resolve(__dirname, '..')
const output = path.resolve(process.env.WILL_EVIDENCE_DIR || path.resolve(root, '../docs/w1-acceptance'))
const executablePath = process.env.WILL_DESKTOP_EXE || require('electron')
const errors = []
let profile

async function launch() {
  const app = await _electron.launch({
    executablePath,
    args: process.env.WILL_DESKTOP_EXE ? [] : [root],
    env: { ...process.env, WILL_USER_DATA_DIR: profile, WILL_DEV_SERVER_URL: '' },
    timeout: 30000,
  })
  const page = await app.firstWindow()
  page.setDefaultTimeout(10000)
  page.on('pageerror', error => errors.push(error.message))
  await page.locator('.will-header h1').waitFor()
  assert.equal(new URL(page.url()).protocol, 'will:')
  return { app, page }
}

async function main() {
  await fs.mkdir(output, { recursive: true })
  profile = await fs.mkdtemp(path.join(os.tmpdir(), 'will-w1-electron-'))
  let { app, page } = await launch()
  try {
    await page.getByRole('navigation').getByRole('button', { name: '项目' }).click()
    await page.getByRole('button', { name: '课程与学习', exact: true }).click()
    await page.getByRole('tab', { name: /任务/ }).click()
    await page.getByRole('button', { name: '新建任务' }).click()
    const editor = page.getByRole('dialog').last()
    await editor.getByLabel('标题').fill('Electron 重启保留任务')
    await editor.getByRole('button', { name: '添加安排' }).click()
    await page.locator('.will-task-card').filter({ hasText: 'Electron 重启保留任务' }).waitFor()

    const beforeClose = await page.evaluate(() => ({
      hash: location.hash,
      data: JSON.parse(localStorage.getItem('will-workbench-schedule-v03')),
    }))
    assert.match(beforeClose.hash, /^#\/projects\/course\/tasks$/)
    assert.ok(beforeClose.data.tasks.some(task => task.title === 'Electron 重启保留任务' && !task.due))
    await app.close()

    ;({ app, page } = await launch())
    await page.getByRole('tab', { name: /任务/, selected: true }).waitFor()
    await page.locator('.will-task-card').filter({ hasText: 'Electron 重启保留任务' }).waitFor()
    const afterRestart = await page.evaluate(() => ({
      hash: location.hash,
      savedRoute: localStorage.getItem('will-workbench-route-v01'),
      data: JSON.parse(localStorage.getItem('will-workbench-schedule-v03')),
    }))
    assert.equal(afterRestart.savedRoute, beforeClose.hash)
    assert.deepEqual(afterRestart.data, beforeClose.data)
    const window = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getBounds())
    const viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, devicePixelRatio }))
    await page.screenshot({ path: path.join(output, 'electron-restart.png'), fullPage: true, scale: 'css' })
    assert.deepEqual(errors, [])

    const result = {
      result: 'PASS', testedAt: new Date().toISOString(), executablePath,
      routeBeforeClose: beforeClose.hash, routeAfterRestart: afterRestart.savedRoute, urlAfterRestart: page.url(),
      taskId: afterRestart.data.tasks.find(task => task.title === 'Electron 重启保留任务').id,
      profile, errors, window, viewport, screenshot: 'electron-restart.png',
    }
    await fs.writeFile(path.join(output, 'electron-w1-results.json'), `${JSON.stringify(result, null, 2)}\n`)
    console.log(JSON.stringify(result, null, 2))
  } finally {
    await app.close().catch(() => {})
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
