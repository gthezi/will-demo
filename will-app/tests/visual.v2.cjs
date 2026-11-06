const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const { chromium } = require(process.env.WILL_PLAYWRIGHT_MODULE || 'playwright')
const { launchBrowser, AI_KEY, SCHEDULE_KEY } = require('./w2.flows.cjs')

const base = process.env.WILL_BASE_URL || 'http://127.0.0.1:4181/'
const phase = process.env.WILL_VISUAL_PHASE || 'after'
const output = path.resolve(process.env.WILL_EVIDENCE_DIR || `../docs/visual-v2-acceptance/${phase}`)

async function main() {
  await fs.mkdir(output, { recursive: true })
  const fixture = JSON.parse(await fs.readFile(path.resolve('../docs/visual-v1-acceptance/before/fixture.json'), 'utf8'))
  fixture.schedule.projects[1] = { ...fixture.schedule.projects[1],
    name: '课程与学习：研究方法、访谈记录与参考文献修订', description: '核对研究方法、访谈记录与参考文献，整理导师反馈并形成可复核的课程论文修订清单。',
    enabledViews: ['paper', 'workflow', 'collaboration'] }
  fixture.schedule.projects.push(
    { id: 'empty', name: '尚未开始的空项目', archived: false },
    { id: 'finished', name: '本学期已完成项目', archived: false },
    { id: 'archive', name: '已归档的研究记录', archived: true },
  )
  fixture.schedule.tasks.push(
    { id: 'finished-task', title: '已完成的最终检查', projectId: 'finished', status: 'done', done: true },
    ...Array.from({ length: 7 }, (_, i) => ({ id: `dense-${i}`,
      title: `密集事项 ${i + 1}：核对访谈原始记录与全部参考文献，确认研究问题和实验方案`,
      projectId: 'course', due: '2026-11-07', ...(i % 2 ? { time: '08:00' } : {}),
      status: i === 0 ? 'done' : i === 1 ? 'in_progress' : 'todo', done: i === 0 })),
  )
  await fs.writeFile(path.join(output, 'fixture.json'), JSON.stringify(fixture, null, 2))
  const browser = await launchBrowser(chromium)
  const context = await browser.newContext({ timezoneId: 'Asia/Shanghai' })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const results = { phase, base, checks: [], windows: [], errors }
  const routes = [
    ['home', '#/home', '.will-dashboard'],
    ['calendar', '#/calendar?date=2026-11-07', '.will-calendar-layout'],
    ['projects', '#/projects', '.will-projects'],
    ['overview', '#/projects/course/overview', '.will-project-overview-grid'],
    ['board', '#/projects/course/tasks', '.will-task-board'],
    ['list', '#/projects/course/tasks', '.will-task-list'],
    ['materials', '#/projects/course/materials', '.will-project-detail .ant-empty:visible'],
    ['paper', '#/projects/course/paper', '.will-project-detail .ant-empty:visible'],
    ['workflow', '#/projects/course/workflow', '.will-project-detail .ant-empty:visible'],
    ['collaboration', '#/projects/course/collaboration', '.will-project-detail .ant-empty:visible'],
    ['settings', '#/settings', '.will-settings'],
    ['ai', `#/ai/${fixture.ai.activeId}`, '.ai-review-batch'],
  ]
  try {
    await page.clock.install({ time: new Date('2026-11-07T09:00:00+08:00') })
    await page.goto(base)
    for (const theme of ['light', 'night']) {
      for (const [width, height] of [[1440, 900], [1280, 800], [1024, 768], [390, 844]]) {
        await page.setViewportSize({ width, height })
        await page.evaluate(({ fixture, theme, AI_KEY, SCHEDULE_KEY }) => {
          localStorage.clear()
          localStorage.setItem(AI_KEY, JSON.stringify(fixture.ai))
          localStorage.setItem(SCHEDULE_KEY, JSON.stringify(fixture.schedule))
          localStorage.setItem('will-react-theme-v01', theme)
        }, { fixture, theme, AI_KEY, SCHEDULE_KEY })
        await page.reload()
        const row = { theme, width, height, pages: [] }
        for (const [name, hash, selector] of routes) {
          await page.goto(new URL(hash, base).href)
          if (name === 'list') await page.getByText('列表', { exact: true }).click()
          await page.locator(selector).first().waitFor()
          await page.evaluate(() => scrollTo(0, 0))
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
          if (phase === 'after') assert.equal(overflow, false, `${name} overflow ${width} ${theme}`)
          row.pages.push({ name, overflow })
          if ((width === 1440 && ['home', 'calendar', 'projects', 'overview', 'board', 'settings'].includes(name))
            || (width === 390 && ['calendar', 'board', 'settings'].includes(name))) {
            await page.screenshot({ path: path.join(output, `${name}-${width}-${theme}.png`), fullPage: true })
          }
          if (name === 'calendar') {
            const selected = page.locator('.will-calendar-day[aria-pressed=true]')
            await selected.click({ trial: true })
            const agenda = page.locator('.will-agenda')
            assert.match(await agenda.innerText(), /日期截止/)
            assert.match(await agenda.innerText(), /08:00/)
            assert.match(await agenda.innerText(), /15:00/)
            assert.match(await agenda.innerText(), /逾期/)
            assert.match(await agenda.innerText(), /已完成/)
            const dateOnly = agenda.locator('.will-schedule-row').filter({ hasText: '密集事项 1' })
            assert.equal(await dateOnly.locator('time').getAttribute('datetime'), '2026-11-07')
            if (phase === 'after') {
              const contrasts = await page.evaluate(() => {
                const canvas = document.createElement('canvas')
                const ctx = canvas.getContext('2d')
                const luminance = color => {
                  ctx.clearRect(0, 0, 1, 1)
                  ctx.fillStyle = color
                  ctx.fillRect(0, 0, 1, 1)
                  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
                  const linear = [r, g, b].map(c => c / 255 <= 0.04045 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4)
                  return linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722
                }
                const background = el => {
                  const color = getComputedStyle(el).backgroundColor
                  return color === 'rgba(0, 0, 0, 0)' && el.parentElement ? background(el.parentElement) : color
                }
                return [...document.querySelectorAll('.will-agenda .will-item-status, .will-agenda .will-schedule-meta time, .will-calendar-legend, .will-date-number')]
                  .filter(el => el.getBoundingClientRect().width)
                  .map(el => {
                    const text = luminance(getComputedStyle(el).color)
                    const bg = luminance(background(el))
                    return { text: el.textContent.trim(), ratio: (Math.max(text, bg) + .05) / (Math.min(text, bg) + .05) }
                  })
              })
              row.contrastMinimum = Math.min(...contrasts.map(c => c.ratio))
              assert.ok(row.contrastMinimum >= 4.5, `calendar text contrast ${JSON.stringify(contrasts.filter(c => c.ratio < 4.5))}`)
            }
          }
          if (name === 'board') {
            await page.getByRole('button', { name: '新建任务' }).click()
            const dialog = page.getByRole('dialog', { name: '手动添加安排' })
            await dialog.waitFor()
            await page.waitForTimeout(400)
            await dialog.getByLabel('标题', { exact: true }).fill('弹窗键盘与可达性检查')
            assert.equal(await dialog.getByLabel('标题', { exact: true }).evaluate(el => el === document.activeElement), true)
            await dialog.getByRole('button', { name: '添加安排', exact: true }).click({ trial: true })
            if (width === 1440 || width === 390) await page.screenshot({ path: path.join(output, `editor-${width}-${theme}.png`) })
            await dialog.getByLabel('截止日期（可选）', { exact: true }).click()
            const picker = page.locator('.ant-picker-dropdown:visible')
            await picker.waitFor()
            const pickerBox = await picker.boundingBox()
            assert.ok(pickerBox.x >= 0 && pickerBox.x + pickerBox.width <= width + 1, `date picker overflow ${width} ${theme}`)
            await page.keyboard.press('Escape')
            await picker.waitFor({ state: 'hidden' })
            // rc Portal retains the top Escape handler until the popup exit motion finishes.
            await page.waitForTimeout(400)
            await dialog.getByRole('button', { name: '取消', exact: true }).press('Escape')
            await dialog.waitFor({ state: 'hidden' })
            await page.getByRole('button', { name: '视图设置' }).click()
            const views = page.getByRole('dialog', { name: '专用视图' })
            await views.getByLabel('论文', { exact: true }).uncheck()
            await views.getByRole('button', { name: '完成', exact: true }).click()
            assert.equal(await page.getByRole('tab', { name: '论文', exact: true }).count(), 0)
            await page.getByRole('button', { name: '视图设置' }).click()
            await views.getByLabel('论文', { exact: true }).check()
            await views.getByRole('button', { name: '完成', exact: true }).click()
          }
        }
        await page.goto(new URL('#/projects/empty/overview', base).href)
        const empty = page.locator('.will-project-overview-grid')
        await empty.waitFor()
        if (phase === 'after') assert.doesNotMatch(await empty.innerText(), /0\s*\/\s*0/)
        await page.goto(new URL('#/projects/finished/overview', base).href)
        await page.getByText('任务已全部完成', { exact: true }).waitFor()
        await page.goto(new URL('#/projects', base).href)
        await page.getByRole('tab', { name: /已归档/ }).click()
        await page.getByRole('button', { name: '恢复项目：已归档的研究记录', exact: true }).click({ trial: true })
        await page.goto(new URL('#/settings', base).href)
        await page.getByRole('button', { name: '清空安排', exact: true }).click()
        const confirm = page.locator('.ant-modal-confirm')
        await confirm.waitFor()
        await confirm.getByText('所有日程和待办将被删除，项目、显示名称与主题设置会保留。', { exact: true }).waitFor()
        await confirm.getByRole('button', { name: '保留安排', exact: true }).click()
        const schedule = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), SCHEDULE_KEY)
        const taskFields = tasks => tasks.map(t => [t.id, t.title, t.due ?? null, t.time ?? null, t.status, t.done]).sort((a, b) => a[0].localeCompare(b[0]))
        assert.deepEqual(taskFields(schedule.tasks), taskFields(fixture.schedule.tasks), 'view and modal interactions preserve tasks')
        assert.deepEqual(schedule.events, fixture.schedule.events)
        row.dataUntouched = true
        results.windows.push(row)
        console.log(`PASS ${width}x${height} ${theme}: ${row.pages.length} pages, calendar semantics, modals, views`)
      }
    }
    results.checks.push('8 size/theme combinations; 12 page/view routes each; dense calendar; date-only semantics; empty/completed projects; view toggles; editor and date picker Escape; popup bounds; destructive confirmation; task/event preservation')
    assert.deepEqual(errors, [])
    results.status = 'PASS'
    await fs.rm(path.join(output, 'failure.png'), { force: true })
  } catch (error) {
    results.status = 'FAIL'
    results.failure = error.stack
    results.focus = await page.evaluate(() => document.activeElement?.outerHTML).catch(() => null)
    await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {})
    throw error
  } finally {
    await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2))
    await browser.close()
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
