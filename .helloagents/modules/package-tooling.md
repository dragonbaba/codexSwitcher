# package-tooling

## 职责

- 管理前端依赖安装、构建命令和 CI 配置。

## 行为规范

- 前端依赖管理器统一使用 `bun`。
- 项目对外品牌名为 `codex-account-switcher`。
- `package.json`、`tauri.conf.json`、README 和 GitHub Actions 保持一致。
- **已完全移除 Tauri updater 插件**：删除 `@tauri-apps/plugin-updater` (npm)、`tauri-plugin-updater` (Cargo)、updater 配置段、权限 `updater:default`、CI 签名密钥和 updater JSON 产物。
- **CI 仅构建 Windows x86_64**：移除 macOS/Linux 矩阵，单 `windows-latest` 任务。
- **Vite 代码分割**：vendor 分块 (React/ReactDOM) + tauri 分块 (Tauri 插件) + 应用主代码。
- **tokio features 精简**：`full` → `rt-multi-thread,sync,time,macros`。
- `bun.lock` 为唯一锁文件。

## 依赖关系

- 与 `frontend-app` 的构建流程直接相关。
- 与 `.github/workflows/build.yml` 和 `src-tauri/tauri.conf.json` 保持同步。
