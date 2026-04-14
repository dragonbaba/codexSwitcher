# 任务清单: sync-plan-type-metadata

> **@status:** completed | 2026-04-14 20:19

```yaml
@feature: sync-plan-type-metadata
@created: 2026-04-14
@status: completed
@mode: R2
```

## 进度概览

| 完成 | 失败 | 跳过 | 总数 |
|------|------|------|------|
| 5 | 0 | 0 | 5 |

---

## 任务列表

### 1. 后端套餐同步

- [√] 1.1 在 `src-tauri/src/auth/storage.rs` 中补充仅同步套餐类型的元数据更新能力 | depends_on: []
- [√] 1.2 在 `src-tauri/src/api/usage.rs` 中实现 usage 套餐回写与活动账号 token 同步逻辑 | depends_on: [1.1]

### 2. 前端展示修正

- [√] 2.1 在 `src/components/AccountCard.tsx` 中优先展示最新 usage 的 `plan_type`，避免界面停留旧套餐 | depends_on: [1.2]

### 3. 验证

- [√] 3.1 为后端套餐同步增加或更新测试，并执行 `cargo test --manifest-path src-tauri/Cargo.toml` | depends_on: [1.2]
- [√] 3.2 执行 `bun run build` 验证前端构建 | depends_on: [2.1]

---

## 执行日志

| 时间 | 任务 | 状态 | 备注 |
|------|------|------|------|
| 2026-04-14 20:14 | DESIGN | completed | 已完成上下文收集并确认修复方案 |
| 2026-04-14 20:17 | 1.1 | completed | 新增独立套餐回写 helper，并补充内存级单元测试 |
| 2026-04-14 20:18 | 1.2 | completed | usage 成功后检测套餐变化，活动账号优先刷新 token，同步本地元数据 |
| 2026-04-14 20:18 | 2.1 | completed | 账号卡与 hooks 状态优先采用最新 usage.plan_type |
| 2026-04-14 20:19 | 3.1 | completed | `cargo test --manifest-path src-tauri/Cargo.toml` 通过 |
| 2026-04-14 20:19 | 3.2 | completed | `bun run build` 通过 |

---

## 执行备注

> 本次修复以 usage 返回的实时套餐类型为准，目标是同步本地元数据与活动账号 token 状态，而不是仅修正界面显示。
>
> 若远端套餐已变化但 token 刷新接口暂未返回新 claim，前端与本地元数据会先更新到最新套餐；活动 `auth.json` 的 claim 则会在后续 refresh token 成功后进一步对齐。
