import type { UsageInfo } from "../types";

interface UsageBarProps {
  usage?: UsageInfo;
  loading?: boolean;
}

function formatResetTime(resetAt: number | null | undefined): string {
  if (!resetAt) return "";
  const now = Math.floor(Date.now() / 1000);
  const diff = resetAt - now;
  if (diff <= 0) return "现在";
  if (diff < 60) return `${diff}秒`;
  if (diff < 3600) return `${Math.floor(diff / 60)}分`;
  return `${Math.floor(diff / 3600)}小时 ${Math.floor((diff % 3600) / 60)}分`;
}

function formatExactResetTime(resetAt: number | null | undefined): string {
  if (!resetAt) return "";

  const date = new Date(resetAt * 1000);
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function formatWindowDuration(minutes: number | null | undefined): string {
  if (!minutes) return "";
  if (minutes < 60) return `${minutes}分`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时`;
  return `${Math.floor(hours / 24)}天`;
}

function RateLimitBar({
  label,
  usedPercent,
  windowMinutes,
  resetsAt,
}: {
  label: string;
  usedPercent: number;
  windowMinutes?: number | null;
  resetsAt?: number | null;
}) {
  const remainingPercent = Math.max(0, 100 - usedPercent);

  const colorClass =
    remainingPercent <= 10
      ? "bg-red-500"
      : remainingPercent <= 30
        ? "bg-amber-500"
        : "bg-green-500";

  const windowLabel = formatWindowDuration(windowMinutes);
  const resetLabel = formatResetTime(resetsAt);
  const exactResetLabel = formatExactResetTime(resetsAt);

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-[10px]">
        <span className="text-slate-500">
          {label} {windowLabel && `(${windowLabel})`}
        </span>
        <span className="text-slate-400">
          剩余 {remainingPercent.toFixed(0)}%
          {resetLabel && ` · ${resetLabel}后`}
          {resetLabel && exactResetLabel && ` (${exactResetLabel})`}
        </span>
      </div>
      <div className="h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${colorClass}`}
          style={{ width: `${Math.min(remainingPercent, 100)}%` }}
        ></div>
      </div>
    </div>
  );
}

export function UsageBar({ usage, loading }: UsageBarProps) {
  if (loading && !usage) {
    return (
      <div className="space-y-2.5">
        <div className="text-xs text-slate-500 animate-pulse">
          获取额度中...
        </div>
        <div className="h-1.5 bg-slate-700/60 rounded-full overflow-hidden animate-pulse">
          <div className="h-full w-2/3 bg-slate-600"></div>
        </div>
        <div className="h-1.5 bg-slate-700/60 rounded-full overflow-hidden animate-pulse">
          <div className="h-full w-1/2 bg-slate-600"></div>
        </div>
      </div>
    );
  }

  if (!usage) {
    return (
      <div className="text-xs text-slate-500 py-1 animate-pulse">
        获取额度中...
      </div>
    );
  }

  if (usage.error) {
    return (
      <div className="text-xs text-slate-500 py-1">
        {usage.error}
      </div>
    );
  }

  const hasPrimary = usage.primary_used_percent !== null && usage.primary_used_percent !== undefined;
  const hasSecondary = usage.secondary_used_percent !== null && usage.secondary_used_percent !== undefined;

  if (!hasPrimary && !hasSecondary) {
    return (
      <div className="text-xs text-slate-500 py-1">
        暂无额度数据
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {hasPrimary && (
        <RateLimitBar
          label="5小时额度"
          usedPercent={usage.primary_used_percent!}
          windowMinutes={usage.primary_window_minutes}
          resetsAt={usage.primary_resets_at}
        />
      )}
      {hasSecondary && (
        <RateLimitBar
          label="每周额度"
          usedPercent={usage.secondary_used_percent!}
          windowMinutes={usage.secondary_window_minutes}
          resetsAt={usage.secondary_resets_at}
        />
      )}
      {usage.credits_balance && (
        <div className="text-[10px] text-slate-500 mt-1">
          积分：{usage.credits_balance}
        </div>
      )}
    </div>
  );
}
