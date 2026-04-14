# frontend-app

## 职责

- 提供桌面/浏览器共用的账号控制台界面。
- 展示工作区 live auth 状态、App Active 账号、候选账号和切换反馈。
- 承载账号导入、导出、warm-up、排序和状态提示等交互。

## 行为规范

- 前端对外显示名称已切换为 `Codex Account Switcher`，README、浏览器标题和桌面窗口标题保持一致。
- 顶部工作区状态面板优先展示真实 `auth.json` 状态，而不是仅展示 store 状态。
- 工作区状态面板与页头状态条使用 `count` 展示实际运行中的 Codex 进程数量，使用 `can_switch` / `blocking_count` 决定是否禁用切换。
- 手动刷新入口应同时刷新额度、工作区 auth 与进程检测结果，避免进程状态展示只能依赖定时轮询。
- 账号卡片同时表达 `App Active` 和 `Live Workspace` 两种状态。
- 新增账号弹窗支持 OAuth、文件导入和“导入当前 auth”三种路径。
- 账号卡片的套餐标签优先显示实时 usage 返回的 `plan_type`，避免界面停留在过期的本地套餐信息。

## 依赖关系

- 依赖 `account-hooks` 提供状态与命令封装。
- 依赖 `tauri-commands` / Web invoke 接口返回结构化切换结果与工作区状态。
