# 变更日志

## [0.4.0] - 2026-04-26

### 移除
- **[package-tooling]**: 完全移除 Tauri updater 插件及相关依赖 — by Zaun
  - 类型: 重构
  - 文件: `package.json:27`, `Cargo.toml:21`, `lib.rs:24-29`, `tauri.conf.json:36-43`, `capabilities/default.json:10`, `build.yml:79-80/87-88`, `UpdateChecker.tsx`(已删除)
  - 说明: 删除前端 `UpdateChecker` 组件、Rust `tauri-plugin-updater` 依赖、Tauri updater 配置、CI 签名密钥和 updater JSON 产物配置。项目现已完全独立，与原上游仓库无关联。

### 性能优化
- **[tauri-commands]**: 进程检测添加 3 秒 TTL 内存缓存，避免重复启动 PowerShell — by Zaun
  - 类型: 优化
  - 文件: `commands/process.rs:11-13,54-72`
  - 说明: `check_codex_processes` 使用 `Mutex<Option<(Instant, CodexProcessInfo)>>` 缓存结果

- **[auth-storage]**: 添加 `RwLock<AccountsStore>` 内存缓存，消除所有读操作的磁盘 I/O — by Zaun
  - 类型: 优化
  - 文件: `auth/storage.rs:6-8,14-18,46-67`
  - 说明: 启动时 `init_cache()` 加载到内存，所有 `load_accounts()` 走缓存读取，`save_accounts()` 写穿透

- **[frontend-app]**: 合并 3s 进程检测 + 8s 工作区轮询为 5s 联合 tick — by Zaun
  - 类型: 优化
  - 文件: `App.tsx:133-138`, `useAccounts.ts:359-363`
  - 说明: 减少后台 IPC 调用频率，降低稳态 CPU 开销

- **[frontend-app]**: `activeAccount`/`otherAccounts` 包裹 `useMemo` 避免无效渲染 — by Zaun
  - 类型: 优化
  - 文件: `App.tsx:346-356`

- **[frontend-app]**: AddAccountModal 条件渲染 + `key` 强制重新挂载 — by Zaun
  - 类型: 优化
  - 文件: `App.tsx:695-706`

- **[package-tooling]**: 添加 Vite 代码分割（vendor + tauri chunks）— by Zaun
  - 类型: 优化
  - 文件: `vite.config.ts:34-45`

- **[package-tooling]**: `tokio` feature 从 `full` 精简为 `rt-multi-thread,sync,time,macros`，`serde_json::to_string_pretty` → `to_string` — by Zaun
  - 类型: 优化
  - 文件: `Cargo.toml:23`, `storage.rs:76`, `switcher.rs:291`

### CI
- **[package-tooling]**: CI 构建矩阵移除 macOS/Linux，仅保留 `windows-latest` — by Zaun
  - 类型: 重构
  - 文件: `.github/workflows/build.yml`

### UI 重设计
- **[frontend-app]**: 全局深色 UI 重设计 — by Zaun
  - 类型: 增强
  - 文件: `App.css`, `App.tsx`, `AccountCard.tsx`, `WorkspaceStatusPanel.tsx`, `AddAccountModal.tsx`, `UsageBar.tsx`
  - 设计系统: 配色 `#0b1121` / `#22C55E`(绿强调) / `#f1f5f9`(文本)，字体 Fira Sans + Fira Code，200-300ms 过渡
  - 关键改进: 零 emoji（全部 SVG 图标）、全局 `cursor-pointer`、统一圆角与过渡、`prefers-reduced-motion` 支持

## [0.3.0] - 2026-04-14

### 重构
- **[package-tooling]**: 项目对外名称统一重命名为 `codex-account-switcher`，同步更新前端包名、Cargo 包名、Tauri 产品名、窗口标题和版本脚本 — by Zaun
  - 方案: [202604142109_rebrand-independent-repo](archive/2026-04/202604142109_rebrand-independent-repo/)
  - 决策: rebrand-independent-repo#D001(对外独立改名，但保留本地数据目录兼容)
