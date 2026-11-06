const assert = require('node:assert/strict')
const path = require('node:path')
const fs = require('node:fs/promises')
const AI_KEY = 'will-ai-workspace-v01'
const SCHEDULE_KEY = 'will-workbench-schedule-v03'
const read = page => page.evaluate(({ a, s }) => ({
  ai: JSON.parse(localStorage.getItem(a)), schedule: JSON.parse(localStorage.getItem(s)),
}), { a: AI_KEY, s: SCHEDULE_KEY })
async function send(page, text) {
  await page.getByRole('textbox', { name: '输入安排', exact: true }).fill(text)
  await page.getByRole('button', { name: '生成草案', exact: true }).click()
  await page.getByRole('button', { name: '生成草案', exact: true }).waitFor()
}
async function launchBrowser(chromium) {
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
  return chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) })
}
async function startProject(page) {
  await page.getByRole('navigation').getByRole('button', { name: '项目', exact: true }).click()
  await page.getByRole('button', { name: '课程与学习', exact: true }).click()
  await page.getByRole('button', { name: 'AI 助手', exact: true }).last().click()
  await page.getByRole('dialog', { name: 'AI 助手', exact: true }).waitFor()
  await page.getByText('参考：课程与学习相关任务与日程', { exact: true }).waitFor()
}
async function expand(page) {
  await page.getByRole('button', { name: '在工作区展开', exact: true }).click()
  await page.locator('.ai-workspace').waitFor()
  await page.getByRole('dialog', { name: 'AI 助手', exact: true }).waitFor({ state: 'hidden' })
}
async function editTitle(page, index, title) {
  await page.getByRole('button', { name: `编辑安排 ${index}`, exact: true }).click()
  const group = page.getByRole('group', { name: `安排 ${index}`, exact: true })
  await group.getByLabel('标题', { exact: true }).fill(title)
  await page.getByRole('button', { name: `收起安排 ${index}`, exact: true }).click()
}
async function breakdown(page, title = '先确定论文问题') {
  await page.getByRole('button', { name: '拆解任务', exact: true }).click()
  assert.equal(await page.getByRole('textbox', { name: '输入安排', exact: true }).inputValue(), '拆解任务：')
  await send(page, '拆解任务：完成课程论文')
  await page.getByRole('heading', { name: '待确认 3 项', exact: true }).waitFor()
  await editTitle(page, 1, title)
  await page.getByRole('button', { name: '暂存草案', exact: true }).click()
  await page.getByText('草案已暂存到本机，可从历史会话继续。', { exact: true }).waitFor()
  const saved = await read(page)
  const c = saved.ai.conversations.find(c => c.id === saved.ai.activeId)
  assert.equal(c.batches.at(-1).status, 'staged')
  assert.equal(c.batches.at(-1).proposals[0].title, title)
  assert.ok(c.batches.at(-1).proposals.every(p => !p.date && !p.time && p.projectId === c.contextProjectId))
  return { conversationId: c.id, batchId: c.batches.at(-1).id, proposals: c.batches.at(-1).proposals }
}
async function confirm(page, count) {
  await page.getByRole('button', { name: `确认添加 ${count} 项`, exact: true }).dblclick()
  await page.getByRole('heading', { name: `已添加 ${count} 项安排`, exact: true }).waitFor()
}
async function notificationFlow(page, output) {
  await startProject(page)
  await page.getByRole('button', { name: '整理通知', exact: true }).click()
  assert.match(await page.getByRole('textbox', { name: '输入安排', exact: true }).inputValue(), /^整理通知：/)
  await send(page, '整理通知：2026-11-10下午三点有组会，五点前提交汇报文档；整理提纲')
  await page.getByRole('heading', { name: '待确认 3 项', exact: true }).waitFor()
  const beforeExpand = await read(page)
  await expand(page)
  const expanded = await read(page)
  assert.equal(expanded.ai.activeId, beforeExpand.ai.activeId)
  assert.deepEqual(expanded.ai.conversations[0].batches, beforeExpand.ai.conversations[0].batches)
  await editTitle(page, 2, '提交课程汇报')
  await page.getByRole('button', { name: '移除安排 3', exact: true }).click()
  await page.getByRole('heading', { name: '待确认 2 项', exact: true }).waitFor()
  await page.screenshot({ path: path.join(output, 'notice-review-1440x900.png'), fullPage: true, scale: 'css' })
  const pending = await read(page)
  assert.equal(pending.schedule, null)
  await confirm(page, 2)
  const saved = await read(page)
  assert.equal(saved.schedule.tasks.length, 1)
  assert.equal(saved.schedule.events.length, 1)
  assert.equal(saved.schedule.tasks[0].title, '提交课程汇报')
  for (const p of [...saved.schedule.tasks, ...saved.schedule.events]) {
    assert.equal(p.projectId, 'course')
    assert.equal(p.source.conversationId, saved.ai.activeId)
    assert.match(p.source.input, /整理提纲/)
  }
  await page.getByRole('button', { name: '查看项目：课程与学习', exact: true }).click()
  await page.getByRole('button', { name: '提交课程汇报', exact: true }).waitFor()
  await page.screenshot({ path: path.join(output, 'notice-project.png'), fullPage: true, scale: 'css' })
  await page.getByRole('button', { name: '提交课程汇报', exact: true }).click()
  await page.getByText('AI 输入来源', { exact: true }).click()
  await page.getByRole('button', { name: '查看来源会话', exact: true }).click()
  await page.locator('.ai-confirmed').waitFor()
  await page.getByRole('button', { name: '查看日历', exact: true }).click()
  await page.getByRole('heading', { name: '2026年11月10日', exact: true }).waitFor()
  await page.locator('.will-agenda').getByRole('button', { name: '编辑事项：提交课程汇报', exact: true }).waitFor()
  await page.screenshot({ path: path.join(output, 'notice-calendar.png'), fullPage: true, scale: 'css' })
  return { conversationId: saved.ai.activeId, taskId: saved.schedule.tasks[0].id, eventId: saved.schedule.events[0].id }
}
module.exports = { AI_KEY, SCHEDULE_KEY, read, send, startProject, expand, editTitle, breakdown, confirm, notificationFlow, launchBrowser }
