const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const { chromium } = require(process.env.WILL_PLAYWRIGHT_MODULE || 'playwright')

const root = path.resolve(__dirname, '..')
const output = path.resolve(process.env.WILL_EVIDENCE_DIR || path.resolve(root, '../docs/w1-acceptance'))
const base = process.env.WILL_BASE_URL || 'http://127.0.0.1:5173/'
const testNow = new Date(process.env.WILL_TEST_NOW || '2026-11-06T09:00:00+08:00')
const timezoneId = process.env.WILL_TEST_TIMEZONE || 'Asia/Shanghai'

async function launchBrowser() {
  const candidates = [
    process.env.WILL_CHROME_PATH,
    process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, 'Google/Chrome/Application/chrome.exe'),
    process.env['PROGRAMFILES(X86)'] && path.join(process.env['PROGRAMFILES(X86)'], 'Google/Chrome/Application/chrome.exe'),
    process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, 'Microsoft/Edge/Application/msedge.exe'),
    process.env['PROGRAMFILES(X86)'] && path.join(process.env['PROGRAMFILES(X86)'], 'Microsoft/Edge/Application/msedge.exe'),
  ].filter(Boolean)
  const executablePath = (await Promise.all(candidates.map(async candidate => {
    try { await fs.access(candidate); return candidate } catch { return null }
  }))).find(Boolean)
  return { browser: await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) }),
    executablePath: executablePath || chromium.executablePath() }
}

