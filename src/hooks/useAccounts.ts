import { useState, useEffect, useCallback, useRef } from "react";
import type {
  AccountInfo,
  AccountWithUsage,
  ImportAccountsSummary,
  OAuthLoginInfo,
  SwitchAccountResult,
  UsageInfo,
  WarmupSummary,
  WorkspaceAuthState,
} from "../types";
import { invokeBackend, type FileSource } from "../lib/platform";

export function useAccounts() {
  const [accounts, setAccounts] = useState<AccountWithUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workspaceAuth, setWorkspaceAuth] = useState<WorkspaceAuthState | null>(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(true);
  const accountsRef = useRef<AccountWithUsage[]>([]);
  const maxConcurrentUsageRequests = 10;

  useEffect(() => {
    accountsRef.current = accounts;
  }, [accounts]);

  const buildUsageError = useCallback(
    (accountId: string, message: string, planType: string | null): UsageInfo => ({
      account_id: accountId,
      plan_type: planType,
      primary_used_percent: null,
      primary_window_minutes: null,
      primary_resets_at: null,
      secondary_used_percent: null,
      secondary_window_minutes: null,
      secondary_resets_at: null,
      has_credits: null,
      unlimited_credits: null,
      credits_balance: null,
      error: message,
    }),
    []
  );

  const runWithConcurrency = useCallback(
    async <T,>(
      items: T[],
      worker: (item: T) => Promise<void>,
      concurrency: number
    ) => {
      if (items.length === 0) return;

      const limit = Math.min(Math.max(concurrency, 1), items.length);
      let index = 0;
      const runners = Array.from({ length: limit }, async () => {
        while (true) {
          const current = index++;
          if (current >= items.length) return;
          await worker(items[current]);
        }
      });

      await Promise.allSettled(runners);
    },
    []
  );

  const loadWorkspaceAuthState = useCallback(async () => {
    try {
      setWorkspaceLoading(true);
      const state = await invokeBackend<WorkspaceAuthState>("get_workspace_auth_state");
      setWorkspaceAuth(state);
      return state;
    } catch (err) {
      console.error("Failed to load workspace auth state:", err);
      return null;
    } finally {
      setWorkspaceLoading(false);
    }
  }, []);

  const loadAccounts = useCallback(async (preserveUsage = false) => {
    try {
      setLoading(true);
      setError(null);
      const accountList = await invokeBackend<AccountInfo[]>("list_accounts");

      if (preserveUsage) {
        setAccounts((prev) => {
          const usageMap = new Map(
            prev.map((account) => [
              account.id,
              { usage: account.usage, usageLoading: account.usageLoading },
            ])
          );

          return accountList.map((account) => ({
            ...account,
            usage: usageMap.get(account.id)?.usage,
            usageLoading: usageMap.get(account.id)?.usageLoading,
          }));
        });
      } else {
        setAccounts(accountList.map((account) => ({ ...account, usageLoading: false })));
      }

      return accountList;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshUsage = useCallback(
    async (accountList?: AccountInfo[] | AccountWithUsage[]) => {
      try {
        const list = accountList ?? accountsRef.current;
        if (list.length === 0) return;

        const accountIds = list.map((account) => account.id);
        const accountIdSet = new Set(accountIds);

        setAccounts((prev) =>
          prev.map((account) =>
            accountIdSet.has(account.id) ? { ...account, usageLoading: true } : account
          )
        );

        await runWithConcurrency(
          accountIds,
          async (accountId) => {
            try {
              const usage = await invokeBackend<UsageInfo>("get_usage", { accountId });
              setAccounts((prev) =>
                prev.map((account) =>
                  account.id === accountId
                    ? {
                        ...account,
                        usage,
                        usageLoading: false,
                        plan_type: usage.plan_type ?? account.plan_type,
                      }
                    : account
                )
              );
            } catch (err) {
              console.error("Failed to refresh usage:", err);
              const message = err instanceof Error ? err.message : String(err);
              setAccounts((prev) =>
                prev.map((account) =>
                  account.id === accountId
                    ? {
                        ...account,
                        usage: buildUsageError(accountId, message, account.plan_type ?? null),
                        usageLoading: false,
                      }
                    : account
                )
              );
            }
          },
          maxConcurrentUsageRequests
        );
      } catch (err) {
        console.error("Failed to refresh usage:", err);
        throw err;
      }
    },
    [buildUsageError, runWithConcurrency]
  );

  const refreshSingleUsage = useCallback(
    async (accountId: string) => {
      try {
        setAccounts((prev) =>
          prev.map((account) =>
            account.id === accountId ? { ...account, usageLoading: true } : account
          )
        );

        const usage = await invokeBackend<UsageInfo>("get_usage", { accountId });
        setAccounts((prev) =>
          prev.map((account) =>
            account.id === accountId
              ? {
                  ...account,
                  usage,
                  usageLoading: false,
                  plan_type: usage.plan_type ?? account.plan_type,
                }
              : account
          )
        );
      } catch (err) {
        console.error("Failed to refresh single usage:", err);
        const message = err instanceof Error ? err.message : String(err);
        setAccounts((prev) =>
          prev.map((account) =>
            account.id === accountId
              ? {
                  ...account,
                  usage: buildUsageError(accountId, message, account.plan_type ?? null),
                  usageLoading: false,
                }
              : account
          )
        );
        throw err;
      }
    },
    [buildUsageError]
  );

  const switchAccount = useCallback(
    async (accountId: string) => {
      const result = await invokeBackend<SwitchAccountResult>("switch_account", { accountId });
      await Promise.all([loadAccounts(true), loadWorkspaceAuthState()]);
      return result;
    },
    [loadAccounts, loadWorkspaceAuthState]
  );

  const deleteAccount = useCallback(
    async (accountId: string) => {
      await invokeBackend("delete_account", { accountId });
      await Promise.all([loadAccounts(), loadWorkspaceAuthState()]);
    },
    [loadAccounts, loadWorkspaceAuthState]
  );

  const renameAccount = useCallback(
    async (accountId: string, newName: string) => {
      await invokeBackend("rename_account", { accountId, newName });
      await loadAccounts(true);
    },
    [loadAccounts]
  );

  const importFromFile = useCallback(
    async (source: FileSource, name: string) => {
      if (typeof source === "string") {
        await invokeBackend<AccountInfo>("add_account_from_file", { path: source, name });
      } else {
        const contents = await source.text();
        await invokeBackend<AccountInfo>("add_account_from_auth_json_text", { name, contents });
      }

      const accountList = await loadAccounts();
      await Promise.all([refreshUsage(accountList), loadWorkspaceAuthState()]);
    },
    [loadAccounts, loadWorkspaceAuthState, refreshUsage]
  );

  const addCurrentAuthAsAccount = useCallback(
    async (name: string) => {
      await invokeBackend<AccountInfo>("add_current_auth_as_account", { name });
      const accountList = await loadAccounts();
      await Promise.all([refreshUsage(accountList), loadWorkspaceAuthState()]);
    },
    [loadAccounts, loadWorkspaceAuthState, refreshUsage]
  );

  const warmupAccount = useCallback(async (accountId: string) => {
    return invokeBackend<void>("warmup_account", { accountId });
  }, []);

  const warmupAllAccounts = useCallback(async () => {
    return invokeBackend<WarmupSummary>("warmup_all_accounts");
  }, []);

  const startOAuthLogin = useCallback(async (accountName: string) => {
    return invokeBackend<OAuthLoginInfo>("start_login", { accountName });
  }, []);

  const completeOAuthLogin = useCallback(async () => {
    const account = await invokeBackend<AccountInfo>("complete_login");
    const accountList = await loadAccounts();
    await Promise.all([refreshUsage(accountList), loadWorkspaceAuthState()]);
    return account;
  }, [loadAccounts, loadWorkspaceAuthState, refreshUsage]);

  const cancelOAuthLogin = useCallback(async () => {
    try {
      await invokeBackend("cancel_login");
    } catch (err) {
      console.error("Failed to cancel login:", err);
    }
  }, []);

  const exportAccountsSlimText = useCallback(async () => {
    return invokeBackend<string>("export_accounts_slim_text");
  }, []);

  const importAccountsSlimText = useCallback(
    async (payload: string) => {
      const summary = await invokeBackend<ImportAccountsSummary>("import_accounts_slim_text", {
        payload,
      });
      const accountList = await loadAccounts();
      await Promise.all([refreshUsage(accountList), loadWorkspaceAuthState()]);
      return summary;
    },
    [loadAccounts, loadWorkspaceAuthState, refreshUsage]
  );

  const exportAccountsFullEncryptedFile = useCallback(async (path: string) => {
    await invokeBackend("export_accounts_full_encrypted_file", { path });
  }, []);

  const importAccountsFullEncryptedFile = useCallback(
    async (path: string) => {
      const summary = await invokeBackend<ImportAccountsSummary>(
        "import_accounts_full_encrypted_file",
        { path }
      );
      const accountList = await loadAccounts();
      await Promise.all([refreshUsage(accountList), loadWorkspaceAuthState()]);
      return summary;
    },
    [loadAccounts, loadWorkspaceAuthState, refreshUsage]
  );

  const loadMaskedAccountIds = useCallback(async () => {
    try {
      return await invokeBackend<string[]>("get_masked_account_ids");
    } catch (err) {
      console.error("Failed to load masked account IDs:", err);
      return [];
    }
  }, []);

  const saveMaskedAccountIds = useCallback(async (ids: string[]) => {
    try {
      await invokeBackend("set_masked_account_ids", { ids });
    } catch (err) {
      console.error("Failed to save masked account IDs:", err);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const initialLoad = async () => {
      const accountList = await loadAccounts();
      await Promise.all([refreshUsage(accountList), loadWorkspaceAuthState()]);
      if (!cancelled) {
        setLoading(false);
      }
    };

    void initialLoad();

    const usageInterval = window.setInterval(() => {
      void refreshUsage().catch(() => {});
    }, 60000);

    return () => {
      cancelled = true;
      window.clearInterval(usageInterval);
    };
  }, [loadAccounts, loadWorkspaceAuthState, refreshUsage]);

  return {
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
    exportAccountsFullEncryptedFile,
    importAccountsFullEncryptedFile,
    startOAuthLogin,
    completeOAuthLogin,
    cancelOAuthLogin,
    loadMaskedAccountIds,
    saveMaskedAccountIds,
  };
}
