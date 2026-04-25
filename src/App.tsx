import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccountCard,
  AddAccountModal,
  WorkspaceStatusPanel,
} from "./components";
import { useAccounts } from "./hooks/useAccounts";
import { exportFullBackupFile, importFullBackupFile, invokeBackend } from "./lib/platform";
import type { CodexProcessInfo } from "./types";
import "./App.css";

type ModalTab = "oauth" | "import" | "current";

type ToastState = {
  message: string;
  isError?: boolean;
} | null;

function formatError(err: unknown): string {
  if (!err) return "未知错误";
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return "未知错误";
  }
}

function App() {
  const {
    accounts,
    loading,
    error,
    workspaceAuth,
    workspaceLoading,
    loadAccounts,
    loadWorkspaceAuthState,
    refreshUsage,
    refreshSingleUsage,
    warmupAccount,
    warmupAllAccounts,
    switchAccount,
    deleteAccount,
    renameAccount,
    importFromFile,
    addCurrentAuthAsAccount,
    exportAccountsSlimText,
    importAccountsSlimText,
    startOAuthLogin,
    completeOAuthLogin,
    cancelOAuthLogin,
    loadMaskedAccountIds,
    saveMaskedAccountIds,
  } = useAccounts();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addModalTab, setAddModalTab] = useState<ModalTab>("oauth");
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [configModalMode, setConfigModalMode] = useState<"slim_export" | "slim_import">(
    "slim_export"
  );
  const [configPayload, setConfigPayload] = useState("");
  const [configModalError, setConfigModalError] = useState<string | null>(null);
  const [configCopied, setConfigCopied] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [processInfo, setProcessInfo] = useState<CodexProcessInfo | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExportingSlim, setIsExportingSlim] = useState(false);
  const [isImportingSlim, setIsImportingSlim] = useState(false);
  const [isExportingFull, setIsExportingFull] = useState(false);
  const [isImportingFull, setIsImportingFull] = useState(false);
  const [isWarmingAll, setIsWarmingAll] = useState(false);
  const [warmingUpId, setWarmingUpId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [maskedAccounts, setMaskedAccounts] = useState<Set<string>>(new Set());
  const [otherAccountsSort, setOtherAccountsSort] = useState<
    "deadline_asc" | "deadline_desc" | "remaining_desc" | "remaining_asc"
  >("deadline_asc");
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
  const actionsMenuRef = useRef<HTMLDivElement | null>(null);

  const showToast = useCallback((message: string, isError = false) => {
    setToast({ message, isError });
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  const openAddAccountModal = useCallback((tab: ModalTab) => {
    setAddModalTab(tab);
    setIsAddModalOpen(true);
    setIsActionsMenuOpen(false);
  }, []);

  const toggleMask = (accountId: string) => {
    setMaskedAccounts((prev) => {
      const next = new Set(prev);
      if (next.has(accountId)) {
        next.delete(accountId);
      } else {
        next.add(accountId);
      }
      void saveMaskedAccountIds(Array.from(next));
      return next;
    });
  };

  const allMasked =
    accounts.length > 0 && accounts.every((account) => maskedAccounts.has(account.id));

  const toggleMaskAll = () => {
    setMaskedAccounts((prev) => {
      const shouldMaskAll = !accounts.every((account) => prev.has(account.id));
      const next = shouldMaskAll
        ? new Set(accounts.map((account) => account.id))
        : new Set<string>();
      void saveMaskedAccountIds(Array.from(next));
      return next;
    });
  };

  const checkProcesses = useCallback(async () => {
    try {
      const info = await invokeBackend<CodexProcessInfo>("check_codex_processes");
      setProcessInfo(info);
      return info;
    } catch (err) {
      console.error("Failed to check processes:", err);
      return null;
    }
  }, []);

  useEffect(() => {
    void checkProcesses();
    const interval = window.setInterval(() => {
      void Promise.all([checkProcesses(), loadWorkspaceAuthState()]);
    }, 5000);
    return () => window.clearInterval(interval);
  }, [checkProcesses, loadWorkspaceAuthState]);

  useEffect(() => {
    loadMaskedAccountIds().then((ids) => {
      if (ids.length > 0) {
        setMaskedAccounts(new Set(ids));
      }
    });
  }, [loadMaskedAccountIds]);

  useEffect(() => {
    if (!isActionsMenuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (!actionsMenuRef.current) return;
      if (!actionsMenuRef.current.contains(event.target as Node)) {
        setIsActionsMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isActionsMenuOpen]);

  const handleSwitch = async (accountId: string) => {
    const latestProcessInfo = await checkProcesses();
    if (latestProcessInfo && !latestProcessInfo.can_switch) {
      showToast("切换账号前，请先关闭正在运行的 Codex 进程。", true);
      return;
    }

    try {
      setSwitchingId(accountId);
      const result = await switchAccount(accountId);
      await checkProcesses();
      if (result.success) {
        showToast(
          `已切换到 ${result.target_account_name}${result.backup_created ? "，并完成备份校验" : ""}。`
        );
      } else {
        showToast(
          result.error ??
            `切换到 ${result.target_account_name}失败${result.rolled_back ? "，并已回滚" : ""}。`,
          true
        );
      }
    } catch (err) {
      console.error("Failed to switch account:", err);
      showToast(`切换失败：${formatError(err)}`, true);
    } finally {
      setSwitchingId(null);
    }
  };

  const handleDelete = async (accountId: string) => {
    if (deleteConfirmId !== accountId) {
      setDeleteConfirmId(accountId);
      window.setTimeout(() => setDeleteConfirmId(null), 3000);
      return;
    }

    try {
      await deleteAccount(accountId);
      showToast("账号已删除。");
      setDeleteConfirmId(null);
    } catch (err) {
      console.error("Failed to delete account:", err);
      showToast(`删除失败：${formatError(err)}`, true);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refreshUsage(), loadWorkspaceAuthState(), checkProcesses()]);
      showToast("额度与工作区状态已刷新。");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleWarmupAccount = async (accountId: string, accountName: string) => {
    try {
      setWarmingUpId(accountId);
      await warmupAccount(accountId);
      showToast(`已为 ${accountName} 发送预热请求。`);
    } catch (err) {
      console.error("Failed to warm up account:", err);
      showToast(`${accountName} 预热失败：${formatError(err)}`, true);
    } finally {
      setWarmingUpId(null);
    }
  };

  const handleWarmupAll = async () => {
    try {
      setIsWarmingAll(true);
      const summary = await warmupAllAccounts();
      if (summary.total_accounts === 0) {
        showToast("当前没有可预热的账号。", true);
        return;
      }

      if (summary.failed_account_ids.length === 0) {
        showToast(`已为全部 ${summary.warmed_accounts} 个账号发送预热请求。`);
      } else {
        showToast(
          `已预热 ${summary.warmed_accounts}/${summary.total_accounts} 个，失败 ${summary.failed_account_ids.length} 个。`,
          true
        );
      }
    } catch (err) {
      console.error("Failed to warm up all accounts:", err);
      showToast(`批量预热失败：${formatError(err)}`, true);
    } finally {
      setIsWarmingAll(false);
    }
  };

  const handleCaptureCurrentAuth = async (name: string) => {
    try {
      await addCurrentAuthAsAccount(name);
      showToast(`已将当前工作区 auth 导入为 ${name}。`);
    } catch (err) {
      showToast(`导入当前 auth 失败：${formatError(err)}`, true);
      throw err;
    }
  };

  const handleExportSlimText = async () => {
    setConfigModalMode("slim_export");
    setConfigModalError(null);
    setConfigPayload("");
    setConfigCopied(false);
    setIsConfigModalOpen(true);

    try {
      setIsExportingSlim(true);
      const payload = await exportAccountsSlimText();
      setConfigPayload(payload);
    } catch (err) {
      console.error("Failed to export slim text:", err);
      setConfigModalError(formatError(err));
      showToast("精简文本导出失败。", true);
    } finally {
      setIsExportingSlim(false);
    }
  };

  const handleImportSlimText = async () => {
    if (!configPayload.trim()) {
      setConfigModalError("请先粘贴精简文本。");
      return;
    }

    try {
      setIsImportingSlim(true);
      setConfigModalError(null);
      const summary = await importAccountsSlimText(configPayload);
      setMaskedAccounts(new Set());
      setIsConfigModalOpen(false);
      showToast(
        `已导入 ${summary.imported_count} 个，跳过 ${summary.skipped_count} 个（总计 ${summary.total_in_payload} 个）。`
      );
    } catch (err) {
      console.error("Failed to import slim text:", err);
      setConfigModalError(formatError(err));
      showToast("精简文本导入失败。", true);
    } finally {
      setIsImportingSlim(false);
    }
  };

  const handleExportFullFile = async () => {
    try {
      setIsExportingFull(true);
      const exported = await exportFullBackupFile();
      if (!exported) return;
      showToast("完整加密文件已导出。");
    } catch (err) {
      console.error("Failed to export full encrypted file:", err);
      showToast("完整文件导出失败。", true);
    } finally {
      setIsExportingFull(false);
    }
  };

  const handleImportFullFile = async () => {
    try {
      setIsImportingFull(true);
      const summary = await importFullBackupFile();
      if (!summary) return;
      const accountList = await loadAccounts();
      await Promise.all([refreshUsage(accountList), loadWorkspaceAuthState()]);
      const maskedIds = await loadMaskedAccountIds();
      setMaskedAccounts(new Set(maskedIds));
      showToast(
        `已导入 ${summary.imported_count} 个，跳过 ${summary.skipped_count} 个（总计 ${summary.total_in_payload} 个）。`
      );
    } catch (err) {
      console.error("Failed to import full encrypted file:", err);
      showToast("完整文件导入失败。", true);
    } finally {
      setIsImportingFull(false);
    }
  };

  const activeAccount = useMemo(
    () => accounts.find((account) => account.is_active),
    [accounts]
  );
  const liveAccountId = workspaceAuth?.matched_account_id ?? null;
  const otherAccounts = useMemo(
    () => accounts.filter((account) => !account.is_active),
    [accounts]
  );
  const hasRunningProcesses = Boolean(processInfo && processInfo.count > 0);
  const hasBlockingProcesses = Boolean(processInfo && processInfo.blocking_count > 0);

  const sortedOtherAccounts = useMemo(() => {
    const getResetDeadline = (resetAt: number | null | undefined) =>
      resetAt ?? Number.POSITIVE_INFINITY;

    const getRemainingPercent = (usedPercent: number | null | undefined) => {
      if (usedPercent === null || usedPercent === undefined) {
        return Number.NEGATIVE_INFINITY;
      }
      return Math.max(0, 100 - usedPercent);
    };

    return [...otherAccounts].sort((a, b) => {
      if (otherAccountsSort === "deadline_asc" || otherAccountsSort === "deadline_desc") {
        const deadlineDiff =
          getResetDeadline(a.usage?.primary_resets_at) -
          getResetDeadline(b.usage?.primary_resets_at);
        if (deadlineDiff !== 0) {
          return otherAccountsSort === "deadline_asc" ? deadlineDiff : -deadlineDiff;
        }
      }

      const remainingDiff =
        getRemainingPercent(b.usage?.primary_used_percent) -
        getRemainingPercent(a.usage?.primary_used_percent);

      if (otherAccountsSort === "remaining_desc" && remainingDiff !== 0) {
        return remainingDiff;
      }
      if (otherAccountsSort === "remaining_asc" && remainingDiff !== 0) {
        return -remainingDiff;
      }

      const fallbackDeadlineDiff =
        getResetDeadline(a.usage?.primary_resets_at) -
        getResetDeadline(b.usage?.primary_resets_at);
      if (fallbackDeadlineDiff !== 0) return fallbackDeadlineDiff;
      return a.name.localeCompare(b.name);
    });
  }, [otherAccounts, otherAccountsSort]);

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#0b1121]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-green-500/25 bg-green-500/12">
              <svg className="h-6 w-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-semibold tracking-tight text-slate-50">Codex Account Switcher</h1>
                {processInfo && (
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.15em] ${
                      hasRunningProcesses
                        ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
                        : "border-green-500/30 bg-green-500/10 text-green-200"
                    }`}
                  >
                    {hasRunningProcesses
                      ? `${processInfo.count} Codex`
                      : "空闲"}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                多账号切换面板
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={toggleMaskAll}
              className="rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-2 text-sm font-medium text-slate-300 transition-all duration-200 hover:border-slate-600 hover:bg-slate-700/80 hover:text-slate-100 cursor-pointer"
            >
              {allMasked ? "显示全部" : "隐藏全部"}
            </button>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-2 text-sm font-medium text-slate-300 transition-all duration-200 hover:border-slate-600 hover:bg-slate-700/80 hover:text-slate-100 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className={`inline-flex items-center gap-1.5 ${isRefreshing ? "animate-spin" : ""}`}>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {isRefreshing ? "刷新中..." : "刷新全部"}
              </span>
            </button>
            <button
              onClick={handleWarmupAll}
              disabled={isWarmingAll || accounts.length === 0}
              className="rounded-xl border border-amber-600/25 bg-amber-500/8 px-4 py-2 text-sm font-medium text-amber-200 transition-all duration-200 hover:border-amber-500/35 hover:bg-amber-500/12 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isWarmingAll ? "预热中..." : "全部预热"}
            </button>

            <div className="relative" ref={actionsMenuRef}>
              <button
                onClick={() => setIsActionsMenuOpen((prev) => !prev)}
                className="rounded-xl bg-green-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-all duration-200 hover:bg-green-400 cursor-pointer"
              >
                账号操作 ▾
              </button>
              {isActionsMenuOpen && (
                <div className="absolute right-0 z-50 mt-2 w-56 rounded-2xl border border-slate-700/80 bg-slate-900 p-1.5 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
                  <button
                    onClick={() => openAddAccountModal("oauth")}
                    className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-200 transition-all duration-150 hover:bg-slate-800 cursor-pointer"
                  >
                    添加账号
                  </button>
                  <button
                    onClick={() => openAddAccountModal("current")}
                    className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-200 transition-all duration-150 hover:bg-slate-800 cursor-pointer"
                  >
                    导入当前 Auth
                  </button>
                  <button
                    onClick={() => {
                      setIsActionsMenuOpen(false);
                      void handleExportSlimText();
                    }}
                    disabled={isExportingSlim}
                    className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-200 transition-all duration-150 hover:bg-slate-800 cursor-pointer disabled:opacity-50"
                  >
                    {isExportingSlim ? "导出中..." : "导出精简文本"}
                  </button>
                  <button
                    onClick={() => {
                      setIsActionsMenuOpen(false);
                      setConfigModalMode("slim_import");
                      setConfigModalError(null);
                      setConfigPayload("");
                      setConfigCopied(false);
                      setIsConfigModalOpen(true);
                    }}
                    disabled={isImportingSlim}
                    className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-200 transition-all duration-150 hover:bg-slate-800 cursor-pointer disabled:opacity-50"
                  >
                    导入精简文本
                  </button>
                  <button
                    onClick={() => {
                      setIsActionsMenuOpen(false);
                      void handleExportFullFile();
                    }}
                    disabled={isExportingFull}
                    className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-200 transition-all duration-150 hover:bg-slate-800 cursor-pointer disabled:opacity-50"
                  >
                    {isExportingFull ? "导出中..." : "导出完整加密文件"}
                  </button>
                  <button
                    onClick={() => {
                      setIsActionsMenuOpen(false);
                      void handleImportFullFile();
                    }}
                    disabled={isImportingFull}
                    className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-200 transition-all duration-150 hover:bg-slate-800 cursor-pointer disabled:opacity-50"
                  >
                    {isImportingFull ? "导入中..." : "导入完整加密文件"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="space-y-8">
          <WorkspaceStatusPanel
            workspaceAuth={workspaceAuth}
            workspaceLoading={workspaceLoading}
            processInfo={processInfo}
            onRefresh={() => {
              void Promise.all([loadWorkspaceAuthState(), checkProcesses()]);
            }}
            onCaptureCurrent={() => openAddAccountModal("current")}
          />

          {loading && accounts.length === 0 ? (
            <div className="rounded-[1.8rem] border border-slate-800 bg-slate-900/50 px-6 py-16 text-center">
              <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-green-500 border-t-transparent" />
              <p className="text-slate-400">正在加载账号...</p>
            </div>
          ) : error ? (
            <div className="rounded-[1.8rem] border border-red-500/20 bg-red-500/5 px-6 py-16 text-center">
              <div className="mb-2 text-red-300">加载账号失败</div>
              <p className="text-sm text-red-200/80">{error}</p>
            </div>
          ) : accounts.length === 0 ? (
            <div className="rounded-[1.8rem] border border-slate-800 bg-slate-900/50 px-6 py-16 text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl border border-slate-700 bg-slate-800/60">
                <svg className="h-8 w-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-slate-100">还没有托管账号</h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-500">
                添加你的第一个账号，或导入当前工作区 auth，即可在同一个面板中切换 GPT 账号。
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <button
                  onClick={() => openAddAccountModal("oauth")}
                  className="rounded-xl bg-green-500 px-5 py-3 text-sm font-semibold text-slate-950 transition-all duration-200 hover:bg-green-400 cursor-pointer"
                >
                  添加账号
                </button>
                <button
                  onClick={() => openAddAccountModal("current")}
                  className="rounded-xl border border-slate-700 bg-slate-800/60 px-5 py-3 text-sm font-medium text-slate-200 transition-all duration-200 hover:border-slate-600 hover:bg-slate-700/80 cursor-pointer"
                >
                  导入当前 Auth
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {activeAccount && (
                <section>
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500">
                        当前激活
                      </p>
                      <h2 className="mt-1 text-lg font-semibold text-slate-200">
                        {workspaceAuth?.active_matches_live
                          ? "激活账号与实时工作区一致"
                          : "激活态与实时工作区存在差异"}
                      </h2>
                    </div>
                  </div>
                  <AccountCard
                    account={activeAccount}
                    isLive={liveAccountId === activeAccount.id}
                    onSwitch={() => undefined}
                    onWarmup={() => handleWarmupAccount(activeAccount.id, activeAccount.name)}
                    onDelete={() => handleDelete(activeAccount.id)}
                    onRefresh={() => refreshSingleUsage(activeAccount.id)}
                    onRename={(newName) => renameAccount(activeAccount.id, newName)}
                    switching={switchingId === activeAccount.id}
                    switchDisabled={hasBlockingProcesses}
                    warmingUp={isWarmingAll || warmingUpId === activeAccount.id}
                    masked={maskedAccounts.has(activeAccount.id)}
                    onToggleMask={() => toggleMask(activeAccount.id)}
                  />
                </section>
              )}

              {otherAccounts.length > 0 && (
                <section>
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500">
                        待切换账号
                      </p>
                      <h2 className="mt-1 text-lg font-semibold text-slate-200">
                        对比剩余额度，在校验后切换账号
                      </h2>
                    </div>

                    <label className="flex items-center gap-2.5 text-sm text-slate-400">
                      <span className="text-xs text-slate-500">排序</span>
                      <select
                        value={otherAccountsSort}
                        onChange={(event) =>
                          setOtherAccountsSort(
                            event.target.value as
                              | "deadline_asc"
                              | "deadline_desc"
                              | "remaining_desc"
                              | "remaining_asc"
                          )
                        }
                        className="rounded-xl border border-slate-700 bg-slate-800/70 px-3 py-2 text-sm text-slate-200 focus:border-green-500 focus:outline-none cursor-pointer"
                      >
                        <option value="deadline_asc">重置时间：从早到晚</option>
                        <option value="deadline_desc">重置时间：从晚到早</option>
                        <option value="remaining_desc">剩余额度：从高到低</option>
                        <option value="remaining_asc">剩余额度：从低到高</option>
                      </select>
                    </label>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    {sortedOtherAccounts.map((account) => (
                      <AccountCard
                        key={account.id}
                        account={account}
                        isLive={liveAccountId === account.id}
                        onSwitch={() => {
                          void handleSwitch(account.id);
                        }}
                        onWarmup={() => handleWarmupAccount(account.id, account.name)}
                        onDelete={() => handleDelete(account.id)}
                        onRefresh={() => refreshSingleUsage(account.id)}
                        onRename={(newName) => renameAccount(account.id, newName)}
                        switching={switchingId === account.id}
                        switchDisabled={hasBlockingProcesses}
                        warmingUp={isWarmingAll || warmingUpId === account.id}
                        masked={maskedAccounts.has(account.id)}
                        onToggleMask={() => toggleMask(account.id)}
                      />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </main>

      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-2xl border px-5 py-3 text-sm font-medium shadow-[0_20px_60px_rgba(0,0,0,0.5)] transition-all duration-300 ${
            toast.isError
              ? "border-red-500/30 bg-red-600/95 text-white"
              : "border-green-500/30 bg-slate-900/95 text-green-100"
          }`}
        >
          {toast.message}
        </div>
      )}

      {deleteConfirmId && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-2xl border border-red-500/30 bg-red-600/95 px-5 py-3 text-sm font-medium text-white shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
          再点一次删除以确认移除。
        </div>
      )}

      {isAddModalOpen && (
        <AddAccountModal
          key={`add-account-${addModalTab}-${Date.now()}`}
          isOpen={isAddModalOpen}
          initialTab={addModalTab}
          onClose={() => setIsAddModalOpen(false)}
          onImportFile={importFromFile}
          onImportCurrentAuth={handleCaptureCurrentAuth}
          onStartOAuth={startOAuthLogin}
          onCompleteOAuth={completeOAuthLogin}
          onCancelOAuth={cancelOAuthLogin}
        />
      )}

      {isConfigModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 text-slate-100 shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
            <div className="flex items-center justify-between border-b border-slate-800 p-5">
              <h2 className="text-lg font-semibold text-slate-100">
                {configModalMode === "slim_export" ? "导出精简文本" : "导入精简文本"}
              </h2>
              <button
                onClick={() => setIsConfigModalOpen(false)}
                className="text-slate-500 hover:text-slate-200 transition-colors cursor-pointer p-1 rounded-lg hover:bg-slate-800"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4 p-5">
              {configModalMode === "slim_import" ? (
                <p className="rounded-xl border border-amber-500/20 bg-amber-500/8 px-3 py-2 text-sm text-amber-200">
                  现有账号会被保留，仅导入缺失的账号。
                </p>
              ) : (
                <p className="text-sm text-slate-500">
                  这段精简文本包含账号密钥，请妥善保管。
                </p>
              )}

              <textarea
                value={configPayload}
                onChange={(event) => setConfigPayload(event.target.value)}
                readOnly={configModalMode === "slim_export"}
                placeholder={
                  configModalMode === "slim_export"
                    ? isExportingSlim
                      ? "生成中..."
                      : "导出的字符串会显示在这里"
                    : "请在这里粘贴配置字符串"
                }
                className="h-52 w-full rounded-2xl border border-slate-700 bg-slate-800/50 px-4 py-3 font-mono text-sm text-slate-100 placeholder:text-slate-500 focus:border-green-500 focus:outline-none"
              />

              {configModalError && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/8 px-3 py-2 text-sm text-red-200">
                  {configModalError}
                </div>
              )}
            </div>

            <div className="flex gap-3 border-t border-slate-800 p-5">
              <button
                onClick={() => setIsConfigModalOpen(false)}
                className="rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-2.5 text-sm font-medium text-slate-300 transition-all duration-200 hover:border-slate-600 hover:bg-slate-700/80 cursor-pointer"
              >
                关闭
              </button>

              {configModalMode === "slim_export" ? (
                <button
                  onClick={async () => {
                    if (!configPayload) return;
                    try {
                      await navigator.clipboard.writeText(configPayload);
                      setConfigCopied(true);
                      window.setTimeout(() => setConfigCopied(false), 1500);
                    } catch {
                      setConfigModalError("剪贴板不可用，请手动复制。");
                    }
                  }}
                  disabled={!configPayload || isExportingSlim}
                  className="rounded-xl bg-green-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-all duration-200 hover:bg-green-400 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {configCopied ? "已复制" : "复制字符串"}
                </button>
              ) : (
                <button
                  onClick={handleImportSlimText}
                  disabled={isImportingSlim}
                  className="rounded-xl bg-green-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-all duration-200 hover:bg-green-400 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isImportingSlim ? "导入中..." : "导入缺失账号"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
