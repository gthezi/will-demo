# 原型布局预览版

日期：2026-11-05

后续卡片、任务进度和助手草案的视觉调整见 [视觉打磨记录](visual-refinement-2026-11-05.md)。下文的源码与站点提交记录对应首次原型布局预览发布，保留用于回溯。

## 试用地址

- 原型布局预览：<https://gthezi.github.io/will-demo/prototype/>
- 原 React 版：<https://gthezi.github.io/will-demo/>

可直接将预览链接发给产品负责人。首次为空时，点击“载入示例数据”并确认，即可查看有内容的布局；示例会替换预览版已有安排与项目。

预览版恢复原型布局，继续使用 React 的表单校验、项目管理和本地保存。AI 是本地模拟；各浏览器数据独立，链接不包含发送者的安排。

## 源码版本

- 开发分支：`feat/prototype-experience`
- 改造前标签：`react-demo-before-prototype-2026-11-05`
- 本次预览标签：`prototype-preview-2026-11-05`
- 教程标签：`tutorial-baseline-2026-11-04`

源码和文档保存在本地 Git。公开仓库 `gthezi/will-demo` 仅用于部署静态产物。

## 构建和发布

从 `will-app/` 执行：

```powershell
npm.cmd run lint
npm.cmd test
npm.cmd run build -- --base=./ --outDir=../release/prototype-pages --emptyOutDir
```

将 `release/prototype-pages/` 中的内容发布至站点仓库的 `prototype/` 子目录。保留站点根目录文件，以便旧版链接继续可用。GitHub Pages 使用 `main` 分支的根目录。

Git HTTPS 连接不可用时，可使用已登录的 `gh api`：

1. 读取 `main` 当前提交及其树。
2. 以原树为 `base_tree`，仅添加或替换 `prototype/` 下的构建产物。
3. 创建提交，以读取到的提交为父节点。
4. 非强制更新 `main`，等待 Pages 构建成功。
5. 检查预览版实际加载、交互和资源请求，并核对旧版根目录文件未变化。

正式发布后，以线上浏览器检查结果为准。本地构建通过不等于线上发布完成。

## 存储说明

预览版安排写入 `will-prototype-schedule-v01`；若首次未找到该键，会尝试读取旧 React 键作为起点。旧键不被预览版覆盖。名称使用 `will-prototype-name-v01`；主题沿用 `will-react-theme-v01`，同源两个 React 版本共享主题偏好。

本轮没有改变日程与待办的类型和完成规则。相关产品讨论见 [原型工程化安排](prototype-engineering-plan.md)。

## 本次发布结果

- 应用源码提交：`73049628af5074b9b8b5cda50942a33553d6bfc6`
- 站点提交：`ff13b3f937614e63c6df6742fcf230070808d14a`
- GitHub Pages 发布成功，原站点根目录文件及资源树保持不变。
- 新预览版在线检查通过：事项与项目操作、AI 草案、主题与名称保存、五种宽度下四页布局、旧数据兼容和损坏存储处理；未观察到页面异常或失败资源请求。
- 原 React 链接的在线检查通过：主题、助手、保存与刷新、日历、项目、设置和窄屏布局。

新预览版首轮自动检查曾在快速添加菜单后等待弹窗超时；单独复现检查和完整复查均通过，尚未确认稳定复现的产品问题。后续试用若再次出现，可结合浏览器和操作路径跟进。

本机线上结果与截图分别保存在 `release/prototype-online-checks/` 和 `release/pages-checks/`。部署元信息位于 `release/prototype-deployment.json`。
