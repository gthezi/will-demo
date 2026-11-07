const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const { chromium } = require(process.env.WILL_PLAYWRIGHT_MODULE || 'playwright')

const output = __dirname
const urls = {
  before: process.env.WILL_COLOR_BASELINE_URL || 'http://127.0.0.1:4183/',
  after: process.env.WILL_COLOR_URL || 'http://127.0.0.1:4182/',
}
const key = 'will-prototype-schedule-v01'
const now = new Date('2026-11-07T09:00:00+08:00')
const fixture = {
  version: 2,
  projects: [
    { id: 'will', name: 'Will 客户端', archived: false },
    { id: 'course', name: '课程与学习', archived: false },
    { id: 'personal', name: '个人事务', archived: false },
  ],
  tasks: [
    { id: 'overdue', title: '核对昨天的讨论反馈', due: '2026-11-06', time: '18:00', projectId: 'will', done: false },
    { id: 'today', title: '准备 Windows 客户端展示', due: '2026-11-07', time: '17:00', projectId: 'will', done: false },
    { id: 'tomorrow', title: '整理配色参考与会议记录', due: '2026-11-08', time: '10:00', projectId: 'will', done: false },
    { id: 'later', title: '提交课程报告', due: '2026-11-09', time: '17:00', projectId: 'course', done: false },
    { id: 'done', title: '确认演示流程', due: '2026-11-06', time: '18:00', projectId: 'will', done: true },
  ],
  events: [
    { id: 'event', title: '项目组讨论', date: '2026-11-07', time: '15:00', duration: 60, projectId: 'will', remind: 30 },
  ],
}
const errors = []
const checks = []
const screenshots = []
const expected = {
  light: { bg: 'rgb(255, 255, 255)', sidebar: 'rgb(248, 252, 253)', selected: 'rgb(235, 240, 241)', panel: 'rgb(255, 255, 255)', input: 'rgb(255, 255, 255)' },
  night: { bg: 'rgb(24, 24, 24)', sidebar: 'rgb(25, 28, 29)', selected: 'rgb(44, 46, 47)', panel: 'rgb(42, 42, 42)', input: 'rgb(54, 54, 54)' },
}

async function snapshot(page) {
  return page.evaluate(() => {
    const selectors = '.will-rail,.will-header,.will-content,.will-summary,.will-panel,.will-calendar-tool,.will-calendar-picker,.will-agenda,.will-project-section,.will-settings,.will-nav-button,.will-calendar-day,.assistant-draft,.ant-drawer-content,.ant-drawer-footer,.assistant-composer'
    const geometry = [...document.querySelectorAll(selectors)].flatMap(element => {
      const rect = element.getBoundingClientRect()
      if (!rect.width || !rect.height) return []
      return [{ tag: element.tagName, label: element.getAttribute('aria-label'), classes: element.className, box: [rect.x, rect.y, rect.width, rect.height] }]
    })
    return {
      geometry,
      text: document.querySelector('.will-content').innerText,
      overflow: document.documentElement.scrollWidth > innerWidth,
      schedule: localStorage.getItem('will-prototype-schedule-v01'),
    }
  })
}

function compare(before, after, label) {
  assert.equal(after.text, before.text, `${label}: content changed`)
  assert.equal(after.schedule, before.schedule, `${label}: stored schedule changed`)
  assert.equal(after.overflow, before.overflow, `${label}: overflow changed`)
  assert.equal(after.geometry.length, before.geometry.length, `${label}: element count changed`)
  before.geometry.forEach((element, index) => {
    const current = after.geometry[index]
    assert.equal(current.tag, element.tag, `${label}: element changed`)
    assert.equal(current.label, element.label, `${label}: accessible label changed`)
    // Ant Design theme hashes differ by palette; compare actual geometry instead.
    element.box.forEach((value, dimension) => assert.ok(Math.abs(value - current.box[dimension]) < 0.1,
      `${label}: ${element.classes} dimension ${dimension}: ${value} -> ${current.box[dimension]}`))
  })
}

async function capture(page, phase, name) {
  await page.mouse.move(0, 0)
  await page.locator('h1').click()
  await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0) })
  const filename = `${phase}-${name}.png`
  await page.screenshot({ path: path.join(output, filename), fullPage: true, animations: 'disabled' })
  screenshots.push(filename)
}

