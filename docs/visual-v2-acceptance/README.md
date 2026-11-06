# Will V2 视觉统一验收

2026-11-07。对应 Issue #10 / #11，仅完成 V2，不进入 W3/W4。

## 基线与实现

- V1：[Draft PR #12](https://github.com/gthezi/will-demo/pull/12)，分支 `codex/will-visual-v1-20261107`，启动时 fetch 确认 HEAD 为 `d8375dec03c4d5e91f565f8fb6a5dce80db3775c`。
- V2：独立 worktree `Will-visual-v2`，分支 `codex/will-visual-v2-20261107`，从该 V1 HEAD 派生。V2 PR 的 base 为 V1 分支，依赖 V1 先合并或重定基线。
- 主要实现提交为 `5065a85`；截图验收后补充了固定月历行高与对应断言，避免密集事项造成网格变化。
- W2 业务基线仍为 `29f9e45`。未修改领域模型、业务 Hook、AI Schema、存储键、确认检查点或幂等写入机制；没有新增依赖。

| 页面 | V2 变化 |
| --- | --- |
| 日历 | 细分隔线替代逐格浮框；今天与选中日分别标记；事项条显示状态、时间/日期截止与标题；选中日期清单显示数量。600px 以下格内显示数量，完整清单保持可编辑。 |
| 项目列表 | 去掉大容器边框，统一标题/目标/进度/预览/操作层级；归档项目用虚线边界；空项目不显示 0% 或 0/0；已完成明确显示完成语义。预览优先未完成与进行中，再按日期排列，所有任务仍参与计数。 |
| 项目详情 | 无框概览与重点清单；看板列去掉外层卡片，任务保留轻边框；列表为连续行；状态 Select、编辑、日期跳转保留。资料与专用视图为明确的 W3/W4 文字占位。 |
| 设置 | 宽屏双栏分区，窄屏单栏；本地数据载入与清空分开；明确清空只删除日程/待办，保留项目、AI 会话与草案等。原二次确认不变。 |
| 公共组件 | 多状态可换行，长标题不被状态挤出；项目内部隐藏重复项目名；空状态去掉插图与预留高度；编辑器操作区用分隔线区分。 |

配色、字体、圆角、控件主题完全复用 V1，真实规则见 [设计系统](../design/WILL_DESIGN_SYSTEM.md)。

## 同数据对照

基线服务为 V1 worktree，V2 使用独立服务。两轮 [fixture](before/fixture.json) 包含长项目名称、长任务标题、无日期/日期截止/具体时间任务、密集选中日、空项目/全完成/归档项目，以及同会话 12+3 项草案。时钟固定为北京时间 2026-11-07 09:00，使用隔离浏览器 context，不访问用户正常客户端数据。

| 场景 | V1 | V2 |
| --- | --- | --- |
| 日历 1440×900 日间 | [旧](before/calendar-1440-light.png) | [新](after/calendar-1440-light.png) |
| 日历 1440×900 夜间 | [旧](before/calendar-1440-night.png) | [新](after/calendar-1440-night.png) |
| 项目列表 1440×900 日间 | [旧](before/projects-1440-light.png) | [新](after/projects-1440-light.png) |
| 项目概览 1440×900 夜间 | [旧](before/overview-1440-night.png) | [新](after/overview-1440-night.png) |
| 任务看板 1440×900 日间 | [旧](before/board-1440-light.png) | [新](after/board-1440-light.png) |
| 设置 1440×900 夜间 | [旧](before/settings-1440-night.png) | [新](after/settings-1440-night.png) |
| 日历 390×844 日间 | [旧](before/calendar-390-light.png) | [新](after/calendar-390-light.png) |
| 设置 390×844 夜间 | [旧](before/settings-390-night.png) | [新](after/settings-390-night.png) |
| 编辑器 390×844 日间 | [旧](before/editor-390-light.png) | [新](after/editor-390-light.png) |
| 首页与整体导航 1440×900 日间 | [旧](before/home-1440-light.png) | [新](after/home-1440-light.png) |

四尺寸 1440×900、1280×800、1024×768、390×844 × 两主题，逐个检查首页、日历、项目列表、概览、看板、列表、资料、论文、流程、协作、设置、AI 工作区，共 96 个页面/视图组合。检测结果见 [V1 矩阵](before/results.json) 与 [V2 矩阵](after/results.json)；仅存储代表性图片，完整检查不以保存所有图片为前提。

## 本轮验证

测试运行在 Windows，Chrome 156 / Electron 45，保留现有 Playwright 平台。W1 固定时钟为北京时间 2026-11-06 09:00，W2 使用原脚本时钟；V2 矩阵固定为 2026-11-07 09:00。测试时间与机器实际执行时间分开记录。

| 命令 | 本轮实际结果 |
| --- | --- |
| `npm test` | 84/84 通过 |
| `npm run lint` | 通过，无警告 |
| `npm run build` | 通过；主 bundle 1,081.89 kB，gzip 345.81 kB |
| `npm run desktop:build` | 通过；保留 >500 kB bundle 提示 |
| `npm run test:w1:browser` | 通过，40 组尺寸/主题/路由检查；[JSON](w1-regression/browser-w1-results.json) |
| `npm run test:w1:desktop` | 通过，真实 `will://app/` 本地协议及退出重启；[JSON](w1-regression/electron-w1-results.json) |
| `npm run test:w2:browser` | 通过，8 组布局及完整会话/草案/确认/失败流程；[JSON](w2-regression/browser-w2-results.json) |
| `npm run test:w2:desktop` | 通过，暂存与确认后的两次退出重启、同 ID 恢复及日历联动；[JSON](w2-regression/electron-w2-results.json) |
| `npm run test:visual:v1` | 通过，8 组窗口/主题，确认命中、键盘暂存、末项编辑、提示区、导航/月历隔离、5 次目标选择确认、系统主题与减少动画；[JSON](v1-regression/results.json) |
| `npm run test:visual:v2` | 通过，8 组 × 12 页面/视图，无横向溢出；日历日期/状态、空/完成项目、编辑器/日期浮层、视图配置与取消清空均通过；[JSON](after/results.json) |

浏览器/renderer 异常列表均为空。V2 矩阵还确认视图勾选、未保存编辑和取消清空不改变原有任务/日程。日历正文、状态标签、日期与图例抽样最低文字对比度为日间 4.60:1、夜间 5.92:1；这是指定元素检查，不是全站无障碍认证。新旧 fixture 的 SHA256 均为 `6816f7aad6f88e1928848c67b94eb5707d414e32e0b37546b55b36d2d96848f5`。

UI 套件串行运行，Electron 二进制先初始化一次。本轮没有复现 V1 记录的并发目标选择偶发失败。新增视觉脚本调试时修正了 AntD 隐藏缓存标签页的选择器及图标按钮的名称匹配；日期浮层在退出动画期间仍占据顶层 Esc 处理，故等待动画稳定后再检查编辑器 Esc。人工检查曾发现一张弹窗入场过渡帧，最终截图在入场稳定后重采。没有为通过测试而更改业务校验、确认逻辑或延长失败断言超时。

## 复现

在 `will-app` 执行 `npm ci`，再运行 `npm run dev -- --host 127.0.0.1 --port 4181 --strictPort`。

1. 载入示例，或创建包含无日期、日期截止、具体时间的任务；从任务日期跳到日历，核对没有虚构时刻，勾选完成后查看日历及项目进度联动。
2. 项目列表新建空项目，查看无 0/0 的概览；添加任务并依次切换待处理、进行中、完成，切换看板/列表，编辑与删除。项目管理菜单可改名、归档及恢复。
3. 专用视图设置隐藏再启用论文/流程/协作，刷新并访问标签深链；确认任务保留，资料与专用内容仍是占位。
4. 设置页切换日间/夜间/跟随系统、修改称呼及近期范围；分别打开载入示例和清空确认，取消时数据不变。清空确认只删除日程与待办。
5. 项目进入 AI Drawer，生成并编辑草案，展开工作区暂存，退出重启恢复，人工确认后回看项目及日历。再次确认与写入失败重试沿用 W2 回归。
6. 将窗口依次设为四种验收尺寸，核对月历数量/选中日清单、长项目标题、操作菜单、编辑器、日期浮层及 AI 操作区。

自动化运行时设置：

```powershell
$env:WILL_PLAYWRIGHT_MODULE = Join-Path $env:TEMP 'will-w1-test-runtime/node_modules/playwright'
$env:WILL_BASE_URL = 'http://127.0.0.1:4181/'
npm run test:visual:v2
```

Playwright 运行时初始化见 [W2 说明](../w2-acceptance/README.md)。回归 W1/W2 时分别设置 `WILL_EVIDENCE_DIR` 指向本目录下 `w1-regression` / `w2-regression`。重采 V1 时设置 V1 服务地址与 `WILL_VISUAL_PHASE=before`，随后删除该变量或恢复为 `after`。两个视觉阶段均从已有 V1 fixture 生成相同的合成数据。

## 限制与停止点

390px 保证可操作，仍沿用紧凑侧栏和纵向页面；没有重建完整手机产品。月历窄屏不显示格内事项全文，需要在选中日清单查看。长项目清单、任务看板和多草案页面允许正常纵向滚动。

无全站无障碍认证、其他机器安装验收或多窗口并发保证。Mock、资料/专用内容占位及本地保存边界不变。保留 npm 的 5 项 moderate 审计提示与约 1.082 MB 主 bundle 的体积提示；没有升级依赖或重建 Windows ZIP。

V2 Draft PR 提交后停止。未合并、未更新 `main`/Pages/线上版本，未改动其他 worktree 或用户未提交文件。
