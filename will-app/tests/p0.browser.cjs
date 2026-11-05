const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { chromium } = require(process.env.WILL_PLAYWRIGHT_MODULE || 'playwright')

const url = process.env.WILL_P0_URL || 'http://127.0.0.1:5175/'
const baselineUrl = process.env.WILL_P0_BASELINE_URL
const output = path.resolve(__dirname, '../../docs/gpt-review/p0-images')
const resultsPath = path.resolve(__dirname, '../../docs/gpt-review/p0-browser-results.json')
const key = 'will-prototype-schedule-v01'
const rangeKey = 'will-react-upcoming-range-v01'
const frozenNow = new Date('2026-11-05T14:00:00+08:00')
const errors = []
const checks = []
const viewportChecks = []

function fixture() {
  return {
    version: 2,
    projects: [
      { id: 'will', name: 'Will 客户端', archived: false },
      { id: 'course', name: '课程与学习', archived: false },
      { id: 'personal', name: '个人事务', archived: false },
    ],
    tasks: [
      { id: 'expired', title: '核对上午的反馈', due: '2026-11-05', time: '09:00', projectId: 'will', done: false },
      { id: 'today', title: '完善首页布局', due: '2026-11-05', time: '23:00', projectId: 'will', done: false },
      { id: 'tomorrow', title: '准备原型演示', due: '2026-11-06', time: '10:00', projectId: 'will', done: false },
      { id: 'last', title: '整理课程报告', due: '2026-11-07', time: '17:00', projectId: 'course', done: false },
      { id: 'outside', title: '整理调研反馈', due: '2026-11-08', time: '18:00', projectId: 'will', done: false },
      { id: 'done', title: '确认核心交互流程', due: '2026-11-04', time: '18:00', projectId: 'will', done: true },
    ],
    events: [
      { id: 'demo-event', title: '技术组讨论', date: '2026-11-05', time: '15:00', duration: 60, projectId: 'will', remind: 30 },
    ],
  }
}

