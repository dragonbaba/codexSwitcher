# 项目上下文

## 基本信息

- 仓库: `Lampese/codex-switcher`
- 本地路径: `D:/codexSwitcher`
- 当前版本: `0.1.7`
- 运行形态: Tauri 桌面应用，同时提供浏览器仪表盘模式

## 技术上下文

- 前端: React 19 + TypeScript + Vite + Tailwind CSS 4
- 后端: Rust + Tauri 2
- 前端包管理: bun
- 数据存储: `~/.codex-switcher/accounts.json`
- 实际切换目标: `~/.codex/auth.json`

## 项目概述

- 前端负责账号展示、导入、OAuth 登录、用量刷新、切换入口和基础状态提示。
- Rust 后端负责账号持久化、`auth.json` 解析与写入、OAuth 回调、Token 刷新、用量查询和进程检测。
- 当前切换逻辑已经可用，但以“直接写入目标文件”为主，缺少更强的切换事务性与运行态一致性反馈。

## 当前约束

- 账号切换必须以本机实际 `~/.codex/auth.json` 为准。
- 切换时要兼容运行中的 Codex 进程与 IDE 插件相关后台进程。
- 需要优先服务“个人拥有多个 GPT / ChatGPT 账号”的合法切换场景。

## 已知问题

- 已完成：当前工作区 `auth.json` 状态识别、应用内 active 与真实 live 区分展示。
- 已完成：切换流程的备份、写后校验与失败回退能力。
- 已完成：从当前机器已有 `auth.json` 直接导入账号的入口。
- 已完成：前端依赖管理从 `pnpm` 迁移到 `bun`。