async function main() {
  const browser = await chromium.launch({ executablePath: process.env.WILL_CHROME_PATH })
  try {
    for (const [width, height] of [[1440, 900], [1280, 800], [1024, 768], [390, 844]]) {
      for (const theme of ['light', 'night']) {
        const sessions = {}
        try {
          for (const phase of ['before', 'after']) {
            const context = await browser.newContext({ viewport: { width, height }, timezoneId: 'Asia/Shanghai', reducedMotion: 'reduce' })
            const page = await context.newPage()
            page.on('pageerror', error => errors.push({ phase, message: error.message }))
            await page.clock.setFixedTime(now)
            await context.addInitScript(({ key, fixture, theme }) => {
              localStorage.setItem(key, JSON.stringify(fixture))
              localStorage.setItem('will-react-theme-v01', theme)
            }, { key, fixture, theme })
            await page.goto(urls[phase], { waitUntil: 'networkidle' })
            sessions[phase] = { context, page }
          }
          for (const name of ['首页', '日历', '项目', '设置']) {
            const snapshots = {}
            for (const phase of ['before', 'after']) {
              const page = sessions[phase].page
              await page.getByRole('navigation').getByRole('button', { name, exact: true }).click()
              await page.mouse.move(0, 0)
              snapshots[phase] = await snapshot(page)
              if (width === 1440 && name === '首页') await capture(page, phase, `home-${theme}-1440x900`)
            }
            compare(snapshots.before, snapshots.after, `${width}/${theme}/${name}`)
            checks.push({ width, height, theme, page: name, sameContent: true, sameGeometry: true, sameStoredData: true, overflow: snapshots.after.overflow })
          }
          const page = sessions.after.page
          await page.getByRole('navigation').getByRole('button', { name: '首页', exact: true }).click()
          const colors = await page.evaluate(() => ({
            bg: getComputedStyle(document.documentElement).backgroundColor,
            sidebar: getComputedStyle(document.querySelector('.will-rail')).backgroundColor,
            selected: getComputedStyle(document.querySelector('.will-nav-button.is-active')).backgroundColor,
            panel: getComputedStyle(document.querySelector('.will-panel')).backgroundColor,
          }))
          for (const name of Object.keys(colors)) assert.equal(colors[name], expected[theme][name], `${theme}/${name}`)
          for (const phase of ['before', 'after']) {
            const p = sessions[phase].page
            await p.getByRole('navigation').getByRole('button', { name: '首页', exact: true }).click()
            await p.getByRole('button', { name: 'AI 助手', exact: true }).click()
            await p.getByRole('textbox', { name: '输入安排', exact: true }).waitFor()
            if (phase === 'after') {
              assert.equal(await p.getByRole('textbox', { name: '输入安排', exact: true }).evaluate(element =>
                getComputedStyle(element.closest('.ant-input-affix-wrapper') || element).backgroundColor), expected[theme].input)
            }
            if (width === 1440) {
              const filename = `${phase}-assistant-input-${theme}-1440x900.png`
              await p.screenshot({ path: path.join(output, filename), animations: 'disabled' })
              screenshots.push(filename)
            }
            await p.getByRole('textbox', { name: '输入安排', exact: true }).fill('11月8日下午三点开项目组会，五点前提交汇报文档')
            await p.getByRole('button', { name: '生成草案', exact: true }).click()
            await p.getByRole('button', { name: '确认添加 2 项', exact: true }).waitFor()
            await p.mouse.move(0, 0)
            if (width === 1440) {
              const filename = `${phase}-assistant-drafts-${theme}-1440x900.png`
              await p.screenshot({ path: path.join(output, filename), animations: 'disabled' })
              screenshots.push(filename)
            }
          }
          compare(await snapshot(sessions.before.page), await snapshot(sessions.after.page), `${width}/${theme}/AI`)
          checks.push({ width, height, theme, page: 'AI Drawer', sameGeometry: true, colors, inputColor: expected[theme].input, drafts: 2 })
        } finally {
          for (const session of Object.values(sessions)) await session.context.close()
        }
      }
    }
    assert.deepEqual(errors, [])
    await fs.writeFile(path.join(output, 'colors-browser-results.json'), JSON.stringify({
      testedAt: new Date().toISOString(), sourceCommit: '2497c0290e460e357da173cea714739ea59eaa82',
      frozenNow: now.toISOString(), urls, fixture, checks, errors, screenshots,
    }, null, 2) + '\n')
    console.log(JSON.stringify({ checks: checks.length, screenshots: screenshots.length, errors }))
  } finally {
    await browser.close()
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
