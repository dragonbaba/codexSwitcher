# 项目上下文

## 基本信息

- 仓库: `dragonbaba/codexSwitcher`（独立仓库，已与原上游 `Lampese/codex-switcher` 脱离关系）
- 本地路径: `D:/codexSwitcher`
- 当前版本: `0.4.0`
- 运行形态: Tauri 桌面应用 (Windows only)，同时提供浏览器仪表盘模式

## 技术上下文

- 前端: React 19 + TypeScript + Vite + Tailwind CSS 4
- 后端: Rust + Tauri 2 (tokio `rt-multi-thread,sync,time,macros`)
- 字体: Fira Sans (正文) + Fira Code (等宽)
- 前端包管理: bun
- 数据存储: `~/.codex-switcher/accounts.json` (内存缓存 + 写穿透)
- 实际切换目标: `~/.codex/auth.json`

## 项目概述

- 前端负责账号展示、导入、OAuth 登录、用量刷新、切换入口和工作区状态。
- Rust 后端负责账号持久化（内存缓存 + 磁盘）、`auth.json` 读写、OAuth 回调、Token 刷新、用量查询和进程检测（PowerShell + 3s TTL 缓存）。
- 切换采用"备份→写入→校验→失败回退"事务式流程。
- UI 采用深色仪表盘风格，绿色强调色 (#22C55E)，SVG 图标，无 emoji。

## 当前约束

- 仅构建 Windows x86_64 MSVC 目标。
- 账号切换必须以本机实际 `~/.codex/auth.json` 为准。
- 切换时要兼容运行中的 Codex 进程与 IDE 插件后台进程。
- 已完全移除 updater 更新检测机制，项目独立发布。

## 性能特征

- 进程检测: 3s TTL 缓存，避免冗余 PowerShell 启动。
- 账号存储: `std::sync::RwLock` 内存缓存，消除重复磁盘读取。
- 轮询: 进程检测 + 工作区状态合并为 5s 联合 tick。
- 前端: Vite 代码分割 (vendor + tauri chunks)，useMemo 避免无效渲染。
