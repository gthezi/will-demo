# Will｜个人安排助手（PC 展示原型）

面向校园场景的个人日程与任务助手。用户可输入自然语言，由**本地规则模拟**生成可编辑的日程 / 待办草案；确认后在日历、待办和项目中管理这些安排。

> **重要：此源码 / 文档分支与 GitHub Pages 正式站点 `main` 分离。** 当前 React + Electron 展示源码不等于线上已经发布的版本；Windows 展示 ZIP 位于开发者本地，未提交进 Git 或发布 Release。

## 从哪里开始

- **[项目记忆与当前状态](docs/PROJECT_MEMORY.md)**：目标、已经完成的成果、技术决策、分支关系与下一步；新对话 / Agent 优先阅读。
- **[Windows 11 月 7 日展示验收](docs/demo-acceptance/2026-11-07/README.md)**：实际测试结果、截图、限制与展示包信息。
- **[现场演示及备份指南](docs/demo-acceptance/2026-11-07/DEMO_GUIDE.md)**：首次启动、演示步骤、数据备份恢复。
- **[React / Electron 工程](will-app/README.md)**：功能与源码组织、开发测试和构建。
- **[原型与设计评审档案](docs/gpt-review/README.md)**：原始 HTML、P0 / P1 设计及前后截图；为历史对照材料。
- **[11 月 5 日视觉打磨记录](docs/visual-refinement-2026-11-05.md)**：历史视觉阶段说明。

## 版本与能力边界

- 当前桌面候选版使用 React + TypeScript + Vite + Ant Design + Electron；原生 Windows x64 免安装 ZIP 在开发环境已打包验证。
- 主要可演示流程：输入 → 模拟识别 → 编辑草案 → 确认 → 日历 / 待办 / 项目更新 → 完成及恢复 → 退出重启后仍保留。
- 当前没有真实 LLM 接口、服务端账号或跨设备同步；提醒仅保存偏好，不发送系统通知。
- 界面优化的 P0 [PR #1](https://github.com/gthezi/will-demo/pull/1)、P1 [PR #2](https://github.com/gthezi/will-demo/pull/2) 和 Windows [PR #3](https://github.com/gthezi/will-demo/pull/3) 已完成设计 / 功能审阅，仍是**依次继承的 Draft PR**，尚未合并至 `main`。
- 周六正式现场使用前，仍需确认最终投屏电脑完整解压后的首次启动、显示缩放与系统信誉提示。

## 本地运行

在 `will-app` 目录中执行：

```powershell
npm ci
npm run dev
npm run build
npm run lint
npm test

# Windows Electron 开发与展示包
npm run desktop:dev
npm run desktop:package
```

详细的 Node/Windows 环境说明、包输出位置和恢复方式请以 [展示指南](docs/demo-acceptance/2026-11-07/DEMO_GUIDE.md) 为准。

## 仓库管理边界

`main` 当前仍用于 GitHub Pages 现有站点；最新源码在讨论 / 实现分支。文档更新、展示代码开发和网站部署是不同操作。未经明确决定不应将整个源码分支直接合并覆盖 `main` 的站点产物。新资料（包括团队新版计划书）应确认原件后保存并交叉引用，不用旧讨论替代最新决策。
