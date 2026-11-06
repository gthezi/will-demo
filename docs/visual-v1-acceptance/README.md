# Will 视觉升级 V1 验收

2026-11-07，执行范围为 [Issue #10](https://github.com/gthezi/will-demo/issues/10) 的 V1。没有进入 V2 或 W3。

## 基线与实现

- 启动及交付前均 fetch 核验 W2：`29f9e45fce1242f832a9076eec51d0af4b59e5a5`，远端没有变化。
- 独立 worktree：`Will-visual-v1`；分支：`codex/will-visual-v1-20261107`。
- `f0b2dc1`：V1-A 操作可达性、结果定位、反馈区域和页头操作优先级。
- `f3c7fa5`：V1-B 主题 Token、首页/AI 样板、批次独立表单名、设计规则和视觉验收脚本。
- 独立 [Draft PR #12](https://github.com/gthezi/will-demo/pull/12) 的 base 为 `codex/will-workbench-w2-20261106`；截图与验收记录随本分支归档。

## 独立复现与修复

| 问题 | 原版实测 | V1 结果 |
| --- | --- | --- |
| 草案确认首屏不可见 | 1440×900，3 项草案确认按钮底部约 978px；滚动后可达，未复现永久无法点击 | 宽窗对话/审阅分列独立滚动，每批操作 sticky；同窗口按钮底部约 834px |
| Drawer 新结果不易发现 | 生成后确认按钮底部约 1396px，需自行向下寻找 | 新批次定位结果；增加审阅/返回输入入口，按钮底部约 888px，未抢键盘焦点 |
| 消息遮挡页头 | 等入场动画完成后，四尺寸、两主题均测得与页头重叠；390px 截图可见 | 页头下方独立文档流反馈区域，8 组无重叠 |
| 两个主要 CTA | 快速添加和 AI 助手均为实色主按钮 | 快速添加为主按钮，AI 助手为次按钮，功能保留 |
| 侧栏展开影响月历 | 原版紧凑日期格由 43px 变为 106px，来自共用 `is-expanded` 选择器 | 月历展开样式限定自身根元素，日期格保持 43px；窄窗保持紧凑导航 |
| 多批次字段 ID 重复 | 同会话 12+3 项草案，前 3 项存在 18 个重复 input ID | 每个 Form 使用批次 ID 命名，8 组检查无重复，标签和错误定位彼此独立 |

长列表可以完整滚动到最后一项，展开编辑后通过键盘暂存。每批确认、取消、暂存分别保留，未合并为全局批量确认。原版基本场景没有复现横向溢出，V1 仍对窄窗与侧栏缩放做了保障。

## 视觉样板

采用暖纸色/暖炭灰底、墨绿操作色、赭石近期提示与朱砂紧急状态。以系统字体、细分隔线和清单行建立层级，移除首页浮框、AI 装饰空状态及重复项目标签。完成数量与线性进度替代圆环，待办清单显示未设截止数量。

首页原有近期截止、待办、项目与月历模块和数据口径均保留；近期截止与待办仍有合理的数据交集。CSS Variables 与 AntD 组件 Token 同源，详见 [设计规则](../design/WILL_DESIGN_SYSTEM.md)。

## 对照截图

矩阵使用同一份 [合成数据](before/fixture.json)：16 项待办、1 项日程，包含无日期/仅日期/具体时间、长标题；同一会话含 12+3 项草案。`after/fixture.json` 与该文件完全一致。时钟固定为北京时间 2026-11-07 09:00。首页和工作区为整页截图，Drawer 为窗口截图；不同布局的整页高度会不同。

| 场景 | 原版 | V1 |
| --- | --- | --- |
| 首页 1440×900 日间 | [旧](before/home-1440-light.png) | [新](after/home-1440-light.png) |
| 首页 1440×900 夜间 | [旧](before/home-1440-night.png) | [新](after/home-1440-night.png) |
| 多批次 AI 1440×900 夜间 | [旧](before/workspace-1440-night.png) | [新](after/workspace-1440-night.png) |
| 多批次 AI 1280×800 日间 | [旧](before/workspace-1280-light.png) | [新](after/workspace-1280-light.png) |
| 多批次 AI 1024×768 夜间 | [旧](before/workspace-1024-night.png) | [新](after/workspace-1024-night.png) |
| 首页 390×844 日间 | [旧](before/home-390-light.png) | [新](after/home-390-light.png) |
| Drawer 390×844 日间 | [旧](before/drawer-390-light.png) | [新](after/drawer-390-light.png) |
| 消息提示 390×844 日间 | [旧](before/toast-390-light.png) | [新](after/toast-390-light.png) |
| 项目内首次生成 1440×900 夜间 | [旧](before/drawer-generated-1440-night.png) | [新](after/drawer-generated-1440-night.png) |

四尺寸 × 两主题的完整检查结果在 [原版采样](before/results.json) 和 [V1 断言](after/results.json)。原版 `PASS` 仅表示采样完成，其中的 false/重叠标记才是缺陷证据。仅保留代表性图片，脚本可重新生成其余图片。

## 测试结果

| 命令 | 本轮结果 |
| --- | --- |
| `npm test` | 84/84 |
| `npm run lint` | 通过，无警告 |
| `npm run build` / `npm run desktop:build` | 均通过；保留 >500 kB bundle 提示 |
| `npm run test:w1:browser` | 通过，40 组；[JSON](w1-regression/browser-w1-results.json) |
| `npm run test:w1:desktop` | 通过，真实本地协议和退出重启；[JSON](w1-regression/electron-w1-results.json) |
| `npm run test:w2:browser` | 通过；[JSON](w2-regression/browser-w2-results.json) |
| `npm run test:w2:desktop` | 通过，草案/确认两次退出重启、同 ID 恢复与日历联动；[JSON](w2-regression/electron-w2-results.json) |
| `npm run test:visual:v1` | 通过，8 组视口/主题，页头反馈、按钮命中/焦点/键盘暂存、末项编辑、日历/导航、重复字段、5 次连续目标选择确认、系统主题、减少动画 |

浏览器/renderer 异常列表均为空。辅助正文对底色对比度为日间 5.19:1、夜间 8.36:1；主按钮文字对底色为日间 7.49:1、夜间 7.59:1。此为指定元素测量，不是全站无障碍认证。

执行中出现过 Electron 首次并发下载竞争，安装完成后串行复跑通过。并发 UI 回归曾出现一次目标项目未选中的失败，根因未确定；原 W2 脚本串行完整复跑及最后复跑均通过，额外 5 次连续目标选择/确认也通过。视觉测量等待浮层动画稳定，并用 Playwright trial click 验证命中；没有用延长超时掩盖断言失败。

## 复现

在 `will-app` 执行 `npm ci`，另一个终端运行 `npm run dev -- --host 127.0.0.1 --port 4180 --strictPort`。

1. 首页载入示例或创建无日期、仅日期、含时间任务；查看待办与日历规则。
2. 项目 → 课程与学习 → AI 助手，输入 `拆解任务：完成课程论文并核对研究方法和参考文献`；生成后直接发现结果，展开至工作区，编辑并暂存。
3. 在同一会话继续拆解另一目标；分别审阅两个批次，滚动并编辑末项，通过 Tab/Enter 暂存或确认。返回项目、日历及来源会话核对。
4. Electron 退出重启，核对草案恢复；确认后再重启，保持同一安排 ID，不重复写入。切换日夜主题及缩小窗口继续操作。

自动化复用 W2 的隔离 Playwright 运行时，详见 [W2 原验收说明](../w2-acceptance/README.md)。设置 `WILL_PLAYWRIGHT_MODULE`、`WILL_BASE_URL=http://127.0.0.1:4180/` 后运行上述脚本。W1/W2 回归请将 `WILL_EVIDENCE_DIR` 分别指向本目录的 `w1-regression` / `w2-regression`；视觉脚本不设置该变量，默认输出 `after`。重采原版时指定旧 W2 服务地址和 `WILL_VISUAL_PHASE=before`，再恢复环境变量并运行 V1。测试使用隔离浏览器 context 与临时 Electron profile，不读写正常客户端数据。

## 剩余限制

390px 保证可操作和无横向溢出，仍是原紧凑导航与纵向长页面；没有完整手机导航。项目、完整日历和设置仅继承基础 Token，未按 V2 做完整样板改造。AI 仍为本地规则 Mock；多窗口并发、跨设备、真实后端和资料库不在范围内。

未升级依赖；`npm ci` 保留 5 项 moderate 审计提示。没有另一台机器安装验收或重建 Windows ZIP。没有修改用户其他工作区、`main`、GitHub Pages、PR #9，也没有合并/发布。

后续建议仅供审阅：V2 可统一项目/日历清单与筛选样式，并进一步稳定并发 UI 自动化；W3 可沿用本次 Token 和表单状态规范。是否开始均等待用户确认。
