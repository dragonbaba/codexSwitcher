# tauri-commands

## 职责

- 作为前端与 Rust 核心逻辑之间的命令边界。
- 暴露账号管理、工作区 auth 状态查询、事务式切换和导入当前 auth 等能力。

## 行为规范

- `switch_account` 现在返回结构化结果，包含切换前后工作区状态、备份信息和回退标记。
- `get_workspace_auth_state` 读取真实 `~/.codex/auth.json` 并和已存账号做指纹匹配。
- `check_codex_processes` 区分实际运行中的 Codex 进程数量（`count`）与真正需要阻止切换的进程数量（`blocking_count`），避免前端把“检测到进程”和“禁止切换”混为一谈。
- `add_current_auth_as_account` 允许将本机当前登录态快速纳入账号库。
- `get_usage` 链路会在检测到套餐变化时同步更新 `accounts.json` 中的 `plan_type`，并在活动账号上尽量刷新 token 以保持 `auth.json` 状态接近实时。

## 依赖关系

- 依赖 `auth-switcher` 提供 auth 文件读写、指纹、校验和回退能力。
- 依赖 `auth-storage` 管理 `accounts.json`。
