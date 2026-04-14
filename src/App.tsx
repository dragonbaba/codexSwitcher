import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccountCard,
  AddAccountModal,
  UpdateChecker,
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
      void checkProcesses();
    }, 3000);
    return () => window.clearInterval(interval);
  }, [checkProcesses]);

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

  const activeAccount = accounts.find((account) => account.is_active);
  const liveAccountId = workspaceAuth?.matched_account_id ?? null;
  const otherAccounts = accounts.filter((account) => !account.is_active);
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
      <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/15 font-semibold text-emerald-200">
              CS
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight text-white">Codex Account Switcher</h1>
                {processInfo && (
                  <span
                    className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.2em] ${
                      hasRunningProcesses
                        ? "border-amber-400/35 bg-amber-400/12 text-amber-100"
                        : "border-sky-400/35 bg-sky-400/12 text-sky-100"
                    }`}
                  >
                    {hasRunningProcesses
                      ? `检测到 ${processInfo.count} 个 Codex 进程`
                      : "未检测到 Codex 进程"}
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-400">
                用于管理 Codex 与 ChatGPT 登录态的多账号切换面板
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={toggleMaskAll}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-200 transition-colors hover:bg-white/10"
            >
              {allMasked ? "显示全部" : "隐藏全部"}
            </button>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-200 transition-colors hover:bg-white/10 disabled:opacity-50"
            >
              {isRefreshing ? "刷新中..." : "刷新全部"}
            </button>
            <button
              onClick={handleWarmupAll}
              disabled={isWarmingAll || accounts.length === 0}
              className="rounded-xl border border-amber-300/20 bg-amber-300/10 px-4 py-2.5 text-sm text-amber-100 transition-colors hover:bg-amber-300/15 disabled:opacity-50"
            >
              {isWarmingAll ? "预热中..." : "全部预热"}
            </button>

            <div className="relative" ref={actionsMenuRef}>
              <button
                onClick={() => setIsActionsMenuOpen((prev) => !prev)}
                className="rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-300"
              >
                账号操作 ▾
              </button>
              {isActionsMenuOpen && (
                <div className="absolute right-0 z-50 mt-2 w-60 rounded-2xl border border-white/10 bg-slate-900 p-2 shadow-2xl">
                  <button
                    onClick={() => openAddAccountModal("oauth")}
                    className="w-full rounded-xl px-3 py-2 text-left text-sm text-slate-200 transition-colors hover:bg-white/8"
                  >
                    + 添加账号
                  </button>
                  <button
                    onClick={() => openAddAccountModal("current")}
                    className="w-full rounded-xl px-3 py-2 text-left text-sm text-slate-200 transition-colors hover:bg-white/8"
                  >
                    导入当前 Auth
                  </button>
                  <button
                    onClick={() => {
                      setIsActionsMenuOpen(false);
                      void handleExportSlimText();
                    }}
                    disabled={isExportingSlim}
                    className="w-full rounded-xl px-3 py-2 text-left text-sm text-slate-200 transition-colors hover:bg-white/8 disabled:opacity-50"
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
                    className="w-full rounded-xl px-3 py-2 text-left text-sm text-slate-200 transition-colors hover:bg-white/8 disabled:opacity-50"
                  >
                    导入精简文本
                  </button>
                  <button
                    onClick={() => {
                      setIsActionsMenuOpen(false);
                      void handleExportFullFile();
                    }}
                    disabled={isExportingFull}
                    className="w-full rounded-xl px-3 py-2 text-left text-sm text-slate-200 transition-colors hover:bg-white/8 disabled:opacity-50"
                  >
                    {isExportingFull ? "导出中..." : "导出完整加密文件"}
                  </button>
                  <button
                    onClick={() => {
                      setIsActionsMenuOpen(false);
                      void handleImportFullFile();
                    }}
                    disabled={isImportingFull}
                    className="w-full rounded-xl px-3 py-2 text-left text-sm text-slate-200 transition-colors hover:bg-white/8 disabled:opacity-50"
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

          <UpdateChecker />

          {loading && accounts.length === 0 ? (
            <div className="rounded-[1.8rem] border border-white/10 bg-slate-900/60 px-6 py-16 text-center">
              <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
              <p className="text-slate-300">正在加载账号...</p>
            </div>
          ) : error ? (
            <div className="rounded-[1.8rem] border border-rose-400/20 bg-rose-400/8 px-6 py-16 text-center">
              <div className="mb-2 text-rose-200">加载账号失败</div>
              <p className="text-sm text-rose-100/80">{error}</p>
            </div>
          ) : accounts.length === 0 ? (
            <div className="rounded-[1.8rem] border border-white/10 bg-slate-900/55 px-6 py-16 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl border border-white/10 bg-white/5 text-3xl">
                👤
              </div>
              <h2 className="text-2xl font-semibold text-white">还没有托管账号</h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-400">
                添加你的第一个账号，或导入当前工作区 auth，即可在同一个面板中切换 GPT 账号。
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <button
                  onClick={() => openAddAccountModal("oauth")}
                  className="rounded-xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-300"
                >
                  添加账号
                </button>
                <button
                  onClick={() => openAddAccountModal("current")}
                  className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-slate-200 transition-colors hover:bg-white/10"
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
                      <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                        应用激活
                      </p>
                      <h2 className="mt-1 text-2xl font-semibold text-white">
                        {workspaceAuth?.active_matches_live
                          ? "当前激活账号与实时工作区一致。"
                          : "应用激活态与实时工作区存在差异。"}
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
                      <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                        待切换账号
                      </p>
                      <h2 className="mt-1 text-2xl font-semibold text-white">
                        对比剩余额度，并在校验后切换账号。
                      </h2>
                    </div>

                    <label className="flex items-center gap-3 text-sm text-slate-400">
                      <span>排序</span>
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
                        className="rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none"
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
          className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-2xl border px-4 py-3 text-sm shadow-2xl ${
            toast.isError
              ? "border-rose-400/25 bg-rose-600 text-white"
              : "border-emerald-400/20 bg-slate-950 text-emerald-100"
          }`}
        >
          {toast.message}
        </div>
      )}

      {deleteConfirmId && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-2xl border border-rose-400/25 bg-rose-600 px-4 py-3 text-sm text-white shadow-2xl">
          再点一次删除以确认移除。
        </div>
      )}

      <AddAccountModal
        isOpen={isAddModalOpen}
        initialTab={addModalTab}
        onClose={() => setIsAddModalOpen(false)}
        onImportFile={importFromFile}
        onImportCurrentAuth={handleCaptureCurrentAuth}
        onStartOAuth={startOAuthLogin}
        onCompleteOAuth={completeOAuthLogin}
        onCancelOAuth={cancelOAuthLogin}
      />

      {isConfigModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
          <div className="w-full max-w-2xl rounded-[1.8rem] border border-white/10 bg-slate-950 text-slate-100 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 p-5">
              <h2 className="text-lg font-semibold text-white">
                {configModalMode === "slim_export" ? "导出精简文本" : "导入精简文本"}
              </h2>
              <button
                onClick={() => setIsConfigModalOpen(false)}
                className="text-slate-400 transition-colors hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 p-5">
              {configModalMode === "slim_import" ? (
                <p className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
                  现有账号会被保留，仅导入缺失的账号。
                </p>
              ) : (
                <p className="text-sm text-slate-400">
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
                className="h-52 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 font-mono text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
              />

              {configModalError && (
                <div className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
                  {configModalError}
                </div>
              )}
            </div>

            <div className="flex gap-3 border-t border-white/10 p-5">
              <button
                onClick={() => setIsConfigModalOpen(false)}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-200 transition-colors hover:bg-white/10"
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
                  className="rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-300 disabled:opacity-50"
                >
                  {configCopied ? "已复制" : "复制字符串"}
                </button>
              ) : (
                <button
                  onClick={handleImportSlimText}
                  disabled={isImportingSlim}
                  className="rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-300 disabled:opacity-50"
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