- **[frontend-app]**: README、页面标题、备份文件名和应用显示名称切换到独立仓库品牌，并明确这是基于原项目的扩展与修正版本 — by Zaun
  - 方案: [202604142109_rebrand-independent-repo](archive/2026-04/202604142109_rebrand-independent-repo/)

### 修复
- **[package-tooling]**: 移除默认指向上游仓库 release 的 updater 端点，避免独立仓库继续误连原项目发布链路 — by Zaun
  - 方案: [202604142109_rebrand-independent-repo](archive/2026-04/202604142109_rebrand-independent-repo/)

## [0.2.3] - 2026-04-14

### 修复
- **[frontend-app]**: 手动刷新现会同步刷新进程检测结果，收口"状态已刷新但进程徽标仍停留旧值"的尾差 — by Zaun
  - 方案: [202604142101_post-fix-hardening-review](archive/2026-04/202604142101_post-fix-hardening-review/)
  - 决策: post-fix-hardening-review#D001(收尾阶段仅做轻量体验优化，不调整已验证策略)
- **[frontend-app]**: 切换按钮的禁用提示改为"阻断切换的 Codex 进程"，与 `blocking_count` 语义保持一致 — by Zaun
  - 方案: [202604142101_post-fix-hardening-review](archive/2026-04/202604142101_post-fix-hardening-review/)

## [0.2.2] - 2026-04-14

### 修复
- **[tauri-commands]**: Windows 进程检测新增对 `node.exe -> @openai/codex/bin/codex.js` CLI 会话的识别，并拆分 `count` 与 `blocking_count` 语义 — by Zaun
  - 方案: [202604142048_fix-process-detection-display](archive/2026-04/202604142048_fix-process-detection-display/)
  - 决策: fix-process-detection-display#D001(分离运行数量与切换阻断语义)
- **[frontend-app]**: 页头和工作区状态面板改为显示真实运行中的 Codex 进程数量，并继续仅在阻断状态下禁用切换 — by Zaun
  - 方案: [202604142048_fix-process-detection-display](archive/2026-04/202604142048_fix-process-detection-display/)

## [0.2.1] - 2026-04-14

### 修复
- **[auth-switcher]**: usage 刷新时会回写最新 `plan_type`，并在活动账号检测到套餐变化时尝试刷新 token 同步 `auth.json` — by Zaun
  - 方案: [202604142014_sync-plan-type-metadata](archive/2026-04/202604142014_sync-plan-type-metadata/)
  - 决策: sync-plan-type-metadata#D001(套餐变化以 usage 结果为真实来源并回写持久化元数据)
- **[frontend-app]**: 账号卡套餐标签改为优先显示实时 usage 套餐 — by Zaun
  - 方案: [202604142014_sync-plan-type-metadata](archive/2026-04/202604142014_sync-plan-type-metadata/)

## [0.2.0] - 2026-04-14

### 新增
- **[auth-switcher]**: 增加工作区 `auth.json` 指纹识别、事务式切换校验与失败回退 — by unknown
  - 方案: [202604141732_gpt-account-switching-optimization](archive/2026-04/202604141732_gpt-account-switching-optimization/)
  - 决策: gpt-account-switching-optimization#D001(以真实 auth 指纹识别 live 账号)
- **[frontend-app]**: 引入工作区状态面板和 live/app active 双状态展示 — by unknown
  - 方案: [202604141732_gpt-account-switching-optimization](archive/2026-04/202604141732_gpt-account-switching-optimization/)
  - 决策: gpt-account-switching-optimization#D002(切换采用备份-写入-验证-回退流程)

### 修复
- **[package-tooling]**: 前端依赖管理由 pnpm 迁移到 bun — by unknown
  - 方案: [202604141732_gpt-account-switching-optimization](archive/2026-04/202604141732_gpt-account-switching-optimization/)

## [0.1.7] - 2026-04-14

### 文档
- **[knowledge-base]**: 初始化项目知识库骨架 — by unknown
  - 类型: 初始化
  - 文件: `.helloagents/INDEX.md`, `.helloagents/context.md`
