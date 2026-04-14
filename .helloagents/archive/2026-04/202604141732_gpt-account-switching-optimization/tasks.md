# 任务清单: gpt-account-switching-optimization

```yaml
@feature: gpt-account-switching-optimization
@created: 2026-04-14
@status: completed
@mode: R3
```

## 进度概览

| 完成 | 失败 | 跳过 | 总数 |
|------|------|------|------|
| 9 | 0 | 0 | 9 |

---

## 任务列表

### 1. 后端切换链路强化

- [√] 1.1 在 `src-tauri/src/auth/switcher.rs` 中实现当前 `auth.json` 真实状态读取、认证指纹计算、备份与恢复能力 | depends_on: []
- [√] 1.2 在 `src-tauri/src/auth/switcher.rs` / `src-tauri/src/types.rs` 中实现切换写后验证与结构化切换结果模型 | depends_on: [1.1]
- [√] 1.3 在 `src-tauri/src/commands/account.rs` 中接入事务式切换流程，并暴露“读取当前工作区状态 / 导入当前 auth”为命令 | depends_on: [1.2]

### 2. 前端状态与界面升级

- [√] 2.1 在 `src/types/index.ts` 与 `src/hooks/useAccounts.ts` 中接入新的工作区状态、切换结果和当前 auth 导入能力 | depends_on: [1.3]
- [√] 2.2 在 `src/App.tsx` 中重构顶部工作区状态区与切换交互，突出 live 状态、切换反馈和快捷导入入口 | depends_on: [2.1]
- [√] 2.3 在 `src/components/AccountCard.tsx` 与样式文件中强化卡片信息层级、状态表达和控制台视觉 | depends_on: [2.2]

### 3. 验证与文档

- [√] 3.1 为新增的后端纯逻辑补充测试或最小可验证校验，并完成构建验证 | depends_on: [1.3]
- [√] 3.2 将前端依赖管理从 `pnpm` 迁移到 `bun`，更新 `package.json`、锁文件及相关脚本引用 | depends_on: [2.3]
- [√] 3.3 更新 `README.md`，补充多 GPT 账号切换的推荐流程、安全机制、bun 使用方式和恢复说明 | depends_on: [3.1, 3.2]

---

## 执行日志

| 时间 | 任务 | 状态 | 备注 |
|------|------|------|------|
| 2026-04-14 17:32 | 方案设计 | completed | 已确定采用“事务式切换控制台”方案并完成任务拆分 |
| 2026-04-14 17:34 | 需求补充 | completed | 新增约束：前端依赖管理统一迁移到 bun |
| 2026-04-14 17:48 | 1.x | completed | 后端已支持工作区 auth 状态识别、事务式切换和当前 auth 导入 |
| 2026-04-14 17:54 | 2.x | completed | 前端已接入工作区状态面板、控制台风格卡片和切换反馈 |
| 2026-04-14 17:58 | 3.x | completed | 已完成 bun 迁移、README 更新、`bun run build` 和 `cargo test` 验证 |

---

## 执行备注

- 当前任务为现有项目优化，不做技术栈迁移。
- 优先保证切换真实性与恢复能力，再做界面增强。
- 前端包管理迁移范围限于 Node/Bundler 侧，Rust / Cargo 维持原状。
- 若实现过程中发现现有 `auth.json` 真实格式与推断不一致，先以读取结果为准修正匹配与展示逻辑。
