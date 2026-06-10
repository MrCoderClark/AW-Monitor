"use client";

import { useQuery } from "@tanstack/react-query";
import { HealthGrid } from "@/components/health-grid";
import { apiFetch } from "@/lib/api";
import { useHealthStream } from "@/hooks/use-health-stream";
import type { BackupRunStats } from "@/lib/types";
import { BACKUP_STATUS_CONFIG, formatRelativeTime } from "@/lib/utils";

export default function DashboardPage() {
  const { snapshots, connected } = useHealthStream();

  const { data: backupStats } = useQuery({
    queryKey: ["backup-stats"],
    queryFn: () => apiFetch<BackupRunStats>("/api/backup-runs/stats"),
    refetchInterval: 30_000,
  });

  const onlineCount = snapshots.filter((s) => s.status === "ONLINE").length;
  const totalCount = snapshots.length;

  return (
    <div className="grid grid-cols-[1fr_380px] gap-4 h-full">
      <div className="bg-surface-1 rounded-lg border border-border-subtle p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs uppercase tracking-wider text-neutral-500">
            PC Health
            <span className="ml-2 text-neutral-600">
              {onlineCount}/{totalCount}
            </span>
          </h3>
          <span className={`h-2 w-2 rounded-full ${connected ? "bg-status-online" : "bg-status-offline animate-status-pulse"}`} />
        </div>
        <HealthGrid snapshots={snapshots} />
      </div>

      <div className="space-y-4">
        <div className="bg-surface-1 rounded-lg border border-border-subtle p-4">
          <h3 className="text-xs uppercase tracking-wider text-neutral-500 mb-3">Latest Backup</h3>
          {backupStats?.last_run ? (
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-xs text-neutral-500">Status</span>
                <span className={`text-xs font-medium ${BACKUP_STATUS_CONFIG[backupStats.last_run.status]?.color}`}>
                  {backupStats.last_run.status}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-neutral-500">Files Copied</span>
                <span className="text-xs text-white font-mono">{backupStats.last_run.files_copied}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-neutral-500">Skipped</span>
                <span className="text-xs text-neutral-400 font-mono">{backupStats.last_run.files_skipped}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-neutral-500">Duration</span>
                <span className="text-xs text-neutral-400 font-mono">{backupStats.last_run.duration_seconds.toFixed(1)}s</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-neutral-500">When</span>
                <span className="text-xs text-neutral-600">{formatRelativeTime(backupStats.last_run.received_at)}</span>
              </div>
            </div>
          ) : (
            <p className="text-neutral-600 text-sm">No backup runs recorded yet.</p>
          )}
        </div>

        <div className="bg-surface-1 rounded-lg border border-border-subtle p-4">
          <h3 className="text-xs uppercase tracking-wider text-neutral-500 mb-3">Quick Stats</h3>
          {backupStats ? (
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-xs text-neutral-500">Total Runs</span>
                <span className="text-xs text-white font-mono">{backupStats.total_runs}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-neutral-500">Success Rate</span>
                <span className="text-xs text-status-online font-mono">{backupStats.success_rate}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-neutral-500">Avg Duration</span>
                <span className="text-xs text-neutral-400 font-mono">{backupStats.avg_duration_seconds}s</span>
              </div>
            </div>
          ) : (
            <p className="text-neutral-600 text-sm">No stats available yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
