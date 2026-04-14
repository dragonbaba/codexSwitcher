# account-hooks

## 职责

- 统一封装账号列表、用量刷新、切换、当前工作区状态和导入导出调用。
- 负责在切换、导入、OAuth 完成后同步刷新账号列表和 live auth 状态。

## 行为规范

- `switchAccount()` 返回结构化 `SwitchAccountResult`，而不是只返回成功/失败。
- 定时刷新用量信息，并单独轮询工作区 `auth.json` 状态以发现外部变更。
- 对命令失败只做最小吞吐，复杂展示逻辑交给上层 UI。
- usage 刷新完成后，应将最新 `usage.plan_type` 合并回前端账号状态，保证当前刷新周期内的套餐标签立即更新。

## 依赖关系

- 调用 `invokeBackend()` 与 Tauri/Web 后端通信。
- 为 `frontend-app` 提供组合后的状态与动作。
