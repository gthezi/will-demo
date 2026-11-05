const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { chromium } = require(process.env.WILL_PLAYWRIGHT_MODULE || 'playwright')

const url = process.env.WILL_P1_URL || 'http://127.0.0.1:5175/'
const baselineUrl = process.env.WILL_P1_BASELINE_URL || 'http://127.0.0.1:5176/'
const output = path.resolve(__dirname, '../../docs/gpt-review/p1-images')
const key = 'will-prototype-schedule-v01'
const now = new Date('2026-11-05T14:00:00+08:00')
const checks = []
const errors = []
const matrix = []
const fixture = () => ({
  version: 2,
  projects: [
    { id: 'will', name: 'Will 客户端', archived: false },
    { id: 'course', name: '课程与学习', archived: false },
    { id: 'personal', name: '历史调研', archived: true },
  ],
  tasks: [
    { id: 'overdue', title: '核对上午的反馈', due: '2026-11-05', time: '09:00', projectId: 'will', done: false },
    { id: 'today', title: '完善首页布局', due: '2026-11-05', time: '23:00', projectId: 'will', done: false },
    { id: 'tomorrow', title: '准备原型演示', due: '2026-11-06', time: '10:00', projectId: 'will', done: false },
    { id: 'later', title: '整理课程报告', due: '2026-11-07', time: '17:00', projectId: 'course', done: false },
    { id: 'outside', title: '整理调研反馈', due: '2026-12-08', time: '18:00', projectId: 'personal', done: false },
    { id: 'done', title: '确认核心交互流程', due: '2026-11-04', time: '18:00', projectId: 'will', done: true },
  ],
  events: [
    { id: 'event', title: '技术组讨论', date: '2026-11-05', time: '15:00', duration: 60, projectId: 'will', remind: 30 },
  ],
})

