import type { CodexProcessInfo, WorkspaceAuthState } from "../types";

interface WorkspaceStatusPanelProps {
  workspaceAuth: WorkspaceAuthState | null;
  workspaceLoading: boolean;
  processInfo: CodexProcessInfo | null;
  onRefresh: () => void;
  onCaptureCurrent: () => void;
}

function statusTone(status: WorkspaceAuthState["status"] | undefined) {
  switch (status) {
    case "matched":
      return "border-green-500/30 bg-green-500/10 text-green-200";
    case "unmatched":
      return "border-amber-500/30 bg-amber-500/10 text-amber-200";
    case "invalid":
      return "border-red-500/30 bg-red-500/10 text-red-200";
    default:
      return "border-slate-700 bg-slate-800/60 text-slate-300";
  }
}

function statusLabel(state: WorkspaceAuthState | null) {
  if (!state) return "工作区 auth 不可用";
  switch (state.status) {
    case "matched":
      return "已校验";
    case "unmatched":
      return "未托管";
    case "invalid":
      return "无法读取";
    case "missing":
      return "缺失";
    default:
      return "不可用";
  }
}

function detailLine(state: WorkspaceAuthState | null) {
  if (!state) return "尚未加载实时 auth 状态。";
  if (state.status === "matched") {
    return `实时 auth 已匹配 ${state.matched_account_name ?? "某个托管账号"}${
      state.active_matches_live ? "，并且与应用激活态一致。" : "，但与应用激活态不一致。"
    }`;
  }
  if (state.status === "unmatched") {
    return `检测到实时 ${
      state.email ? `${state.email} ` : ""
    }会话，但它尚未加入你的托管账号列表。`;
  }
  if (state.status === "invalid") {
    return state.error ?? "auth.json 文件存在，但无法解析。";
  }
  return "当前 Codex 工作区路径下未找到 auth.json。";
}

export function WorkspaceStatusPanel({
  workspaceAuth,
  workspaceLoading,
  processInfo,
  onRefresh,
  onCaptureCurrent,
}: WorkspaceStatusPanelProps) {
  const hasRunningProcesses = Boolean(processInfo && processInfo.count > 0);
  const hasBlockingProcesses = Boolean(processInfo && processInfo.blocking_count > 0);
  const captureDisabled =
    workspaceLoading ||
    !workspaceAuth ||
    workspaceAuth.status === "missing" ||
    workspaceAuth.status === "invalid";

  return (
    <section className="relative overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-900/70 px-6 py-6 text-slate-100 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.1),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.06),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent)]" />
      <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(16rem,0.95fr)]">
        <div>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.15em] ${statusTone(workspaceAuth?.status)}`}>
              {workspaceLoading ? "加载中" : statusLabel(workspaceAuth)}
            </span>
            {processInfo && (
              <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.15em] ${
                hasRunningProcesses
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
                  : "border-green-500/30 bg-green-500/10 text-green-200"
              }`}>
                {hasRunningProcesses
                  ? `${processInfo.count} 进程`
                  : "空闲"}
              </span>
            )}
            {processInfo && (
              <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.15em] ${
                hasBlockingProcesses
                  ? "border-red-500/30 bg-red-500/10 text-red-200"
                  : "border-green-500/30 bg-green-500/10 text-green-200"
              }`}>
                {hasBlockingProcesses ? "不可切换" : "可切换"}
              </span>
            )}
          </div>

          <h2 className="max-w-2xl text-lg font-semibold tracking-tight text-slate-100">
            实时工作区状态
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
            {detailLine(workspaceAuth)}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              onClick={onRefresh}
              className="rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-2.5 text-sm font-medium text-slate-200 transition-all duration-200 hover:border-slate-600 hover:bg-slate-700/80 cursor-pointer"
            >
              刷新状态
            </button>
            <button
              onClick={onCaptureCurrent}
              disabled={captureDisabled}
              className="rounded-xl bg-green-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-all duration-200 hover:bg-green-400 cursor-pointer disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500"
            >
              导入当前 Auth
            </button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4">
            <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-slate-500">实时 Auth</p>
            <p className="mt-2 text-base font-semibold text-slate-100">
              {workspaceAuth?.matched_account_name ??
                workspaceAuth?.email ??
                (workspaceLoading ? "加载中..." : "未托管")}
            </p>
            <p className="mt-1 font-mono text-xs text-slate-500 truncate">
              {workspaceAuth?.path || "没有可用的 auth.json 路径"}
            </p>
          </div>

          <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4">
            <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-slate-500">应用激活</p>
            <p className="mt-2 text-base font-semibold text-slate-100">
              {workspaceAuth?.active_account_name ?? "未选择"}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {workspaceAuth?.active_matches_live
                ? "状态一致"
                : "实时 auth 不一致，或尚未完成匹配"}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
