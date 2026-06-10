import { cn } from "@/lib/utils";
import { STATUS_CONFIG, BACKUP_STATUS_CONFIG } from "@/lib/utils";
import type { PCStatus, BackupRunStatus } from "@/lib/types";

export function PCStatusBadge({ status }: { status: PCStatus }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.UNKNOWN;
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium", config.bg, config.color)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", config.color.replace("text-", "bg-"))} />
      {config.label}
    </span>
  );
}

export function BackupStatusBadge({ status }: { status: BackupRunStatus }) {
  const config = BACKUP_STATUS_CONFIG[status] || BACKUP_STATUS_CONFIG.NO_FILES;
  return (
    <span className={cn("text-xs font-medium", config.color)}>{config.label}</span>
  );
}
