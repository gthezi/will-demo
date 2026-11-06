const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const { chromium } = require(process.env.WILL_PLAYWRIGHT_MODULE || 'playwright')
const { launchBrowser, startProject, send, expand, read, AI_KEY, SCHEDULE_KEY } = require('./w2.flows.cjs')
const base = process.env.WILL_BASE_URL || 'http://127.0.0.1:4180/'
const phase = process.env.WILL_VISUAL_PHASE || 'after'
const output = path.resolve(process.env.WILL_EVIDENCE_DIR || `../docs/visual-v1-acceptance/${phase}`)

async function bounds(locator) {
  return locator.evaluate(el => {
    const r = el.getBoundingClientRect()
    const scrollParent = el.closest('.ant-drawer-body, .ai-review')
    const p = scrollParent?.getBoundingClientRect()
    return { top: r.top, bottom: r.bottom, width: r.width,
      inViewport: r.top >= 0 && r.bottom <= innerHeight,
      inScrollport: !p || r.top >= Math.max(0, p.top) && r.bottom <= Math.min(innerHeight, p.bottom),
      hit: document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest('button') === el }
  })
}
async function contrast(page) {
  return page.evaluate(() => {
    const luminance = color => {
      const c = color.match(/[\d.]+/g).slice(0, 3).map(v => {
        const n = Number(v) / 255
        return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4
      })
      return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722
    }
    const ratio = (a, b) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05)
    const root = getComputedStyle(document.documentElement)
    const muted = getComputedStyle(document.querySelector('.will-summary-remaining'))
    const button = getComputedStyle(document.querySelector('.will-quick-add'))
    return { muted: ratio(muted.color, root.backgroundColor), primary: ratio(button.color, button.backgroundColor) }
  })
}
async function main() {
  await fs.mkdir(output, { recursive: true })
  const browser = await launchBrowser(chromium)
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: 'Asia/Shanghai' })
  const page = await context.newPage()
  page.setDefaultTimeout(15000)
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  const results = { phase, base, checks: [], windows: [], errors }
  try {
    await page.clock.install({ time: new Date('2026-11-07T09:00:00+08:00') })
    await page.goto(base)
    await startProject(page)
    await send(page, '拆解任务：完成课程论文并与导师核对研究方法和所有参考文献')
    await page.waitForTimeout(400)
    const drawerConfirm = page.getByRole('button', { name: '确认添加 3 项', exact: true })
    results.drawerGenerated = await bounds(drawerConfirm)
    await page.screenshot({ path: path.join(output, 'drawer-generated-1440-night.png') })
    if (phase === 'after') {
      // The result heading must be revealed, rather than requiring a blind scroll below the composer.
      const title = page.getByRole('heading', { name: '待确认 3 项', exact: true })
      assert.ok((await title.boundingBox()).y < 900)
      await drawerConfirm.click()
      await page.getByRole('heading', { name: '已添加 3 项安排', exact: true }).waitFor()
      await send(page, '拆解任务：完成课程论文并与导师核对研究方法和所有参考文献')
    }
    await expand(page)
    const normalConfirm = page.getByRole('button', { name: '确认添加 3 项', exact: true })
    await page.evaluate(() => scrollTo(0, 0))
    results.workspaceNormal = await bounds(normalConfirm)
    await page.screenshot({ path: path.join(output, 'workspace-normal-1440-night.png') })
    await normalConfirm.scrollIntoViewIfNeeded()
    results.workspaceNormalReachable = await bounds(normalConfirm)
    const state = await read(page)
    const c = state.ai.conversations.find(c => c.id === state.ai.activeId)
    const b = c.batches.at(-1)
    // Identical synthetic fixtures in both versions; no production storage is touched.
    c.batches = [0, 1].map(n => ({
      ...b, id: `visual-batch-${n}`, messageId: b.messageId, status: 'staged',
      proposals: Array.from({ length: n ? 3 : 12 }, (_, i) => ({
        ...b.proposals[i % 3], id: `visual-proposal-${n}-${i}`,
        title: `${i + 1}. 完成课程论文：核对研究方法、访谈记录与参考文献，整理导师反馈并形成可复核的修订清单`,
      })),
    }))
    let fixture = { ai: state.ai, schedule: {
      version: 3,
      projects: [
        { id: 'will', name: 'Will 开发', archived: false },
        { id: 'course', name: '课程与学习', archived: false },
        { id: 'personal', name: '个人事务', archived: false },
      ],
      tasks: Array.from({ length: 16 }, (_, i) => ({
        id: `visual-task-${i}`, title: i === 0 ? '整理导师反馈与参考文献，完成研究问题和实验方案的首轮修订' : `课程论文 · 第 ${i + 1} 项工作`,
        projectId: 'course', status: i > 12 ? 'done' : i === 2 ? 'in_progress' : 'todo', done: i > 12,
        ...(i % 3 ? { due: `2026-11-${String(7 + i % 5).padStart(2, '0')}`, ...(i % 3 === 2 ? { time: '17:00' } : {}) } : {}),
      })),
      events: [{ id: 'visual-event', title: '课程论文进度讨论', projectId: 'course', date: '2026-11-07', time: '15:00', duration: 60, remind: 0 }],
    } }
    if (phase === 'after') fixture = JSON.parse(await fs.readFile(path.resolve('../docs/visual-v1-acceptance/before/fixture.json'), 'utf8'))
    await fs.writeFile(path.join(output, 'fixture.json'), JSON.stringify(fixture, null, 2))
    for (const theme of ['light', 'night']) {
      for (const [width, height] of [[1440, 900], [1280, 800], [1024, 768], [390, 844]]) {
        await page.setViewportSize({ width, height })
        await page.evaluate(({ fixture, theme, AI_KEY, SCHEDULE_KEY }) => {
          localStorage.setItem(AI_KEY, JSON.stringify(fixture.ai))
          localStorage.setItem(SCHEDULE_KEY, JSON.stringify(fixture.schedule))
          localStorage.setItem('will-react-theme-v01', theme)
          location.hash = '#/home'
        }, { fixture, theme, AI_KEY, SCHEDULE_KEY })
        await page.reload()
        await page.getByRole('heading', { name: '今天值得处理', exact: true }).waitFor()
        await page.evaluate(() => scrollTo(0, 0))
        const homeOverflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
        const colorContrast = await contrast(page)
        await page.screenshot({ path: path.join(output, `home-${width}-${theme}.png`), fullPage: true })
        const calendarDay = page.locator('.will-calendar-day').first()
        const compactHeight = (await calendarDay.boundingBox()).height
        if (width <= 730) await page.setViewportSize({ width: 800, height })
        await page.getByRole('button', { name: '展开导航', exact: true }).click()
        if (width <= 730) await page.setViewportSize({ width, height })
        const expandedNavDayHeight = (await calendarDay.boundingBox()).height
        const expandedNavOverflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
        if (width <= 730) await page.setViewportSize({ width: 800, height })
        await page.getByRole('button', { name: '收起导航', exact: true }).click()
        if (width <= 730) await page.setViewportSize({ width, height })
        await page.getByRole('navigation').getByRole('button', { name: '日历', exact: true }).click()
        const calendarOverflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
        // Trigger a genuine global toast, then measure overlap with the header.
        await page.getByRole('navigation').getByRole('button', { name: '设置', exact: true }).click()
        await page.getByRole('button', { name: '保存设置', exact: true }).click()
        await page.getByText('称呼已保存', { exact: true }).waitFor()
        await page.waitForTimeout(400)
        const toast = await page.locator('.ant-message-notice-wrapper').boundingBox()
        const header = await page.locator('.will-header').boundingBox()
        const toastOverHeader = toast.y < header.y + header.height && toast.y + toast.height > header.y
        if (width === 390) await page.screenshot({ path: path.join(output, `toast-${width}-${theme}.png`) })
        await page.goto(new URL(`#/ai/${fixture.ai.activeId}`, base).href)
        await page.locator('.ai-review-batch').first().waitFor()
        const fieldIds = await page.locator('.ai-review input[id]').evaluateAll(es => es.map(e => e.id))
        const duplicateFieldIds = fieldIds.filter((id, i) => fieldIds.indexOf(id) !== i)
        const first = page.getByRole('button', { name: '确认添加 12 项', exact: true })
        const initial = await bounds(first)
        await page.screenshot({ path: path.join(output, `workspace-${width}-${theme}.png`), fullPage: true })
        const workspaceOverflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
        await first.scrollIntoViewIfNeeded()
        const reachable = await bounds(first)
        await first.focus()
        const keyboardFocus = await first.evaluate(el => el === document.activeElement)
        const last = page.getByRole('button', { name: '确认添加 3 项', exact: true })
        await last.scrollIntoViewIfNeeded()
        const lastReachable = await bounds(last)
        const row = { theme, width, height, homeOverflow, workspaceOverflow, calendarOverflow, expandedNavOverflow,
          compactHeight, expandedNavDayHeight, colorContrast, duplicateFieldIds, toastOverHeader, initial, reachable, lastReachable, keyboardFocus }
        results.windows.push(row)
        if (phase === 'after') {
          assert.equal(homeOverflow, false, `home overflow ${theme} ${width}`)
          assert.equal(workspaceOverflow, false, `workspace overflow ${theme} ${width}`)
          assert.equal(calendarOverflow, false, `calendar overflow ${theme} ${width}`)
          assert.equal(expandedNavOverflow, false, `nav overflow ${theme} ${width}`)
          assert.equal(expandedNavDayHeight, compactHeight, 'navigation must not expand the mini calendar')
          assert.ok(colorContrast.muted >= 4.5 && colorContrast.primary >= 4.5, `text contrast ${JSON.stringify(colorContrast)}`)
          assert.equal(toastOverHeader, false, `toast obscures header ${theme} ${width}`)
          assert.ok(reachable.inViewport && reachable.hit, `first actions unreachable ${theme} ${width}`)
          assert.ok(lastReachable.inViewport && lastReachable.hit, `last actions unreachable ${theme} ${width}`)
          assert.ok(keyboardFocus)
          assert.deepEqual(duplicateFieldIds, [], 'each batch needs independent field IDs and label/focus targets')
          // The final item and editor must not be covered by a sticky footer.
          const group = page.getByRole('group', { name: '安排 12', exact: true })
          await group.scrollIntoViewIfNeeded()
          await group.getByRole('button', { name: '编辑安排 12', exact: true }).click()
          const title = group.getByLabel('标题', { exact: true })
          await title.fill('最后一项编辑后仍可保存')
          await title.press('Tab')
          const stage = page.getByRole('button', { name: '暂存草案', exact: true }).first()
          await stage.focus()
          await stage.press('Enter')
          assert.equal((await read(page)).ai.conversations.find(c => c.id === fixture.ai.activeId).batches[0].proposals[11].title, '最后一项编辑后仍可保存')
        }
        await page.getByRole('button', { name: 'AI 助手', exact: true }).first().click()
        const drawer = page.getByRole('dialog', { name: 'AI 助手', exact: true })
        await page.waitForTimeout(400)
        const drawerButton = drawer.getByRole('button', { name: '确认添加 12 项', exact: true })
        await drawerButton.scrollIntoViewIfNeeded()
        await drawerButton.click({ trial: true })
        const drawerReachable = await bounds(drawerButton)
        row.drawerReachable = drawerReachable
        row.drawerOverflow = await drawer.evaluate(el => el.scrollWidth > el.clientWidth)
        if (phase === 'after') {
          assert.ok(drawerReachable.inViewport && drawerReachable.hit, `drawer actions ${theme} ${width}`)
          assert.equal(row.drawerOverflow, false)
        }
        await page.screenshot({ path: path.join(output, `drawer-${width}-${theme}.png`) })
        await drawer.getByRole('button', { name: '关闭', exact: true }).click()
      }
    }
    if (phase === 'after') {
      await page.setViewportSize({ width: 1440, height: 900 })
      for (let i = 0; i < 5; i++) {
        await page.getByRole('button', { name: '新会话', exact: true }).click()
        await send(page, `拆解任务：目标项目连续选择检查 ${i + 1}`)
        await page.getByRole('combobox', { name: '批次目标项目', exact: true }).click()
        await page.locator('.ant-select-dropdown:visible').getByText('课程与学习', { exact: true }).click()
        await page.waitForFunction(key => {
          const state = JSON.parse(localStorage.getItem(key))
          return state.conversations.find(c => c.id === state.activeId).batches.at(-1).proposals.every(p => p.projectId === 'course')
        }, AI_KEY)
        await page.getByRole('button', { name: '确认添加 3 项', exact: true }).click()
        await page.getByRole('heading', { name: '已添加 3 项安排', exact: true }).waitFor()
      }
      await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' })
      await page.evaluate(() => localStorage.setItem('will-react-theme-v01', 'system'))
      await page.reload()
      assert.equal(await page.locator('html').getAttribute('data-theme'), 'night')
      await page.emulateMedia({ colorScheme: 'light' })
      await page.waitForFunction(() => document.documentElement.dataset.theme === 'light')
      const motion = await page.locator('.will-quick-add').evaluate(el => getComputedStyle(el).transitionDuration)
      assert.equal(motion, '0s')
      results.checks.push('system theme updates without reload', 'reduced motion disables transitions', 'keyboard Enter stages edited last proposal',
        'multi-batch form IDs are unique', '5 successive global sessions select target and confirm successfully')
    }
    assert.deepEqual(errors, [])
    results.result = 'PASS'
  } catch (error) {
    results.result = 'FAIL'
    results.error = error.stack
    await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true })
    throw error
  } finally {
    await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2))
    await browser.close()
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
