const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { _electron } = require(process.env.WILL_PLAYWRIGHT_MODULE || 'playwright')
const { read, send, startProject, expand, breakdown, confirm } = require('./w2.flows.cjs')
const root = path.resolve(__dirname, '..')
const output = path.resolve(process.env.WILL_EVIDENCE_DIR || path.resolve(root, '../docs/w2-acceptance'))
const executablePath = process.env.WILL_DESKTOP_EXE || require('electron')
const errors = []
async function main() {
  await fs.mkdir(output, { recursive: true })
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'will-w2-electron-'))
  let app
  let page
  async function launch() {
    app = await _electron.launch({
      executablePath, args: process.env.WILL_DESKTOP_EXE ? [] : [root],
      env: { ...process.env, WILL_USER_DATA_DIR: profile, WILL_DEV_SERVER_URL: '' }, timeout: 30000,
    })
    page = await app.firstWindow()
    page.setDefaultTimeout(12000)
    page.on('pageerror', error => errors.push(error.message))
    await page.locator('.will-header h1').waitFor()
    assert.equal(new URL(page.url()).protocol, 'will:')
  }
  try {
    await launch()
    await page.getByRole('navigation').getByRole('button', { name: '项目', exact: true }).click()
    await page.getByRole('button', { name: '新建项目', exact: true }).click()
    const create = page.getByRole('dialog')
    await create.getByLabel('项目名称', { exact: true }).fill('W2 课程论文')
    await create.getByLabel('项目模板', { exact: true }).click()
    await page.getByText('课程论文', { exact: true }).last().click()
    await create.getByRole('button', { name: '创建项目', exact: true }).click()
    await page.getByRole('heading', { name: 'W2 课程论文', exact: true }).waitFor()
    await page.getByRole('button', { name: 'AI 助手', exact: true }).last().click()
    await expand(page)
    const staged = await breakdown(page, '桌面暂存的论文目标')
    const before = await read(page)
    const routeBeforeClose = await page.evaluate(() => location.hash)
    await page.screenshot({ path: path.join(output, 'electron-staged.png'), fullPage: true, scale: 'css' })
    await app.close()
    await launch()
    await page.getByRole('heading', { name: '待确认 3 项', exact: true }).waitFor()
    await page.getByRole('heading', { name: '桌面暂存的论文目标', exact: true }).waitFor()
    const restored = await read(page)
    assert.equal(restored.ai.activeId, staged.conversationId)
    assert.deepEqual(restored.ai.conversations[0].batches, before.ai.conversations[0].batches)
    assert.equal(restored.schedule.tasks.length, 0)
    await page.screenshot({ path: path.join(output, 'electron-restored.png'), fullPage: true, scale: 'css' })
    await confirm(page, 3)
    const confirmed = await read(page)
    for (const p of staged.proposals) {
      const task = confirmed.schedule.tasks.find(t => t.id === p.id)
      assert.equal(task.source.conversationId, staged.conversationId)
      assert.equal(task.due, undefined)
    }
    await page.getByRole('button', { name: '查看项目：W2 课程论文', exact: true }).click()
    await page.getByRole('button', { name: '桌面暂存的论文目标', exact: true }).waitFor()
    await page.screenshot({ path: path.join(output, 'electron-project.png'), fullPage: true, scale: 'css' })
    await app.close()
    await launch()
    await page.getByRole('button', { name: '桌面暂存的论文目标', exact: true }).waitFor()
    const twiceRestored = await read(page)
    assert.deepEqual(twiceRestored.schedule, confirmed.schedule)
    await page.getByRole('navigation').getByRole('button', { name: 'AI 工作区', exact: true }).click()
    await page.locator('.ai-confirmed').waitFor()
    assert.equal(await page.locator('.ai-review-batch').count(), 0)
    await startProject(page)
    await send(page, '整理通知：2026-11-10下午三点有组会，五点前提交汇报文档')
    await page.getByRole('heading', { name: '待确认 2 项', exact: true }).waitFor()
    await page.getByRole('button', { name: '确认添加 2 项', exact: true }).click()
    await page.getByRole('heading', { name: '已添加 2 项安排', exact: true }).waitFor()
    await page.getByRole('button', { name: '查看日历', exact: true }).click()
    await page.getByRole('heading', { name: '2026年11月10日', exact: true }).waitFor()
    await page.locator('.will-agenda').getByRole('button', { name: '编辑事项：提交汇报文档', exact: true }).waitFor()
    await page.screenshot({ path: path.join(output, 'electron-calendar.png'), fullPage: true, scale: 'css' })
    assert.deepEqual(errors, [])
    const result = {
      result: 'PASS', testedAt: new Date().toISOString(), executablePath, profile, url: page.url(), routeBeforeClose,
      conversationId: staged.conversationId, batchId: staged.batchId, taskIds: staged.proposals.map(p => p.id),
      checks: ['create paper-template project', 'project Drawer context and workspace continuity', 'edit and stage 3 undated tasks',
        'close/relaunch restores draft IDs and route', 'confirm once and close/relaunch keeps same task IDs',
        'confirmed history has no repeat submit', 'notification confirm in Drawer and calendar linkage'], errors,
    }
    await fs.writeFile(path.join(output, 'electron-w2-results.json'), JSON.stringify(result, null, 2) + '\n')
    console.log(JSON.stringify(result, null, 2))
  } catch (error) {
    await page?.screenshot({ path: path.join(output, 'electron-failure.png'), fullPage: true }).catch(() => {})
    console.error(await page?.locator('body').innerText().catch(() => 'Unavailable'))
    throw error
  } finally { await app?.close().catch(() => {}) }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
