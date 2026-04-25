import { useEffect, useRef, useState } from "react";
import type { AccountWithUsage } from "../types";
import { UsageBar } from "./UsageBar";

interface AccountCardProps {
  account: AccountWithUsage;
  onSwitch: () => void;
  onWarmup: () => Promise<void>;
  onDelete: () => void;
  onRefresh: () => Promise<void>;
  onRename: (newName: string) => Promise<void>;
  switching?: boolean;
  switchDisabled?: boolean;
  warmingUp?: boolean;
  masked?: boolean;
  isLive?: boolean;
  onToggleMask?: () => void;
}

function formatLastRefresh(date: Date | null): string {
  if (!date) return "从未";
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 5) return "刚刚";
  if (diff < 60) return `${diff} 秒前`;
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  return date.toLocaleDateString();
}

function BlurredText({ children, blur }: { children: React.ReactNode; blur: boolean }) {
  return (
    <span
      className={`transition-all duration-200 select-none ${blur ? "blur-[3px]" : ""}`}
      style={blur ? { userSelect: "none" } : undefined}
    >
      {children}
    </span>
  );
}

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: "live" | "active" | "plan";
}) {
  const classes =
    tone === "live"
      ? "border-green-500/35 bg-green-500/12 text-green-200"
      : tone === "active"
        ? "border-sky-500/35 bg-sky-500/12 text-sky-200"
        : "border-slate-600 bg-slate-700/60 text-slate-300";

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.15em] ${classes}`}>
      {label}
    </span>
  );
}

export function AccountCard({
  account,
  onSwitch,
  onWarmup,
  onDelete,
  onRefresh,
  onRename,
  switching,
  switchDisabled,
  warmingUp,
  masked = false,
  isLive = false,
  onToggleMask,
}: AccountCardProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(
    account.usage && !account.usage.error ? new Date() : null
  );
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(account.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
      setLastRefresh(new Date());
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRename = async () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== account.name) {
      try {
        await onRename(trimmed);
      } catch {
        setEditName(account.name);
      }
    } else {
      setEditName(account.name);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      void handleRename();
    } else if (event.key === "Escape") {
      setEditName(account.name);
      setIsEditing(false);
    }
  };

  const effectivePlanType = account.usage?.plan_type ?? account.plan_type;
  const planDisplay = effectivePlanType
    ? effectivePlanType.charAt(0).toUpperCase() + effectivePlanType.slice(1)
    : account.auth_mode === "api_key"
      ? "API Key"
      : "未知";

  const cardClass = account.is_active || isLive
    ? "border-green-500/25 bg-slate-900/80 shadow-[0_0_0_1px_rgba(34,197,94,0.06),0_20px_60px_rgba(0,0,0,0.3)]"
    : "border-slate-700/60 bg-slate-900/50 hover:border-slate-600 hover:bg-slate-900/70";

  return (
    <div className={`group relative overflow-hidden rounded-2xl border p-5 text-slate-100 transition-all duration-300 cursor-pointer ${cardClass}`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,197,94,0.08),transparent_35%),linear-gradient(180deg,rgba(255,255,255,0.01),transparent)]" />
      <div className="relative space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              {isLive && <StatusPill label="实时工作区" tone="live" />}
              {account.is_active && <StatusPill label="激活" tone="active" />}
              <StatusPill label={planDisplay} tone="plan" />
            </div>
            {isEditing ? (
              <input
                ref={inputRef}
                type="text"
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
                onBlur={() => {
                  void handleRename();
                }}
                onKeyDown={handleKeyDown}
                className="w-full rounded-lg border border-green-500/30 bg-black/30 px-3 py-1.5 font-semibold text-slate-50 focus:border-green-500 focus:outline-none"
              />
            ) : (
              <h3
                className="truncate text-lg font-semibold tracking-tight text-slate-50 transition-colors hover:text-green-300 cursor-pointer"
                onClick={() => {
                  if (masked) return;
                  setEditName(account.name);
                  setIsEditing(true);
                }}
                title={masked ? undefined : "点击重命名"}
              >
                <BlurredText blur={masked}>{account.name}</BlurredText>
              </h3>
            )}
            {account.email && (
              <p className="truncate pt-1 font-mono text-xs text-slate-500">
                <BlurredText blur={masked}>{account.email}</BlurredText>
              </p>
            )}
          </div>

          {onToggleMask && (
            <button
              onClick={onToggleMask}
              className="rounded-lg border border-slate-700 bg-slate-800/50 p-2 text-slate-400 transition-all duration-200 hover:border-slate-500 hover:text-slate-200 cursor-pointer"
              title={masked ? "显示信息" : "隐藏信息"}
            >
              {masked ? (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          )}
        </div>

        <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-3">
          <UsageBar usage={account.usage} loading={isRefreshing || account.usageLoading} />
        </div>

        <div className="flex items-center justify-between text-[10px] font-medium uppercase tracking-[0.15em] text-slate-500">
          <span>上次额度同步</span>
          <span className="font-mono text-slate-400">{formatLastRefresh(lastRefresh)}</span>
        </div>

        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2">
          {account.is_active ? (
            <button
              disabled
              className="rounded-xl border border-sky-500/25 bg-sky-500/10 px-4 py-2.5 text-sm font-medium text-sky-200"
            >
              已激活
            </button>
          ) : (
            <button
              onClick={onSwitch}
              disabled={switching || switchDisabled}
              className="rounded-xl bg-green-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-all duration-200 hover:bg-green-400 cursor-pointer disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500"
              title={switchDisabled ? "请先关闭当前阻止切换的 Codex 进程" : undefined}
            >
              {switching ? "切换中..." : switchDisabled ? "阻断" : "切换"}
            </button>
          )}

          <button
            onClick={() => {
              void onWarmup();
            }}
            disabled={warmingUp}
            className="rounded-xl border border-amber-600/25 bg-amber-500/8 px-3 py-2.5 text-sm text-amber-300 transition-all duration-200 hover:border-amber-500/35 hover:bg-amber-500/12 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            title={warmingUp ? "正在发送预热请求..." : "发送最小预热请求"}
          >
            <svg className="mx-auto h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </button>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2.5 text-sm text-slate-300 transition-all duration-200 hover:border-slate-600 hover:bg-slate-700/60 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            title="刷新额度"
          >
            <svg className={`mx-auto h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>

          <button
            onClick={onDelete}
            className="rounded-xl border border-red-500/15 bg-red-500/8 px-3 py-2.5 text-sm text-red-300 transition-all duration-200 hover:border-red-500/25 hover:bg-red-500/12 cursor-pointer"
            title="删除账号"
          >
            <svg className="mx-auto h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
