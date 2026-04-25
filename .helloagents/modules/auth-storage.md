# auth-storage

## 职责

- 管理 `~/.codex-switcher/accounts.json` 的读写和账号持久化。
- 提供账号增删改查、激活态管理和屏蔽列表。

## 行为规范

- **内存缓存**：使用 `std::sync::OnceLock<RwLock<AccountsStore>>` 全局缓存。
- **启动初始化**：`init_cache()` 在 `lib.rs` 启动时从磁盘加载到内存。
- **读取**：`load_accounts()` 从缓存读取 (O(1) 内存操作)，缓存未初始化时回退磁盘。
- **写入**：`save_accounts()` 写穿透 — 先写磁盘，再更新缓存。
- **序列化**：使用 `serde_json::to_string` (非 `to_string_pretty`) 减少文件体积。
- Unix 系统上写权限设为 `0o600`。

## 关键函数

| 函数 | 说明 |
|------|------|
| `init_cache()` | 启动时从磁盘加载到内存缓存 |
| `load_accounts()` | 从缓存 (优先) 或磁盘读取完整 store |
| `save_accounts()` | 写穿透：磁盘 + 缓存同步更新 |
| `add_account()` | 添加新账号，首个账号自动设为激活 |
| `remove_account()` | 删除账号，若为激活账号则切换到第一个 |
| `set_active_account()` | 更新激活账号 ID |
| `get_account()` / `get_active_account()` | 按 ID 查找 (走缓存) |
| `get_masked_account_ids()` / `set_masked_account_ids()` | 屏蔽列表管理 |

## 依赖关系

- 被 `tauri-commands`、`auth-switcher`、`token_refresh` 消费。
- 无内部模块依赖。