async function main() {
  fs.mkdirSync(output, { recursive: true })
  const browser = await chromium.launch()
  async function open({ target = url, width = 1440, theme = 'night', data = fixture() } = {}) {
    const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 1000 }, timezoneId: 'Asia/Shanghai' })
    const page = await context.newPage()
    await page.clock.setFixedTime(now)
    page.setDefaultTimeout(10000)
    page.on('pageerror', error => errors.push(error.message))
    page.on('response', response => { if (response.status() >= 400) errors.push(`HTTP ${response.status()} ${response.url()}`) })
    await context.addInitScript(({ key, data, theme }) => {
      if (!sessionStorage.getItem('p1-seeded')) {
        localStorage.setItem(key, JSON.stringify(data))
        localStorage.setItem('will-react-theme-v01', theme)
        sessionStorage.setItem('p1-seeded', 'yes')
      }
    }, { key, data, theme })
    await page.goto(target, { waitUntil: 'networkidle' })
    await page.getByRole('heading', { name: '我的工作台', exact: true }).waitFor()
    return { context, page }
  }
  const navigate = (page, name) => page.getByRole('navigation').getByRole('button', { name, exact: true }).click()
  const capture = async (page, name) => {
    await page.getByRole('heading', { level: 1 }).click()
    await page.mouse.move(0, 0)
    await page.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur() })
    await page.waitForTimeout(300)
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.screenshot({
      path: path.join(output, `${name}.png`), fullPage: true, animations: 'disabled',
      style: '.ant-tooltip { visibility: hidden !important; }',
    })
  }
  const row = (root, title) => root.locator('.will-schedule-row').filter({ hasText: title })
  const select = async (page, label, option) => {
    await page.getByRole('combobox', { name: label, exact: true }).click()
    await page.locator('.ant-select-dropdown:visible .ant-select-item-option').filter({ hasText: option }).click()
  }
  const mode = process.env.WILL_P1_CAPTURE
  try {
    for (const version of process.env.WILL_P1_SKIP_CAPTURE ? [] : mode ? [mode] : ['after']) {
      for (const theme of ['night', 'light']) for (const width of [1440, 320]) {
        const { context, page } = await open({ target: version === 'before' ? baselineUrl : url, width, theme })
        await capture(page, `${version}-home-${width}-${theme}`)
        if (width === 1440) {
          await navigate(page, '日历')
          await capture(page, `${version}-calendar-${width}-${theme}`)
          await navigate(page, '项目')
          await capture(page, `${version}-projects-${width}-${theme}`)
          await navigate(page, '首页')
        }
        await page.getByRole('button', { name: '搜索与筛选', exact: true }).click()
        await capture(page, `${version}-search-${width}-${theme}`)
        await context.close()
      }
    }
    if (mode) return

    const { context, page } = await open()
    const list = page.getByRole('region', { name: '待办清单', exact: true })
    const verifyStates = async root => {
      await row(root, '核对上午的反馈').getByText('逾期', { exact: true }).waitFor()
      await row(root, '完善首页布局').getByText('今天截止', { exact: true }).waitFor()
    }
    await verifyStates(list)
    await row(list, '准备原型演示').getByText('待办', { exact: true }).waitFor()
    await row(list, '确认核心交互流程').getByText('已完成', { exact: true }).waitFor()
    await page.getByRole('button', { name: '1 项今天截止', exact: true }).click()
    assert.equal(await page.locator('#deadlines-heading').evaluate(el => document.activeElement === el), true)
    await page.locator('.will-metric-button.has-overdue').click()
    await row(page.locator('.will-overdue-section'), '核对上午的反馈').getByRole('checkbox').click()
    await row(list, '核对上午的反馈').getByText('已完成', { exact: true }).waitFor()
    await row(list, '核对上午的反馈').getByRole('checkbox').click()
    await verifyStates(list)
    await navigate(page, '日历')
    await verifyStates(page.locator('.will-agenda'))
    await page.locator('.will-calendar-entry.is-overdue').first().waitFor()
    await page.getByRole('button', { name: /^2026-11-06，/ }).click()
    await row(page, '准备原型演示').getByText('待办', { exact: true }).waitFor()
    assert.equal(await page.locator('.will-calendar-entry.is-task').first().evaluate(el => {
      const probe = document.createElement('span')
      probe.style.color = 'var(--will-muted)'
      document.body.append(probe)
      const matches = getComputedStyle(el).color === getComputedStyle(probe).color
      probe.remove()
      return matches
    }), true)
    await navigate(page, '项目')
    await verifyStates(page)
    await row(page, '完善首页布局').getByRole('checkbox').click()
    await row(page, '完善首页布局').getByText('已完成', { exact: true }).waitFor()
    await row(page, '完善首页布局').getByRole('checkbox').click()
    checks.push('P1-1: same states across homepage/calendar/projects, neutral future task, completion/restore updates tags and overdue membership')

    await navigate(page, '首页')
    const calendarY = (await page.locator('.will-calendar-tool').boundingBox()).y
    const searchButton = page.getByRole('button', { name: '搜索与筛选', exact: true })
    await searchButton.focus()
    await page.keyboard.press('Enter')
    const results = page.getByRole('region', { name: '搜索全部安排', exact: true })
    await results.getByText('全部日期 · 日程与待办 · 7 项安排', { exact: true }).waitFor()
    assert.equal(await results.locator('.will-schedule-row').count(), 7)
    assert.equal((await page.locator('.will-calendar-tool').boundingBox()).y, calendarY)
    assert.equal(await page.getByRole('textbox', { name: '搜索安排标题' }).evaluate(el => el === document.activeElement), true)
    await select(page, '筛选完成状态', '未完成待办')
    await results.locator('.will-dashboard-kind').getByText('日程', { exact: true }).click()
    assert.equal(await page.getByRole('combobox', { name: '筛选完成状态' }).isDisabled(), true)
    await results.getByText('日程不区分完成状态', { exact: true }).waitFor()
    assert.equal(await results.locator('.will-schedule-row').count(), 1)
    await results.getByRole('button', { name: '清除筛选', exact: true }).click()
    await results.getByText('全部日期 · 日程与待办 · 7 项安排', { exact: true }).waitFor()
    await select(page, '筛选项目', '历史调研（已归档）')
    await results.getByText('全部日期 · 日程与待办 · 1 项安排', { exact: true }).waitFor()
    await row(results, '整理调研反馈').waitFor()
    await results.getByRole('button', { name: '清除筛选', exact: true }).click()
    await page.getByRole('textbox', { name: '搜索安排标题' }).fill('没有此安排')
    await results.getByText('全部日期 · 日程与待办 · 0 项安排', { exact: true }).waitFor()
    await capture(page, 'after-search-empty-1440-night')
    await results.getByRole('button', { name: '返回待办清单', exact: true }).focus()
    await page.keyboard.press('Enter')
    assert.equal(await page.getByRole('search').count(), 0)
    assert.equal(await list.locator('.will-schedule-row').count(), 6)
    assert.equal(await searchButton.evaluate(el => el === document.activeElement), true)
    await searchButton.click()
    await page.getByRole('textbox', { name: '搜索安排标题' }).fill('准备')
    await navigate(page, '项目')
    await navigate(page, '首页')
    assert.equal(await page.getByRole('search').count(), 0)
    checks.push('P1-3: adjacent controls/results, all seven arrangements with no filter, keyboard autofocus/return, event status reset/disabled hint, archived project, zero results, clear/close/navigation reset')
    await context.close()

    const boundaryData = fixture()
    boundaryData.tasks = [{ ...boundaryData.tasks[1], time: '14:00' }]
    const boundary = await open({ data: boundaryData })
    await boundary.page.getByRole('button', { name: '1 项今天截止', exact: true }).waitFor()
    await boundary.page.clock.setFixedTime(new Date('2026-11-05T14:00:01+08:00'))
    await boundary.page.evaluate(() => window.dispatchEvent(new Event('focus')))
    await boundary.page.getByText('今天没有待截止任务', { exact: true }).waitFor()
    assert.equal(await boundary.page.locator('.will-deadline-row').count(), 0)
    await row(boundary.page.getByRole('region', { name: '待办清单', exact: true }), '完善首页布局').getByText('逾期', { exact: true }).waitFor()
    await boundary.page.clock.setFixedTime(new Date('2026-12-01T00:00:00+08:00'))
    await boundary.page.evaluate(() => window.dispatchEvent(new Event('focus')))
    await row(boundary.page.getByRole('region', { name: '待办清单', exact: true }), '完善首页布局').getByText('逾期', { exact: true }).waitFor()
    await boundary.context.close()
    checks.push('P1-1 browser clock: equality stays today; one second later focus refresh updates summary, deadline membership and list status; month rollover remains overdue')

    for (const scenario of ['empty', 'events-only', 'completed', 'overdue-only', 'future-only', 'many']) {
      const data = fixture()
      if (scenario === 'empty') { data.tasks = []; data.events = [] }
      if (scenario === 'events-only') data.tasks = []
      if (scenario === 'completed') data.tasks.forEach(item => { item.done = true })
      if (scenario === 'overdue-only') { data.tasks = [data.tasks[0]]; data.events = [] }
      if (scenario === 'future-only') data.tasks = [data.tasks[2]]
      if (scenario === 'many') for (let i = 0; i < 5; i++) data.tasks.push({ ...data.tasks[2], id: `extra-${i}`, title: `演示材料 ${i + 1}` })
      const edge = await open({ data, theme: 'light' })
      const summary = edge.page.getByRole('region', { name: '任务概览', exact: true })
      if (scenario === 'empty' || scenario === 'events-only') await summary.getByText('还没有待办', { exact: true }).waitFor()
      if (scenario === 'completed') await summary.getByText('待办已全部完成', { exact: true }).waitFor()
      if (scenario === 'future-only') await summary.getByText('今天没有待截止任务', { exact: true }).waitFor()
      if (scenario === 'overdue-only') {
        await summary.getByText('今天没有待截止任务', { exact: true }).waitFor()
        await edge.page.locator('.will-metric-button.has-overdue').click()
        await edge.page.locator('.will-overdue-section').getByRole('checkbox').waitFor()
      }
      if (scenario === 'many') {
        await edge.page.getByText('显示 4 项 / 共 8 项', { exact: true }).waitFor()
        await edge.page.getByRole('button', { name: '查看全部', exact: true }).click()
        assert.equal(await edge.page.locator('.will-deadline-row').count(), 8)
        await capture(edge.page, 'after-many-1440-light')
      }
      await edge.context.close()
    }
    checks.push('P1-2: live today count and jump, retained all-task progress, empty/events/completed/future/overdue-only and expand beyond four')

    for (const width of [1440, 1024, 768, 390, 320]) for (const theme of ['night', 'light']) {
      console.log(`P1 ${width}px ${theme}`)
      const data = fixture()
      data.tasks[2].title = 'LongTaskWithoutSpaces'.repeat(3)
      const edge = await open({ width, theme, data })
      const p = edge.page
      for (const name of ['首页', '日历', '项目']) {
        await navigate(p, name)
        assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}/${theme}/${name} overflow`)
        for (const position of [0, .5, 1]) {
          await p.evaluate(pos => window.scrollTo(0, pos * (document.documentElement.scrollHeight - innerHeight)), position)
          const blocked = await p.locator('.will-item-edit, .ant-checkbox-input, .will-project-summary, .will-month-toolbar button').evaluateAll(elements =>
            elements.filter(el => { const r = el.getBoundingClientRect(); return r.width && r.height && r.top >= 0 && r.bottom <= innerHeight })
              .filter(el => { const r = el.getBoundingClientRect(); const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return !hit || (!el.contains(hit) && !hit.contains(el)) })
              .map(el => el.getAttribute('aria-label')))
          assert.deepEqual(blocked, [], `${width}/${theme}/${name}/${position} blocked`)
          matrix.push({ width, theme, page: name, position, overflow: false, blocked: false })
        }
        const toggle = p.getByRole('checkbox').last()
        if (await toggle.count()) { await toggle.click(); await toggle.click() }
      }
      await navigate(p, '首页')
      await p.getByRole('button', { name: '搜索与筛选', exact: true }).click()
      await p.getByRole('textbox', { name: '搜索安排标题' }).fill('LongTaskWithoutSpaces')
      await p.getByText('全部日期 · 日程与待办 · 1 项安排', { exact: true }).waitFor()
      assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      await p.getByRole('button', { name: '清除筛选', exact: true }).click()
      await p.getByText('全部日期 · 日程与待办 · 7 项安排', { exact: true }).waitFor()
      await p.locator('.will-dashboard-kind').getByText('日程', { exact: true }).click()
      await p.getByText('日程不区分完成状态', { exact: true }).waitFor()
      assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      await p.getByRole('button', { name: '清除筛选', exact: true }).focus()
      await p.keyboard.press('Enter')
      await p.getByRole('button', { name: '返回待办清单', exact: true }).click()
      await edge.context.close()
    }
    assert.deepEqual(errors, [])
    fs.writeFileSync(path.resolve(output, '../p1-browser-results.json'), JSON.stringify({ frozenNow: now.toISOString(), timezone: 'Asia/Shanghai', fixture: 'synthetic acceptance data only', checks, matrix, errors }, null, 2) + '\n')
    console.log(JSON.stringify({ checks, matrix: matrix.length, errors }))
  } finally {
    await browser.close()
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