async function main() {
  fs.mkdirSync(output, { recursive: true })
  const browser = await chromium.launch()
  async function open({ width = 1440, theme = 'night', data = fixture(), target = url, savedRange, storageFailure, username } = {}) {
    const context = await browser.newContext({
      viewport: { width, height: width < 600 ? 844 : 1000 }, timezoneId: 'Asia/Shanghai',
    })
    const page = await context.newPage()
    await page.clock.setFixedTime(frozenNow)
    page.setDefaultTimeout(10000)
    page.on('pageerror', error => errors.push(error.message))
    page.on('response', response => { if (response.status() >= 400) errors.push(`HTTP ${response.status()} ${response.url()}`) })
    page.on('requestfailed', request => errors.push(`Request failed: ${request.url()}`))
    await context.addInitScript(({ key, rangeKey, data, theme, savedRange, storageFailure, username }) => {
      if (!sessionStorage.getItem('p0-seeded')) {
        localStorage.setItem(key, JSON.stringify(data))
        localStorage.setItem('will-react-theme-v01', theme)
        if (username) localStorage.setItem('will-prototype-name-v01', username)
        if (savedRange !== undefined) localStorage.setItem(rangeKey, savedRange)
        sessionStorage.setItem('p0-seeded', 'yes')
      }
      if (storageFailure) {
        const originalSet = Storage.prototype.setItem
        const originalGet = Storage.prototype.getItem
        Storage.prototype.setItem = function (name, value) {
          if (name === rangeKey) throw new DOMException('Test storage failure', 'QuotaExceededError')
          return originalSet.call(this, name, value)
        }
        if (storageFailure === 'read') Storage.prototype.getItem = function (name) {
          if (name === rangeKey) throw new DOMException('Test storage failure', 'SecurityError')
          return originalGet.call(this, name)
        }
      }
    }, { key, rangeKey, data, theme, savedRange, storageFailure, username })
    await page.goto(target, { waitUntil: 'networkidle' })
    await page.getByRole('heading', { name: '我的工作台', exact: true }).waitFor()
    return { context, page }
  }
  const navigate = (page, name) => page.getByRole('navigation').getByRole('button', { name, exact: true }).click()
  const screenshot = async (page, name) => {
    await page.mouse.move(0, 0)
    await page.locator('.ant-tooltip:visible').waitFor({ state: 'hidden' })
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.screenshot({
      path: path.join(output, `${name}.png`),
      fullPage: !(await page.locator('.ant-drawer-open').count()), animations: 'disabled',
    })
  }
  const stored = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key)
  const range = async (page, days) => {
    await navigate(page, '设置')
    await page.getByRole('radiogroup', { name: '近期截止范围' }).getByText(`${days} 天`, { exact: true }).click()
    await navigate(page, '首页')
    await page.getByText(`未来 ${days} 天（含今天）`, { exact: true }).waitFor()
  }
  const generate = async page => {
    await page.getByRole('button', { name: 'AI 助手', exact: true }).click()
    await page.getByRole('textbox', { name: '输入安排' }).fill('明天下午三点开项目组会，五点前提交汇报文档')
    await page.getByRole('button', { name: '生成草案', exact: true }).click()
    await page.getByRole('group', { name: '安排 2', exact: true }).waitFor()
  }
  try {
    // P0-1: inclusive collection, shared count/list, persistent settings and overdue access.
    const { context, page } = await open()
    assert.equal(await page.locator('.will-deadline-row').count(), 3)
    assert.match(await page.locator('.will-metrics').innerText(), /3\s*项未来 3 天截止/)
    await page.locator('.will-metric-button').click()
    const overdue = page.locator('.will-overdue-section')
    await overdue.getByRole('checkbox', { name: '完成待办：核对上午的反馈', exact: true }).click()
    assert.equal((await stored(page)).tasks.find(item => item.id === 'expired').done, true)
    await page.getByRole('region', { name: '待办清单', exact: true })
      .getByRole('checkbox', { name: '恢复待办：核对上午的反馈' }).click()
    const before = await stored(page)
    await range(page, 7)
    assert.equal(await page.locator('.will-deadline-row').count(), 4)
    assert.deepEqual(await stored(page), before)
    await page.reload({ waitUntil: 'networkidle' })
    assert.equal(await page.evaluate(key => localStorage.getItem(key), rangeKey), '7')
    await page.getByText('未来 7 天（含今天）', { exact: true }).waitFor()
    await range(page, 3)
    await page.getByRole('region', { name: '待办清单', exact: true }).getByRole('checkbox', { name: '完成待办：完善首页布局' }).click()
    assert.equal(await page.locator('.will-deadline-row').count(), 2)
    await navigate(page, '日历')
    await page.getByRole('checkbox', { name: '恢复待办：完善首页布局' }).click()
    await navigate(page, '项目')
    await page.getByRole('checkbox', { name: '完成待办：完善首页布局' }).click()
    await page.getByRole('checkbox', { name: '恢复待办：完善首页布局' }).click()
    await navigate(page, '首页')
    assert.equal(await page.locator('.will-deadline-row').count(), 3)
    checks.push('P0-1: three inclusive dates, count/list agree, seven-day change, reload, completion across calendar/projects, overdue complete/restore')

    const many = fixture()
    for (let index = 0; index < 4; index++) many.tasks.push({
      id: `extra-${index}`, title: `核对演示材料 ${index + 1}`, due: '2026-11-06',
      time: `${11 + index}:00`, projectId: 'will', done: false,
    })
    const more = await open({ data: many, theme: 'light' })
    assert.equal(await more.page.locator('.will-deadline-row').count(), 4)
    await more.page.getByText('显示 4 项 / 共 7 项', { exact: true }).waitFor()
    await more.page.getByRole('button', { name: '查看全部', exact: true }).click()
    assert.equal(await more.page.locator('.will-deadline-row').count(), 7)
    await more.page.getByRole('button', { name: '只看前 4 项', exact: true }).click()
    await more.page.locator('.will-metric-button').click()
    await screenshot(more.page, 'after-more-and-overdue')
    await more.context.close()
    checks.push('P0-1: more than four matches show accurate total, expand/collapse, explicit overdue entry')

    for (const scenario of ['empty', 'events-only', 'completed', 'overdue-only']) {
      const data = fixture()
      if (scenario === 'empty') { data.tasks = []; data.events = [] }
      if (scenario === 'events-only') data.tasks = []
      if (scenario === 'completed') data.tasks.forEach(item => { item.done = true })
      if (scenario === 'overdue-only') { data.tasks = [data.tasks[0]]; data.events = [] }
      const edge = await open({ data })
      assert.equal(await edge.page.locator('.will-deadline-row').count(), 0)
      await edge.page.getByText('未来 3 天没有未完成待办', { exact: true }).waitFor()
      if (scenario === 'overdue-only') {
        await edge.page.locator('.will-overdue-toggle').click()
        await edge.page.locator('.will-overdue-section').getByRole('checkbox').waitFor()
      }
      await edge.context.close()
    }
    for (const options of [{ savedRange: '{bad' }, { storageFailure: 'write' }, { storageFailure: 'read' }]) {
      const edge = await open(options)
      await edge.page.getByText('未来 3 天（含今天）', { exact: true }).waitFor()
      await range(edge.page, 14)
      if (options.storageFailure) {
        await edge.page.getByRole('alert').filter({ hasText: '浏览器无法保存截止范围' }).waitFor()
        await navigate(edge.page, '项目')
        await navigate(edge.page, '首页')
        await edge.page.getByText('未来 14 天（含今天）', { exact: true }).waitFor()
      }
      await edge.context.close()
    }
    checks.push('P0-1: empty/events-only/completed/overdue-only, invalid preference fallback, read/write failures retain session preference with warning')

    // P0-2: keyboard editing, collapse/reopen, full batch confirmation, hidden validation and removal.
    await generate(page)
    const first = page.getByRole('group', { name: '安排 1', exact: true })
    const edit = first.getByRole('button', { name: '编辑安排 1', exact: true })
    assert.equal(await edit.innerText(), '编辑')
    await edit.focus()
    await page.keyboard.press('Enter')
    await first.getByLabel('标题', { exact: true }).fill('核对后的项目组会')
    await first.getByRole('button', { name: '收起安排 1', exact: true }).click()
    assert.match(await first.locator('.assistant-draft-summary').innerText(), /核对后的项目组会/)
    await page.getByRole('button', { name: '关闭', exact: true }).click()
    await page.getByRole('button', { name: 'AI 助手', exact: true }).click()
    assert.match(await first.locator('.assistant-draft-summary').innerText(), /核对后的项目组会/)
    const countBefore = (await stored(page)).tasks.length + (await stored(page)).events.length
    await page.getByRole('button', { name: '确认添加 2 项', exact: true }).click()
    await page.getByText('已添加 2 项安排', { exact: true }).waitFor()
    assert.equal((await stored(page)).tasks.length + (await stored(page)).events.length, countBefore + 2)
    await page.getByRole('button', { name: '查看日历', exact: true }).click()
    await page.getByRole('button', { name: '编辑事项：核对后的项目组会', exact: true }).waitFor()
    await page.getByRole('button', { name: 'AI 助手', exact: true }).click()
    await page.getByRole('button', { name: '再整理一条', exact: true }).click()
    const saved = await stored(page)
    await page.getByRole('textbox', { name: '输入安排' }).fill('整理资料')
    await page.getByRole('button', { name: '生成草案', exact: true }).click()
    await page.getByRole('button', { name: '确认添加 1 项', exact: true }).click()
    await first.getByLabel('标题', { exact: true }).waitFor()
    await page.getByText('请选择日期', { exact: true }).waitFor()
    assert.deepEqual(await stored(page), saved)
    await page.getByRole('button', { name: '取消草案', exact: true }).click()
    await page.getByRole('button', { name: '关闭', exact: true }).click()
    await generate(page)
    const second = page.getByRole('group', { name: '安排 2', exact: true })
    await second.getByRole('button', { name: '编辑安排 2', exact: true }).click()
    await second.getByLabel('标题', { exact: true }).fill('保留修改后的文档')
    await first.getByRole('button', { name: '移除安排 1', exact: true }).click()
    assert.equal(await first.getByLabel('标题', { exact: true }).inputValue(), '保留修改后的文档')
    await page.getByRole('button', { name: '取消草案', exact: true }).click()
    assert.deepEqual(await stored(page), saved)
    await page.getByRole('button', { name: '关闭', exact: true }).click()
    checks.push('P0-2: visible Edit text, keyboard Enter, retained edits after collapse/reopen, batch confirm/calendar linkage, hidden validation and cancel, removal preserves sibling')

    // P0-3: manual add from menu and keyboard opening.
    await navigate(page, '首页')
    const add = page.getByRole('button', { name: '快速添加', exact: true })
    await add.focus()
    await page.keyboard.press('Enter')
    await page.getByRole('menuitem').filter({ hasText: '手动添加日程或待办' }).click()
    const dialog = page.getByRole('dialog', { name: '手动添加安排', exact: true })
    await dialog.getByLabel('标题', { exact: true }).fill('手动新增的安排')
    await dialog.getByLabel('截止时间', { exact: true }).click()
    await page.locator('.ant-picker-dropdown:visible').getByText('此刻', { exact: true }).click()
    await dialog.getByLabel('标题', { exact: true }).click()
    await dialog.getByRole('button', { name: '添加安排', exact: true }).click()
    await dialog.waitFor({ state: 'hidden' })
    assert.ok((await stored(page)).tasks.some(item => item.title === '手动新增的安排'))
    checks.push('P0-3: keyboard quick-add menu, manual save, independent AI entry retained')
    await context.close()

    // Before/after use the same fixtures, clock and viewport.
    for (const [version, target] of [['before', baselineUrl], ['after', url]]) {
      if (!target) continue
      for (const width of [1440, 390]) for (const theme of ['night', 'light']) {
        const capture = await open({ width, theme, target })
        await screenshot(capture.page, `${version}-home-${width}-${theme}`)
        await generate(capture.page)
        await screenshot(capture.page, `${version}-assistant-${width}-${theme}`)
        await capture.context.close()
      }
    }

    for (const width of [1440, 1024, 768, 390, 320]) for (const theme of ['night', 'light']) {
      console.log(`Checking ${width}px ${theme}`)
      const matrix = await open({ width, theme })
      const p = matrix.page
      for (const name of ['首页', '日历', '项目', '设置']) {
        await navigate(p, name)
        const size = await p.evaluate(() => ({ content: document.documentElement.scrollWidth, width: innerWidth }))
        assert.ok(size.content <= size.width, `${width}/${theme}/${name} horizontal overflow: ${JSON.stringify(size)}`)
        for (const scroll of ['top', 'middle', 'bottom']) {
          await p.evaluate(position => window.scrollTo(0, position === 'top' ? 0
            : position === 'middle' ? (document.documentElement.scrollHeight - innerHeight) / 2
              : document.documentElement.scrollHeight), scroll)
          const obstruction = await p.locator('.will-item-edit, .ant-checkbox-input, .will-project-summary, .will-month-toolbar button, .will-project-heading button').evaluateAll(elements =>
            elements.filter(element => {
              const rect = element.getBoundingClientRect()
              return rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.bottom <= innerHeight
            }).filter(element => {
              const rect = element.getBoundingClientRect()
              const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
              return !hit || (!element.contains(hit) && !hit.contains(element))
            }).map(element => element.getAttribute('aria-label') || element.textContent))
          assert.deepEqual(obstruction, [], `${width}/${theme}/${name}/${scroll} obstructed`)
          viewportChecks.push({ width, theme, page: name, scroll, overflow: false, obstructed: false })
        }
        if (name === '设置' && (width === 1440 || width === 320)) await screenshot(p, `after-settings-${width}-${theme}`)
        if (name !== '设置') {
          const item = p.locator('.will-item-edit').last()
          if (await item.count()) {
            await item.click()
            await p.getByRole('dialog', { name: '编辑安排', exact: true }).waitFor()
            await p.getByRole('dialog').getByRole('button', { name: '取消', exact: true }).click()
          }
          const checkbox = p.getByRole('checkbox').last()
          if (await checkbox.count()) {
            const checked = await checkbox.isChecked()
            const title = (await checkbox.getAttribute('aria-label')).replace(/^(恢复|完成)待办：/, '')
            await checkbox.click()
            const changed = (await stored(p)).tasks.find(task => task.title === title)
            assert.equal(changed.done, !checked)
            await p.getByRole('checkbox', { name: `${!checked ? '恢复' : '完成'}待办：${title}`, exact: true }).first().click()
          }
        }
      }
      await navigate(p, '首页')
      await p.getByRole('button', { name: '快速添加', exact: true }).click()
      const menu = p.getByRole('menuitem').filter({ hasText: 'AI 输入 / 文本解析' })
      const rect = await menu.boundingBox()
      assert.ok(rect && rect.x >= 0 && rect.x + rect.width <= width)
      await menu.click()
      await p.getByRole('textbox', { name: '输入安排' }).fill('整理资料')
      await p.getByRole('button', { name: '生成草案', exact: true }).click()
      const card = p.getByRole('group', { name: '安排 1', exact: true })
      await card.waitFor()
      const edit = card.getByRole('button', { name: '编辑安排 1', exact: true })
      const remove = card.getByRole('button', { name: '移除安排 1', exact: true })
      assert.ok(await edit.isVisible())
      const e = await edit.boundingBox()
      const r = await remove.boundingBox()
      assert.ok(e && r && r.x - (e.x + e.width) >= 7)
      await edit.focus()
      await p.keyboard.press('Enter')
      await card.getByLabel('标题', { exact: true }).waitFor()
      await card.getByRole('button', { name: '收起安排 1', exact: true }).click()
      if (width === 320) await screenshot(p, `after-assistant-320-${theme}`)
      await matrix.context.close()
    }
    checks.push('P0-3: 5 widths x 2 themes x 4 pages x 3 scroll positions, hit-test no obstruction, edge edit/toggle, menu fits viewport, 320px draft controls separated')
    for (const width of [768, 320]) {
      const long = fixture()
      long.projects[0].name = 'LongProject'.repeat(3)
      long.tasks[1].title = 'LongTaskWithoutSpaces'.repeat(3)
      const edge = await open({ width, data: long, username: '这是用于验证顶栏空间的最长二十四字显示名称示例' })
      for (const name of ['首页', '日历', '项目', '设置']) {
        await navigate(edge.page, name)
        assert.ok(await edge.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      }
      await edge.context.close()
    }
    checks.push('P0-3: long profile name with demo tag, long task/project titles at 768px and 320px')
    assert.deepEqual(errors, [])
    const report = {
      status: 'passed', baselineCommit: 'a338ebe6e0776db884001d93e02f1351f805c132',
      frozenTime: frozenNow.toISOString(), timezone: 'Asia/Shanghai', fixture: 'synthetic acceptance data',
      checks, viewportChecks, errors, screenshots: fs.readdirSync(output).filter(name => name.endsWith('.png')),
    }
    fs.writeFileSync(resultsPath, JSON.stringify(report, null, 2))
    console.log(JSON.stringify({ status: 'passed', checks, viewportChecks: viewportChecks.length, errors, screenshots: report.screenshots.length }, null, 2))
  } catch (error) {
    console.error(JSON.stringify({ status: 'failed', checksCompleted: checks, viewportChecks: viewportChecks.length, errors }, null, 2))
    throw error
  } finally { await browser.close() }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
