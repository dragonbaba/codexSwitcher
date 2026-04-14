# 任务清单: rebrand-independent-repo

> **@status:** completed | 2026-04-14 21:18

```yaml
@feature: rebrand-independent-repo
@created: 2026-04-14
@status: completed
@mode: R2
```

## 进度概览

| 完成 | 失败 | 跳过 | 总数 |
|------|------|------|------|
| 6 | 0 | 0 | 6 |

---

## 任务列表

### 1. 元数据与品牌重命名

- [√] 1.1 在 `package.json`、`src-tauri/Cargo.toml`、`src-tauri/tauri.conf.json`、`index.html` 中统一新名称 `codex-account-switcher` / `Codex Account Switcher` | depends_on: []
- [√] 1.2 更新前端与平台层中的备份文件名、应用显示名称及相关用户可见文案 | depends_on: [1.1]

### 2. 独立仓库说明与发布配置

- [√] 2.1 重写 `README.md`，说明该项目基于 `Lampese/codex-switcher` 扩展与修正，强调 Windows 支持与独立仓库定位 | depends_on: [1.1]
- [√] 2.2 清理仍直接指向原仓库发布地址的配置，并调整版本脚本对新包名的匹配 | depends_on: [1.1]

### 3. 验证与同步

- [√] 3.1 执行 `bun run build` 与 `bun run tauri:build`，确认重命名后仍可构建打包 | depends_on: [1.2, 2.1, 2.2]
- [√] 3.2 同步知识库并归档本次独立仓库化方案包 | depends_on: [3.1]

---

## 执行日志

| 时间 | 任务 | 状态 | 备注 |
|------|------|------|------|
| 2026-04-14 21:10 | DESIGN | completed | 已确认新仓库名称为 `codex-account-switcher`，本轮不迁移本地存储目录 |
| 2026-04-14 21:13 | 1.1 | completed | 前端包名、Cargo 包名、Tauri 产品名、窗口标题与页面标题已统一改名 |
| 2026-04-14 21:13 | 1.2 | completed | 备份文件名、应用显示名称、OAuth 成功页提示等已同步切换到新品牌 |
| 2026-04-14 21:15 | 2.1 | completed | README 已重写为独立仓库说明，明确基于原项目扩展与修正 |
| 2026-04-14 21:15 | 2.2 | completed | updater 默认端点已清空，版本脚本匹配已切换到新包名 |
| 2026-04-14 21:18 | 3.1 | completed | `bun run build`、`bun run tauri:build`、`cargo test` 均通过 |
| 2026-04-14 21:18 | 3.2 | completed | 已同步知识库，待归档方案包 |

---

## 执行备注

> 当前任务是独立仓库化与品牌重命名，不做功能扩展；本地账号数据目录为兼容性考虑暂时保留现有命名。
