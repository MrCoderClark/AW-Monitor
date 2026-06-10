import { cn } from "@/lib/utils";
import { STATUS_CONFIG, formatRelativeTime } from "@/lib/utils";
import type { PCHealthSnapshot } from "@/lib/types";

interface PCTileProps {
  snapshot: PCHealthSnapshot;
  onClick: () => void;
}

export function PCTile({ snapshot, onClick }: PCTileProps) {
  const config = STATUS_CONFIG[snapshot.status] || STATUS_CONFIG.UNKNOWN;

  return (
    <button
      onClick={onClick}
      className={cn(
        "relative p-3 rounded-lg border text-left transition-all duration-300",
        "hover:border-border-hover hover:scale-[1.02]",
        config.bg,
        "border-transparent"
      )}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium text-white">{snapshot.pc_name}</span>
        <span className={cn("h-2 w-2 rounded-full", config.color.replace("text-", "bg-"), snapshot.status === "OFFLINE" && "animate-status-pulse")} />
      </div>
      <div className="font-mono text-2xs text-neutral-500">{snapshot.ip_address}</div>
      {snapshot.ping_ms !== null && (
        <div className="font-mono text-2xs text-neutral-600 mt-1">{snapshot.ping_ms.toFixed(0)}ms</div>
      )}
      {snapshot.checked_at && (
        <div className="text-2xs text-neutral-700 mt-1">{formatRelativeTime(snapshot.checked_at)}</div>
      )}
    </button>
  );
}
