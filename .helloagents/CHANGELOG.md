# 变更日志

## [0.1.7] - 2026-04-14

### 文档
- **[knowledge-base]**: 初始化项目知识库骨架，用于记录 `codex-switcher` 的现状与后续优化方案
  - 类型: 初始化
  - 文件: `.helloagents/INDEX.md`, `.helloagents/context.md`

## [0.2.0] - 2026-04-14

### 新增
- **[auth-switcher]**: 增加工作区 `auth.json` 指纹识别、事务式切换校验与失败回退 — by unknown
  - 方案: [202604141732_gpt-account-switching-optimization](archive/2026-04/202604141732_gpt-account-switching-optimization/)
  - 决策: gpt-account-switching-optimization#D001(以真实 auth 指纹识别 live 账号)
- **[frontend-app]**: 引入工作区状态面板和 live/app active 双状态展示，提升多 GPT 账号切换可见性 — by unknown
  - 方案: [202604141732_gpt-account-switching-optimization](archive/2026-04/202604141732_gpt-account-switching-optimization/)
  - 决策: gpt-account-switching-optimization#D002(切换采用备份-写入-验证-回退流程)

### 修复
- **[package-tooling]**: 前端依赖管理由 pnpm 迁移到 bun，统一 README、Tauri 构建命令与 CI — by unknown
  - 方案: [202604141732_gpt-account-switching-optimization](archive/2026-04/202604141732_gpt-account-switching-optimization/)

## [0.2.1] - 2026-04-14

### 修复
- **[auth-switcher]**: usage 刷新时会回写最新 `plan_type`，并在活动账号检测到套餐变化时尝试刷新 token 同步 `auth.json` — by Zaun
  - 方案: [202604142014_sync-plan-type-metadata](archive/2026-04/202604142014_sync-plan-type-metadata/)
  - 决策: sync-plan-type-metadata#D001(套餐变化以 usage 结果为真实来源并回写持久化元数据)
- **[frontend-app]**: 账号卡套餐标签改为优先显示实时 usage 套餐，避免升级后继续显示旧的 `free` 标签 — by Zaun
  - 方案: [202604142014_sync-plan-type-metadata](archive/2026-04/202604142014_sync-plan-type-metadata/)

## [0.2.2] - 2026-04-14

### 修复
- **[tauri-commands]**: Windows 进程检测新增对 `node.exe -> @openai/codex/bin/codex.js` CLI 会话的识别，并拆分 `count` 与 `blocking_count` 语义，修复“当前无阻塞进程”误判 — by Zaun
  - 方案: [202604142048_fix-process-detection-display](archive/2026-04/202604142048_fix-process-detection-display/)
  - 决策: fix-process-detection-display#D001(分离运行数量与切换阻断语义)
- **[frontend-app]**: 页头和工作区状态面板改为显示真实运行中的 Codex 进程数量，并继续仅在阻断状态下禁用切换 — by Zaun
  - 方案: [202604142048_fix-process-detection-display](archive/2026-04/202604142048_fix-process-detection-display/)

## [0.2.3] - 2026-04-14

### 修复
- **[frontend-app]**: 手动刷新现会同步刷新进程检测结果，收口“状态已刷新但进程徽标仍停留旧值”的尾差 — by Zaun
  - 方案: [202604142101_post-fix-hardening-review](archive/2026-04/202604142101_post-fix-hardening-review/)
  - 决策: post-fix-hardening-review#D001(收尾阶段仅做轻量体验优化，不调整已验证策略)
- **[frontend-app]**: 切换按钮的禁用提示改为“阻断切换的 Codex 进程”，与 `blocking_count` 语义保持一致 — by Zaun
  - 方案: [202604142101_post-fix-hardening-review](archive/2026-04/202604142101_post-fix-hardening-review/)

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
