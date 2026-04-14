# auth-switcher

## 职责

- 负责 `~/.codex/auth.json` 的读取、写入、备份、恢复和验证。
- 将真实工作区 auth 状态映射为可供前端消费的结构化状态。

## 行为规范

- 切换前先创建 auth 备份；切换后必须读回验证目标账号是否真的写入成功。
- 若写入或校验失败，优先尝试自动回退到原始 auth 文件。
- 通过凭证指纹比对，将 live auth 与已存账号匹配为 `matched / unmatched / missing / invalid`。
- 当 usage 接口识别到 ChatGPT 套餐类型变化时，应将最新 `plan_type` 回写到本地账号元数据；若该账号正处于活动状态，优先刷新 token 并同步回 `auth.json`。

## 依赖关系

- 使用 `types.rs` 中的账号与工作区状态结构。
- 被 `tauri-commands` 调用，不直接暴露给前端。