async function main() {
  await fs.mkdir(output, { recursive: true })
  const { browser, executablePath } = await launchBrowser()
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  try {
    await page.clock.install({ time: testNow })
    await page.goto(base)
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.getByRole('heading', { name: '今天值得处理' }).waitFor()
    await page.getByRole('button', { name: '切换主题，当前夜间' }).click()
    await page.getByRole('button', { name: '切换主题，当前跟随系统' }).click()
    await page.screenshot({ path: path.join(output, 'home-1440x900.png'), fullPage: true })
    const dueDate = await page.evaluate(() => {
      const date = new Date()
      date.setDate(date.getDate() + 1)
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    })

    await page.getByRole('navigation').getByRole('button', { name: '项目' }).click()
    await page.getByRole('button', { name: '新建项目' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('项目名称').fill('课程论文验收')
    await dialog.getByLabel('项目模板').click()
    await page.getByText('课程论文', { exact: true }).last().click()
    await dialog.getByRole('button', { name: '创建项目' }).click()
    await page.getByRole('heading', { name: '课程论文验收' }).waitFor()
    await page.screenshot({ path: path.join(output, 'project-overview-1440x900.png'), fullPage: true })

    await page.getByRole('button', { name: '视图设置' }).click()
    const views = page.getByRole('dialog').last()
    await views.getByLabel('流程').check()
    await views.getByLabel('论文').uncheck()
    await views.getByRole('button', { name: '完成' }).click()
    await page.reload()
    await page.getByRole('heading', { name: '课程论文验收' }).waitFor()
    await page.getByRole('tab', { name: '流程' }).waitFor()
    assert.equal(await page.getByRole('tab', { name: '论文' }).count(), 0)
    await page.getByRole('button', { name: '视图设置' }).click()
    const restoreViews = page.getByRole('dialog').last()
    await restoreViews.getByLabel('论文').check()
    await restoreViews.getByRole('button', { name: '完成' }).click()

    await page.getByRole('tab', { name: /任务/ }).click()
    await page.getByRole('button', { name: '新建任务' }).click()
    const taskDialog = page.getByRole('dialog').last()
    await taskDialog.getByLabel('标题').fill('整理研究提纲')
    await taskDialog.getByRole('button', { name: '添加安排' }).click()
    const taskCard = page.locator('.will-task-card').filter({ hasText: '整理研究提纲' })
    await taskCard.waitFor()
    assert.match(await taskCard.innerText(), /无截止日期/)
    await taskCard.getByRole('combobox', { name: '任务状态：整理研究提纲' }).click()
    await page.getByText('进行中', { exact: true }).last().click()
    await page.getByRole('tab', { name: '概览' }).click()
    await page.getByText(/1 项进行中/).waitFor()
    await page.getByRole('button', { name: '编辑事项：整理研究提纲' }).waitFor()
    await page.locator('.ant-message-notice').waitFor({ state: 'detached' })
    await page.screenshot({ path: path.join(output, 'review-overview-undated.png'), fullPage: true })
    await page.getByRole('navigation').getByRole('button', { name: '项目' }).click()
    const projectRegion = page.locator('.will-project-section').filter({ hasText: '课程论文验收' })
    await projectRegion.getByText('进行中', { exact: true }).waitFor()
    await projectRegion.getByRole('button', { name: '管理项目：课程论文验收' }).click()
    await page.getByRole('menuitem', { name: '归档项目' }).click()
    const archiveDialog = page.locator('.ant-modal-confirm')
    await archiveDialog.waitFor()
    await archiveDialog.locator('.ant-modal-confirm-title').getByText('归档这个项目？', { exact: true }).waitFor()
    await archiveDialog.getByText('1 项安排', { exact: false }).waitFor()
    await page.screenshot({ path: path.join(output, 'review-archive-count.png'), fullPage: true })
    await archiveDialog.getByRole('button', { name: '保留项目' }).click()
    await page.getByRole('button', { name: '课程论文验收', exact: true }).click()
    await page.getByRole('tab', { name: /任务/ }).waitFor()
    await page.getByRole('tab', { name: /任务/ }).click()
    await page.locator('.ant-message-notice').waitFor({ state: 'detached' })
    await page.screenshot({ path: path.join(output, 'project-task-board-1440x900.png'), fullPage: true })

    await taskCard.getByRole('button', { name: '整理研究提纲' }).click()
    const editDialog = page.getByRole('dialog').last()
    await editDialog.getByLabel('截止日期（可选）').click()
    await page.locator(`.ant-picker-cell[title="${dueDate}"]`).click()
    await editDialog.getByRole('button', { name: '保存修改' }).click()
    await taskCard.getByRole('button', { name: new RegExp(dueDate) }).click()
    await page.getByRole('heading', { name: /年.*月.*日/ }).waitFor()
    await page.getByRole('button', { name: /整理研究提纲/ }).waitFor()
    await page.screenshot({ path: path.join(output, 'calendar-date-deadline-1440x900.png'), fullPage: true })
    await page.getByRole('navigation').getByRole('button', { name: '今天' }).click()
    const dateOnlyRow = page.locator('.will-deadline-row').filter({ hasText: '整理研究提纲' })
    assert.equal(await dateOnlyRow.locator('time').getAttribute('datetime'), dueDate)

    await page.getByRole('navigation').getByRole('button', { name: '项目' }).click()
    await page.getByRole('button', { name: '课程论文验收', exact: true }).click()
    await page.getByRole('tab', { name: /任务/ }).click()
    const persistedTask = page.locator('.will-task-card').filter({ hasText: '整理研究提纲' })
    await persistedTask.getByRole('combobox', { name: '任务状态：整理研究提纲' }).click()
    await page.getByText('已完成', { exact: true }).last().click()
    await page.reload()
    await page.getByRole('tab', { name: /任务/ }).waitFor()
    const afterReload = page.locator('.will-task-card').filter({ hasText: '整理研究提纲' })
    await afterReload.getByRole('combobox', { name: '任务状态：整理研究提纲' }).click()
    await page.getByText('已完成', { exact: true }).last().waitFor()
    await page.keyboard.press('Escape')
    await afterReload.getByRole('combobox', { name: '任务状态：整理研究提纲' }).click()
    await page.getByText('待处理', { exact: true }).last().click()
    await afterReload.getByRole('button', { name: '整理研究提纲' }).click()
    const clearDialog = page.getByRole('dialog').last()
    await clearDialog.locator('.ant-picker-clear').click({ force: true })
    await clearDialog.getByRole('button', { name: '保存修改' }).click()
    await page.evaluate(date => { window.location.hash = '#/calendar?date=' + date }, dueDate)
    await page.getByRole('heading', { name: /年.*月.*日/ }).waitFor()
    assert.equal(await page.getByRole('button', { name: /整理研究提纲/ }).count(), 0)
    await page.getByRole('navigation').getByRole('button', { name: '项目' }).click()
    await page.getByRole('button', { name: '课程论文验收', exact: true }).click()
    await page.getByRole('tab', { name: /任务/ }).click()
    assert.equal(await page.locator('.will-task-card').filter({ hasText: '整理研究提纲' }).count(), 1)

    const projectId = await page.evaluate(() => JSON.parse(localStorage.getItem('will-workbench-schedule-v03')).projects.find(project => project.name === '课程论文验收').id)
    const windows = []
    for (const theme of ['night', 'light']) {
      await page.getByRole('navigation').getByRole('button', { name: '设置' }).click()
      await page.getByRole('radiogroup', { name: '显示主题' }).getByText(theme === 'light' ? '日间' : '夜间', { exact: true }).click()
      for (const [width, height] of [[1440, 900], [1366, 768], [1280, 720], [1024, 768], [800, 600]]) {
        await page.setViewportSize({ width, height })
        for (const route of ['#/home', '#/calendar', '#/projects', `#/projects/${encodeURIComponent(projectId)}/tasks`]) {
          await page.goto(new URL(route, base).href)
          const selector = route === '#/home' ? '.will-dashboard' : route === '#/calendar'
            ? '.will-calendar-layout' : route === '#/projects' ? '.will-projects' : '.will-project-detail'
          await page.locator(selector).waitFor()
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
          assert.equal(overflow, false, `${theme} horizontal page overflow at ${width}x${height} ${route}`)
          windows.push({ theme, width, height, route, overflow })
        }
        await page.getByRole('tab', { name: /任务/ }).waitFor()
        assert.equal(await page.locator('.will-task-card').count(), 1, `project task missing at ${width}x${height}`)
        await page.screenshot({ path: path.join(output, `responsive-${width}x${height}${theme === 'night' ? '-night' : ''}.png`), fullPage: true })
        await page.getByRole('button', { name: 'AI 助手', exact: true }).first().click()
        const drawer = page.getByRole('dialog', { name: 'AI 助手', exact: true })
        const input = drawer.getByRole('textbox', { name: '输入安排', exact: true })
        await input.scrollIntoViewIfNeeded()
        await page.waitForFunction(() => {
          const element = document.querySelector('.ant-drawer-open [role="dialog"]')
          const rect = element?.getBoundingClientRect()
          return rect && rect.x >= -1 && rect.right <= innerWidth + 1
        })
        const bounds = await drawer.boundingBox()
        assert.ok(bounds && bounds.x >= -1 && bounds.x + bounds.width <= width + 1, JSON.stringify({ theme, width, height, bounds }))
        await drawer.getByRole('button', { name: '关闭', exact: true }).click()
        await drawer.waitFor({ state: 'hidden' })
      }
    }
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.getByRole('button', { name: 'AI 助手', exact: true }).first().click()
    const assistant = page.getByRole('dialog', { name: 'AI 助手', exact: true })
    await assistant.getByRole('textbox', { name: '输入安排', exact: true }).fill('明天下午三点有组会，五点前提交汇报文档')
    await assistant.getByRole('button', { name: '生成草案', exact: true }).click()
    await assistant.getByRole('button', { name: '确认添加 2 项', exact: true }).waitFor()
    await assistant.getByRole('button', { name: '确认添加 2 项', exact: true }).click()
    await assistant.getByText('已添加 2 项安排', { exact: true }).waitFor()
    const aiData = await page.evaluate(() => JSON.parse(localStorage.getItem('will-workbench-schedule-v03')))
    assert.equal(aiData.events.length, 1)
    assert.equal(aiData.tasks.length, 2)
    assert.ok(aiData.tasks.every(task => task.projectId === projectId))
    assert.equal(aiData.events[0].projectId, projectId)
    await assistant.getByRole('button', { name: '关闭', exact: true }).click()

    const browserDate = await page.evaluate(() => {
      const date = new Date()
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    })
    const currentDayData = {
      version: 3,
      projects: [
        { id: 'will', name: 'Will 客户端', archived: false },
        { id: 'course', name: '课程与学习', archived: false },
        { id: 'personal', name: '个人事务', archived: false },
      ],
      tasks: [{ id: 'today-progress', title: '今天截止的进行中任务', due: browserDate, projectId: 'course', status: 'in_progress', done: false }],
      events: [],
    }
    await page.evaluate(data => {
      localStorage.clear()
      localStorage.setItem('will-workbench-schedule-v03', JSON.stringify(data))
    }, currentDayData)
    await page.goto(new URL('#/home', base).href)
    await page.reload()
    await page.getByRole('button', { name: '1 项今天截止', exact: true }).waitFor()
    await page.locator('#arrangement-results').getByText('进行中', { exact: true }).waitFor()
    assert.equal(await page.locator('.will-deadline-row time').getAttribute('datetime'), browserDate)
    await page.screenshot({ path: path.join(output, 'review-today-in-progress.png'), fullPage: true })
    await page.goto(new URL(`#/calendar?date=${browserDate}`, base).href)
    await page.locator('.will-agenda').getByText('进行中', { exact: true }).waitFor()
    await page.locator('.will-agenda').getByText('今天截止', { exact: true }).waitFor()

    const legacyV2 = {
      version: 2,
      projects: currentDayData.projects,
      tasks: [{ id: 'browser-legacy-task', title: '迁移后可操作的旧任务', due: browserDate, time: '17:30', projectId: 'course', done: false }],
      events: [{ id: 'browser-legacy-event', title: '迁移保留的旧日程', date: browserDate, time: '14:00', projectId: 'course', duration: 60, remind: 10 }],
    }
    const legacyText = JSON.stringify(legacyV2)
    await page.evaluate(text => {
      localStorage.clear()
      localStorage.setItem('will-react-schedule-v01', text)
    }, legacyText)
    await page.goto(new URL('#/home', base).href)
    await page.reload()
    await page.locator('#arrangement-results').getByRole('button', { name: '编辑事项：迁移后可操作的旧任务' }).waitFor()
    await page.locator('#arrangement-results').getByRole('checkbox', { name: '完成待办：迁移后可操作的旧任务' }).click()
    const migrated = await page.evaluate(() => ({
      current: JSON.parse(localStorage.getItem('will-workbench-schedule-v03')),
      original: localStorage.getItem('will-react-schedule-v01'),
    }))
    assert.equal(migrated.current.tasks[0].id, 'browser-legacy-task')
    assert.equal(migrated.current.tasks[0].due, browserDate)
    assert.equal(migrated.current.tasks[0].done, true)
    assert.equal(migrated.current.events[0].id, 'browser-legacy-event')
    assert.equal(migrated.original, legacyText)

    const damagedValue = '{damaged-current-value'
    await page.evaluate(({ data, damaged }) => {
      localStorage.clear()
      localStorage.setItem('will-workbench-schedule-v03', damaged)
      localStorage.setItem('will-react-schedule-v01', JSON.stringify(data))
    }, { data: legacyV2, damaged: damagedValue })
    await page.goto(new URL('#/home', base).href)
    await page.reload()
    await page.getByRole('alert').filter({ hasText: '原始内容已保留' }).getByRole('button', { name: '从旧数据恢复' }).click()
    await page.getByRole('dialog').getByRole('button', { name: '备份并恢复' }).click()
    const recovery = await page.evaluate(() => ({
      current: JSON.parse(localStorage.getItem('will-workbench-schedule-v03')),
      backup: Object.keys(localStorage).find(key => key.startsWith('will-workbench-schedule-v03.corrupt-')),
      backupValue: (() => {
        const key = Object.keys(localStorage).find(name => name.startsWith('will-workbench-schedule-v03.corrupt-'))
        return key ? localStorage.getItem(key) : null
      })(),
      original: localStorage.getItem('will-react-schedule-v01'),
    }))
    assert.ok(recovery.backup)
    assert.equal(recovery.backupValue, damagedValue)
    assert.equal(recovery.current.tasks[0].id, 'browser-legacy-task')
    assert.equal(recovery.original, legacyText)
    await page.locator('#arrangement-results').getByRole('checkbox', { name: '完成待办：迁移后可操作的旧任务' }).click()
    await page.reload()
    await page.locator('#arrangement-results').getByRole('checkbox', { name: '恢复待办：迁移后可操作的旧任务' }).waitFor()
    await page.screenshot({ path: path.join(output, 'recovered-legacy-data.png'), fullPage: true })

    const legacyV1 = { ...legacyV2, version: 1 }
    delete legacyV1.projects
    await page.evaluate(data => {
      localStorage.clear()
      localStorage.setItem('will-prototype-schedule-v01', JSON.stringify(data))
    }, legacyV1)
    await page.reload()
    await page.locator('#arrangement-results').getByRole('checkbox', { name: '完成待办：迁移后可操作的旧任务' }).click()
    const migratedV1 = await page.evaluate(() => JSON.parse(localStorage.getItem('will-workbench-schedule-v03')))
    assert.deepEqual(migratedV1.projects.map(project => project.id), ['will', 'course', 'personal'])
    assert.deepEqual(migratedV1.events, legacyV1.events)
    assert.equal(migratedV1.tasks[0].id, legacyV1.tasks[0].id)
    assert.equal(migratedV1.tasks[0].status, 'done')

    // Simulated storage failures stay inside this dedicated context.
    await page.evaluate(() => {
      Storage.prototype.setItem = function () { throw new DOMException('blocked for test', 'QuotaExceededError') }
    })
    await page.locator('#arrangement-results').getByRole('checkbox', { name: '恢复待办：迁移后可操作的旧任务' }).click()
    await page.getByRole('alert').filter({ hasText: '浏览器无法保存安排' }).waitFor()
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('will-workbench-schedule-v03')).tasks[0].done), true)
    await page.reload()
    await page.locator('#arrangement-results').getByRole('checkbox', { name: '恢复待办：迁移后可操作的旧任务' }).waitFor()

    const blockedContext = await browser.newContext({ timezoneId })
    try {
      await blockedContext.addInitScript(() => {
        Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked for test', 'SecurityError') } })
      })
      const blockedPage = await blockedContext.newPage()
      blockedPage.on('pageerror', error => errors.push(error.message))
      await blockedPage.goto(base)
      await blockedPage.getByRole('alert').filter({ hasText: '无法读取本地安排' }).waitFor()
      assert.equal(await blockedPage.getByRole('button', { name: '从旧数据恢复' }).count(), 0)
    } finally {
      await blockedContext.close()
    }
    assert.deepEqual(errors, [])
    const result = { result: 'PASS', testedAt: new Date().toISOString(), base, testNow: testNow.toISOString(), timezoneId, dueDate, todayDate: browserDate,
      browser: { executablePath, version: browser.version() },
      checks: ['undated progress across overview/list/archive', 'optional deadline calendar round-trip', 'view and route persistence',
        '5 viewport sizes x 2 themes x 4 routes with AI drawer accessibility', 'AI mock draft confirmation and project context',
        'today deadline independent of progress in home and calendar', 'v1/v2 localStorage migration', 'explicit backed-up recovery and persist',
        'write failure stays in memory', 'read failure warning without recovery'], windows, errors }
    await fs.writeFile(path.join(output, 'browser-w1-results.json'), `${JSON.stringify(result, null, 2)}\n`)
    console.log(JSON.stringify({ ...result, windows: `${windows.length} combinations passed` }, null, 2))
  } catch (error) {
    await page.screenshot({ path: path.join(output, 'browser-failure.png'), fullPage: true }).catch(() => {})
    console.error(await page.locator('main').innerText().catch(() => 'Page unavailable'))
    throw error
  } finally {
    await browser.close()
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
