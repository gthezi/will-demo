const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const { chromium } = require(process.env.WILL_PLAYWRIGHT_MODULE || 'playwright')
const { AI_KEY, SCHEDULE_KEY, read, send, startProject, expand, breakdown, confirm, notificationFlow, launchBrowser } = require('./w2.flows.cjs')
const output = path.resolve(process.env.WILL_EVIDENCE_DIR || '../docs/w2-acceptance')
const base = process.env.WILL_BASE_URL || 'http://127.0.0.1:4177/'
async function main() {
  await fs.mkdir(output, { recursive: true })
  const browser = await launchBrowser(chromium)
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: 'Asia/Shanghai' })
  const page = await context.newPage()
  page.setDefaultTimeout(12000)
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  try {
    await page.clock.install({ time: new Date('2026-11-06T09:00:00+08:00') })
    await page.goto(base)
    await page.evaluate(({ aiKey, scheduleKey }) => {
      localStorage.removeItem(aiKey)
      localStorage.removeItem(scheduleKey)
      localStorage.removeItem('will-workbench-route-v01')
      window.location.hash = '#/home'
    }, { aiKey: AI_KEY, scheduleKey: SCHEDULE_KEY })
    await page.reload()
    const notice = await notificationFlow(page, output)
    await startProject(page)
    await expand(page)
    await page.getByRole('button', { name: '新会话', exact: true }).click()
    await page.getByRole('combobox', { name: '会话参考范围', exact: true }).click()
    await page.getByText('参考：课程与学习', { exact: true }).last().click()
    const staged = await breakdown(page)
    const stagedHash = await page.evaluate(() => location.hash)
    await page.screenshot({ path: path.join(output, 'breakdown-staged.png'), fullPage: true })
    await page.getByRole('button', { name: '新会话', exact: true }).click()
    await send(page, '你好，能聊聊吗')
    await page.getByText(/不能提供通用大模型问答/).waitFor()
    await page.getByRole('button', { name: '历史会话', exact: true }).click()
    await page.locator('.ai-history button').filter({ hasText: '拆解任务：完成课程论文' }).click()
    await page.getByRole('heading', { name: '待确认 3 项', exact: true }).waitFor()
    assert.equal(await page.evaluate(() => location.hash), stagedHash)
    await page.reload()
    await page.getByRole('heading', { name: '待确认 3 项', exact: true }).waitFor()
    await page.getByRole('heading', { name: '先确定论文问题', exact: true }).waitFor()

    // Context changes affect future prompts, never the pending batch's project ownership.
    await page.getByRole('combobox', { name: '会话参考范围', exact: true }).click()
    await page.getByText('参考：个人事务', { exact: true }).last().click()
    let saved = await read(page)
    assert.ok(saved.ai.conversations.find(c => c.id === staged.conversationId).batches[0].proposals.every(p => p.projectId === 'course'))
    await page.getByRole('button', { name: 'AI 助手', exact: true }).first().click()
    await page.getByRole('dialog', { name: 'AI 助手', exact: true }).getByRole('heading', { name: '先确定论文问题', exact: true }).waitFor()
    await expand(page)

    const windows = []
    for (const theme of ['light', 'night']) {
      await page.getByRole('navigation').getByRole('button', { name: '设置', exact: true }).click()
      await page.getByRole('radiogroup', { name: '显示主题', exact: true }).getByText(theme === 'light' ? '日间' : '夜间', { exact: true }).click()
      await page.goto(new URL(stagedHash, base).href)
      await page.getByRole('heading', { name: '待确认 3 项', exact: true }).waitFor()
      for (const [width, height] of [[1440, 900], [1280, 720], [1024, 768], [800, 600]]) {
        await page.setViewportSize({ width, height })
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
        assert.equal(overflow, false, `${theme} ${width}x${height} overflow`)
        await page.getByRole('button', { name: '暂存草案', exact: true }).scrollIntoViewIfNeeded()
        await page.evaluate(() => scrollTo(0, 0))
        await page.screenshot({ path: path.join(output, `workspace-${width}x${height}-${theme}.png`), fullPage: true })
        await page.getByRole('button', { name: 'AI 助手', exact: true }).first().click()
        const drawer = page.getByRole('dialog', { name: 'AI 助手', exact: true })
        await drawer.getByRole('button', { name: '暂存草案', exact: true }).scrollIntoViewIfNeeded()
        await drawer.getByRole('button', { name: '关闭', exact: true }).click()
        await drawer.waitFor({ state: 'hidden' })
        windows.push({ theme, width, height, overflow })
      }
    }
    await page.setViewportSize({ width: 1440, height: 900 })
    await confirm(page, 3)
    await page.reload()
    await page.locator('.ai-confirmed').waitFor()
    saved = await read(page)
    assert.equal(saved.schedule.tasks.length, 4)
    assert.equal(saved.schedule.events.length, 1)
    for (const proposal of staged.proposals) assert.equal(saved.schedule.tasks.filter(t => t.id === proposal.id && !t.due).length, 1)
    await page.getByRole('button', { name: '查看项目：课程与学习', exact: true }).click()
    await page.getByRole('button', { name: '先确定论文问题', exact: true }).waitFor()

    // Global conversation may start before selecting a project; choosing a target is deferred to review.
    await page.getByRole('navigation').getByRole('button', { name: 'AI 工作区', exact: true }).click()
    await page.getByRole('button', { name: '新会话', exact: true }).click()
    await send(page, '拆解任务：准备答辩')
    await page.getByRole('button', { name: '确认添加 3 项', exact: true }).click()
    await page.getByText('请选择项目', { exact: true }).first().waitFor()
    saved = await read(page)
    assert.equal(saved.schedule.tasks.length, 4)
    await page.getByRole('combobox', { name: '批次目标项目', exact: true }).click()
    await page.getByText('个人事务', { exact: true }).last().click()
    await confirm(page, 3)
    saved = await read(page)
    assert.equal(saved.schedule.tasks.filter(t => t.projectId === 'personal').length, 3)

    // Cancel a live request and retry; input stays available.
    await page.getByRole('button', { name: '新会话', exact: true }).click()
    await page.getByRole('textbox', { name: '输入安排', exact: true }).fill('拆解任务：取消重试')
    await page.getByRole('button', { name: '生成草案', exact: true }).click()
    await page.getByRole('button', { name: '停止生成', exact: true }).click()
    assert.equal(await page.getByRole('textbox', { name: '输入安排', exact: true }).inputValue(), '拆解任务：取消重试')
    assert.equal(await page.locator('.ai-review-batch').count(), 0)
    await send(page, '整理通知：2026-02-30下午三点有讲座')
    await page.getByRole('alert').filter({ hasText: '日期不存在' }).waitFor()
    assert.match(await page.getByRole('textbox', { name: '输入安排', exact: true }).inputValue(), /2026-02-30/)
    await send(page, '拆解任务：取消重试')
    await page.getByRole('heading', { name: '待确认 3 项', exact: true }).waitFor()
    await page.getByRole('button', { name: '取消草案', exact: true }).click()
    assert.equal(await page.locator('.ai-review-batch').count(), 0)
    await send(page, '拆解任务：存储失败')
    await page.getByRole('heading', { name: '待确认 3 项', exact: true }).waitFor()
    await page.getByRole('combobox', { name: '批次目标项目', exact: true }).click()
    await page.getByText('课程与学习', { exact: true }).last().click()

    // Schedule write failure after successful AI checkpoint: no confirmed receipt, same IDs on retry.
    const countBefore = (await read(page)).schedule.tasks.length
    await page.evaluate(key => {
      const original = Storage.prototype.setItem
      window.restoreStorage = () => { Storage.prototype.setItem = original }
      Storage.prototype.setItem = function (k, v) { if (k === key) throw new DOMException('test write failure', 'QuotaExceededError'); return original.call(this, k, v) }
    }, SCHEDULE_KEY)
    await page.getByRole('button', { name: '确认添加 3 项', exact: true }).click()
    await page.getByRole('alert').filter({ hasText: '安排尚未保存到本机' }).waitFor()
    assert.equal((await read(page)).schedule.tasks.length, countBefore)
    await page.evaluate(() => window.restoreStorage())
    await page.getByRole('button', { name: '确认添加 3 项', exact: true }).click()
    await page.getByRole('heading', { name: '已添加 3 项安排', exact: true }).waitFor()
    assert.equal((await read(page)).schedule.tasks.length, countBefore + 3)

    // Fail the receipt only, then reload and verify reconciliation against the unique W1 record.
    await page.getByRole('button', { name: '新会话', exact: true }).click()
    await send(page, '拆解任务：确认标记失败')
    await page.getByRole('combobox', { name: '批次目标项目', exact: true }).click()
    await page.getByText('课程与学习', { exact: true }).last().click()
    await page.evaluate(key => {
      const original = Storage.prototype.setItem
      Storage.prototype.setItem = function (k, v) {
        if (k === key && JSON.parse(v).conversations.find(c => c.id === JSON.parse(v).activeId)?.batches.some(b => b.status === 'confirmed'))
          throw new DOMException('test receipt failure', 'QuotaExceededError')
        return original.call(this, k, v)
      }
    }, AI_KEY)
    await page.getByRole('button', { name: '确认添加 3 项', exact: true }).click()
    await page.getByText(/会话确认标记未保存/).waitFor()
    const receiptFail = await read(page)
    const receiptId = receiptFail.ai.activeId
    assert.equal(receiptFail.ai.conversations.find(c => c.id === receiptId).batches[0].status, 'confirming')
    await page.reload()
    await page.locator('.ai-confirmed').waitFor()
    assert.equal((await read(page)).schedule.tasks.length, countBefore + 6)
    assert.equal(await page.locator('.ai-review-batch').count(), 0)

    // A failed pre-write checkpoint must not reach the W1 schedule writer.
    await page.getByRole('button', { name: '新会话', exact: true }).click()
    await send(page, '拆解任务：草案暂存失败')
    await page.getByRole('combobox', { name: '批次目标项目', exact: true }).click()
    await page.getByText('课程与学习', { exact: true }).last().click()
    const beforeCheckpointFailure = await read(page)
    await page.evaluate(key => {
      const original = Storage.prototype.setItem
      Storage.prototype.setItem = function (k, v) { if (k === key) throw new DOMException('test checkpoint failure', 'QuotaExceededError'); return original.call(this, k, v) }
    }, AI_KEY)
    await page.getByRole('button', { name: '确认添加 3 项', exact: true }).click()
    await page.getByRole('alert').filter({ hasText: '尚未写入安排' }).waitFor()
    assert.deepEqual((await read(page)).schedule, beforeCheckpointFailure.schedule)
    await page.reload()
    await page.getByRole('heading', { name: '待确认 3 项', exact: true }).waitFor()
    await page.getByRole('button', { name: '取消草案', exact: true }).click()

    // Incomplete events remain drafts until required dates/times are supplied.
    await send(page, '整理通知：下午三点有讲座')
    await page.getByRole('button', { name: '确认添加 1 项', exact: true }).click()
    await page.getByText('请选择日期', { exact: true }).waitFor()
    assert.deepEqual((await read(page)).schedule, beforeCheckpointFailure.schedule)
    await page.getByRole('button', { name: '取消草案', exact: true }).click()

    // Date-only tasks stay date-only when edited in the shared AI form.
    await send(page, '整理通知：2026-11-12前提交材料')
    await page.getByRole('combobox', { name: '批次目标项目', exact: true }).click()
    await page.getByText('课程与学习', { exact: true }).last().click()
    await confirm(page, 1)
    const dateOnly = (await read(page)).schedule.tasks.find(t => t.title.includes('提交材料'))
    assert.equal(dateOnly.due, '2026-11-12')
    assert.equal(dateOnly.time, undefined)

    // Archiving the selected target after generation cannot silently retarget the batch.
    await page.getByRole('button', { name: '新会话', exact: true }).click()
    await page.getByRole('combobox', { name: '会话参考范围', exact: true }).click()
    await page.getByText('参考：课程与学习', { exact: true }).last().click()
    await send(page, '拆解任务：已归档项目')
    const archivedSession = (await read(page)).ai.activeId
    await page.getByRole('navigation').getByRole('button', { name: '项目', exact: true }).click()
    await page.getByRole('button', { name: '管理项目：课程与学习', exact: true }).click()
    await page.getByRole('menuitem', { name: '归档项目' }).click()
    await page.locator('.ant-modal-confirm').getByRole('button', { name: '确认归档', exact: true }).click()
    await page.goto(new URL(`#/ai/${archivedSession}`, base).href)
    await page.getByRole('button', { name: '确认添加 3 项', exact: true }).click()
    await page.getByText('请选择进行中的项目', { exact: true }).first().waitFor()
    const archiveRejected = await read(page)
    assert.equal(archiveRejected.schedule.tasks.length, countBefore + 7)
    assert.ok(archiveRejected.ai.conversations.find(c => c.id === archivedSession).batches[0].proposals.every(p => p.projectId === 'course'))
    await page.screenshot({ path: path.join(output, 'archived-target-blocked.png'), fullPage: true })
    assert.deepEqual(errors, [])
    const result = { result: 'PASS', testedAt: new Date().toISOString(), base, browser: browser.version(), notice, staged, windows, errors,
      checks: ['project notice edit/remove/confirm/calendar/source link', 'Drawer/workspace shared IDs', 'history switch and reload of staged undated drafts',
        'context changes leave pending ownership intact', 'global target requested only at confirmation', 'live cancel and invalid-date retry',
        'schedule write failure and retry with same IDs', 'receipt write failure and reload reconciliation', '8 theme/size layouts and accessible Drawer',
        'AI pre-write checkpoint failure leaves schedule unchanged', 'incomplete events blocked; date-only tasks remain date-only', 'archived target blocked without silent retarget'] }
    await fs.writeFile(path.join(output, 'browser-w2-results.json'), JSON.stringify(result, null, 2) + '\n')
    console.log(JSON.stringify(result, null, 2))
  } catch (error) {
    await page.screenshot({ path: path.join(output, 'browser-failure.png'), fullPage: true }).catch(() => {})
    console.error(await page.locator('main').innerText().catch(() => 'Unavailable'))
    throw error
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
