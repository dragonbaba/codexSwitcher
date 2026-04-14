<p align="center">
  <img src="src-tauri/icons/logo.svg" alt="Codex Account Switcher" width="128" height="128">
</p>

<h1 align="center">Codex Account Switcher</h1>

<p align="center">
  面向 Windows 场景的 Codex CLI 多账号切换与管理工具<br>
  基于 <a href="https://github.com/Lampese/codex-switcher">Lampese/codex-switcher</a> 的独立扩展与修正版本
</p>

## 项目定位

`codex-account-switcher` 不是对上游仓库的简单镜像，也不是等待回合并的临时分支。

这个项目基于原始 `codex-switcher` 继续演进，主要做了下面几类增强：

- 补回并加强 Windows 场景下的可用性与构建链路
- 统一前端依赖管理到 `bun`
- 增强多账号管理、实时工作区状态识别、事务式切换校验与失败回退
- 修复套餐同步、进程检测显示、切换提示语义等一系列实际使用问题

如果你需要一个适合当前 Windows 环境继续维护和发布的版本，这个仓库就是面向该目标整理出来的独立版本。

## 功能特性

- **多账号管理**：在一个面板中管理多个 Codex / ChatGPT 登录账号
- **事务式切换**：切换前备份、写入后校验、失败时自动回退
- **实时工作区识别**：直接读取 `~/.codex/auth.json`，区分“应用激活账号”和“实时生效账号”
- **导入当前 Auth**：可把当前机器已经登录的 Codex 状态直接纳入托管
- **额度监控**：查看 5 小时窗口与周限额等 usage 信息
- **Windows 进程检测修复**：能正确识别当前运行中的 Codex CLI 进程，并分离“实际进程数量”和“是否阻断切换”的语义

## 构建环境

### 前置依赖

- [Node.js](https://nodejs.org/) 18+
- [Bun](https://bun.sh/)
- [Rust](https://rustup.rs/)

### 本地开发

```bash
# clone 你自己的新仓库
git clone <your-repo-url>
cd codex-account-switcher

# 安装依赖
bun install

# Tauri 开发模式
bun run tauri:dev
```

### 本地打包

```bash
# 本地构建，不生成 updater 签名产物
bun run tauri:build

# 正式签名构建（需配置签名环境变量）
bun run tauri:build:signed
```

打包产物位于 `src-tauri/target/release/bundle/`。

`bun run tauri:build` 默认会关闭 updater artifact 签名要求，适合本地开发机直接出包。只有在你已经配置：

- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`

时，才使用 `bun run tauri:build:signed`。

## 浏览器面板模式

如果你不想启动 Tauri 壳，也可以把前端面板以 HTTP 服务形式运行：

```bash
bun run lan
```

默认监听 `0.0.0.0:3210`。

可选环境变量：

- `CODEX_ACCOUNT_SWITCHER_WEB_HOST`
- `CODEX_ACCOUNT_SWITCHER_WEB_PORT`

兼容旧变量：

- `CODEX_SWITCHER_WEB_HOST`
- `CODEX_SWITCHER_WEB_PORT`

## 推荐使用流程

1. 启动应用后，先看“工作区状态”面板。
2. 如果当前机器登录态还没纳入托管，先使用“导入当前 Auth”。
3. 对比候选账号额度，再执行切换。
4. 切换后确认实时工作区账号是否已经指向目标账号。

## 切换安全性

- 每次切换都会在写入前读取当前 `~/.codex/auth.json`
- 写入前会备份原始 auth 文件
- 写入后会再次校验目标账号是否真的生效
- 若校验失败，会尽量自动回滚
- 界面会显式区分 **应用激活账号** 与 **实时工作区账号**

## 独立发布说明

本仓库已经去掉了默认指向上游仓库 release 的 updater 端点配置。  
如果你后续要把它作为一个新的公开仓库持续发布，需要自行配置：

- 新仓库的 GitHub Releases 地址
- 对应的 updater endpoint
- 新的签名私钥与发布流程

## 免责声明

本工具仅面向**个人自有的多个 OpenAI / ChatGPT 账号管理**场景。

不适用于：

- 多人共享同一批账号
- 账号池化或凭据共享
- 绕过平台限制或违反服务条款的用途

使用前请自行确认你的使用方式符合相关服务条款与账号归属要求。

## 版本同步

项目提供版本同步脚本，用来同时更新前端、Tauri 和 Cargo 版本号：

```bash
# 直接指定版本
bun run version:bump 0.1.7

# 语义化版本递增
bun run version:patch
bun run version:minor
bun run version:major
```
