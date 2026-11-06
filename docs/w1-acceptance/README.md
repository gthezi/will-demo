# W1 前端验收

2026-11-06 从 Draft PR #3 源码分支独立开发。数据为浏览器本地 mock；没有接入真实 AI、资料上传、服务端同步或通知。

## 复现

在 `will-app/` 执行：

```powershell
npm ci
npm run dev
```

浏览器打开 Vite 地址后可按以下步骤验收：

1. 选择“项目”→“新建项目”，命名“课程论文”，模板选择“课程论文”。创建后进入项目概览，能看到概览、任务、资料、论文视图。
2. 点“视图设置”，启用“流程”、隐藏“论文”，完成后刷新。流程仍显示，论文隐藏；重新启用论文后原项目和任务仍在。
3. 进入“任务”→“新建任务”，填写标题但不设置截止日期。任务出现在项目看板，不出现在日历。
4. 将任务状态设为“进行中”，返回概览确认进度同步；重新打开任务编辑，仅设置截止日期并保存。点击日期跳到日历，任务显示为日期截止且没有具体时间。
5. 刷新后检查已完成状态仍保留，再恢复任务；编辑并清除截止日期，保存后任务仍留在看板、日历不再显示。切换待处理 / 进行中 / 已完成可验证三态。

自动化交互脚本：`will-app/tests/w1.browser.cjs`。在 `will-app/` 安装临时 Playwright（不会改 package manifest / lockfile），启动 Vite 后运行脚本：

```powershell
npm install --no-save --package-lock=false playwright
node tests/w1.browser.cjs
```

脚本会清空专用浏览器上下文中的 localStorage 并重建示例项目，生成下列截图；不会访问 Electron 展示包数据。

## 本轮截图

首页：

![首页 1440x900](home-1440x900.png)

项目概览：

![项目概览 1440x900](project-overview-1440x900.png)

三态看板与无截止任务：

![项目任务看板 1440x900](project-task-board-1440x900.png)

仅日期截止任务的日历展示：

![日历日期截止 1440x900](calendar-date-deadline-1440x900.png)

响应式检查截图：`responsive-1440x900.png`、`responsive-1366x768.png`、`responsive-1280x720.png`、`responsive-1024x768.png`、`responsive-800x600.png`。

## 验证记录

- `npm ci`：成功；npm 提示 5 项 moderate 依赖审计问题，未执行自动升级。
- `npm test`：62/62 通过。
- `npm run lint`：通过。
- `npm run build`：通过；Vite 报告 Ant Design 汇总 chunk 超过 500 kB 的体积提示。
- Chromium 交互：项目模板、视图配置刷新恢复、无日期任务、三态切换、截止日期 / 日历跳转、项目 hash 深链和 5 个窗口尺寸通过；0 页面异常、无水平溢出。
- Electron 本地协议：`npm run desktop:build` 后运行 `npm run desktop:start`，实际打开本地 `will://app/` 窗口并确认进程响应；路由使用 hash，另通过路由单元与 Chromium 刷新检查。本轮没有重新生成 Windows ZIP，也未进行跨机安装验证。
