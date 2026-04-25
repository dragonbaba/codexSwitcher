# frontend-app

## 职责

- 提供桌面/浏览器共用的账号控制台界面。
- 展示工作区 live auth 状态、App Active 账号、候选账号和切换反馈。
- 承载账号导入、导出、warm-up、排序和状态提示等交互。

## 行为规范

- 深色仪表盘 UI：配色 `#0b1121` / 表面 `#0f172a`，绿色强调 `#22C55E`，文本 `#f1f5f9`。
- 字体 Fira Sans (正文) + Fira Code (等宽)，200-300ms 过渡动效。
- `prefers-reduced-motion` 受尊重。
- **零 emoji** — 所有图标使用内联 SVG (Heroicons 风格)。
- 全部可点击元素使用 `cursor-pointer`。
- 顶部工作区状态面板优先展示真实 `auth.json` 状态。
- 工作区状态面板与页头状态条使用 `count` 展示实际 Codex 进程数量。
- 进程检测 + 工作区 auth 状态合并为 5 秒联合轮询 (原为 3s + 8s 独立轮询)。
- 手动刷新入口同时刷新额度、工作区 auth 与进程检测结果。
- `activeAccount` / `otherAccounts` 包裹 `useMemo` 避免无效渲染。
- AddAccountModal 使用条件渲染 + `key` 强制重新挂载。
- 账号卡片同时表达 `App Active` 和 `Live Workspace` 两种状态。
- 新增账号弹窗支持 OAuth、文件导入和"导入当前 auth"三种路径。
- 账号卡片的套餐标签优先显示实时 usage 返回的 `plan_type`。
- 构建产物分块：vendor (React/ReactDOM) + tauri (Tauri 插件) + 应用主代码。

## 依赖关系

- 依赖 `account-hooks` 提供状态与命令封装。
- 依赖 `tauri-commands` / Web invoke 接口返回结构化切换结果与工作区状态。
