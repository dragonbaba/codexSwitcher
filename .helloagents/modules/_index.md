# 模块索引

| 模块 | 说明 |
|------|------|
| frontend-app | React 界面与交互层，深色仪表盘 UI |
| account-hooks | 账号列表、切换、导入导出与用量刷新逻辑 |
| tauri-commands | Tauri 命令入口，进程缓存 3s TTL |
| auth-storage | 账号存储与激活态管理，RwLock 内存缓存 + 写穿透 |
| auth-switcher | `~/.codex/auth.json` 读写与事务式切换 |
| usage-api | 配额查询与 warm-up |
| package-tooling | 依赖管理、构建脚本、CI (Windows only) |
