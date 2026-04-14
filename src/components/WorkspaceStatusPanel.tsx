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
      return "border-emerald-400/35 bg-emerald-400/12 text-emerald-100";
    case "unmatched":
      return "border-amber-400/35 bg-amber-400/12 text-amber-100";
    case "invalid":
      return "border-rose-400/35 bg-rose-400/12 text-rose-100";
    default:
      return "border-white/10 bg-white/5 text-slate-200";
  }
}

function statusLabel(state: WorkspaceAuthState | null) {
  if (!state) return "工作区 auth 不可用";
  switch (state.status) {
    case "matched":
      return "工作区 auth 已校验";
    case "unmatched":
      return "工作区 auth 未托管";
    case "invalid":
      return "工作区 auth 无法读取";
    case "missing":
      return "工作区 auth 缺失";
    default:
      return "工作区 auth 不可用";
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
    <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950 px-6 py-6 text-slate-100 shadow-[0_30px_80px_rgba(2,6,23,0.45)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(52,211,153,0.16),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.12),transparent_35%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent)]" />
      <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.95fr)]">
        <div>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <span className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.22em] ${statusTone(workspaceAuth?.status)}`}>
              {workspaceLoading ? "正在刷新工作区" : statusLabel(workspaceAuth)}
            </span>
            {processInfo && (
              <span className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.22em] ${
                hasRunningProcesses
                  ? "border-amber-400/35 bg-amber-400/12 text-amber-100"
                  : "border-sky-400/35 bg-sky-400/12 text-sky-100"
              }`}>
                {hasRunningProcesses
                  ? `检测到 ${processInfo.count} 个 Codex 进程`
                  : "未检测到 Codex 进程"}
              </span>
            )}
            {processInfo && (
              <span className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.22em] ${
                hasBlockingProcesses
                  ? "border-rose-400/35 bg-rose-400/12 text-rose-100"
                  : "border-emerald-400/35 bg-emerald-400/12 text-emerald-100"
              }`}>
                {hasBlockingProcesses ? "当前建议稍后切换" : "当前切换策略允许继续操作"}
              </span>
            )}
          </div>

          <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-white">
            直接查看已校验的实时工作区状态，再切换 GPT 账号，不用再猜当前到底是哪一个 auth 生效。
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
            {detailLine(workspaceAuth)}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              onClick={onRefresh}
              className="rounded-xl border border-white/10 bg-white/8 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/12"
            >
              刷新工作区状态
            </button>
            <button
              onClick={onCaptureCurrent}
              disabled={captureDisabled}
              className="rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            >
              导入当前 Auth
            </button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <div className="rounded-[1.35rem] border border-white/10 bg-black/20 p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">实时 Auth</p>
            <p className="mt-2 text-lg font-semibold text-white">
              {workspaceAuth?.matched_account_name ??
                workspaceAuth?.email ??
                (workspaceLoading ? "加载中..." : "未托管")}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {workspaceAuth?.path || "没有可用的 auth.json 路径"}
            </p>
          </div>

          <div className="rounded-[1.35rem] border border-white/10 bg-black/20 p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">应用激活</p>
            <p className="mt-2 text-lg font-semibold text-white">
              {workspaceAuth?.active_account_name ?? "未选择"}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {workspaceAuth?.active_matches_live
                ? "本地状态与实时 auth 一致。"
                : "实时 auth 不一致，或尚未完成匹配。"}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
