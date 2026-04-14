# package-tooling

## 职责

- 管理前端依赖安装、构建命令和 CI 中的 Node 侧工具链。

## 行为规范

- 仓库当前统一使用 `bun` 作为前端依赖管理器。
- 仓库当前对外品牌名为 `codex-account-switcher`，README、包名、Tauri 产品名和版本脚本需要保持一致。
- `package.json`、`tauri.conf.json`、README 和 GitHub Actions 中的前端命令保持一致。
- 独立仓库版本不再默认指向上游仓库的 updater/release 地址，发布端点需要由新仓库单独配置。
- `pnpm-lock.yaml` 不再作为主锁文件，锁文件以 `bun.lock` 为准。

## 依赖关系

- 与 `frontend-app` 的构建流程直接相关。
- 与 `.github/workflows/build.yml` 和 `src-tauri/tauri.conf.json` 保持同步。
